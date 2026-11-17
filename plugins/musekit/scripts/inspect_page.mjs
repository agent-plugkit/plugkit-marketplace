#!/usr/bin/env node
// Shared render-and-check script for page-shaped artwork (posters, covers, web pages).
// It exports and screenshots the real page, then reports what a machine can measure.
// It never judges the design: every finding is a lead for the visual review.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export const usage = `Usage: node inspect_page.mjs <page.html|URL> [options]

Poster, cover or slide (fixed canvas):
  --canvas WxH          viewport equals the canvas; exports <name>.png next to the HTML
  --scale 1|2           pixel ratio of the exported PNG (default 1)
Web page:
  --viewports LIST      e.g. 1440x900,768x1024,375x812 (the default)
  --flow FILE.mjs       optional task path; default export async ({ page, viewport, shot, check, log })
Both:
  --out DIR             screenshots and report.json (default: review/ next to the HTML)
  --facts FILE          one exact fact per line; counted in the rendered text
  --style FILE          style.md for breakpoints and palette (default: style.md next to the HTML)
  --ready JS            extra condition to wait for, e.g. "document.body.dataset.ready === '1'"
  --browser NAME        chromium (default), chrome or msedge

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
  const known = ["--canvas", "--scale", "--viewports", "--flow", "--out", "--facts", "--style", "--ready", "--browser"];
  while (args.length) {
    const key = args.shift();
    if (!known.includes(key) || !args.length) throw new Error(`Unknown or incomplete option ${key}\n\n${usage}`);
    opts[key.slice(2)] = args.shift();
  }
  if (opts.canvas && opts.viewports) throw new Error(`Use --canvas or --viewports, not both\n\n${usage}`);
  if (opts.canvas && opts.flow) throw new Error(`--flow is for web pages\n\n${usage}`);
  if (!["chromium", "chrome", "msedge"].includes(opts.browser)) throw new Error(usage);
  opts.scale = Number(opts.scale);
  if (![1, 2].includes(opts.scale)) throw new Error(`--scale must be 1 or 2\n\n${usage}`);
  if (opts.canvas) opts.canvas = size(opts.canvas, "--canvas");
  else opts.viewports = (opts.viewports || DEFAULT_VIEWPORTS).split(",").map((v) => size(v.trim(), "--viewports"));
  return opts;
}

// style.md: breakpoint edges become sweep widths; colour tokens become the palette.
export function readStyle(text) {
  const breakpoints = new Set();
  for (const m of text.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) {
    const n = Number(m[2]);
    if (m[1] === "min") breakpoints.add(n - 1).add(n);
    else breakpoints.add(n).add(n + 1);
  }
  const palette = new Set();
  for (const m of text.matchAll(/--(?:color|data)-[\w-]+:\s*(#[0-9a-fA-F]{3,8})\b/g)) palette.add(hexToRgb(m[1]));
  return { breakpoints: [...breakpoints].sort((a, b) => a - b), palette: [...palette].filter(Boolean) };
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
  const rgb = (c) => { const m = c.match(/[\d.]+/g); return m ? { key: m.slice(0, 3).join(","), alpha: m.length > 3 ? Number(m[3]) : 1 } : null; };
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

function keyboardStop() {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  const sig = (el) => {
    if (!el) return "";
    const cs = getComputedStyle(el);
    return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.backgroundColor, cs.borderColor, cs.color, cs.textDecorationLine].join("|");
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
  const context = await browser.newContext({ viewport, deviceScaleFactor: opts.scale, isMobile: mobile, hasTouch: mobile, ...extra });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  // CSS.enable (used to read rendered fonts) refetches the document itself; a file:// page
  // refuses that, which is noise rather than a problem with the artwork.
  const self = (text) => text.includes(url) && /Unsafe attempt to load URL|origin/.test(text);
  page.on("console", (m) => { if (m.type() === "error" && !self(m.text())) errors.push(m.text()); });
  page.on("requestfailed", (r) => { if (r.url() !== url) errors.push(`request failed: ${r.url()} ${r.failure()?.errorText || ""}`); });
  await page.goto(url, { waitUntil: "load" });
  if (opts.ready) await page.waitForFunction(opts.ready, null, { timeout: 15000 });
  await page.evaluate(prepare);
  await page.evaluate(settle, !opts.canvas);
  return { page, context, errors };
}

const gray = (page) => page.addStyleTag({ content: "html{filter:grayscale(1)!important}" });
const ungray = (page) => page.evaluate(() => document.querySelectorAll("style").forEach((s) => { if (s.textContent.startsWith("html{filter:grayscale(1)")) s.remove(); }));

function summarize(report) {
  const p = [];
  const at = (v) => (report.mode === "canvas" ? "" : ` @${v.viewport}`);
  for (const v of report.views) {
    if (v.overflowX) p.push(`horizontal overflow ${v.overflowX}px${at(v)}`);
    if (v.overflowCanvas && (v.overflowCanvas.right || v.overflowCanvas.bottom)) p.push(`content runs past the canvas (right ${v.overflowCanvas.right}px, bottom ${v.overflowCanvas.bottom}px)`);
    for (const o of v.occlusions) p.push(`text covered${at(v)}: "${o.text}" (${o.element}) under ${o.by}, ${o.points} points`);
    for (const c of v.clipped) p.push(`text clipped${at(v)}: "${c.text}" (${c.element}) by ${c.by}`);
    for (const c of v.outside) p.push(`text outside the ${report.mode === "canvas" ? "canvas" : "viewport"}${at(v)}: "${c.text}" (${c.element})`);
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
    const counts = [s.occlusions && `${s.occlusions} covered`, s.clipped && `${s.clipped} clipped`, s.outside && `${s.outside} outside`].filter(Boolean).join(", ");
    const key = `${s.height}|${s.overflowX ? "overflow" : ""}|${counts}`;
    if (run && run.id === key) { run.to = s.width; run.overflow = Math.max(run.overflow, s.overflowX); continue; }
    flush();
    if (s.overflowX || counts) run = { id: key, key: counts, height: s.height, from: s.width, to: s.width, overflow: s.overflowX, example: s.examples[0] };
  }
  flush();
  for (const f of report.fonts) if (f.fallback.length) p.push(`font fallback: ${f.stack} ${f.weight} rendered with ${f.fallback.join(", ")}`);
  for (const o of report.offPalette) p.push(`colour not in style.md: ${o.value} (${o.count}×, e.g. ${o.sample})`);
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

export async function inspectPage(opts) {
  const remote = /^https?:\/\//.test(opts.input);
  const source = remote ? opts.input : resolve(opts.input);
  const url = remote ? source : pathToFileURL(source).href;
  const base = remote ? process.cwd() : dirname(source);
  const name = remote ? "page" : basename(source, extname(source));
  const out = resolve(opts.out || join(base, "review"));
  await mkdir(out, { recursive: true });

  let style = { breakpoints: [], palette: [] }, stylePath = opts.style ? resolve(opts.style) : join(base, "style.md");
  try { style = readStyle(await readFile(stylePath, "utf8")); } catch { if (opts.style) throw new Error(`Cannot read --style ${opts.style}`); stylePath = null; }
  const facts = opts.facts ? readFacts(await readFile(resolve(opts.facts), "utf8")) : [];

  const require = createRequire(join(process.cwd(), "package.json"));
  let chromium;
  try { ({ chromium } = require("playwright")); } catch { throw new Error("Playwright is unavailable in this working directory."); }
  const browser = await chromium.launch(opts.browser === "chromium" ? {} : { channel: opts.browser });

  const report = {
    schemaVersion: 1,
    input: source,
    mode: opts.canvas ? "canvas" : "web",
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
    if (opts.canvas) {
      const { page, context, errors } = await openPage(browser, url, opts.canvas, opts);
      const view = await page.evaluate(audit, auditArgs(opts.canvas, false));
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
        if (i === 0) {
          report.fonts = await renderedFonts(page, view.fontSamples);
          report.offPalette = view.offPalette;
        }
        report.views.push(strip(view));
        report.errors.push(...errors);
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
        report.sweep.push({ width, height, overflowX: v.overflowX, occlusions: v.occlusions.length, clipped: v.clipped.length, outside: v.outside.length, examples: [...v.occlusions, ...v.clipped, ...v.outside].slice(0, 3).map((x) => `${x.text} (${x.element}${x.by ? " / " + x.by : ""})`) });
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
  for (const [k, v] of Object.entries(report.files)) if (k !== "report") lines.push(`${k}: ${v}`);
  // A variable webfont reports the name of its default instance (e.g. "… ExtraLight"); the weight is still applied.
  lines.push(`fonts (requested → rendered): ${report.fonts.map((f) => `${f.stack.split(",")[0]} ${f.weight} → ${f.rendered.map((r) => `${r.name}${r.custom ? " [webfont]" : " [system]"}`).join(" + ") || "none"}`).join("; ")}`);
  if (report.fonts.some((f) => f.rendered.some((r) => r.custom && /(Thin|Light|Medium|SemiBold|Bold|Black)$/.test(r.name))))
    lines.push("note: a variable webfont is listed by its default instance name (e.g. \"… ExtraLight\"); the requested weight is still applied");
  const facts = report.views[0]?.facts || [];
  if (facts.length) lines.push(`facts: ${facts.map((f) => `"${f.text}" ×${f.count}${f.fontSize ? ` ${f.fontSize}px` : ""}${f.shownAt ? ` (${f.shownAt["0.35"]}px at 0.35)` : ""}`).join("; ")}`);
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
