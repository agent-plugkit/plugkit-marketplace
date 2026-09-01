import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function checkout(t) {
  const path = mkdtempSync(join(tmpdir(), 'musekit-public-tree-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet', path]);
  mkdirSync(join(path, 'scripts'));
  copyFileSync(join(root, 'scripts/check-public-tree.mjs'), join(path, 'scripts/check-public-tree.mjs'));
  writeFileSync(join(path, 'old.md'), 'Old public content\n');
  execFileSync('git', ['add', '.'], { cwd: path });
  return path;
}

function scan(path) {
  return spawnSync(process.execPath, ['scripts/check-public-tree.mjs'], { cwd: path, encoding: 'utf8' });
}

test('public scan handles deleted tracked files and newly added plugin content before staging', (t) => {
  const path = checkout(t);
  rmSync(join(path, 'old.md'));
  mkdirSync(join(path, 'plugins/new'), { recursive: true });
  writeFileSync(join(path, 'plugins/new/example.md'), 'Public design example\n');
  const result = scan(path);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('2 working-tree files'));
});

test('public scan rejects forbidden content in untracked files', (t) => {
  const path = checkout(t);
  mkdirSync(join(path, 'specs'));
  writeFileSync(join(path, 'specs/internal.md'), 'Internal work\n');
  writeFileSync(join(path, 'local.md'), ['', 'Users', 'example', 'private-project'].join('/'));
  const result = scan(path);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('specs/internal.md'));
  assert.ok(result.stderr.includes('local.md: machine-local absolute path'));
});
