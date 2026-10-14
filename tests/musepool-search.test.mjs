// muse_local.py search: Chinese queries, word boundaries, excluded text, reliable (★) hits, the
// English result snapshot, and the warning for a MUSEPOOL_SEEDS_DIR that points at the bundled
// snapshot while the cache holds a newer release.
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
import { libraryHash, snapshot } from './fixtures/musepool/english-snapshot.mjs';
import { release130 } from './fixtures/musepool/library.mjs';

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

// Seed IDs marked ★ (reliable hits).
function starred(result) {
  return [...result.stdout.matchAll(/^★ \[[a-z]+\] (\S+) /gm)].map((match) => match[1]);
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

// A custom library for MUSEPOOL_SEEDS_DIR. Each seed is { id, gist, tags, dimensions, body }; the
// front matter follows the real seeds (scenario_name, modality, view_type, scores, tag groups).
function customLibrary(dir, seedList) {
  const library = join(dir, 'library');
  mkdirSync(join(library, 'ui'), { recursive: true });
  const entries = seedList.map(({ id, gist = `Reference ${id}.`, tags = {}, dimensions = ['layout'], body }, i) => {
    const entry = {
      id, file: `ui/${id}.md`, scenario: 'ui', category: 'sample reference', gist,
      core_dimensions: dimensions, scores: { novelty: 0.5 + i / 100 }, tags,
    };
    const yamlTags = Object.entries(tags).map(([group, values]) => `  ${group}:\n${values.map((v) => `  - ${v}\n`).join('')}`);
    writeFileSync(join(library, 'ui', `${id}.md`), `---\nid: ${id}\nscenario: ui\nscenario_name: 界面\n`
      + `category: sample reference\nmodality: web\nview_type: landing\ncore_dimensions:\n`
      + `${dimensions.map((d) => `- ${d}\n`).join('')}scores:\n  motion_intensity: 0.0\n  novelty: 0.5\n`
      + `tags:\n${yamlTags.join('')}---\n\n> 借鉴范围:可借鉴交互、导航、组件组织或界面层级。\n\n${body}\n`);
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
    assert.equal(ranked(result)[0], starred(result)[0], query);
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
  // Scenario names only appear in front matter and the per-category scope note, which are not searched;
  // the category filter is the way to narrow by scenario.
  const information = muse({}, 'search', '信息表达');
  assert.deepEqual(ranked(information), []);
  assert.match(information.stderr, /词表未收录「信息表达」/);
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
  assert.match(unknown.stdout, /没有找到可靠参考:查询里的中文词都未能识别/);

  // Known words still search; the unknown part is reported and ignored.
  const partial = muse({}, 'search', '魑魅魍魉仪表盘');
  assert.match(partial.stderr, /词表未收录「魑魅魍魉」/);
  assert.equal(ranked(partial)[0], 'pu9ToBED');

  const generic = muse({}, 'search', '设计风格参考');
  assert.equal(generic.status, 0);
  assert.equal(generic.stderr, '');
  assert.match(generic.stdout, /没有找到可靠参考:查询只有.*泛称/);
  assert.equal(muse({}, 'search', '   ').status, 2);
});

test('English searches return the results recorded in english-ranking.json', (t) => {
  // Regenerate with `node tests/fixtures/musepool/english-snapshot.mjs` after an intended change.
  const recorded = JSON.parse(readFileSync(join(fixtures, 'english-ranking.json'), 'utf8'));
  const dir = scratch(t, 'musekit-english-');
  const libraries = { bundled: seeds, 'release-1.3.0': release130(dir).library };
  for (const [name, library] of Object.entries(libraries)) {
    assert.equal(libraryHash(library), recorded.libraries[name].contentHash, `${name} differs from the recorded library`);
  }
  const current = snapshot(script, libraries, recorded.queries, dir);
  for (const [name, { ids, results }] of Object.entries(recorded.libraries)) {
    assert.deepEqual(current[name].ids, ids);
    const changed = recorded.queries.flatMap((query, q) => recorded.scenarios
      .map((scenario, s) => [query, scenario, results[q][s], current[name].results[q][s]])
      .filter(([, , before, after]) => before !== after));
    assert.deepEqual(changed.slice(0, 20), [], `${changed.length} English results changed in ${name}`);
  }
});

test('hyphens and dots join words: three-bar, z-index and paper.js are single words', (t) => {
  const library = customLibrary(scratch(t, 'musekit-boundary-'), [
    { id: 'joined', gist: 'Reference joined: icons, layering and canvas.',
      body: '# Components\n\nA three-bar icon morphs on tap. The header sits at z-index 30. Drawn with paper.js '
        + 'on a data-grid layout.' },
    { id: 'plain', gist: 'Reference plain: a bar, an index and paper on a grid.',
      body: '# Components\n\nA cocktail bar menu printed on paper, with an index of drinks on a 12-column grid.' },
  ]);
  const run = (query) => muse({ MUSEPOOL_SEEDS_DIR: library }, 'search', query, '-n', '10');
  for (const word of ['bar', 'index', 'paper']) assert.deepEqual(ranked(run(word)), ['plain'], word);
  for (const word of ['js', 'three']) assert.match(run(word).stdout, /^没有找到可靠参考:没有 seed 提到这些查询词/m, word);
  // The whole compound still matches (in the body only, so it is not a reliable hit).
  assert.match(run('three-bar').stdout, /没有找到可靠参考:1 /);
  assert.match(run('z-index').stdout, /没有找到可靠参考:1 /);
  // The rule applies to expanded Chinese terms as well: data-grid is not a grid.
  assert.deepEqual(ranked(run('网格')), ['plain']);
});

test('code, CSS, front matter values and the scope note are not searched', (t) => {
  const library = customLibrary(scratch(t, 'musekit-excluded-'), [
    { id: 'code', gist: 'Reference code: a navigation pattern.', tags: { style: ['minimal'] },
      body: '# Craft\n\n```css\n.nav { backdrop-filter: blur(8px); transition: opacity 200ms; }\n```\n\n'
        + 'Uses `glassmorphism-panel` helpers, easing cubic-bezier(0.2, 0, 0, 1), border-radius: 999px and '
        + 'var(--accent). <!-- ref-dim: marquee -->' },
    { id: 'prose', gist: 'Reference prose: a navigation pattern.', tags: { style: ['minimal'] },
      body: '# Craft\n\nA frosted blur behind the nav, a slow opacity transition, glassmorphism panels, '
        + 'a gentle bezier easing, a marquee and a large border radius.' },
  ]);
  const run = (query) => muse({ MUSEPOOL_SEEDS_DIR: library }, 'search', query, '-n', '10');
  const search = (query) => ranked(run(query));
  // "navigation" is in both gists; the second word only counts in prose, so code stays a weak match.
  for (const query of ['blur', 'opacity', 'glassmorphism', 'bezier', 'radius', 'marquee', 'accent']) {
    assert.deepEqual(starred(run(`navigation ${query}`)), query === 'accent' ? [] : ['prose'], query);
  }
  assert.deepEqual(search('blur'), []);
  assert.match(run('blur').stdout, /没有找到可靠参考:1 /);
  // modality, view_type, scenario, scenario_name, scores and field names are front matter only.
  for (const query of ['web', 'landing', 'scenario', 'novelty', 'motion_intensity', 'view_type', '界面']) {
    assert.deepEqual(search(query), [], query);
  }
  // category and tags still match through the index.
  assert.deepEqual(search('sample').sort(), ['code', 'prose']);
  assert.deepEqual(search('minimal').sort(), ['code', 'prose']);
  // The per-category scope note (借鉴范围) is the same in every ui seed; its words are not hits.
  assert.deepEqual(search('组件组织'), []);
});

test('code fences, code spans and CSS follow Markdown and CSS syntax; prose labels stay searchable', (t) => {
  const library = customLibrary(scratch(t, 'musekit-syntax-'), [
    { id: 'labels', gist: 'Reference labels: a navigation pattern.',
      body: '# Craft\n\nIcons are vector-based: geometric shapes. The archive is non-hierarchical: projects float. '
        + 'Order: tier name; then price. Font: a contemporary serif.' },
    { id: 'css', gist: 'Reference css: a navigation pattern.',
      body: '# Craft\n\nCards use display: grid; and display:flex, transition: transform 0.3s linear; '
        + 'and color: crimson; on hover.' },
    { id: 'longfence', gist: 'Reference longfence: a navigation pattern.',
      body: '# Craft\n\n```css\n.a { color: teal; }\n````\nA lattice illustration.\n\n~~~\nwireframe\n```\n~~~~~\n\nDone.' },
    { id: 'crlf', gist: 'Reference crlf: a navigation pattern.',
      body: '# Craft\r\n\r\n```css\r\n.a { color: teal; }\r\n```\r\nA trellis illustration.\r\n' },
    { id: 'span', gist: 'Reference span: a navigation pattern.',
      body: '# Craft\n\nUses `frosted\nglassmorphism` helpers and a ``double `tick`\nspan`` too; a stray ` stays.\n\n'
        + 'A `broken\n\nmosaic` panel.' },
  ]);
  const star = (query) => starred(muse({ MUSEPOOL_SEEDS_DIR: library }, 'search', `navigation ${query}`, '-n', '10'));
  // Hyphenated or single-word labels before a colon are prose, not CSS declarations.
  for (const word of ['geometric', 'non-hierarchical', 'projects', 'tier', 'serif']) {
    assert.deepEqual(star(word), ['labels'], word);
  }
  // Declarations with a space after the colon, a semicolon or a value list are CSS.
  for (const word of ['grid', 'flex', 'linear', 'crimson']) assert.deepEqual(star(word), [], word);
  // A closing fence may be longer than the opening one; CRLF fences close; prose after them counts.
  assert.deepEqual(star('lattice'), ['longfence']);
  assert.deepEqual(star('trellis'), ['crlf']);
  for (const word of ['teal', 'wireframe']) assert.deepEqual(star(word), [], word);
  // Code spans may continue on the next line but do not cross a blank line.
  for (const word of ['frosted', 'glassmorphism', 'tick']) assert.deepEqual(star(word), [], word);
  assert.deepEqual(star('mosaic'), ['span']);
});

test('only reliable hits get ★; without one the noise is not listed', (t) => {
  const library = customLibrary(scratch(t, 'musekit-reliable-'), [
    { id: 'topic', gist: 'A cocktail bar website with a dark reservation flow.', tags: { domain: ['hospitality'] },
      body: '# Layout\n\nA single page.' },
    { id: 'mention', gist: 'A museum guide.', tags: { domain: ['culture'] },
      body: '# Layout\n\nThe cafe and bar of the museum appear in the footer of the website.' },
    { id: 'partial', gist: 'A website for a bakery.', body: '# Layout\n\nLong product pages.' },
  ]);
  const search = (...query) => muse({ MUSEPOOL_SEEDS_DIR: library }, 'search', ...query, '-n', '10');
  const reliable = search('cocktail bar website');
  assert.deepEqual(starred(reliable), ['topic']);
  assert.deepEqual(ranked(reliable)[0], 'topic');
  // Weaker results come after an explicit note, without ★.
  const mixed = search('bar website');
  assert.deepEqual(starred(mixed), ['topic']);
  assert.match(mixed.stdout, /以下未标 ★ 的只命中部分查询词或只出现在正文里,不是可靠参考/);
  assert.deepEqual(ranked(mixed).slice(1).sort(), ['mention', 'partial']);
  // All words only in the body, or not all words anywhere: nothing listed, a clear notice instead.
  for (const query of ['footer cafe', 'bakery cocktail']) {
    const result = search(query);
    assert.deepEqual(ranked(result), [], query);
    assert.doesNotMatch(result.stdout, /★/, query);
    assert.match(result.stdout, /没有找到可靠参考:\d+ 个 seed/, query);
    assert.match(result.stdout, /换成带场景的具体英文短语再试.*仍然没有就如实说明没有可靠参考/, query);
  }
  // The same on the bundled snapshot.
  const bundled = muse({}, 'search', 'cocktail bar website');
  assert.deepEqual(ranked(bundled), []);
  assert.match(bundled.stdout, /没有找到可靠参考/);
});

test('polysemous Chinese words removed from zh_terms.json are no longer expanded', () => {
  const { terms } = JSON.parse(readFileSync(zhTermsPath, 'utf8'));
  const removed = ['酒吧', '论文', '菜单', '目录', '杂志', '索引', '地图', '活动', '表单', '封面', '横幅', '标志', '网页',
    '应用', '筛选', '公告', '新闻', '免费', '上线', '对比', '比较', '方案', '编辑', '实验', '焦点'];
  for (const word of removed) {
    assert.ok(!(word in terms), word);
    const result = muse({}, 'search', word);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, new RegExp(`中文词展开:.*${word} →`), word);
  }
  // 酒吧 no longer becomes "bar": the restaurant site is found through 官网 alone, and no navigation bar.
  const bar = muse({}, 'search', '酒吧');
  assert.match(bar.stderr, /词表未收录「酒吧」/);
  assert.deepEqual(ranked(bar), []);
  // A word made only of single-character fillers (地 + 图) is reported instead of silently dropped.
  assert.match(muse({}, 'search', '地图').stderr, /词表未收录「地图」/);
});

test('Chinese style words skip field names, section headings and negated tags', (t) => {
  const seed = (id, tags, dimensions, typography, motion) => ({
    id, tags, dimensions, body: `# Typography\n\n${typography}\n\n# Motion\n\n${motion}`,
  });
  const library = customLibrary(scratch(t, 'musekit-zh-negated-'), [
    // motion_intensity, the motion: tag group and the # Motion heading are in every seed.
    seed('template', { motion: [], typography: ['sans-serif'] }, ['layout'], 'One sans-serif family.', 'Nothing notable.'),
    // Tagged no-motion: an incidental mention in the text does not make it a motion reference.
    seed('static', { motion: ['no-motion'], typography: ['sans-serif'] }, ['layout'], 'A sans serif grotesk.',
      'No entrance animations; the page stays static.'),
    seed('moving', { motion: ['scroll-triggered'], typography: ['display-serif'] }, ['motion'],
      'A display serif headline.', 'Scroll-triggered animations reveal each section.'),
    // no-motion next to a positive motion tag still counts as motion.
    seed('mixed', { motion: ['no-motion', 'hover-animation'], typography: ['monospace'] }, ['layout'],
      'Monospace labels.', 'Hover animation on cards.'),
  ]);
  const search = (query) => ranked(muse({ MUSEPOOL_SEEDS_DIR: library }, 'search', query, '-n', '10'));
  assert.deepEqual(search('动效').sort(), ['mixed', 'moving']);
  assert.deepEqual(search('衬线'), ['moving']);
  assert.deepEqual(search('无衬线').sort(), ['static', 'template']);
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
  const required = ['餐厅', '咖啡馆', '订位', '官网', '落地页', '定价', '套餐', '对比表', '会员', '发布', '更新',
    '社媒', '配图', '卡片', '海报', '作品集', '仪表盘', '报告', '图解', '配色', '排版', '字体', '深色', '极简'];
  for (const term of required) assert.ok(term in terms, term);
});
