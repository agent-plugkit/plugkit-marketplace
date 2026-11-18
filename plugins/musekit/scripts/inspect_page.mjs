#!/usr/bin/env node
// Shared render-and-check script for page-shaped artwork (posters, covers, slide decks, web pages).
// It exports and screenshots the real page, then reports what a machine can measure.
// It never judges the design: every finding is a lead for the visual review.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export const usage = `Usage: node inspect_page.mjs <page.html|URL> [options]

Poster or cover (fixed canvas):
  --canvas WxH          viewport equals the canvas; exports <name>.png next to the HTML
  --scale 1|2           pixel ratio of the exported PNG (default 1)
Slide deck (one HTML, every slide a fixed canvas):
  --canvas WxH --slides SELECTOR
                        checks each element matching SELECTOR (e.g. .slide) on its own, in the print layout;
                        exports <name>-slides/01.png…, <name>.pdf and an overview sheet in colour and grey
Web page:
  --viewports LIST      e.g. 1440x900,768x1024,375x812 (the default)
  --flow FILE.mjs       optional task path; default export async ({ page, viewport, shot, check, log })
Both:
  --out DIR             screenshots and report.json (default: review/ next to the HTML)
  --facts FILE          one exact fact per line; counted in the rendered text
  --style FILE          style.md for breakpoints and palette (default: style.md next to the HTML)
  --ready JS            extra condition to wait for, e.g. "document.body.dataset.ready === '1'"
  --browser NAME        chromium (default), chrome or msedge

When style.md follows the system light/dark setting (it has a prefers-color-scheme: dark block), each web viewport
is also opened in dark and shot as web-<WxH>-dark-fold.png and -dark-full.png; colours on the first viewport are
checked against the dark palette, and rules that name a colour are measured again. The sweep, keyboard, reduced-motion and flow runs stay in light.
Layout rules listed under "机检" in style.md are measured on elements marked data-mk="<role>"; unmarked roles are
reported as not measured.
Mark intentionally clipped or decorative text (a marquee strip) with data-inspect-ignore. Never mark stickers or
other overlays with it: an ignored element is no longer checked for covering text.
Requires Playwright in the current working directory and an installed browser.
The report lists machine findings; visual review remains the author's job.`;

const DEFAULT_VIEWPORTS = "1440x900,768x1024,375x812";
const SWEEP_BASE = [320, 360, 375, 414, 600, 768, 900, 1024, 1280, 1440, 1680, 1920];
const SWEEP_HEIGHT = 900;
// Short screens (laptops, landscape tablets, small phones) where the first screen gets crowded.
const SHORT_VIEWPORTS = [[1366, 768], [1280, 720], [1024, 768], [375, 667]];
const THUMBS = [0.25, 0.35];

const size = (text, flag) => {
  const m = /^(\d+)x(\d+)$/.exec(text || "");
  if (!m) throw new Error(`${flag} expects WxH, got ${text}\n\n${usage}`);
  return { width: Number(m[1]), height: Number(m[2]) };
};

export function parseArgs(argv) {
  const args = [...argv];
  const input = args.shift();
  if (!input || input.startsWith("--")) throw new Error(usage);
  const opts = { input, browser: "chromium", scale: 1 };
  const known = ["--canvas", "--slides", "--scale", "--viewports", "--flow", "--out", "--facts", "--style", "--ready", "--browser"];
  while (args.length) {
    const key = args.shift();
    if (!known.includes(key) || !args.length) throw new Error(`Unknown or incomplete option ${key}\n\n${usage}`);
    opts[key.slice(2)] = args.shift();
  }
  if (opts.canvas && opts.viewports) throw new Error(`Use --canvas or --viewports, not both\n\n${usage}`);
  if (opts.canvas && opts.flow) throw new Error(`--flow is for web pages\n\n${usage}`);
  if (opts.slides && !opts.canvas) throw new Error(`--slides needs --canvas WxH\n\n${usage}`);
  if (!["chromium", "chrome", "msedge"].includes(opts.browser)) throw new Error(usage);
  opts.scale = Number(opts.scale);
  if (![1, 2].includes(opts.scale)) throw new Error(`--scale must be 1 or 2\n\n${usage}`);
  if (opts.canvas) opts.canvas = size(opts.canvas, "--canvas");
  else opts.viewports = (opts.viewports || DEFAULT_VIEWPORTS).split(",").map((v) => size(v.trim(), "--viewports"));
  return opts;
}

// A style that follows the system light/dark setting redefines some tokens in this block.
const DARK_BLOCK = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/;

// Colour tokens are hex or rgb()/rgba(); the page's colours are compared on r,g,b only, as the audit does.
function colourTokens(text) {
  const out = [];
  for (const m of text.matchAll(/--((?:color|data)-[\w-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)) out.push([m[1], hexToRgb(m[2])]);
  for (const m of text.matchAll(/--((?:color|data)-[\w-]+):\s*rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/g))
    out.push([m[1], [m[2], m[3], m[4]].map((n) => Math.round(Number(n))).join(",")]);
  return out;
}

// style.md: breakpoint edges become sweep widths; colour tokens become the palette, one per scheme.
export function readStyle(text) {
  const breakpoints = new Set();
  for (const m of text.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) {
    const n = Number(m[2]);
    if (m[1] === "min") breakpoints.add(n - 1).add(n);
    else breakpoints.add(n).add(n + 1);
  }
  const vars = (body) => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const dark = DARK_BLOCK.exec(text);
  const light = colourTokens(dark ? text.replace(dark[0], "") : text);
  const unique = (entries) => [...new Set(entries.map(([, rgb]) => rgb))].filter(Boolean);
  const replaced = dark ? new Set(Object.keys(vars(dark[1]))) : new Set();
  const palette = unique(light);
  // In dark, the light colours the dark block does not replace are still in use.
  const darkPalette = dark ? unique([...light.filter(([name]) => !replaced.has(name)), ...colourTokens(dark[1])]) : [];
  // Token blocks in source order: the base :root, the dark block, then each @media block that redefines some of them.
  const css = (/```css\n([\s\S]*?)```/.exec(text) || [])[1] || "";
  const tokens = [];
  const base = /^:root\s*\{([^}]*)\}/m.exec(css);
  if (base) tokens.push({ vars: vars(base[1]) });
  const darkCss = DARK_BLOCK.exec(css);
  if (darkCss) tokens.push({ scheme: "dark", vars: vars(darkCss[1]) });
  for (const m of css.matchAll(/@media\s*\((min|max)-width:\s*(\d+)px\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/g))
    tokens.push({ [m[1]]: Number(m[2]), vars: vars(m[3]) });
  const block = /```json musekit-checks\n([\s\S]*?)```/.exec(text);
  const rules = block ? JSON.parse(block[1]).rules || [] : [];
  return { breakpoints: [...breakpoints].sort((a, b) => a - b), palette, dark: !!dark, darkPalette, tokens, rules };
}

// Token values in force at a given width and colour scheme, as the page's own media queries would apply them.
export function tokensAt(blocks, width, scheme = "light") {
  const out = {};
  for (const b of blocks || []) {
    if (b.scheme && b.scheme !== scheme) continue;
    if ((b.max === undefined || width <= b.max) && (b.min === undefined || width >= b.min)) Object.assign(out, b.vars);
  }
  return out;
}

// Rule thresholds name tokens; turn them into numbers (colours into rgb) for one width.
export function resolveRules(rules, blocks, width, scheme = "light") {
  const values = tokensAt(blocks, width, scheme);
  return rules.map((rule) => {
    const out = { ...rule, values: {} };
    for (const key of ["max", "min", "tolerance"]) {
      if (!(key in rule)) continue;
      const raw = typeof rule[key] === "number" ? rule[key] : values[rule[key]];
      const n = parseFloat(raw);
      if (Number.isFinite(n)) out.values[key] = n;
      else out.unresolved = `${rule[key]}`;
    }
    if (rule.avoid) {
      const rgb = values[`color-${rule.avoid}`] && hexToRgb(values[`color-${rule.avoid}`]);
      if (rgb) out.values.avoid = rgb;
      else out.unresolved = `color-${rule.avoid}`;
    }
    return out;
  });
}

export function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return undefined;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");
}

export function sweepSizes(viewports, breakpoints) {
  const all = new Set([...SWEEP_BASE, ...breakpoints, ...viewports.map((v) => v.width)]);
  const widths = [...all].filter((w) => w >= 280 && w <= 2560).sort((a, b) => a - b);
  return [...widths.map((width) => ({ width, height: SWEEP_HEIGHT })), ...SHORT_VIEWPORTS.map(([width, height]) => ({ width, height }))];
}

// Pages and page sizes of a PDF written by Chromium, read from its page objects. Sizes are in CSS px.
export function pdfPages(buffer) {
  const text = Buffer.from(buffer).toString("latin1");
  const pages = (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
  const sizes = [...text.matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g)]
    .map((m) => `${Math.round((m[3] - m[1]) / 0.75)}x${Math.round((m[4] - m[2]) / 0.75)}`);
  return { pages, sizes: [...new Set(sizes)] };
}

export function readFacts(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function environmentFailure(message, browser = "chromium") {
  const where = `run in ${process.cwd()}`;
  if (/Playwright is unavailable/.test(message))
    return {
      cause: "playwright-missing",
      message: "Rendering needs Node.js, Playwright and a Chromium browser; Playwright is not installed in this working directory.",
      fix: `[ -f package.json ] || npm init -y >/dev/null && npm install --no-save playwright && npx playwright install chromium   # ${where}`,
    };
  if (/Executable doesn't exist|distribution.*not found/i.test(message))
    return browser === "chromium"
      ? { cause: "browser-missing", message: "Playwright is installed but its Chromium browser has not been downloaded.", fix: `npx playwright install chromium   # ${where}; or pass --browser chrome` }
      : { cause: "browser-missing", message: `--browser ${browser} is not installed.`, fix: `npx playwright install ${browser}   # ${where}; or use --browser chromium` };
  if (/Host system is missing dependencies|error while loading shared libraries/i.test(message))
    return { cause: "browser-dependencies-missing", message: "The system is missing libraries Chromium needs to start.", fix: `npx playwright install --with-deps chromium   # ${where}; needs sudo` };
  return undefined;
}

// ---------------------------------------------------------------------------
// In-page functions. Each runs inside the browser, so it must be self-contained.

function prepare() {
  // Lets hit-testing see every painted element, including pointer-events: none overlays.
  const style = document.createElement("style");
  style.id = "__inspect_pe";
  style.textContent = "*{pointer-events:auto!important}";
  document.head.append(style);
  // A page with scroll-behavior: smooth would still be gliding back to the top when the fold is
  // shot. Scrolling is instant for the whole inspection, task-path flows included.
  if (!document.getElementById("__inspect_scroll")) {
    const scroll = document.createElement("style");
    scroll.id = "__inspect_scroll";
    scroll.textContent = "html,body,*{scroll-behavior:auto!important}";
    document.head.append(scroll);
  }
}

async function settle(fullReveal) {
  await document.fonts.ready;
  const seen = new Set();
  const loads = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    const font = `${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}`;
    if (seen.has(font)) continue;
    seen.add(font);
    loads.push(document.fonts.load(font, el.textContent.trim().slice(0, 40)).catch(() => {}));
  }
  await Promise.all(loads);
  if (fullReveal) {
    const step = Math.max(200, Math.floor(innerHeight * 0.75));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
  }
  for (const a of document.getAnimations()) {
    const t = a.effect?.getComputedTiming?.();
    if (t && t.endTime !== Infinity) a.finish();
    else { a.pause(); a.currentTime = 0; }
  }
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function audit({ facts, palette, canvas, scroll }) {
  // The layout viewport: a phone that zooms out to fit wide content keeps its own width here.
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const ignored = (el) => !!el.closest("[data-inspect-ignore]");
  const desc = (el) => {
    if (!el || el.nodeType !== 1) return String(el);
    let s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    const cls = [...el.classList].filter((c) => !c.startsWith("__")).slice(0, 2);
    if (cls.length) s += "." + cls.join(".");
    return s;
  };
  const snippet = (t) => t.replace(/\s+/g, " ").trim().slice(0, 24);
  const visible = (el) => el.checkVisibility ? el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }) : !!el.offsetParent;
  const opacity = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  const fixed = (el) => { for (let e = el; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === "fixed" || p === "sticky") return true; } return false; };
  const box = (r) => [r.left, r.top + (scroll ? scrollY : 0), r.right, r.bottom + (scroll ? scrollY : 0)].map(Math.round);

  // Clipping: a line that sticks out of an ancestor with overflow other than visible.
  const clipOf = new Map();
  // Follows the containing-block chain, so an absolutely positioned box escapes a static
  // ancestor's overflow. The root and body are left to the canvas and viewport checks.
  const clips = (cs) => cs.overflowX !== "visible" || cs.overflowY !== "visible" || cs.clipPath !== "none" || cs.clip !== "auto";
  const clipAncestor = (el) => {
    if (clipOf.has(el)) return clipOf.get(el);
    let found = null;
    for (let a = el; a && a !== document.body && a !== document.documentElement; ) {
      const cs = getComputedStyle(a);
      if (clips(cs)) { found = a; break; }
      let n = a.parentElement;
      const skip = (x) => { const c = getComputedStyle(x); return cs.position === "fixed" ? c.transform === "none" : c.position === "static" && c.transform === "none"; };
      if (cs.position === "absolute" || cs.position === "fixed") while (n && n !== document.body && skip(n)) n = n.parentElement;
      a = n;
    }
    clipOf.set(el, found);
    return found;
  };
  // The screen-reader-only pattern: a one-pixel box, or a clip that removes everything.
  const srOnly = (a) => {
    const b = a.getBoundingClientRect(), cs = getComputedStyle(a);
    return (b.width <= 2 && b.height <= 2) || /^rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)$/.test(cs.clip) || cs.clipPath === "inset(50%)";
  };
  const hiddenByClip = (el) => {
    for (let a = clipAncestor(el); a; a = a.parentElement && clipAncestor(a.parentElement)) if (srOnly(a)) return true;
    return false;
  };

  // Visible text lines: one entry per line fragment of every text node.
  const lines = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const el = node.parentElement;
    if (!node.textContent.trim() || !el || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) continue;
    if (!visible(el) || ignored(el) || hiddenByClip(el)) continue;
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) lines.push({ node, el, r });
  }

  const clipped = [], outside = [];
  for (const { node, el, r } of lines) {
    const a = clipAncestor(el);
    if (a) {
      const b = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      const inner = { l: b.left + parseFloat(cs.borderLeftWidth), t: b.top + parseFloat(cs.borderTopWidth), r: b.right - parseFloat(cs.borderRightWidth), b: b.bottom - parseFloat(cs.borderBottomWidth) };
      const scrolls = (k) => ["auto", "scroll"].includes(cs[k]);
      const outX = !scrolls("overflowX") && (r.left < inner.l - 1 || r.right > inner.r + 1);
      const outY = !scrolls("overflowY") && (r.top < inner.t - 1 || r.bottom > inner.b + 1);
      if (outX || outY) { clipped.push({ text: snippet(node.textContent), element: desc(el), by: desc(a), box: box(r) }); continue; }
    }
    const right = canvas ? canvas.width : vw;
    const past = r.left < -1 || r.right > right + 1 || (canvas && (r.top < -1 || r.bottom > canvas.height + 1));
    if (past) outside.push({ text: snippet(node.textContent), element: desc(el), box: box(r) });
  }

  // Occlusion: sample three points on each line; the first painted element above the text wins.
  const paintsAt = (el, x, y) => {
    if (opacity(el) < 0.05) return false;
    if (el.tagName === "CANVAS") {
      // A canvas covers only where it has ink.
      try {
        const b = el.getBoundingClientRect();
        const px = el.getContext("2d")?.getImageData(Math.floor(((x - b.left) * el.width) / b.width), Math.floor(((y - b.top) * el.height) / b.height), 1, 1).data;
        return px ? px[3] > 10 : true;
      } catch { return true; }
    }
    if (["IMG", "SVG", "svg", "VIDEO", "IFRAME", "PICTURE", "OBJECT", "EMBED"].includes(el.tagName)) return true;
    if (el instanceof SVGElement) return true;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor.match(/[\d.]+/g);
    if (bg && (bg.length < 4 || Number(bg[3]) > 0.05)) return true;
    if (cs.backgroundImage !== "none") return true;
    const b = el.getBoundingClientRect();
    const bw = { l: parseFloat(cs.borderLeftWidth), t: parseFloat(cs.borderTopWidth), r: parseFloat(cs.borderRightWidth), b: parseFloat(cs.borderBottomWidth) };
    if ((bw.l && x < b.left + bw.l) || (bw.r && x > b.right - bw.r) || (bw.t && y < b.top + bw.t) || (bw.b && y > b.bottom - bw.b)) return true;
    const rg = document.createRange();
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (x >= q.left && x <= q.right && y >= q.top && y <= q.bottom) return true;
    }
    return false;
  };
  const occlusions = [];
  const turned = new Map();
  const rotated = (el) => {
    if (turned.has(el)) return turned.get(el);
    let r = false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const m = getComputedStyle(e).transform.match(/^matrix\(([^)]+)\)/);
      if (m && Math.abs(Number(m[1].split(",")[1])) > 0.01) { r = true; break; }
    }
    turned.set(el, r);
    return r;
  };
  const tested = new Set();
  const testLines = () => {
    for (const line of lines) {
      if (tested.has(line)) continue;
      const r = line.node.parentElement && line.r;
      const live = (() => { range.selectNodeContents(line.node); return [...range.getClientRects()].find((q) => Math.abs(q.left - line.x0) < 1 && Math.abs(q.width - r.width) < 1 && Math.abs(q.top + scrollY - line.y0) < 1); })();
      const q = live || null;
      if (!q || q.top < 0 || q.bottom > vh || q.left < 0 || q.right > vw) continue;
      tested.add(line);
      if (rotated(line.el)) continue; // a tilted label's box corners are not text; the label sits on top anyway
      let hits = 0, by = null;
      // A grid over the glyph band (15–85% of the line box): a sticker that only clips the
      // corner of a display-size title still lands on some points. Small text keeps one row.
      const rows = q.height > 40 ? [0.15, 0.3, 0.5, 0.7, 0.85] : [0.5];
      const cols = q.height > 40 ? Math.ceil(q.width / Math.max(12, q.height / 6)) : Math.min(12, Math.max(3, Math.round(q.width / Math.max(q.height, 16))));
      const pts = [];
      for (const fy of rows) for (let c = 0; c < cols; c++) pts.push([q.left + (q.width * (c + 0.5)) / cols, q.top + q.height * fy]);
      for (const [x, y] of pts) {
        for (const top of document.elementsFromPoint(x, y)) {
          if (top === line.el || line.el.contains(top) || top.contains(line.el)) break;
          if (ignored(top) || fixed(top)) continue;
          if (paintsAt(top, x, y)) { hits++; by = top; break; }
        }
      }
      if (hits) {
        const blend = getComputedStyle(by).mixBlendMode;
        occlusions.push({ text: snippet(line.node.textContent), element: desc(line.el), by: desc(by) + (blend !== "normal" ? ` (${blend})` : ""), points: `${hits}/${pts.length}`, box: box(q) });
      }
    }
  };
  for (const line of lines) { line.x0 = line.r.left; line.y0 = line.r.top + scrollY; }
  if (scroll) {
    const H = document.documentElement.scrollHeight;
    const step = Math.max(200, Math.floor(vh * 0.75));
    for (let y = 0; ; y += step) {
      scrollTo(0, Math.min(y, H - vh));
      testLines();
      if (y >= H - vh) break;
    }
    scrollTo(0, 0);
  } else testLines();

  // Facts: whitespace-insensitive search over visible text, with the lines each match spans.
  const chars = [];
  let flat = "";
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const n = tw.currentNode, el = n.parentElement;
    if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName) || !visible(el) || hiddenByClip(el)) continue;
    const t = n.textContent;
    for (let i = 0; i < t.length; i++) if (!/\s/.test(t[i])) { chars.push([n, i]); flat += t[i]; }
  }
  const spoken = document.body.innerText.replace(/\s+/g, " ");
  const factReport = facts.map((fact) => {
    const key = fact.replace(/\s+/g, "");
    const at = [];
    for (let i = flat.indexOf(key); i >= 0 && key; i = flat.indexOf(key, i + 1)) at.push(i);
    const out = { text: fact, count: at.length, exact: spoken.includes(fact) };
    if (at.length) {
      const [sn, so] = chars[at[0]], [en, eo] = chars[at[0] + key.length - 1];
      const rg = document.createRange();
      rg.setStart(sn, so); rg.setEnd(en, eo + 1);
      // Fragments in another font (a monospace digit in a Chinese line) sit at another top;
      // a new line starts only where a fragment no longer overlaps the current one by half.
      let bottom = -Infinity;
      out.lines = 0;
      for (const q of [...rg.getClientRects()].filter((q) => q.width > 1).sort((a, b) => a.top - b.top)) {
        if (q.top > bottom - q.height / 2) { out.lines++; bottom = q.bottom; } else bottom = Math.max(bottom, q.bottom);
      }
      out.fontSize = Math.round(Math.max(...[sn, en].map((n) => parseFloat(getComputedStyle(n.parentElement).fontSize))));
      if (canvas) out.shownAt = Object.fromEntries([0.25, 0.35].map((k) => [k, +(out.fontSize * k).toFixed(1)]));
    }
    return out;
  });

  // Type sizes and colours actually used by visible text.
  const sizes = new Map(), colors = new Map(), offPalette = new Map();
  const pal = new Set(palette);
  const note = (map, key, el) => { const v = map.get(key) || { count: 0, sample: desc(el) }; v.count++; map.set(key, v); };
  // Computed colours are rgb()/rgba(), or color(srgb r g b / a) with 0–1 channels when they come from color-mix().
  const rgb = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const unit = c.startsWith("color(srgb") ? 255 : 1;
    return { key: m.slice(0, 3).map((n) => Math.round(Number(n) * unit)).join(","), alpha: m.length > 3 ? Number(m[3]) : 1 };
  };
  for (const el of document.body.querySelectorAll("*")) {
    if (!visible(el) || ignored(el) || hiddenByClip(el)) continue;
    const cs = getComputedStyle(el);
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText) {
      note(sizes, cs.fontSize, el);
      note(colors, cs.color, el);
      const c = rgb(cs.color);
      if (pal.size && c && c.alpha > 0 && !pal.has(c.key)) note(offPalette, `color ${cs.color}`, el);
    }
    const b = rgb(cs.backgroundColor);
    if (pal.size && b && b.alpha > 0.05 && !pal.has(b.key)) note(offPalette, `background ${cs.backgroundColor}`, el);
  }
  const list = (map) => [...map].map(([value, v]) => ({ value, ...v })).sort((a, b) => b.count - a.count);

  // Font samples: mark a few elements per font stack so the CDP pass can ask what rendered.
  // Leaf elements first: the CDP query reports fonts for all text below the node.
  const samples = new Map();
  const textEls = [...document.body.querySelectorAll("*")].filter((el) => visible(el) && !hiddenByClip(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  for (const el of [...textEls.filter((e) => !e.children.length), ...textEls.filter((e) => e.children.length)]) {
    const cs = getComputedStyle(el);
    const key = `${cs.fontFamily}|${cs.fontWeight}|${cs.fontStyle}`;
    const s = samples.get(key) || { family: cs.fontFamily, weight: cs.fontWeight, style: cs.fontStyle, ids: [] };
    if (s.ids.length < 3 && !el.hasAttribute("data-inspect-font")) { const id = `f${samples.size}-${s.ids.length}`; el.setAttribute("data-inspect-font", id); s.ids.push(id); }
    samples.set(key, s);
  }

  return {
    viewport: `${vw}x${vh}`,
    pageHeight: document.documentElement.scrollHeight,
    overflowX: Math.max(0, document.documentElement.scrollWidth - vw),
    overflowCanvas: canvas ? { right: Math.max(0, document.documentElement.scrollWidth - canvas.width), bottom: Math.max(0, document.documentElement.scrollHeight - canvas.height) } : undefined,
    occlusions, clipped, outside,
    facts: factReport,
    fontSizes: list(sizes), textColors: list(colors), offPalette: list(offPalette),
    fontSamples: [...samples.values()],
  };
}

// Layout rules declared by the style (style.md "机检"). Elements carry their roles in data-mk.
function measureRules({ rules, judgeFill, canvas }) {
  const vw = canvas ? canvas.width : document.documentElement.clientWidth;
  const vh = canvas ? canvas.height : document.documentElement.clientHeight;
  const sel = (role) => `[data-mk~="${role}"]`;
  const shown = (el) => (el.checkVisibility ? el.checkVisibility() : !!el.offsetParent);
  const all = (role, root = document) => [...root.querySelectorAll(sel(role))].filter(shown);
  const own = (role, group, g) => all(role, g).filter((el) => el.closest(sel(group)) === g);
  const name = (el) => {
    let s = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "");
    const cls = [...el.classList].slice(0, 2);
    if (cls.length) s += "." + cls.join(".");
    const t = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 12);
    return t ? `${s} "${t}"` : s;
  };
  const rect = (el) => el.getBoundingClientRect();
  const area = (el) => { const r = rect(el); return r.width * r.height; };
  const r2 = (n) => Math.round(n * 100) / 100;
  // Text lines of an element: fragments that overlap vertically by half belong to one line.
  const textLines = (el) => {
    const frags = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rg = document.createRange();
    while (w.nextNode()) {
      const n = w.currentNode;
      if (!n.textContent.trim() || !shown(n.parentElement)) continue;
      rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 1 && q.height > 1) frags.push(q);
    }
    frags.sort((a, b) => a.top - b.top);
    const lines = [];
    for (const q of frags) {
      const last = lines.at(-1);
      if (last && q.top <= last.bottom - q.height / 2) { last.left = Math.min(last.left, q.left); last.right = Math.max(last.right, q.right); last.bottom = Math.max(last.bottom, q.bottom); }
      else lines.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
    }
    return lines;
  };
  const results = [];
  for (const rule of rules) {
    const out = { kind: rule.kind, status: "pass", items: [], threshold: rule.values?.min ?? rule.values?.max ?? rule.values?.tolerance ?? rule.count ?? null };
    results.push(out);
    if (rule.unresolved) { out.status = "error"; out.note = `token ${rule.unresolved} not found in style.md`; continue; }
    const need = [rule.group, rule.item, rule.main, rule.text, rule.box, rule.over, rule.than].filter(Boolean);
    const missing = need.filter((role) => !all(role).length);
    if (missing.length) { out.status = "unmarked"; out.note = `no element marked data-mk="${missing.join('", "')}"`; continue; }
    const fail = (item) => { item.ok = false; out.status = "fail"; };
    const v = rule.values;

    if (rule.kind === "seams" || rule.kind === "dominant") {
      for (const g of all(rule.group)) {
        const panels = own(rule.item, rule.group, g);
        if (rule.kind === "seams") {
          const gaps = [];
          for (const a of panels) {
            const ra = rect(a);
            let right = null, down = null;
            for (const b of panels) {
              if (b === a || a.contains(b) || b.contains(a)) continue;
              const rb = rect(b);
              const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
              const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
              if (oy > 20 && rb.left > ra.left + ra.width / 2) { const gap = rb.left - ra.right; if (right === null || gap < right) right = gap; }
              if (ox > 20 && rb.top > ra.top + ra.height / 2) { const gap = rb.top - ra.bottom; if (down === null || gap < down) down = gap; }
            }
            for (const gap of [right, down]) if (gap !== null) gaps.push(Math.round(gap));
          }
          const item = { where: name(g), gaps: gaps.length ? [Math.min(...gaps), Math.max(...gaps)] : [], ok: true };
          out.items.push(item);
          if (gaps.length && Math.max(...gaps) > v.max + 1) fail(item);
        } else {
          const mains = panels.filter((p) => p.matches(sel(rule.main)));
          const others = panels.filter((p) => !mains.includes(p) && !(rule.exclude && p.matches(sel(rule.exclude))));
          const item = { where: name(g), ok: true };
          out.items.push(item);
          if (mains.length !== 1) { item.note = `${mains.length} elements marked ${rule.main}; mark exactly one`; fail(item); continue; }
          if (!others.length) { item.note = "no other panel to compare"; continue; }
          item.ratio = r2(area(mains[0]) / Math.max(...others.map(area)));
          if (item.ratio < v.min - 0.005) fail(item);
        }
      }
    } else if (rule.kind === "fill") {
      for (const t of all(rule.text)) {
        const box = t.closest(sel(rule.box));
        const item = { where: name(t), ok: true };
        out.items.push(item);
        if (!box) { item.note = `not inside data-mk="${rule.box}"`; fail(item); continue; }
        const cs = getComputedStyle(box);
        const inner = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const widest = Math.max(0, ...textLines(t).map((l) => l.right - l.left));
        item.ratio = r2(widest / inner);
        item.size = Math.round(parseFloat(getComputedStyle(t).fontSize));
        if (judgeFill && item.ratio < v.min - 0.005) fail(item);
      }
      if (!judgeFill && out.status === "pass") out.status = "info";
    } else if (rule.kind === "covers") {
      const y0 = scrollY;
      for (const st of all(rule.item)) {
        if (!canvas) { const r = rect(st); scrollTo(0, Math.max(0, r.top + scrollY - (vh - r.height) / 2)); }
        const r = rect(st);
        const under = new Set();
        for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) {
          const x = r.left + (r.width * (i + 0.5)) / 9, y = r.top + (r.height * (j + 0.5)) / 5;
          if (x < 0 || y < 0 || x > vw || y > vh) continue;
          const stack = document.elementsFromPoint(x, y);
          if (!stack.length || !(stack[0] === st || st.contains(stack[0]))) continue; // the sticker is not on top here
          // The first thing under the sticker decides the panel, even when that panel is the sticker's own parent.
          const below = stack.find((el) => el !== st && !st.contains(el));
          const panel = below && (below === document.documentElement ? null : below.closest(sel(rule.over)));
          if (panel) under.add(panel);
        }
        const item = { where: name(st), covers: under.size, over: [...under].map(name), ok: true };
        if (v.avoid) {
          const hit = [...under].filter((p) => (getComputedStyle(p).backgroundColor.match(/\d+/g) || []).slice(0, 3).join(",") === v.avoid);
          if (hit.length) item.onAvoided = hit.map(name);
        }
        out.items.push(item);
        if (under.size !== rule.count || item.onAvoided) fail(item);
      }
      if (!canvas) scrollTo(0, y0);
    } else if (rule.kind === "axis") {
      for (const el of all(rule.item)) {
        const field = rule.field ? el.closest(sel(rule.field)) : null;
        const fr = field ? rect(field) : { left: 0, width: vw };
        const axis = fr.left + fr.width / 2;
        const lines = textLines(el);
        if (!lines.length) { const q = rect(el); lines.push({ left: q.left, right: q.right }); }
        const dev = Math.max(...lines.map((l) => Math.abs((l.left + l.right) / 2 - axis) / fr.width));
        const item = { where: name(el), deviation: Math.round(dev * 1000) / 1000, ok: true };
        out.items.push(item);
        if (dev > v.tolerance + 0.0005) fail(item);
      }
    } else if (rule.kind === "max-size") {
      const limit = Math.max(...all(rule.than).map((el) => parseFloat(getComputedStyle(el).fontSize)));
      for (const el of all(rule.item)) {
        if (el.matches(sel(rule.than))) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        const item = { where: name(el), size: Math.round(size), limit: Math.round(limit), ok: true };
        out.items.push(item);
        if (size > limit + 0.5) fail(item);
      }
    }
  }
  return results;
}

function keyboardStop() {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  const sig = (el) => {
    if (!el) return "";
    const cs = getComputedStyle(el);
    return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.backgroundColor, cs.borderColor, cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth, cs.color, cs.textDecorationLine].join("|");
  };
  const near = [a, a.nextElementSibling, a.closest("label"), a.parentElement];
  const on = near.map(sig).join("#");
  a.blur();
  const off = near.map(sig).join("#");
  a.focus();
  const r = a.getBoundingClientRect();
  let label = a.getAttribute("aria-label") || a.textContent.replace(/\s+/g, " ").trim() || a.getAttribute("name") || a.id || "";
  if (a.type === "radio" || a.type === "checkbox") label = `${a.name}=${a.value}`;
  return { element: `${a.tagName.toLowerCase()}${a.id ? "#" + a.id : ""}`, label: label.slice(0, 24), visibleFocus: on !== off, inView: r.bottom > 0 && r.top < innerHeight };
}

function runningAnimations() {
  return document.getAnimations()
    .filter((a) => a.playState === "running")
    .map((a) => {
      const t = a.effect?.target;
      const name = a.animationName || a.transitionProperty || "animation";
      return `${t ? t.tagName.toLowerCase() + (t.id ? "#" + t.id : "") + (t.classList?.[0] ? "." + t.classList[0] : "") : "?"} ${name}${a.effect?.getComputedTiming?.().endTime === Infinity ? " (infinite)" : ""}`;
    });
}

// ---------------------------------------------------------------------------

async function renderedFonts(page, samples) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const out = [];
  for (const s of samples) {
    const used = new Map();
    for (const id of s.ids) {
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-inspect-font="${id}"]` });
      if (!nodeId) continue;
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      for (const f of fonts) {
        const v = used.get(f.familyName) || { name: f.familyName, custom: f.isCustomFont, glyphs: 0 };
        v.glyphs += f.glyphCount;
        used.set(f.familyName, v);
      }
    }
    const stack = s.family.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "").toLowerCase());
    const rendered = [...used.values()];
    const fallback = rendered.filter((f) => !f.custom && !stack.includes(f.name.toLowerCase())).map((f) => f.name);
    out.push({ stack: s.family, weight: s.weight, style: s.style, rendered, fallback });
  }
  await page.evaluate(() => document.querySelectorAll("[data-inspect-font]").forEach((e) => e.removeAttribute("data-inspect-font")));
  await cdp.detach();
  return out;
}

async function openPage(browser, url, viewport, opts, extra = {}) {
  const mobile = !opts.canvas && viewport.width < 600;
  const context = await browser.newContext({ viewport, deviceScaleFactor: opts.scale, isMobile: mobile, hasTouch: mobile, colorScheme: "light", ...extra });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  // CSS.enable (used to read rendered fonts) refetches the document itself; a file:// page
  // refuses that, which is noise rather than a problem with the artwork.
  const self = (text) => text.includes(url) && /Unsafe attempt to load URL|origin/.test(text);
  page.on("console", (m) => { if (m.type() === "error" && !self(m.text())) errors.push(m.text()); });
  page.on("requestfailed", (r) => { if (r.url() !== url) errors.push(`request failed: ${r.url()} ${r.failure()?.errorText || ""}`); });
  // A deck is checked in its print layout; scripts that measure at load see that layout too.
  if (opts.slides) await page.emulateMedia({ media: "print" });
  await page.goto(url, { waitUntil: "load" });
  if (opts.ready) await page.waitForFunction(opts.ready, null, { timeout: 15000 });
  await page.evaluate(prepare);
  await page.evaluate(settle, !opts.canvas);
  return { page, context, errors };
}

const gray = (page) => page.addStyleTag({ content: "html{filter:grayscale(1)!important}" });
const ungray = (page) => page.evaluate(() => document.querySelectorAll("style").forEach((s) => { if (s.textContent.startsWith("html{filter:grayscale(1)")) s.remove(); }));

// One-line readings of a rule result, for the summary and the sweep.
function itemDetail(r, item) {
  if (item.note) return item.note;
  if (r.kind === "seams") return `gaps ${item.gaps.join("–")}px (max ${r.threshold}px)`;
  if (r.kind === "dominant") return `area ratio ${item.ratio} (min ${r.threshold})`;
  if (r.kind === "fill") return `fill ${item.ratio} at ${item.size}px (min ${r.threshold})`;
  if (r.kind === "covers") return `covers ${item.covers} panels (want ${r.threshold})${item.onAvoided ? `, sits on ${item.onAvoided.join(", ")}` : ""}`;
  if (r.kind === "axis") return `off axis by ${item.deviation} (max ${r.threshold})`;
  if (r.kind === "max-size") return `${item.size}px (limit ${item.limit}px)`;
  return "";
}
function ruleDetail(r, failingOnly = false) {
  if (r.status === "unmarked" || r.status === "error") return r.note;
  const items = failingOnly ? r.items.filter((x) => !x.ok) : r.items;
  const val = (x) => x.note || (r.kind === "seams" ? `${x.gaps.join("–")}px` : r.kind === "covers" ? `${x.covers}${x.onAvoided ? "!" : ""}` : r.kind === "axis" ? x.deviation : r.kind === "max-size" ? `${x.size}px` : x.ratio);
  const limit = { seams: `≤${r.threshold}px`, dominant: `≥${r.threshold}`, fill: `≥${r.threshold}`, covers: `=${r.threshold}`, axis: `≤${r.threshold}`, "max-size": "≤ limit" }[r.kind];
  const mark = { pass: "ok", fail: "FAIL", info: "values only" }[r.status];
  return `${items.map(val).join(", ")} (${limit}) ${mark}`;
}

function summarize(report) {
  const p = [];
  const at = (v) => (report.mode === "canvas" ? "" : report.mode === "slides" ? ` @slide ${v.slide}` : ` @${v.viewport}`);
  const slides = report.mode === "slides";
  for (const v of report.views) {
    if (v.frame && (v.frame.x || v.frame.y || v.frame.width !== report.canvas.width || v.frame.height !== report.canvas.height))
      p.push(`slide ${v.slide} sits at ${v.frame.x},${v.frame.y} as ${v.frame.width}x${v.frame.height} in the print layout, not at 0,0 as ${report.canvas.width}x${report.canvas.height}`);
    for (const f of v.small || []) p.push(`text below size-meta (${report.minSize}px)${at(v)}: ${f.value} ×${f.count} (e.g. ${f.sample})`);
    if (v.overflowX) p.push(`horizontal overflow ${v.overflowX}px${at(v)}`);
    if (v.overflowCanvas && (v.overflowCanvas.right || v.overflowCanvas.bottom)) p.push(`content runs past the canvas (right ${v.overflowCanvas.right}px, bottom ${v.overflowCanvas.bottom}px)`);
    for (const o of v.occlusions) p.push(`text covered${at(v)}: "${o.text}" (${o.element}) under ${o.by}, ${o.points} points`);
    for (const c of v.clipped) p.push(`text clipped${at(v)}: "${c.text}" (${c.element}) by ${c.by}`);
    for (const c of v.outside) p.push(`text outside the ${report.mode === "web" ? "viewport" : "canvas"}${at(v)}: "${c.text}" (${c.element})`);
    for (const r of v.rules || []) {
      // A deck carries a device on some slides only; a role is missing when no slide has it.
      if (r.status === "error" || (r.status === "unmarked" && !slides)) p.push(`layout rule ${r.kind} not measured${at(v)}: ${r.note}`);
      if (r.status === "fail") for (const item of r.items.filter((x) => !x.ok)) p.push(`layout rule ${r.kind} fails${at(v)}: ${item.where} ${itemDetail(r, item)}`);
    }
    for (const f of v.facts) {
      if (!f.count) p.push(`fact missing${at(v)}: "${f.text}"`);
      else if (f.lines > 1) p.push(`fact breaks across ${f.lines} lines${at(v)}: "${f.text}" (fine only at a semantic boundary)`);
    }
  }
  // Sweep: consecutive widths with the same kinds of finding collapse into one range.
  let run = null;
  const flush = () => {
    if (!run) return;
    const bits = [run.overflow ? `overflow up to ${run.overflow}px` : "", run.key].filter(Boolean).join(", ");
    const span = run.from === run.to ? `${run.from}` : `${run.from}–${run.to}`;
    p.push(`sweep ${span}px${run.height === SWEEP_HEIGHT ? "" : ` × ${run.height}px high`}: ${bits}${run.example ? ` (e.g. ${run.example})` : ""}`);
    run = null;
  };
  for (const s of report.sweep || []) {
    const kinds = [...new Set((s.ruleFails || []).map((f) => f.split(" ")[0]))];
    const counts = [s.occlusions && `${s.occlusions} covered`, s.clipped && `${s.clipped} clipped`, s.outside && `${s.outside} outside`, ...kinds.map((k) => `rule ${k} fails`)].filter(Boolean).join(", ");
    const key = `${s.height}|${s.overflowX ? "overflow" : ""}|${counts}`;
    if (run && run.id === key) { run.to = s.width; run.overflow = Math.max(run.overflow, s.overflowX); continue; }
    flush();
    if (s.overflowX || counts) run = { id: key, key: counts, height: s.height, from: s.width, to: s.width, overflow: s.overflowX, example: (s.ruleFails || [])[0] || s.examples[0] };
  }
  flush();
  if (slides) {
    report.views[0]?.rules?.forEach((r, i) => {
      const notes = report.views.map((v) => v.rules[i]);
      if (notes.every((x) => x.status === "unmarked")) p.push(`layout rule ${r.kind} not measured on any slide: ${notes.reduce((a, b) => (b.note.length < a.note.length ? b : a)).note}`);
    });
    for (const f of report.facts) {
      if (!f.count) p.push(`fact missing from every slide: "${f.text}"`);
      for (const a of (f.at || []).filter((x) => x.lines > 1)) p.push(`fact breaks across ${a.lines} lines @slide ${a.slide}: "${f.text}" (fine only at a semantic boundary)`);
    }
    if (report.pdf.pages !== report.views.length) p.push(`PDF has ${report.pdf.pages} pages for ${report.views.length} slides: give each slide break-after: page and @page the canvas size`);
    // PDF sizes are whole points, so a canvas side can read 1px off.
    const want = `${report.canvas.width}x${report.canvas.height}`;
    const near = (size) => size.split("x").every((v, i) => Math.abs(v - [report.canvas.width, report.canvas.height][i]) <= 1);
    for (const s of report.pdf.sizes) if (!near(s)) p.push(`PDF page size ${s} is not the canvas ${want}: set @page { size: ${report.canvas.width}px ${report.canvas.height}px; margin: 0 }`);
  }
  for (const f of report.fonts) if (f.fallback.length) p.push(`font fallback: ${f.stack} ${f.weight} rendered with ${f.fallback.join(", ")}`);
  for (const o of report.offPalette) p.push(`colour not in style.md: ${o.value} (${o.count}×, e.g. ${o.sample})`);
  for (const d of report.dark || []) {
    if (d.same) p.push(`dark scheme looks the same as light @${d.viewport}: style.md follows the system, so the page should switch with prefers-color-scheme`);
    for (const o of d.offPalette || []) p.push(`colour not in style.md (dark) @${d.viewport}: ${o.value} (${o.count}×, e.g. ${o.sample})`);
    for (const r of d.rules || []) {
      if (r.status === "error") p.push(`layout rule ${r.kind} not measured @${d.viewport} dark: ${r.note}`);
      if (r.status === "fail") for (const item of r.items.filter((x) => !x.ok)) p.push(`layout rule ${r.kind} fails @${d.viewport} dark: ${item.where} ${itemDetail(r, item)}`);
    }
  }
  for (const k of report.keyboard?.stops || []) if (!k.visibleFocus) p.push(`no visible focus change: ${k.element} "${k.label}"`);
  if (report.reducedMotion?.running.length) p.push(`still animating under reduced motion: ${report.reducedMotion.running.join("; ")}`);
  for (const [k, v] of Object.entries(report.flow || {})) if (v.error) p.push(`flow failed @${k}: ${v.error}`);
  for (const e of report.errors) p.push(`page error: ${e}`);
  return [...new Set(p)];
}

const strip = (v) => {
  const { fontSamples, ...rest } = v;
  return rest;
};

// A deck is checked one slide at a time in its print layout, where the slides stack in normal flow
// at the canvas size. With the other slides hidden, the current one sits at the top-left of a
// canvas-sized viewport, so the poster checks apply unchanged. Facts are counted over the deck.
async function inspectSlides({ browser, url, opts, out, at, name, facts, style, report, file }) {
  const { page, context, errors } = await openPage(browser, url, opts.canvas, opts);
  const count = await page.evaluate((selector) => {
    const all = [...document.querySelectorAll(selector)];
    all.forEach((el, i) => el.setAttribute("data-inspect-slide", String(i + 1)));
    const css = document.createElement("style");
    css.textContent = "[data-inspect-off]{display:none!important}";
    document.head.append(css);
    return all.length;
  }, opts.slides);
  if (!count) throw new Error(`--slides ${opts.slides} matches no element`);
  const { width, height } = opts.canvas;
  const clip = { x: 0, y: 0, width, height };
  const dir = at(`${name}-slides`);
  await mkdir(dir, { recursive: true });
  const rules = style.rules.length ? resolveRules(style.rules, style.tokens, width) : [];
  const meta = parseFloat(tokensAt(style.tokens, width)["size-meta"]);
  if (Number.isFinite(meta)) report.minSize = meta;
  const fonts = new Map(), offPalette = new Map(), pngs = [];
  report.facts = facts.map((text) => ({ text, count: 0, slides: [] }));
  for (let n = 1; n <= count; n++) {
    await page.evaluate((k) => {
      for (const el of document.querySelectorAll("[data-inspect-slide]")) el.toggleAttribute("data-inspect-off", el.dataset.inspectSlide !== String(k));
      scrollTo(0, 0);
    }, n);
    await page.evaluate(settle, false);
    const view = await page.evaluate(audit, { facts, palette: style.palette, canvas: opts.canvas, scroll: false });
    view.slide = n;
    view.frame = await page.evaluate((k) => {
      const r = document.querySelector(`[data-inspect-slide="${k}"]`).getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
    }, n);
    if (rules.length) view.rules = await page.evaluate(measureRules, { rules, judgeFill: true, canvas: opts.canvas });
    if (report.minSize) view.small = view.fontSizes.filter((f) => parseFloat(f.value) < report.minSize - 0.5);
    for (const f of await renderedFonts(page, view.fontSamples)) {
      const key = `${f.stack}|${f.weight}|${f.style}`;
      const seen = fonts.get(key) || { ...f, rendered: [], fallback: [] };
      for (const r of f.rendered) if (!seen.rendered.some((x) => x.name === r.name)) seen.rendered.push(r);
      seen.fallback = [...new Set([...seen.fallback, ...f.fallback])];
      fonts.set(key, seen);
    }
    // Detaching the font query's CDP session drops the emulated media; put print back.
    await page.emulateMedia({ media: "print" });
    for (const o of view.offPalette) {
      const seen = offPalette.get(o.value) || { ...o, count: 0 };
      seen.count += o.count;
      offPalette.set(o.value, seen);
    }
    view.facts.forEach((f, i) => {
      if (!f.count) return;
      const total = report.facts[i];
      total.count += f.count;
      total.slides.push(n);
      total.exact = total.exact || f.exact;
      // Each slide keeps its own reading: a fact can be a broken title on one slide and a footer on the next.
      (total.at ||= []).push({ slide: n, lines: f.lines, fontSize: f.fontSize });
    });
    view.facts = [];
    const png = file(`slide-${n}`, join(dir, `${String(n).padStart(2, "0")}.png`));
    await page.screenshot({ path: png, clip });
    pngs.push(png);
    report.views.push(strip(view));
  }
  report.fonts = [...fonts.values()];
  report.offPalette = [...offPalette.values()].sort((a, b) => b.count - a.count);

  // The PDF is printed from the same layout, so what was checked is what ships.
  await page.evaluate(() => document.querySelectorAll("[data-inspect-off]").forEach((el) => el.removeAttribute("data-inspect-off")));
  const pdf = await page.pdf({ path: file("pdf", at(`${name}.pdf`)), width: `${width}px`, height: `${height}px`, printBackground: true, preferCSSPageSize: true });
  report.pdf = pdfPages(pdf);

  // Overview sheet: every slide at a quarter size, for the rhythm of the deck and the grey check.
  const k = 0.25, gap = 16, w = Math.round(width * k), h = Math.round(height * k);
  const cols = count <= 4 ? count : count <= 9 ? 3 : 4;
  const tiles = (await Promise.all(pngs.map((path) => readFile(path))))
    .map((b, i) => `<figure><img src="data:image/png;base64,${b.toString("base64")}"><figcaption>${i + 1}</figcaption></figure>`).join("");
  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: cols * w + (cols + 1) * gap, height: h + 2 * gap });
  await sheet.setContent(`<style>body{margin:0;padding:${gap}px;background:#808080;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:${gap}px;font:14px/20px sans-serif;color:#fff}figure{margin:0}img{display:block;width:${w}px;height:${h}px}</style>${tiles}`);
  await sheet.screenshot({ path: file("sheet", join(out, `${name}-sheet.png`)), fullPage: true });
  await sheet.addStyleTag({ content: "img{filter:grayscale(1)}" });
  await sheet.screenshot({ path: file("sheet-gray", join(out, `${name}-sheet-gray.png`)), fullPage: true });
  report.errors.push(...errors);
  await context.close();
}

export async function inspectPage(opts) {
  const remote = /^https?:\/\//.test(opts.input);
  const source = remote ? opts.input : resolve(opts.input);
  const url = remote ? source : pathToFileURL(source).href;
  const base = remote ? process.cwd() : dirname(source);
  const name = remote ? "page" : basename(source, extname(source));
  const out = resolve(opts.out || join(base, "review"));
  await mkdir(out, { recursive: true });

  let style = { breakpoints: [], palette: [], dark: false, darkPalette: [], tokens: [], rules: [] }, stylePath = opts.style ? resolve(opts.style) : join(base, "style.md");
  try { style = readStyle(await readFile(stylePath, "utf8")); } catch { if (opts.style) throw new Error(`Cannot read --style ${opts.style}`); stylePath = null; }
  const facts = opts.facts ? readFacts(await readFile(resolve(opts.facts), "utf8")) : [];

  const require = createRequire(join(process.cwd(), "package.json"));
  let chromium;
  try { ({ chromium } = require("playwright")); } catch { throw new Error("Playwright is unavailable in this working directory."); }
  const browser = await chromium.launch(opts.browser === "chromium" ? {} : { channel: opts.browser });

  const report = {
    schemaVersion: 1,
    input: source,
    mode: opts.slides ? "slides" : opts.canvas ? "canvas" : "web",
    canvas: opts.canvas,
    style: stylePath,
    visualReview: "not-performed",
    files: {},
    views: [],
    fonts: [],
    offPalette: [],
    errors: [],
  };
  const file = (key, path) => { report.files[key] = path; return path; };
  const auditArgs = (canvas, scroll) => ({ facts, palette: style.palette, canvas, scroll });

  try {
    if (opts.slides) {
      await inspectSlides({ browser, url, opts, out, at: (f) => (remote ? join(out, f) : join(base, f)), name, facts, style, report, file });
    } else if (opts.canvas) {
      const { page, context, errors } = await openPage(browser, url, opts.canvas, opts);
      const view = await page.evaluate(audit, auditArgs(opts.canvas, false));
      if (style.rules.length) view.rules = await page.evaluate(measureRules, { rules: resolveRules(style.rules, style.tokens, opts.canvas.width), judgeFill: true, canvas: opts.canvas });
      report.fonts = await renderedFonts(page, view.fontSamples);
      report.offPalette = view.offPalette;
      report.views.push(strip(view));
      const clip = { x: 0, y: 0, ...opts.canvas };
      const png = file("png", remote ? join(out, `${name}.png`) : join(base, `${name}.png`));
      await page.screenshot({ path: png, clip });
      await gray(page);
      await page.screenshot({ path: file("gray", join(out, `${name}-gray.png`)), clip });
      const data = (await readFile(png)).toString("base64");
      for (const k of THUMBS) {
        const w = Math.round(opts.canvas.width * k), h = Math.round(opts.canvas.height * k);
        const thumb = await context.newPage();
        await thumb.setViewportSize({ width: w, height: h });
        await thumb.setContent(`<body style="margin:0"><img src="data:image/png;base64,${data}" style="display:block;width:${w}px;height:${h}px"></body>`);
        await thumb.screenshot({ path: file(`at-${k}`, join(out, `${name}-at-${k}.png`)) });
        await thumb.close();
      }
      report.errors.push(...errors);
      await context.close();
    } else {
      let sweepPage = null;
      for (const [i, vp] of opts.viewports.entries()) {
        const { page, context, errors } = await openPage(browser, url, vp, opts);
        const tag = `${vp.width}x${vp.height}`;
        await page.screenshot({ path: file(`${tag}-fold`, join(out, `web-${tag}-fold.png`)) });
        await page.screenshot({ path: file(`${tag}-full`, join(out, `web-${tag}-full.png`)), fullPage: true });
        await gray(page);
        await page.screenshot({ path: file(`${tag}-full-gray`, join(out, `web-${tag}-full-gray.png`)), fullPage: true });
        await ungray(page);
        const view = await page.evaluate(audit, auditArgs(null, true));
        if (style.rules.length) view.rules = await page.evaluate(measureRules, { rules: resolveRules(style.rules, style.tokens, vp.width), judgeFill: i === 0, canvas: null });
        if (i === 0) {
          report.fonts = await renderedFonts(page, view.fontSamples);
          report.offPalette = view.offPalette;
        }
        report.views.push(strip(view));
        report.errors.push(...errors);
        if (style.dark) {
          // The same viewport in dark: screenshots, the dark palette and the rules that name a colour.
          report.dark ||= [];
          const dark = await openPage(browser, url, vp, opts, { colorScheme: "dark" });
          const fold = file(`${tag}-dark-fold`, join(out, `web-${tag}-dark-fold.png`));
          await dark.page.screenshot({ path: fold });
          await dark.page.screenshot({ path: file(`${tag}-dark-full`, join(out, `web-${tag}-dark-full.png`)), fullPage: true });
          const entry = { viewport: tag, same: (await readFile(fold)).equals(await readFile(report.files[`${tag}-fold`])) };
          if (i === 0) entry.offPalette = (await dark.page.evaluate(audit, { ...auditArgs(null, true), facts: [], palette: style.darkPalette })).offPalette;
          const coloured = style.rules.filter((r) => r.avoid);
          if (coloured.length) entry.rules = await dark.page.evaluate(measureRules, { rules: resolveRules(coloured, style.tokens, vp.width, "dark"), judgeFill: false, canvas: null });
          report.dark.push(entry);
          report.errors.push(...dark.errors);
          await dark.context.close();
        }
        if (i === 0) {
          // Keyboard: walk the tab order from the top of the page.
          await page.evaluate(() => { scrollTo(0, 0); document.activeElement?.blur(); });
          const stops = [];
          for (let n = 0; n < 60; n++) {
            await page.keyboard.press("Tab");
            const s = await page.evaluate(keyboardStop);
            if (!s || (stops.length && s.element === stops[0].element && s.label === stops[0].label)) break;
            stops.push(s);
          }
          report.keyboard = { stops };
          sweepPage = { page, context };
        } else await context.close();
      }

      // Width sweep: one page, resized in place.
      report.sweep = [];
      const { page } = sweepPage;
      for (const { width, height } of sweepSizes(opts.viewports, style.breakpoints)) {
        await page.setViewportSize({ width, height });
        await page.evaluate(settle, false);
        const v = await page.evaluate(audit, { ...auditArgs(null, true), facts: [] });
        const rules = style.rules.length ? await page.evaluate(measureRules, { rules: resolveRules(style.rules, style.tokens, width), judgeFill: false, canvas: null }) : [];
        const ruleFails = rules.filter((r) => r.status === "fail").map((r) => `${r.kind} ${ruleDetail(r, true)}`);
        report.sweep.push({ width, height, ruleFails, overflowX: v.overflowX, occlusions: v.occlusions.length, clipped: v.clipped.length, outside: v.outside.length, examples: [...v.occlusions, ...v.clipped, ...v.outside].slice(0, 3).map((x) => `${x.text} (${x.element}${x.by ? " / " + x.by : ""})`) });
      }
      await sweepPage.context.close();

      // Reduced motion.
      {
        const vp = opts.viewports[0];
        const context = await browser.newContext({ viewport: vp, reducedMotion: "reduce" });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "load" });
        if (opts.ready) await page.waitForFunction(opts.ready, null, { timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        report.reducedMotion = { running: await page.evaluate(runningAnimations) };
        await context.close();
      }

      // Optional task path, at the first and last viewport.
      if (opts.flow) {
        const flow = (await import(pathToFileURL(resolve(opts.flow)).href)).default;
        report.flow = {};
        const ends = [...new Set([opts.viewports[0], opts.viewports.at(-1)])];
        for (const vp of ends) {
          const tag = `${vp.width}x${vp.height}`;
          const { page, context, errors } = await openPage(browser, url, vp, opts);
          await page.evaluate(() => document.getElementById("__inspect_pe")?.remove());
          const entry = { log: [], shots: [], checks: [] };
          report.flow[tag] = entry;
          const shot = async (label, { fullPage = false, selector } = {}) => {
            const path = join(out, `flow-${tag}-${label}.png`);
            if (selector) await page.locator(selector).first().screenshot({ path });
            else await page.screenshot({ path, fullPage });
            entry.shots.push(path);
            return path;
          };
          const check = async (label) => {
            await page.evaluate(prepare);
            const v = strip(await page.evaluate(audit, { ...auditArgs(null, false), facts: [] }));
            await page.evaluate(() => document.getElementById("__inspect_pe")?.remove());
            entry.checks.push({ label, overflowX: v.overflowX, occlusions: v.occlusions, clipped: v.clipped, outside: v.outside });
            return v;
          };
          try {
            await flow({ page, viewport: { ...vp, tag }, shot, check, log: (...m) => entry.log.push(m.join(" ")) });
          } catch (e) {
            entry.error = String(e.message || e).split("\n")[0];
          }
          entry.errors = errors;
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  report.problems = summarize(report);
  for (const [k, v] of Object.entries(report.flow || {})) for (const c of v.checks) {
    for (const o of c.occlusions) report.problems.push(`text covered in flow @${k} "${c.label}": "${o.text}" under ${o.by}`);
    for (const o of c.clipped) report.problems.push(`text clipped in flow @${k} "${c.label}": "${o.text}" by ${o.by}`);
    if (c.overflowX) report.problems.push(`horizontal overflow in flow @${k} "${c.label}": ${c.overflowX}px`);
  }
  report.problems = [...new Set(report.problems)];
  await writeFile(file("report", join(out, "report.json")), JSON.stringify(report, null, 2) + "\n");
  return report;
}

function printSummary(report) {
  const lines = [`report: ${report.files.report}`];
  for (const [k, v] of Object.entries(report.files)) if (k !== "report" && !k.startsWith("slide-")) lines.push(`${k}: ${v}`);
  if (report.mode === "slides") lines.push(`slides: ${report.views.length} PNG in ${dirname(report.files["slide-1"])}; PDF ${report.pdf.pages} pages`);
  // A variable webfont reports the name of its default instance (e.g. "… ExtraLight"); the weight is still applied.
  lines.push(`fonts (requested → rendered): ${report.fonts.map((f) => `${f.stack.split(",")[0]} ${f.weight} → ${f.rendered.map((r) => `${r.name}${r.custom ? " [webfont]" : " [system]"}`).join(" + ") || "none"}`).join("; ")}`);
  if (report.fonts.some((f) => f.rendered.some((r) => r.custom && /(Thin|Light|Medium|SemiBold|Bold|Black)$/.test(r.name))))
    lines.push("note: a variable webfont is listed by its default instance name (e.g. \"… ExtraLight\"); the requested weight is still applied");
  const facts = report.facts || report.views[0]?.facts || [];
  // On a deck each slide where a fact appears is listed with its size there.
  const where = (f) => (f.at ? ` on ${f.at.map((a) => `${a.slide} (${a.fontSize}px)`).join(", ")}` : f.fontSize ? ` ${f.fontSize}px` : "");
  if (facts.length) lines.push(`facts: ${facts.map((f) => `"${f.text}" ×${f.count}${where(f)}${f.shownAt ? ` (${f.shownAt["0.35"]}px at 0.35)` : ""}`).join("; ")}`);
  for (const v of report.views) {
    // On a deck, a rule whose roles are not on this slide is left out of the slide's line.
    const rules = (v.rules || []).filter((r) => report.mode !== "slides" || r.status !== "unmarked");
    const label = report.mode === "canvas" ? "" : report.mode === "slides" ? ` @slide ${v.slide}` : ` @${v.viewport}`;
    if (rules.length) lines.push(`layout rules${label}: ${rules.map((r) => `${r.kind} ${ruleDetail(r)}`).join("; ")}`);
  }
  const shown = report.problems.slice(0, 40);
  lines.push(report.problems.length ? `findings (${report.problems.length}, leads for review, not verdicts):` : "findings: none");
  for (const p of shown) lines.push(`- ${p}`);
  if (report.problems.length > shown.length) lines.push(`- … ${report.problems.length - shown.length} more in report.json`);
  lines.push("visual review: not performed by this script");
  console.log(lines.join("\n"));
}

async function main(argv) {
  if (argv.includes("--help") || !argv.length) { console.log(usage); return; }
  const opts = parseArgs(argv);
  try {
    printSummary(await inspectPage(opts));
  } catch (error) {
    const env = environmentFailure(error.message, opts.browser);
    if (env) { console.error(`${env.message}\nFix: ${env.fix}`); process.exitCode = 2; return; }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
