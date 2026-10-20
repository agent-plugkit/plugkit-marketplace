import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'plugins/agent-wake/skills/agent-wake/scripts/agent-wake.mjs');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const read = (dir) => readFileSync(join(dir, 'events.jsonl'), { encoding: 'utf8', flag: 'a+' });

async function started(dir) {
  while (!read(dir).includes('"start"')) await sleep(50);
  return read(dir).split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((e) => e.ev === 'start');
}

// Fake CLIs: `claude` fires the hooks from --settings, `codex` calls notify with the payload as last argv.
const fake = `#!/usr/bin/env node
const { spawn, spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const mode = process.env.FAKE;
const hang = () => setInterval(() => {}, 1000);
process.stdout.write('prompt:' + require('node:fs').readFileSync(0, 'utf8'));
if (require('node:path').basename(process.argv[1]) === 'claude') {
  const settings = JSON.parse(args[args.indexOf('--settings') + 1]);
  const session_id = args[args.indexOf('--session-id') + 1];
  const fire = (name, extra) => spawnSync('sh', ['-c', settings.hooks[name][0].hooks[0].command],
    { input: JSON.stringify({ session_id, hook_event_name: name, ...extra }) });
  if (mode === 'hang' || mode === 'stop_hang') {
    process.on('SIGTERM', () => { fire('SessionEnd', { reason: 'other' }); process.exit(143); });
    if (mode === 'stop_hang') fire('Stop');
    hang();
  } else if (mode === 'api_error') {
    fire('StopFailure', { error: 'rate_limit' }); fire('SessionEnd', { reason: 'other' }); process.exit(1);
  } else {
    fire('Stop'); fire('SessionEnd', { reason: 'other' });
  }
} else {
  // Real codex ignores -c overrides placed before exec.
  if (args.indexOf('-c') < args.indexOf('exec') ||
    !args.includes('shell_environment_policy.exclude=["AGENT_WAKE_URL","AGENT_WAKE_TOKEN"]')) process.exit(3);
  const notify = JSON.parse(args[args.indexOf('-c') + 1].slice('notify='.length));
  if (mode === 'fail') process.exit(1);
  // Real codex killed directly exits 0 without calling notify.
  if (mode === 'hang') { process.on('SIGTERM', () => process.exit(0)); process.stdout.write(' ready'); return hang(); }
  const payload = JSON.stringify({ type: 'agent-turn-complete', 'thread-id': 'thread-1' });
  spawn('sh', ['-c', 'sleep 1; exec "$@"', 'sh', ...notify, payload], { detached: true, stdio: 'ignore' }).unref();
}
`;

async function setup(t) {
  const home = mkdtempSync(join(tmpdir(), 'agent-wake-'));
  for (const name of ['claude', 'codex']) {
    writeFileSync(join(home, name), fake);
    chmodSync(join(home, name), 0o755);
  }
  const hits = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => { hits.push({ auth: req.headers.authorization, ...JSON.parse(body) }); res.end('ok'); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.close(); rmSync(home, { recursive: true, force: true }); });
  const env = {
    ...process.env, HOME: home,
    AGENT_WAKE_URL: `http://127.0.0.1:${server.address().port}/wake`, AGENT_WAKE_TOKEN: 'secret',
  };
  const cli = (name) => join(home, name);
  const tool = (...args) => spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8' });
  const pending = (owner) => tool('pending', '--owner', owner).stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));

  function run(owner, cmd, { fake: mode = 'ok', extraEnv = {}, onTask } = {}) {
    const child = spawn(process.execPath, [script, 'run', '--owner', owner, '--', ...cmd],
      { env: { ...env, FAKE: mode, ...extraEnv }, detached: true });
    child.stdin.end('do the work');
    let out = '';
    let err = '';
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const [, id, dir] = out.match(/^TASK (\S+) (\S+)\n/) ?? [];
      if (id && onTask && !child.task) { child.task = { id, dir }; onTask(child, child.task); }
    });
    return new Promise((resolve) => child.on('exit', (code) => {
      const [, id, dir] = out.match(/^TASK (\S+) (\S+)\n/) ?? [];
      const result = dir && existsSync(join(dir, 'result.json')) ? JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8')) : null;
      resolve({ code, id, dir, err, result });
    }));
  }

  async function notified(id) {
    for (let i = 0; i < 50 && !hits.some((h) => h.id === id); i++) await sleep(100);
    await sleep(500);
    return hits.filter((h) => h.id === id);
  }
  return { home, cli, tool, pending, run, notified, hits };
}

test('claude done: one webhook, resumable session, pending and ack scoped to the owner', async (t) => {
  const { cli, tool, pending, run, notified } = await setup(t);
  const task = await run('bot-a', [cli('claude'), '-p']);
  assert.equal(task.code, 0);
  assert.match(task.id, /^claude-\d{8}-\d{6}-[0-9a-f]{4}$/);
  assert.equal(task.result.state, 'done');
  assert.match(task.result.session_id, /^[0-9a-f-]{36}$/);
  assert.equal(readFileSync(join(task.dir, 'out.log'), 'utf8'), 'prompt:do the work');
  assert.deepEqual(await notified(task.id), [{ auth: 'Bearer secret', id: task.id, owner: 'bot-a', state: 'done' }]);

  assert.deepEqual(pending('bot-a').map((p) => [p.id, p.state]), [[task.id, 'done']]);
  assert.deepEqual(pending('bot-b'), []);
  assert.notEqual(tool('ack', task.id, '--owner', 'bot-b').status, 0);
  assert.equal(tool('ack', task.id, '--owner', 'bot-a').status, 0);
  assert.deepEqual(pending('bot-a'), []);
});

test('API error and non-zero exit without a completion event are failed', async (t) => {
  const { cli, run, notified } = await setup(t);
  const claude = await run('bot', [cli('claude'), '-p'], { fake: 'api_error' });
  assert.deepEqual([claude.result.state, claude.result.reason], ['failed', 'api_error:rate_limit']);
  const codex = await run('bot', [cli('codex'), 'exec'], { fake: 'fail' });
  assert.deepEqual([codex.result.state, codex.result.reason], ['failed', 'exit 1']);
  assert.equal((await notified(claude.id)).length, 1);
  assert.deepEqual((await notified(codex.id)).map((h) => h.state), ['failed']);
});

test('codex notify arriving after the process exits still counts as done', async (t) => {
  const { cli, run, notified } = await setup(t);
  const task = await run('bot', [cli('codex'), 'exec', '--skip-git-repo-check']);
  assert.deepEqual([task.result.state, task.result.session_id], ['done', 'thread-1']);
  assert.deepEqual((await notified(task.id)).map((h) => h.state), ['done']);
});

test('SIGTERM to run is forwarded and ends as interrupted', async (t) => {
  const { cli, run, notified } = await setup(t);
  const task = await run('bot', [cli('claude'), '-p'], {
    fake: 'hang',
    onTask: async (child, { dir }) => { await started(dir); child.kill('SIGTERM'); },
  });
  assert.deepEqual([task.result.state, task.result.reason], ['interrupted', 'signal']);
  assert.deepEqual((await notified(task.id)).map((h) => h.state), ['interrupted']);
});

test('a signal after an earlier Stop still ends as interrupted', async (t) => {
  const { cli, run, notified } = await setup(t);
  const task = await run('bot', [cli('claude'), '-p'], {
    fake: 'stop_hang',
    onTask: async (child, { dir }) => {
      while (!read(dir).includes('"completed"')) await sleep(50);
      child.kill('SIGTERM');
    },
  });
  assert.deepEqual([task.result.state, task.result.reason], ['interrupted', 'signal']);
  assert.deepEqual((await notified(task.id)).map((h) => h.state), ['interrupted']);
});

test('codex killed directly exits 0 without notify and ends as interrupted', async (t) => {
  const { cli, run } = await setup(t);
  const task = await run('bot', [cli('codex'), 'exec'], {
    fake: 'hang',
    onTask: async (child, { dir }) => {
      const { pid } = await started(dir);
      while (!readFileSync(join(dir, 'out.log'), 'utf8').includes('ready')) await sleep(50);
      process.kill(pid, 'SIGTERM');
    },
  });
  assert.deepEqual([task.result.state, task.result.reason], ['interrupted', 'no completion']);
  assert.equal(task.result.hint, '可能是 Codex 版本删了 notify');
});

test('claude killed directly after Stop exits 143 and ends as interrupted', async (t) => {
  const { cli, run, notified } = await setup(t);
  const task = await run('bot', [cli('claude'), '-p'], {
    fake: 'stop_hang',
    onTask: async (child, { dir }) => {
      while (!read(dir).includes('"completed"')) await sleep(50);
      process.kill((await started(dir)).pid, 'SIGTERM');
    },
  });
  assert.equal(task.code, 143);
  assert.deepEqual([task.result.state, task.result.reason], ['interrupted', 'signal']);
  assert.deepEqual((await notified(task.id)).map((h) => h.state), ['interrupted']);
});

test('run killed before codex notify: the hook finalizes and wakes once', async (t) => {
  const { cli, run, notified } = await setup(t);
  const task = await run('bot', [cli('codex'), 'exec'], {
    onTask: async (child, { dir }) => {
      while (!read(dir).includes('"exit"')) await sleep(50);
      child.kill('SIGKILL');
    },
  });
  assert.equal(task.result, null);
  assert.deepEqual((await notified(task.id)).map((h) => h.state), ['done']);
  assert.equal(JSON.parse(readFileSync(join(task.dir, 'result.json'), 'utf8')).state, 'done');
});

test('orphan: run and CLI killed together are marked interrupted by pending, without a webhook', async (t) => {
  const { cli, pending, run, notified } = await setup(t);
  let dir;
  await run('bot', [cli('claude'), '-p'], {
    fake: 'hang',
    onTask: async (child, task) => {
      dir = task.dir;
      await started(dir);
      process.kill(-child.pid, 'SIGKILL');
    },
  });
  assert.equal(existsSync(join(dir, 'result.json')), false);
  // Events in the last 10 s leave room for a late callback, so it stays running for now.
  assert.equal(pending('bot')[0].state, 'running');
  const old = new Date(Date.now() - 11_000);
  utimesSync(join(dir, 'events.jsonl'), old, old);
  const [task] = pending('bot');
  assert.deepEqual([task.state, task.reason], ['interrupted', 'orphan']);
  assert.deepEqual(await notified(task.id), []);
});

test('run refuses to start without wake credentials or with hook-skipping flags', async (t) => {
  const { home, cli, run } = await setup(t);
  const missing = await run('bot', [cli('claude'), '-p'], { extraEnv: { AGENT_WAKE_TOKEN: '' } });
  assert.equal(missing.code, 2);
  assert.match(missing.err, /AGENT_WAKE_URL and AGENT_WAKE_TOKEN/);
  const bad = await run('bot', [cli('claude'), '-p'], { extraEnv: { AGENT_WAKE_TOKEN: '中文' } });
  assert.equal(bad.code, 2);
  assert.doesNotMatch(bad.err, /中文/);
  for (const flag of ['--bare', '--settings']) {
    assert.equal((await run('bot', [cli('claude'), '-p', flag, '{}'])).code, 2);
  }
  assert.equal(existsSync(join(home, '.agent-wake/bot')), false);
});
