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
