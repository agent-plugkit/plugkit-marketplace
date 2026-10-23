import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';
import { planLocalRelease } from 'agent-plugkit/dist/application/local-release.js';
import { check as checkSeedSnapshot, contentHash, readDirectory } from '../scripts/sync-seeds.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const plugin = join(root, 'plugins/musekit');
const library = join(plugin, 'skills/musepool');
const seeds = join(library, 'seeds');
const lock = JSON.parse(readFileSync(join(root, 'seeds.lock'), 'utf8'));
const snapshot = JSON.parse(readFileSync(join(seeds, 'index.json'), 'utf8'));
const index = snapshot.seeds;
const config = parse(readFileSync(join(plugin, 'plugin.yaml'), 'utf8'));
const skillNames = ['musepool', 'ui-design', 'graphic-design', 'diagram-design', 'scientific-figure', 'article-illustration'];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function frontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  assert.ok(match, `Missing frontmatter: ${relative(root, path)}`);
  return parse(match[1]);
}

test('bundled snapshot matches seeds.lock and index metadata matches bundled files', () => {
  assert.deepEqual(checkSeedSnapshot(), []);
  assert.equal(snapshot.version, lock.version);
  assert.equal(snapshot.schemaVersion, lock.schemaVersion);
  assert.equal(contentHash(readDirectory(seeds)), lock.contentHash);
  assert.ok(index.length > 0);
  assert.equal(new Set(index.map((entry) => entry.id)).size, index.length);
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

test('declared skills are discoverable and all local Markdown references are bundled', () => {
  assert.equal(config.name, 'musekit');
  assert.match(config.version, /^\d+\.\d+\.\d+$/);
  const article = frontmatter(join(plugin, 'skills/article-illustration/SKILL.md'));
  assert.match(article.description, /整篇/);
  assert.match(article.description, /公众号排版/);
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
    '.grok-plugin/marketplace.json',
  ]) {
    const entries = JSON.parse(readFileSync(join(root, path), 'utf8')).plugins;
    assert.deepEqual(entries.map((entry) => entry.name).sort(), ['agent-wake', 'musekit', 'plugkit'], path);
    const entry = entries.find((item) => item.name === 'musekit');
    const source = typeof entry.source === 'string' ? entry.source : entry.source.path;
    assert.equal(source, './plugins/musekit', path);
    if ('version' in entry) assert.equal(entry.version, config.version, path);
  }
  const portable = JSON.parse(readFileSync(join(plugin, 'plugin.json'), 'utf8'));
  assert.equal(portable.name, 'musekit');
  assert.equal(portable.version, config.version);
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
    const name = relative(root, path).split(sep).join('/');
    assert.ok(bundled.has(name), `Missing from package: ${name}`);
    assert.deepEqual(bundled.get(name), readFileSync(path), `Package content differs: ${name}`);
  }
  assert.ok(bundled.has('plugins/musekit/references/seed-brief.md'));
  for (const name of bundled.keys()) {
    assert.ok(!/^plugins\/(musepool|design-compile|mermaid-render)\//.test(name));
  }
});

test('seed IDs named by examples and the shared brief exist in the bundled snapshot', () => {
  const ids = new Set(index.map((entry) => entry.id));
  const cited = new Set();
  const documents = [
    join(plugin, 'references/seed-brief.md'),
    ...walk(join(plugin, 'skills')).filter((path) => /\/references\/examples\.md$/.test(path.split(sep).join('/'))),
  ];
  for (const path of documents) {
    for (const [, id] of readFileSync(path, 'utf8').matchAll(/`([A-Za-z0-9]{8})`/g)) {
      // Seed IDs mix case or digits; plain lowercase words such as `musepool` are not IDs.
      if (/[A-Z0-9]/.test(id)) cited.add(id);
    }
  }
  assert.ok(cited.has('mC1nkP2t') && cited.has('Yoiov5EL'));
  for (const id of cited) assert.ok(ids.has(id), `Example cites unknown seed ${id}`);
});
