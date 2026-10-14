// muse_local.py search: Chinese queries, English ranking stability, and the warning for a
// MUSEPOOL_SEEDS_DIR that points at the bundled snapshot while the cache holds a newer release.
// Uses only Node.js built-ins and Python 3 so it also runs on Windows CI.
//
// Set MUSEKIT_TEST_RELEASE_DIR to a directory holding a real Muspro Seeds >= 1.3.0 release
// (manifest.json plus its tar.gz) to repeat the Chinese queries against that release as well.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { contentHash, readDirectory } from '../scripts/sync-seeds.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const musepool = join(root, 'plugins/musekit/skills/musepool');
const seeds = join(musepool, 'seeds');
const script = join(musepool, 'scripts/muse_local.py');
const zhTermsPath = join(musepool, 'scripts/zh_terms.json');
const fixtures = join(root, 'tests/fixtures/musepool');
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const lock = JSON.parse(readFileSync(join(root, 'seeds.lock'), 'utf8'));
const realRelease = process.env.MUSEKIT_TEST_RELEASE_DIR;
const isolated = mkdtempSync(join(tmpdir(), 'musekit-search-'));
process.on('exit', () => rmSync(isolated, { recursive: true, force: true }));

function museEnv(extra = {}) {
  const env = { ...process.env, MUSEKIT_CACHE_DIR: join(isolated, 'empty-cache'), ...extra };
  for (const name of ['MUSEPOOL_SEEDS_DIR', 'MUSPRO_SEEDS_URL']) if (!(name in extra)) delete env[name];
  return env;
}

function muse(env, ...args) {
  return spawnSync(python, [script, ...args], { cwd: root, encoding: 'utf8', env: museEnv(env) });
}

function scratch(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function firstLine(result) {
  return result.stdout.split('\n')[0];
}

// Seed IDs in result order.
function ranked(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stderr.includes('Traceback'), result.stderr);
  return [...result.stdout.matchAll(/^[★ ] \[[a-z]+\] (\S+) /gm)].map((match) => match[1]);
}

function readLibrary(dir) {
  const data = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
  const scenarios = JSON.parse(readFileSync(join(dir, 'scenarios.json'), 'utf8'));
  return {
    entries: data.seeds,
    texts: Object.fromEntries(data.seeds.map((e) => [e.file, readFileSync(join(dir, ...e.file.split('/')), 'utf8')])),
    titles: scenarios.scenarios.flatMap((group) => group.seeds.map((seed) => [seed.id, seed.title])),
  };
}

// The search order before Chinese support: substring hits over gist, category, tags,
// core_dimensions and the seed text; full matches first, then hit count, then novelty.
function legacyOrder({ entries, texts }, query, scenario) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tags = (value) => (Array.isArray(value) ? value.join(' ')
    : value && typeof value === 'object' ? Object.values(value).flat().join(' ') : String(value ?? ''));
  return entries
    .filter((e) => !scenario || e.scenario === scenario)
    .map((e) => {
      const hay = [e.gist ?? '', e.category, tags(e.tags), (e.core_dimensions ?? []).join(' '), texts[e.file]]
        .join(' ').toLowerCase();
      const hits = words.filter((w) => hay.includes(w)).length;
      return { id: e.id, full: hits === words.length ? 1 : 0, hits, novelty: e.scores?.novelty ?? 0 };
    })
    .filter((s) => s.hits)
    .sort((a, b) => b.full - a.full || b.hits - a.hits || b.novelty - a.novelty)
    .map((s) => s.id);
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// A release of the bundled snapshot relabelled as `version`, plus `additions` (index entries with
// their Chinese title and summary under `zh`). Seed bodies of the additions are generated from the gist.
function snapshotRelease(dir, version, additions = []) {
  const library = join(dir, `muspro-seeds-${version}`);
  cpSync(seeds, library, { recursive: true });
  const index = JSON.parse(readFileSync(join(library, 'index.json'), 'utf8'));
  const scenarios = JSON.parse(readFileSync(join(library, 'scenarios.json'), 'utf8'));
  for (const { zh, ...entry } of additions) {
    index.seeds.push(entry);
    scenarios.scenarios.find((group) => group.id === entry.scenario).seeds
      .push({ id: entry.id, file: entry.file, ...zh });
    writeFileSync(join(library, ...entry.file.split('/')),
      `---\nid: ${entry.id}\nscenario: ${entry.scenario}\ncategory: ${entry.category}\n---\n\n${entry.gist}\n`);
  }
  index.version = version;
  scenarios.version = version;
  writeFileSync(join(library, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  writeFileSync(join(library, 'scenarios.json'), `${JSON.stringify(scenarios, null, 2)}\n`);
  const release = join(dir, 'release');
  mkdirSync(release);
  const tarball = `muspro-seeds-${version}.tar.gz`;
  execFileSync(python, ['-I', '-c',
    'import sys, tarfile\nwith tarfile.open(sys.argv[1], "w:gz", format=tarfile.USTAR_FORMAT) as t: t.add(sys.argv[2], arcname=sys.argv[3])',
    join(release, tarball), library, `muspro-seeds-${version}`]);
  writeFileSync(join(release, 'manifest.json'), JSON.stringify({
    name: 'muspro-seeds', version, schemaVersion: index.schemaVersion, tarball,
    sha256: hashFile(join(release, tarball)), contentHash: contentHash(readDirectory(library)),
  }));
  return { tar: join(release, tarball), version };
}

// A 1.3.0-shaped release: the bundled snapshot plus the three seeds 1.3.0 added, taken from
// tests/fixtures/musepool/release-1.3.0-additions.json.
function fixtureRelease(dir) {
  const { version, seeds: additions } = JSON.parse(readFileSync(join(fixtures, 'release-1.3.0-additions.json'), 'utf8'));
  return snapshotRelease(dir, version, additions);
}

// Install a release directory (manifest.json + tar.gz) into a fresh cache.
function installRelease(dir, release) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'), 'utf8'));
  const cache = join(dir, 'cache');
  const installed = muse({ MUSEKIT_CACHE_DIR: cache }, 'update', '--from', join(release, manifest.tarball));
  assert.equal(installed.status, 0, installed.stderr);
  const state = JSON.parse(readFileSync(join(cache, 'seeds/state.json'), 'utf8'));
  return { cache, version: manifest.version, library: join(cache, 'seeds', state.current.dir) };
}

function fixtureCache(t) {
  const dir = scratch(t, 'musekit-zh-');
  const { tar } = fixtureRelease(dir);
  return installRelease(dir, dirname(tar));
}

// A custom library for MUSEPOOL_SEEDS_DIR; each seed is [id, tags, core_dimensions, body] and its
// front matter follows the real seeds, including motion_intensity and the tag group names.
function customLibrary(dir, seedList) {
  const library = join(dir, 'library');
  mkdirSync(join(library, 'ui'), { recursive: true });
  const entries = seedList.map(([id, tags, dimensions, body], i) => {
    const entry = {
      id, file: `ui/${id}.md`, scenario: 'ui', category: 'landing page', gist: `Reference ${id}.`,
      core_dimensions: dimensions, scores: { novelty: 0.5 + i / 100 }, tags,
    };
    const yamlTags = Object.entries(tags).map(([group, values]) => `  ${group}:\n${values.map((v) => `  - ${v}\n`).join('')}`);
    writeFileSync(join(library, 'ui', `${id}.md`), `---\nid: ${id}\nscenario: ui\nscenario_name: 界面\n`
      + `category: landing page\ncore_dimensions:\n${dimensions.map((d) => `- ${d}\n`).join('')}`
      + `scores:\n  motion_intensity: 0.0\n  novelty: 0.5\ntags:\n${yamlTags.join('')}---\n\n`
      + `# Typography\n\n${body.typography}\n\n# Motion\n\n${body.motion}\n`);
    return entry;
  });
  writeFileSync(join(library, 'index.json'), JSON.stringify({ version: '9.9.9', schemaVersion: '1.0', seeds: entries }));
  writeFileSync(join(library, 'scenarios.json'), JSON.stringify({ scenarios: [] }));
  return library;
}

function assertChineseQueries({ cache, version }) {
  const env = { MUSEKIT_CACHE_DIR: cache };
  const top = (query) => {
    const result = muse(env, 'search', query);
    assert.match(firstLine(result), new RegExp(`本机缓存 · muspro-seeds ${version.replaceAll('.', '\\.')}`));
    return ranked(result)[0];
  };
  assert.equal(top('餐厅官网'), 'E3ISF3qW');
  assert.equal(top('咖啡馆 菜单 订位'), 'E3ISF3qW');
  assert.equal(top('定价'), 'YqkjvOqz');
  assert.equal(top('套餐对比'), 'YqkjvOqz');
  assert.equal(top('会员 套餐'), 'YqkjvOqz');
  assert.equal(top('发布卡片'), 'mDGmR1dE');
  assert.equal(top('社媒 更新 公告'), 'mDGmR1dE');
  assert.equal(top('仪表盘'), 'pu9ToBED');
  // Chinese and English mixed in one token still split into both kinds of terms.
  assert.equal(top('SaaS定价'), 'YqkjvOqz');
  const expanded = muse(env, 'search', '餐厅官网');
  assert.match(expanded.stdout.split('\n')[1], /^中文词展开:餐厅 → restaurant.* · 官网 → website/);
}

test('Chinese queries reach the seeds added in 1.3.0 (fixture release)', (t) => {
  assertChineseQueries(fixtureCache(t));
});

test('Chinese queries reach the seeds added in 1.3.0 (real release)', {
  skip: !realRelease ? 'set MUSEKIT_TEST_RELEASE_DIR to a Muspro Seeds >= 1.3.0 release directory'
    : !existsSync(join(realRelease, 'manifest.json')) && `no manifest.json in ${realRelease}`,
}, (t) => {
  assertChineseQueries(installRelease(scratch(t, 'musekit-zh-real-'), realRelease));
});

test('without a cache the bundled snapshot answers Chinese queries', () => {
  const result = muse({}, 'search', '仪表盘');
  assert.match(firstLine(result), new RegExp(`内置快照 · muspro-seeds ${lock.version.replaceAll('.', '\\.')}`));
  assert.equal(ranked(result)[0], 'pu9ToBED');
  assert.deepEqual(ranked(muse({}, 'search', '深色 仪表盘')).slice(0, 1), ['pu9ToBED']);
  const portfolios = ranked(muse({}, 'search', '作品集', '-n', '40'));
  const index = JSON.parse(readFileSync(join(seeds, 'index.json'), 'utf8')).seeds;
  for (const entry of index.filter((e) => e.category.includes('portfolio'))) assert.ok(portfolios.includes(entry.id), entry.id);
  // Scenario names appear verbatim in every seed and keep matching only their own category.
  const information = ranked(muse({}, 'search', '信息表达', '-n', '40'));
  assert.deepEqual(information.sort(), index.filter((e) => e.scenario === 'information').map((e) => e.id).sort());
  // The category filter applies to Chinese queries too.
  assert.ok(!muse({}, 'search', '海报', '--scenario', 'ui').stdout.includes('[graphic]'));
});

test('each seed is the top result for its own Chinese title', (t) => {
  const fixture = fixtureCache(t);
  for (const [library, env] of [[seeds, {}], [fixture.library, { MUSEKIT_CACHE_DIR: fixture.cache }]]) {
    for (const [id, title] of readLibrary(library).titles) {
      assert.equal(ranked(muse(env, 'search', title))[0], id, `${title} in ${relative(root, library)}`);
    }
  }
});

test('Chinese terms expand to English even when the library has no Chinese titles', (t) => {
  const { library } = fixtureCache(t);
  const plain = join(scratch(t, 'musekit-zh-plain-'), 'library');
  cpSync(library, plain, { recursive: true });
  rmSync(join(plain, 'scenarios.json'));
  const top = (query) => ranked(muse({ MUSEPOOL_SEEDS_DIR: plain }, 'search', query))[0];
  assert.equal(top('餐厅官网'), 'E3ISF3qW');
  assert.equal(top('定价'), 'YqkjvOqz');
  assert.equal(top('发布卡片'), 'mDGmR1dE');
  assert.equal(top('仪表盘'), 'pu9ToBED');
});

test('unknown Chinese words get a friendly hint instead of silent misses', () => {
  const unknown = muse({}, 'search', '魑魅魍魉');
  assert.equal(unknown.status, 0, unknown.stderr);
  assert.match(unknown.stderr, /词表未收录「魑魅魍魉」.*英文关键词/);
  assert.match(unknown.stdout, /无命中。查询里的中文词都未能识别/);

  // Known words still search; the unknown part is reported and ignored.
  const partial = muse({}, 'search', '魑魅魍魉仪表盘');
  assert.match(partial.stderr, /词表未收录「魑魅魍魉」/);
  assert.equal(ranked(partial)[0], 'pu9ToBED');

  const generic = muse({}, 'search', '设计风格参考');
  assert.equal(generic.status, 0);
  assert.equal(generic.stderr, '');
  assert.match(generic.stdout, /无命中。查询只有.*泛称/);
  assert.equal(muse({}, 'search', '   ').status, 2);
});

test('English searches keep their previous results and order', (t) => {
  const fixture = fixtureCache(t);
  const queries = [
    ['typography'], ['number density hierarchy'], ['annotation', 'information'], ['dashboard'],
    ['dark monochrome typography'], ['palette', 'graphic'], ['grid'], ['diagram'], ['poster'], ['portfolio', 'ui'],
    ['minimal serif'], ['scroll'], ['restaurant website'], ['pricing comparison'], ['product launch card'],
    ['menu reservation'], ['motion'], ['serif'], ['sans-serif'], ['no-motion'], ['no-such-reference-847261'],
  ];
  for (const [library, env] of [[seeds, {}], [fixture.library, { MUSEKIT_CACHE_DIR: fixture.cache }]]) {
    const data = readLibrary(library);
    for (const [query, scenario] of queries) {
      const result = muse(env, 'search', query, '-n', '100', ...(scenario ? ['--scenario', scenario] : []));
      assert.deepEqual(ranked(result), legacyOrder(data, query, scenario), `${query} in ${relative(root, library)}`);
      assert.ok(!result.stdout.includes('中文词展开'));
      assert.equal(result.stderr, '');
    }
  }
});

test('Chinese style words skip field names, section headings and negated tags', (t) => {
  const library = customLibrary(scratch(t, 'musekit-zh-negated-'), [
    // motion_intensity, the motion: tag group and the # Motion heading are in every seed.
    ['template', { motion: [], typography: ['sans-serif'] }, ['layout'],
      { typography: 'One sans-serif family.', motion: 'Nothing notable.' }],
    // Tagged no-motion: an incidental mention in the text does not make it a motion reference.
    ['static', { motion: ['no-motion'], typography: ['sans-serif'] }, ['layout'],
      { typography: 'A sans serif grotesk.', motion: 'No entrance animations; the page stays static.' }],
    ['moving', { motion: ['scroll-triggered'], typography: ['display-serif'] }, ['motion'],
      { typography: 'A display serif headline.', motion: 'Scroll-triggered animations reveal each section.' }],
    // no-motion next to a positive motion tag still counts as motion.
    ['mixed', { motion: ['no-motion', 'hover-animation'], typography: ['monospace'] }, ['layout'],
      { typography: 'Monospace labels.', motion: 'Hover animation on cards.' }],
  ]);
  const search = (query) => ranked(muse({ MUSEPOOL_SEEDS_DIR: library }, 'search', query, '-n', '10'));
  assert.deepEqual(search('动效').sort(), ['mixed', 'moving']);
  assert.deepEqual(search('衬线'), ['moving']);
  assert.deepEqual(search('无衬线').sort(), ['static', 'template']);
  // English terms keep their substring matching, field names and all.
  const data = readLibrary(library);
  for (const query of ['motion', 'serif', 'no-motion', 'animation']) {
    assert.deepEqual(search(query), legacyOrder(data, query), query);
  }
});

test('Chinese motion and serif queries follow the bundled seeds\' tags', () => {
  const index = JSON.parse(readFileSync(join(seeds, 'index.json'), 'utf8')).seeds;
  const tagsOf = (e) => Object.values(e.tags).flat();
  const byId = Object.fromEntries(index.map((e) => [e.id, e]));
  const motion = ranked(muse({}, 'search', '动效', '-n', '40'));
  assert.ok(motion.length < index.length, 'motion matched every seed');
  for (const e of index) {
    if (tagsOf(e).includes('no-motion')) assert.ok(!motion.includes(e.id), `${e.id} is tagged no-motion`);
    if (e.core_dimensions.includes('motion')) assert.ok(motion.includes(e.id), `${e.id} has a motion dimension`);
  }
  assert.ok(byId[motion[0]].core_dimensions.includes('motion'), motion[0]);
  const serif = ranked(muse({}, 'search', '衬线', '-n', '40'));
  const serifTagged = (e) => tagsOf(e).some((tag) => /(^|-)serif$/.test(tag) && tag !== 'sans-serif');
  for (const e of index.filter(serifTagged)) assert.ok(serif.includes(e.id), e.id);
  assert.ok(serifTagged(byId[serif[0]]), serif[0]);
  // Seeds that mention serif only as sans-serif are not serif references.
  const { texts } = readLibrary(seeds);
  const sansOnly = index.filter((e) => !/serif/.test(
    [e.category, e.gist, tagsOf(e).join(' '), texts[e.file]].join(' ').toLowerCase().replace(/sans[\s-]serif/g, '')));
  assert.ok(sansOnly.length > 0);
  for (const e of sansOnly) assert.ok(!serif.includes(e.id), `${e.id} only mentions sans-serif`);
});

test('MUSEPOOL_SEEDS_DIR pointing at the bundled snapshot warns when the cache is newer', (t) => {
  const { cache, version } = fixtureCache(t);
  const warning = new RegExp(`警告:MUSEPOOL_SEEDS_DIR 指向 Skill 内置快照,正在使用内置快照 muspro-seeds ${
    lock.version.replaceAll('.', '\\.')};本机缓存有更新的 ${version.replaceAll('.', '\\.')} 未被使用.*取消这个变量`);
  // Relative, trailing-slash and dot-segment spellings all resolve to the bundled directory; the
  // dot segment is built by hand because path.join would normalise it away before Python sees it.
  // A symlink (a junction on Windows) to the snapshot is the same directory too.
  const linkDir = mkdtempSync(join(tmpdir(), 'musekit-zh-link-'));
  const link = join(linkDir, 'seeds');
  symlinkSync(seeds, link, process.platform === 'win32' ? 'junction' : 'dir');
  // Remove the link itself first so cleanup can never reach the bundled snapshot through it.
  t.after(() => {
    unlinkSync(link);
    rmSync(linkDir, { recursive: true, force: true });
  });
  const spellings = [seeds, `${seeds}/`, relative(root, seeds), `${seeds}${sep}..${sep}seeds`, link];
  for (const spelling of spellings) {
    const env = { MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: spelling };
    const search = muse(env, 'search', 'dashboard');
    // The variable is still honoured: results come from the bundled snapshot.
    assert.match(firstLine(search), /来源:MUSEPOOL_SEEDS_DIR\(指向内置快照\) · muspro-seeds/);
    assert.match(search.stderr, warning, spelling);
    assert.match(muse(env, 'list').stderr, warning);
    assert.match(muse(env, 'show', 'pu9ToBED').stderr, warning);
    const status = muse(env, 'status');
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, warning);
    assert.match(status.stdout, new RegExp(`current:${version.replaceAll('.', '\\.')}`));
  }
  assert.ok(!ranked(muse({ MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: seeds }, 'search', '餐厅官网')).includes('E3ISF3qW'));

  // update explains that the new cache will not be used while the variable is set.
  const { tar } = fixtureRelease(scratch(t, 'musekit-zh-again-'));
  const update = muse({ MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: seeds }, 'update', '--from', tar);
  assert.equal(update.status, 0, update.stderr);
  assert.match(update.stdout, /MUSEPOOL_SEEDS_DIR 指向 Skill 内置快照.*取消这个变量/);
  assert.match(update.stdout, /检索仍使用该目录/);
  assert.doesNotMatch(update.stdout, /当前使用:本机缓存/);

  // No warning without a newer cache, or when the variable names a custom library.
  const quiet = muse({ MUSEPOOL_SEEDS_DIR: seeds }, 'search', 'dashboard');
  assert.equal(quiet.stderr, '');
  assert.doesNotMatch(muse({ MUSEPOOL_SEEDS_DIR: seeds }, 'status').stdout, /警告/);
  const custom = join(scratch(t, 'musekit-zh-custom-'), 'library');
  cpSync(seeds, custom, { recursive: true });
  const own = muse({ MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: custom }, 'search', 'dashboard');
  assert.match(firstLine(own), /来源:MUSEPOOL_SEEDS_DIR · muspro-seeds/);
  assert.equal(own.stderr, '');

  // Without the variable the newer cache is used, as the lookup order says.
  assert.equal(ranked(muse({ MUSEKIT_CACHE_DIR: cache }, 'search', '餐厅官网'))[0], 'E3ISF3qW');
});

test('no warning when the cache is not newer than the bundled snapshot or cannot be used', (t) => {
  const env = (cache) => ({ MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: seeds });
  const assertQuiet = (cache, label) => {
    const search = muse(env(cache), 'search', 'dashboard');
    assert.equal(search.status, 0, search.stderr);
    assert.equal(search.stderr, '', label);
    assert.doesNotMatch(muse(env(cache), 'status').stdout, /警告/, label);
  };
  const [major, minor, patch] = lock.version.split('.').map(Number);
  const older = patch ? `${major}.${minor}.${patch - 1}` : minor ? `${major}.${minor - 1}.0` : `${major - 1}.0.0`;
  for (const version of [lock.version, older]) {
    const dir = scratch(t, 'musekit-zh-same-');
    const { cache } = installRelease(dir, dirname(snapshotRelease(dir, version).tar));
    assertQuiet(cache, version);
  }
  // A newer cache whose files no longer match the recorded contentHash is not offered either.
  const broken = fixtureCache(t);
  const brokenIndex = join(broken.library, 'index.json');
  writeFileSync(brokenIndex, `${readFileSync(brokenIndex, 'utf8')}\n`);
  assertQuiet(broken.cache, 'damaged cache');
});

test('an unresolvable MUSEPOOL_SEEDS_DIR fails search cleanly and does not block update', (t) => {
  const dir = scratch(t, 'musekit-zh-unresolvable-');
  // Symlink loops need privileges on Windows; ~user lookups fail on POSIX and are guessed on Windows.
  const spellings = [`~musekit-no-such-user-${process.pid}${sep}seeds`];
  if (process.platform !== 'win32') {
    symlinkSync(join(dir, 'loop-b'), join(dir, 'loop-a'));
    symlinkSync(join(dir, 'loop-a'), join(dir, 'loop-b'));
    spellings.push(join(dir, 'loop-a'));
  }
  const { tar } = fixtureRelease(dir);
  for (const spelling of spellings) {
    const cache = join(dir, `cache-${spellings.indexOf(spelling)}`);
    const env = { MUSEKIT_CACHE_DIR: cache, MUSEPOOL_SEEDS_DIR: spelling };
    const search = muse(env, 'search', 'dashboard');
    assert.equal(search.status, 2, spelling);
    assert.match(search.stderr, /MUSEPOOL_SEEDS_DIR 不可用/, spelling);
    assert.doesNotMatch(search.stderr, /Traceback/, spelling);
    const update = muse(env, 'update', '--from', tar);
    assert.equal(update.status, 0, `${spelling}: ${update.stderr}`);
    assert.doesNotMatch(update.stderr, /Traceback/, spelling);
    assert.match(update.stdout, /MUSEPOOL_SEEDS_DIR 已设置,检索会继续使用该目录/, spelling);
    assert.match(update.stdout, /已安装 muspro-seeds 1\.3\.0/, spelling);
  }
});

test('zh_terms.json is a well-formed Chinese to English term table', () => {
  const raw = readFileSync(zhTermsPath, 'utf8');
  const { terms, ignore } = JSON.parse(raw);
  const keys = [...raw.matchAll(/^ {4}"([^"]+)": \[/gm)].map((match) => match[1]);
  assert.equal(keys.length, Object.keys(terms).length, 'duplicate keys in terms');
  assert.ok(Object.keys(terms).length >= 200);
  for (const [term, synonyms] of Object.entries(terms)) {
    assert.match(term, /^[㐀-鿿]+$/, term);
    assert.ok(Array.isArray(synonyms) && synonyms.length > 0, term);
    for (const synonym of synonyms) assert.match(synonym, /^[a-z0-9é][a-z0-9é /-]*$/, `${term}: ${synonym}`);
    assert.ok(!ignore.includes(term), `${term} is both a term and ignored`);
  }
  for (const word of ignore) assert.match(word, /^[㐀-鿿]+$/, word);
  const required = ['餐厅', '咖啡馆', '菜单', '订位', '官网', '落地页', '定价', '套餐', '对比', '会员', '发布', '更新',
    '公告', '社媒', '配图', '卡片', '海报', '作品集', '仪表盘', '报告', '图解', '配色', '排版', '字体', '深色', '极简'];
  for (const term of required) assert.ok(term in terms, term);
});
