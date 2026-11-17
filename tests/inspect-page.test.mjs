import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  environmentFailure,
  parseArgs,
  readFacts,
  readStyle,
  sweepSizes,
} from '../plugins/musekit/scripts/inspect_page.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, 'plugins/musekit/scripts/inspect_page.mjs'), 'utf8');

test('a canvas run and a web run take different options', () => {
  const poster = parseArgs(['poster.html', '--canvas', '1080x1440', '--facts', 'facts.txt']);
  assert.deepEqual(poster.canvas, { width: 1080, height: 1440 });
  assert.equal(poster.viewports, undefined);
  assert.equal(poster.scale, 1);

  const web = parseArgs(['index.html']);
  assert.deepEqual(web.viewports.map((v) => `${v.width}x${v.height}`), ['1440x900', '768x1024', '375x812']);
  assert.equal(parseArgs(['index.html', '--viewports', '1280x800, 390x844']).viewports[1].height, 844);

  for (const bad of [
    [],
    ['--canvas', '10x10'],
    ['p.html', '--canvas', '1080'],
    ['p.html', '--canvas', '10x10', '--viewports', '10x10'],
    ['p.html', '--canvas', '10x10', '--flow', 'f.mjs'],
    ['p.html', '--scale', '3'],
    ['p.html', '--browser', 'firefox'],
    ['p.html', '--unknown', 'x'],
    ['p.html', '--out'],
  ])
    assert.throws(() => parseArgs(bad), /Usage|expects|--scale|--flow|not both|Unknown/, bad.join(' '));
});

test('style.md gives breakpoint edges and the palette', () => {
  const style = readStyle(`
:root { --color-paper: #FFF8E7; --color-ink: #0a0a0a; --color-accent: #F2C;
  --space-1: 8px; --data-cat-1: #70318A; }
@media (min-width: 768px) { :root { --margin: 48px; } }
@media (max-width: 1100px) { :root { --columns: 8; } }`);
  assert.deepEqual(style.breakpoints, [767, 768, 1100, 1101]);
  assert.deepEqual(style.palette, ['255,248,231', '10,10,10', '255,34,204', '112,49,138']);
});

test('the sweep covers fixed widths, breakpoint edges, the requested viewports and short screens', () => {
  const sizes = sweepSizes([{ width: 1366, height: 768 }], [767, 768]);
  const tall = sizes.filter((s) => s.height === 900).map((s) => s.width);
  for (const w of [320, 375, 767, 768, 1366, 1920]) assert.ok(tall.includes(w), String(w));
  assert.deepEqual(tall, [...tall].sort((a, b) => a - b));
  assert.equal(new Set(tall).size, tall.length);
  const short = sizes.filter((s) => s.height !== 900).map((s) => `${s.width}x${s.height}`);
  assert.deepEqual(short, ['1366x768', '1280x720', '1024x768', '375x667']);
});

test('facts are one per line, trimmed, blank lines dropped', () => {
  assert.deepEqual(readFacts('  城市里的植物 \n\n2027.03.06 14:30\r\n'), ['城市里的植物', '2027.03.06 14:30']);
});

test('environment failures name the fix', () => {
  assert.equal(environmentFailure('Playwright is unavailable in this working directory.').cause, 'playwright-missing');
  assert.match(environmentFailure("Executable doesn't exist at /x").fix, /playwright install chromium/);
  assert.match(environmentFailure("Executable doesn't exist at /x", 'chrome').fix, /install chrome/);
  assert.equal(environmentFailure('something else'), undefined);
});

test('the script stays portable: no machine paths, no network, resolves Playwright from the working directory', () => {
  assert.doesNotMatch(source, /\/Users\/|\/home\/|C:\\\\/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest/);
  assert.match(source, /createRequire\(join\(process\.cwd\(\), "package\.json"\)\)/);
  assert.match(source, /visualReview: "not-performed"/);
});
