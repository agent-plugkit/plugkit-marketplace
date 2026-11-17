import { test, expect } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
<div style="width:600px"><p data-mk="axis">齐左的一行，不在中轴上</p></div>`;


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

test("a web run screenshots each viewport, sweeps widths and walks keyboard, motion and the flow", async ({ page }) => {
  test.setTimeout(90000);
  const out = join(work, "web-review");
  const report = await inspectPage(
    parseArgs([join(work, "index.html"), "--viewports", "1024x700,375x700", "--facts", join(work, "facts.txt"), "--flow", join(work, "flow.mjs"), "--out", out]),
  );
  for (const tag of ["1024x700", "375x700"])
    for (const k of ["fold", "full", "full-gray"]) expect(existsSync(report.files[`${tag}-${k}`])).toBe(true);
  expect(png(report.files["375x700-fold"]).width).toBe(375);
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
  expect(report.keyboard.stops.map((s) => [s.label, s.visibleFocus])).toEqual([["第一个链接", true], ["报名", false]]);
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
});

