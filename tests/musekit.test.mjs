import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const skillNames = ['musepool', 'web-design', 'graphic-design', 'slides-design', 'diagram-design', 'data-figure', 'article-illustration'];
const precedentIds = [
  'rvyjrbzh', 'ljwyqi6u', 'vy3ktwac', 'at5oq8hx', 'b3lygtwe', 'mc1nkp2t',
  'g26lbsoo', 'c4aztwoh', 'haych1wi', 'pibxrzsg', 'nv0j2qbt', '1jlusoip',
  'yoiov5el', 'nb7kq2mx',
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

test('precedents are flat lowercase records that a template uses or that say why they stay', () => {
  const dir = join(library, 'precedents');
  const files = readdirSync(dir);
  assert.ok(!existsSync(join(dir, 'index.json')));
  const records = files.map((name) => ({ name, meta: frontmatter(join(dir, name)) }));
  assert.deepEqual(new Set(records.map(({ meta }) => meta.id)), new Set(precedentIds));
  const used = new Set(readdirSync(join(library, 'templates')).filter((name) => name.endsWith('.md'))
    .flatMap((name) => frontmatter(join(library, 'templates', name)).exemplars || []));
  for (const { name, meta } of records) {
    assert.match(meta.id, /^[a-z0-9]{8}$/, name);
    assert.ok(name.endsWith(`-${meta.id}.md`), name);
    assert.equal(meta.scenario, undefined, name);
    assert.ok(used.has(meta.id) || meta.retained_for, name);
  }
  assert.equal(cli('show', 'ljwyqi6u'), readFileSync(join(dir, 'sustainability-manifesto-ljwyqi6u.md'), 'utf8'));
  assert.match(cli('list', 'precedents'), /^haych1wi {2}fashion archive {2}— {2}A Swiss menswear/m);
});

test('check rejects a precedent with a dead reference, a broken id, or no reason to stay', () => {
  const copy = mkdtempSync(join(tmpdir(), 'musepool-precedents-'));
  try {
    cpSync(plugin, copy, { recursive: true });
    const dir = join(copy, 'skills/musepool/library/precedents');
    const kept = join(dir, 'fashion-archive-haych1wi.md');
    writeFileSync(kept, readFileSync(kept, 'utf8').replace(/^retained_for:.*\n/m, '')
      .replace('# Layout', 'See references/motion.md for details.\n\n# Layout'));
    const named = join(dir, 'art-book-fair-event-vy3ktwac.md');
    writeFileSync(named, readFileSync(named, 'utf8').replace('id: vy3ktwac', 'id: Vy3KTWAC'));
    const result = spawnSync('python3', [join(copy, 'skills/musepool/scripts/muse.py'), 'check'], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /precedent haych1wi：正文引用了不存在的 references\/motion\.md/);
    assert.match(result.stdout, /precedent haych1wi：没有 Template 引用，需要写 retained_for/);
    assert.match(result.stdout, /precedent Vy3KTWAC：id 应为 8 位小写字母或数字/);
    assert.match(result.stdout, /template neo-swiss：范例 vy3ktwac 不存在/);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

test('neo-brutalism lays out a zero-gap panel wall with checkable layout rules', () => {
  const graphic = cli('resolve', 'neo-brutalism', '--scene', 'graphic');
  assert.match(graphic, /### 拼板墙（grid）/);
  assert.match(graphic, /panel-gap: "0px"/);
  assert.match(graphic, /dominant-ratio: 2/);
  assert.match(graphic, /fill-ratio: 0\.9/);
  assert.match(graphic, /sticker-tilt: "6deg"/);
  assert.match(graphic, /radius: "0px"/);
  assert.doesNotMatch(graphic, /堆叠块面/);
  for (const scene of ['graphic', 'web']) {
    const adaptation = cli('resolve', 'neo-brutalism', '--scene', scene).split('## 本场景适配')[1].split('## Seed 要点')[0];
    assert.doesNotMatch(adaptation, /卡片/, scene);
  }
  const brutal = frontmatter(join(library, 'templates/neo-brutalism.md'));
  assert.equal(brutal.seeds.grid, 'panel-wall');
  assert.ok(brutal.exemplars.includes('nb7kq2mx'));
  const swiss = 'paper-ink-signal,grotesk-cjk,baseline-8';
  for (const clash of ['ma-interval', 'zero-radius-hairline']) {
    assert.equal(run('compose', '--id', 'x', '--name', 'x', '--family', 'neo-brutalism',
      '--seeds', `${swiss},panel-wall,${clash}`).status, 3, clash);
  }
});

test('resolve keeps what each exemplar is borrowed for', () => {
  const style = cli('resolve', 'neo-swiss', '--scene', 'web');
  const examples = style.split('## 范例')[1];
  assert.match(examples, /`ljwyqi6u` 可持续设计宣言：.*看它怎样让细线本身成为结构/);
  assert.match(examples, /muse\.py show ljwyqi6u/);
});

test('templates link workflow examples per scene and resolve points to the current one', () => {
  for (const id of ['neo-brutalism', 'editorial-serif']) {
    const { examples } = frontmatter(join(library, `templates/${id}.md`));
    assert.deepEqual(Object.keys(examples).sort(), ['graphic', 'web'], id);
    for (const [scene, path] of Object.entries(examples)) {
      assert.ok(existsSync(join(plugin, path)), path);
      const tail = cli('resolve', id, '--scene', scene).split('## 范例')[1];
      assert.match(tail, new RegExp(`制作示例：插件内的 \`${path}\``));
      assert.match(tail, /不照搬构图/);
    }
  }
  assert.doesNotMatch(cli('resolve', 'neo-brutalism', '--scene', 'slides'), /制作示例：/);
  const withExamples = (examples) => userTemplate('brand.md').replace('seeds:', `examples:\n${examples}\nseeds:`);
  const dir = scratch({
    'brand.md': userSeed('brand', 'pairs:\n  - [ink, paper, body]'),
    'scene.md': withExamples('  graphic: skills/graphic-design/references/examples.md'),
    'missing.md': withExamples('  web: skills/web-design/references/examples/none.md'),
    'escape.md': withExamples('  web: ../../package.json'),
  });
  try {
    assert.match(run('check', join(dir, 'scene.md')).stdout, /examples 的场景 graphic 不在 scenes 里/);
    assert.match(run('check', join(dir, 'missing.md')).stdout, /制作示例 skills\/web-design\/references\/examples\/none\.md 不是插件内存在的 Markdown 文件/);
    assert.match(run('check', join(dir, 'escape.md')).stdout, /制作示例 \.\.\/\.\.\/package\.json 不是/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('seeds declare shared production tools and resolve says to copy them into the work', () => {
  const { tools, tokens } = frontmatter(join(library, 'seeds/texture/halftone-plate.md'));
  assert.deepEqual(tools, ['assets/halftone.js']);
  assert.ok(existsSync(join(plugin, 'assets/halftone.js')));
  for (const name of ['halftone-cell', 'halftone-angle', 'halftone-angle-accent', 'ink-drift', 'dry-break', 'registration-offset']) {
    assert.ok(tokens[name], name);
  }
  for (const scene of ['graphic', 'web']) {
    const style = cli('resolve', 'mono-print', '--scene', scene);
    const section = style.split('### 网点与套印')[1].split('\n### ')[0];
    assert.match(section, /制作工具：插件内的 `assets\/halftone\.js`/);
    assert.match(section, /复制进作品目录/);
    assert.match(style, /^  halftone-angle: "45deg"$/m);
  }
  assert.doesNotMatch(cli('resolve', 'neo-swiss', '--scene', 'web'), /制作工具：/);
  const withTools = (tools) => userSeed('brand', `tools: ${tools}`);
  const dir = scratch({
    'ok.md': withTools('[assets/halftone.js]'),
    'missing.md': withTools('[assets/none.js]'),
    'outside.md': withTools('[skills/musepool/scripts/muse.py]'),
    'escape.md': withTools('[../../package.json]'),
    'shape.md': withTools('assets/halftone.js'),
  });
  try {
    assert.equal(run('check', join(dir, 'ok.md')).status, 0);
    assert.match(run('check', join(dir, 'missing.md')).stdout, /制作工具 assets\/none\.js 不是插件 assets\/ 里存在的文件/);
    assert.match(run('check', join(dir, 'outside.md')).stdout, /制作工具 skills\/musepool\/scripts\/muse\.py 不是插件 assets\/ 里/);
    assert.match(run('check', join(dir, 'escape.md')).stdout, /制作工具 \.\.\/\.\.\/package\.json 不是/);
    assert.match(run('check', join(dir, 'shape.md')).stdout, /tools 必须是插件 assets\/ 内的路径列表/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('layout rules declared by seeds and templates reach style.md as roles, rules and a machine block', () => {
  const block = (style) => JSON.parse(/```json musekit-checks\n([\s\S]*?)```/.exec(style)[1]).rules;
  const web = cli('resolve', 'neo-brutalism', '--scene', 'web');
  assert.match(web, /^## 机检$/m);
  for (const role of ['wall', 'panel', 'main', 'list', 'title', 'sticker', 'hero']) assert.match(web, new RegExp('^- `' + role + '`：', 'm'));
  assert.deepEqual(block(web).map((r) => r.kind), ['seams', 'dominant', 'fill', 'covers', 'max-size']);
  // Thresholds stay token names, so the mobile breakpoint's dominant-ratio applies on phones.
  assert.equal(block(web)[1].min, 'dominant-ratio');
  assert.match(web, /--dominant-ratio: 1\.5;/);
  // The template's own web rule is not on the poster.
  assert.deepEqual(block(cli('resolve', 'neo-brutalism', '--scene', 'graphic')).map((r) => r.kind), ['seams', 'dominant', 'fill', 'covers']);
  assert.deepEqual(block(cli('resolve', 'editorial-serif', '--scene', 'graphic')).map((r) => r.kind), ['axis']);
  // Only the scenes the page inspector serves get the section.
  assert.doesNotMatch(cli('resolve', 'neo-brutalism', '--scene', 'diagram'), /## 机检/);
  assert.doesNotMatch(cli('resolve', 'neo-swiss', '--scene', 'web'), /## 机检/);

  const rules = (body) => userSeed('brand', `checks:\n  roles:\n    box: 一块板\n  rules:\n${body}`);
  const dir = scratch({
    'ok.md': rules('    - kind: seams\n      group: box\n      item: box\n      max: 3'),
    'kind.md': rules('    - kind: wobble\n      item: box'),
    'param.md': rules('    - kind: seams\n      group: box\n      item: box'),
    'extra.md': rules('    - kind: seams\n      group: box\n      item: box\n      max: 3\n      side: left'),
    'count.md': rules('    - kind: covers\n      item: box\n      over: box\n      count: two'),
    'shape.md': userSeed('brand', 'checks:\n  rules: []'),
  });
  try {
    assert.equal(run('check', join(dir, 'ok.md')).status, 0);
    assert.match(run('check', join(dir, 'kind.md')).stdout, /未知的规则种类 wobble/);
    assert.match(run('check', join(dir, 'param.md')).stdout, /seams 缺少参数 max/);
    assert.match(run('check', join(dir, 'extra.md')).stdout, /seams 不认识参数 side/);
    assert.match(run('check', join(dir, 'count.md')).stdout, /covers 的 count 必须是整数/);
    assert.match(run('check', join(dir, 'shape.md')).stdout, /checks 必须有 roles/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // Templates: undeclared roles, unknown tokens and scenes the page inspector does not serve are refused.
  const template = readFileSync(join(library, 'templates/neo-brutalism.md'), 'utf8');
  const bad = scratch({
    'role.md': template.replace('than: hero', 'than: banner'),
    'token.md': template.replace('min: fill-ratio', 'min: fill-ratoi').replace('kind: max-size', 'kind: fill\n        text: hero\n        box: panel\n        min: fill-ratoi\n      - kind: max-size'),
    'scene.md': template.replace('checks:\n  web:', 'checks:\n  diagram:'),
  });
  try {
    assert.match(run('check', join(bad, 'role.md')).stdout, /web 的 max-size 规则用了没有声明的角色 banner/);
    assert.match(run('check', join(bad, 'token.md')).stdout, /web 的 fill 规则引用了不存在的 token fill-ratoi/);
    assert.match(run('check', join(bad, 'scene.md')).stdout, /checks 的场景 diagram 必须是 graphic、web、slides 之一/);
  } finally {
    rmSync(bad, { recursive: true, force: true });
  }
});

test('every template has a slides adaptation on a 1920 × 1080 canvas, and its layout rules reach slides', () => {
  const block = (style) => JSON.parse(/```json musekit-checks\n([\s\S]*?)```/.exec(style)[1]).rules;
  for (const id of ['neo-swiss', 'neo-brutalism', 'editorial-serif', 'japanese-ma', 'mono-print']) {
    const out = cli('resolve', id, '--scene', 'slides');
    assert.match(out, /^adaptation: provided$/m, id);
    const { tokens } = parse(/^---\n([\s\S]*?)\n---/.exec(out)[1]);
    assert.equal(tokens['canvas-width'], '1920px', id);
    assert.equal(tokens['canvas-height'], '1080px', id);
    // Projected text: what must be read is at least 36px, notes at least 24px on a 1920 canvas.
    assert.ok(parseFloat(tokens['size-body']) >= 36, id);
    assert.ok(parseFloat(tokens['size-meta']) >= 24, id);
    const adaptation = out.split('## 本场景适配')[1].split('## Seed 要点')[0];
    for (const page of ['封面', '章节页', '要点页', '数据页', '引文页', '对比页', '结尾页']) assert.match(adaptation, new RegExp(page), `${id} ${page}`);
  }
  assert.deepEqual(block(cli('resolve', 'neo-brutalism', '--scene', 'slides')).map((r) => r.kind), ['seams', 'dominant', 'fill', 'covers']);
  assert.deepEqual(block(cli('resolve', 'editorial-serif', '--scene', 'slides')).map((r) => r.kind), ['axis']);
  assert.match(cli('resolve', 'neo-brutalism', '--scene', 'slides'), /演示文稿每页一面/);
  assert.match(cli('resolve', 'mono-print', '--scene', 'slides'), /制作工具：插件内的 `assets\/halftone\.js`/);
  assert.match(cli('fit', 'neo-swiss', '--scene', 'slides', '--chars', '6', '--span', '12'), /参照画布 1920px/);
  assert.match(cli('fit', 'japanese-ma', '--scene', 'slides', '--chars', '4', '--vertical'), /参照画布高 1080px/);
});

test('tablet breakpoints narrow the margins that blocked line length, and narrow walls relax the area ratio', () => {
  // 768 宽时原来的 128px / 96px 外边距让正文栏放不下规定的行长。
  for (const [id, margin] of [['japanese-ma', '64px'], ['editorial-serif', '48px'], ['mono-print', '64px']]) {
    const meta = parse(/^---\n([\s\S]*?)\n---/.exec(cli('resolve', id, '--scene', 'web'))[1]);
    assert.equal(meta.breakpoints.tablet.margin, margin, id);
  }
  const nb = parse(/^---\n([\s\S]*?)\n---/.exec(cli('resolve', 'neo-brutalism', '--scene', 'web'))[1]);
  assert.equal(nb.breakpoints.mobile['dominant-ratio'], 1.5);
  assert.match(cli('resolve', 'neo-brutalism', '--scene', 'web'), /`min\(\)` 封顶/);
});

test('rules that collided across styles in the tracer rerun are settled in the resolved text', () => {
  // 等宽字体不排中文和长破折号。
  for (const id of ['mono-print', 'neo-brutalism', 'editorial-serif', 'neo-swiss']) {
    assert.match(cli('resolve', id, '--scene', 'web'), /含中文或长破折号「—」的值改用正文字体/, id);
  }
  // 同一份 style.md 里不能再留「中文回退到等宽栈是预期的」这类相反说法。
  assert.doesNotMatch(cli('resolve', 'editorial-serif', '--scene', 'graphic'), /中文回退到宋体，这是预期的|书眉放一行等宽小字/);
  // 日式留白的 Seed 与 Template 对朱色、章节间隔说法一致。
  const ma = cli('resolve', 'japanese-ma', '--scene', 'web');
  assert.doesNotMatch(ma, /交互的当前与选中状态|例如半屏或一屏/);
  // 新粗野主义的平板首屏封顶后不再要求顶满，--padding 写明从栏位外沿量起。
  const nbWeb = cli('resolve', 'neo-brutalism', '--scene', 'web');
  assert.match(nbWeb, /封顶后标题不再要求顶满/);
  assert.doesNotMatch(nbWeb, /--padding <板内边距>/);
  // 状态反馈不占强调色的次数；没有后端时不盖「已登记」。
  assert.match(cli('resolve', 'editorial-serif', '--scene', 'web'), /出错说明只在出错时出现、改正后消失，不计入这个次数/);
  assert.match(cli('resolve', 'japanese-ma', '--scene', 'web'), /导航的当前态用细下划线、出错说明用墨色，都不用朱色/);
  const mono = cli('resolve', 'mono-print', '--scene', 'web');
  assert.match(mono, /只做了本地校验时写「已核对」/);
  assert.match(mono, /印刷面积（有墨的面积，不算露出的纸）/);
  // 海报上的关键事实不用 size-meta。
  for (const id of ['japanese-ma', 'mono-print', 'editorial-serif']) {
    assert.match(cli('resolve', id, '--scene', 'graphic'), /`size-body`/, id);
  }
  const shared = (path) => readFileSync(join(plugin, path), 'utf8');
  assert.match(shared('references/critique.md'), /声明和「示例」小标是制作附注，不算风格元素/);
  assert.match(shared('skills/graphic-design/SKILL.md'), /约按 0\.25 倍显示/);
  for (const skill of ['graphic-design', 'web-design', 'slides-design']) {
    assert.match(shared(`skills/${skill}/SKILL.md`), /Brief 写完后再取，用户点名了风格也一样/);
  }
  assert.match(shared('skills/web-design/references/methods.md'), /行长优先于栏数/);
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
  assert.match(cli('resolve', 'neo-swiss', '--scene', 'slides'), /size-display: "240px"/);
  assert.match(web, /--color-accent: #2F62E8;/);
  const missing = cli('resolve', 'editorial-serif', '--scene', 'diagram');
  assert.match(missing, /^adaptation: missing$/m);
  assert.match(missing, /未验证适配/);
  const parsed = parse(/^---\n([\s\S]*?)\n---/.exec(web)[1]);
  assert.equal(parsed.tokens.accent, '#2F62E8');
  assert.equal(run('resolve', 'neo-swiss', '--scene', 'web', '--variant', 'pink').status, 2);
});

test('every template resolves for diagrams, with adaptations only where a direction was translated', () => {
  const translated = new Set(['neo-swiss', 'neo-brutalism', 'japanese-ma']);
  for (const id of ['neo-swiss', 'neo-brutalism', 'japanese-ma', 'editorial-serif', 'mono-print']) {
    assert.ok(frontmatter(join(library, `templates/${id}.md`)).scenes.includes('diagram'), id);
    const style = cli('resolve', id, '--scene', 'diagram');
    assert.match(style, new RegExp(`^adaptation: ${translated.has(id) ? 'provided' : 'missing'}$`, 'm'), id);
    if (!translated.has(id)) assert.match(style, /未验证适配/, id);
  }
  // The editable runtime cannot measure rotated or skewed nodes.
  const brutal = cli('resolve', 'neo-brutalism', '--scene', 'diagram').split('## 本场景适配')[1].split('## Seed 要点')[0];
  assert.match(brutal, /不旋转/);
  const diagram = join(plugin, 'skills/diagram-design');
  for (const gone of ['references/image.md', 'references/styles.md', 'references/composition.md']) {
    assert.ok(!existsSync(join(diagram, gone)), gone);
  }
  // Equal scores rank styles with a written adaptation first, so "take the first" is not alphabetical.
  const ranked = cli('search', '--scene', 'diagram').split('\n').filter((line) => line && !line.startsWith(' '));
  assert.deepEqual(ranked.slice(0, 3).map((line) => /适配：有/.test(line)), [true, true, true]);
  const skill = readFileSync(join(diagram, 'SKILL.md'), 'utf8');
  for (const command of ['prepare_diagram.py', 'inspect_diagram.mjs', 'deliver_diagram.mjs']) assert.match(skill, new RegExp(command));
  assert.doesNotMatch(skill, /生图/);
});

test('color seeds carry checked data palettes that only the data scene resolves', () => {
  for (const [id, first] of [['neo-swiss', '#2A6BC4'], ['editorial-serif', '#30609F']]) {
    const data = cli('resolve', id, '--scene', 'data');
    const meta = parse(/^---\n([\s\S]*?)\n---/.exec(data)[1]);
    assert.equal(meta.data.categorical[0], first, id);
    assert.equal(meta.data.diverging.length % 2, 1, id);
    assert.match(data, new RegExp(`--data-cat-1: ${first};`), id);
    assert.match(data, /--data-seq-1: /, id);
    assert.match(data, /## 数据色板/, id);
    const web = cli('resolve', id, '--scene', 'web');
    assert.doesNotMatch(web, /--data-|## 数据色板/, id);
    assert.equal(parse(/^---\n([\s\S]*?)\n---/.exec(web)[1]).data, undefined, id);
  }
  const palette = (categorical, sequential, diverging) =>
    `data:\n  categorical: [${categorical}]\n  sequential: [${sequential}]\n  diverging: [${diverging}]\npairs:\n  - [ink, paper, body]`;
  const seq = '"#CEDFF8", "#93B5E5", "#598AD0", "#1D5FB7", "#00368B"';
  const div = '"#00489E", "#7393C0", "#DEDBD3", "#BA8168", "#8E1E00"';
  const cat = '"#2A6BC4", "#C9581A", "#13906A", "#94468F", "#831826"';
  const dataTemplate = (color) => userTemplate(color).replace('scenes: [web]', 'scenes: [web, data]');
  const dir = scratch({
    'good.md': userSeed('good', palette(cat, seq, div)).replace('scenes: [web]', 'scenes: [web, data]'),
    'pale.md': userSeed('pale', palette('"#2A6BC4", "#F0C8A0", "#13906A"', seq, div)),
    'twins.md': userSeed('twins', palette('"#2A6BC4", "#2D6EC8", "#13906A"', seq, div)),
    'cvd.md': userSeed('cvd', palette('"#C2457E", "#16936A", "#2A6BC4"', seq, div)),
    // 按顺序取色时前 n 个颜色会同框，不相邻的两色也要分得开。
    'apart.md': userSeed('apart', palette('"#2A6BC4", "#C9581A", "#13906A", "#8257C9", "#A67A1E"', seq, div)),
    'order.md': userSeed('order', palette(cat, '"#598AD0", "#CEDFF8", "#00368B"', div)),
    'even.md': userSeed('even', palette(cat, seq, '"#00489E", "#7393C0", "#BA8168", "#8E1E00"')),
    'hue.md': userSeed('hue', palette(cat, seq, '"#00489E", "#7393C0", "#E0C040", "#BA8168", "#8E1E00"')),
    'style.md': dataTemplate('good.md'),
    'bare.md': userSeed('bare', 'pairs:\n  - [ink, paper, body]'),
    'no-palette.md': dataTemplate('bare.md'),
  });
  try {
    assert.equal(run('check', join(dir, 'style.md')).status, 0, run('check', join(dir, 'style.md')).stdout);
    assert.match(cli('resolve', join(dir, 'style.md'), '--scene', 'data'), /--data-div-3: #DEDBD3;/);
    const expect = { 'pale.md': /#F0C8A0 对纸面只有 1\.\d+:1/, 'twins.md': /#2A6BC4 与 #2D6EC8 太接近/,
      'cvd.md': /#C2457E 与 #16936A 在色盲模拟下太接近/, 'apart.md': /#C9581A 与 #A67A1E 在色盲模拟下太接近/, 'order.md': /sequential 必须由浅到深/,
      'even.md': /diverging 必须是奇数个颜色/, 'hue.md': /diverging 的中点必须是中性色/,
      'no-palette.md': /声明了 data 场景，但颜色 Seed bare 没有数据色板/ };
    for (const [file, pattern] of Object.entries(expect)) {
      const result = run('check', join(dir, file));
      assert.equal(result.status, 1, file);
      assert.match(result.stdout, pattern, file);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  // 流式表达式用容器宽度，不含滚动条；输出提醒在根容器上声明 container-type。
  const mobile = cli('fit', 'neo-swiss', '--scene', 'web', '--chars', '5', '--span', '4', '--breakpoint', 'mobile');
  assert.match(mobile, /calc\(\(100cqi - 48px\) \/ 5\)/);
  assert.match(mobile, /container-type: inline-size/);
  assert.doesNotMatch(mobile, /100vw/);
  // 内边距可以左右不同；靠接缝一侧和靠视口一侧常常不一样。
  const uneven = cli('fit', 'neo-brutalism', '--scene', 'graphic', '--chars', '4', '--span', '12', '--padding', '48,24');
  assert.match(uneven, /内边距左 48px、右 24px/);
  assert.match(uneven, /可用宽度 912px，展示字号 235\.1px/);
  assert.match(uneven, / - 72px\) \/ 3\.88\)/);
  for (const bad of ['1,2,3', 'abc', '-20,10', 'nan']) {
    const result = run('fit', 'neo-brutalism', '--scene', 'graphic', '--chars', '4', '--span', '12', `--padding=${bad}`);
    assert.equal(result.status, 2, bad);
    assert.match(result.stderr, /--padding/, bad);
  }
  assert.match(cli('fit', 'japanese-ma', '--scene', 'graphic', '--chars', '3', '--vertical', '--padding', '40,0'), /内边距上 40px、下 0px/);
  // 断点版面的流式字号在断点上沿最大，输出这个值，避免窄一档的标题比宽一档还大。
  const tablet = cli('fit', 'neo-brutalism', '--scene', 'web', '--chars', '4', '--span', '12', '--breakpoint', 'tablet');
  assert.match(tablet, /断点上沿 1100px 时为 258\.8px/);
  assert.match(tablet, /min\(/);
  assert.equal(run('fit', 'neo-swiss', '--scene', 'graphic', '--chars', '5', '--span', '13').status, 2);
  // 默认字距取 tracking-display-cjk，缺省时取 tracking-display；--tracking 显式覆盖。
  assert.match(cli('fit', 'neo-brutalism', '--scene', 'graphic', '--chars', '4', '--span', '12', '--padding', '32'), /字距 -0\.04em.*\n.*可用宽度 920px，展示字号 237\.1px/);
  assert.match(cli('fit', 'neo-brutalism', '--scene', 'graphic', '--chars', '4', '--span', '12', '--padding', '32', '--tracking', '0'), /展示字号 230\.0px/);
  assert.match(cli('fit', 'neo-swiss', '--scene', 'graphic', '--chars', '5', '--span', '12'), /字距 0em/);
  assert.match(cli('fit', 'japanese-ma', '--scene', 'graphic', '--chars', '3', '--vertical'), /可用长度 1248px，排满时展示字号 385\.2px/);
  assert.match(cli('fit', 'japanese-ma', '--scene', 'graphic', '--chars', '3', '--vertical', '--tracking', '0.12'), /可用长度 1248px，排满时展示字号 385\.2px/);
  assert.match(cli('fit', 'japanese-ma', '--scene', 'web', '--chars', '3', '--span', '6', '--tracking', '0.12'), /\/ 3\.24\)/);
});

test('fit subtracts board borders apart from padding and sizes vertical titles by column length', () => {
  // 海报主板：跨满 12 栏，板内边距 32，墙外框 3px；可用宽度就是主板内宽 914。
  const board = cli('fit', 'neo-brutalism', '--scene', 'graphic', '--chars', '3', '--span', '12', '--padding', '32', '--border', '3');
  assert.match(board, /内边距 32px，边框 3px/);
  assert.match(board, /可用宽度 914px/);
  assert.match(board, / - 70px\) \/ 2\.92\)/);
  // 网页靠视口一侧不画边框，靠接缝一侧是半条线。
  assert.match(cli('fit', 'neo-brutalism', '--scene', 'web', '--chars', '4', '--span', '8', '--padding', '0,24', '--border', '0,1.5'),
    /边框左 0px、右 1\.5px/);
  for (const bad of ['-1', 'x', '1,2,3']) {
    const result = run('fit', 'neo-brutalism', '--scene', 'graphic', '--chars', '4', '--span', '12', `--border=${bad}`);
    assert.equal(result.status, 2, bad);
    assert.match(result.stderr, /--border/, bad);
  }
  // 竖排直接给出整列占可用长度一半和三分之二时的字号；同一列里的小字副标题长度先扣掉。
  const vertical = cli('fit', 'japanese-ma', '--scene', 'graphic', '--chars', '3', '--vertical');
  assert.match(vertical, /一半（624px）：展示字号 192\.6px/);
  assert.match(vertical, /三分之二（832px）：展示字号 256\.8px/);
  const mixed = cli('fit', 'japanese-ma', '--scene', 'graphic', '--chars', '3', '--vertical', '--sub-length', '200');
  assert.match(mixed, /同一列里其余文字 200px/);
  assert.match(mixed, /一半（624px）：展示字号 130\.9px/);
  assert.match(mixed, /三分之二（832px）：展示字号 195\.1px/);
  assert.equal(run('fit', 'japanese-ma', '--scene', 'graphic', '--chars', '3', '--span', '6', '--sub-length', '100').status, 2);
  assert.equal(run('fit', 'japanese-ma', '--scene', 'graphic', '--chars', '3', '--vertical', '--sub-length', '-5').status, 2);
  // 其余文字比某一档还长时，那一档放不下，不打印负字号。
  const crowded = cli('fit', 'japanese-ma', '--scene', 'graphic', '--chars', '3', '--vertical', '--sub-length', '700');
  assert.match(crowded, /一半（624px）：放不下，同一列里其余文字已经超过这个长度/);
  assert.match(crowded, /三分之二（832px）：展示字号 40\.7px/);
  assert.doesNotMatch(crowded, /展示字号 -/);
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
  assert.match(cli('search', '--scene', 'diagram', 'serif'), /diagram 适配：缺失/);
  assert.match(cli('search', '--scene', 'slides', 'swiss'), /slides 适配：有/);
  assert.match(cli('search', 'no-such-style-847261'), /无命中/);
  // 气质词表是封闭的：无命中时给出本场景能用的词，而不是让 Agent 盲猜近义词。
  const miss = cli('search', '--scene', 'data', '温和');
  assert.match(miss, /无命中/);
  assert.match(miss, /data 场景可用的气质词：.*理性/);
  assert.match(miss, /data 场景可用的气质词：.*人文/);
  assert.doesNotMatch(miss, /安静/);
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
