#!/usr/bin/env node
// Copy the Muspro Seeds snapshot pinned by seeds.lock into Musepool and regenerate
// references/scenarios.md from it.
//
//   node scripts/sync-seeds.mjs                 sync the pinned release
//   node scripts/sync-seeds.mjs --source <path> sync from a tar.gz, a dist/ directory or an unpacked library
//   node scripts/sync-seeds.mjs --lock          pin the release described by the source's manifest.json, then sync
//   node scripts/sync-seeds.mjs --check         verify the bundled snapshot and scenarios.md against seeds.lock
//
// The default source is MUSPRO_SEEDS_SOURCE, then seeds.lock "source.local" (relative to
// this repository). --check needs only this repository.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lockPath = join(root, 'seeds.lock');
const musepool = join(root, 'plugins/musekit/skills/musepool');
const scenariosPath = join(musepool, 'references/scenarios.md');

const SCENARIO_INTROS = {
  ui: '网站、应用、仪表盘与交互体验。重点看用户如何浏览、操作和获得反馈；按当前项目的内容、状态和技术栈重建。',
  graphic: '海报、封面、社媒图、活动视觉等单幅或系列设计。尺寸与比例是任务条件，不另立分类；动态图像可转化为静态节奏。',
  information: '关系图解、报告与解释性材料。重点看阅读顺序、分组、标注和信息层级；分类本身不代表具有可用于论文的数据或科学权威性。',
};

export function renderScenarios(scenarios, lock) {
  const sections = scenarios.scenarios.map(({ id, name, seeds }) => [
    `## ${name} \`${id}\``,
    '',
    SCENARIO_INTROS[id] ?? '',
    '',
    ...seeds.map((seed) => (
      `- [${seed.title}](../seeds/${seed.file}) · \`${seed.id}\` — ${seed.summary}${seed.deprecated ? '（已弃用）' : ''}`
    )),
    '',
  ].join('\n'));
  return [
    `<!-- 生成文件：scripts/sync-seeds.mjs 根据 seeds/scenarios.json（${lock.package} ${lock.version}）生成，请勿手改。 -->`,
    '# 检索分类与参考清单',
    '',
    '三类按参考的主要借鉴价值组织，用于缩小搜索范围。它们不与四个制作 Skill 一一对应；同一参考可以通过不同的 seed 简报用于不同场景。已有明确参考时不必重新检索。',
    '',
    '种子里的维度、分数和技术标签是原始描述与检索线索，不是交付配额。来源中的布局、颜色和技术栈也不是新任务的硬性要求。',
    '',
    `下面列出随 Skill 内置的 ${lock.package} ${lock.version} 快照。用 \`muse_local.py update\` 更新本机缓存后，以 \`list\` 的输出为准。`,
    '',
    ...sections,
    '跨场景使用时，先写清借鉴的具体细节与不适用的部分，再由制作 Skill 决定构图。完整来源、原始细节和授权说明保留在各 seed、[NOTICE](../seeds/NOTICE) 与[第三方说明](third-party-notices.md)中。',
    '',
  ].join('\n');
}

export function readLock() {
  return JSON.parse(readFileSync(lockPath, 'utf8'));
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// Same definition as Muspro Seeds: sha256 over sorted "<sha256>  <path>\n" lines.
export function contentHash(files) {
  const lines = [...files]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map(({ path, bytes }) => `${sha256(bytes)}  ${path}\n`)
    .join('');
  return `sha256:${sha256(Buffer.from(lines, 'utf8'))}`;
}

export function readDirectory(directory) {
  const walk = (dir) => readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  return walk(directory).map((path) => ({
    path: relative(directory, path).split(sep).join('/'),
    bytes: readFileSync(path),
  }));
}

export function readTarGz(buffer) {
  const tar = gunzipSync(buffer);
  const files = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const text = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
    const prefix = text(345, 155);
    const path = prefix ? `${prefix}/${text(0, 100)}` : text(0, 100);
    const size = Number.parseInt(text(124, 12).trim() || '0', 8);
    const type = text(156, 1) || '0';
    offset += 512;
    if (type === '0') files.push({ path, bytes: Buffer.from(tar.subarray(offset, offset + size)) });
    else if (type !== '5') throw new Error(`Unsupported tar entry type "${type}" for ${path}`);
    offset += Math.ceil(size / 512) * 512;
  }
  const tops = new Set(files.map(({ path }) => path.split('/')[0]));
  if (tops.size !== 1) throw new Error('Archive must contain exactly one top-level directory');
  return files.map(({ path, bytes }) => {
    const inner = path.split('/').slice(1).join('/');
    if (!inner || inner.split('/').includes('..') || inner.startsWith('/')) throw new Error(`Unsafe archive path: ${path}`);
    return { path: inner, bytes };
  });
}

function loadSource(sourcePath, lock, pinning) {
  const source = resolve(root, sourcePath);
  if (!existsSync(source)) {
    throw new Error(`Seed source not found: ${source}\nBuild it in Muspro Seeds with "npm run pack:release" or set MUSPRO_SEEDS_SOURCE.`);
  }
  let archivePath = null;
  let manifestPath = null;
  if (statSync(source).isDirectory()) {
    if (existsSync(join(source, 'index.json'))) {
      if (pinning) throw new Error('--lock needs a release (tar.gz with manifest.json), not an unpacked directory');
      return { files: readDirectory(source), manifest: null };
    }
    manifestPath = join(source, 'manifest.json');
    const tarball = pinning && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).tarball : lock.tarball;
    archivePath = join(source, tarball);
  } else {
    archivePath = source;
    manifestPath = join(dirname(source), 'manifest.json');
  }
  if (!existsSync(archivePath)) throw new Error(`Seed archive not found: ${archivePath}`);
  const archive = readFileSync(archivePath);
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  if (pinning) {
    if (!manifest) throw new Error(`--lock needs ${manifestPath}`);
    if (sha256(archive) !== manifest.sha256) throw new Error(`${archivePath} does not match ${manifestPath}`);
  } else if (sha256(archive) !== lock.sha256) {
    throw new Error(`${archivePath} sha256 ${sha256(archive)} does not match seeds.lock ${lock.sha256}`);
  }
  return { files: readTarGz(archive), manifest };
}

function pin(lock, manifest) {
  const next = {
    ...lock,
    version: manifest.version,
    schemaVersion: manifest.schemaVersion,
    tarball: manifest.tarball,
    sha256: manifest.sha256,
    contentHash: manifest.contentHash,
    source: {
      ...lock.source,
      release: `${manifest.repository ?? lock.source.repository}/releases/download/v${manifest.version}/${manifest.tarball}`,
    },
  };
  writeFileSync(lockPath, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function verifyFiles(files, lock) {
  const problems = [];
  const actual = contentHash(files);
  if (actual !== lock.contentHash) problems.push(`snapshot contentHash ${actual} does not match seeds.lock ${lock.contentHash}`);
  const index = files.find(({ path }) => path === 'index.json');
  if (!index) problems.push('snapshot has no index.json');
  else {
    const data = JSON.parse(index.bytes.toString('utf8'));
    if (data.version !== lock.version) problems.push(`index.json version ${data.version} != seeds.lock ${lock.version}`);
    if (data.schemaVersion !== lock.schemaVersion) problems.push(`index.json schemaVersion ${data.schemaVersion} != seeds.lock ${lock.schemaVersion}`);
  }
  if (!files.some(({ path }) => path === 'scenarios.json')) problems.push('snapshot has no scenarios.json');
  return problems;
}

function scenariosFrom(files) {
  return JSON.parse(files.find(({ path }) => path === 'scenarios.json').bytes.toString('utf8'));
}

export function check() {
  const lock = readLock();
  const target = join(root, lock.target);
  if (!existsSync(target)) return [`${lock.target} is missing`];
  const files = readDirectory(target);
  const problems = verifyFiles(files, lock);
  if (!problems.length) {
    const expected = renderScenarios(scenariosFrom(files), lock);
    if (!existsSync(scenariosPath) || readFileSync(scenariosPath, 'utf8') !== expected) {
      problems.push(`${relative(root, scenariosPath)} is stale`);
    }
  }
  return problems;
}

function sync({ sourcePath, pinning }) {
  let lock = readLock();
  const { files, manifest } = loadSource(sourcePath ?? process.env.MUSPRO_SEEDS_SOURCE ?? lock.source.local, lock, pinning);
  if (pinning) lock = pin(lock, manifest);
  const problems = verifyFiles(files, lock);
  if (problems.length) throw new Error(problems.join('\n'));
  const target = join(root, lock.target);
  rmSync(target, { recursive: true, force: true });
  for (const { path, bytes } of files) {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), bytes);
  }
  writeFileSync(scenariosPath, renderScenarios(scenariosFrom(files), lock));
  return { lock, count: files.length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--check')) {
      const problems = check();
      if (problems.length) {
        console.error(`Seed snapshot check failed:\n${problems.map((item) => `- ${item}`).join('\n')}\nRun npm run sync:seeds.`);
        process.exit(1);
      }
      const lock = readLock();
      console.log(`Seed snapshot matches seeds.lock (${lock.package} ${lock.version}).`);
    } else {
      const flag = args.indexOf('--source');
      const { lock, count } = sync({ sourcePath: flag >= 0 ? args[flag + 1] : undefined, pinning: args.includes('--lock') });
      console.log(`Synced ${lock.package} ${lock.version} (${count} files) into ${lock.target}.`);
    }
  } catch (error) {
    console.error(`sync-seeds: ${error.message}`);
    process.exit(1);
  }
}
