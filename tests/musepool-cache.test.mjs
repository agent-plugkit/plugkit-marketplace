// muse_local.py and scripts/sync-seeds.mjs: lookup, update, rollback, archive safety and failure
// paths. Uses only Node.js built-ins and Python 3 so it also runs on Windows CI.
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs, {
  chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import {
  check as checkSeedSnapshot, contentHash, readDirectory, readTarGz, sha256, sync,
} from '../scripts/sync-seeds.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const musepool = join(root, 'plugins/musekit/skills/musepool');
const seeds = join(musepool, 'seeds');
const script = join(musepool, 'scripts/muse_local.py');
const fixtures = join(root, 'tests/fixtures/musepool');
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const lock = JSON.parse(readFileSync(join(root, 'seeds.lock'), 'utf8'));
const index = JSON.parse(readFileSync(join(seeds, 'index.json'), 'utf8')).seeds;
const isolated = mkdtempSync(join(tmpdir(), 'musekit-cache-'));
process.on('exit', () => rmSync(isolated, { recursive: true, force: true }));

// Run muse_local.py with an empty cache, no overrides and no release check unless a test supplies them.
function museEnv(extra = {}) {
  const env = { ...process.env, MUSEPOOL_NO_UPDATE_CHECK: '1', MUSEKIT_CACHE_DIR: isolated, ...extra };
  for (const name of ['MUSEPOOL_SEEDS_DIR', 'MUSPRO_SEEDS_URL']) if (!(name in extra)) delete env[name];
  return env;
}

function cli(...args) {
  // Execute outside the skill directory to verify script-relative resource discovery.
  return execFileSync(python, [script, ...args], { cwd: root, encoding: 'utf8', env: museEnv() });
}

function muse(env, ...args) {
  return spawnSync(python, [script, ...args], { cwd: root, encoding: 'utf8', env: museEnv(env) });
}

function faulty(env, fault, ...args) {
  return spawnSync(python, ['-I', join(fixtures, 'fault.py'), script, fault, ...args], {
    cwd: root, encoding: 'utf8', env: museEnv(env),
  });
}

function scratch(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function writeManifest(path, fields) {
  writeFileSync(path, JSON.stringify({ name: 'muspro-seeds', schemaVersion: lock.schemaVersion, ...fields }));
}

// Build a release like Muspro Seeds does: <name>-<version>/ inside a tar.gz plus manifest.json.
function makeRelease(dir, version, { schemaVersion = lock.schemaVersion, gist, edit } = {}) {
  const library = join(dir, `library-${version}`);
  cpSync(seeds, library, { recursive: true });
  const data = JSON.parse(readFileSync(join(library, 'index.json'), 'utf8'));
  Object.assign(data, { version, schemaVersion });
  if (gist) data.seeds[0].gist = gist;
  edit?.(data);
  writeFileSync(join(library, 'index.json'), `${JSON.stringify(data, null, 2)}\n`);
  const release = join(dir, `release-${version}`);
  mkdirSync(release, { recursive: true });
  const tarball = `muspro-seeds-${version}.tar.gz`;
  execFileSync(python, ['-I', '-c',
    'import sys, tarfile\nwith tarfile.open(sys.argv[1], "w:gz", format=tarfile.USTAR_FORMAT) as t: t.add(sys.argv[2], arcname=sys.argv[3])',
    join(release, tarball), library, `muspro-seeds-${version}`]);
  const manifest = {
    name: 'muspro-seeds', version, schemaVersion, tarball,
    sha256: hashFile(join(release, tarball)),
    contentHash: contentHash(readDirectory(library)),
  };
  writeFileSync(join(release, 'manifest.json'), JSON.stringify(manifest));
  return { tar: join(release, tarball), release, manifest, library };
}

// An archive with verbatim member names plus a manifest whose sha256 matches, so rejection
// can only come from the archive contents.
function craftedRelease(dir, name, members) {
  const release = join(dir, name);
  mkdirSync(release, { recursive: true });
  const tar = join(release, `${name}.tar.gz`);
  writeFileSync(join(release, 'members.json'), JSON.stringify(members));
  execFileSync(python, ['-I', join(fixtures, 'make_tar.py'), tar, join(release, 'members.json')]);
  writeManifest(join(release, 'manifest.json'), {
    version: '9.9.9', tarball: `${name}.tar.gz`, sha256: hashFile(tar), contentHash: `sha256:${'0'.repeat(64)}`,
  });
  return tar;
}

function state(cache) {
  return JSON.parse(readFileSync(join(cache, 'seeds/state.json'), 'utf8'));
}

function installDirs(cache) {
  return readdirSync(join(cache, 'seeds')).filter((name) => /^\d+\.\d+\.\d+-/.test(name)).sort();
}

function leftovers(cache) {
  return readdirSync(join(cache, 'seeds')).filter((name) => name.startsWith('.') && name !== '.lock');
}

function firstLine(result) {
  return result.stdout.split('\n')[0];
}

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
  assert.ok(cli('search', 'no-such-reference-847261').includes('没有找到可靠参考'));
});

test('show returns full seed text by stable ID or filename fragment', () => {
  for (const entry of index) {
    const expected = readFileSync(join(seeds, ...entry.file.split('/')), 'utf8');
    assert.equal(cli('show', entry.id), expected);
  }
  const print = index.find((entry) => entry.id === 'mC1nkP2t');
  assert.equal(cli('show', 'editorial-print-system'), readFileSync(join(seeds, ...print.file.split('/')), 'utf8'));
});

test('invalid targets and retired category names return useful nonzero results', () => {
  for (const args of [['show', 'no-such-seed'], ['search', '   '], ['list', '--scenario', 'poster']]) {
    const result = muse({}, ...args);
    assert.equal(result.status, 2);
    assert.ok(result.stderr.trim());
    assert.ok(!result.stderr.includes('Traceback'));
  }
});

test('the bundled snapshot passes the seed check and a tampered copy does not', (t) => {
  assert.deepEqual(checkSeedSnapshot(), []);
  const copy = scratch(t, 'musekit-snapshot-');
  cpSync(seeds, copy, { recursive: true });
  assert.equal(contentHash(readDirectory(copy)), lock.contentHash);
  const file = join(copy, ...index[0].file.split('/'));
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n`);
  assert.notEqual(contentHash(readDirectory(copy)), lock.contentHash);
});

test('lookup order is MUSEPOOL_SEEDS_DIR, then the local cache, then the bundled snapshot', (t) => {
  const dir = scratch(t, 'musekit-lookup-');
  const cache = join(dir, 'cache');
  const bundled = muse({ MUSEKIT_CACHE_DIR: cache }, 'list');
  assert.equal(bundled.status, 0, bundled.stderr);
  assert.match(firstLine(bundled), new RegExp(`内置快照 · muspro-seeds ${lock.version}`));

  const { tar } = makeRelease(dir, '99.1.0', { gist: 'cache-marker gist' });
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', tar).status, 0);
  const cached = muse({ MUSEKIT_CACHE_DIR: cache }, 'list');
  assert.match(firstLine(cached), /本机缓存 · muspro-seeds 99\.1\.0/);
  assert.ok(cached.stdout.includes('cache-marker gist'));
  assert.match(muse({ MUSEKIT_CACHE_DIR: cache }, 'show', index[0].id).stderr, /本机缓存 · muspro-seeds 99\.1\.0/);

  const override = join(dir, 'override');
  cpSync(seeds, override, { recursive: true });
  const data = JSON.parse(readFileSync(join(override, 'index.json'), 'utf8'));
  data.seeds[0].gist = 'override-marker gist';
  data.version = '0.0.1';
  writeFileSync(join(override, 'index.json'), JSON.stringify(data));
  const env = muse({ MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: override }, 'list');
  assert.match(firstLine(env), /MUSEPOOL_SEEDS_DIR · muspro-seeds 0\.0\.1/);
  assert.ok(env.stdout.includes('override-marker gist'));

  const missing = muse({ MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: join(dir, 'nowhere') }, 'list');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /MUSEPOOL_SEEDS_DIR 不可用/);
  assert.ok(!missing.stderr.includes('Traceback'));
});

test('update --from installs a verified release and --rollback steps back to the bundled snapshot', (t) => {
  const dir = scratch(t, 'musekit-update-');
  const cache = join(dir, 'cache');
  const first = makeRelease(dir, '99.3.0');
  const second = makeRelease(dir, '99.4.0');

  const installed = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', first.tar);
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(state(cache).current.version, '99.3.0');
  assert.equal(state(cache).current.contentHash, first.manifest.contentHash);
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', second.tar).status, 0);
  assert.equal(state(cache).current.version, '99.4.0');
  assert.equal(state(cache).previous.version, '99.3.0');
  assert.match(muse({ MUSEKIT_CACHE_DIR: cache }, 'status').stdout, /已安装:99\.3\.0, 99\.4\.0/);

  const back = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--rollback');
  assert.equal(back.status, 0);
  assert.match(back.stdout, /已切回本机缓存 muspro-seeds 99\.3\.0/);
  assert.match(firstLine(muse({ MUSEKIT_CACHE_DIR: cache }, 'list')), /本机缓存 · muspro-seeds 99\.3\.0/);

  const bundled = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--rollback');
  assert.match(bundled.stdout, /已回到内置快照/);
  assert.equal(state(cache).current, null);
  assert.deepEqual(installDirs(cache), []);
  assert.match(firstLine(muse({ MUSEKIT_CACHE_DIR: cache }, 'list')), /内置快照/);
});

test('reinstalling the version in use writes a new directory and never moves the current one', (t) => {
  const dir = scratch(t, 'musekit-reinstall-');
  const cache = join(dir, 'cache');
  const release = makeRelease(dir, '99.1.0');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', release.tar).status, 0);
  const before = state(cache);

  // Promoting the staged copy fails: state.json and the installed directory stay as they were.
  const failed = faulty({ MUSEKIT_CACHE_DIR: cache }, 'rename-fails', 'update', '--from', release.tar);
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stderr, /无法写入缓存目录.*\n未做任何更改,继续使用 本机缓存 · muspro-seeds 99\.1\.0/);
  assert.deepEqual(state(cache), before);
  assert.deepEqual(installDirs(cache), [before.current.dir]);
  assert.deepEqual(leftovers(cache), []);

  // The process dies between promoting the copy and writing state.json.
  const crashed = faulty({ MUSEKIT_CACHE_DIR: cache }, 'crash-after-rename', 'update', '--from', release.tar);
  assert.equal(crashed.status, 9, crashed.stderr);
  assert.deepEqual(state(cache), before);
  assert.equal(installDirs(cache).length, 2);
  const survived = muse({ MUSEKIT_CACHE_DIR: cache }, 'list');
  assert.match(firstLine(survived), new RegExp(`本机缓存 · muspro-seeds 99\\.1\\.0.*${before.current.dir}`));
  assert.equal(survived.stderr, '');

  // Writing state.json fails: the new copy is removed and the old state kept.
  const unsaved = faulty({ MUSEKIT_CACHE_DIR: cache }, 'state-write-fails', 'update', '--from', release.tar);
  assert.equal(unsaved.status, 1, unsaved.stderr);
  assert.match(unsaved.stderr, /未做任何更改/);
  assert.deepEqual(state(cache), before);

  // A clean reinstall switches state.json to a fresh directory and clears what the crash left.
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', release.tar).status, 0);
  const after = state(cache);
  assert.notEqual(after.current.dir, before.current.dir);
  assert.deepEqual(installDirs(cache), [after.current.dir]);
  assert.deepEqual(leftovers(cache), []);
});

test('update and rollback refuse to run while another update holds the cache lock', (t) => {
  const dir = scratch(t, 'musekit-lock-');
  const cache = join(dir, 'cache');
  const first = makeRelease(dir, '99.1.0');
  const second = makeRelease(dir, '99.2.0');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', first.tar).status, 0);
  const before = state(cache);
  for (const args of [['update', '--from', second.tar], ['update', '--rollback']]) {
    const blocked = faulty({ MUSEKIT_CACHE_DIR: cache }, 'hold-lock', ...args);
    assert.equal(blocked.status, 1, blocked.stderr);
    assert.match(blocked.stderr, /另一个 update 或 rollback 正在修改本机缓存/);
    assert.match(blocked.stderr, /未做任何更改/);
    assert.deepEqual(state(cache), before);
  }
  assert.deepEqual(installDirs(cache), [before.current.dir]);
  // The lock is released with its holder.
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', second.tar).status, 0);
});

test('an unwritable cache leaves search working and explains MUSEKIT_CACHE_DIR', (t) => {
  const dir = scratch(t, 'musekit-readonly-');
  const blocker = join(dir, 'not-a-directory');
  writeFileSync(blocker, '');
  const cache = join(blocker, 'cache');
  const { tar } = makeRelease(dir, '99.1.0');
  for (const args of [['update', '--from', tar], ['update', '--rollback']]) {
    const result = muse({ MUSEKIT_CACHE_DIR: cache }, ...args);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /无法写入缓存目录.*MUSEKIT_CACHE_DIR/);
    assert.match(result.stderr, /继续使用 内置快照/);
    assert.ok(!result.stderr.includes('Traceback'));
  }
  const listed = muse({ MUSEKIT_CACHE_DIR: cache }, 'list');
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(firstLine(listed), /内置快照/);
});

test('offline installs require the matching manifest and verify it', (t) => {
  const dir = scratch(t, 'musekit-manifest-');
  const cache = join(dir, 'cache');
  const good = makeRelease(dir, '99.5.0');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', good.tar).status, 0);
  const before = state(cache);
  const expectRejected = (args, pattern) => {
    const result = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', ...args);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, pattern);
    assert.match(result.stderr, /未做任何更改,继续使用 本机缓存 · muspro-seeds 99\.5\.0/);
    assert.ok(!result.stderr.includes('Traceback'));
    assert.deepEqual(state(cache), before);
  };

  const bare = join(dir, 'bare');
  mkdirSync(bare);
  cpSync(makeRelease(dir, '99.6.0').tar, join(bare, 'muspro-seeds-99.6.0.tar.gz'));
  expectRejected(['--from', join(bare, 'muspro-seeds-99.6.0.tar.gz')], /找不到 .*manifest\.json.*--manifest/s);

  const renamed = makeRelease(dir, '99.7.0');
  const renamedTar = join(renamed.release, 'seeds.tar.gz');
  renameSync(renamed.tar, renamedTar);
  expectRejected(['--from', renamedTar], /描述的是 muspro-seeds-99\.7\.0\.tar\.gz.*--manifest/);
  const explicit = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', renamedTar,
    '--manifest', join(renamed.release, 'manifest.json'));
  assert.equal(explicit.status, 0, explicit.stderr);
  assert.equal(state(cache).current.version, '99.7.0');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--rollback').status, 0);

  const tampered = makeRelease(dir, '99.8.0');
  writeFileSync(join(tampered.release, 'manifest.json'), JSON.stringify({ ...tampered.manifest, sha256: '0'.repeat(64) }));
  expectRejected(['--from', tampered.tar], /sha256 校验失败/);
  writeFileSync(renamedTar, Buffer.concat([readFileSync(renamedTar), Buffer.from([0])]));
  expectRejected(['--from', renamedTar, '--manifest', join(renamed.release, 'manifest.json')], /sha256 校验失败/);

  const wrongContent = makeRelease(dir, '99.9.0');
  writeFileSync(join(wrongContent.release, 'manifest.json'),
    JSON.stringify({ ...wrongContent.manifest, contentHash: `sha256:${'1'.repeat(64)}` }));
  expectRejected(['--from', wrongContent.tar], /contentHash 校验失败/);

  const noContentHash = makeRelease(dir, '99.10.0');
  const { contentHash: _, ...partial } = noContentHash.manifest;
  writeFileSync(join(noContentHash.release, 'manifest.json'), JSON.stringify(partial));
  expectRejected(['--from', noContentHash.tar], /manifest\.json 缺少 contentHash/);
  assert.deepEqual(installDirs(cache), [before.current.dir]);
});

test('bad archives are rejected without touching the seeds in use', (t) => {
  const dir = scratch(t, 'musekit-bad-');
  const cache = join(dir, 'cache');
  const good = makeRelease(dir, '99.5.0');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', good.tar).status, 0);
  const before = state(cache);

  const expectRejected = (tar, pattern) => {
    const result = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', tar);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, pattern);
    assert.match(result.stderr, /未做任何更改,继续使用 本机缓存 · muspro-seeds 99\.5\.0/);
    assert.ok(!result.stderr.includes('Traceback'));
    assert.deepEqual(state(cache), before);
  };

  const garbage = join(dir, 'garbage');
  mkdirSync(garbage);
  writeFileSync(join(garbage, 'g.tar.gz'), 'not an archive');
  writeManifest(join(garbage, 'manifest.json'), {
    version: '9.9.9', tarball: 'g.tar.gz', sha256: hashFile(join(garbage, 'g.tar.gz')), contentHash: `sha256:${'0'.repeat(64)}`,
  });
  expectRejected(join(garbage, 'g.tar.gz'), /压缩包损坏/);

  const truncated = makeRelease(dir, '99.6.0');
  const whole = readFileSync(truncated.tar);
  writeFileSync(truncated.tar, whole.subarray(0, Math.floor(whole.length / 2)));
  writeFileSync(join(truncated.release, 'manifest.json'), JSON.stringify({ ...truncated.manifest, sha256: hashFile(truncated.tar) }));
  expectRejected(truncated.tar, /压缩包损坏/);

  expectRejected(makeRelease(dir, '99.8.0', { schemaVersion: '2.0.0' }).tar, /schemaVersion 2\.0\.0 .*不兼容/);
  expectRejected(makeRelease(dir, '99.9.0', { edit: (data) => delete data.seeds[0].category }).tar,
    /压缩包内容无效.*缺少 category/);

  const file = (name, data = 'x') => ({ name, data });
  const unsafe = {
    'posix-traversal': [file('pkg/../../evil.txt')],
    'backslash-traversal': [file('pkg/..\\..\\evil.txt')],
    'drive-letter': [file('pkg/C:\\outside\\evil.txt')],
    'drive-relative': [file('pkg/C:evil.txt')],
    'absolute': [file('/tmp/evil.txt')],
    'dot-segment': [file('pkg/./index.json')],
    'device-name': [file('pkg/CON.md')],
    'trailing-dot': [file('pkg/index.json.')],
  };
  for (const [name, members] of Object.entries(unsafe)) {
    expectRejected(craftedRelease(dir, name, members), /不安全路径/);
  }
  expectRejected(craftedRelease(dir, 'symlink', [{ name: 'pkg/index.json', type: 'symlink', link: '../../etc/passwd' }]),
    /不支持的条目类型/);
  expectRejected(craftedRelease(dir, 'hardlink', [file('pkg/a.md'), { name: 'pkg/b.md', type: 'hardlink', link: 'pkg/a.md' }]),
    /不支持的条目类型/);
  expectRejected(craftedRelease(dir, 'duplicate', [file('pkg/index.json', '{}'), file('pkg/index.json', '[]')]), /重复条目/);
  expectRejected(craftedRelease(dir, 'case-duplicate', [file('pkg/ui/A.md'), file('pkg/ui/a.md')]), /重复条目/);
  expectRejected(craftedRelease(dir, 'file-and-dir', [file('pkg/ui'), file('pkg/ui/a.md')]), /既是文件又是目录/);
  expectRejected(craftedRelease(dir, 'two-roots', [file('a/index.json'), file('b/index.json')]), /一个顶层目录/);

  for (const name of ['evil.txt', 'outside']) {
    assert.ok(!existsSync(join(cache, name)) && !existsSync(join(dir, name)) && !existsSync(join(cache, 'seeds', name)));
  }
  assert.deepEqual(installDirs(cache), [before.current.dir]);
  assert.deepEqual(leftovers(cache), []);
});

test('a damaged cache or state file falls back to the bundled snapshot', (t) => {
  const dir = scratch(t, 'musekit-fallback-');
  const cache = join(dir, 'cache');
  const release = makeRelease(dir, '99.2.0');
  const expectFallback = (pattern) => {
    for (const command of [['list'], ['search', 'typography'], ['show', index[0].id], ['status']]) {
      const result = muse({ MUSEKIT_CACHE_DIR: cache }, ...command);
      assert.equal(result.status, 0, `${command}: ${result.stderr}`);
      assert.ok(!result.stderr.includes('Traceback'), result.stderr);
      assert.match(result.stdout + result.stderr, pattern);
      if (command[0] === 'show') assert.match(result.stderr, /内置快照/);
      else assert.match(firstLine(result), /内置快照/);
    }
  };
  const reinstall = () => assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', release.tar).status, 0);
  const installed = (...parts) => join(cache, 'seeds', state(cache).current.dir, ...parts);

  reinstall();
  const seed = installed(...index[0].file.split('/'));
  writeFileSync(seed, `${readFileSync(seed, 'utf8')}\nedited after install\n`);
  expectFallback(/本机缓存 99\.2\.0 无法使用.*contentHash 不一致/);

  reinstall();
  rmSync(installed('index.json'));
  expectFallback(/本机缓存 99\.2\.0 无法使用.*找不到索引/);

  reinstall();
  const data = JSON.parse(readFileSync(installed('index.json'), 'utf8'));
  delete data.seeds[0].category;
  writeFileSync(installed('index.json'), JSON.stringify(data));
  expectFallback(/本机缓存 99\.2\.0 无法使用.*缺少 category/);

  reinstall();
  writeFileSync(installed(...index[1].file.split('/')), Buffer.from([0xff, 0xfe, 0x00]));
  expectFallback(/本机缓存 99\.2\.0 无法使用.*seed 无法读取/);

  reinstall();
  writeFileSync(join(cache, 'seeds/state.json'), Buffer.from([0x7b, 0xff, 0xfe, 0x7d]));
  expectFallback(/state\.json 无法读取/);
  reinstall();
  assert.equal(state(cache).current.version, '99.2.0');

  writeFileSync(join(cache, 'seeds/state.json'), JSON.stringify({ current: { dir: '../../outside', version: '99.2.0' } }));
  expectFallback(/current 记录无效/);

  const older = makeRelease(dir, '0.0.1');
  assert.equal(muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', older.tar).status, 0);
  expectFallback(/旧于内置快照/);
});

test('MUSEPOOL_SEEDS_DIR libraries with unsafe paths or malformed fields fail cleanly', (t) => {
  const dir = scratch(t, 'musekit-env-');
  const cases = {
    'backslash-file': [(data) => { data.seeds[0].file = 'ui\\..\\..\\secret.md'; }, /不安全的路径/],
    'drive-file': [(data) => { data.seeds[0].file = 'C:\\secret.md'; }, /不安全的路径/],
    'parent-file': [(data) => { data.seeds[0].file = '../secret.md'; }, /不安全的路径/],
    'no-category': [(data) => { delete data.seeds[0].category; }, /缺少 category/],
    'bad-scenario': [(data) => { data.seeds[0].scenario = 'poster'; }, /scenario poster/],
    'bad-novelty': [(data) => { data.seeds[0].scores = { novelty: 'high' }; }, /scores\.novelty/],
    'bad-dimensions': [(data) => { data.seeds[0].core_dimensions = [1, 2]; }, /core_dimensions/],
    'duplicate-id': [(data) => { data.seeds[1].id = data.seeds[0].id; }, /id 重复/],
  };
  for (const [name, [edit, pattern]] of Object.entries(cases)) {
    const library = join(dir, name);
    cpSync(seeds, library, { recursive: true });
    const data = JSON.parse(readFileSync(join(library, 'index.json'), 'utf8'));
    edit(data);
    writeFileSync(join(library, 'index.json'), JSON.stringify(data));
    const result = muse({ MUSEPOOL_SEEDS_DIR: library }, 'list');
    assert.equal(result.status, 2, `${name}: ${result.stdout}`);
    assert.match(result.stderr, /MUSEPOOL_SEEDS_DIR 不可用/);
    assert.match(result.stderr, pattern, name);
    assert.ok(!result.stderr.includes('Traceback'), result.stderr);
  }
});

test('MUSEPOOL_SEEDS_DIR seeds that link outside the library are refused', { skip: process.platform === 'win32' && 'symlinks need privileges on Windows' }, (t) => {
  const dir = scratch(t, 'musekit-link-');
  const library = join(dir, 'library');
  cpSync(seeds, library, { recursive: true });
  writeFileSync(join(dir, 'outside.md'), 'outside');
  const seed = join(library, ...index[0].file.split('/'));
  rmSync(seed);
  symlinkSync(join(dir, 'outside.md'), seed);
  const result = muse({ MUSEPOOL_SEEDS_DIR: library }, 'list');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /不安全的路径/);
});

test('online update downloads the latest release and explains when the network is unavailable', (t) => {
  const dir = scratch(t, 'musekit-online-');
  const cache = join(dir, 'cache');
  const mirror = join(dir, 'mirror');
  const { tar, manifest } = makeRelease(dir, '99.9.0');
  mkdirSync(join(mirror, 'releases/latest/download'), { recursive: true });
  mkdirSync(join(mirror, 'releases/download/v99.9.0'), { recursive: true });
  writeFileSync(join(mirror, 'releases/latest/download/manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(mirror, 'releases/download/v99.9.0/manifest.json'), JSON.stringify(manifest));
  cpSync(tar, join(mirror, 'releases/download/v99.9.0', manifest.tarball));

  const env = { MUSEKIT_CACHE_DIR: cache, MUSPRO_SEEDS_URL: pathToFileURL(mirror).href };
  const online = muse(env, 'update');
  assert.equal(online.status, 0, online.stderr);
  assert.match(firstLine(muse(env, 'list')), /本机缓存 · muspro-seeds 99\.9\.0/);
  assert.match(muse(env, 'update').stdout, /无需更新/);

  writeFileSync(join(mirror, 'releases/download/v99.9.0/manifest.json'), JSON.stringify({ ...manifest, version: '99.9.1' }));
  const mismatch = muse(env, 'update', '--version', '99.9.0');
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /描述的是 99\.9\.1,不是请求的 99\.9\.0/);

  const offline = muse({ MUSEKIT_CACHE_DIR: join(dir, 'empty'), MUSPRO_SEEDS_URL: 'http://127.0.0.1:9' }, 'update');
  assert.equal(offline.status, 1);
  assert.match(offline.stderr, /无法连接 .*禁止联网.*update --from/s);
  assert.match(offline.stderr, /继续使用 内置快照/);
  assert.ok(!offline.stderr.includes('Traceback'));
});

// spawnSync would block the event loop, so the local release server could not answer.
function museAsync(env, ...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script, ...args], { cwd: root, env: museEnv(env) });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('list and search hint at a newer release, cache the check for a day and stay silent on failure', async (t) => {
  const dir = scratch(t, 'musekit-hint-');
  // /<name>/releases/latest answers like GitHub: a redirect to the latest tag, or something unusable.
  const answers = {
    newer: [302, '/o/r/releases/tag/v99.0.0'], same: [302, `/o/r/releases/tag/v${lock.version}`],
    older: [302, '/o/r/releases/tag/v1.0.0'], broken: [500], untagged: [302, '/o/r/releases'],
  };
  const requests = [];
  const server = createServer((request, response) => {
    const name = request.url.split('/')[1];
    requests.push(`${request.method} ${request.url}`);
    const [code, location] = answers[name] ?? [404];
    response.writeHead(code, location ? { Location: `https://github.com${location}` } : {});
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = (name) => `http://127.0.0.1:${server.address().port}/${name}`;
  const checked = (name, extra = {}) => ({
    MUSEKIT_CACHE_DIR: join(dir, name), MUSPRO_SEEDS_URL: base(name), MUSEPOOL_NO_UPDATE_CHECK: '', ...extra,
  });
  const quiet = { list: muse({}, 'list'), search: muse({}, 'search', 'poster') };

  const list = await museAsync(checked('newer'), 'list');
  assert.equal(list.status, 0, list.stderr);
  const hint = `有新 seed 版本 99.0.0(当前 ${lock.version}),可让 musepool Skill 运行 \`update\` 更新`;
  assert.deepEqual(list.stdout.split('\n').slice(0, 2), [quiet.list.stdout.split('\n')[0], hint]);
  assert.equal(list.stdout.replace(`${hint}\n`, ''), quiet.list.stdout);
  assert.deepEqual(requests, ['HEAD /newer/releases/latest']);
  // Within 24 hours the cached answer is used without another request.
  const search = await museAsync(checked('newer'), 'search', 'poster');
  assert.equal(search.stdout, quiet.search.stdout.replace('\n', `\n${hint}\n`));
  assert.equal(requests.length, 1);
  const record = join(dir, 'newer', 'update-check.json');
  writeFileSync(record, JSON.stringify({ ...JSON.parse(readFileSync(record, 'utf8')), checked: Date.now() / 1000 - 25 * 3600 }));
  assert.match((await museAsync(checked('newer'), 'list')).stdout, /有新 seed 版本 99\.0\.0/);
  assert.equal(requests.length, 2);

  // The same or an older release, HTTP errors, unusable redirects and unreachable hosts change nothing.
  for (const name of ['same', 'older', 'broken', 'untagged']) {
    for (let run = 0; run < 2; run += 1) {
      const result = await museAsync(checked(name), 'list');
      assert.equal(result.status, 0, name);
      assert.equal(result.stdout, quiet.list.stdout, name);
      assert.equal(result.stderr, quiet.list.stderr, name);
    }
    // Failures are cached too, so an offline machine waits at most once a day.
    assert.equal(requests.filter((line) => line.includes(`/${name}/`)).length, 1, name);
  }
  const unreachable = await museAsync(checked('unreachable', { MUSPRO_SEEDS_URL: 'http://127.0.0.1:9' }), 'search', 'poster');
  assert.equal(unreachable.status, 0);
  assert.equal(unreachable.stdout, quiet.search.stdout);
  assert.equal(unreachable.stderr, quiet.search.stderr);

  // MUSEPOOL_NO_UPDATE_CHECK turns the check off; show and status never check.
  const before = requests.length;
  assert.equal((await museAsync(checked('off', { MUSEPOOL_NO_UPDATE_CHECK: '1' }), 'list')).stdout, quiet.list.stdout);
  await museAsync(checked('quiet'), 'status');
  await museAsync(checked('quiet'), 'show', index[0].id);
  assert.equal(requests.length, before);
  assert.ok(!existsSync(join(dir, 'off', 'update-check.json')));
});

// ---------------------------------------------------------------------------
// sync-seeds.mjs

function ustar(entries) {
  const blocks = [];
  for (const { name, type = '0', data = '' } of entries) {
    const bytes = Buffer.from(data);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, 'utf8');
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('00000000000\0', 136);
    header.write('        ', 148);
    header.write(type, 156);
    header.write('ustar\0', 257);
    header.write('00', 263);
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
    blocks.push(header, bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

test('sync-seeds rejects archive entries that are unsafe on any host', () => {
  assert.deepEqual(readTarGz(ustar([{ name: 'pkg/', type: '5' }, { name: 'pkg/ui/a.md', data: 'a' }])),
    [{ path: 'ui/a.md', bytes: Buffer.from('a') }]);
  const rejected = {
    'pkg/../../evil.txt': /Unsafe archive path/,
    'pkg/..\\..\\evil.txt': /Unsafe archive path/,
    'pkg/C:\\outside\\evil.txt': /Unsafe archive path/,
    'pkg/C:evil.txt': /Unsafe archive path/,
    '/tmp/evil.txt': /Unsafe archive path/,
    'pkg/./index.json': /Unsafe archive path/,
    'pkg/aux.txt': /Unsafe archive path/,
  };
  for (const [name, pattern] of Object.entries(rejected)) {
    assert.throws(() => readTarGz(ustar([{ name }])), pattern, name);
  }
  assert.throws(() => readTarGz(ustar([{ name: 'pkg/a', type: '2' }])), /Unsupported tar entry type "2"/);
  assert.throws(() => readTarGz(ustar([{ name: 'pkg/a', type: '1' }])), /Unsupported tar entry type "1"/);
  assert.throws(() => readTarGz(ustar([{ name: 'pkg/a.md' }, { name: 'pkg/A.md' }])), /Duplicate archive entry/);
  assert.throws(() => readTarGz(ustar([{ name: 'pkg/ui' }, { name: 'pkg/ui/a.md' }])), /both a file and a directory/);
  assert.throws(() => readTarGz(ustar([{ name: 'a/x' }, { name: 'b/x' }])), /exactly one top-level directory/);
});

// A throwaway repository holding only what sync-seeds reads and writes.
function seedRepo(t) {
  const dir = scratch(t, 'musekit-sync-');
  const repo = join(dir, 'repo');
  const references = join(repo, 'plugins/musekit/skills/musepool/references');
  mkdirSync(references, { recursive: true });
  cpSync(join(root, 'seeds.lock'), join(repo, 'seeds.lock'));
  cpSync(seeds, join(repo, lock.target), { recursive: true });
  cpSync(join(musepool, 'references/scenarios.md'), join(references, 'scenarios.md'));
  assert.deepEqual(checkSeedSnapshot(repo), []);
  const snapshot = () => ({
    lock: readFileSync(join(repo, 'seeds.lock')),
    scenarios: readFileSync(join(references, 'scenarios.md')),
    content: contentHash(readDirectory(join(repo, lock.target))),
    siblings: readdirSync(dirname(join(repo, lock.target))).sort(),
  });
  return { dir, repo, snapshot };
}

test('sync --lock pins a verified release and leaves everything untouched when verification fails', (t) => {
  const { dir, repo, snapshot } = seedRepo(t);
  const before = snapshot();

  const bad = makeRelease(dir, '1.0.1');
  writeFileSync(join(bad.release, 'manifest.json'), JSON.stringify({ ...bad.manifest, contentHash: `sha256:${'2'.repeat(64)}` }));
  assert.throws(() => sync({ root: repo, sourcePath: bad.release, pinning: true }), /contentHash .* does not match/);
  assert.deepEqual(snapshot(), before);

  writeFileSync(join(bad.release, 'manifest.json'), JSON.stringify({ ...bad.manifest, sha256: '0'.repeat(64) }));
  assert.throws(() => sync({ root: repo, sourcePath: bad.release, pinning: true }), /does not match/);
  assert.deepEqual(snapshot(), before);

  const good = makeRelease(dir, '1.0.2');
  sync({ root: repo, sourcePath: good.release, pinning: true });
  const pinned = JSON.parse(readFileSync(join(repo, 'seeds.lock'), 'utf8'));
  assert.equal(pinned.version, '1.0.2');
  assert.equal(pinned.sha256, good.manifest.sha256);
  assert.equal(pinned.contentHash, good.manifest.contentHash);
  assert.equal(contentHash(readDirectory(join(repo, lock.target))), good.manifest.contentHash);
  assert.deepEqual(checkSeedSnapshot(repo), []);
  assert.deepEqual(snapshot().siblings, before.siblings);
});

test('a failed write during sync restores the lock, snapshot and scenarios.md', { skip: process.getuid?.() === 0 && 'root ignores read-only files' }, (t) => {
  const { dir, repo, snapshot } = seedRepo(t);
  const before = snapshot();
  const good = makeRelease(dir, '1.0.3');
  chmodSync(join(repo, 'seeds.lock'), 0o444);
  try {
    assert.throws(() => sync({ root: repo, sourcePath: good.release, pinning: true }), /EACCES|EPERM/);
  } finally {
    chmodSync(join(repo, 'seeds.lock'), 0o644);
  }
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(checkSeedSnapshot(repo), []);
});

// Replace node:fs functions for every importer, sync-seeds.mjs included, until the test ends.
function injectFs(t, faults) {
  const originals = Object.fromEntries(Object.keys(faults).map((name) => [name, fs[name]]));
  for (const [name, fault] of Object.entries(faults)) {
    fs[name] = (...args) => fault(originals[name], ...args);
  }
  syncBuiltinESMExports();
  const restore = () => {
    Object.assign(fs, originals);
    syncBuiltinESMExports();
  };
  t.after(restore);
  return restore;
}

function fsError(code, path) {
  return Object.assign(new Error(`${code}: injected fault, '${path}'`), { code });
}

test('an injected lock write failure restores the snapshot and removes the backup', (t) => {
  const { dir, repo, snapshot } = seedRepo(t);
  const before = snapshot();
  const good = makeRelease(dir, '1.0.4');
  injectFs(t, {
    writeFileSync: (original, path, ...rest) => {
      if (path === join(repo, 'seeds.lock')) throw fsError('EIO', path);
      return original(path, ...rest);
    },
  });
  assert.throws(() => sync({ root: repo, sourcePath: good.release, pinning: true }), (error) => {
    assert.match(error.message, /EIO: injected fault/);
    assert.doesNotMatch(error.message, /also failed|kept at/);
    return true;
  });
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(checkSeedSnapshot(repo), []);
});

test('when restoring the snapshot fails, sync keeps the backup and reports where it is', (t) => {
  const { dir, repo, snapshot } = seedRepo(t);
  const before = snapshot();
  const target = join(repo, lock.target);
  const good = makeRelease(dir, '1.0.5');
  const restoreFs = injectFs(t, {
    writeFileSync: (original, path, ...rest) => {
      if (path === join(repo, 'seeds.lock')) throw fsError('EIO', path);
      return original(path, ...rest);
    },
    rmSync: (original, path, ...rest) => {
      if (path === target) throw fsError('EBUSY', path);
      return original(path, ...rest);
    },
  });
  let backup;
  assert.throws(() => sync({ root: repo, sourcePath: good.release, pinning: true }), (error) => {
    assert.match(error.message, /EIO: injected fault/);
    assert.match(error.message, /Restoring the previous snapshot also failed: EBUSY/);
    backup = error.message.match(/previous snapshot is kept at (.+); move it to (.+) by hand/)?.[1];
    assert.ok(backup, error.message);
    return true;
  });
  // The backup holds the untouched previous snapshot; seeds.lock and scenarios.md are still restored.
  assert.equal(dirname(backup), dirname(target));
  assert.equal(contentHash(readDirectory(backup)), before.content);
  assert.deepEqual(readFileSync(join(repo, 'seeds.lock')), before.lock);
  assert.deepEqual(readFileSync(join(repo, 'plugins/musekit/skills/musepool/references/scenarios.md')), before.scenarios);
  assert.equal(contentHash(readDirectory(target)), good.manifest.contentHash);
  assert.ok(!readdirSync(dirname(target)).some((name) => name.startsWith('.seeds-staging-')));

  // Following the message by hand brings the repository back to where it started.
  restoreFs();
  rmSync(target, { recursive: true, force: true });
  renameSync(backup, target);
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(checkSeedSnapshot(repo), []);
});

test('sync and --check reject an index.json that is not an object with a seeds list', (t) => {
  const { dir, repo, snapshot } = seedRepo(t);
  const before = snapshot();
  const target = join(repo, lock.target);
  const shapes = ['null', 'false', '0', '""', '[]', '{}', '{"seeds":null}', '{"seeds":{}}'];
  for (const [i, shape] of shapes.entries()) {
    // An unpacked library whose contentHash seeds.lock pins, so only the index shape can fail.
    const library = join(dir, `library-${i}`);
    cpSync(seeds, library, { recursive: true });
    writeFileSync(join(library, 'index.json'), shape);
    const pinned = { ...lock, contentHash: contentHash(readDirectory(library)) };
    writeFileSync(join(repo, 'seeds.lock'), `${JSON.stringify(pinned, null, 2)}\n`);
    assert.throws(() => sync({ root: repo, sourcePath: library }), /^Error: index\.json must be an object with a seeds list$/, shape);
    assert.deepEqual(readdirSync(dirname(target)).sort(), before.siblings, shape);
    assert.equal(contentHash(readDirectory(target)), before.content, shape);

    writeFileSync(join(target, 'index.json'), shape);
    assert.deepEqual(checkSeedSnapshot(repo), ['index.json must be an object with a seeds list'], shape);
    cpSync(join(seeds, 'index.json'), join(target, 'index.json'));
  }
  writeFileSync(join(repo, 'seeds.lock'), before.lock);
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(checkSeedSnapshot(repo), []);
});
