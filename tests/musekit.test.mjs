import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';
import { planLocalRelease } from 'agent-plugkit/dist/application/local-release.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const plugin = join(root, 'plugins/musekit');
const library = join(plugin, 'skills/musepool');
const seeds = join(library, 'seeds');
const script = join(library, 'scripts/muse_local.py');
const index = JSON.parse(readFileSync(join(seeds, 'index.json'), 'utf8'));
const skillNames = ['musepool', 'ui-design', 'graphic-design', 'diagram-design', 'scientific-figure'];
const preservedIds = [
  'vEj9F5om', 'rvYJrbZh', 'weZM545X', 'x1BNQPTi', 'swwKiFDe',
  'JiAIwOJv', 'LjwyQI6U', 'Vy3KTWAC', 'AT5oq8hX', 'B3LYgTWe', 'mC1nkP2t',
  'pu9ToBED', 'G26LBSOO', 'C4aZtWoH', 'haYCh1wI', 'H9aLYT6s',
  'pibXRzsG', 'rVQmfOqR', 'Nv0J2QBT', 'FpA0MHDV', 'tTceao0M',
  't2Q6D5JR', '1JlUSoIP', 'Yoiov5EL', 'upXsOXv8', 'lC4BpOAk',
  'o0W3sQmk', 'tVghVsn2', 'GzPJkoac',
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function frontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  assert.ok(match, `Missing frontmatter: ${relative(root, path)}`);
  return parse(match[1]);
}

function cli(...args) {
  // Execute outside the skill directory to verify script-relative resource discovery.
  return execFileSync('python3', [script, ...args], { cwd: root, encoding: 'utf8' });
}

test('all 29 seed identities survive and registry metadata matches bundled files', () => {
  assert.equal(index.length, preservedIds.length);
  assert.deepEqual(new Set(index.map((entry) => entry.id)), new Set(preservedIds));
  assert.equal(new Set(index.map((entry) => entry.file)).size, index.length);
  assert.deepEqual(new Set(index.map((entry) => entry.scenario)), new Set(['ui', 'graphic', 'information']));
  for (const entry of index) {
    const path = resolve(seeds, entry.file);
    assert.ok(!relative(seeds, path).startsWith('..'));
    const metadata = frontmatter(path);
    assert.equal(metadata.id, entry.id);
    assert.equal(metadata.scenario, entry.scenario);
    assert.equal(entry.file.split('/')[0], entry.scenario);
    assert.deepEqual(metadata.core_dimensions, entry.core_dimensions);
  }
  const files = walk(seeds).filter((path) => path.endsWith('.md'));
  assert.deepEqual(new Set(files), new Set(index.map((entry) => resolve(seeds, entry.file))));
});

test('list partitions all seeds into the three public categories', () => {
  const all = cli('list');
  for (const entry of index) assert.ok(all.includes(entry.id));
  for (const scenario of ['ui', 'graphic', 'information']) {
    const output = cli('list', '--scenario', scenario);
    for (const entry of index) {
      assert.equal(output.includes(entry.id), entry.scenario === scenario, `${scenario}: ${entry.id}`);
    }
  }
});

test('search finds references across categories and respects a category filter', () => {
  const all = cli('search', 'typography', '-n', '40');
  for (const scenario of ['ui', 'graphic', 'information']) assert.ok(all.includes(`[${scenario}]`));
  const filtered = cli('search', 'typography', '--scenario', 'graphic', '-n', '40');
  assert.ok(filtered.includes('[graphic]'));
  assert.ok(!filtered.includes('[ui]'));
  assert.ok(!filtered.includes('[information]'));
  assert.ok(cli('search', 'no-such-reference-847261').includes('无命中'));
});

test('show returns full seed text by stable ID or filename fragment', () => {
  for (const entry of index) {
    const expected = readFileSync(join(seeds, entry.file), 'utf8');
    assert.equal(cli('show', entry.id), expected);
  }
  const print = index.find((entry) => entry.id === 'mC1nkP2t');
  assert.equal(cli('show', 'editorial-print-system'), readFileSync(join(seeds, print.file), 'utf8'));
});

test('invalid targets and retired category names return useful nonzero results', () => {
  for (const args of [['show', 'no-such-seed'], ['search', '   '], ['list', '--scenario', 'poster']]) {
    const result = spawnSync('python3', [script, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.ok(result.stderr.trim());
    assert.ok(!result.stderr.includes('Traceback'));
  }
});

test('five declared skills are discoverable and all local Markdown references are bundled', () => {
  const config = parse(readFileSync(join(plugin, 'plugin.yaml'), 'utf8'));
  assert.equal(config.name, 'musekit');
  assert.equal(config.version, '0.1.0');
  assert.deepEqual(config.components.skills.map((skill) => skill.name), skillNames);
  assert.deepEqual(new Set(readdirSync(join(plugin, 'skills'))), new Set(skillNames));
  for (const skill of config.components.skills) {
    const directory = resolve(plugin, skill.path);
    assert.ok(!relative(plugin, directory).startsWith('..'));
    const metadata = frontmatter(join(directory, 'SKILL.md'));
    assert.equal(metadata.name, skill.name);
    assert.ok(metadata.description.length > 0);
  }
  for (const path of walk(plugin).filter((path) => path.endsWith('.md'))) {
    for (const match of readFileSync(path, 'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      const destination = resolve(dirname(path), decodeURIComponent(target));
      assert.ok(!relative(plugin, destination).startsWith('..'), `${relative(plugin, path)} escapes plugin: ${target}`);
      assert.ok(existsSync(destination), `${relative(plugin, path)} has missing reference: ${target}`);
    }
  }
});

test('generated client indexes replace old design plugins and keep portable metadata clean', () => {
  for (const path of [
    'marketplace.json', '.github/plugin/marketplace.json', '.cursor-plugin/marketplace.json',
    '.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json',
  ]) {
    const entries = JSON.parse(readFileSync(join(root, path), 'utf8')).plugins;
    assert.deepEqual(entries.map((entry) => entry.name).sort(), ['musekit', 'plugkit'], path);
    const entry = entries.find((item) => item.name === 'musekit');
    const source = typeof entry.source === 'string' ? entry.source : entry.source.path;
    assert.equal(source, './plugins/musekit', path);
  }
  const portable = JSON.parse(readFileSync(join(plugin, 'plugin.json'), 'utf8'));
  assert.equal(portable.name, 'musekit');
  assert.equal(portable.version, '0.1.0');
  for (const field of ['interface', 'platform', 'category']) assert.ok(!(field in portable));
  const codex = JSON.parse(readFileSync(join(plugin, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(resolve(plugin, codex.skills), join(plugin, 'skills'));
  for (const old of ['musepool', 'design-compile', 'mermaid-render']) {
    assert.ok(!existsSync(join(root, 'plugins', old)));
  }
});

test('local release inventory contains every Musekit source and shared reference', () => {
  // Inspect the CLI packaging plan without creating a release or archive.
  const plan = planLocalRelease(root);
  const bundled = new Map(plan.releaseEntries
    .filter((entry) => entry.kind === 'file')
    .map((entry) => [entry.releaseRelativePath, entry.bytes]));
  for (const path of walk(plugin)) {
    const name = relative(root, path);
    assert.ok(bundled.has(name), `Missing from package: ${name}`);
    assert.deepEqual(bundled.get(name), readFileSync(path), `Package content differs: ${name}`);
  }
  assert.ok(bundled.has('plugins/musekit/references/seed-brief.md'));
  for (const name of bundled.keys()) {
    assert.ok(!/^plugins\/(musepool|design-compile|mermaid-render)\//.test(name));
  }
});
