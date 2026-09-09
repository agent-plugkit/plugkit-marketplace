import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function open(page, name = "dataflow") {
  await page.goto(pathToFileURL(resolve(
    `plugins/musekit/skills/diagram-design/references/examples/${name}.html`,
  )).href);
  await page.evaluate(() => window.museDiagram.ready);
  await page.getByRole("button", { name: "编辑布局", exact: true }).click();
}
const panel = page => page.getByRole("region", { name: "布局属性", exact: true });
const state = page => page.evaluate(() => window.museDiagram.getState());

async function expectInside(locator, container) {
  const r = await locator.boundingBox(), c = await container.boundingBox();
  expect(r.x).toBeGreaterThanOrEqual(c.x - 1);
  expect(r.y).toBeGreaterThanOrEqual(c.y - 1);
  expect(r.x + r.width).toBeLessThanOrEqual(c.x + c.width + 1);
  expect(r.y + r.height).toBeLessThanOrEqual(c.y + c.height + 1);
}

test("fitted canvas and toolbar stay clear of the inspector across desktop and bottom dock layouts", async ({ page }) => {
  await open(page);
  const original = await state(page);
  for (const [width, height] of [[1285, 885], [1024, 768], [768, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => {
      const art = await page.locator("[data-diagram]").boundingBox();
      const side = await panel(page).boundingBox();
      return width > 900 ? art.x + art.width <= side.x - 10 : art.y + art.height <= side.y - 10;
    }).toBe(true);
    const toolbar = await page.locator("muse-diagram-editor .bar").boundingBox();
    const art = await page.locator("[data-diagram]").boundingBox();
    expect(art.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height + 10);
    const side = await panel(page).boundingBox();
    expect(side.x).toBeGreaterThanOrEqual(0);
    expect(side.x + side.width).toBeLessThanOrEqual(width);
    expect(side.y + side.height).toBeLessThanOrEqual(height);
    for (const selector of [".bar .cluster", ".inspector", ".navigator-scroll"])
      for (const element of await page.locator(`muse-diagram-editor ${selector}`).all())
        expect(await element.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await state(page)).toEqual(original);
  }
  await page.getByRole("button", { name: "放大", exact: true }).click();
  const zoom = await page.evaluate(() => window.museDiagram.scale().x);
  await page.setViewportSize({ width: 1285, height: 885 });
  await expect.poll(() => page.evaluate(() => window.museDiagram.scale().x)).toBeCloseTo(zoom, 3);
  await page.getByRole("button", { name: "适合窗口", exact: true }).click();
  const side = await panel(page).boundingBox(), art = await page.locator("[data-diagram]").boundingBox();
  expect(art.x + art.width).toBeLessThan(side.x);
});

test("navigation scroll is independent, keeps the selected edge visible and retains keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 1285, height: 885 });
  await open(page, "async-roundtrip");
  const before = await state(page);
  const p = panel(page), list = p.locator(".navigator-scroll");
  const edge = p.getByRole("button", { name: "连线 e12", exact: true });
  await edge.click();
  await expect(edge).toBeFocused();
  await expectInside(edge, list);
  await expect(p.locator(".selection-title")).toHaveText("连线与标签");
  const scroll = await list.evaluate(el => el.scrollTop);
  await page.evaluate(() => window.museDiagram.apply());
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(scroll);
  await expect(edge).toBeFocused();
  const titleBeforeScroll = await p.locator(".selection-title").boundingBox();
  await list.evaluate(el => { el.scrollTop = 0; });
  expect(await p.locator(".selection-title").boundingBox()).toEqual(titleBeforeScroll);
  const actor = p.getByRole("button", { name: "│ Client", exact: true });
  await actor.focus();
  await page.keyboard.press("Space");
  await expect(actor).toHaveAttribute("aria-pressed", "true");
  await expect(actor).toBeFocused();
  await expectInside(actor, list);
  await expect(p.getByRole("spinbutton", { name: "垂直位移", exact: true })).toBeDisabled();
  expect(await state(page)).toEqual(before);
  await page.keyboard.press("ArrowRight");
  expect((await state(page)).nodes.Client.dx).toBe((before.nodes.Client?.dx || 0) + 1);
});

test("compact canvas controls retain disclosure state and commit edits before switching objects", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await open(page);
  const p = panel(page), summary = p.locator(".canvas-settings summary");
  await summary.focus();
  await page.keyboard.press("Space");
  await expect(p.getByRole("spinbutton", { name: "主体顶部间距", exact: true })).toBeHidden();
  await p.getByRole("button", { name: "Consent", exact: true }).click();
  await expect(p.locator(".selection-title")).toHaveText("检查授权");
  await expect(p.getByRole("spinbutton", { name: "主体顶部间距", exact: true })).toBeHidden();
  await p.getByRole("spinbutton", { name: "水平位移", exact: true }).fill("12");
  await p.getByRole("button", { name: "Events", exact: true }).click({ delay: 100 });
  expect((await state(page)).nodes.Consent.dx).toBe(12);
  await expect(p.getByRole("spinbutton", { name: "水平位移", exact: true })).toHaveValue("0");
  await summary.click();
  const gap = p.getByRole("spinbutton", { name: "主体顶部间距", exact: true });
  const previous = Number(await gap.inputValue());
  await p.getByRole("button", { name: "整体下移 24px", exact: true }).click();
  await expect(gap).toHaveValue(String(previous + 24));
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(gap).toHaveValue(String(previous));
  await page.evaluate(() => {
    const d = window.museDiagram;
    d.nodes.get("Events").el.setAttribute("data-diagram-title", "一个没有空格而且非常长的节点名称".repeat(12));
    d.apply();
  });
  for (const selector of [".inspector", ".navigator-scroll"])
    expect(await p.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
