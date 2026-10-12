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
//
// A sync validates everything in memory first; seeds.lock, the snapshot and scenarios.md are
// written only after the source passes, and a failed write restores all three.
import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lockPath = (root) => join(root, 'seeds.lock');
const scenariosPath = (root) => join(root, 'plugins/musekit/skills/musepool/references/scenarios.md');

// Archive and index paths must be canonical POSIX relative paths. Backslashes, drive colons,
// control characters and Windows device names can point elsewhere on some hosts.
const UNSAFE_PATH_CHARS = /[\\:*?"<>|\x00-\x1f]/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

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

export function readLock(root = repositoryRoot) {
  return JSON.parse(readFileSync(lockPath(root), 'utf8'));
}

export function safeParts(name) {
  if (typeof name !== 'string' || !name || name.startsWith('/') || UNSAFE_PATH_CHARS.test(name)) return null;
  const parts = (name.endsWith('/') ? name.slice(0, -1) : name).split('/');
  const bad = (part) => ['', '.', '..'].includes(part) || /[ .]$/.test(part) || WINDOWS_RESERVED.test(part.split('.')[0]);
  return parts.some(bad) ? null : parts;
}

function inside(base, path) {
  const offset = relative(resolve(base), resolve(path));
  return offset !== '' && offset !== '..' && !offset.startsWith(`..${sep}`) && !isAbsolute(offset);
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

// Regular files only: a symlink in a source or snapshot could pull in content from elsewhere.
export function readDirectory(directory) {
  const walk = (dir) => readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    const stat = lstatSync(path);
    if (stat.isDirectory()) return walk(path);
    if (!stat.isFile()) throw new Error(`Not a regular file: ${path}`);
    return [path];
  });
  return walk(directory).map((path) => {
    const inner = relative(directory, path).split(sep).join('/');
    if (!safeParts(inner)) throw new Error(`Unsafe file name: ${path}`);
    return { path: inner, bytes: readFileSync(path) };
  });
}

// Minimal ustar reader: one top-level directory holding regular files and directories.
export function readTarGz(buffer) {
  const tar = gunzipSync(buffer);
  const entries = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const text = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
    const prefix = text(345, 155);
    const path = prefix ? `${prefix}/${text(0, 100)}` : text(0, 100);
    const sizeField = text(124, 12).trim() || '0';
    if (!/^[0-7]+$/.test(sizeField)) throw new Error(`Invalid size for tar entry ${path}`);
    const size = Number.parseInt(sizeField, 8);
    const type = text(156, 1) || '0';
    offset += 512;
    if (offset + size > tar.length) throw new Error(`Truncated tar entry ${path}`);
    if (type !== '0' && type !== '5') throw new Error(`Unsupported tar entry type "${type}" for ${path}`);
    const parts = safeParts(path);
    if (!parts) throw new Error(`Unsafe archive path: ${path}`);
    entries.push({ parts, path, directory: type === '5', bytes: Buffer.from(tar.subarray(offset, offset + size)) });
    offset += Math.ceil(size / 512) * 512;
  }
  if (new Set(entries.map(({ parts }) => parts[0])).size !== 1) {
    throw new Error('Archive must contain exactly one top-level directory');
  }
  const files = [];
  const seen = new Set();
  const directories = new Set();
  for (const { parts, path, directory, bytes } of entries) {
    if (directory) continue;
    if (parts.length < 2) throw new Error(`Archive entry outside the top-level directory: ${path}`);
    const inner = parts.slice(1).join('/');
    // Paths that differ only in case collide on case-insensitive file systems.
    if (seen.has(inner.toLowerCase())) throw new Error(`Duplicate archive entry: ${path}`);
    seen.add(inner.toLowerCase());
    for (let i = 1; i < parts.length - 1; i += 1) directories.add(parts.slice(1, i + 1).join('/').toLowerCase());
    files.push({ path: inner, bytes });
  }
  const clash = [...seen].find((path) => directories.has(path));
  if (clash) throw new Error(`Archive path is both a file and a directory: ${clash}`);
  return files;
}

function loadSource(root, sourcePath, lock, pinning) {
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
    if (typeof tarball !== 'string' || !/^[A-Za-z0-9._-]+\.tar\.gz$/.test(tarball)) {
      throw new Error(`${manifestPath} has an invalid tarball name`);
    }
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

// The lock a --lock sync would write; nothing touches disk until the source verifies against it.
function candidateLock(lock, manifest) {
  for (const key of ['name', 'version', 'schemaVersion', 'tarball', 'sha256', 'contentHash']) {
    if (typeof manifest[key] !== 'string') throw new Error(`manifest.json has no ${key}`);
  }
  if (manifest.name !== lock.package) throw new Error(`manifest.json describes ${manifest.name}, not ${lock.package}`);
  return {
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
}

function verifyFiles(files, lock) {
  const problems = [];
  const actual = contentHash(files);
  if (actual !== lock.contentHash) problems.push(`snapshot contentHash ${actual} does not match seeds.lock ${lock.contentHash}`);
  const paths = new Set(files.map(({ path }) => path));
  const index = files.find(({ path }) => path === 'index.json');
  if (!index) problems.push('snapshot has no index.json');
  else {
    let data = null;
    try {
      data = JSON.parse(index.bytes.toString('utf8'));
    } catch (error) {
      problems.push(`index.json is not valid JSON: ${error.message}`);
    }
    if (data) {
      if (data.version !== lock.version) problems.push(`index.json version ${data.version} != seeds.lock ${lock.version}`);
      if (data.schemaVersion !== lock.schemaVersion) problems.push(`index.json schemaVersion ${data.schemaVersion} != seeds.lock ${lock.schemaVersion}`);
      for (const entry of Array.isArray(data.seeds) ? data.seeds : []) {
        if (!safeParts(entry?.file) || !paths.has(entry.file)) problems.push(`index.json lists missing or unsafe file ${entry?.file}`);
      }
      if (!Array.isArray(data.seeds)) problems.push('index.json has no seeds list');
    }
  }
  if (!paths.has('scenarios.json')) problems.push('snapshot has no scenarios.json');
  return problems;
}

function scenariosFrom(files) {
  return JSON.parse(files.find(({ path }) => path === 'scenarios.json').bytes.toString('utf8'));
}

export function check(root = repositoryRoot) {
  const lock = readLock(root);
  const target = join(root, lock.target);
  if (!existsSync(target)) return [`${lock.target} is missing`];
  const files = readDirectory(target);
  const problems = verifyFiles(files, lock);
  if (!problems.length) {
    const expected = renderScenarios(scenariosFrom(files), lock);
    const path = scenariosPath(root);
    if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) {
      problems.push(`${relative(root, path)} is stale`);
    }
  }
  return problems;
}

// Write the verified snapshot next to the target, swap it in, then write scenarios.md and
// seeds.lock. Any failure puts all three back as they were.
function commit(root, lock, files) {
  const target = join(root, lock.target);
  if (!inside(root, target)) throw new Error(`seeds.lock target ${lock.target} is outside the repository`);
  const token = randomBytes(6).toString('hex');
  const staging = join(dirname(target), `.seeds-staging-${token}`);
  const backup = join(dirname(target), `.seeds-backup-${token}`);
  const saved = [lockPath(root), scenariosPath(root)].map((path) => [path, existsSync(path) ? readFileSync(path) : null]);
  let swapped = false;
  try {
    for (const { path, bytes } of files) {
      const destination = join(staging, ...path.split('/'));
      if (!inside(staging, destination)) throw new Error(`Unsafe snapshot path: ${path}`);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, bytes, { flag: 'wx' });
    }
    if (existsSync(target)) renameSync(target, backup);
    swapped = true;
    renameSync(staging, target);
    writeFileSync(scenariosPath(root), renderScenarios(scenariosFrom(files), lock));
    writeFileSync(lockPath(root), `${JSON.stringify(lock, null, 2)}\n`);
  } catch (error) {
    if (swapped) {
      try {
        rmSync(target, { recursive: true, force: true });
        if (existsSync(backup)) renameSync(backup, target);
        for (const [path, bytes] of saved) {
          if (!bytes) rmSync(path, { force: true });
          else if (!existsSync(path) || !readFileSync(path).equals(bytes)) writeFileSync(path, bytes);
        }
      } catch (restoreError) {
        error.message += `\nRestoring the previous snapshot also failed: ${restoreError.message}`;
      }
    }
    throw error;
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(backup, { recursive: true, force: true });
  }
}

export function sync({ root = repositoryRoot, sourcePath, pinning = false } = {}) {
  const current = readLock(root);
  const { files, manifest } = loadSource(root, sourcePath ?? process.env.MUSPRO_SEEDS_SOURCE ?? current.source.local, current, pinning);
  const lock = pinning ? candidateLock(current, manifest) : current;
  const problems = verifyFiles(files, lock);
  if (problems.length) throw new Error(problems.join('\n'));
  commit(root, lock, files);
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
