import { test, expect } from "@playwright/test";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// The module is copied next to the page and opened from file://, as a work directory would.
let work;
test.beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "musekit-halftone-e2e-"));
  copyFileSync(resolve("plugins/musekit/assets/halftone.js"), join(work, "halftone.js"));
  writeFileSync(
    join(work, "index.html"),
    `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">
<canvas id="a"></canvas><canvas id="b"></canvas><script src="halftone.js"></script>`,
  );
});
test.afterAll(() => rmSync(work, { recursive: true, force: true }));

test("halftone plates render from file:// and the registration offset moves the whole plate", async ({ page }) => {
  await page.goto(pathToFileURL(join(work, "index.html")).href);
  const result = await page.evaluate(() => {
    const H = window.MusekitHalftone;
    // A silhouette drawn on an offscreen canvas becomes the ink field.
    const shape = document.createElement("canvas");
    shape.width = 120;
    shape.height = 80;
    const g = shape.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(30, 20, 60, 40);
    const field = H.fieldFromImage(shape, { width: 120, height: 80 });
    const dots = H.dots({ width: 120, height: 80, cell: 6, angle: 45, field, seed: 3 });
    const box = (id, offset) => {
      const canvas = document.getElementById(id);
      H.draw(canvas, dots, { width: 120, height: 80, dpr: 2, color: "#1a1a1a", offset });
      const { data, width, height } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      let minX = width, minY = height;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (data[(y * width + x) * 4 + 3] > 128) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
          }
      return { minX, minY, width, height, css: canvas.style.width };
    };
    return { count: dots.length, plain: box("a", [0, 0]), shifted: box("b", [4, 3]) };
  });
  expect(result.count).toBeGreaterThan(40);
  expect(result.plain).toMatchObject({ width: 240, height: 160, css: "120px" });
  expect(result.plain.minX).toBeGreaterThan(40);
  expect(result.shifted.minX - result.plain.minX).toBe(8);
  expect(result.shifted.minY - result.plain.minY).toBe(6);
});
