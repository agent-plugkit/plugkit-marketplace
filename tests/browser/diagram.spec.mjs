import { test, expect } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

let work, file, starter;
test.beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "musekit-diagram-e2e-"));
  file = join(work, "fixture.html");
  starter = join(work, "starter.html");
  execFileSync("python3", [
    "plugins/musekit/skills/diagram-design/scripts/prepare_diagram.py",
    "tests/fixtures/diagram.html",
    "--output",
    file,
  ]);
  execFileSync("python3", [
    "plugins/musekit/skills/diagram-design/scripts/prepare_diagram.py",
    "plugins/musekit/skills/diagram-design/assets/starter.html",
    "--output",
    starter,
  ]);
  for (const name of ["sequence", "scaled-svg"])
    execFileSync("python3", [
      "plugins/musekit/skills/diagram-design/scripts/prepare_diagram.py",
      `tests/fixtures/${name}.html`,
      "--output",
      join(work, `${name}.html`),
    ]);
  const names = join(work, "property-names.html");
  writeFileSync(
    names,
    readFileSync("tests/fixtures/diagram.html", "utf8")
      .replaceAll('"A"', '"constructor"')
      .replaceAll('"e1"', '"toString"'),
  );
  execFileSync("python3", [
    "plugins/musekit/skills/diagram-design/scripts/prepare_diagram.py",
    names,
    "--output",
    names,
  ]);
});
test.afterAll(() => rmSync(work, { recursive: true, force: true }));
async function open(page, path = file) {
  await page.goto(pathToFileURL(path).href);
  await expect(page.locator("[data-diagram]")).toHaveAttribute(
    "data-diagram-ready",
    "true",
  );
  await page.evaluate(() => window.museDiagram.ready);
}
const geo = (page) => page.evaluate(() => window.museDiagram.getGeometry());

function variant(name, source, transform) {
  const path = join(work, `${name}.html`);
  writeFileSync(path, transform(readFileSync(`tests/fixtures/${source}.html`, "utf8")));
  execFileSync("python3", [
    "plugins/musekit/skills/diagram-design/scripts/prepare_diagram.py",
    path, "--output", path,
  ]);
  return path;
}

test("property fields use current values across consecutive edits without resetting neighboring fields", async ({ page }) => {
  await open(page);
  await edit(page);
  await page.getByRole("button", { name: "A", exact: true }).click();
  for (const [label, key] of [["水平位移", "dx"], ["垂直位移", "dy"]]) {
    const field = page.getByRole("spinbutton", { name: label, exact: true });
    for (const value of [10, 20]) {
      await field.fill(String(value));
      await field.press("Enter");
      expect(await page.evaluate(k => window.museDiagram.getState().nodes.A[k], key)).toBe(value);
      await expect(field).toHaveValue(String(value));
    }
  }
  const width = page.getByRole("spinbutton", { name: "宽度", exact: true }),
    height = page.getByRole("spinbutton", { name: "高度", exact: true });
  await width.fill("200");
  await width.press("Enter");
  const wrapped = (await geo(page)).nodes.A;
  await expect(height).toHaveValue(String(Math.round(wrapped.h)));
  await height.fill(String(Math.ceil(wrapped.h) + 25));
  await height.press("Enter");
  expect((await geo(page)).nodes.A.w).toBeCloseTo(200, 1);
  await width.fill("210");
  await width.press("Enter");
  expect((await geo(page)).nodes.A.h).toBeCloseTo(Math.ceil(wrapped.h) + 25, 1);

  await page.getByRole("button", { name: "连线 e2", exact: true }).click();
  for (const [sideLabel, ratioLabel, key] of [
    ["起点端口", "起点比例 %", "fromPort"],
    ["终点端口", "终点比例 %", "toPort"],
  ]) {
    const side = page.getByRole("combobox", { name: sideLabel, exact: true }),
      ratio = page.getByRole("spinbutton", { name: ratioLabel, exact: true });
    await side.selectOption("right");
    await ratio.fill("25");
    await ratio.press("Enter");
    expect(await page.evaluate(k => window.museDiagram.getState().edges.e2[k], key))
      .toEqual({ side: "right", at: 0.25 });
    await side.selectOption("left");
    expect(await page.evaluate(k => window.museDiagram.getState().edges.e2[k], key))
      .toEqual({ side: "left", at: 0.25 });
    await expect(ratio).toHaveValue("25");
  }
  await page.getByRole("button", { name: "B", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "水平位移", exact: true })).toHaveValue("0");
  const implicit = variant("implicit-ports", "diagram", text => text.replace(
    '"to": "C",\n            "fromPort": { "side": "bottom" },\n            "toPort": { "side": "top" }',
    '"to": "C"',
  ));
  await open(page, implicit);
  await edit(page);
  await page.getByRole("button", { name: "连线 e2", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "起点端口", exact: true })).toHaveValue("bottom");
  await page.getByRole("spinbutton", { name: "起点比例 %", exact: true }).fill("25");
  await page.getByRole("spinbutton", { name: "起点比例 %", exact: true }).press("Enter");
  const g = await geo(page);
  expect(g.edges.e2.points[0].y).toBeCloseTo(g.nodes.B.y + g.nodes.B.h, 1);
  expect(g.edges.e2.points[0].x).toBeCloseTo(g.nodes.B.x + g.nodes.B.w * 0.25, 1);
});

test("authored pins follow shared nested groups once and keep their override through history and reopening", async ({ page }) => {
  const pins = [{ x: 395, y: 380 }, { x: 395, y: 320 }],
    path = variant("group-pins", "diagram", text => text.replace(
      '{ "id": "e1", "from": "A", "to": "B" }',
      JSON.stringify({ id: "e1", from: "A", to: "B", points: pins }),
    ));
  await open(page, path);
  await edit(page);
  const initial = await geo(page);
  await page.getByRole("button", { name: "▣ outer", exact: true }).click();
  await page.getByRole("button", { name: "▣ nested", exact: true }).click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "A", exact: true }).click({ modifiers: ["Shift"] });
  await page.keyboard.press("Shift+ArrowRight");
  const movedPins = pins.map(p => ({ x: p.x + 10, y: p.y }));
  expect(await page.evaluate(() => window.museDiagram.getState().edges.e1.points)).toEqual(movedPins);
  expect(await page.evaluate(() => window.museDiagram.config.edges[0].points)).toEqual(pins);
  const moved = await geo(page);
  for (const id of ["outer", "nested", "A", "B", "C"])
    expect(moved.nodes[id].x - initial.nodes[id].x).toBeCloseTo(10, 1);
  for (const index of [0, moved.edges.e1.points.length - 1])
    expect(moved.edges.e1.points[index].x - initial.edges.e1.points[index].x).toBeCloseTo(10, 1);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect(await page.evaluate(() => window.museDiagram.getState().edges.e1?.points)).toBeUndefined();
  await page.getByRole("button", { name: "重做", exact: true }).click();
  const saved = join(work, "group-pins-saved.html");
  writeFileSync(saved, await page.evaluate(() => window.museDiagram.saveHTML()));
  await open(page, saved);
  expect(await page.evaluate(() => window.museDiagram.getState().edges.e1.points)).toEqual(movedPins);
  await edit(page);
  await page.getByRole("button", { name: "▣ outer", exact: true }).click();
  await page.keyboard.press("Shift+ArrowDown");
  expect(await page.evaluate(() => window.museDiagram.getState().edges.e1.points))
    .toEqual(movedPins.map(p => ({ x: p.x, y: p.y + 10 })));
  await page.getByRole("button", { name: "连线 e1", exact: true }).click();
  await page.getByRole("button", { name: "恢复自动走线", exact: true }).click();
  await page.getByRole("button", { name: "▣ outer", exact: true }).click();
  await page.keyboard.press("Shift+ArrowRight");
  expect(await page.evaluate(() => window.museDiagram.getState().edges.e1.points)).toEqual([]);
});

for (const grouped of [true, false])
  test(`sequence reverse pointer drag preserves row spacing${grouped ? " and branch captions" : " outside groups"}`, async ({ page }) => {
    const path = grouped ? join(work, "sequence.html") : variant(
      "ungrouped-sequence", "sequence", text => text.replace('data-diagram-group="retry"', ""),
    );
    await open(page, path);
    await edit(page);
    await page.getByRole("button", { name: "↔ r2", exact: true }).click();
    const initial = await geo(page),
      r = await page.locator('[data-diagram-row="r2"]').boundingBox(),
      scale = await page.evaluate(() => window.museDiagram.scale()),
      x = r.x + r.width / 2, y = r.y + r.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (const delta of [70, grouped ? -170 : -240, 160, -240]) {
      await page.mouse.move(x, y + delta * scale.y, { steps: 3 });
      const g = await geo(page);
      expect(g.nodes.r2.y - g.nodes.r1.y).toBeGreaterThanOrEqual(g.edges.self.label.h + 12 - 0.1);
      expect(g.nodes.r3.y - g.nodes.r2.y).toBeGreaterThanOrEqual(g.edges.return.label.h + 32 - 0.1);
      if (grouped)
        expect(g.nodes.r2.y - 12)
          .toBeGreaterThanOrEqual(g.nodes.caption.y + g.nodes.caption.h - 0.1);
      expect(g.edges.self.points).toHaveLength(4);
    }
    await page.mouse.up();
    const moved = await geo(page);
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    expect((await geo(page)).nodes.r2.y).toBeCloseTo(initial.nodes.r2.y, 1);
    await expect(page.getByRole("button", { name: "撤销", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "重做", exact: true }).click();
    expect((await geo(page)).nodes.r2.y).toBeCloseTo(moved.nodes.r2.y, 1);
    const saved = join(work, `reverse-row-${grouped}.html`);
    writeFileSync(saved, await page.evaluate(() => window.museDiagram.saveHTML()));
    await open(page, saved);
    expect((await geo(page)).nodes.r2.y).toBeCloseTo(moved.nodes.r2.y, 1);
  });

test("SVG labels inside scaled groups move once and retain label offsets across body shifts and reopening", async ({ page }) => {
  const path = variant("nested-svg-label", "scaled-svg", text => text
    .replace('          </g>\n          <g data-diagram-label="edge1">',
      '          <g data-diagram-label="edge1" transform="translate(4 6) scale(0.9 1.1)">')
    .replace('<rect x="800" y="650" width="150" height="44"', '<rect x="350" y="150" width="150" height="44"')
    .replace('<text x="800" y="680">', '<text x="350" y="180">')
    .replace('        </g>\n      </svg>', '          </g>\n        </g>\n      </svg>'));
  await open(page, path);
  await edit(page);
  const initial = await geo(page);
  await page.getByRole("button", { name: "▣ outer", exact: true }).click();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const moved = await geo(page);
  for (const axis of ["x", "y"])
    expect(moved.edges.edge1.label[axis] - initial.edges.edge1.label[axis]).toBeCloseTo(10, 1);
  for (const axis of ["w", "h"])
    expect(moved.edges.edge1.label[axis]).toBeCloseTo(initial.edges.edge1.label[axis], 1);
  await page.getByRole("button", { name: "连线 edge1", exact: true }).click();
  await page.getByRole("spinbutton", { name: "标签左右偏移", exact: true }).fill("12");
  await page.getByRole("spinbutton", { name: "标签左右偏移", exact: true }).press("Enter");
  expect((await geo(page)).edges.edge1.label.x - moved.edges.edge1.label.x).toBeCloseTo(12, 1);
  await page.getByRole("button", { name: "整体下移 24px", exact: true }).click();
  expect((await geo(page)).edges.edge1.label.y - moved.edges.edge1.label.y).toBeCloseTo(24, 1);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect((await geo(page)).edges.edge1.label.y).toBeCloseTo(moved.edges.edge1.label.y, 1);
  await page.getByRole("button", { name: "重做", exact: true }).click();
  const savedGeometry = await geo(page), saved = join(work, "nested-svg-saved.html");
  for (let i = 0; i < 2; i++) {
    writeFileSync(saved, await page.evaluate(() => window.museDiagram.saveHTML()));
    await open(page, saved);
    for (const axis of ["x", "y", "w", "h"])
      expect((await geo(page)).edges.edge1.label[axis]).toBeCloseTo(savedGeometry.edges.edge1.label[axis], 1);
  }
});

for (const pseudo of ["before", "after"])
  for (const property of ["background-image", "content"])
    test(`PNG export validates ${pseudo} ${property} images and reports failures without downloading`, async ({ page, context }) => {
      await context.setOffline(true);
      await open(page);
      const valid = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>').toString("base64")}`;
      const style = await page.addStyleTag({ content:
        `.node::${pseudo}{content:"";position:absolute;left:5px;top:5px;display:block;width:16px;height:16px;${property}:url("${valid}")}`,
      });
      const pixel = await page.evaluate(async () => {
        const d = window.museDiagram, b = d.getGeometry().nodes.B,
          bitmap = await createImageBitmap(await d.exportPNG(1)),
          canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        const rgba = [...ctx.getImageData(Math.round(b.x + 10), Math.round(b.y + 10), 1, 1).data];
        bitmap.close();
        return rgba;
      });
      expect(pixel).toEqual([255, 0, 0, 255]);
      await style.evaluate(el => { el.textContent = el.textContent.replace(/data:image\/svg\+xml;base64,[^"\)]+/, "data:image/png;base64,broken"); });
      const downloads = [];
      page.on("download", download => downloads.push(download));
      await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("嵌入图片资源损坏");
      expect(downloads).toEqual([]);
      await style.evaluate(el => { el.textContent += '.node::before,.node::after{display:none}'; });
      expect(await page.evaluate(async () => (await window.museDiagram.exportPNG(1)).size)).toBeGreaterThan(100);
    });

test("straight edges expose ports and labels but no ineffective bend controls", async ({ page }) => {
  const path = variant("straight-edge", "diagram", text => text.replace(
    '{ "id": "e1", "from": "A", "to": "B" }',
    '{ "id": "e1", "from": "A", "to": "B", "kind": "straight", "points": [{"x":395,"y":500}] }',
  ));
  await open(page, path);
  await edit(page);
  await page.getByRole("button", { name: "连线 e1", exact: true }).click();
  await expect(page.getByRole("button", { name: "增加折点", exact: true })).toHaveCount(0);
  await expect(page.locator("muse-diagram-editor").locator("[data-bend-number]")).toHaveCount(0);
  await page.getByRole("combobox", { name: "起点端口", exact: true }).selectOption("bottom");
  const before = await geo(page);
  expect(before.edges.e1.points).toHaveLength(2);
  expect(before.edges.e1.points[0].y).toBeCloseTo(before.nodes.A.y + before.nodes.A.h, 1);
  await page.getByRole("spinbutton", { name: "标签上下偏移", exact: true }).fill("10");
  await page.getByRole("spinbutton", { name: "标签上下偏移", exact: true }).press("Enter");
  expect((await geo(page)).edges.e1.label.y - before.edges.e1.label.y).toBeCloseTo(10, 1);
  await page.getByRole("button", { name: "A", exact: true }).click();
  await page.keyboard.press("Shift+ArrowRight");
  const moved = await geo(page);
  expect(moved.edges.e1.points[0].x - before.edges.e1.points[0].x).toBeCloseTo(10, 1);
  await page.getByRole("button", { name: "连线 retry", exact: true }).click();
  await expect(page.getByRole("button", { name: "增加折点", exact: true })).toBeVisible();
  await open(page, join(work, "sequence.html"));
  await edit(page);
  await page.getByRole("button", { name: "连线 self", exact: true }).click();
  await expect(page.getByRole("button", { name: "增加折点", exact: true })).toHaveCount(0);
  await expect(page.locator("muse-diagram-editor").locator("[data-bend-number]")).toHaveCount(0);
});

test("SVG label backgrounds hide their own wire in the exported PNG", async ({
  page,
}) => {
  await open(page, join(work, "scaled-svg.html"));
  const pixel = await page.evaluate(async () => {
    const d = window.museDiagram,
      g = d.getGeometry(),
      points = g.edges.edge1.points;
    const segment = points
      .slice(1)
      .map((b, i) => ({ a: points[i], b }))
      .find(
        ({ a, b }) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) > 100,
      );
    const label = g.edges.edge1.label,
      left = segment.a.x - 5,
      top = (segment.a.y + segment.b.y - label.h) / 2;
    d.change(() => {
      d.state.edges.edge1 = {
        label: { dx: left - label.x, dy: top - label.y },
      };
    });
    const bitmap = await createImageBitmap(await d.exportPNG(1));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
      ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const color = Array.from(
      ctx.getImageData(
        Math.round(segment.a.x),
        Math.round(top + label.h - 4),
        1,
        1,
      ).data,
    );
    bitmap.close();
    return color;
  });
  expect(pixel).toEqual([255, 255, 255, 255]);
});
async function edit(page) {
  await page.getByRole("button", { name: "编辑布局", exact: true }).click();
}

test("author inspection command exports the full canvas and checks saved HTML without changing its input", async () => {
  const before = readFileSync(file, "utf8");
  const output = join(work, "author-check");
  const result = spawnSync(process.execPath, [
    "plugins/musekit/skills/diagram-design/scripts/inspect_diagram.mjs",
    file, "--output", output, "--scale", "1",
  ], { encoding: "utf8", timeout: 20000 });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.passed).toBe(true);
  expect(report.checks.saveReopen).toBe(true);
  expect(report.png.width).toBe(report.canvas.width);
  expect(report.png.height).toBe(report.canvas.height);
  expect(readFileSync(file, "utf8")).toBe(before);
  expect(readFileSync(report.png.file).subarray(1, 4).toString()).toBe("PNG");
  expect(readFileSync(join(output, "fixture.reopened.html"), "utf8")).toContain('id="diagram-state"');
});

test("author inspection command reports overlapping objects as a failed check while retaining review artifacts", async () => {
  const overlap = join(work, "overlap.html");
  writeFileSync(overlap, readFileSync(file, "utf8").replace("left: 440px; top: 65px", "left: 60px; top: 65px"));
  const result = spawnSync(process.execPath, [
    "plugins/musekit/skills/diagram-design/scripts/inspect_diagram.mjs",
    overlap, "--output", join(work, "failed-check"),
  ], { encoding: "utf8", timeout: 20000 });
  expect(result.status, result.stderr || result.stdout).toBe(1);
  const report = JSON.parse(result.stdout);
  expect(report.passed).toBe(false);
  expect(report.checks.geometry).toBe(false);
  expect(report.issues.some(issue => issue.type === "overlap")).toBe(true);
  expect(readFileSync(report.report, "utf8")).toContain('"passed": false');
});

test("authored pins that double back are diagnosed and restoring automatic routing survives reopening", async ({ page }) => {
  const pinned = join(work, "authored-pins.html");
  writeFileSync(pinned, readFileSync(file, "utf8").replace(
    '{ "id": "e1", "from": "A", "to": "B" }',
    '{ "id": "e1", "from": "A", "to": "B", "points": [{"x":400,"y":430},{"x":400,"y":500},{"x":400,"y":460}] }',
  ));
  await open(page, pinned);
  expect((await geo(page)).issues.some(i => i.id === "e1" && i.type === "backtrack")).toBe(true);
  await edit(page);
  await page.getByRole("button", { name: "连线 e1", exact: true }).click();
  await page.getByRole("button", { name: "恢复自动走线", exact: true }).click();
  expect((await geo(page)).issues.filter(i => i.type === "backtrack")).toEqual([]);
  expect(await page.evaluate(() => window.museDiagram.getState().edges.e1.points)).toEqual([]);
  const saved = join(work, "authored-pins-saved.html");
  writeFileSync(saved, await page.evaluate(() => window.museDiagram.saveHTML()));
  await open(page, saved);
  expect((await geo(page)).issues.filter(i => i.type === "backtrack")).toEqual([]);
});

test("stable IDs that are JavaScript property names remain editable and serializable", async ({
  page,
}) => {
  await open(page, join(work, "property-names.html"));
  await edit(page);
  const before = await geo(page);
  await page.getByRole("button", { name: "constructor", exact: true }).click();
  await page.keyboard.press("Shift+ArrowRight");
  await page
    .getByRole("button", { name: "连线 toString", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "标签上下偏移", exact: true })
    .fill("4");
  await page
    .getByRole("spinbutton", { name: "标签上下偏移", exact: true })
    .blur();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存 HTML", exact: true }).click();
  const output = join(work, "property-names-saved.html");
  await (await pending).saveAs(output);
  await open(page, output);
  expect((await geo(page)).nodes.constructor.x).toBeCloseTo(
    before.nodes.constructor.x + 10,
    1,
  );
  expect(
    await page.evaluate(
      () => window.museDiagram.getState().edges.toString.label.dy,
    ),
  ).toBe(4);
});

test("flow-based actor headers remain clickable and self-call endpoints follow their actor", async ({
  page,
}) => {
  await open(page, join(work, "sequence.html"));
  await edit(page);
  const before = await geo(page),
    r = await page.locator('[data-diagram-node="B"]').boundingBox();
  await page.mouse.move(r.x + 30, r.y + 20);
  await page.mouse.down();
  await page.mouse.move(r.x + 45, r.y + 25, { steps: 4 });
  await page.mouse.up();
  const after = await geo(page),
    dx = after.nodes.B.x - before.nodes.B.x;
  expect(dx).toBeGreaterThan(10);
  expect(after.nodes.B.y).toBeCloseTo(before.nodes.B.y, 1);
  expect(after.edges.self.points).toHaveLength(4);
  for (const end of [0, 3])
    expect(
      after.edges.self.points[end].x - before.edges.self.points[end].x,
    ).toBeCloseTo(dx, 1);
  await page.getByRole("button", { name: "↔ r2", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "垂直位移", exact: true })
    .fill("1000");
  await page.getByRole("spinbutton", { name: "垂直位移", exact: true }).blur();
  const moved = await geo(page);
  expect(moved.edges.self.points[3].y).toBeLessThan(
    moved.edges.return.points[0].y,
  );
  expect(
    moved.issues.filter((i) =>
      ["overflow", "label-line", "header"].includes(i.type),
    ),
  ).toEqual([]);
});

test("nested SVG transforms preserve initial geometry and measure resize in canvas pixels", async ({
  page,
}) => {
  await open(page, join(work, "scaled-svg.html"));
  await edit(page);
  const initial = await geo(page);
  expect(initial.nodes.A.w).toBeCloseTo(240, 1);
  await page.getByRole("button", { name: "▣ outer", exact: true }).click();
  await page.keyboard.press("Shift+ArrowRight");
  const moved = await geo(page);
  for (const id of ["A", "B", "inner"])
    expect(moved.nodes[id].x - initial.nodes[id].x).toBeCloseTo(10, 1);
  const text = await page.locator('[data-diagram-node="A"] text').boundingBox();
  await page.getByRole("button", { name: "A", exact: true }).click();
  await page.getByRole("spinbutton", { name: "宽度", exact: true }).fill("300");
  await page.getByRole("spinbutton", { name: "宽度", exact: true }).blur();
  const resized = await geo(page);
  expect(resized.nodes.A.w).toBeCloseTo(300, 1);
  expect(
    (await page.locator('[data-diagram-node="A"] text').boundingBox()).width,
  ).toBeCloseTo(text.width, 1);
  expect(resized.edges.edge1.points[0].x - resized.nodes.A.x).toBeCloseTo(
    resized.nodes.A.w,
    1,
  );
  await page.getByRole("button", { name: "放大", exact: true }).click();
  await page.getByRole("button", { name: "放大", exact: true }).click();
  const screen = await page.locator('[data-diagram-node="A"]').boundingBox();
  await page.mouse.move(screen.x + 30, screen.y + 30);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(screen.x - 70, screen.y - 30, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  expect((await geo(page)).nodes.A.x).toBeCloseTo(resized.nodes.A.x, 1);
});

test("offline load, measured content, pointer drag at zoom, keyboard, undo and redo", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.setOffline(true);
  await open(page);
  await edit(page);
  const before = await geo(page),
    node = page.locator('[data-diagram-node="A"]');
  const r = await node.boundingBox();
  await page.mouse.move(r.x + 30, r.y + 20);
  await page.mouse.down();
  await page.mouse.move(r.x + 55, r.y + 50, { steps: 5 });
  await page.mouse.up();
  const moved = await geo(page);
  expect(moved.nodes.A.x).toBeGreaterThan(before.nodes.A.x + 20);
  expect(moved.nodes.A.y).toBeGreaterThan(before.nodes.A.y + 20);
  const edge = moved.edges.e1;
  expect(
    Math.abs(edge.points[0].x - (moved.nodes.A.x + moved.nodes.A.w)),
  ).toBeLessThan(1);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect((await geo(page)).nodes.A.x).toBeCloseTo(before.nodes.A.x, 1);
  await page.getByRole("button", { name: "重做", exact: true }).click();
  expect((await geo(page)).nodes.A.x).toBeCloseTo(moved.nodes.A.x, 1);
  await page.keyboard.press("Shift+ArrowRight");
  expect((await geo(page)).nodes.A.x).toBeCloseTo(moved.nodes.A.x + 10, 1);
  expect((await geo(page)).issues.filter((x) => x.type === "overflow")).toEqual(
    [],
  );
  expect(errors).toEqual([]);
});
test("nested group moves children once, body shift includes edges, resize respects content", async ({
  page,
}) => {
  await open(page);
  await edit(page);
  const start = await geo(page);
  await page.getByRole("button", { name: "▣ outer", exact: true }).click();
  await page.keyboard.press("Shift+ArrowDown");
  const moved = await geo(page);
  for (const id of ["outer", "nested", "A", "B", "C"])
    expect(moved.nodes[id].y - start.nodes[id].y).toBeCloseTo(10, 1);
  expect(moved.nodes.D.y).toBeCloseTo(start.nodes.D.y, 1);
  await page.getByRole("button", { name: "整体下移 24px" }).click();
  const body = await geo(page);
  for (const id of ["A", "B", "C", "D"])
    expect(body.nodes[id].y - moved.nodes[id].y).toBeCloseTo(24, 1);
  await page.getByRole("button", { name: "A", exact: true }).click();
  await page.getByRole("spinbutton", { name: "高度", exact: true }).fill("18");
  await page
    .getByRole("spinbutton", { name: "高度", exact: true })
    .press("Enter");
  await page.getByRole("spinbutton", { name: "高度", exact: true }).blur();
  expect((await geo(page)).nodes.A.h).toBeGreaterThan(100);
  expect((await geo(page)).issues.filter((x) => x.type === "overflow")).toEqual(
    [],
  );
});
test("label adjustment and ports survive three save/reopen cycles without accumulating transforms", async ({
  page,
}) => {
  await open(page);
  await edit(page);
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.change(() => {
      d.move(["outer"], 35, 20);
      d.state.edges.e1 = {
        label: { dx: 18, dy: 25 },
        fromPort: { side: "bottom", at: 0.7 },
      };
    });
  });
  const baseline = await geo(page);
  const state = await page.evaluate(() => window.museDiagram.getState());
  for (let i = 0; i < 3; i++) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "保存 HTML" }).click();
    const result = await download;
    const path = join(work, `saved-${i}.html`);
    await result.saveAs(path);
    const text = readFileSync(path, "utf8");
    expect(text).not.toContain("<muse-diagram-editor");
    expect(text).not.toContain("data-diagram-shell=");
    await open(page, path);
    expect(await page.evaluate(() => window.museDiagram.getState())).toEqual(
      state,
    );
    const current = await geo(page);
    for (const id of ["A", "B", "C", "D"]) {
      expect(current.nodes[id].x).toBeCloseTo(baseline.nodes[id].x, 1);
      expect(current.nodes[id].y).toBeCloseTo(baseline.nodes[id].y, 1);
    }
    for (const [id, edge] of Object.entries(baseline.edges)) {
      if (edge.label)
        for (const axis of ["x", "y", "w", "h"])
          expect(current.edges[id].label[axis]).toBeCloseTo(
            edge.label[axis],
            1,
          );
    }
  }
});
test("full PNG download has the artboard dimensions at 1x and 2x with no editor UI", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await open(page);
  await edit(page);
  for (const ratio of [1, 2]) {
    await page
      .getByRole("combobox", { name: "PNG 导出倍率" })
      .selectOption(String(ratio));
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出 PNG" }).click();
    const download = await pending;
    const out = join(work, `export-${ratio}.png`);
    await download.saveAs(out);
    const png = readFileSync(out);
    const size = await page
      .locator("[data-diagram]")
      .evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
    expect(png.readUInt32BE(16)).toBe(size.w * ratio);
    expect(png.readUInt32BE(20)).toBe(size.h * ratio);
  }
});
for (const name of ["architecture", "decision", "sequence", "state"])
  test(`bundled ${name} example opens and supports editing`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(
      page,
      resolve(
        `plugins/musekit/skills/diagram-design/references/examples/${name}.html`,
      ),
    );
    await edit(page);
    await page.getByRole("button", { name: "整体下移 24px" }).click();
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    expect(errors).toEqual([]);
    expect((await geo(page)).issues).toEqual([]);
    if (name === "sequence") {
      const before = await geo(page);
      await page.getByRole("button", { name: "│ S", exact: true }).click();
      await page.keyboard.press("Shift+ArrowRight");
      const after = await geo(page);
      expect(
        after.edges.e3.points[0].x - before.edges.e3.points[0].x,
      ).toBeCloseTo(10, 1);
      await page.evaluate(() => {
        const d = window.museDiagram;
        d.change(() => d.move(["row3"], 0, 500));
      });
      const g = await geo(page);
      expect(g.nodes.row3.y).toBeLessThan(g.nodes.row4.y);
    }
  });

test("HTML starter measures multiline code labels and wraps content after width and font changes", async ({
  page,
}) => {
  await open(page, starter);
  const initial = await geo(page);
  expect(initial.edges.e1.label.h).toBeGreaterThan(35);
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.change(() => d.resize("A", 190, 30));
  });
  const narrow = await geo(page);
  expect(narrow.nodes.A.w).toBeLessThan(initial.nodes.A.w);
  expect(narrow.nodes.A.h).toBeGreaterThan(initial.nodes.A.h);
  await page.locator('[data-diagram-node="A"]').evaluate((el) => {
    el.style.fontFamily = "MissingFontForFallbackTest, monospace";
    el.style.fontSize = "25px";
  });
  await expect
    .poll(async () => (await geo(page)).nodes.A.h)
    .toBeGreaterThan(narrow.nodes.A.h);
  expect((await geo(page)).issues.filter((i) => i.type === "overflow")).toEqual(
    [],
  );
});

test("multiselect alignment, distribution and a pointer gesture each undo as one operation", async ({
  page,
}) => {
  await open(page);
  await edit(page);
  for (const [i, id] of ["A", "B", "D"].entries())
    await page
      .getByRole("button", { name: id, exact: true })
      .click({ modifiers: i ? ["Shift"] : [] });
  const initial = await geo(page);
  await page.getByRole("button", { name: "顶对齐", exact: true }).click();
  const aligned = await geo(page);
  expect(aligned.nodes.A.y).toBeCloseTo(aligned.nodes.B.y, 1);
  expect(aligned.nodes.A.y).toBeCloseTo(aligned.nodes.D.y, 1);
  await page.getByRole("button", { name: "水平等距", exact: true }).click();
  const g = await geo(page);
  expect(g.nodes.B.x - g.nodes.A.x - g.nodes.A.w).toBeCloseTo(
    g.nodes.D.x - g.nodes.B.x - g.nodes.B.w,
    1,
  );
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect((await geo(page)).nodes.B.x).toBeCloseTo(aligned.nodes.B.x, 1);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect((await geo(page)).nodes.D.y).toBeCloseTo(initial.nodes.D.y, 1);
});

test("label pointer drag, ports, manual bends and restore route use the visible controls", async ({
  page,
}) => {
  await open(page);
  await edit(page);
  const p = await page.evaluate(() => {
    const d = window.museDiagram,
      e = d.edgeGeometry.get("e1"),
      r = d.root.getBoundingClientRect(),
      s = d.scale(),
      segments = e.points
        .slice(1)
        .map((b, i) => ({ a: e.points[i], b }))
        .sort(
          (a, b) =>
            Math.hypot(b.a.x - b.b.x, b.a.y - b.b.y) -
            Math.hypot(a.a.x - a.b.x, a.a.y - a.b.y),
        ),
      { a, b } = segments[0];
    return {
      x: r.x + ((a.x + b.x) / 2) * s.x,
      y: r.y + ((a.y + b.y) / 2) * s.y,
    };
  });
  await page.mouse.click(p.x, p.y);
  await expect(page.getByRole("combobox", { name: "起点端口" })).toBeVisible();
  const label = page
      .locator("muse-diagram-editor")
      .locator('[data-hit="label:e1"]'),
    r = await label.boundingBox(),
    before = await geo(page);
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 10, r.y + r.height / 2 + 8, {
    steps: 5,
  });
  await page.mouse.up();
  expect((await geo(page)).edges.e1.label.y).toBeGreaterThan(
    before.edges.e1.label.y + 7,
  );
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect((await geo(page)).edges.e1.label.y).toBeCloseTo(
    before.edges.e1.label.y,
    1,
  );
  await page.getByRole("combobox", { name: "起点端口" }).selectOption("bottom");
  await page.getByRole("spinbutton", { name: "起点比例 %" }).fill("70");
  await page.getByRole("spinbutton", { name: "起点比例 %" }).blur();
  const port = await geo(page);
  expect(port.edges.e1.points[0].x).toBeCloseTo(
    port.nodes.A.x + port.nodes.A.w * 0.7,
    1,
  );
  expect(port.edges.e1.points[0].y).toBeCloseTo(
    port.nodes.A.y + port.nodes.A.h,
    1,
  );
  await page.getByRole("button", { name: "增加折点", exact: true }).click();
  expect(
    await page.evaluate(
      () => window.museDiagram.getState().edges.e1.points.length,
    ),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "恢复自动走线", exact: true }).click();
  expect(
    await page.evaluate(() => window.museDiagram.getState().edges.e1.points),
  ).toBeUndefined();
});

test("sequence branch movement preserves global order and branch captions", async ({
  page,
}) => {
  await open(
    page,
    resolve(
      "plugins/musekit/skills/diagram-design/references/examples/sequence.html",
    ),
  );
  const initial = await geo(page);
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.change(() => d.move(["empty"], 0, 1000));
  });
  const moved = await geo(page);
  expect(moved.nodes.row6.y).toBeLessThan(moved.nodes.row7.y);
  expect(
    moved.nodes["title-empty"].y - initial.nodes["title-empty"].y,
  ).toBeCloseTo(moved.nodes.row5.y - initial.nodes.row5.y, 1);
  await page.evaluate(() => window.museDiagram.undo());
  expect((await geo(page)).nodes.row5.y).toBeCloseTo(initial.nodes.row5.y, 1);
});

test("numbered bend deletion preserves other pins, supports keyboard history and survives reopening", async ({
  page, context,
}) => {
  await context.setOffline(true);
  const pins = [{ x: 400, y: 430 }, { x: 400, y: 500 }, { x: 430, y: 500 }];
  const authored = join(work, "numbered-bends.html");
  writeFileSync(authored, readFileSync(file, "utf8").replace(
    '{ "id": "e1", "from": "A", "to": "B" }',
    JSON.stringify({ id: "e1", from: "A", to: "B", points: pins }),
  ));
  await open(page, authored);
  await edit(page);
  await page.getByRole("button", { name: "整体下移 24px" }).click();
  await page.getByRole("button", { name: "连线 e1", exact: true }).click();
  const editor = page.locator("muse-diagram-editor");
  const numbers = editor.locator("[data-bend-number] text");
  await expect(numbers).toHaveText(["1", "2", "3"]);
  await expect(page.getByRole("button", { name: /^删除折点 / })).toHaveCount(3);
  await page.getByRole("button", { name: "定位折点 2", exact: true }).click();
  await expect(editor.locator('[data-bend-number="2"] circle')).toHaveAttribute("fill", "#2563eb");
  const before = await page.evaluate(() => ({
    state: window.museDiagram.getState(),
    history: window.museDiagram.history.length,
    config: structuredClone(window.museDiagram.config),
  }));
  const baseline = await geo(page);
  await page.getByRole("button", { name: "删除折点 2", exact: true }).click();
  await expect(numbers).toHaveText(["1", "2"]);
  const deleted = await page.evaluate(() => window.museDiagram.getState());
  expect(deleted.edges.e1.points).toEqual([pins[0], pins[2]]);
  expect(deleted.nodes).toEqual(before.state.nodes);
  expect(deleted.bodyOffset).toBe(before.state.bodyOffset);
  expect(await page.evaluate(() => window.museDiagram.history.length)).toBe(before.history + 1);
  expect(await page.evaluate(() => window.museDiagram.config)).toEqual(before.config);
  expect((await geo(page)).nodes).toEqual(baseline.nodes);
  await expect(page.getByRole("button", { name: "删除折点 2", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect(await page.evaluate(() => window.museDiagram.getState())).toEqual(before.state);
  await expect(numbers).toHaveText(["1", "2", "3"]);
  await page.getByRole("button", { name: "重做", exact: true }).click();
  expect(await page.evaluate(() => window.museDiagram.getState())).toEqual(deleted);
  const first = page.getByRole("button", { name: "删除折点 1", exact: true });
  await first.focus();
  await first.press("Enter");
  expect(await page.evaluate(() => window.museDiagram.getState().edges.e1.points)).toEqual([pins[2]]);
  await expect(numbers).toHaveText(["1"]);
  await first.press("Space");
  await expect(numbers).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^删除折点 / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "增加折点", exact: true })).toBeFocused();
  const empty = await page.evaluate(() => window.museDiagram.getState());
  expect(empty.edges.e1.points).toEqual([]);
  expect(await page.evaluate(() => window.museDiagram.history.length)).toBe(before.history + 3);
  const finalGeometry = await geo(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存 HTML", exact: true }).click();
  const download = await pending, saved = join(work, "deleted-bends-saved.html");
  await download.saveAs(saved);
  expect(readFileSync(saved, "utf8")).not.toContain("<muse-diagram-editor");
  await open(page, saved);
  expect(await page.evaluate(() => window.museDiagram.getState())).toEqual(empty);
  expect((await geo(page)).edges.e1.points).toEqual(finalGeometry.edges.e1.points);
  await edit(page);
  await page.getByRole("button", { name: "连线 e1", exact: true }).click();
  await expect(numbers).toHaveCount(0);
  await page.getByRole("button", { name: "增加折点", exact: true }).click();
  await expect(numbers).toHaveText(["1"]);
  await page.getByRole("button", { name: "删除折点 1", exact: true }).click();
  expect(await page.evaluate(() => window.museDiagram.getState().edges.e1.points)).toEqual([]);
});

test("automatic bend numbers follow zoom and scrolling and remain draggable before individual deletion", async ({ page }) => {
  await open(page);
  await edit(page);
  await page.getByRole("button", { name: "整体下移 24px" }).click();
  await page.getByRole("button", { name: "连线 e2", exact: true }).click();
  for (const side of ["left", "bottom"]) {
    const port = page.getByRole("combobox", { name: "起点端口", exact: true });
    await port.focus();
    await port.selectOption(side);
    const count = (await geo(page)).edges.e2.points.length - 2;
    await expect(page.getByRole("button", { name: /^删除折点 / })).toHaveCount(count);
    await expect(page.locator("muse-diagram-editor").locator("[data-bend-number] text"))
      .toHaveText(Array.from({ length: count }, (_, i) => String(i + 1)));
    await expect(port).toBeFocused();
  }
  await page.getByRole("button", { name: "放大", exact: true }).click();
  await page.getByRole("button", { name: "放大", exact: true }).click();
  await page.getByRole("button", { name: "定位折点 1", exact: true }).click();
  const editor = page.locator("muse-diagram-editor"),
    initial = await geo(page),
    points = initial.edges.e2.points.slice(1, -1);
  expect(points.length).toBeGreaterThan(0);
  await expect(editor.locator("[data-bend-number] text")).toHaveText(points.map((_, i) => String(i + 1)));
  const before = await page.evaluate(() => ({
    state: window.museDiagram.getState(),
    history: window.museDiagram.history.length,
    scale: window.museDiagram.scale(),
    rect: window.museDiagram.root.getBoundingClientRect().toJSON(),
  }));
  const handle = editor.locator('[data-bend-number="1"] circle'),
    r = await handle.boundingBox();
  expect(r.x + r.width / 2).toBeCloseTo(before.rect.x + points[0].x * before.scale.x, 1);
  expect(r.y + r.height / 2).toBeCloseTo(before.rect.y + points[0].y * before.scale.y, 1);
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 24, r.y + r.height / 2 + 16, { steps: 5 });
  await page.mouse.up();
  const dragged = await page.evaluate(() => window.museDiagram.getState());
  expect(dragged.edges.e2.points[0].x).toBeCloseTo(points[0].x + 24 / before.scale.x, 1);
  expect(dragged.edges.e2.points[0].y).toBeCloseTo(points[0].y - before.state.bodyOffset + 16 / before.scale.y, 1);
  expect(await page.evaluate(() => window.museDiagram.history.length)).toBe(before.history + 1);
  await page.getByRole("button", { name: "删除折点 1", exact: true }).click();
  expect(await page.evaluate(() => window.museDiagram.getState().edges.e2.points)).toEqual(dragged.edges.e2.points.slice(1));
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect(await page.evaluate(() => window.museDiagram.getState())).toEqual(dragged);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect(await page.evaluate(() => window.museDiagram.getState())).toEqual(before.state);
  await expect(editor.locator("[data-bend-number] text")).toHaveText(points.map((_, i) => String(i + 1)));
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await expect(editor.locator("[data-bend-number]")).toHaveCount(0);
});

test("fixed canvas diagnostics locate objects, save remains available and invalid exports fail clearly", async ({
  page,
}) => {
  await open(page);
  await edit(page);
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.config.fixedSize = true;
    d.change(() => d.move(["D"], 2000, 0));
  });
  const g = await geo(page);
  expect(
    g.issues.some((i) => i.type === "bounds" && i.id === "D"),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "D · 对象超出画布", exact: true })
    .click();
  await expect(page.getByRole("spinbutton", { name: "水平位移" })).toHaveValue(
    "2000",
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存 HTML" }).click();
  await pending;
  await page.getByRole("button", { name: "导出 PNG" }).click();
  await expect(page.getByRole("alert")).toContainText("超出画布");
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.undo();
    d.root.style.width = "20000px";
  });
  await page.getByRole("button", { name: "导出 PNG" }).click();
  await expect(page.getByRole("alert")).toContainText("超过导出上限");
  await open(page);
  await page.evaluate(() => {
    window.museDiagram.root.style.backgroundImage =
      'url("data:image/png;base64,broken")';
  });
  await page.getByRole("button", { name: "导出 PNG" }).click();
  await expect(page.getByRole("alert")).toContainText("图片资源损坏");
});
