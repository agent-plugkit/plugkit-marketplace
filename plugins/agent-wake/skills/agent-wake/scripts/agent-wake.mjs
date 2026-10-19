#!/usr/bin/env node
// agent-wake: run `claude -p` / `codex exec` in the background and wake the owning bot via webhook
// when the task ends. Linux only, Node 20+, no dependencies. State lives in ~/.agent-wake/<owner>/<id>/.
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const GRACE_MS = 5000;
const RETRY_MS = [0, 10_000, 60_000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (message) => { console.error(`agent-wake: ${message}`); process.exit(2); };
const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function record(dir, event) {
  appendFileSync(join(dir, 'events.jsonl'), `${JSON.stringify({ t: new Date().toISOString(), ...event })}\n`);
}

function events(dir) {
  try {
    return readFileSync(join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch { return []; }
}

const bootId = () => readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();

// /proc/<pid>/stat fields after the command name: [0] state, [19] start time in clock ticks.
function stat(pid) {
  try {
    const text = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return text.slice(text.lastIndexOf(')') + 2).split(' ');
  } catch { return []; }
}

const startTime = (pid) => stat(pid)[19] ?? null;

// Start time plus boot_id defeats PID reuse; zombie (Z) and dead (X) processes do not count.
function alive(proc, boot) {
  if (!proc?.start || boot !== bootId()) return false;
  const fields = stat(proc.pid);
  return fields[19] === proc.start && !['Z', 'X'].includes(fields[0]);
}

// A recorded signal beats any earlier completion; otherwise the last completion event decides and
// without one the caller's fallback applies.
function verdict(dir, fallback) {
  const all = events(dir);
  if (all.some((e) => e.ev === 'signal' || (e.ev === 'exit' && e.signal))) return ['interrupted', 'signal'];
  const last = all.findLast((e) => e.ev === 'completed' || e.ev === 'api_error');
  if (last?.ev === 'completed') return ['done', 'completed'];
  if (last) return ['failed', `api_error:${last.error}`];
  return fallback;
}

// Only the process that creates result.json (O_EXCL) wins; returns whether this call won.
function finalize(dir, [state, reason]) {
  const task = readJson(join(dir, 'task.json')) ?? {};
  const session_id = events(dir).findLast((e) => e.session_id)?.session_id ?? task.session_id ?? null;
  try {
    writeFileSync(join(dir, 'result.json'), `${JSON.stringify({ id: task.id, state, reason, session_id, at: new Date().toISOString() })}\n`, { flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

function sendDetached(dir) {
  spawn(process.execPath, [SELF, 'send', dir], { detached: true, stdio: 'ignore' }).unref();
}

function ownerDir(owner) {
  if (!owner || !NAME.test(owner)) fail('--owner <botId> is required (letters, digits, . _ -)');
  return join(homedir(), '.agent-wake', owner);
}

function option(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

const hasFlag = (argv, ...flags) => argv.some((a) => flags.some((f) => a === f || a.startsWith(`${f}=`)));

// Codex applies -c/--config overrides in order, so a later caller value would replace the injected
// notify or the secret exclusion.
function overridesReserved(argv) {
  return argv.some((a, i) => {
    const value = a === '-c' || a === '--config' ? argv[i + 1]
      : a.startsWith('--config=') ? a.slice('--config='.length)
        : a.startsWith('-c') && a.length > 2 ? a.slice(2).replace(/^=/, '') : null;
    const key = value?.split('=')[0].replace(/["'\s]/g, '').split('.')[0];
    return key === 'notify' || key === 'shell_environment_policy';
  });
}

function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

function inject(agent, argv, dir, task) {
  const hook = [process.execPath, SELF, 'hook', dir];
  if (agent === 'codex') {
    // Overrides placed before `exec` are silently ignored (codex-cli 0.162.1), so they go right after it.
    const at = argv.indexOf('exec') + 1;
    return [...argv.slice(0, at),
      '-c', `notify=${JSON.stringify(hook)}`,
      '-c', 'shell_environment_policy.exclude=["AGENT_WAKE_URL","AGENT_WAKE_TOKEN"]',
      ...argv.slice(at)];
  }
  const command = { type: 'command', command: hook.map(quote).join(' ') };
  const hooks = Object.fromEntries(['Stop', 'StopFailure', 'SessionEnd'].map((name) => [name, [{ hooks: [command] }]]));
  const extra = ['--settings', JSON.stringify({ hooks })];
  if (task.session_id) extra.push('--session-id', task.session_id);
  return [argv[0], ...extra, ...argv.slice(1)];
}

async function run(args) {
  process.on('SIGHUP', () => {});
  const split = args.indexOf('--');
  const argv = split === -1 ? [] : args.slice(split + 1);
  const root = ownerDir(option(args.slice(0, split), '--owner'));
  const owner = basename(root);
  const agent = basename(argv[0] ?? '');
  // Never echo these values: errors would land in bot transcripts.
  const { AGENT_WAKE_URL: url, AGENT_WAKE_TOKEN: token } = process.env;
  if (!url || !token) fail('AGENT_WAKE_URL and AGENT_WAKE_TOKEN must be set');
  if (!isHttpUrl(url)) fail('AGENT_WAKE_URL must be an http(s) URL');
  if (/[\0-\x1f\x7f]/.test(token)) fail('AGENT_WAKE_TOKEN must not contain newlines or control characters');
  if (agent === 'claude') {
    if (!hasFlag(argv, '-p', '--print')) fail('claude must run with -p');
    if (hasFlag(argv, '--bare', '--safe-mode', '--settings')) fail('--bare, --safe-mode and --settings are not supported');
  } else if (agent === 'codex') {
    if (!argv.includes('exec')) fail('codex must run as codex exec');
    if (overridesReserved(argv)) fail('-c/--config must not set notify or shell_environment_policy');
  } else {
    fail('usage: run --owner <botId> -- <claude -p … | codex exec …>');
  }

  const prompt = process.stdin.isTTY ? '' : readFileSync(0, 'utf8');
  mkdirSync(root, { recursive: true });
  let id; let dir;
  for (;;) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    id = `${agent}-${stamp}-${randomBytes(2).toString('hex')}`;
    dir = join(root, id);
    try { mkdirSync(dir); break; } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const resumed = hasFlag(argv, '--session-id', '--resume', '-r', '--continue', '-c');
  const task = {
    id, owner, agent, cwd: process.cwd(), argv, boot_id: bootId(),
    run: { pid: process.pid, start: startTime(process.pid) },
    session_id: agent === 'claude' && !resumed ? randomUUID() : null,
    created: new Date().toISOString(),
  };
  writeFileSync(join(dir, 'prompt.txt'), prompt);
  writeFileSync(join(dir, 'task.json.tmp'), `${JSON.stringify(task, null, 2)}\n`);
  renameSync(join(dir, 'task.json.tmp'), join(dir, 'task.json'));
  console.log(`TASK ${id} ${dir}`);

  let signaled = false;
  const cmd = inject(agent, argv, dir, task);
  const child = spawn(cmd[0], cmd.slice(1), {
    stdio: ['pipe', openSync(join(dir, 'out.log'), 'a'), openSync(join(dir, 'err.log'), 'a')],
  });
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => { signaled = true; record(dir, { ev: 'signal', signal: sig }); child.kill(sig); });
  }
  const exit = await new Promise((resolve) => {
    child.on('error', (error) => resolve({ error: error.message }));
    child.on('spawn', () => {
      record(dir, { ev: 'start', pid: child.pid, start: startTime(child.pid) });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
    });
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
  record(dir, { ev: 'exit', ...exit });

  // Codex notify is spawned asynchronously and may land after the process exits.
  for (let waited = 0; waited < GRACE_MS && !existsSync(join(dir, 'result.json')); waited += 200) await sleep(200);
  // A signalled Codex can exit 0 without calling notify, so exit 0 without completion is interrupted.
  const fallback = exit.error ? ['failed', `spawn:${exit.error}`]
    : signaled || exit.signal || exit.code > 128 ? ['interrupted', 'signal']
      : exit.code === 0 ? ['interrupted', 'exit 0 without completion']
        : ['failed', `exit ${exit.code}`];
  if (finalize(dir, verdict(dir, fallback))) sendDetached(dir);
  process.exitCode = exit.code ?? 1;
}

function hook(dir) {
  const payload = process.argv.at(-1);
  if (payload !== dir) {
    // Codex notify: the JSON payload is the last argv entry.
    const data = JSON.parse(payload);
    if (data.type !== 'agent-turn-complete') return;
    record(dir, { ev: 'completed', session_id: data['thread-id'] ?? null });
  } else {
    const data = JSON.parse(readFileSync(0, 'utf8'));
    const session_id = data.session_id ?? null;
    if (data.hook_event_name === 'Stop') return record(dir, { ev: 'completed', session_id });
    if (data.hook_event_name === 'StopFailure') return record(dir, { ev: 'api_error', error: data.error ?? 'unknown', session_id });
    if (data.hook_event_name !== 'SessionEnd') return;
    // Other Stop hooks may keep Claude working, so only SessionEnd finalizes.
    record(dir, { ev: 'session_end', reason: data.reason ?? null, session_id });
  }
  // A recorded signal is left to run, which finalizes after the CLI exits.
  const result = verdict(dir, null);
  if (result && result[0] !== 'interrupted' && finalize(dir, result)) sendDetached(dir);
}

async function send(dir) {
  const { id, owner } = readJson(join(dir, 'task.json'));
  const { state } = readJson(join(dir, 'result.json'));
  for (const [attempt, delay] of RETRY_MS.entries()) {
    await sleep(delay);
    try {
      const response = await fetch(process.env.AGENT_WAKE_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.AGENT_WAKE_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id, owner, state }),
        signal: AbortSignal.timeout(15_000),
      });
      record(dir, { ev: 'notify', attempt: attempt + 1, status: response.status });
      if (response.ok) return;
    } catch (error) {
      // error.message can echo the token or URL; keep only a fixed category.
      record(dir, { ev: 'notify', attempt: attempt + 1, error: error.cause?.code ?? error.name });
    }
  }
}

function tasks(owner) {
  const root = ownerDir(owner);
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((id) => NAME.test(id)).sort().map((id) => join(root, id));
}

function pending(args) {
  for (const dir of tasks(option(args, '--owner'))) {
    if (existsSync(join(dir, 'acked'))) continue;
    const task = readJson(join(dir, 'task.json'));
    if (!task) continue;
    if (!existsSync(join(dir, 'result.json'))) {
      const cli = events(dir).find((e) => e.ev === 'start');
      // Orphan: neither run nor the CLI survives. The bot is already awake, so no webhook.
      if (!alive(task.run, task.boot_id) && !alive(cli, task.boot_id)) finalize(dir, ['interrupted', 'orphan']);
    }
    const result = readJson(join(dir, 'result.json'));
    console.log(JSON.stringify({
      id: task.id, state: result?.state ?? 'running', reason: result?.reason ?? null,
      session_id: result?.session_id ?? task.session_id, agent: task.agent, cwd: task.cwd, dir,
    }));
  }
}

function ack(args) {
  const id = args[0];
  const owner = option(args, '--owner');
  const dir = NAME.test(id ?? '') ? join(ownerDir(owner), id) : null;
  if (!dir || readJson(join(dir, 'task.json'))?.owner !== owner) fail(`no task ${id} for owner ${owner}`);
  if (!existsSync(join(dir, 'result.json'))) fail(`task ${id} is still running`);
  try { writeFileSync(join(dir, 'acked'), '', { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  console.log(`ACKED ${id}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'run') await run(args);
else if (command === 'hook') {
  // Called by the CLI: never write stdout, never fail the CLI.
  try { hook(args[0]); } catch (error) { try { record(args[0], { ev: 'hook_error', error: error.message }); } catch {} }
  process.exit(0);
} else if (command === 'send') await send(args[0]);
else if (command === 'pending') pending(args);
else if (command === 'ack') ack(args);
else fail('usage: agent-wake.mjs run --owner <botId> -- <claude -p … | codex exec …> | pending --owner <botId> | ack <id> --owner <botId>');
