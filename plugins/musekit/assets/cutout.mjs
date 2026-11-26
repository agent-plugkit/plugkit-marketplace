#!/usr/bin/env node
/*
 * Musekit 前景抠图：把一张照片和它的黑白前景遮罩合成一张带透明通道的前景 PNG。
 *
 * 用法：把本文件复制进作品目录，在能解析 Playwright 的目录里运行（和检查脚本 inspect_page.mjs
 * 一样）：
 *
 *   node cutout.mjs photo.jpg photo-mask.jpg --out photo-fg.png [--check photo-edge.jpg]
 *
 * 遮罩是同一画面的黑白图：前景白，其余黑。生图工具可以按原图生成（「同样的构图和尺寸，
 * 近处的前景涂成纯白，其余涂成纯黑」）。遮罩尺寸和照片不同时按照片拉伸，所以两者的宽高比必须一致。
 *
 * 选项：
 *   --out FILE        前景 PNG（默认 <照片名>-fg.png，放在照片旁边）
 *   --check FILE      另存一张检查图：照片上用红线画出遮罩轮廓，用来核对轮廓是否贴合
 *   --threshold 0-255 遮罩亮度高于它算前景（默认 128）
 *   --feather PX      轮廓羽化半径，按照片像素计（默认 1.2），去掉锯齿又不发虚
 *
 * 页面里把照片和前景 PNG 叠成三层：照片、字或别的元素、前景 PNG，三者用同样的
 * object-fit 与 object-position，前景就和照片对齐。前景用 <img> 引入，不用 CSS mask：
 * file:// 打开页面时，mask 引用的本地图片会被当作跨域资源，整块不显示。
 *
 * 输出一行 JSON：尺寸、前景占画面的比例、写出的文件。
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

export const usage = "Usage: node cutout.mjs <photo> <mask> [--out FILE] [--check FILE] [--threshold 0-255] [--feather PX]";

export function parseArgs(argv) {
  const args = [...argv];
  const [photo, mask] = [args.shift(), args.shift()];
  if (!photo || !mask || photo.startsWith("--") || mask.startsWith("--")) throw new Error(usage);
  const opts = { photo, mask, threshold: 128, feather: 1.2 };
  while (args.length) {
    const key = args.shift();
    if (!["--out", "--check", "--threshold", "--feather"].includes(key) || !args.length) throw new Error(`Unknown or incomplete option ${key}\n${usage}`);
    opts[key.slice(2)] = args.shift();
  }
  opts.threshold = Number(opts.threshold);
  opts.feather = Number(opts.feather);
  if (!(opts.threshold >= 0 && opts.threshold <= 255)) throw new Error(`--threshold must be 0-255\n${usage}`);
  if (!(opts.feather >= 0 && opts.feather <= 20)) throw new Error(`--feather must be 0-20\n${usage}`);
  opts.out ||= join(dirname(photo), `${basename(photo, extname(photo))}-fg.png`);
  return opts;
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const dataUrl = async (file) => {
  const type = MIME[extname(file).toLowerCase()];
  if (!type) throw new Error(`${file}: use a JPEG, PNG or WebP image`);
  return `data:${type};base64,${(await readFile(file)).toString("base64")}`;
};

// Runs in the page. Images come in as data URLs, so the canvas is never tainted.
async function compose({ photo, mask, threshold, feather, check }) {
  const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error("image failed to decode")); i.src = src; });
  const [p, m] = await Promise.all([load(photo), load(mask)]);
  const w = p.naturalWidth, h = p.naturalHeight;
  const ratio = (m.naturalWidth / m.naturalHeight) / (w / h);
  if (Math.abs(ratio - 1) > 0.01) throw new Error(`mask is ${m.naturalWidth}x${m.naturalHeight}, photo is ${w}x${h}: the aspect ratios differ, so the mask would not line up`);
  const canvas = (cw = w, ch = h) => { const c = document.createElement("canvas"); c.width = cw; c.height = ch; return c; };

  // Hard mask first (the generated one carries soft grey and JPEG noise), then a small feather.
  const hard = canvas(), hg = hard.getContext("2d");
  hg.drawImage(m, 0, 0, w, h);
  const md = hg.getImageData(0, 0, w, h);
  let inside = 0;
  for (let i = 0; i < md.data.length; i += 4) {
    const lum = 0.2126 * md.data[i] + 0.7152 * md.data[i + 1] + 0.0722 * md.data[i + 2];
    const v = lum > threshold ? 255 : 0;
    if (v) inside++;
    md.data[i] = md.data[i + 1] = md.data[i + 2] = v; md.data[i + 3] = 255;
  }
  hg.putImageData(md, 0, 0);
  const soft = canvas(), sg = soft.getContext("2d");
  sg.filter = feather > 0 ? `blur(${feather}px)` : "none";
  sg.drawImage(hard, 0, 0);
  const alpha = sg.getImageData(0, 0, w, h).data;

  const out = canvas(), og = out.getContext("2d");
  og.drawImage(p, 0, 0);
  const px = og.getImageData(0, 0, w, h);
  for (let i = 0; i < px.data.length; i += 4) px.data[i + 3] = alpha[i];
  og.putImageData(px, 0, 0);
  const result = { width: w, height: h, share: Math.round((inside / (w * h)) * 1000) / 1000, png: out.toDataURL("image/png") };

  if (check) {
    // The contour: a mask pixel whose right or lower neighbour differs.
    const c = canvas(), cg = c.getContext("2d");
    cg.drawImage(p, 0, 0);
    const edge = cg.getImageData(0, 0, w, h), hd = md.data, line = Math.max(1, Math.round(w / 1400));
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (hd[i] === hd[i + 4] && hd[i] === hd[i + w * 4]) continue;
      for (let dy = 0; dy < line; dy++) for (let dx = 0; dx < line; dx++) {
        const j = (Math.min(h - 1, y + dy) * w + Math.min(w - 1, x + dx)) * 4;
        edge.data[j] = 255; edge.data[j + 1] = 40; edge.data[j + 2] = 40;
      }
    }
    cg.putImageData(edge, 0, 0);
    result.check = c.toDataURL("image/jpeg", 0.85);
  }
  return result;
}

export async function cutout(opts) {
  const require = createRequire(join(process.cwd(), "package.json"));
  let chromium;
  try { ({ chromium } = require("playwright")); } catch { throw new Error("Playwright is unavailable in this working directory."); }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const r = await page.evaluate(compose, { photo: await dataUrl(opts.photo), mask: await dataUrl(opts.mask), threshold: opts.threshold, feather: opts.feather, check: !!opts.check });
    const files = { out: resolve(opts.out) };
    await writeFile(files.out, Buffer.from(r.png.split(",")[1], "base64"));
    if (opts.check) { files.check = resolve(opts.check); await writeFile(files.check, Buffer.from(r.check.split(",")[1], "base64")); }
    return { width: r.width, height: r.height, share: r.share, ...files };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await cutout(parseArgs(process.argv.slice(2)))));
  } catch (error) {
    console.error(error.message);
    if (/Playwright is unavailable/.test(error.message))
      console.error("Fix: [ -f package.json ] || npm init -y >/dev/null && npm install --no-save playwright && npx playwright install chromium");
    process.exitCode = 1;
  }
}
