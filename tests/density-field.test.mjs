import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, 'plugins/musekit/assets/density-field.js'), 'utf8');

// Load the file the way a page does: a classic script that sets one global.
function load() {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  return context.MusekitDensityField;
}

const D = load();
// Values from the script's own realm, compared as plain data.
const plain = (v) => JSON.parse(JSON.stringify(v));
const base = { cols: 40, rows: 30, seed: 3, cx: 20, cy: 15, rx: 12, ry: 9 };
const at = (cells, i, j) => cells[j * base.cols + i];

test('the module is a dependency-free classic script', () => {
  for (const name of ['cluster', 'glyph', 'tone', 'draw']) assert.equal(typeof D[name], 'function', name);
  assert.doesNotMatch(source, /^\s*(import|export)\s/m);
  assert.doesNotMatch(source, /\b(fetch|XMLHttpRequest|require)\s*\(|https?:\/\//);
  // Single-file pages inline the module, so nothing in it may close the script element early.
  assert.doesNotMatch(source, /<\/script/i);
});

test('a cluster is the same for the same seed in any page, dense at the core and empty far out', () => {
  const cells = D.cluster(base);
  assert.equal(cells.length, base.cols * base.rows);
  assert.ok(cells.every((v) => v >= 0 && v <= 1));
  assert.equal(JSON.stringify(load().cluster(base)), JSON.stringify(cells));
  assert.notDeepEqual(plain(D.cluster({ ...base, seed: 4 })), plain(cells));
  assert.ok(at(cells, 20, 15) > 0.6, 'core');
  assert.equal(at(cells, 0, 0), 0, 'corner beyond the soft edge');
  // The soft edge leaves scattered faint cells, not a hard outline.
  const faint = cells.filter((v) => v > 0 && v < 0.1).length;
  assert.ok(faint > 5, `${faint} faint cells`);
});

test('density picks the glyph, the fill tone and the ink strength', () => {
  assert.equal(D.glyph(0.02), '.');
  assert.equal(D.glyph(1), '8');
  assert.deepEqual(plain(D.glyphs), ['.', "'", ':', 'o', 't', 'x', 's', '%', '$', 'S', '#', '@', '8']);
  // Above 0.2 the core tone, below it the edge grey; both strengthen with density.
  assert.deepEqual(plain(D.tone(0.5)), { fill: 'core', fillAlpha: 0.82, inkAlpha: 0.655 });
  assert.deepEqual(plain(D.tone(0.1)), { fill: 'edge', fillAlpha: 0.27, inkAlpha: 0.435 });
  assert.equal(D.tone(1).fillAlpha, 1);
  assert.equal(D.tone(1).inkAlpha, 0.9);
});

test('bounds give the outline box in cells, so a cluster can be measured against the glass', () => {
  const cells = D.cluster(base);
  const box = plain(D.bounds(cells, base.cols));
  assert.ok(box.left < 20 && box.right > 20 && box.top < 15 && box.bottom > 15, JSON.stringify(box));
  assert.equal(box.count, cells.filter((v) => v > 0).length);
  assert.deepEqual(plain(D.bounds([0, 0, 0, 0], 2)), { left: 0, top: 0, right: 0, bottom: 0, count: 0 });
});

test('strength scales a cell, for the rows under text set directly on the grid', () => {
  assert.equal(D.tone(0.5, 0.42).fillAlpha, 0.344);
  assert.equal(D.tone(0.5, 0.42).inkAlpha, 0.275);
  assert.equal(D.tone(0.5, 1).fillAlpha, D.tone(0.5).fillAlpha);
});
