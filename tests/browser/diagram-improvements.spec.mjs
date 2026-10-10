import { test, expect } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
let work, file;
const script =
  "plugins/musekit/skills/diagram-design/scripts/prepare_diagram.py";
test.beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "musekit-improvements-"));
  file = join(work, "reader.html");
  execFileSync("python3", [
    script,
    "tests/fixtures/reader-quality.html",
    "--output",
    file,
  ]);
});
test.afterAll(() => rmSync(work, { recursive: true, force: true }));
async function open(page, path = file) {
  await page.goto(pathToFileURL(resolve(path)).href);
  await page.waitForFunction(
    () =>
      document.querySelector("[data-diagram]")?.dataset.diagramReady === "true",
  );
}
const state = (page) =>
  page.evaluate(() => ({
    state: window.museDiagram.getState(),
    geometry: window.museDiagram.getGeometry(),
    history: window.museDiagram.history.length,
  }));

test("reader keeps duplicate IDs, direct relations and isolated states without modifying layout or PNG", async ({
  page,
}) => {
  await open(page);
  const before = await state(page);
  const png = () =>
    page.evaluate(async () => {
      const b = await window.museDiagram.exportPNG(1);
      return [
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", await b.arrayBuffer()),
        ),
      ].join(",");
    });
  const originalPNG = await png();
  await page.getByRole("button", { name: "查找节点", exact: true }).click();
  const panel = page.getByRole("region", { name: "查找节点与关系" });
  await page.getByRole("searchbox", { name: "搜索节点" }).fill("审批");
  await expect(panel.locator(".reader-results button")).toHaveCount(2);
  await panel.getByRole("button", { name: "审批 · A", exact: true }).click();
  await expect(panel.locator(".reader-detail")).toContainText("出边 · 2");
  await expect(panel.locator(".reader-detail")).toContainText("无箭头关联 · 1");
  await expect(panel.locator(".reader-detail")).toContainText("未标注关系");
  await expect(
    panel.locator(".reader-detail button").filter({ hasText: "e3" }),
  ).toHaveText("未标注关系 · 审批 [B] — 审批 [A] · e3");
  await panel.getByRole("button", { name: "审批 · B", exact: true }).click();
  await expect(panel.locator(".reader-detail")).toContainText("入边 · 2");
  await expect(
    panel.locator(".reader-detail button").filter({ hasText: "e1" }),
  ).toHaveText("未标注关系 · 审批 [A] → 审批 [B] · e1");
  expect(await state(page)).toEqual(before);
  expect(await png()).toBe(originalPNG);
  const html = await page.evaluate(() => window.museDiagram.saveHTML());
  expect(
    await page.evaluate((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return doc.querySelectorAll(
        "muse-diagram-editor,.reader-overlay,.reader-detail",
      ).length;
    }, html),
  ).toBe(0);
  await page.getByRole("searchbox", { name: "搜索节点" }).fill("C");
  await panel
    .getByRole("button", { name: "孤立节点 · C", exact: true })
    .click();
  await expect(panel.locator(".reader-detail")).toContainText(
    "此节点没有声明的关系",
  );
  await page.getByRole("searchbox", { name: "搜索节点" }).fill("无此节点");
  await expect(panel.getByRole("status")).toHaveText("没有匹配的节点");
  await page.getByRole("searchbox", { name: "搜索节点" }).press("Escape");
  await expect(panel).toBeHidden();
  await expect(
    page.getByRole("button", { name: "查找节点", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "编辑布局", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查找节点", exact: true }),
  ).toBeHidden();
});

test("reader keyboard, clicks and resize keep focus outside the panel at three viewport sizes", async ({
  page,
}) => {
  for (const [width, height] of [
    [1280, 800],
    [1600, 1000],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await open(page);
    await page.keyboard.press("/");
    const input = page.getByRole("searchbox", { name: "搜索节点" });
    await expect(input).toBeFocused();
    await input.fill("B");
    await input.press("ArrowDown");
    await page.keyboard.press("Enter");
    const node = await page.locator('[data-diagram-node="B"]').boundingBox();
    const panel = await page
      .getByRole("region", { name: "查找节点与关系" })
      .boundingBox();
    expect(node.x + node.width / 2).toBeLessThan(panel.x);
    expect(node.x + node.width / 2).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "适合窗口" }).click();
    await page.locator('[data-diagram-node="A"]').click();
    await expect(page.locator(".reader-detail")).toContainText("A");
    if (process.env.MUSEKIT_VISUAL_OUTPUT)
      await page.screenshot({
        path: join(process.env.MUSEKIT_VISUAL_OUTPUT, `reader-${width}.png`),
      });
  }
});

test("ordinary inspection permits warnings, strict blocks them and diagnostics locate unlabeled edges", async ({
  page,
}) => {
  const inspect =
    "plugins/musekit/skills/diagram-design/scripts/inspect_diagram.mjs";
  const ordinary = spawnSync(
    process.execPath,
    [inspect, file, "--output", join(work, "ordinary")],
    { encoding: "utf8" },
  );
  expect(ordinary.status, ordinary.stderr).toBe(0);
  const report = JSON.parse(ordinary.stdout);
  expect(report.warningCount).toBeGreaterThan(0);
  expect(report.errorCount).toBe(0);
  const strict = spawnSync(
    process.execPath,
    [inspect, file, "--output", join(work, "strict"), "--strict"],
    { encoding: "utf8" },
  );
  expect(strict.status).toBe(1);
  expect(JSON.parse(strict.stdout).checks.strictWarnings).toBe(false);
  await open(page);
  await page.getByRole("button", { name: "编辑布局", exact: true }).click();
  await page.locator(".issues .warning").first().click();
  await expect(page.locator(".issues")).toContainText("连续长度");
  expect(
    await page
      .locator("muse-diagram-editor")
      .evaluate(
        (el) =>
          el.shadowRoot.querySelectorAll('.overlay rect[stroke="#2563eb"]')
            .length,
      ),
  ).toBeGreaterThan(0);
  const issues = (await state(page)).geometry.issues;
  await page.getByRole("button", { name: "放大", exact: true }).click();
  expect((await state(page)).geometry.issues).toEqual(issues);
});

test("new spread config survives edits and reopening, while old files retain center anchors", async ({
  page,
}) => {
  await open(page);
  const centered = (await state(page)).geometry.edges;
  expect(centered.e1.points[0]).toEqual(centered.e2.points[0]);
  const src = readFileSync(
    "tests/fixtures/reader-quality.html",
    "utf8",
  ).replace(/"version"\s*:\s*1/, '"version":1,"portDistribution":"spread"');
  const spread = join(work, "spread.html");
  writeFileSync(spread, src);
  execFileSync("python3", [script, spread, "--output", spread]);
  await open(page, spread);
  const g = (await state(page)).geometry;
  expect(g.edges.e1.points[0]).not.toEqual(g.edges.e2.points[0]);
  const start = await state(page);
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.change(() => d.move(["B"], 0, 40));
  });
  await page.evaluate(() => window.museDiagram.undo());
  expect((await state(page)).geometry).toEqual(start.geometry);
  await page.evaluate(() => window.museDiagram.redo());
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.change(() => {
      d.state.edges.e1 = { fromPort: { side: "right", at: 0.2 } };
    });
  });
  const manual = await state(page);
  expect(manual.geometry.edges.e1.fromPort.at).toBe(0.2);
  for (let i = 0; i < 3; i++) {
    writeFileSync(
      spread,
      await page.evaluate(() => window.museDiagram.saveHTML()),
    );
    await open(page, spread);
    expect((await state(page)).state).toEqual(manual.state);
    expect((await state(page)).geometry).toEqual(manual.geometry);
  }
});

test("spread draws offset facing relations straight, including ports that declare only a side", async ({
  page,
}) => {
  const src = readFileSync("tests/fixtures/reader-quality.html", "utf8")
    .replace(/"version"\s*:\s*1/, '"version":1,"portDistribution":"spread"')
    .replace("left: 600px; top: 200px", "left: 600px; top: 220px")
    .replace(
      '{ "id": "e1", "from": "A", "to": "B" }',
      '{ "id": "e1", "from": "A", "to": "B", "fromPort": { "side": "right" } }',
    );
  const path = join(work, "aligned.html");
  writeFileSync(path, src);
  execFileSync("python3", [script, path, "--output", path]);
  await open(page, path);
  const { geometry } = await state(page);
  const ys = ["e1", "e2", "e3"].map((id) => {
    expect(geometry.edges[id].points).toHaveLength(2);
    return geometry.edges[id].points[0].y;
  });
  // The side-only port joins one parallel bundle centered on the shared span.
  const { A, B } = geometry.nodes;
  expect(ys[1]).toBeCloseTo((B.y + A.y + A.h) / 2, 6);
  expect(ys[1] - ys[0]).toBeCloseTo(12, 6);
  expect(ys[2] - ys[1]).toBeCloseTo(12, 6);
  expect(geometry.issues).toEqual([]);
  await open(
    page,
    "plugins/musekit/skills/diagram-design/references/examples/dataflow.html",
  );
  const dataflow = (await state(page)).geometry;
  expect(dataflow.edges.e2.points).toHaveLength(2);
  expect(dataflow.edges.e2.points[0].y).toBe(dataflow.edges.e1.points[0].y);
  // The split and merge hubs sit midway between the two outputs.
  const middle = (id) => dataflow.nodes[id].y + dataflow.nodes[id].h / 2;
  const branches = (middle("Store") + middle("Aggregate")) / 2;
  expect(middle("Mask")).toBeCloseTo(branches, 6);
  expect(middle("Report")).toBeCloseTo(branches, 6);
});

test("tidy evens a row of peers once, keeps it through reopening, and leaves drifting decorations alone", async ({
  page,
}) => {
  const path = join(work, "tidy.html");
  execFileSync("python3", [
    script,
    "tests/fixtures/tidy.html",
    "--output",
    path,
  ]);
  await open(page, path);
  const tidy = await state(page);
  const heights = ["read", "check", "write"].map(
    (id) => tidy.geometry.nodes[id].h,
  );
  expect(new Set(heights).size).toBe(1);
  for (const id of ["e1", "e2"]) {
    expect(tidy.geometry.edges[id].points).toHaveLength(2);
    expect(tidy.geometry.edges[id].points[0].y).toBe(
      tidy.geometry.nodes.read.y + heights[0] / 2,
    );
  }
  expect(tidy.state.nodes.check.h).toBe(heights[0]);
  expect(tidy.geometry.issues).toEqual([]);
  expect(tidy.history).toBe(0);
  writeFileSync(path, await page.evaluate(() => window.museDiagram.saveHTML()));
  await open(page, path);
  expect((await state(page)).state).toEqual(tidy.state);
  expect((await state(page)).geometry).toEqual(tidy.geometry);
  // Editing never re-tidies; a node dragged off the line is reported instead.
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.change(() => d.move(["check"], 0, 18));
  });
  expect((await state(page)).geometry.issues.map((i) => i.code).sort()).toEqual(
    ["geometry/misaligned", "geometry/misaligned"],
  );

  const decorated = join(work, "tidy-decorated.html");
  writeFileSync(
    decorated,
    readFileSync("tests/fixtures/tidy.html", "utf8").replace(
      '<div class="row">',
      '<p style="position:absolute;left:4px;top:300px;margin:0">01</p><div class="row">',
    ),
  );
  execFileSync("python3", [script, decorated, "--output", decorated]);
  await open(page, decorated);
  const kept = await state(page);
  expect(kept.state.nodes).toEqual({});
  expect(kept.geometry.issues.map((i) => i.code)).toEqual([
    "geometry/uneven-peers",
  ]);
});

test("tidy widens column peers along their shared edge and re-measures reflowed text", async ({
  page,
}) => {
  const html = (
    layout,
  ) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial,sans-serif}
.step{position:absolute;left:40px;padding:12px;border:1px solid #567;background:#fff}
</style></head><body><div data-diagram style="width:600px;height:700px;position:relative;background:#eef">
<main data-diagram-region="body" style="position:absolute;inset:0">
<div class="step" data-diagram-node="a" style="top:40px;width:320px">第一步：读取全部输入</div>
<div class="step" data-diagram-node="b" style="top:200px;width:140px">第二步：逐项检查路径倍率与文字</div>
<div class="step" data-diagram-node="c" style="top:420px;width:320px">第三步：全部通过后写出</div>
</main></div><script type="application/json" id="diagram-config">${JSON.stringify(
    {
      version: 1,
      portDistribution: "spread",
      layout,
      edges: [
        { id: "ab", from: "a", to: "b" },
        { id: "bc", from: "b", to: "c" },
      ],
    },
  )}</script></body></html>`;
  const geometry = async (layout) => {
    const path = join(work, `column-${layout}.html`);
    writeFileSync(path, html(layout));
    execFileSync("python3", [script, path, "--output", path]);
    await open(page, path);
    return (await state(page)).geometry;
  };
  const authored = await geometry("authored");
  expect(authored.issues.map((i) => i.code)).toContain("geometry/uneven-peers");
  const tidy = await geometry("tidy");
  expect(tidy.issues).toEqual([]);
  for (const id of ["a", "b", "c"]) {
    expect(tidy.nodes[id].x).toBe(authored.nodes.a.x);
    expect(tidy.nodes[id].w).toBe(authored.nodes.a.w);
  }
  // The text no longer wraps as often, so the box shrinks to its content.
  expect(tidy.nodes.b.h).toBeLessThan(authored.nodes.b.h);
  expect(tidy.edges.ab.points).toHaveLength(2);
});

test("tidy evens a workflow column, treats color variants as one role, lines up authored ports and keeps the footer clear", async ({
  page,
}) => {
  // Tops at a fixed pitch with heights that follow the text: uneven gaps.
  const html = (
    layout,
  ) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial,sans-serif}
.step{position:absolute;padding:12px;border:1px solid #567;border-radius:8px;background:#fff}
.blue{background:#eaf0fb}.amber{background:#fff4dc}
footer{position:absolute;left:40px;width:560px;border-top:1px solid #99a;padding-top:8px}
</style></head><body><div data-diagram style="width:640px;height:540px;position:relative;background:#eef">
<main data-diagram-region="body" style="position:absolute;inset:0">
<div class="step blue" data-diagram-node="p" style="left:40px;top:40px;width:300px">提出方案<br>拆分任务</div>
<div class="step" data-diagram-node="r" style="left:420px;top:45px;width:180px">需求来源</div>
<div class="step amber" data-diagram-node="g" style="left:40px;top:150px;width:300px">计划审批</div>
<div class="step blue" data-diagram-node="v" style="left:40px;top:260px;width:300px">全局验收<br>逐项核对</div>
<div class="step" data-diagram-node="a" style="left:40px;top:370px;width:300px">归档</div>
<div class="step blue" data-diagram-node="b" style="left:420px;top:370px;width:180px">归档记录<br>写入索引</div>
</main><footer data-diagram-region="footer" style="top:470px">来源：示例流程</footer></div>
<script type="application/json" id="diagram-config">${JSON.stringify({
    version: 1,
    portDistribution: "spread",
    layout,
    gap: 40,
    edges: [
      { id: "pg", from: "p", to: "g" },
      { id: "gv", from: "g", to: "v" },
      { id: "va", from: "v", to: "a" },
      { id: "ab", from: "a", to: "b" },
      {
        id: "pr",
        from: "p",
        to: "r",
        fromPort: { side: "right", at: 0.3 },
        toPort: { side: "left", at: 0.3 },
      },
    ],
  })}</script></body></html>`;
  const inspect = async (layout) => {
    const path = join(work, `workflow-${layout}.html`);
    writeFileSync(path, html(layout));
    execFileSync("python3", [script, path, "--output", path]);
    await open(page, path);
    return {
      ...(await state(page)).geometry,
      // The canvas may be scaled for reading; the CSS position is not.
      footer: await page.evaluate(() =>
        parseFloat(
          document.querySelector('[data-diagram-region="footer"]').style.top,
        ),
      ),
    };
  };
  const gaps = ({ nodes }) =>
    ["p", "g", "v", "a"].slice(1).map((id, i, ids) => {
      const above = nodes[["p", "g", "v"][i]];
      return Math.round(nodes[id].y - (above.y + above.h));
    });
  const authored = await inspect("authored");
  expect(authored.issues.map((i) => `${i.code} ${i.id}`).sort()).toEqual([
    "geometry/misaligned pr",
    "geometry/uneven-gaps p",
    "geometry/uneven-peers a",
  ]);
  const tidy = await inspect("tidy");
  expect(tidy.issues).toEqual([]);
  expect(new Set(gaps(tidy)).size).toBe(1);
  expect(tidy.nodes.a.h).toBe(tidy.nodes.b.h);
  expect(tidy.edges.pr.points).toHaveLength(2);
  // The footer keeps the configured gap below the lowest node, not 24 px.
  for (const g of [authored, tidy])
    expect(g.footer).toBeCloseTo(g.nodes.b.y + g.nodes.b.h + 40, 1);
});

test("tidy keeps SVG and hand-routed node sizes, carries authored bends with both ends and keeps the footer 24 px clear", async ({
  page,
}) => {
  const make = async (name, html, config) => {
    const path = join(work, `${name}.html`);
    writeFileSync(
      path,
      `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial,sans-serif}
.step{position:absolute;padding:12px;border:1px solid #567;background:#fff;width:140px}
footer{position:absolute;left:20px;width:560px}
</style></head><body>${html}<script type="application/json" id="diagram-config">${JSON.stringify(
        { version: 1, portDistribution: "spread", layout: "tidy", ...config },
      )}</script></body></html>`,
    );
    execFileSync("python3", [script, path, "--output", path]);
    await open(page, path);
    return state(page);
  };
  // SVG text does not reflow, so a narrower step in the column stays narrow.
  const frame = (id, x, y, w, label) =>
    `<g class="step" data-diagram-node="${id}"><rect data-diagram-frame x="${x}" y="${y}" width="${w}" height="80" fill="#fff" stroke="#567"/><g data-diagram-content><text x="250" y="${y + 45}" text-anchor="middle">${label}</text></g></g>`;
  const svg = await make(
    "tidy-svg",
    `<div data-diagram style="width:600px;height:520px;position:relative"><svg data-diagram-surface width="600" height="520" viewBox="0 0 600 520" xmlns="http://www.w3.org/2000/svg"><g data-diagram-region="body">${frame("a", 100, 40, 300, "读取")}${frame("b", 170, 200, 160, "检查")}${frame("c", 100, 360, 300, "写出")}</g></svg></div>`,
    {
      edges: [
        { id: "ab", from: "a", to: "b" },
        { id: "bc", from: "b", to: "c" },
      ],
    },
  );
  expect(svg.state.nodes.b).toBeUndefined();
  expect(svg.geometry.issues).toEqual([]);
  // A hand-routed loop keeps its node's size, so its bends stay outside it.
  const loop = await make(
    "tidy-loop",
    `<div data-diagram style="width:600px;height:520px;position:relative;background:#eef"><main data-diagram-region="body" style="position:absolute;inset:0">
<div class="step" data-diagram-node="a" style="left:40px;top:40px;width:300px">读取</div>
<div class="step" data-diagram-node="b" style="left:190px;top:200px;width:150px">检查</div>
<div class="step" data-diagram-node="c" style="left:40px;top:360px;width:300px">写出</div>
</main></div>`,
    {
      edges: [
        { id: "ab", from: "a", to: "b" },
        { id: "bc", from: "b", to: "c" },
        {
          id: "again",
          from: "b",
          to: "b",
          kind: "loop",
          fromPort: { side: "right" },
          toPort: { side: "bottom" },
          points: [
            { x: 370, y: 225 },
            { x: 370, y: 280 },
            { x: 265, y: 280 },
          ],
        },
      ],
    },
  );
  expect(loop.state.nodes.b).toBeUndefined();
  // The uneven width is still reported for the author to decide.
  expect(loop.geometry.issues.map((i) => i.code)).toEqual([
    "geometry/uneven-peers",
  ]);
  // Lowering a pushes the lower nodes down; the pinned route goes with them.
  const bends = [
    { x: 260, y: 225 },
    { x: 260, y: 325 },
  ];
  const html = await make(
    "tidy-bends",
    `<div data-diagram style="width:600px;height:420px;position:relative;background:#eef"><main data-diagram-region="body" style="position:absolute;inset:0">
<div class="step" data-diagram-node="a" style="left:40px;top:40px">甲</div>
<div class="step" data-diagram-node="b" style="left:300px;top:50px">乙</div>
<div class="step" data-diagram-node="c" style="left:40px;top:200px">丙</div>
<div class="step" data-diagram-node="d" style="left:340px;top:300px">丁</div>
</main><footer data-diagram-region="footer" style="top:370px">来源</footer></div>`,
    {
      gap: 8,
      edges: [
        { id: "ab", from: "a", to: "b" },
        {
          id: "cd",
          from: "c",
          to: "d",
          fromPort: { side: "right" },
          toPort: { side: "left" },
          points: bends,
        },
      ],
    },
  );
  expect(html.state.nodes.c.dy).toBe(10);
  expect(html.state.nodes.d.dy).toBe(10);
  expect(html.state.edges.cd.points).toEqual(
    bends.map((p) => ({ x: p.x, y: p.y + 10 })),
  );
  expect(html.geometry.edges.cd.points).toHaveLength(4);
  const { d } = html.geometry.nodes;
  expect(
    await page.evaluate(() =>
      parseFloat(
        document.querySelector('[data-diagram-region="footer"]').style.top,
      ),
    ),
  ).toBeCloseTo(d.y + d.h + 24, 1);
});

for (const name of ["dataflow", "async-roundtrip"])
  test(`new ${name} example remains editable and semantically complete`, async ({
    page,
  }) => {
    await open(
      page,
      `plugins/musekit/skills/diagram-design/references/examples/${name}.html`,
    );
    const s = await state(page);
    expect(s.geometry.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(Object.keys(s.geometry.edges)).toHaveLength(
      name === "dataflow" ? 7 : 12,
    );
    await page.getByRole("button", { name: "查找节点", exact: true }).click();
    if (name === "async-roundtrip") {
      await page.getByRole("searchbox", { name: "搜索节点" }).fill("处理器");
      await page.locator(".reader-results button").click();
      await expect(page.locator(".reader-detail")).toContainText("自循环 · 1");
    }
    await page.getByRole("button", { name: "编辑布局", exact: true }).click();
    await expect(page.getByRole("region", { name: "布局属性" })).toBeVisible();
  });

test("long reader names remain contained, and moving a shared group preserves spread ports", async ({
  page,
}) => {
  const long = "审批节点的完整说明需要保持可阅读并允许分行".repeat(6);
  let source = readFileSync("tests/fixtures/reader-quality.html", "utf8")
    .replace(/"version"\s*:\s*1/, '"version":1,"portDistribution":"spread"')
    .replace('data-diagram-title="审批"', `data-diagram-title="${long}"`);
  source = source
    .replace(
      /(<main[^>]*>)/,
      '$1<section data-diagram-group="shared" style="position:absolute;inset:0">',
    )
    .replace("</main>", "</section></main>");
  const path = join(work, "group-reader.html");
  writeFileSync(path, source);
  execFileSync("python3", [script, path, "--output", path]);
  await open(page, path);
  await page.getByRole("button", { name: "查找节点", exact: true }).click();
  await page.getByRole("searchbox", { name: "搜索节点" }).fill(long);
  await page.locator(".reader-results button").click();
  await expect(page.locator(".reader-detail")).toContainText(long);
  expect(
    await page
      .locator(".reader")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.getByRole("button", { name: "编辑布局", exact: true }).click();
  const before = await state(page);
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.change(() => d.move(["shared"], 20, 30));
  });
  const moved = await state(page);
  for (const [id, edge] of Object.entries(before.geometry.edges)) {
    const after = moved.geometry.edges[id];
    expect(after.fromPort).toEqual(edge.fromPort);
    expect(after.toPort).toEqual(edge.toPort);
    expect(after.points[0].x - edge.points[0].x).toBe(20);
    expect(after.points[0].y - edge.points[0].y).toBe(30);
  }
  await page.evaluate(() => window.museDiagram.undo());
  expect((await state(page)).geometry).toEqual(before.geometry);
});

test("transparent and hidden group borders do not produce readability warnings", async ({
  page,
}) => {
  const source = readFileSync(
    "tests/fixtures/reader-quality.html",
    "utf8",
  ).replace(
    /(<main[^>]*>)/,
    '$1<section data-diagram-group="frame" style="position:absolute;left:220px;top:247px;width:250px;height:100px;border-top:2px solid rgb(20,30,40)"></section>',
  );
  const path = join(work, "border-visible.html");
  writeFileSync(path, source);
  execFileSync("python3", [script, path, "--output", path]);
  await open(page, path);
  const warnings = async () =>
    (await state(page)).geometry.issues.filter((i) => i.type === "border-run");
  expect((await warnings()).length).toBeGreaterThan(0);
  await page.evaluate(() => {
    document.querySelector(
      '[data-diagram-group="frame"]',
    ).style.borderTopColor = "rgba(20,30,40,0)";
    window.museDiagram.refresh();
  });
  expect(await warnings()).toEqual([]);
  await page.evaluate(() => {
    const e = document.querySelector('[data-diagram-group="frame"]');
    e.style.borderTopColor = "rgb(20,30,40)";
    e.style.opacity = "0";
    window.museDiagram.refresh();
  });
  expect(await warnings()).toEqual([]);
});
