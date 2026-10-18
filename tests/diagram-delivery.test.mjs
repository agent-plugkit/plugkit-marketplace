import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { join, resolve, basename } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { digest } from "../plugins/musekit/skills/diagram-design/scripts/inspect_diagram.mjs";
const cli = resolve(
  "plugins/musekit/skills/diagram-design/scripts/deliver_diagram.mjs",
);
// Two straight relations on one line keep a shared-route warning: straight
// lines are never rerouted around each other.
const sourceBytes = Buffer.from(
  readFileSync("tests/fixtures/reader-quality.html", "utf8")
    .replace(
      '{ "id": "e1", "from": "A", "to": "B" }',
      '{ "id": "e1", "from": "A", "to": "B", "kind": "straight" }',
    )
    .replace('"arrow": false }', '"arrow": false, "kind": "straight" }'),
);
function run(args, options = {}) {
  const child = spawn(process.execPath, [cli, ...args, "--json"], {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "",
    err = "";
  child.stdout.on("data", (b) => (out += b));
  child.stderr.on("data", (b) => (err += b));
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        resolve({ code, result: JSON.parse(out), err });
      } catch (error) {
        reject(new Error(`${error.message}: ${out} ${err}`));
      }
    });
  });
}
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "musekit-delivery-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const source = join(dir, "source.html"),
    output = join(dir, "final diagram.html");
  writeFileSync(source, sourceBytes);
  return { dir, source, output, args: [source, "--output", output] };
}
function noTemps(dir) {
  assert.ok(
    !readdirSync(dir).some(
      (n) =>
        n.startsWith(".musekit-candidate-") || n.endsWith(".delivery.lock"),
    ),
  );
}

test("delivery commits exact checked bytes and independent PNG receipts without mutating source", async (t) => {
  const { dir, source, output, args } = await fixture(t);
  const first = await run(args);
  assert.equal(first.code, 0, JSON.stringify(first));
  assert.equal(first.result.committed, true);
  assert.ok(first.result.warningCount > 0);
  const report = JSON.parse(await fs.readFile(first.result.report, "utf8"));
  assert.deepEqual(digest(await fs.readFile(output)), report.artifact);
  assert.deepEqual(digest(await fs.readFile(first.result.png)), {
    sha256: report.png.sha256,
    bytes: report.png.bytes,
  });
  assert.deepEqual(digest(await fs.readFile(source)), report.source);
  assert.equal(report.visualReview, "not-performed");
  assert.equal(report.semanticReview, "not-performed");
  const oldReport = await fs.readFile(first.result.report),
    oldPNG = await fs.readFile(first.result.png);
  const second = await run(args);
  assert.equal(second.code, 0);
  assert.notEqual(second.result.report, first.result.report);
  assert.deepEqual(await fs.readFile(first.result.report), oldReport);
  assert.deepEqual(await fs.readFile(first.result.png), oldPNG);
  assert.deepEqual(await fs.readFile(source), sourceBytes);
  noTemps(dir);
});

test("strict warnings, malformed input and geometry failures preserve old artifact and evidence", async (t) => {
  const { dir, source, output, args } = await fixture(t);
  const good = await run(args);
  const before = await fs.readFile(output),
    receipt = await fs.readFile(good.result.report);
  const strict = await run([...args, "--strict"]);
  assert.equal(strict.code, 1);
  assert.equal(strict.result.committed, false);
  assert.ok(strict.result.issues.some((i) => i.severity === "warning"));
  assert.deepEqual(await fs.readFile(output), before);
  await fs.writeFile(source, "<html>incomplete");
  const malformed = await run(args);
  assert.equal(malformed.code, 1);
  assert.equal(malformed.result.stage, "package");
  await fs.writeFile(
    source,
    sourceBytes.toString().replace(/left:\s*600px/, "left:80px"),
  );
  const collision = await run(args);
  assert.equal(collision.code, 1);
  assert.ok(collision.result.issues.some((i) => i.severity === "error"));
  assert.deepEqual(await fs.readFile(output), before);
  assert.deepEqual(await fs.readFile(good.result.report), receipt);
  noTemps(dir);
});

test("invalid arguments, input aliases, missing Python and missing Playwright fail explicitly", async (t) => {
  const { dir, source, output, args } = await fixture(t);
  writeFileSync(output, "previous");
  assert.equal((await run([source, "--output", join(dir, "bad.png")])).code, 2);
  assert.equal((await run([...args, "--browser", "unknown"])).code, 2);
  assert.equal((await run([source, "--output", source])).code, 1);
  assert.equal(
    (await run(args, { env: { ...process.env, PATH: dir } })).code,
    2,
  );
  assert.equal((await run(args, { cwd: dir })).code, 2);
  const unavailableBrowser = await run(args, {
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: join(dir, "missing-browsers"),
    },
  });
  assert.equal(unavailableBrowser.code, 2);
  assert.equal(unavailableBrowser.result.committed, false);
  const alias = join(dir, "source-alias.html");
  await fs.link(source, alias);
  assert.equal((await run([source, "--output", alias])).code, 1);
  assert.equal(await fs.readFile(output, "utf8"), "previous");
  noTemps(dir);
});

test("missing PNG dependencies still deliver HTML with an exact fix and never replace a trusted file", async (t) => {
  const { dir, source, output, args } = await fixture(t);
  const noPlaywright = await run(args, { cwd: dir });
  assert.equal(noPlaywright.code, 2);
  assert.equal(noPlaywright.result.committed, false);
  assert.equal(noPlaywright.result.verified, false);
  assert.equal(noPlaywright.result.cause, "playwright-missing");
  assert.equal(noPlaywright.result.html, output);
  assert.match(
    noPlaywright.result.fix,
    /^\[ -f package\.json \] \|\| npm init -y >\/dev\/null && npm install --no-save playwright && npx playwright install chromium /,
  );
  const delivered = readFileSync(output, "utf8");
  assert.match(delivered, /<!-- musekit-runtime:start -->/);

  const noBrowser = await run(args, {
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: join(dir, "missing-browsers"),
    },
  });
  assert.equal(noBrowser.code, 2);
  assert.equal(noBrowser.result.cause, "browser-missing");
  assert.match(noBrowser.result.fix, /^npx playwright install chromium/);
  assert.equal(
    noBrowser.result.html,
    join(dir, "final diagram.unverified.html"),
  );
  assert.equal(readFileSync(output, "utf8"), delivered);

  const human = spawn(process.execPath, [cli, ...args], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let err = "";
  human.stderr.on("data", (b) => (err += b));
  await new Promise((resolve) => human.on("close", resolve));
  assert.match(err, /^PNG not exported: .*Playwright is not installed/m);
  assert.match(err, /^HTML delivered without browser checks: /m);
  assert.match(
    err,
    /^Fix: \[ -f package\.json \] \|\| npm init -y >\/dev\/null && npm install --no-save playwright/m,
  );
  assert.match(err, /^中文：/m);
  noTemps(dir);
});

test("sandboxed Chromium launch failures name the Codex network fix", async () => {
  const { environmentFailure } =
    await import("../plugins/musekit/skills/diagram-design/scripts/inspect_diagram.mjs");
  // Abbreviated from a Codex workspace-write run with network access disabled.
  const message =
    "browserType.launch: Target page, context or browser has been closed\nBrowser logs:\n[pid=16][err] ERROR:third_party/crashpad/crashpad/util/linux/socket.cc:45] setsockopt: Operation not permitted (1)";
  const codex = environmentFailure(message, {
    env: { CODEX_SANDBOX_NETWORK_DISABLED: "1" },
  });
  assert.equal(codex.cause, "browser-sandboxed");
  assert.match(codex.message, /Codex sandbox/);
  assert.match(codex.fix, /sandbox_workspace_write\.network_access=true/);
  assert.equal(
    environmentFailure(message, { env: {} }).cause,
    "browser-sandboxed",
  );
  assert.equal(
    environmentFailure("Some unrelated failure", { env: {} }),
    undefined,
  );
});

// A stand-in Playwright whose launch fails like a real host would, resolved from cwd.
function fakePlaywright(dir, launchError) {
  const pkg = join(dir, "node_modules", "playwright");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(
    join(pkg, "index.js"),
    `const fs = require("node:fs"), path = require("node:path");
exports.chromium = { async launch(options) {
  fs.writeFileSync(path.join(${JSON.stringify(dir)}, "launch.json"), JSON.stringify(options));
  throw new Error(${JSON.stringify(launchError)});
} };\n`,
  );
}

test("unverified HTML never overwrites the source, an existing copy or a symlink target", async (t) => {
  const { dir, output } = await fixture(t);
  writeFileSync(output, "previous");
  // The authored source is itself named like the fallback copy.
  const source = join(dir, "final diagram.unverified.html");
  writeFileSync(source, sourceBytes);
  const alias = await run([source, "--output", output], { cwd: dir });
  assert.equal(alias.code, 2);
  assert.equal(alias.result.cause, "playwright-missing");
  assert.equal(alias.result.html, join(dir, "final diagram.unverified-2.html"));
  assert.deepEqual(readFileSync(source), sourceBytes);
  assert.equal(readFileSync(output, "utf8"), "previous");
  assert.match(
    readFileSync(alias.result.html, "utf8"),
    /<!-- musekit-runtime:start -->/,
  );

  // Existing copies are kept; the next free name is used.
  const again = await run([source, "--output", output], { cwd: dir });
  assert.equal(again.result.html, join(dir, "final diagram.unverified-3.html"));
  assert.match(
    readFileSync(join(dir, "final diagram.unverified-2.html"), "utf8"),
    /<!-- musekit-runtime:start -->/,
  );

  // A symlink in the fallback slot is not followed, live or dangling.
  const other = mkdtempSync(join(tmpdir(), "musekit-victim-"));
  t.after(() => fs.rm(other, { recursive: true, force: true }));
  const victim = join(other, "victim.html");
  writeFileSync(victim, "victim");
  const linked = join(dir, "linked.html");
  writeFileSync(linked, "previous");
  symlinkSync(victim, join(dir, "linked.unverified.html"));
  symlinkSync(
    join(other, "absent.html"),
    join(dir, "linked.unverified-2.html"),
  );
  const link = await run([source, "--output", linked], { cwd: dir });
  assert.equal(link.code, 2);
  assert.equal(link.result.html, join(dir, "linked.unverified-3.html"));
  assert.equal(readFileSync(victim, "utf8"), "victim");
  assert.ok(!existsSync(join(other, "absent.html")));
  assert.ok(lstatSync(join(dir, "linked.unverified.html")).isSymbolicLink());
  noTemps(dir);
});

test("missing Linux browser libraries still deliver HTML with the --with-deps fix", async (t) => {
  for (const launchError of [
    "browserType.launch: \nHost system is missing dependencies to run browsers. \nPlease install them with the following command:\n\n    sudo npx playwright install-deps",
    "browserType.launch: Target page, context or browser has been closed\nBrowser logs:\n<launched> pid=7\n[pid=7][err] chrome: error while loading shared libraries: libnss3.so: cannot open shared object file: No such file or directory",
  ]) {
    const { dir, args, output } = await fixture(t);
    fakePlaywright(dir, launchError);
    const result = await run(args, { cwd: dir });
    assert.equal(result.code, 2, JSON.stringify(result));
    assert.equal(result.result.cause, "browser-dependencies-missing");
    assert.equal(result.result.verified, false);
    assert.equal(result.result.html, output);
    assert.match(
      result.result.fix,
      /^npx playwright install --with-deps chromium/,
    );
    assert.match(
      readFileSync(output, "utf8"),
      /<!-- musekit-runtime:start -->/,
    );
    noTemps(dir);
  }
});

test("recovery commands follow an explicit Chrome or Edge selection", async (t) => {
  const { environmentFailure } =
    await import("../plugins/musekit/skills/diagram-design/scripts/inspect_diagram.mjs");
  const { dir, args, output } = await fixture(t);
  fakePlaywright(
    dir,
    "browserType.launch: Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome\nRun \"npx playwright install chrome\"",
  );
  const chrome = await run([...args, "--browser", "chrome"], { cwd: dir });
  assert.equal(chrome.code, 2, JSON.stringify(chrome));
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "launch.json"))), {
    channel: "chrome",
  });
  assert.equal(chrome.result.cause, "browser-missing");
  assert.match(chrome.result.message, /Google Chrome \(--browser chrome\)/);
  assert.match(chrome.result.fix, /^npx playwright install chrome /);
  assert.match(chrome.result.fix, /rerun with --browser chromium/);
  assert.equal(chrome.result.html, output);

  const edge = environmentFailure(
    "Chromium distribution 'msedge' is not found at /opt/microsoft/msedge/msedge",
    { browser: "msedge" },
  );
  assert.match(edge.fix, /^npx playwright install msedge /);
  const edgeDeps = environmentFailure(
    "Host system is missing dependencies to run browsers.",
    { browser: "msedge" },
  );
  assert.match(
    edgeDeps.fix,
    /--with-deps chromium.*rerun with --browser chromium/,
  );
  const edgeNoPlaywright = environmentFailure("Playwright is unavailable", {
    browser: "msedge",
  });
  assert.doesNotMatch(edgeNoPlaywright.fix, /install chromium/);
  assert.match(
    edgeNoPlaywright.fix,
    /^\[ -f package\.json \] \|\| npm init -y >\/dev\/null && npm install --no-save playwright /,
  );
  // The default browser keeps the Chromium download fix.
  assert.match(
    environmentFailure("Executable doesn't exist at /x/chrome").fix,
    /^npx playwright install chromium /,
  );
});

test("export failure and evidence-write failure leave the trusted file intact", async (t) => {
  const { dir, source, output, args } = await fixture(t);
  writeFileSync(output, "previous");
  await fs.writeFile(
    source,
    sourceBytes
      .toString()
      .replace(
        "</main>",
        '<img src="data:image/png;base64,broken" style="width:10px;height:10px"></main>',
      ),
  );
  const broken = await run(args);
  assert.equal(broken.code, 1);
  assert.ok(broken.result.errors.length);
  await fs.writeFile(source, sourceBytes);
  const evidenceRoot = join(dir, `${basename(output, ".html")}.checks`);
  writeFileSync(evidenceRoot, "blocked");
  const failure = await run(args);
  assert.equal(failure.code, 1);
  assert.equal(failure.result.stage, "evidence");
  assert.equal(await fs.readFile(output, "utf8"), "previous");
  noTemps(dir);
});

test("output symbolic links and preexisting locks are not replaced or removed", async (t) => {
  const { dir, output, args } = await fixture(t),
    other = join(dir, "other.html");
  writeFileSync(other, "previous");
  await fs.symlink(other, output);
  assert.equal((await run(args)).code, 1);
  assert.equal(await fs.readFile(other, "utf8"), "previous");
  await fs.unlink(output);
  const lock = `${output}.delivery.lock`;
  writeFileSync(lock, "owned");
  const failure = await run(args);
  assert.equal(failure.code, 1);
  assert.equal(await fs.readFile(lock, "utf8"), "owned");
});

async function slowPython(dir) {
  const bin = join(dir, "bin");
  await fs.mkdir(bin);
  const actual = execFileSync("which", ["python3"], {
    encoding: "utf8",
  }).trim();
  const marker = join(dir, "packaging-started");
  const code = `#!${process.execPath}\nconst fs=require('node:fs');fs.writeFileSync(${JSON.stringify(marker)},'ready');setTimeout(()=>{const r=require('node:child_process').spawnSync(${JSON.stringify(actual)},process.argv.slice(2),{stdio:'inherit'});process.exit(r.status??1);},600);\n`;
  await fs.writeFile(join(bin, "python3"), code, { mode: 0o755 });
  return {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    marker,
  };
}
async function waitFile(file) {
  for (let i = 0; i < 100; i++) {
    if (existsSync(file)) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("packaging did not start");
}

test("concurrent deliveries fail closed while the first delivery completes", async (t) => {
  const { dir, args } = await fixture(t),
    { env, marker } = await slowPython(dir);
  const first = run(args, { env });
  await waitFile(marker);
  const second = await run(args);
  assert.equal(second.code, 1);
  assert.equal(second.result.committed, false);
  assert.equal((await first).code, 0);
  noTemps(dir);
});

test("source snapshot is frozen and a target changed during verification is preserved", async (t) => {
  const { dir, source, output, args } = await fixture(t),
    { env, marker } = await slowPython(dir);
  writeFileSync(output, "previous");
  const pending = run(args, { env });
  await waitFile(marker);
  await fs.writeFile(source, "changed after snapshot");
  await fs.writeFile(output, "external edit");
  const result = await pending;
  assert.equal(result.code, 1);
  assert.equal(result.result.stage, "commit");
  assert.match(result.result.error, /changed during verification/);
  assert.equal(await fs.readFile(output, "utf8"), "external edit");
  noTemps(dir);
  // A separate run changes only the author source: the committed source digest stays frozen.
  await fs.unlink(marker);
  await fs.writeFile(source, sourceBytes);
  const frozen = run(args, { env });
  await waitFile(marker);
  await fs.writeFile(source, "a later revision");
  const success = await frozen;
  assert.equal(success.code, 0);
  assert.deepEqual(success.result.source, digest(sourceBytes));
  noTemps(dir);
});

// Inject actual filesystem boundary errors in a child, not a fake checker result.
test("a rename failure before the commit point preserves the previous HTML and cleans new evidence", async (t) => {
  const { dir, output, args } = await fixture(t);
  writeFileSync(output, "previous");
  const preload = join(dir, "fail-commit.mjs");
  const canonical = await fs.realpath(output);
  await fs.writeFile(
    preload,
    `import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';
 const original=fs.rename;fs.rename=async(from,to)=>{if(to===${JSON.stringify(canonical)}){const e=new Error('simulated filesystem EIO');e.code='EIO';throw e;}return original(from,to);};syncBuiltinESMExports();`,
  );
  const result = await run(args, {
    env: {
      ...process.env,
      NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
    },
  });
  assert.equal(result.code, 1);
  assert.equal(result.result.stage, "commit");
  assert.match(result.result.error, /filesystem EIO/);
  assert.equal(await fs.readFile(output, "utf8"), "previous");
  noTemps(dir);
  assert.deepEqual(
    await fs.readdir(join(dir, `${basename(output, ".html")}.checks`)),
    [],
  );
});

test("a lost command response after commit can be reconciled using the retained batch digest", async (t) => {
  const { dir, output, args } = await fixture(t);
  writeFileSync(output, "previous");
  const preload = join(dir, "fail-response.mjs");
  await fs.writeFile(
    preload,
    `const write=process.stdout.write.bind(process.stdout);process.stdout.write=(value,...args)=>{if(String(value).includes('"committed": true'))throw new Error('simulated response failure');return write(value,...args);};`,
  );
  const child = spawn(process.execPath, [cli, ...args, "--json"], {
    env: {
      ...process.env,
      NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
    },
    stdio: ["ignore", "pipe", "ignore"],
  });
  let response = "";
  child.stdout.on("data", (bytes) => (response += bytes));
  const code = await new Promise((resolve, reject) => {
    child.on("close", resolve);
    child.on("error", reject);
  });
  assert.equal(response, "");
  assert.equal(typeof code, "number");
  const root = join(dir, `${basename(output, ".html")}.checks`);
  const batches = await fs.readdir(root);
  assert.equal(batches.length, 1);
  const report = JSON.parse(
    await fs.readFile(join(root, batches[0], "report.json"), "utf8"),
  );
  assert.equal(
    digest(await fs.readFile(output)).sha256,
    report.delivery.verifyOutputSha256,
  );
  assert.notEqual(await fs.readFile(output, "utf8"), "previous");
  noTemps(dir);
});

test("command entrypoints run through symbolic path aliases", async (t) => {
  const { dir, args } = await fixture(t);
  const alias = join(dir, "deliver-alias.mjs");
  await fs.symlink(cli, alias);
  const child = spawn(process.execPath, [alias, ...args, "--json"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "",
    err = "";
  child.stdout.on("data", (b) => (out += b));
  child.stderr.on("data", (b) => (err += b));
  const code = await new Promise((resolve, reject) => {
    child.on("close", resolve);
    child.on("error", reject);
  });
  assert.equal(code, 0, err);
  assert.equal(JSON.parse(out).committed, true);
  const inspectAlias = join(dir, "inspect-alias.mjs");
  await fs.symlink(
    resolve(
      "plugins/musekit/skills/diagram-design/scripts/inspect_diagram.mjs",
    ),
    inspectAlias,
  );
  assert.match(
    execFileSync(process.execPath, [inspectAlias, "--help"], {
      encoding: "utf8",
    }),
    /Usage:/,
  );
});
