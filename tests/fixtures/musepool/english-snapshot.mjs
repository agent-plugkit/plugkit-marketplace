#!/usr/bin/env node
// Regenerate english-ranking.json: the complete result list of English (non-CJK) searches as the
// current muse_local.py returns them, on the bundled snapshot and on the 1.3.0-shaped fixture
// library. musepool-search.test.mjs checks that the script still returns exactly these results.
// Run from the repository root (needs git history and Python 3):
//
//   node tests/fixtures/musepool/english-snapshot.mjs [--rev <commit>] [--out <file>]
//
// --rev ranks with muse_local.py and zh_terms.json from that commit instead of the working tree,
// e.g. to compare with the results before a change. The query corpus is every English synonym of
// the Chinese term table at 0fd44ef (before the table was trimmed), every tag value, category,
// category word and core dimension of both libraries, plus the edge cases below.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentHash, readDirectory } from '../../../scripts/sync-seeds.mjs';
import { bundledSeeds, release130 } from './library.mjs';

const fixtures = dirname(fileURLToPath(import.meta.url));
const root = join(fixtures, '../../..');
const scripts = join(root, 'plugins/musekit/skills/musepool/scripts');
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const CORPUS_REV = '0fd44ef';
export const SCENARIOS = ['', 'ui', 'graphic', 'information'];
// Seed IDs are stored as one character each, in the order of the library's index.
export const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CJK = /[㐀-䶿一-鿿豈-﫿]/;

// Polysemous words, compounds, case, punctuation, CSS and code spellings, front matter values,
// substrings and misses.
const EDGE_CASES = [
  'Dashboard', 'DASHBOARD', 'Typography Grid', 'dark monochrome typography', 'number density hierarchy',
  'pricing comparison', 'product launch card', 'restaurant website', 'menu reservation', 'minimal serif',
  'no-motion', 'sans-serif', 'Sans Serif', 'serif', 'z-index', 'paper.js', 'three-bar', 'pointer-events',
  'prefers-reduced-motion', 'background-size: cover', 'object-fit', '#000000', '#fff', '1.5', '48px', '100vh',
  'a', 'e', 'the', 'ing', '-', '--', '(', ')', '.', ':', 'café', '"quoted"', "it's", 'dashboard,', 'grid.',
  'landing/page', 'one/two-ink', 'bar', 'bars', 'paper', 'map', 'maps', 'filter', 'index', 'cover', 'covers',
  'book', 'quote', 'event', 'events', 'form', 'forms', 'slider', 'board', 'search', 'free', 'live', 'lives',
  'fair', 'press', 'feature', 'features', 'work', 'works', 'flow', 'graph', 'update', 'updates', 'announce',
  'member', 'tier', 'matrix', 'article', 'articles', 'food', 'business', 'web', 'app', 'landing', 'graphic',
  'poster', 'banner', 'logo', 'scale', 'density', 'personal', 'specimen', 'accent', 'location', 'address',
  'nav bar', 'navigation bar', 'cocktail bar', 'cocktail bar website', 'research paper', 'paper texture',
  'price quote', 'testimonial quote', 'form input', 'range slider', 'event page', 'pointer events',
  'hamburger menu', 'book a table', 'case study', 'no gradients', 'without animation', 'do not',
  'reduced motion', 'no-such-reference-847261', 'xyzzy plugh', 'dashboard xyzzy', 'motion animation transition',
  'hero carousel slider', 'grid grid', 'naïve', '✨ sparkle', 'dashboard，grid', 'UI', 'Graphic', 'INFORMATION',
  'border-radius', 'cubic-bezier', 'rgba', 'var', 'webkit', 'font-smoothing', 'letter-spacing', 'line-height',
  'modality', 'view_type', 'scenario', 'novelty', 'scores', 'anti_slop_value', 'dimensions_with_reference', 'id',
  'js', 'paperjs', 'gsap', 'three.js', 'p5.js', 'next.js', 'css', 'json', 'javascript', 'const', 'function',
];

export function corpus(oldTerms, libraries) {
  const queries = new Set();
  const add = (query) => {
    const text = String(query).trim();
    if (text && !CJK.test(text)) queries.add(text);
  };
  for (const synonyms of Object.values(oldTerms.terms)) for (const synonym of synonyms) add(synonym);
  for (const library of libraries) {
    const { seeds } = JSON.parse(readFileSync(join(library, 'index.json'), 'utf8'));
    for (const entry of seeds) {
      add(entry.category);
      for (const word of entry.category.split(/[\s/]+/)) add(word);
      for (const tag of Object.values(entry.tags).flat()) add(tag);
      for (const dimension of entry.core_dimensions ?? []) add(dimension);
    }
  }
  for (const query of EDGE_CASES) add(query);
  return [...queries];
}

// Every [query, scenario] pair from one Python process per library, as search_batch.py reports it.
export function rankAll(script, library, requests, dir) {
  const file = join(dir, `requests-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(requests));
  const output = execFileSync(python, ['-I', join(fixtures, 'search_batch.py'), script, library, file], {
    encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  });
  return JSON.parse(output);
}

// One string per result: ★ IDs, "|", the other listed IDs; "?<n>" when the script lists nothing and
// reports n unreliable seeds instead; "" when nothing matched at all.
export function encode(result, ids) {
  const chars = (list) => list.map((id) => ALPHABET[ids.indexOf(id)]).join('');
  if (result.unreliable !== null) return `?${result.unreliable}`;
  if (!result.stars.length && !result.rest.length) return '';
  return `${chars(result.stars)}|${chars(result.rest)}`;
}

export function libraryIds(library) {
  return JSON.parse(readFileSync(join(library, 'index.json'), 'utf8')).seeds.map((entry) => entry.id);
}

export function libraryHash(library) {
  return contentHash(readDirectory(library));
}

export function snapshot(script, libraries, queries, dir) {
  const requests = queries.flatMap((query) => SCENARIOS.map((scenario) => [query, scenario]));
  const result = {};
  for (const [name, library] of Object.entries(libraries)) {
    const ids = libraryIds(library);
    const ranked = rankAll(script, library, requests, dir);
    result[name] = {
      contentHash: libraryHash(library),
      ids,
      results: queries.map((_, q) => SCENARIOS.map((__, s) => encode(ranked[q * SCENARIOS.length + s], ids))),
    };
  }
  return result;
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function main() {
  const option = (name) => {
    const at = process.argv.indexOf(name);
    return at > 0 ? process.argv[at + 1] : undefined;
  };
  const rev = option('--rev');
  const out = option('--out') ?? join(fixtures, 'english-ranking.json');
  const dir = mkdtempSync(join(tmpdir(), 'musekit-english-snapshot-'));
  try {
    const scriptDir = join(dir, 'scripts');
    mkdirSync(scriptDir);
    for (const file of ['muse_local.py', 'zh_terms.json']) {
      if (rev) writeFileSync(join(scriptDir, file), git('show', `${rev}:plugins/musekit/skills/musepool/scripts/${file}`));
      else copyFileSync(join(scripts, file), join(scriptDir, file));
    }
    const libraries = { bundled: bundledSeeds, 'release-1.3.0': release130(dir).library };
    const oldTerms = JSON.parse(git('show', `${CORPUS_REV}:plugins/musekit/skills/musepool/scripts/zh_terms.json`));
    const queries = corpus(oldTerms, Object.values(libraries));
    const data = {
      source: rev ? git('rev-parse', '--short', rev).trim() : 'working tree',
      corpus: `English synonyms of zh_terms.json at ${CORPUS_REV}, tags, categories, dimensions and edge cases`,
      scenarios: SCENARIOS,
      queries,
      libraries: snapshot(join(scriptDir, 'muse_local.py'), libraries, queries, dir),
    };
    const text = JSON.stringify(data, null, 2)
      // One query per line keeps the file reviewable.
      .replace(/\[\n\s+("[^"\n]*"),\n\s+("[^"\n]*"),\n\s+("[^"\n]*"),\n\s+("[^"\n]*")\n\s+\]/g, '[$1, $2, $3, $4]');
    writeFileSync(out, `${text}\n`);
    console.log(`${out}: ${queries.length} queries × ${SCENARIOS.length} scenario filters`
      + ` × ${Object.keys(libraries).length} libraries from ${data.source}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
