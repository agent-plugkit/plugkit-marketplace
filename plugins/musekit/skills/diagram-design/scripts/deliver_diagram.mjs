#!/usr/bin/env node
import { realpathSync } from "node:fs";
import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { digest, inspectDiagram } from "./inspect_diagram.mjs";

const execute = promisify(execFile);
const usage =
  "Usage: node deliver_diagram.mjs source.html --output artwork.editable.html [--browser chromium|chrome|msedge] [--scale 1|2] [--strict] [--json]";
const directory = dirname(fileURLToPath(import.meta.url));
async function targetState(path) {
  try {
    const stat = await fs.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(
        "Output must be a regular HTML file, not a directory or symbolic link",
      );
    return {
      dev: stat.dev,
      ino: stat.ino,
      size: stat.size,
      mtime: stat.mtimeMs,
      ...digest(await fs.readFile(path)),
    };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function optionsFor(args) {
  const input = args.shift(),
    options = { browser: "chromium", scale: "2", strict: false, json: false };
  while (args.length) {
    const key = args.shift();
    if (["--strict", "--json"].includes(key)) {
      options[key.slice(2)] = true;
      continue;
    }
    if (!["--output", "--browser", "--scale"].includes(key) || !args.length)
      throw new Error(usage);
    options[key.slice(2)] = args.shift();
  }
  if (
    !input ||
    !options.output ||
    !options.output.endsWith(".html") ||
    !["chromium", "chrome", "msedge"].includes(options.browser) ||
    !["1", "2"].includes(options.scale)
  )
    throw new Error(usage);
  return { input, options };
}

async function deliverDiagram(input, options) {
  const runId = randomUUID();
  let lock,
    lockPath,
    work,
    evidenceDirectory,
    committed = false,
    target,
    reportPath,
    report,
    before;
  let stage = "prepare";
  try {
    const source = await fs.realpath(resolve(input));
    const output = resolve(options.output);
    await fs.mkdir(dirname(output), { recursive: true });
    target = join(await fs.realpath(dirname(output)), basename(output));
    before = await targetState(target);
    const sourceStat = await fs.stat(source);
    if (
      source === target ||
      (before && sourceStat.dev === before.dev && sourceStat.ino === before.ino)
    )
      throw new Error(
        "Delivery input and output must be different files; keep the authored source separately",
      );
    lockPath = `${target}.delivery.lock`;
    try {
      lock = await fs.open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error.code === "EEXIST")
        throw new Error(
          `Another delivery owns ${lockPath}. If its process has stopped, remove that stale lock before retrying.`,
        );
      throw error;
    }
    await lock.writeFile(JSON.stringify({ pid: process.pid, runId }) + "\n");
    // Read after acquiring the target lock. Frozen bytes are the only authoring input.
    const bytes = await fs.readFile(source);
    const sourceIdentity = digest(bytes);
    work = await fs.mkdtemp(join(dirname(target), ".musekit-candidate-"));
    const snapshot = join(work, "source.html"),
      candidate = join(work, "artifact.html");
    await fs.writeFile(snapshot, bytes, { mode: 0o600 });
    stage = "package";
    try {
      await execute(
        "python3",
        [
          join(directory, "prepare_diagram.py"),
          snapshot,
          "--output",
          candidate,
        ],
        { maxBuffer: 1024 * 1024 },
      );
    } catch (error) {
      error.message =
        error.code === "ENOENT"
          ? "Python 3 is unavailable"
          : `Packaging failed: ${(error.stderr || error.message).trim()}`;
      throw error;
    }
    stage = "inspect";
    report = await inspectDiagram(candidate, {
      ...options,
      output: join(work, "checks"),
    });
    if (!report.passed)
      return {
        ok: false,
        committed: false,
        stage,
        output: target,
        runId,
        exitCode: report.failureKind === "environment" ? 2 : 1,
        errors: report.errors,
        issues: report.issues,
        checks: report.checks,
        policy: report.policy,
      };

    stage = "evidence";
    // Each batch is independent. Existing evidence is never rewritten or called current.
    const evidenceRoot = join(
      dirname(target),
      `${basename(target, ".html")}.checks`,
    );
    await fs.mkdir(evidenceRoot, { recursive: true });
    const evidenceStat = await fs.lstat(evidenceRoot);
    if (!evidenceStat.isDirectory() || evidenceStat.isSymbolicLink())
      throw new Error("Evidence root must be a real directory");
    evidenceDirectory = join(evidenceRoot, runId);
    reportPath = join(evidenceDirectory, "report.json");
    const pngPath = join(evidenceDirectory, "diagram.png");
    report = {
      ...report,
      input: source,
      output: target,
      source: sourceIdentity,
      runId,
      report: reportPath,
      png: { ...report.png, file: pngPath },
      delivery: {
        commitPoint: "atomic-html-replacement",
        verifyOutputSha256: report.artifact.sha256,
      },
    };
    const stagedEvidence = join(work, "evidence");
    await fs.mkdir(stagedEvidence);
    await fs.copyFile(
      join(work, "checks", "artifact.png"),
      join(stagedEvidence, "diagram.png"),
    );
    // Preserve the verified bytes for post-interruption reconciliation as well.
    await fs.copyFile(candidate, join(stagedEvidence, "artifact.html"));
    await fs.writeFile(
      join(stagedEvidence, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    await fs.rename(stagedEvidence, evidenceDirectory);
    stage = "commit";
    if (JSON.stringify(await targetState(target)) !== JSON.stringify(before))
      throw new Error(
        "Output changed during verification; the candidate was not committed",
      );
    if (digest(await fs.readFile(candidate)).sha256 !== report.artifact.sha256)
      throw new Error(
        "Candidate changed after inspection; the candidate was not committed",
      );
    await fs.rename(candidate, target);
    committed = true;
    return {
      ok: true,
      committed: true,
      exitCode: 0,
      runId,
      output: target,
      png: pngPath,
      report: reportPath,
      artifact: report.artifact,
      source: sourceIdentity,
      policy: report.policy,
      errorCount: report.errorCount,
      warningCount: report.warningCount,
      visualReview: "not-performed",
      semanticReview: "not-performed",
    };
  } catch (error) {
    const missing =
      (error.code === "ENOENT" && stage === "package") ||
      /Playwright is unavailable/.test(error.message);
    return {
      ok: committed,
      committed,
      exitCode: committed ? 0 : missing ? 2 : 1,
      stage,
      runId,
      output: target || resolve(options.output),
      report: committed ? reportPath : undefined,
      error: error.message,
    };
  } finally {
    // Cleanup failure cannot undo a completed commit or turn it into a false failure.
    if (!committed && evidenceDirectory)
      await fs
        .rm(evidenceDirectory, { recursive: true, force: true })
        .catch(() => {});
    if (work)
      await fs.rm(work, { recursive: true, force: true }).catch(() => {});
    if (lock) {
      await lock.close().catch(() => {});
      await fs.unlink(lockPath).catch(() => {});
    }
  }
}

async function main(args) {
  const json = args.includes("--json");
  if (args.includes("--help")) {
    console.log(usage);
    return;
  }
  let result;
  try {
    const { input, options } = optionsFor(args);
    result = await deliverDiagram(input, options);
  } catch (error) {
    result = {
      ok: false,
      committed: false,
      exitCode: 2,
      stage: "arguments",
      error: error.message,
    };
  }
  if (json) console.log(JSON.stringify(result, null, 2));
  else if (result.ok)
    console.log(
      `HTML: ${result.output}\nPNG: ${result.png}\nReport: ${result.report}\nWarnings: ${result.warningCount}. Visual and source-semantic review are not performed.`,
    );
  else console.error(JSON.stringify(result, null, 2));
  process.exitCode = result.exitCode;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
)
  main(process.argv.slice(2));
