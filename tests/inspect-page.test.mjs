import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  environmentFailure,
  fontLabel,
  parseArgs,
  pdfPages,
  readFacts,
  readStyle,
  sweepSizes,
  tokensAt,
} from '../plugins/musekit/scripts/inspect_page.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, 'plugins/musekit/scripts/inspect_page.mjs'), 'utf8');

test('a canvas run and a web run take different options', () => {
  const poster = parseArgs(['poster.html', '--canvas', '1080x1440', '--facts', 'facts.txt']);
  assert.deepEqual(poster.canvas, { width: 1080, height: 1440 });
  assert.equal(poster.viewports, undefined);
  assert.equal(poster.scale, 1);

  const deck = parseArgs(['deck.html', '--canvas', '1920x1080', '--slides', '.slide']);
  assert.equal(deck.slides, '.slide');
  assert.deepEqual(deck.canvas, { width: 1920, height: 1080 });

  const web = parseArgs(['index.html']);
  assert.deepEqual(web.viewports.map((v) => `${v.width}x${v.height}`), ['1440x900', '768x1024', '375x812']);
  assert.equal(parseArgs(['index.html', '--viewports', '1280x800, 390x844']).viewports[1].height, 844);

  for (const bad of [
    [],
    ['--canvas', '10x10'],
    ['p.html', '--canvas', '1080'],
    ['p.html', '--canvas', '10x10', '--viewports', '10x10'],
    ['p.html', '--canvas', '10x10', '--flow', 'f.mjs'],
    ['p.html', '--slides', '.slide'],
    ['p.html', '--scale', '3'],
    ['p.html', '--browser', 'firefox'],
    ['p.html', '--unknown', 'x'],
    ['p.html', '--out'],
  ])
    assert.throws(() => parseArgs(bad), /Usage|expects|--scale|--flow|--slides|not both|Unknown/, bad.join(' '));
});

test('style.md gives breakpoint edges and the palette', () => {
  const style = readStyle(`
:root { --color-paper: #FFF8E7; --color-ink: #0a0a0a; --color-accent: #F2C;
  --space-1: 8px; --data-cat-1: #70318A; --color-glass: rgba(228, 228, 222, 0.62); --color-line: rgb(28 29 26 / 0.1); }
@media (min-width: 768px) { :root { --margin: 48px; } }
@media (max-width: 1100px) { :root { --columns: 8; } }`);
  assert.deepEqual(style.breakpoints, [767, 768, 1100, 1101]);
  assert.deepEqual(style.palette, ['255,248,231', '10,10,10', '255,34,204', '112,49,138', '228,228,222', '28,29,26']);
});

test('a style that follows the system keeps a dark palette and dark tokens apart from the light ones', () => {
  const style = readStyle(`## Tokens

\`\`\`css
:root {
  color-scheme: light dark;
  --color-paper: #FFFFFF;
  --color-ink: #111111;
  --color-glass: rgba(228, 228, 222, 0.62);
  --margin: 64px;
}
/* 深色：跟随系统 */
@media (prefers-color-scheme: dark) {
  :root {
    --color-paper: #121311;
    --color-glass: rgba(34, 35, 31, 0.64);
    --shadow: none;
  }
}
/* mobile */
@media (max-width: 767px) {
  :root {
    --margin: 24px;
  }
}
\`\`\`
`);
  assert.equal(style.dark, true);
  assert.deepEqual(style.breakpoints, [767, 768]);
  assert.deepEqual(style.palette, ['255,255,255', '17,17,17', '228,228,222']);
  // Dark keeps the light colours it does not replace (ink here) and swaps the rest.
  assert.deepEqual(style.darkPalette, ['17,17,17', '18,19,17', '34,35,31']);
  assert.equal(tokensAt(style.tokens, 1440)['color-paper'], '#FFFFFF');
  assert.deepEqual(tokensAt(style.tokens, 1440, 'dark'), { 'color-paper': '#121311', 'color-ink': '#111111', 'color-glass': 'rgba(34, 35, 31, 0.64)', margin: '64px', shadow: 'none' });
  assert.equal(tokensAt(style.tokens, 375, 'dark').margin, '24px');
  assert.equal(readStyle(':root { --color-paper: #FFF; }').dark, false);
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

test('a PDF is read for its page count and page sizes in CSS px', () => {
  const page = (w, h) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] >>`;
  const pdf = Buffer.from(`%PDF-1.4\n<< /Type /Pages /Count 3 >>\n${page(1440, 810)}\n${page(1440, 810)}\n${page(612, 792)}\n`, 'latin1');
  assert.deepEqual(pdfPages(pdf), { pages: 3, sizes: ['1920x1080', '816x1056'] });
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

test('a webfont is listed by the family that asked for it, not by its default instance name', () => {
  const stack = '"Noto Sans SC", "PingFang SC", sans-serif';
  assert.equal(fontLabel('Noto Sans SC Thin', true, stack), 'Noto Sans SC');
  assert.equal(fontLabel('IBM Plex Mono Medium', true, '"IBM Plex Mono", "Noto Sans SC", monospace'), 'IBM Plex Mono');
  // A system font keeps its own name, so a fallback is still visible.
  assert.equal(fontLabel('PingFang SC', false, stack), 'PingFang SC');
  assert.equal(fontLabel('Some Other Face', true, stack), 'Some Other Face');
});
