#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const usage = `Usage: node inspect_diagram.mjs artwork.html --output checks [--browser chromium|chrome|msedge] [--scale 1|2] [--strict]
Checks an embedded diagram offline, exports its complete PNG, and checks HTML save/reopen.
Requires Playwright in the current working directory and an installed browser.
Visual and source-semantic review remain the author's responsibility.`;

export const digest = (bytes) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  bytes: Buffer.byteLength(bytes),
});
function inspectionOptions(args) {
  const input = args.shift(),
    options = { browser: "chromium", scale: "2", strict: false };
  while (args.length) {
    const key = args.shift();
    if (key === "--strict") {
      options.strict = true;
      continue;
    }
    if (!["--output", "--browser", "--scale"].includes(key) || !args.length)
      throw new Error(usage);
    options[key.slice(2)] = args.shift();
  }
  if (
    !input ||
    !options.output ||
    !["chromium", "chrome", "msedge"].includes(options.browser) ||
    !["1", "2"].includes(options.scale)
  )
    throw new Error(usage);
  return { input, options };
}
export async function inspectDiagram(input, options) {
  const source = resolve(input),
    out = resolve(options.output);
  const name = basename(source, ".html");
  // Resolve the author's installed browser tools, not the plugin cache's dependencies.
  const require = createRequire(join(process.cwd(), "package.json"));
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    throw new Error(
      "Playwright is unavailable in this working directory. Use your existing browser tools, or install Playwright here and its Chromium browser. The HTML packager itself only needs Python 3.",
    );
  }
  const htmlBytes = await readFile(source);
  const html = htmlBytes.toString("utf8");
  if (!html.includes("<!-- musekit-runtime:start -->"))
    throw new Error(
      "Run prepare_diagram.py first; this file has no embedded diagram runtime.",
    );
  await mkdir(out, { recursive: true });
  const report = {
    schemaVersion: 2,
    policy: options.strict ? "strict" : "errors-only",
    artifact: digest(htmlBytes),
    runtime: digest(
      html.match(
        /<!-- musekit-runtime:start -->([\s\S]*?)<!-- musekit-runtime:end -->/,
      )?.[1] || "",
    ),
    visualReview: "not-performed",
    semanticReview: "not-performed",
    input: source,
    browser: options.browser,
    scale: Number(options.scale),
    checks: {},
    issues: [],
    errors: [],
    notChecked: [
      "Source semantics",
      "Visual review of the exported PNG",
      "Pointer editing and interaction feel",
    ],
  };
  let browser;
  try {
    try {
      browser = await chromium.launch(
        options.browser === "chromium" ? {} : { channel: options.browser },
      );
    } catch (error) {
      if (
        /Executable doesn't exist|distribution.*not found/i.test(error.message)
      )
        report.failureKind = "environment";
      throw error;
    }
    const context = await browser.newContext({
      offline: true,
      viewport: { width: 1600, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    const network = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) network.push(request.url());
    });
    const open = async (file) => {
      await page.goto(pathToFileURL(file).href);
      await page.waitForFunction(
        () => {
          const el = document.querySelector("[data-diagram]");
          if (el?.hasAttribute("data-diagram-error"))
            throw new Error(el.getAttribute("data-diagram-error"));
          return el?.getAttribute("data-diagram-ready") === "true";
        },
        null,
        { timeout: 20000 },
      );
      await page.evaluate(() => window.museDiagram.ready);
    };
    await open(source);
    const initial = await page.evaluate(() => {
      const d = window.museDiagram;
      return {
        geometry: d.getGeometry(),
        state: d.getState(),
        width: d.root.offsetWidth,
        height: d.root.offsetHeight,
      };
    });
    report.checks.initialization = true;
    report.canvas = { width: initial.width, height: initial.height };
    report.nodes = Object.keys(initial.geometry.nodes).length;
    report.edges = Object.keys(initial.geometry.edges).length;
    report.issues = initial.geometry.issues;
    report.errorCount = report.issues.filter(
      (i) => i.severity !== "warning",
    ).length;
    report.warningCount = report.issues.filter(
      (i) => i.severity === "warning",
    ).length;
    report.checks.geometry = report.errorCount === 0;
    if (options.strict)
      report.checks.strictWarnings = report.warningCount === 0;

    // Export at the requested canvas resolution, independent of the editor's view zoom.
    const encoded = await page.evaluate(async (ratio) => {
      const blob = await window.museDiagram.exportPNG(ratio);
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () =>
          reject(new Error("Could not read the exported PNG"));
        reader.readAsDataURL(blob);
      });
    }, report.scale);
    const png = Buffer.from(encoded, "base64");
    report.png = {
      ...digest(png),
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
      file: join(out, `${name}.png`),
    };
    report.checks.pngDimensions =
      report.png.width === initial.width * report.scale &&
      report.png.height === initial.height * report.scale;
    if (!report.checks.pngDimensions)
      throw new Error("PNG dimensions do not match the complete canvas");
    await writeFile(report.png.file, png);

    const saved = join(out, `${name}.reopened.html`);
    if (saved === source)
      throw new Error(
        "Choose an output directory that does not overwrite the input HTML",
      );
    await writeFile(
      saved,
      await page.evaluate(() => window.museDiagram.saveHTML()),
    );
    await open(saved);
    const reopened = await page.evaluate(() => ({
      geometry: window.museDiagram.getGeometry(),
      state: window.museDiagram.getState(),
    }));
    let error = 0;
    const compare = (a, b) => {
      if (!b) {
        error = Infinity;
        return;
      }
      for (const key of ["x", "y", "w", "h"])
        error = Math.max(error, Math.abs(a[key] - b[key]));
    };
    for (const [id, rect] of Object.entries(initial.geometry.nodes))
      compare(rect, reopened.geometry.nodes[id]);
    for (const [id, edge] of Object.entries(initial.geometry.edges)) {
      if (edge.label) compare(edge.label, reopened.geometry.edges[id]?.label);
      const points = reopened.geometry.edges[id]?.points;
      if (!points || points.length !== edge.points.length) error = Infinity;
      else
        edge.points.forEach((p, i) => {
          error = Math.max(
            error,
            Math.abs(p.x - points[i].x),
            Math.abs(p.y - points[i].y),
          );
        });
    }
    report.reopenError = Number.isFinite(error) ? error : null;
    report.checks.saveReopen =
      JSON.stringify(initial.state) === JSON.stringify(reopened.state) &&
      error <= 1;
    report.networkRequests = network;
    report.checks.offline = network.length === 0;
    report.checks.browserErrors = report.errors.length === 0;
    report.checks.sourceUnchanged =
      digest(await readFile(source)).sha256 === report.artifact.sha256;
    report.checks.reopenedGeometry =
      reopened.geometry.issues.every((i) => i.severity === "warning") &&
      (!options.strict || reopened.geometry.issues.length === 0);
  } catch (error) {
    report.errors.push(error.message);
  } finally {
    await browser?.close();
  }
  report.passed =
    report.errors.length === 0 && Object.values(report.checks).every(Boolean);
  const output = join(out, `${name}.report.json`);
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  return { ...report, report: output };
}

async function main(args) {
  if (args.includes("--help")) {
    console.log(usage);
    return;
  }
  const { input, options } = inspectionOptions(args);
  const report = await inspectDiagram(input, options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed)
    process.exitCode = report.failureKind === "environment" ? 2 : 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
