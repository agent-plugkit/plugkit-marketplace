import { test, expect } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cutout, parseArgs } from "../../plugins/musekit/assets/cutout.mjs";

// A photo and its foreground mask become one PNG whose alpha follows the mask.
let work;
test.beforeAll(() => { work = realpathSync(mkdtempSync(join(tmpdir(), "musekit-cutout-"))); });

const draw = (page, w, h, paint) => page.evaluate(([w, h, paint]) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  new Function("g", "w", "h", paint)(c.getContext("2d"), w, h);
  return c.toDataURL("image/png").split(",")[1];
}, [w, h, paint]);
const save = (name, b64) => { const p = join(work, name); writeFileSync(p, Buffer.from(b64, "base64")); return p; };

test("the foreground PNG keeps the photo where the mask is white and is clear elsewhere", async ({ page }) => {
  const photo = save("photo.png", await draw(page, 200, 100, 'g.fillStyle="#c00";g.fillRect(0,0,w,h);'));
  // A mask at half the size, with soft grey noise on the black side: the threshold keeps it out.
  const mask = save("mask.png", await draw(page, 100, 50, 'g.fillStyle="#222";g.fillRect(0,0,w,h);g.fillStyle="#fff";g.fillRect(w/2,0,w/2,h);'));
  const out = join(work, "fg.png"), check = join(work, "edge.jpg");
  const r = await cutout(parseArgs([photo, mask, "--out", out, "--check", check]));
  expect(r).toMatchObject({ width: 200, height: 100, share: 0.5 });
  expect(existsSync(check)).toBe(true);
  await page.setContent(`<img id="i" src="data:image/png;base64,${readFileSync(out).toString("base64")}">`);
  const alpha = (x) => page.evaluate(async (x) => {
    const img = document.getElementById("i"); await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    return [...g.getImageData(x, 50, 1, 1).data];
  }, x);
  expect(await alpha(160)).toEqual([204, 0, 0, 255]);
  expect((await alpha(40))[3]).toBe(0);
  // The feather softens only the contour.
  const edge = (await alpha(100))[3];
  expect(edge > 0 && edge < 255).toBe(true);
});

test("a mask with another aspect ratio is refused, and the default output sits beside the photo", async ({ page }) => {
  const photo = save("wide.png", await draw(page, 200, 100, 'g.fillStyle="#333";g.fillRect(0,0,w,h);'));
  const mask = save("square.png", await draw(page, 100, 100, 'g.fillStyle="#fff";g.fillRect(0,0,w,h);'));
  expect(parseArgs([photo, mask]).out).toBe(join(work, "wide-fg.png"));
  await expect(cutout(parseArgs([photo, mask]))).rejects.toThrow(/aspect ratios differ/);
  expect(() => parseArgs([photo])).toThrow(/Usage/);
  expect(() => parseArgs([photo, mask, "--feather", "50"])).toThrow(/--feather/);
});
