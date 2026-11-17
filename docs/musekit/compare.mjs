#!/usr/bin/env node
// 辨识度对照：把几件作品去色、去阴影后截图，再拼成一张并排的对照图。
// 用法（在仓库根目录运行）：
//   node docs/musekit/compare.mjs <输出目录> <标签>=<HTML 文件>[@宽x高] ...
// 不写尺寸时按 1440x900 截首屏。尺寸相同的作品排在同一行，行的先后按参数里第一次出现的顺序。
// 例：node docs/musekit/compare.mjs out/compare 新风格=work/poster/poster.html@1080x1440 \
//       neo-swiss=examples/poster.html@1080x1440 新风格首页=work/web/index.html neo-swiss首页=examples/index.html
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [outArg, ...specs] = process.argv.slice(2);
if (!outArg || !specs.length) {
  console.error("用法：node docs/musekit/compare.mjs <输出目录> <标签>=<HTML 文件>[@宽x高] ...");
  process.exit(1);
}
const out = resolve(outArg);
mkdirSync(out, { recursive: true });

const shots = specs.map((spec, index) => {
  const at = spec.indexOf("=");
  if (at < 1) throw new Error(`参数应为 <标签>=<文件>[@宽x高]：${spec}`);
  const [file, size = "1440x900"] = spec.slice(at + 1).split("@");
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) throw new Error(`尺寸应为 宽x高：${spec}`);
  return { label: spec.slice(0, at), file: resolve(file), width: Number(match[1]), height: Number(match[2]), png: `${String(index + 1).padStart(2, "0")}.png` };
});

const browser = await chromium.launch();
try {
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
    await page.goto(pathToFileURL(shot.file).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: "*,*::before,*::after{box-shadow:none!important;text-shadow:none!important;animation:none!important;transition:none!important} html{filter:grayscale(1)!important}",
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(out, shot.png) });
    await page.close();
    console.log(`${shot.png}  ${shot.label}  ${shot.width}x${shot.height}`);
  }

  // 每行按尺寸分组；图按统一的显示宽度缩放，竖版海报与横版首屏各自成行。
  const rows = new Map();
  for (const shot of shots) {
    const key = `${shot.width}x${shot.height}`;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(shot);
  }
  const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const body = [...rows].map(([size, items]) => {
    const width = items[0].height > items[0].width ? 300 : 420;
    const figures = items.map((s) => `<figure><img src="${s.png}" style="width:${width}px"><figcaption>${escape(s.label)}</figcaption></figure>`).join("");
    return `<h2>${size} · 灰度，去阴影</h2><div class="row">${figures}</div>`;
  }).join("");
  const sheet = join(out, "sheet.html");
  writeFileSync(sheet, `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#fff;font:600 16px/1.4 system-ui,sans-serif}h2{margin:16px 0 8px}.row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}figure{margin:0}img{display:block;border:1px solid #999}figcaption{margin-top:6px}</style>${body}`);
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await page.goto(pathToFileURL(sheet).href, { waitUntil: "load" });
  await page.screenshot({ path: join(out, "compare.png"), fullPage: true });
  console.log(`对照图：${join(out, "compare.png")}`);
} finally {
  await browser.close();
}
