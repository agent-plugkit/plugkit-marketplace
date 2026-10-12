import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';
import { planLocalRelease } from 'agent-plugkit/dist/application/local-release.js';
import { check as checkSeedSnapshot, contentHash, readDirectory, sha256 } from '../scripts/sync-seeds.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const plugin = join(root, 'plugins/musekit');
const library = join(plugin, 'skills/musepool');
const seeds = join(library, 'seeds');
const script = join(library, 'scripts/muse_local.py');
const lock = JSON.parse(readFileSync(join(root, 'seeds.lock'), 'utf8'));
const snapshot = JSON.parse(readFileSync(join(seeds, 'index.json'), 'utf8'));
const index = snapshot.seeds;
const skillNames = ['musepool', 'ui-design', 'graphic-design', 'diagram-design', 'scientific-figure', 'article-illustration'];
const isolated = mkdtempSync(join(tmpdir(), 'musekit-cache-'));
process.on('exit', () => rmSync(isolated, { recursive: true, force: true }));

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

// Run muse_local.py with an empty cache and no overrides unless a test supplies them.
function museEnv(extra = {}) {
  const env = { ...process.env, MUSEKIT_CACHE_DIR: isolated, ...extra };
  for (const name of ['MUSEPOOL_SEEDS_DIR', 'MUSPRO_SEEDS_URL']) if (!(name in extra)) delete env[name];
  return env;
}

function cli(...args) {
  // Execute outside the skill directory to verify script-relative resource discovery.
  return execFileSync('python3', [script, ...args], { cwd: root, encoding: 'utf8', env: museEnv() });
}

function muse(env, ...args) {
  return spawnSync('python3', [script, ...args], { cwd: root, encoding: 'utf8', env: museEnv(env) });
}

function scratch(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Build a release like Muspro Seeds does: <name>-<version>/ inside a tar.gz plus manifest.json.
function makeRelease(dir, version, { schemaVersion = lock.schemaVersion, gist } = {}) {
  const library = join(dir, `library-${version}`);
  cpSync(seeds, library, { recursive: true });
  const data = JSON.parse(readFileSync(join(library, 'index.json'), 'utf8'));
  Object.assign(data, { version, schemaVersion });
  if (gist) data.seeds[0].gist = gist;
  writeFileSync(join(library, 'index.json'), `${JSON.stringify(data, null, 2)}\n`);
  const release = join(dir, `release-${version}`);
  mkdirSync(release, { recursive: true });
  const tarball = `muspro-seeds-${version}.tar.gz`;
  execFileSync('python3', ['-I', '-c',
    'import sys, tarfile\nwith tarfile.open(sys.argv[1], "w:gz") as t: t.add(sys.argv[2], arcname=sys.argv[3])',
    join(release, tarball), library, `muspro-seeds-${version}`]);
  const manifest = {
    name: 'muspro-seeds', version, schemaVersion, tarball,
    sha256: sha256(readFileSync(join(release, tarball))),
    contentHash: contentHash(readDirectory(library)),
  };
  writeFileSync(join(release, 'manifest.json'), JSON.stringify(manifest));
  return { tar: join(release, tarball), release, manifest };
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

test('declared skills are discoverable and all local Markdown references are bundled', () => {
  const config = parse(readFileSync(join(plugin, 'plugin.yaml'), 'utf8'));
  assert.equal(config.name, 'musekit');
  assert.equal(config.version, '0.5.1');
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
  ]) {
    const entries = JSON.parse(readFileSync(join(root, path), 'utf8')).plugins;
    assert.deepEqual(entries.map((entry) => entry.name).sort(), ['musekit', 'plugkit'], path);
    const entry = entries.find((item) => item.name === 'musekit');
    const source = typeof entry.source === 'string' ? entry.source : entry.source.path;
    assert.equal(source, './plugins/musekit', path);
  }
  const portable = JSON.parse(readFileSync(join(plugin, 'plugin.json'), 'utf8'));
  assert.equal(portable.name, 'musekit');
  assert.equal(portable.version, '0.5.1');
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

test('seed IDs named by examples and the shared brief exist in the bundled snapshot', () => {
  const ids = new Set(index.map((entry) => entry.id));
  const cited = new Set();
  const documents = [
    join(plugin, 'references/seed-brief.md'),
    ...walk(join(plugin, 'skills')).filter((path) => /\/references\/examples\.md$/.test(path)),
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

test('a tampered snapshot no longer matches the content hash pinned in seeds.lock', (t) => {
  const copy = scratch(t, 'musekit-snapshot-');
  cpSync(seeds, copy, { recursive: true });
  assert.equal(contentHash(readDirectory(copy)), lock.contentHash);
  writeFileSync(join(copy, index[0].file), `${readFileSync(join(copy, index[0].file), 'utf8')}\n`);
  assert.notEqual(contentHash(readDirectory(copy)), lock.contentHash);
});

test('lookup order is MUSEPOOL_SEEDS_DIR, then the local cache, then the bundled snapshot', (t) => {
  const dir = scratch(t, 'musekit-lookup-');
  const cache = join(dir, 'cache');
  const bundled = muse({ MUSEKIT_CACHE_DIR: cache }, 'list');
  assert.equal(bundled.status, 0, bundled.stderr);
  assert.match(bundled.stdout.split('\n')[0], new RegExp(`内置快照 · muspro-seeds ${lock.version}`));

  const { tar } = makeRelease(dir, '99.1.0', { gist: 'cache-marker gist' });
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', tar).status, 0);
  const cached = muse({ MUSEKIT_CACHE_DIR: cache }, 'list');
  assert.match(cached.stdout.split('\n')[0], /本机缓存 · muspro-seeds 99\.1\.0/);
  assert.ok(cached.stdout.includes('cache-marker gist'));
  assert.match(muse({ MUSEKIT_CACHE_DIR: cache }, 'show', index[0].id).stderr, /本机缓存 · muspro-seeds 99\.1\.0/);

  const override = join(dir, 'override');
  cpSync(seeds, override, { recursive: true });
  const data = JSON.parse(readFileSync(join(override, 'index.json'), 'utf8'));
  data.seeds[0].gist = 'override-marker gist';
  data.version = '0.0.1';
  writeFileSync(join(override, 'index.json'), JSON.stringify(data));
  const env = muse({ MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: override }, 'list');
  assert.match(env.stdout.split('\n')[0], /MUSEPOOL_SEEDS_DIR · muspro-seeds 0\.0\.1/);
  assert.ok(env.stdout.includes('override-marker gist'));

  const missing = muse({ MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: join(dir, 'nowhere') }, 'list');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /MUSEPOOL_SEEDS_DIR 不可用/);
  assert.ok(!missing.stderr.includes('Traceback'));
});

test('a damaged, incompatible or older cache falls back to the bundled snapshot', (t) => {
  const dir = scratch(t, 'musekit-fallback-');
  const cache = join(dir, 'cache');
  const { tar } = makeRelease(dir, '99.2.0');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', tar).status, 0);
  rmSync(join(cache, 'seeds/99.2.0/index.json'));
  const damaged = muse({ MUSEKIT_CACHE_DIR: cache }, 'list');
  assert.equal(damaged.status, 0);
  assert.match(damaged.stdout.split('\n')[0], /内置快照/);
  assert.match(damaged.stderr, /本机缓存 99\.2\.0 无法使用/);

  const older = makeRelease(dir, '0.0.1');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', older.tar).status, 0);
  const shadowed = muse({ MUSEKIT_CACHE_DIR: cache }, 'list');
  assert.match(shadowed.stdout.split('\n')[0], /内置快照/);
  assert.match(shadowed.stderr, /旧于内置快照/);
});

test('update --from installs a verified release and --rollback steps back to the bundled snapshot', (t) => {
  const dir = scratch(t, 'musekit-update-');
  const cache = join(dir, 'cache');
  const first = makeRelease(dir, '99.3.0');
  const second = makeRelease(dir, '99.4.0');

  const installed = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', first.tar);
  assert.equal(installed.status, 0, installed.stderr);
  assert.ok(!installed.stdout.includes('跳过 sha256'));
  assert.equal(readFileSync(join(cache, 'seeds/current'), 'utf8').trim(), '99.3.0');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', second.tar).status, 0);
  assert.equal(readFileSync(join(cache, 'seeds/current'), 'utf8').trim(), '99.4.0');
  assert.equal(readFileSync(join(cache, 'seeds/previous'), 'utf8').trim(), '99.3.0');
  assert.match(muse({ MUSEKIT_CACHE_DIR: cache }, 'status').stdout, /已安装:99\.3\.0, 99\.4\.0/);

  const back = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--rollback');
  assert.equal(back.status, 0);
  assert.match(back.stdout, /已切回本机缓存 muspro-seeds 99\.3\.0/);
  assert.match(muse({ MUSEKIT_CACHE_DIR: cache }, 'list').stdout.split('\n')[0], /本机缓存 · muspro-seeds 99\.3\.0/);

  const bundled = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--rollback');
  assert.match(bundled.stdout, /已回到内置快照/);
  assert.ok(!existsSync(join(cache, 'seeds/current')));
  assert.match(muse({ MUSEKIT_CACHE_DIR: cache }, 'list').stdout.split('\n')[0], /内置快照/);
});

test('bad archives are rejected without touching the seeds in use', (t) => {
  const dir = scratch(t, 'musekit-bad-');
  const cache = join(dir, 'cache');
  const good = makeRelease(dir, '99.5.0');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', good.tar).status, 0);

  const expectRejected = (args, pattern) => {
    const result = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', ...args);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, pattern);
    assert.match(result.stderr, /未做任何更改,继续使用 本机缓存 · muspro-seeds 99\.5\.0/);
    assert.ok(!result.stderr.includes('Traceback'));
    assert.equal(readFileSync(join(cache, 'seeds/current'), 'utf8').trim(), '99.5.0');
  };

  const garbage = join(dir, 'garbage.tar.gz');
  writeFileSync(garbage, 'not an archive');
  expectRejected(['--from', garbage], /压缩包损坏/);

  const truncated = join(dir, 'truncated', 'muspro-seeds-99.6.0.tar.gz');
  mkdirSync(dirname(truncated));
  const whole = readFileSync(makeRelease(dir, '99.6.0').tar);
  writeFileSync(truncated, whole.subarray(0, Math.floor(whole.length / 2)));
  expectRejected(['--from', truncated], /压缩包损坏/);

  const tampered = makeRelease(dir, '99.7.0');
  writeFileSync(join(tampered.release, 'manifest.json'), JSON.stringify({ ...tampered.manifest, sha256: '0'.repeat(64) }));
  expectRejected(['--from', tampered.tar], /sha256 校验失败/);

  const future = makeRelease(dir, '99.8.0', { schemaVersion: '2.0.0' });
  expectRejected(['--from', future.tar], /schemaVersion 2\.0\.0 .*不兼容/);

  const escape = join(dir, 'escape.tar.gz');
  execFileSync('python3', ['-I', '-c', [
    'import io, sys, tarfile',
    'with tarfile.open(sys.argv[1], "w:gz") as t:',
    '    info = tarfile.TarInfo("muspro-seeds-9.9.9/../../evil.txt"); info.size = 1',
    '    t.addfile(info, io.BytesIO(b"x"))',
  ].join('\n'), escape]);
  expectRejected(['--from', escape], /不安全路径/);
  assert.ok(!existsSync(join(cache, 'evil.txt')) && !existsSync(join(dir, 'evil.txt')));
  assert.deepEqual(readdirSync(join(cache, 'seeds')).filter((name) => name.startsWith('.')), []);
});

test('online update downloads the latest release and explains when the network is unavailable', (t) => {
  const dir = scratch(t, 'musekit-online-');
  const cache = join(dir, 'cache');
  const mirror = join(dir, 'mirror');
  const { tar, manifest } = makeRelease(dir, '99.9.0');
  mkdirSync(join(mirror, 'releases/latest/download'), { recursive: true });
  mkdirSync(join(mirror, 'releases/download/v99.9.0'), { recursive: true });
  writeFileSync(join(mirror, 'releases/latest/download/manifest.json'), JSON.stringify(manifest));
  cpSync(tar, join(mirror, 'releases/download/v99.9.0', manifest.tarball));

  const env = { MUSEKIT_CACHE_DIR: cache, MUSPRO_SEEDS_URL: pathToFileURL(mirror).href };
  const online = muse(env, 'update');
  assert.equal(online.status, 0, online.stderr);
  assert.match(muse(env, 'list').stdout.split('\n')[0], /本机缓存 · muspro-seeds 99\.9\.0/);
  assert.match(muse(env, 'update').stdout, /无需更新/);

  const offline = muse({ MUSEKIT_CACHE_DIR: join(dir, 'empty'), MUSPRO_SEEDS_URL: 'http://127.0.0.1:9' }, 'update');
  assert.equal(offline.status, 1);
  assert.match(offline.stderr, /无法连接 .*禁止联网.*update --from/s);
  assert.match(offline.stderr, /继续使用 内置快照/);
  assert.ok(!offline.stderr.includes('Traceback'));
});
