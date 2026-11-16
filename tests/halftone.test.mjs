import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, 'plugins/musekit/assets/halftone.js'), 'utf8');

// Load the file the way a page does: a classic script that sets one global.
function load() {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  return context.MusekitHalftone;
}

const H = load();
const constant = (d) => () => d;
const disk = (cx, cy, radius) => (x, y) => (Math.hypot(x - cx, y - cy) < radius ? 0.9 : 0);
const base = { width: 240, height: 180, cell: 6, angle: 45, seed: 7 };

test('the module is a dependency-free classic script', () => {
  assert.equal(typeof H.dots, 'function');
  assert.equal(typeof H.draw, 'function');
  assert.equal(typeof H.fieldFromPixels, 'function');
  assert.equal(typeof H.fieldFromImage, 'function');
  assert.doesNotMatch(source, /^\s*(import|export)\s/m);
  assert.doesNotMatch(source, /\b(fetch|XMLHttpRequest|require)\s*\(|https?:\/\//);
});

test('the same input and seed give the same dots; another seed changes only the texture', () => {
  const opts = { ...base, field: disk(120, 90, 70), drift: 0.08, dryBreak: 0.02 };
  assert.deepEqual(H.dots(opts), H.dots({ ...opts }));
  // A fresh page (another realm) computes the same plate.
  assert.equal(JSON.stringify(load().dots(opts)), JSON.stringify(H.dots(opts)));
  assert.notDeepEqual(H.dots({ ...opts, seed: 8 }), H.dots(opts));
  const flat = { ...opts, drift: 0, dryBreak: 0 };
  assert.deepEqual(H.dots({ ...flat, seed: 1 }), H.dots({ ...flat, seed: 99 }));
});

test('dot area follows ink on a screen rotated by the given angle around the centre', () => {
  const { cell } = base;
  const list = H.dots({ ...base, field: constant(0.5) });
  for (const [, , r] of list) assert.ok(Math.abs((Math.PI * r * r) / (cell * cell) - 0.5) < 1e-9);
  const centre = list.find(([x, y]) => Math.abs(x - 120) < 1e-9 && Math.abs(y - 90) < 1e-9);
  assert.ok(centre, 'the screen origin sits at the canvas centre');
  const a = (45 * Math.PI) / 180;
  const next = [120 + cell * Math.cos(a), 90 + cell * Math.sin(a)];
  assert.ok(list.some(([x, y]) => Math.hypot(x - next[0], y - next[1]) < 1e-9));
  assert.ok(list.every(([x, y]) => x >= -cell && x <= 240 + cell && y >= -cell && y <= 180 + cell));
  assert.equal(H.dots({ ...base, field: constant(0) }).length, 0);
});

test('ink drift stays inside its amplitude and is not uniform', () => {
  const list = H.dots({ ...base, field: constant(0.5), drift: 0.1 });
  const inks = list.map(([, , r]) => (Math.PI * r * r) / 36);
  assert.ok(inks.every((d) => d >= 0.45 - 1e-9 && d <= 0.55 + 1e-9));
  assert.ok(Math.max(...inks) - Math.min(...inks) > 0.03);
});

test('dry breaks only remove dots along edges', () => {
  const field = disk(120, 90, 60);
  const whole = H.dots({ ...base, field });
  const broken = H.dots({ ...base, field, dryBreak: 0.5 });
  const key = ([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`;
  const kept = new Set(broken.map(key));
  const removed = whole.filter((dot) => !kept.has(key(dot)));
  assert.ok(removed.length > 0);
  assert.ok(broken.length < whole.length);
  const keptWhole = new Set(whole.map(key));
  assert.ok(broken.every((dot) => keptWhole.has(key(dot))), 'no dot moves or appears');
  for (const [x, y] of removed) assert.ok(Math.abs(Math.hypot(x - 120, y - 90) - 60) < 2 * base.cell);
});

test('pixel fields map darkness and alpha to ink and fit the image to the plate', () => {
  // 2×1 image: black, then transparent black; a white pixel would also read as no ink.
  const img = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]) };
  const field = H.fieldFromPixels(img, { width: 200, height: 100 });
  assert.equal(field(50, 50), 1);
  assert.equal(field(150, 50), 0);
  assert.equal(field(-1, 50), 0);
  const white = { width: 1, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255]) };
  assert.equal(H.fieldFromPixels(white, { width: 10, height: 10 })(5, 5), 0);
  assert.equal(H.fieldFromPixels(white, { width: 10, height: 10, invert: true })(5, 5), 1);
  // contain keeps the whole image: a 2×1 image in a square plate leaves bands above and below.
  const contain = H.fieldFromPixels(img, { width: 100, height: 100, fit: 'contain' });
  assert.equal(contain(25, 50), 1);
  assert.equal(contain(25, 10), 0);
});
