// Render Musepool template specimens to PNG: npm run build:specimens [-- <template-id>...]
// Specimens are reviewed by eye (validation layer 2) and committed beside each template.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const skill = resolve(root, "plugins/musekit/skills/musepool");
const templates = join(skill, "library/templates");
const requested = process.argv.slice(2);
const ids = requested.length
  ? requested
  : readdirSync(templates).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3));

const work = mkdtempSync(join(tmpdir(), "musepool-specimen-"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const id of ids) {
    const html = join(work, `${id}.html`);
    execFileSync("python3", [join(skill, "scripts/muse.py"), "specimen", id, "--out", html], { stdio: "inherit" });
    await page.goto(`file://${html}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const missing = await page.evaluate(() =>
      [...new Set([...document.fonts].filter((font) => font.status === "error").map((font) => font.family))]);
    if (missing.length) console.warn(`${id}: fonts failed to load, fallback used: ${missing.join(", ")}`);
    await page.screenshot({ path: join(templates, `${id}.png`), fullPage: true });
    console.log(`Rendered ${id}.png`);
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
