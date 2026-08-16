#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const self = 'scripts/check-public-tree.mjs';
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf-8' })
  .split('\0')
  .filter(Boolean);
const findings = [];

for (const path of tracked) {
  if (path === 'DESIGN.md' || path.startsWith('specs/') || path.endsWith('/.DS_Store') || path === '.DS_Store') {
    findings.push(`${path}: internal or machine-local path is not allowed`);
  }
  if (/candidate-manifest\.json$|(?:^|\/)(?:implementation|foundation)-report\.md$/.test(path)) {
    findings.push(`${path}: candidate evidence is not public repository content`);
  }
  if (path === self) continue;
  const bytes = readFileSync(join(root, path));
  if (bytes.includes(0)) continue;
  const text = bytes.toString('utf-8');
  if (/\/Users\//.test(text) || /\/private\/tmp\//.test(text)) {
    findings.push(`${path}: machine-local absolute path`);
  }
  if (/(?:AKIA|ASIA)[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
    findings.push(`${path}: credential-shaped content`);
  }
}

if (findings.length > 0) {
  console.error(`Public repository check failed:\n${findings.map((item) => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Public repository check passed (${tracked.length} tracked files).`);
}
