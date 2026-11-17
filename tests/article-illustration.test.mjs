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

test('publish pipeline reports the branching loop and the three-step chain', () => {
  const report = plan(article);
  assert.equal(report.fences.length, 2);
  for (const fence of report.fences) assert.ok(!('suggestedPath' in fence));
  assert.equal(report.fences[0].signals.hasBranch, true);
  assert.equal(report.fences[0].signals.hasLoop, true);
  assert.deepEqual(report.fences[0].signals.labels, ['提交', '校验', '发布', '回滚']);
  assert.deepEqual(report.fences[0].signals.conditions, ['通过', '失败']);
  assert.equal(report.fences[1].signals.hasBranch, false);
  assert.equal(report.fences[1].signals.hasLoop, false);
  assert.deepEqual(report.fences[1].signals.labels, ['收集', '整理', '展示']);
  assert.deepEqual(report.fences[1].signals.conditions, []);
});

test('empty fences are ignored; numbers and branch conditions are reported', () => {
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
    '  alt 有人预约',
    '    Bob-->>Alice: 送往预约架',
    '  else 无人预约',
    '    Bob-->>Alice: 送回书架',
    '  end',
    '```',
    '',
  ].join('\n'));
  try {
    const report = plan(extra);
    assert.equal(report.fences.length, 1);
    assert.equal(report.fences[0].kind, 'sequence');
    assert.equal(report.fences[0].signals.hasPreciseNumber, true);
    assert.equal(report.fences[0].signals.hasBranch, true);
    assert.deepEqual(report.fences[0].signals.conditions, ['有人预约', '无人预约']);
    } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('inline edge text counts as a condition and as an edge', () => {
  const directory = mkdtempSync(join(tmpdir(), 'article-illustration-'));
  const path = join(directory, 'inline-edges.md');
  writeFileSync(path, [
    '```mermaid',
    'flowchart LR',
    '  A[提交] -- 通过 --> B[发布]',
    '  A -. 失败 .-> C[回滚]',
    '  A == 加急 ==> D[上线]',
    '```',
    '',
  ].join('\n'));
  try {
    const { signals } = plan(path).fences[0];
    assert.deepEqual(signals.labels, ['提交', '发布', '回滚', '上线']);
    assert.deepEqual(signals.conditions, ['通过', '失败', '加急']);
    assert.equal(signals.edgeCount, 3);
    assert.equal(signals.hasBranch, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
