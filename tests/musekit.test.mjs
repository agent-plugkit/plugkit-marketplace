import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';
import { planLocalRelease } from 'agent-plugkit/dist/application/local-release.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const plugin = join(root, 'plugins/musekit');
const musepool = join(plugin, 'skills/musepool');
const library = join(musepool, 'library');
const script = join(musepool, 'scripts/muse.py');
const skillNames = ['musepool', 'web-design', 'graphic-design', 'diagram-design', 'scientific-figure', 'article-illustration'];
const precedentIds = [
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
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(readFileSync(path, 'utf8'));
  assert.ok(match, `Missing frontmatter: ${relative(root, path)}`);
  return parse(match[1]);
}

// Run outside the skill directory to verify script-relative library discovery.
function run(...args) {
  return spawnSync('python3', [script, ...args], { cwd: root, encoding: 'utf8' });
}

function cli(...args) {
  return execFileSync('python3', [script, ...args], { cwd: root, encoding: 'utf8' });
}

function scratch(files) {
  const dir = mkdtempSync(join(tmpdir(), 'musepool-test-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

const userSeed = (id, extra) => `---
id: ${id}
category: color
nature: value
name: 测试配色
status: draft
scenes: [web]
affinity: [test]
conflicts: []
tokens:
  paper:
    value: "#FFFFFF"
  ink:
    value: "#111111"
  accent:
    value: "#2050D0"
${extra}
---

## 要点

- 测试用。
`;

const userTemplate = (color) => `---
id: user-test
kind: template
name: 用户风格
family: test
status: draft
source: user
scenes: [web]
seeds:
  color: ${color}
  typography: grotesk-cjk
  grid: asymmetric-modular
  spacing: baseline-8
---

## 精神

测试。

## 文法

- 测试。
`;

test('the bundled YAML subset parser agrees with a full YAML parser on every library file', () => {
  const files = [join(library, 'fonts.yaml'), ...walk(join(library, 'seeds')), ...walk(join(library, 'templates'))]
    .filter((path) => /\.(md|yaml)$/.test(path));
  assert.ok(files.length >= 10);
  for (const path of files) {
    const expected = path.endsWith('.yaml') ? parse(readFileSync(path, 'utf8')) : frontmatter(path);
    assert.deepEqual(JSON.parse(cli('frontmatter', path)), expected, relative(root, path));
  }
});

test('the library passes its own checks and every seed category matches its folder', () => {
  const result = run('check');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /检查通过/);
  for (const path of walk(join(library, 'seeds'))) {
    const meta = frontmatter(path);
    assert.equal(relative(join(library, 'seeds'), dirname(path)), meta.category);
  }
});

test('precedents survive as exemplars and the template links real ones', () => {
  const index = JSON.parse(readFileSync(join(library, 'precedents/index.json'), 'utf8'));
  assert.deepEqual(new Set(index.map((entry) => entry.id)), new Set(precedentIds));
  for (const entry of index) assert.ok(existsSync(join(library, 'precedents', entry.file)), entry.file);
  const swiss = frontmatter(join(library, 'templates/neo-swiss.md'));
  for (const id of swiss.exemplars) assert.ok(precedentIds.includes(id));
  assert.equal(cli('show', 'LjwyQI6U'), readFileSync(join(library, 'precedents/graphic/sustainability-manifesto-ljwyqi6u.md'), 'utf8'));
});

test('resolve applies variants, scene overrides and reports missing adaptations', () => {
  const graphic = cli('resolve', 'neo-swiss', '--scene', 'graphic');
  assert.match(graphic, /^adaptation: provided$/m);
  assert.match(graphic, /size-display: "200px"/);
  assert.match(graphic, /--color-accent: #E1251B;/);
  assert.match(graphic, /--font-display: "Inter", "Noto Sans SC"/);
  assert.match(graphic, /### graphic|## 本场景适配\n\n单页平面/);
  const web = cli('resolve', 'neo-swiss', '--scene', 'web', '--variant', 'cobalt');
  assert.match(web, /size-display: "176px"/);
  assert.match(cli('resolve', 'neo-swiss', '--scene', 'slides'), /size-display: "120px"/);
  assert.match(web, /--color-accent: #2F62E8;/);
  const slides = cli('resolve', 'neo-swiss', '--scene', 'slides');
  assert.match(slides, /^adaptation: missing$/m);
  assert.match(slides, /未验证适配/);
  const parsed = parse(/^---\n([\s\S]*?)\n---/.exec(web)[1]);
  assert.equal(parsed.tokens.accent, '#2F62E8');
  assert.equal(run('resolve', 'neo-swiss', '--scene', 'web', '--variant', 'pink').status, 2);
});

test('scene overrides carry breakpoints, derived column width and text pairs into style.md', () => {
  const web = cli('resolve', 'neo-swiss', '--scene', 'web');
  const meta = parse(/^---\n([\s\S]*?)\n---/.exec(web)[1]);
  assert.equal(meta.breakpoints.mobile['max-width'], '767px');
  assert.equal(meta.breakpoints.mobile['size-display'], '64px');
  assert.equal(meta.breakpoints.mobile.columns, 4);
  assert.match(web, /@media \(max-width: 767px\) \{\n  :root \{\n    --columns: 4;/);
  assert.match(web, /\| `ink` \| `accent` \| 4\.03:1 \| 仅大字 \|/);
  assert.match(web, /\| `ink` \| `paper` \| 16\.58:1 \| 任意字号 \|/);
  assert.match(web, /\| `paper` \| `ink` \| 16\.58:1 \| 任意字号 \|/);
  const graphic = cli('resolve', 'neo-swiss', '--scene', 'graphic');
  assert.match(graphic, /--column-width: 64\.67px;/);
  assert.match(graphic, /--canvas-width: 1080px;/);
  assert.match(graphic, /\*\*适用与边界\*\*：/);
  assert.match(cli('resolve', 'editorial-serif', '--scene', 'web'), /--font-mono: "IBM Plex Mono", "Noto Serif SC"/);
  assert.doesNotMatch(graphic, /@media/);
});

test('fit derives display size from character count and span', () => {
  assert.match(cli('fit', 'neo-swiss', '--scene', 'graphic', '--chars', '5', '--span', '12'), /展示字号 190\.4px/);
  assert.match(cli('fit', 'neo-swiss', '--scene', 'web', '--chars', '5', '--span', '4', '--breakpoint', 'mobile'),
    /calc\(\(100vw - 48px\) \/ 5\)/);
  assert.equal(run('fit', 'neo-swiss', '--scene', 'graphic', '--chars', '5', '--span', '13').status, 2);
  assert.match(cli('fit', 'neo-brutalism', '--scene', 'graphic', '--chars', '4', '--span', '12', '--padding', '32'), /可用宽度 920px，展示字号 230\.0px/);
  assert.match(cli('fit', 'japanese-ma', '--scene', 'graphic', '--chars', '3', '--vertical', '--tracking', '0.12'), /可用长度 1248px，展示字号 385\.2px/);
  assert.match(cli('fit', 'japanese-ma', '--scene', 'web', '--chars', '3', '--span', '6', '--tracking', '0.12'), /\/ 3\.24\)/);
});

test('check enforces type-scale ratios and breakpoint tokens', () => {
  const base = (overrides) => `---
id: ratio-test
kind: template
name: 比例测试
family: neo-swiss
status: draft
source: user
scenes: [web]
seeds:
  color: paper-ink-signal
  typography: grotesk-cjk
  grid: asymmetric-modular
  spacing: baseline-8
  technique: scale-contrast
overrides:
  web:
${overrides}
---

## 精神

测试。

## 文法

- 测试。
`;
  const dir = scratch({
    'ok.md': base('    size-display: 176px\n    breakpoints:\n      mobile:\n        max-width: 767px\n        size-display: 64px\n        size-headline: 36px\n        size-title: 22px\n        ratio-adjacent: 1.6\n        ratio-display: 3'),
    'flat.md': base('    size-title: 40px'),
    'narrow.md': base('    breakpoints:\n      mobile:\n        max-width: 767px\n        size-display: 40px'),
    'unknown.md': base('    breakpoints:\n      mobile:\n        max-width: 767px\n        size-huge: 300px'),
    'width.md': base('    breakpoints:\n      mobile:\n        size-display: 64px'),
    'gutter.md': base('    gutter: 20px'),
  });
  try {
    assert.equal(run('check', join(dir, 'ok.md')).status, 0, run('check', join(dir, 'ok.md')).stdout);
    assert.match(run('check', join(dir, 'flat.md')).stdout, /size-headline\/size-title = 1\.40/);
    assert.match(run('check', join(dir, 'narrow.md')).stdout, /web\/mobile：size-display\/size-body = 2\.35/);
    assert.match(run('check', join(dir, 'unknown.md')).stdout, /size-huge 不对应任何 token/);
    assert.match(run('check', join(dir, 'width.md')).stdout, /max-width/);
    assert.match(run('check', join(dir, 'gutter.md')).stdout, /gutter 20px 不在间距阶梯/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('every library template resolves for each declared scene and ranks by curated mood words', () => {
  const ids = readdirSync(join(library, 'templates')).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3));
  assert.deepEqual(new Set(ids), new Set(['neo-swiss', 'japanese-ma', 'editorial-serif', 'neo-brutalism', 'mono-print']));
  for (const id of ids) {
    const meta = frontmatter(join(library, `templates/${id}.md`));
    assert.ok(existsSync(join(library, `templates/${id}.png`)), `${id} specimen`);
    for (const scene of meta.scenes) assert.match(cli('resolve', id, '--scene', scene), /## 文字配对/, `${id} ${scene}`);
    for (const variant of meta.variants.options) cli('resolve', id, '--scene', meta.scenes[0], '--variant', variant);
  }
  const quiet = cli('search', '--scene', 'web', '慢读', '安静').split('\n').filter((line) => !line.startsWith(' '));
  assert.match(quiet[0], /^editorial-serif/);
  assert.match(quiet[1], /^japanese-ma/);
  assert.match(cli('search', '--scene', 'web', '好玩', '年轻').split('\n')[0], /^neo-brutalism/);
});

test('unquoted hash values are rejected instead of silently diverging from YAML', () => {
  const dir = scratch({ 'bad.md': userSeed('bad', 'pairs: []').replace('value: "#2050D0"', 'value: 2px solid #2050D0') });
  try {
    const result = run('check', join(dir, 'bad.md'));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /含 # 的值要加引号/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('search is scene-aware and says when nothing matches', () => {
  const found = cli('search', '--scene', 'graphic', '理性', '海报');
  assert.match(found, /neo-swiss/);
  assert.match(found, /graphic 适配：有/);
  assert.match(cli('search', '--scene', 'slides', 'swiss'), /slides 适配：缺失/);
  assert.match(cli('search', 'no-such-style-847261'), /无命中/);
  assert.match(cli('search', '--seeds', '网格'), /grid\/asymmetric-modular/);
});

test('compose builds a checkable draft and refuses incomplete or duplicated categories', () => {
  const dir = mkdtempSync(join(tmpdir(), 'musepool-compose-'));
  try {
    const out = join(dir, 'mix.md');
    cli('compose', '--id', 'mix', '--name', '混搭', '--family', 'neo-swiss', '--out', out,
      '--seeds', 'paper-ink-signal,grotesk-cjk,asymmetric-modular,baseline-8,scale-contrast');
    const meta = frontmatter(out);
    assert.equal(meta.status, 'draft');
    assert.equal(meta.source, 'composed');
    const checked = run('check', out);
    assert.equal(checked.status, 0, checked.stdout);
    assert.equal(run('compose', '--id', 'x', '--name', 'x', '--family', 'x', '--seeds', 'paper-ink-signal').status, 2);
    assert.equal(run('compose', '--id', 'x', '--name', 'x', '--family', 'x',
      '--seeds', 'paper-ink-signal,paper-ink-signal,grotesk-cjk,asymmetric-modular,baseline-8').status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('user templates may bring their own seeds and are held to the same checks', () => {
  const good = scratch({ 'brand.md': userSeed('brand', 'pairs:\n  - [ink, paper, body]'), 'style.md': userTemplate('brand.md') });
  const weak = scratch({ 'brand.md': userSeed('brand', 'pairs:\n  - [accent, paper, body]\n  - [paper, ink, body]').replace('#2050D0', '#9AB0F0'), 'style.md': userTemplate('brand.md') });
  const clash = scratch({ 'brand.md': userSeed('brand', 'pairs: []').replace('conflicts: []', 'conflicts: [neo-swiss]'), 'style.md': userTemplate('brand.md') });
  try {
    assert.equal(run('check', join(good, 'style.md')).status, 0);
    assert.match(cli('resolve', join(good, 'style.md'), '--scene', 'web'), /--color-accent: #2050D0;/);
    const contrast = run('check', join(weak, 'brand.md'));
    assert.equal(contrast.status, 1);
    assert.match(contrast.stdout, /accent\/paper 对比/);
    const conflict = run('check', join(clash, 'style.md'));
    assert.equal(conflict.status, 1);
    assert.match(conflict.stdout, /互相冲突/);
  } finally {
    for (const dir of [good, weak, clash]) rmSync(dir, { recursive: true, force: true });
  }
});

test('typography seeds only accept registered open fonts with CJK coverage', () => {
  const source = readFileSync(join(library, 'seeds/typography/grotesk-cjk.md'), 'utf8');
  const dir = scratch({
    'commercial.md': source.replace('value: Inter\n    role: 西文展示字与标题', 'value: Helvetica Neue\n    role: 西文展示字与标题'),
    'latin.md': source.replace('value: Noto Sans SC', 'value: IBM Plex Sans'),
    'weight.md': source.replace('weight-display:\n    value: 600', 'weight-display:\n    value: 300'),
  });
  try {
    assert.match(run('check', join(dir, 'commercial.md')).stdout, /只能使用开源字体/);
    assert.match(run('check', join(dir, 'latin.md')).stdout, /不覆盖汉字/);
    assert.match(run('check', join(dir, 'weight.md')).stdout, /加载地址缺少字重 300/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const fonts = parse(readFileSync(join(library, 'fonts.yaml'), 'utf8')).fonts;
  for (const font of fonts.filter((item) => item.kind === 'open')) {
    for (const field of ['license', 'official', 'download', 'fallback']) assert.ok(font[field], `${font.family} ${field}`);
  }
  for (const font of fonts.filter((item) => item.kind === 'commercial')) assert.ok(font.alternatives.length > 0);
});

test('specimen HTML embeds tokens, fonts and contrast results', () => {
  const dir = mkdtempSync(join(tmpdir(), 'musepool-specimen-'));
  try {
    const out = join(dir, 'neo-swiss.html');
    cli('specimen', 'neo-swiss', '--out', out);
    const html = readFileSync(out, 'utf8');
    assert.match(html, /--color-paper: #F2F0EB;/);
    assert.match(html, /fonts\.googleapis\.com\/css2\?family=Inter/);
    const spec = JSON.parse(/<script type="application\/json" id="spec">([\s\S]*?)<\/script>/.exec(html)[1]);
    assert.equal(spec.id, 'neo-swiss');
    assert.ok(spec.pairs.every((pair) => pair.pass));
    assert.ok(spec.rules.length >= 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid targets return useful nonzero results without tracebacks', () => {
  for (const args of [['show', 'missing-id'], ['resolve', 'missing', '--scene', 'web'], ['resolve', 'neo-swiss', '--scene', 'print']]) {
    const result = run(...args);
    assert.equal(result.status, 2, args.join(' '));
    assert.ok(result.stderr.trim());
    assert.ok(!result.stderr.includes('Traceback'));
  }
});

test('declared skills are discoverable and all local Markdown references are bundled', () => {
  const config = parse(readFileSync(join(plugin, 'plugin.yaml'), 'utf8'));
  assert.equal(config.name, 'musekit');
  assert.equal(config.version, '1.0.0');
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

test('generated client indexes list musekit and keep portable metadata clean', () => {
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
  assert.equal(portable.version, '1.0.0');
  for (const field of ['interface', 'platform', 'category']) assert.ok(!(field in portable));
  const codex = JSON.parse(readFileSync(join(plugin, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(resolve(plugin, codex.skills), join(plugin, 'skills'));
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
  for (const shared of ['references/style.md', 'references/critique.md']) {
    assert.ok(bundled.has(`plugins/musekit/${shared}`));
  }
});
