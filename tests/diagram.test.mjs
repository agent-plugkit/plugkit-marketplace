import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import test from "node:test";
import {
  route,
  segmentHits,
  pathHits,
  pathBacktracks,
  simplify,
  orthogonal,
  labelPosition,
  overlaps,
} from "../plugins/musekit/skills/diagram-design/src/geometry.js";

test("orthogonal routing preserves ports and avoids an intervening rectangle", () => {
  const a = { x: 0, y: 100, w: 100, h: 80 },
    b = { x: 420, y: 100, w: 100, h: 80 },
    obstacle = { x: 200, y: 80, w: 120, h: 180 };
  const r = route(
    a,
    b,
    { fromPort: { side: "right" }, toPort: { side: "left" } },
    [obstacle],
  );
  assert.equal(r.blocked, false);
  assert.deepEqual(r.points[0], { x: 100, y: 140 });
  assert.deepEqual(r.points.at(-1), { x: 420, y: 140 });
  assert.equal(pathHits(r.points, obstacle), false);
  for (let i = 1; i < r.points.length; i++)
    assert.ok(
      r.points[i].x === r.points[i - 1].x ||
        r.points[i].y === r.points[i - 1].y,
    );
});
test("routing reports an enclosed port and detects diagonal intersections", () => {
  const result = orthogonal({ x: 20, y: 20 }, { x: 200, y: 100 }, [
    { x: 0, y: 0, w: 50, h: 50 },
  ]);
  assert.equal(result.blocked, true);
  assert.equal(
    segmentHits(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 40, y: 40, w: 20, h: 20 },
    ),
    true,
  );
  assert.equal(
    segmentHits(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 40, y: 0, w: 20, h: 20 },
    ),
    false,
  );
});
test("self-loop exits and returns to distinct sides without passing through the node", () => {
  const box = { x: 100, y: 100, w: 180, h: 120 };
  const r = route(
    box,
    box,
    { fromPort: { side: "top" }, toPort: { side: "right" }, kind: "loop" },
    [],
  );
  assert.equal(r.blocked, false);
  assert.deepEqual(r.points[0], { x: 190, y: 100 });
  assert.deepEqual(r.points.at(-1), { x: 280, y: 160 });
  assert.equal(pathHits(r.points, box), false);
});
test("short gutters do not make port stubs enter the opposite node", () => {
  const a = { x: 0, y: 0, w: 200, h: 150 },
    b = { x: 212, y: 0, w: 180, h: 320 };
  const result = route(
    a,
    b,
    { fromPort: { side: "right" }, toPort: { side: "left" } },
    [],
  );
  assert.equal(result.blocked, false);
  assert.equal(pathHits(result.points, a), false);
  assert.equal(pathHits(result.points, b), false);
});
test("pinned bends remain orthogonal after an endpoint moves", () => {
  const pin = { x: 240, y: 90 },
    result = orthogonal({ x: 115, y: 50 }, { x: 405, y: 160 }, [], [pin]);
  assert.ok(result.points.some((p) => p.x === pin.x && p.y === pin.y));
  for (let i = 1; i < result.points.length; i++)
    assert.ok(
      result.points[i].x === result.points[i - 1].x ||
        result.points[i].y === result.points[i - 1].y,
    );
});
test("automatic port stubs lose redundant reversals while explicit pins are retained and diagnosed", () => {
  const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 50 }];
  assert.equal(pathBacktracks(points), true);
  assert.deepEqual(simplify(points), points);
  assert.deepEqual(simplify(points, false), [points[0], points[2], points[3]]);
  assert.equal(pathBacktracks(simplify(points, false)), false);
  const from = { x: 100, y: 100, w: 200, h: 120 }, to = { x: 500, y: 400, w: 200, h: 120 };
  const automatic = route(from, to, { fromPort: { side: "left" }, toPort: { side: "bottom" } }, []);
  assert.equal(pathBacktracks(automatic.points), false);
  assert.equal(pathHits(automatic.points, from), false);
  assert.equal(pathHits(automatic.points, to), false);
  assert.equal(pathBacktracks([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 9.5, y: 0 }]), false);
});
test("label placement uses the supplied measured dimensions and reports exhaustion", () => {
  const points = [
      { x: 100, y: 200 },
      { x: 600, y: 200 },
    ],
    size = { w: 310, h: 54 },
    obstacles = [{ x: 190, y: 130, w: 360, h: 65 }];
  const p = labelPosition(points, size, obstacles);
  assert.equal(p.blocked, false);
  assert.equal(overlaps({ ...p, ...size }, obstacles[0]), false);
  assert.equal(
    labelPosition(points, size, [{ x: -1000, y: -1000, w: 3000, h: 3000 }])
      .blocked,
    true,
  );
});
test("packager rejects missing endpoints, duplicate IDs and external resources; packing is idempotent", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "diagram-contract-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = join(dir, "input.html"),
    out = join(dir, "out.html"),
    script = resolve(
      "plugins/musekit/skills/diagram-design/scripts/prepare_diagram.py",
    );
  const source = readFileSync("tests/fixtures/diagram.html", "utf8");
  writeFileSync(input, source);
  execFileSync("python3", [script, input, "--output", out]);
  const once = readFileSync(out, "utf8");
  execFileSync("python3", [script, out, "--output", out]);
  assert.equal(readFileSync(out, "utf8"), once);
  const saved = once.replace(
    "</body>",
    '<script type="application/json" id="diagram-state">{"version":1,"nodes":{},"edges":{}}</script></body>',
  );
  writeFileSync(out, saved);
  assert.equal(spawnSync("python3", [script, out, "--check"]).status, 0);
  for (const bad of [
    source.replace('"kind": "loop",', '"kind": "loop", "points": [{"x": "unknown", "y": 10}],'),
    source.replace(/"to"\s*:\s*"B"/, '"to":"missing"'),
    source.replace('data-diagram-node="B"', 'data-diagram-node="A"'),
    source.replace("</body>", '<img src="https://example.com/a.png"></body>'),
    source.replace(
      "</style>",
      "div{background:url(https://example.com/a.png)}</style>",
    ),
    source.replace(/"id"\s*:\s*"e1"/, '"id":"A"'),
    source.replace(
      "</body>",
      '<script type="application/json" id="diagram-state">{"version":1,"nodes":{"A":{"dx":"bad"}}}</script></body>',
    ),
  ]) {
    writeFileSync(input, bad);
    const result = spawnSync("python3", [script, input], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.ok(!result.stderr.includes("Traceback"));
  }
});
