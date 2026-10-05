import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'plugins/musekit/skills/article-illustration/scripts/plan_article.py');
const article = join(
  root,
  'plugins/musekit/skills/article-illustration/references/examples/publish-pipeline.md',
);

function plan(path) {
  return JSON.parse(execFileSync('python3', [script, path], { encoding: 'utf8' }));
}

test('publish pipeline separates a branching loop from a three-step chain', () => {
  const report = plan(article);
  assert.equal(report.fences.length, 2);
  assert.equal(report.fences[0].suggestedPath, 'structured');
  assert.equal(report.fences[0].signals.hasBranch, true);
  assert.equal(report.fences[0].signals.hasLoop, true);
  assert.deepEqual(report.fences[0].signals.labels, ['提交', '校验', '发布', '回滚']);
  assert.equal(report.fences[1].suggestedPath, 'try-image');
  assert.equal(report.fences[1].signals.hasBranch, false);
  assert.equal(report.fences[1].signals.hasLoop, false);
  assert.deepEqual(report.fences[1].signals.labels, ['收集', '整理', '展示']);
});

test('empty fences are ignored and precise numbers stay structured', () => {
  const directory = mkdtempSync(join(tmpdir(), 'article-illustration-'));
  const extra = join(directory, 'density-edges.md');
  writeFileSync(extra, [
    '```mermaid',
    'flowchart LR',
    '```',
    '',
    '```python',
    'print(1)',
    '```',
    '',
    '```mermaid',
    'sequenceDiagram',
    '  Alice->>Bob: 延迟 12ms',
    '```',
    '',
  ].join('\n'));
  try {
    const report = plan(extra);
    assert.equal(report.fences.length, 1);
    assert.equal(report.fences[0].kind, 'sequence');
    assert.equal(report.fences[0].signals.hasPreciseNumber, true);
    assert.equal(report.fences[0].suggestedPath, 'structured');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
