import { test, expect } from "@playwright/test";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectPage, parseArgs } from "../../plugins/musekit/scripts/inspect_page.mjs";

// Each page carries known problems; the report must name each of them and nothing intended.
let work;
const write = (name, text) => writeFileSync(join(work, name), text);
const png = (path) => {
  const b = readFileSync(path);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

test.beforeAll(() => {
  work = realpathSync(mkdtempSync(join(tmpdir(), "musekit-inspect-")));
  write("style.md", ":root { --color-paper: #ffffff; --color-ink: #111111; --color-accent: #cc2200; }\n@media (min-width: 700px) { :root { --margin: 40px; } }\n");
  write("facts.txt", "城市里的植物\n2027.03.06 14:30\n南门书房二楼\n第 3 场\n");
  write(
    "poster.html",
    `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;overflow:hidden;background:#fff;color:#111;font-family:Arial,sans-serif}
h1{position:absolute;left:20px;top:20px;margin:0;font-size:40px;white-space:nowrap}
.date{position:absolute;left:20px;top:120px;font-size:20px}
.badge{position:absolute;left:10px;top:110px;width:120px;height:40px;background:#cc2200}
.tail{position:absolute;left:300px;top:250px;font-size:20px;white-space:nowrap}
.mix{position:absolute;left:20px;top:200px;font-size:18px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
</style><h1>城市里的植物</h1><div class="date">2027.03.06 14:30</div><div class="badge"></div>
<div class="tail">超出画布的一行字</div><div class="mix">第 <span style="font-family:monospace;font-size:26px">3</span> 场</div><p class="sr">只给读屏的说明文字</p>`,
  );
  write(
    "index.html",
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html{scroll-behavior:smooth}
body{margin:0;background:#fff;color:#111;font-family:"Missing Webfont",serif}
.wide{width:1000px;height:20px}
@media (min-width:700px){.wide{width:auto}}
.stack{position:relative;height:60px}
.stack p{margin:0;font-size:18px}
.cover{position:absolute;left:0;top:0;width:200px;height:30px;background:#123456;pointer-events:none}
.strip{overflow:hidden;white-space:nowrap;width:200px}
.box{overflow:hidden;width:120px;height:24px;white-space:nowrap}
.spin{display:inline-block;animation:spin 2s linear infinite}
@keyframes spin{to{transform:rotate(1turn)}}
button:focus{outline:none}
.field{border:1px solid #111;outline:none}.field:focus{border-width:2px}
</style>
<div id="topmark" style="height:40px;background:#ff0000"></div>
<a href="#x">第一个链接</a>
<div class="wide">宽块</div>
<div class="stack"><p>被盖住的一行说明文字</p><div class="cover"></div></div>
<div class="strip" data-inspect-ignore><span>跑马灯 跑马灯 跑马灯 跑马灯 跑马灯 跑马灯 跑马灯</span></div>
<div class="box">盒子里装不下的一长串文字内容</div>
<div style="position:relative"><h2 style="font-size:120px;margin:0;line-height:1.1;white-space:nowrap">大标题</h2><div class="sticker" style="position:absolute;left:250px;top:70px;width:160px;height:70px;background:#cc2200;transform:rotate(-6deg)"></div></div>
<p>城市里的植物，<br>南门书房二楼</p>
<span class="spin">✱</span>
<button id="go">报名</button>
<input class="field" aria-label="邮箱">
<div id="msg" hidden>完成</div>
<div style="height:3000px"></div>
<script>document.getElementById("go").onclick=()=>{document.getElementById("msg").hidden=false}</script>`,
  );
  write(
    "flow.mjs",
    `export default async ({ page, shot, check, log }) => {
  await page.click("#go");
  log("message", await page.textContent("#msg"));
  await shot("done");
  await check("after submit");
};`,
  );
});
test.afterAll(() => rmSync(work, { recursive: true, force: true }));

// A style that declares layout rules, and a page that breaks each of them once.
const rulesStyle = `## Tokens

\`\`\`css
:root {
  --color-paper: #ffffff;
  --color-ink: #111111;
  --rule-width: 3px;
  --dominant-ratio: 2;
  --fill-ratio: 0.9;
  --axis-tolerance: 0.02;
  --veil-min: 0.2;
  --veil-max: 0.45;
}
/* mobile */
@media (max-width: 767px) {
  :root {
    --dominant-ratio: 1.5;
  }
}
\`\`\`

## 机检

\`\`\`json musekit-checks
${JSON.stringify({ rules: [
  { kind: "seams", group: "wall", item: "panel", max: "rule-width" },
  { kind: "dominant", group: "wall", item: "panel", main: "main", exclude: "list", min: "dominant-ratio" },
  { kind: "fill", text: "title", box: "panel", min: "fill-ratio" },
  { kind: "covers", item: "sticker", over: "panel", count: 2, avoid: "ink" },
  { kind: "axis", item: "axis", field: "axis-field", tolerance: "axis-tolerance" },
  { kind: "max-size", item: "title", than: "hero" },
  { kind: "max-size", item: "ghost", than: "hero" },
  { kind: "area", item: "veil", of: "frame", min: "veil-min", max: "veil-max" },
  { kind: "scale", group: "veil", item: "glyph", than: "vtitle", min: 6 },
  { kind: "scale", group: "veil", item: "glyph", than: "figure", min: 2 },
  { kind: "scale", group: "veil", item: "glyph", than: "caption", min: 2, optional: true },
  { kind: "scale", group: "veil", item: "glyph", than: "subtitle", min: 6 },
] })}
\`\`\`
`;
const rulesPage = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}
.wall{display:grid;position:relative;margin-bottom:40px}
#w1{grid-template-columns:17fr 10fr;column-gap:20px}
#w2{grid-template-columns:3fr 1fr}
.panel{border:3px solid #111;height:160px;position:relative;padding:0 10px}
.ink{background:#111;color:#fff}
.vframe{position:relative;width:100%;max-width:600px;height:300px;margin-bottom:20px}
.veil{position:absolute;top:0;height:100%}
.veil p{margin:0;line-height:1}
.sticker{position:absolute;margin:0;background:#ffcc00;border:3px solid #111;width:80px;height:40px;transform:rotate(-6deg)}
#s1{left:10px;top:10px}
#s2{left:calc(75% - 40px);top:60px}
h2,h1{margin:0;white-space:nowrap}
</style>
<section class="wall" id="w1" data-mk="wall">
  <div class="panel" data-mk="panel main"><h2 data-mk="title" style="font-size:40px">短标题</h2><p class="sticker" id="s1" data-mk="sticker">贴</p></div>
  <div class="panel" data-mk="panel"></div>
</section>
<section class="wall" id="w2" data-mk="wall">
  <div class="panel" data-mk="panel main"><h1 data-mk="title hero" style="font-size:30px">首屏标题首屏标题首屏标题首屏标题首屏</h1></div>
  <div class="panel ink" data-mk="panel"></div>
  <p class="sticker" id="s2" data-mk="sticker">压</p>
</section>
<div style="width:600px"><p data-mk="axis">齐左的一行，不在中轴上</p></div>
<div class="vframe" data-mk="frame"><div class="veil" style="right:0;width:40%" data-mk="veil">
  <p data-mk="glyph" style="font-size:120px">字</p><p data-mk="vtitle" style="font-size:20px">标题</p><p data-mk="figure" style="font-size:72px">4</p>
</div></div>
<div class="vframe" data-mk="frame"><div class="veil" style="left:-33.333%;width:83.333%;text-align:right" data-mk="veil"><p data-mk="glyph" style="font-size:100px">纱</p></div></div>`;


test("a canvas run exports the PNG and reports what is covered, past the canvas and missing", async () => {
  test.setTimeout(60000);
  const report = await inspectPage(parseArgs([join(work, "poster.html"), "--canvas", "400x300", "--facts", join(work, "facts.txt")]));
  expect(png(report.files.png)).toEqual({ width: 400, height: 300 });
  expect(report.files.png).toBe(join(work, "poster.png"));
  for (const k of ["gray", "at-0.25", "at-0.35", "report"]) expect(existsSync(report.files[k])).toBe(true);
  expect(png(report.files["at-0.25"])).toEqual({ width: 100, height: 75 });
  expect(report.visualReview).toBe("not-performed");

  const [view] = report.views;
  expect(view.occlusions.map((o) => o.text)).toEqual(["2027.03.06 14:30"]);
  expect(view.occlusions[0].by).toBe("div.badge");
  expect(view.outside.map((o) => o.text)).toEqual(["超出画布的一行字"]);
  // Screen-reader-only text is neither a covered line nor a clipped one.
  expect(JSON.stringify(view)).not.toContain("只给读屏");

  const facts = Object.fromEntries(view.facts.map((f) => [f.text, f]));
  expect(facts["城市里的植物"]).toMatchObject({ count: 1, exact: true, lines: 1, fontSize: 40, shownAt: { 0.25: 10, 0.35: 14 } });
  expect(facts["南门书房二楼"].count).toBe(0);
  // A monospace digit inside a Chinese line is still one line.
  expect(facts["第 3 场"]).toMatchObject({ count: 1, lines: 1 });
  expect(report.problems).toContain('fact missing: "南门书房二楼"');
  expect(report.problems.some((p) => p.startsWith('text covered: "2027.03.06 14:30"'))).toBe(true);
  expect(report.offPalette).toEqual([]);
});

test("thumbnails show the real reduced size at any export scale, and a fact may break only where it is marked", async () => {
  test.setTimeout(60000);
  write("marked.html", `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}
h1{margin:0;width:200px;font-size:40px}
p{margin:0;width:70px;font-size:30px}
h2{margin:0;font-size:20px}
</style><h1>河岸图书节 2027</h1><p>城市里的植物</p><h2>南门<br>书房</h2>
<h3 style="margin:0;font-size:20px">书房二楼</h3><small style="display:block;width:30px;font-size:20px">书房二楼</small>`);
  write("marked-facts.txt", "河岸图书节 |2027\n城市里的植物\n南门|书房\n书房二楼\n");
  const report = await inspectPage(parseArgs([join(work, "marked.html"), "--canvas", "400x300", "--scale", "2", "--facts", join(work, "marked-facts.txt"), "--out", join(work, "marked-review")]));
  expect(png(report.files.png)).toEqual({ width: 800, height: 600 });
  expect(png(report.files["at-0.25"])).toEqual({ width: 100, height: 75 });
  const facts = Object.fromEntries(report.views[0].facts.map((f) => [f.text, f]));
  expect(facts["河岸图书节 |2027"]).toMatchObject({ count: 1, exact: true, lines: 2 });
  expect(report.problems.some((p) => p.includes('"河岸图书节 |2027"'))).toBe(false);
  // A mark with no space beside it still matches the text broken there.
  expect(facts["南门|书房"]).toMatchObject({ count: 1, exact: true, lines: 2, unmarkedBreak: false });
  expect(report.problems.some((p) => p.startsWith('fact breaks across') && p.includes('"城市里的植物"'))).toBe(true);
  // Every occurrence counts: one line in the heading, broken in the narrow note, and the note is named.
  expect(facts["书房二楼"]).toMatchObject({ count: 2, unmarkedBreak: true, breaksIn: "small" });
  expect(report.problems.some((p) => p.startsWith('fact breaks across') && p.includes('"书房二楼" in small'))).toBe(true);
});

test("fonts are read per stack from each element's own text, and a webfont reports the weights the page loaded", async () => {
  test.setTimeout(60000);
  // A real webfont file: the icon font Playwright ships, drawn through its private-use code points.
  const icons = join(dirname(createRequire(import.meta.url).resolve("playwright-core/package.json")), "lib/vite/traceViewer");
  copyFileSync(join(icons, readdirSync(icons).find((f) => /^codicon.*\.ttf$/.test(f))), join(work, "probe.ttf"));
  write("fonts.html", `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"Probe Face";src:url(probe.ttf);font-weight:700}
html,body{margin:0;background:#fff;color:#111}
h1{margin:0;font:700 40px "Probe Face",monospace}
span{font:400 20px Georgia,serif}
</style><h1>&#xEA60;&#xEA61; <span>serif inside</span></h1>`);
  const report = await inspectPage(parseArgs([join(work, "fonts.html"), "--canvas", "600x200", "--out", join(work, "fonts-review")]));
  const probe = report.fonts.find((f) => f.stack.includes("Probe Face"));
  const serif = report.fonts.find((f) => f.stack.includes("Georgia"));
  expect(probe.rendered.find((r) => r.custom)).toMatchObject({ name: "Probe Face", glyphs: 2, loadedWeights: ["700"] });
  // The serif child is its own stack, not part of the heading's.
  const serifNames = serif.rendered.map((r) => r.name);
  expect(serifNames.length).toBeGreaterThan(0);
  expect(probe.rendered.some((r) => serifNames.includes(r.name))).toBe(false);
  expect(serif.rendered.every((r) => !r.custom && r.faces.length)).toBe(true);

  // Stacks met in the order A B A C C B: each keeps its own samples, none borrows another stack's element.
  const p = (family) => `<p style="margin:0;font:20px ${family}">${family} sample</p>`;
  write("stacks.html", `<!doctype html><meta charset="utf-8"><body style="margin:0">${["monospace", "serif", "monospace", "sans-serif", "sans-serif", "serif"].map(p).join("")}`);
  const stacks = await inspectPage(parseArgs([join(work, "stacks.html"), "--canvas", "600x200", "--out", join(work, "stacks-review")]));
  const names = Object.fromEntries(stacks.fonts.map((f) => [f.stack, f.rendered.map((r) => r.name)]));
  expect(Object.keys(names).sort()).toEqual(["monospace", "sans-serif", "serif"]);
  expect(names.serif.some((n) => names["sans-serif"].includes(n) || names.monospace.includes(n))).toBe(false);
});

test("a display glyph whose em box pokes out of its frame is not clipped while its ink is inside; cut ink still is", async () => {
  test.setTimeout(60000);
  write("glyph.html", `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}
.frame{position:absolute;left:0;width:560px;overflow:hidden}
#a{top:0;height:200px}
#a p{margin:0;font-size:200px;line-height:1}
#b{top:300px;height:60px}
#b p{margin:0;font-size:60px;line-height:1;position:relative;top:8px}
#c{top:420px;left:20px;margin:0;font-size:60px;line-height:1;position:absolute;right:-30px;text-align:right}
</style><div class="frame" id="a"><p>HE</p></div><div class="frame" id="b"><p>gypsy</p></div><p id="c">EH</p>`);
  const report = await inspectPage(parseArgs([join(work, "glyph.html"), "--canvas", "600x500", "--out", join(work, "glyph-review")]));
  const [view] = report.views;
  // HE at line-height 1: the em box runs past the 200px frame, the capitals do not.
  // gypsy: the descenders are cut by the frame's bottom edge, so it stays reported.
  expect(view.clipped.map((c) => c.text)).toEqual(["gypsy"]);
  // EH: the box runs past the canvas by 30px, and so does the ink.
  expect(view.outside.map((c) => c.text)).toEqual(["EH"]);
});

test("the fold is shot after scroll-driven state has settled back at the top", async ({ page }) => {
  test.setTimeout(60000);
  write("nav.html", `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}
nav{position:fixed;top:0;left:0;display:flex;gap:20px;padding:10px}
nav a{display:block;width:100px;height:40px;transition:background-color .6s}
nav a.on{background:#cc2200}
</style><nav><a id="a1" class="on">一</a><a id="a2">二</a></nav><div style="height:3000px"></div>
<script>const on=()=>{const deep=scrollY>300;a1.classList.toggle("on",!deep);a2.classList.toggle("on",deep)};addEventListener("scroll",()=>requestAnimationFrame(on))</script>`);
  const report = await inspectPage(parseArgs([join(work, "nav.html"), "--viewports", "800x600", "--style", join(work, "style.md"), "--out", join(work, "nav-review")]));
  const fold = readFileSync(report.files["800x600-fold"]).toString("base64");
  await page.setContent(`<img id="i" src="data:image/png;base64,${fold}">`);
  const at = (x, y) => page.evaluate(async ([x, y]) => {
    const img = document.getElementById("i");
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    return [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
  }, [x, y]);
  // The first item is current at the top; the second has finished fading out.
  expect(await at(15, 45)).toEqual([204, 34, 0]);
  expect(await at(135, 45)).toEqual([255, 255, 255]);
});

test("a pinned header that lets body text show through once scrolled is reported; an opaque or frosted one is not", async () => {
  test.setTimeout(90000);
  const page = (header) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}
header{position:sticky;top:0;height:60px;display:flex;gap:40px;align-items:center;padding:0 20px;${header}}
p{margin:0 20px;font-size:18px;line-height:30px}
</style><header><a>首页</a><a>日程</a><a>报名</a></header>
<h1 style="margin:20px">标题在导航下方</h1>
${Array.from({ length: 80 }, (_, i) => `<p>正文第 ${i + 1} 行，滚动时会经过导航</p>`).join("\n")}`;
  write("bar-clear.html", page(""));
  write("bar-paper.html", page("background:#fff"));
  write("bar-glass.html", page("background:rgba(255,255,255,.7);backdrop-filter:blur(12px)"));
  const run = (name) => inspectPage(parseArgs([join(work, name), "--viewports", "800x600", "--style", join(work, "style.md"), "--out", join(work, `${name}-review`)]));

  const clear = await run("bar-clear.html");
  const [view] = clear.views;
  expect(view.underHeader.length).toBeGreaterThan(0);
  expect(view.underHeader[0].text).toMatch(/^正文第/);
  expect(view.underHeader[0].header).toBe("header");
  // The title sits below the bar at the top of the page, so it is never reported.
  expect(view.underHeader.some((u) => u.text.startsWith("标题"))).toBe(false);
  expect(clear.problems.some((p) => /^text shows through the pinned header @800x600: "正文第/.test(p))).toBe(true);
  // Ordinary occlusion still skips pinned elements: the same lines are not also "covered".
  expect(view.occlusions).toEqual([]);

  for (const name of ["bar-paper.html", "bar-glass.html"]) {
    const report = await run(name);
    expect(report.views[0].underHeader).toEqual([]);
    expect(report.problems.some((p) => p.includes("pinned header"))).toBe(false);
  }
});

test("motion leftovers: first-screen text an entrance animation left invisible, and transition: all", async () => {
  test.setTimeout(90000);
  write("motion.html", `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}
@keyframes rise{to{opacity:1}}
@keyframes arrive{from{opacity:0}}
.stuck{opacity:0;animation:rise .3s}
.arrived{animation:arrive .3s both}
.menu{position:absolute;top:0;right:0;opacity:0}
.later{opacity:0;margin-top:2000px}
.btn{transition:all .2s}
a{transition:color .2s}
</style>
<h1 class="stuck">没有回来的标题</h1>
<p class="arrived">正常入场的导读</p>
<div class="menu">收起的菜单</div>
<button class="btn">报名</button><button class="btn">取消</button>
<a href="#">链接</a>
<p class="hidden-note" hidden style="opacity:0">隐藏的说明</p>
<p class="later">首屏以下还没出现的段落</p>`);
  const report = await inspectPage(parseArgs([join(work, "motion.html"), "--viewports", "800x600", "--style", join(work, "style.md"), "--out", join(work, "motion-review")]));
  const [view] = report.views;
  expect(view.invisibleAtRest).toEqual([{ text: "没有回来的标题", element: "h1.stuck" }]);
  expect(view.transitionAll).toEqual([{ value: "button.btn", count: 2 }]);
  expect(report.problems).toContain('first-screen text invisible after motion settled @800x600: "没有回来的标题" (h1.stuck at opacity 0)');
  expect(report.problems.some((p) => /^transition: all on 2 elements \(button\.btn ×2\)/.test(p))).toBe(true);
});

test("a web run screenshots each viewport, sweeps widths and walks keyboard, motion and the flow", async ({ page }) => {
  test.setTimeout(90000);
  const out = join(work, "web-review");
  const report = await inspectPage(
    parseArgs([join(work, "index.html"), "--viewports", "1024x700,375x700", "--facts", join(work, "facts.txt"), "--flow", join(work, "flow.mjs"), "--out", out]),
  );
  for (const tag of ["1024x700", "375x700"])
    for (const k of ["fold", "full", "full-gray"]) expect(existsSync(report.files[`${tag}-${k}`])).toBe(true);
  expect(png(report.files["375x700-fold"]).width).toBe(375);
  // The short screens the sweep visits get a first-screen shot each, without being listed.
  for (const tag of ["1366x768", "1280x720", "1024x768", "375x667"]) expect(existsSync(report.files[`${tag}-fold`])).toBe(true);
  expect(png(report.files["375x667-fold"])).toEqual({ width: 375, height: 667 });
  expect(report.files["375x667-full"]).toBeUndefined();
  // The page scrolls smoothly; the fold is still shot at the very top, not partway back.
  const top = readFileSync(report.files["1024x700-fold"]).toString("base64");
  await page.setContent(`<img id="i" src="data:image/png;base64,${top}">`);
  const pixel = await page.evaluate(async () => {
    const img = document.getElementById("i");
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    return [...g.getImageData(5, 5, 1, 1).data.slice(0, 3)];
  });
  expect(pixel).toEqual([255, 0, 0]);

  const [desk, phone] = report.views;
  // The overlay ignores the pointer, yet it still covers the text.
  // Also a display title whose corner alone is under a tilted sticker.
  expect(desk.occlusions.map((o) => o.text)).toEqual(["被盖住的一行说明文字", "大标题"]);
  expect(desk.occlusions[1].by).toBe("div.sticker");
  expect(desk.clipped.map((o) => o.text)).toEqual(["盒子里装不下的一长串文字内容"]);
  expect(JSON.stringify(desk)).not.toContain("跑马灯");
  expect(desk.overflowX).toBe(0);
  expect(phone.overflowX).toBeGreaterThan(600);

  // A fact broken by <br> is still found, and the break is reported.
  const city = desk.facts.find((f) => f.text === "城市里的植物");
  expect(city.count).toBe(1);
  expect(desk.facts.find((f) => f.text === "南门书房二楼").count).toBe(1);

  const sweep = Object.fromEntries(report.sweep.filter((s) => s.height === 900).map((s) => [s.width, s]));
  // Short screens are swept too: the wide block overflows a 375 × 667 phone.
  expect(report.sweep.find((s) => s.width === 375 && s.height === 667).overflowX).toBeGreaterThan(0);
  expect(report.problems.some((p) => /^sweep 375px × 667px high: overflow/.test(p))).toBe(true);
  expect(sweep[699].overflowX).toBeGreaterThan(0);
  expect(sweep[700].overflowX).toBe(0);
  expect(report.problems.some((p) => /^sweep 320(–\d+)?px: overflow/.test(p))).toBe(true);
  expect(report.problems.some((p) => /^sweep (\d+–)?699px: overflow/.test(p))).toBe(true);

  expect(report.fonts.some((f) => f.stack.includes("Missing Webfont") && f.fallback.length)).toBe(true);
  expect(report.keyboard.stops.map((s) => [s.label, s.visibleFocus])).toEqual([["第一个链接", true], ["报名", false], ["邮箱", true]]);
  expect(report.reducedMotion.running.some((r) => r.includes("spin") && r.includes("infinite"))).toBe(true);

  const flow = report.flow["1024x700"];
  expect(flow.error).toBeUndefined();
  expect(flow.log).toEqual(["message 完成"]);
  expect(existsSync(join(out, "flow-1024x700-done.png"))).toBe(true);
  expect(flow.checks[0].label).toBe("after submit");
  expect(Object.keys(report.flow)).toEqual(["1024x700", "375x700"]);
  expect(JSON.parse(readFileSync(join(out, "report.json"), "utf8")).problems).toEqual(report.problems);
});

test("layout rules from style.md: each broken rule is named with its reading, thresholds follow the breakpoint", async () => {
  test.setTimeout(90000);
  write("rules.html", rulesPage);
  write("rules-style.md", rulesStyle);
  const report = await inspectPage(parseArgs([join(work, "rules.html"), "--viewports", "1024x900,375x900", "--style", join(work, "rules-style.md"), "--out", join(work, "rules-review")]));
  const [desk, phone] = report.views;
  const d = desk.rules;
  const kind = (rules, k, n = 0) => rules.filter((r) => r.kind === k)[n];

  expect(kind(d, "seams").status).toBe("fail");
  expect(kind(d, "seams").items[0].gaps).toEqual([20, 20]);
  // 1.7 is below the desktop ratio 2 but above the phone ratio 1.5.
  expect(kind(d, "dominant").items.map((i) => [i.ratio, i.ok])).toEqual([[1.7, false], [3, true]]);
  expect(kind(phone.rules, "dominant").threshold).toBe(1.5);
  expect(kind(phone.rules, "dominant").items[0].ok).toBe(true);
  // Fill is judged on the first viewport only; elsewhere it reports the reading.
  expect(kind(d, "fill").status).toBe("fail");
  expect(kind(phone.rules, "fill").status).toBe("info");
  // A sticker inside one panel covers one; a sticker across the seam covers two but sits on the ink panel.
  expect(kind(d, "covers").items.map((i) => [i.covers, !!i.onAvoided, i.ok])).toEqual([[1, false, false], [2, true, false]]);
  expect(kind(d, "axis").items[0].ok).toBe(false);
  expect(kind(d, "max-size").items.map((i) => [i.size, i.limit, i.ok])).toEqual([[40, 30, false]]);
  // An unmarked role is reported as not measured, never as a silent pass.
  expect(kind(d, "max-size", 1)).toMatchObject({ status: "unmarked" });
  expect(report.problems).toContain('layout rule max-size not measured @1024x900: no element marked data-mk="ghost"');
  expect(report.problems.some((p) => p.startsWith("layout rule dominant fails @1024x900: section#w1"))).toBe(true);
  expect(report.problems.some((p) => p.startsWith("layout rule dominant fails @375x900"))).toBe(false);
  expect(report.problems.some((p) => /^sweep .*rule seams fails/.test(p))).toBe(true);
  // Area counts only the part of a veil inside its frame: the second one bleeds a third past the edge.
  expect(kind(d, "area").items.map((i) => [i.ratio, i.ok])).toEqual([[0.4, true], [0.5, false]]);
  expect(report.problems).toContain('layout rule area fails @1024x900: div.veil "纱" area 0.5 (0.2–0.45)');
  // Scale compares within a veil, and only where the reference is there: the second veil has no title or figure.
  expect(kind(d, "scale", 0).items.map((i) => [i.size, i.than, i.ratio, i.ok])).toEqual([[120, 20, 6, true]]);
  expect(kind(d, "scale", 1).items.map((i) => [i.ratio, i.ok])).toEqual([[1.67, false]]);
  expect(report.problems.some((p) => p.startsWith('layout rule scale fails @1024x900: p "字" 120px, 1.67× 72px (min 2×)'))).toBe(true);
  // An optional reference missing everywhere: nothing compared, which is said but is not a finding.
  expect(kind(d, "scale", 2)).toMatchObject({ status: "info", items: [] });
  expect(report.problems.some((p) => p.includes("caption"))).toBe(false);
  // A required one missing everywhere is not measured, never a silent pass.
  expect(kind(d, "scale", 3)).toMatchObject({ status: "unmarked" });
  expect(report.problems).toContain('layout rule scale not measured @1024x900: no element marked data-mk="subtitle"');
});

test("a style that follows the system is also shot in dark, and a page that ignores dark or hardcodes light colours is told so", async () => {
  test.setTimeout(90000);
  write("scheme-style.md", `\`\`\`css
:root {
  color-scheme: light dark;
  --color-paper: #ffffff;
  --color-ink: #111111;
}
/* 深色：跟随系统 */
@media (prefers-color-scheme: dark) {
  :root {
    --color-paper: #121311;
    --color-ink: #ecebe5;
  }
}
\`\`\`
`);
  const page = (css) => `<!doctype html><meta charset="utf-8"><style>
:root{--color-paper:#ffffff;--color-ink:#111111}
${css}
html,body{margin:0;background:var(--color-paper);color:var(--color-ink);font-family:Arial,sans-serif}
.note{color:#111111}
.tint{background:color-mix(in srgb, var(--color-ink) 8%, transparent)}
</style><h1>城市里的植物</h1><p class="note">写死的墨色</p><p class="tint">由墨色调出的浅底</p>`;
  write("follows.html", page("@media (prefers-color-scheme: dark){:root{--color-paper:#121311;--color-ink:#ecebe5}}"));
  write("ignores.html", page(""));
  const run = (name) => inspectPage(parseArgs([join(work, `${name}.html`), "--viewports", "800x600", "--style", join(work, "scheme-style.md"), "--out", join(work, `${name}-review`)]));

  const follows = await run("follows");
  for (const k of ["fold", "full"]) expect(existsSync(follows.files[`800x600-dark-${k}`])).toBe(true);
  expect(follows.dark.map((d) => d.same)).toEqual([false]);
  // The hardcoded ink is on the light palette but not on the dark one; a tint mixed from a token is on both.
  expect(follows.offPalette).toEqual([]);
  expect(follows.dark[0].offPalette.map((o) => o.value)).toEqual(["color rgb(17, 17, 17)"]);
  expect(follows.problems.some((p) => p.startsWith("colour not in style.md (dark) @800x600: color rgb(17, 17, 17)"))).toBe(true);
  expect(follows.problems.some((p) => /looks the same/.test(p))).toBe(false);

  const ignores = await run("ignores");
  expect(ignores.dark.map((d) => d.same)).toEqual([true]);
  expect(ignores.problems.some((p) => p.startsWith("dark scheme looks the same as light @800x600"))).toBe(true);
});

// Decks are built on the slides-design starter, shrunk to an 800 × 450 canvas to keep the run short.
const starter = readFileSync(new URL("../../plugins/musekit/skills/slides-design/assets/deck.html", import.meta.url), "utf8")
  .replaceAll("1920px", "800px").replaceAll("1080px", "450px");
const deck = (slides, css = "") => {
  const head = starter.replace("/* 3. 版式：", `${css}\n.slide{font-family:Arial,sans-serif}\n/* 3. 版式：`);
  if (head === starter) throw new Error("starter deck no longer has the layout section marker");
  const a = head.indexOf("<body>") + "<body>".length;
  return `${head.slice(0, a)}\n${slides}\n${head.slice(head.indexOf("<script>"))}`;
};
const deckSlides = `
<section class="slide"><div data-mk="wall" style="position:absolute;left:20px;top:20px;display:grid;grid-template-columns:2fr 1fr">
  <div data-mk="panel" style="height:200px;border:3px solid #111"><h1 style="margin:0;font-size:48px">城市里的植物</h1></div>
  <div data-mk="panel" style="height:200px;border:3px solid #111;border-left:0"></div>
  <p data-mk="sticker" style="position:absolute;left:calc(66% - 40px);top:120px;margin:0;width:80px;height:30px;background:#cc2200;transform:rotate(-6deg)"></p>
</div></section>
<section class="slide"><p style="position:absolute;left:40px;top:200px;margin:0;font-size:24px">2027.03.06 14:30</p><div style="position:absolute;left:30px;top:195px;width:120px;height:40px;background:#cc2200"></div></section>
<section class="slide"><p style="position:absolute;left:700px;top:100px;margin:0;font-size:24px;white-space:nowrap">出画布的一行字很长</p><p style="position:absolute;left:40px;top:400px;margin:0;font-size:12px">来源：小字</p></section>
<section class="slide"><h2 style="margin:40px;font-size:32px">第四页</h2><p style="margin:40px;width:70px;font-size:20px">城市里的植物</p></section>`;
const deckStyle = `\`\`\`css
:root {
  --color-paper: #ffffff;
  --color-ink: #111111;
  --color-accent: #cc2200;
  --size-meta: 16px;
  --rule-width: 3px;
}
\`\`\`

\`\`\`json musekit-checks
${JSON.stringify({ rules: [
  { kind: "seams", group: "wall", item: "panel", max: "rule-width" },
  { kind: "covers", item: "sticker", over: "panel", count: 2 },
  { kind: "max-size", item: "ghost", than: "hero" },
] })}
\`\`\`
`;

test("a deck run checks each slide alone, counts facts over the deck and exports PNG, PDF and the overview", async () => {
  test.setTimeout(90000);
  write("deck.html", deck(deckSlides));
  write("deck-style.md", deckStyle);
  write("deck-facts.txt", "城市里的植物\n2027.03.06 14:30\n南门书房\n");
  const report = await inspectPage(parseArgs([join(work, "deck.html"), "--canvas", "800x450", "--slides", ".slide", "--style", join(work, "deck-style.md"), "--facts", join(work, "deck-facts.txt"), "--out", join(work, "deck-review")]));
  expect(report.mode).toBe("slides");
  expect(report.views.map((v) => v.slide)).toEqual([1, 2, 3, 4]);
  for (let n = 1; n <= 4; n++) expect(png(report.files[`slide-${n}`])).toEqual({ width: 800, height: 450 });
  expect(report.files["slide-1"]).toBe(join(work, "deck-slides", "01.png"));
  expect(report.files.pdf).toBe(join(work, "deck.pdf"));
  expect(report.pdf.pages).toBe(4);
  // 450px is 337.5pt; the PDF stores whole points, so the height can read 451px.
  expect(report.pdf.sizes.length).toBe(1);
  expect(report.pdf.sizes[0]).toMatch(/^800x45[01]$/);
  for (const k of ["sheet", "sheet-gray", "report"]) expect(existsSync(report.files[k])).toBe(true);
  // Every slide sits alone at the top-left of the canvas in the print layout.
  expect(report.problems.some((p) => /sits at|PDF/.test(p))).toBe(false);

  expect(report.facts.map((f) => [f.text, f.count, f.slides])).toEqual([["城市里的植物", 2, [1, 4]], ["2027.03.06 14:30", 1, [2]], ["南门书房", 0, []]]);
  // Each slide keeps its own reading: broken over two lines in the 20px column on slide 4 only.
  expect(report.facts[0].at).toEqual([{ slide: 1, lines: 1, unmarkedBreak: false, fontSize: 48 }, { slide: 4, lines: 2, unmarkedBreak: true, breaksIn: "p", fontSize: 20 }]);
  expect(report.problems.some((p) => p.startsWith('fact breaks across 2 lines @slide 4: "城市里的植物" in p'))).toBe(true);
  expect(report.problems.some((p) => /breaks across .* @slide 1:/.test(p))).toBe(false);
  expect(report.problems).toContain('fact missing from every slide: "南门书房"');
  expect(report.problems.some((p) => p.startsWith('text covered @slide 2: "2027.03.06 14:30"'))).toBe(true);
  expect(report.problems.some((p) => p.startsWith('text clipped @slide 3: "出画布的一行字很长"'))).toBe(true);
  expect(report.problems.some((p) => p.startsWith("text below size-meta (16px) @slide 3: 12px"))).toBe(true);
  // Rules measured where their roles are; a role on no slide at all is reported once.
  expect(report.views[0].rules.map((r) => r.status)).toEqual(["pass", "pass", "unmarked"]);
  expect(report.problems).toContain('layout rule max-size not measured on any slide: no element marked data-mk="ghost", "hero"');
  expect(report.problems.some((p) => /seams|covers/.test(p))).toBe(false);
});

test("a deck whose print layout is off is told so: slide offset and PDF page size", async () => {
  test.setTimeout(60000);
  const broken = deck(deckSlides.split("</section>").slice(0, 2).join("</section>") + "</section>", "body{padding:12px}").replace(/@page \{[^}]*\}/, "@page { size: A4; margin: 0; }");
  write("broken.html", broken);
  write("deck-style.md", deckStyle);
  const report = await inspectPage(parseArgs([join(work, "broken.html"), "--canvas", "800x450", "--slides", ".slide", "--style", join(work, "deck-style.md"), "--out", join(work, "broken-review")]));
  expect(report.problems.some((p) => p.startsWith("slide 1 sits at 12,12 as 800x450"))).toBe(true);
  expect(report.problems.some((p) => /^PDF page size \d+x\d+ is not the canvas 800x450/.test(p))).toBe(true);
});

test("the starter deck shows one slide at a time, scaled to the window, and turns pages by key and address", async ({ page }) => {
  write("present.html", deck(deckSlides));
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(pathToFileURL(join(work, "present.html")).href);
  const shown = () => page.evaluate(() => [...document.querySelectorAll(".slide")].map((s, i) => [i + 1, getComputedStyle(s).visibility]).filter(([, v]) => v === "visible").map(([n]) => n));
  expect(await shown()).toEqual([1]);
  // Hidden slides keep their layout, so a script that sizes a canvas at load measures every slide.
  expect(await page.evaluate(() => [...document.querySelectorAll(".slide")].map((s) => s.offsetWidth))).toEqual([800, 800, 800, 800]);
  // 800 × 450 scaled into 1000 × 700 is limited by the width.
  expect(await page.evaluate(() => Math.round(document.querySelector(".slide").getBoundingClientRect().width))).toBe(1000);
  await page.keyboard.press("ArrowRight");
  expect(await shown()).toEqual([2]);
  expect(new URL(page.url()).hash).toBe("#2");
  await page.keyboard.press("End");
  expect(await shown()).toEqual([4]);
  await page.keyboard.press("ArrowRight");
  expect(await shown()).toEqual([4]);
  await page.goto(pathToFileURL(join(work, "present.html")).href + "#3");
  expect(await shown()).toEqual([3]);
  await page.keyboard.press("Home");
  expect(await shown()).toEqual([1]);
});
