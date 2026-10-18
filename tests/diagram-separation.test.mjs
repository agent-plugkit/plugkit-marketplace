import test from "node:test";
import assert from "node:assert/strict";
import {
  route,
  orthogonal,
  expand,
  port,
  stub,
  simplify,
} from "../plugins/musekit/skills/diagram-design/src/geometry.js";
import {
  readability,
  separateRoutes,
} from "../plugins/musekit/skills/diagram-design/src/quality.js";

// A→D, B→C and E→D all leave the left column on the same vertical line.
const boxes = {
  A: { x: 60, y: 60, w: 120, h: 60 },
  E: { x: 60, y: 210, w: 120, h: 60 },
  B: { x: 60, y: 360, w: 120, h: 60 },
  C: { x: 460, y: 210, w: 120, h: 60 },
  D: { x: 460, y: 510, w: 120, h: 60 },
};
const lines = [
  { id: "e1", from: "A", to: "D" },
  { id: "e2", from: "B", to: "C" },
  { id: "e3", from: "E", to: "D" },
];
const spec = {
  fromPort: { side: "right", at: 0.5 },
  toPort: { side: "left", at: 0.5 },
};
const obstacles = (e) =>
  Object.entries(boxes)
    .filter(([id]) => id !== e.from && id !== e.to)
    .map(([, r]) => expand(r, 8));
const draw = (e, lanes) =>
  route(boxes[e.from], boxes[e.to], spec, obstacles(e), lanes);
// The runtime's two passes: independent routes, then separation.
function routes(edges, reroute = draw) {
  const first = edges.map((e) => ({
    ...e,
    points: draw(e).points,
    movable: e.movable ?? true,
  }));
  const changed = separateRoutes(first, reroute);
  return new Map(
    first.map((e) => [
      e.id,
      { from: e.from, to: e.to, points: changed.get(e.id)?.points || e.points },
    ]),
  );
}
const shared = (edges) =>
  readability(edges)
    .filter((i) => i.type === "shared-route")
    .map((i) => [i.id, ...i.relatedIds].join("-"));
const plain = (points) => points.map(({ x, y }) => [x, y]);

test("a route sharing a run with a settled one is redrawn; the settled one stays", () => {
  const independent = new Map(
    lines.map((e) => [e.id, { ...e, points: draw(e).points }]),
  );
  assert.ok(shared(independent).includes("e1-e2"));
  const separated = routes(lines);
  assert.deepEqual(shared(separated), []);
  assert.deepEqual(separated.get("e1").points, independent.get("e1").points);
  assert.deepEqual(separated.get("e3").points, independent.get("e3").points);
  assert.notDeepEqual(
    separated.get("e2").points,
    independent.get("e2").points,
  );
  assert.deepEqual(plain(separated.get("e1").points), [
    [180, 90],
    [194, 90],
    [194, 540],
    [460, 540],
  ]);
  const e2 = separated.get("e2").points;
  for (let i = 1; i < e2.length; i++)
    assert.ok(e2[i].x === e2[i - 1].x || e2[i].y === e2[i - 1].y);
});

test("relations with the same start or the same end share a trunk without a warning or a reroute", () => {
  const trunk = [
    [0, 0],
    [20, 0],
    [20, 100],
    [80, 100],
  ];
  const edge = (from, to, points) => ({
    from,
    to,
    points: points.map(([x, y]) => ({ x, y })),
  });
  for (const [a, b] of [
    [edge("A", "B", trunk), edge("A", "C", [...trunk.slice(0, 3), [20, 160]])],
    [edge("A", "D", trunk), edge("E", "D", [[20, 40], ...trunk.slice(2)])],
  ]) {
    const map = new Map([
      ["a", a],
      ["b", b],
    ]);
    assert.deepEqual(shared(map), []);
    const changed = separateRoutes(
      [...map].map(([id, e]) => ({ id, ...e, movable: true })),
      () => assert.fail("shared trunks are not conflicts"),
    );
    assert.equal(changed.size, 0);
  }
  // The same pair with different ends is still reported.
  assert.ok(
    shared(
      new Map([
        ["a", edge("A", "B", trunk)],
        ["b", edge("C", "D", trunk)],
      ]),
    ).length,
  );
});

test("separation follows relation IDs, not array order, and repeats exactly", () => {
  const once = routes(lines);
  assert.deepEqual(routes([...lines].reverse()), once);
  assert.deepEqual(routes(lines), once);
  // Renamed so B→C sorts first: it keeps its route and A→D moves instead.
  const renamed = lines.map((e) =>
    e.id === "e2" ? { ...e, id: "a2" } : e,
  );
  const result = routes(renamed),
    independent = draw(lines[1]).points;
  assert.deepEqual(result.get("a2").points, independent);
  assert.notDeepEqual(result.get("e1").points, once.get("e1").points);
  assert.deepEqual(shared(result), []);
});

test("routes without a forbidden shared run are never recomputed", () => {
  let calls = 0;
  const clean = routes(
    [lines[0], lines[2]],
    (e, lanes) => (calls++, draw(e, lanes)),
  );
  assert.equal(calls, 0);
  for (const e of [lines[0], lines[2]])
    assert.deepEqual(clean.get(e.id).points, draw(e).points);
  // Fixed routes are settled first and only act as lanes for the others.
  const fixed = routes(lines.map((e) => ({ ...e, movable: e.id === "e1" })));
  assert.deepEqual(fixed.get("e2").points, draw(lines[1]).points);
  assert.notDeepEqual(fixed.get("e1").points, draw(lines[0]).points);
});

test("without a clean alternative the original route stays and is still reported", () => {
  for (const reroute of [
    () => ({ points: [], blocked: true }),
    (e) => draw(e),
    () => null,
  ]) {
    const kept = routes(lines, reroute);
    assert.deepEqual(kept.get("e2").points, draw(lines[1]).points);
    assert.ok(shared(kept).includes("e1-e2"));
  }
  // A start shut in a corridor by a lane reports blocked; the search ends.
  const enclosed = orthogonal(
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    [
      { x: -50, y: -100, w: 300, h: 100 },
      { x: -50, y: 0, w: 300, h: 100 },
    ],
    [],
    {},
    {
      avoid: [{ a: { x: -10, y: 0 }, b: { x: 210, y: 0 } }],
      channels: [{ y: 0 }],
    },
  );
  assert.equal(enclosed.blocked, true);
});

test("lanes block travel along other routes, and an empty lane set changes nothing", () => {
  const start = { x: 0, y: 0 },
    end = { x: 200, y: 100 },
    plainRoute = orthogonal(start, end, []);
  assert.deepEqual(orthogonal(start, end, [], [], {}, {}), plainRoute);
  const around = orthogonal(start, end, [], [], {}, {
    avoid: plainRoute.points
      .slice(1)
      .map((b, i) => ({ a: plainRoute.points[i], b })),
  });
  assert.equal(around.blocked, false);
  assert.notDeepEqual(around.points, plainRoute.points);
  // A stub length override sets where the route turns beside the port; a
  // stub shorter than the node clearance still starts outside it.
  const short = route(
    { x: 0, y: 0, w: 100, h: 60 },
    { x: 300, y: 200, w: 100, h: 60 },
    { fromPort: { side: "right" }, toPort: { side: "left" } },
    [],
    { reach: { from: 5, to: 5 } },
  );
  assert.equal(short.blocked, false);
  assert.deepEqual(plain(short.points), [
    [100, 30],
    [105, 30],
    [105, 230],
    [300, 230],
  ]);
});

test("a crossing on a grid vertex costs the same as one inside a segment", () => {
  const start = { x: 0, y: 0 },
    end = { x: 200, y: 100 },
    wall = [{ x: 90, y: -10, w: 20, h: 120 }];
  // Below the wall the route would cross x = 100, a grid line; above it does not.
  for (const x of [100, 100.1]) {
    const around = orthogonal(start, end, wall, [], {}, {
      avoid: [{ a: { x, y: 100 }, b: { x, y: 150 } }],
    });
    assert.equal(around.blocked, false);
    assert.ok(around.points.every((p) => p.y <= end.y));
  }
});

test("two relations between the same pair of nodes may not share a line", () => {
  const trunk = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];
  const map = new Map([
    ["a", { from: "A", to: "B", points: trunk }],
    ["b", { from: "A", to: "B", points: trunk }],
  ]);
  assert.deepEqual(shared(map), ["a-b"]);
  const aside = [
    { x: 0, y: 0 },
    { x: 0, y: 20 },
    { x: 100, y: 20 },
    { x: 100, y: 0 },
  ];
  const changed = separateRoutes(
    [...map].map(([id, e]) => ({ id, ...e, movable: true })),
    ({ id }, { avoid }) => {
      assert.equal(id, "b");
      assert.ok(avoid.length);
      return { points: aside, blocked: false };
    },
  );
  assert.deepEqual([...changed.keys()], ["b"]);
});

test("ID order is a total order on code units", () => {
  // "eK" and "e\u212A" (Kelvin sign) compare equal under localeCompare.
  const edges = [
    { id: "eK", from: "A", to: "D" },
    { id: "e\u212A", from: "B", to: "C" },
  ];
  const forward = routes(edges),
    backward = routes([...edges].reverse());
  assert.deepEqual(backward, forward);
  assert.deepEqual(forward.get("eK").points, draw(edges[0]).points);
  assert.notDeepEqual(forward.get("e\u212A").points, draw(edges[1]).points);
});

test("a crossing where a port stub meets the searched path is charged once, a retraced touch never", () => {
  // The stub end (200, 100) lies on the vertical line; turning back before it
  // crosses nothing, at the same length and corner count.
  const result = route(
    { x: 80, y: 70, w: 106, h: 60 },
    { x: 214, y: 170, w: 100, h: 60 },
    spec,
    [{ x: 204, y: 120, w: 40, h: 40 }],
    {
      avoid: [{ a: { x: 200, y: 80 }, b: { x: 200, y: 150 } }],
      channels: [{ x: 200 }],
    },
  );
  assert.equal(result.blocked, false);
  assert.deepEqual(plain(result.points), [
    [186, 100],
    [193, 100],
    [193, 200],
    [214, 200],
  ]);
});

test("each crossing costs exactly 16 px, inside a segment, on a grid vertex or at a stub end", () => {
  const line = (x, y0, y1) => ({ a: { x, y: y0 }, b: { x, y: y1 } });
  // Over the wall crosses the line once; under it is 2t px longer.
  for (const x of [95, 100])
    for (const [t, over] of [
      [7.5, false],
      [8.5, true],
    ]) {
      const { points } = orthogonal(
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        [{ x: 90, y: -30, w: 20, h: 60 + t }],
        [],
        {},
        { avoid: [line(x, -70, -29)] },
      );
      assert.equal(points[1].y < 0, over, `x=${x} t=${t}`);
    }
  // Both stubs end on x = 200; one route turns right of them at x = 207 and
  // one left at x = 193, each with two corners. A line through one stub end
  // is crossed by the route going straight on there, while the other route
  // crosses a line inside a segment. A spare obstacle edge moves either
  // route 0.5 px closer, and that one wins only if both crossings cost alike.
  for (const [through, inside] of [
    [line(200, 50, 150), line(196.5, 190, 210)],
    [line(200, 150, 250), line(203.5, 90, 110)],
  ])
    for (const [x, spare] of [
      [206.75, { x: 207.75, y: 600, w: 5, h: 5 }],
      [193.25, { x: 187.25, y: 600, w: 5, h: 5 }],
    ]) {
      const { points } = route(
        { x: 80, y: 70, w: 106, h: 60 },
        { x: 214, y: 170, w: 100, h: 60 },
        spec,
        [spare],
        { avoid: [through, inside] },
      );
      assert.deepEqual(plain(points), [
        [186, 100],
        [x, 100],
        [x, 200],
        [214, 200],
      ]);
    }
});

// The price of a drawn route: length, 16 px per corner and per line crossed
// strictly inside both segments.
function price(points, avoid) {
  const segs = points.slice(1).map((b, i) => [points[i], b]),
    vertical = ([a, b]) => a.x === b.x,
    between = (v, p, q) => v > Math.min(p, q) && v < Math.max(p, q);
  const crossings = segs.reduce(
    (n, s) =>
      n +
      avoid.filter(({ a, b }) =>
        vertical(s) === vertical([a, b])
          ? false
          : vertical(s)
            ? between(a.y, s[0].y, s[1].y) && between(s[0].x, a.x, b.x)
            : between(a.x, s[0].x, s[1].x) && between(s[0].y, a.y, b.y),
      ).length,
    0,
  );
  const length = segs.reduce(
    (n, [a, b]) => n + Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
    0,
  );
  return { crossings, total: length + (points.length - 2) * 16 + crossings * 16 };
}
// The search route() runs (gaps here leave 14 px stubs and 6 px clearance),
// with the cost it ranked the drawn route by.
function search(from, to, spec, extra, lanes) {
  const a = port(from, spec.fromPort),
    b = port(to, spec.toPort);
  const { points, cost } = orthogonal(
    stub(a, spec.fromPort.side),
    stub(b, spec.toPort.side),
    [...extra, expand(from, 6), expand(to, 6)],
    [],
    { from: a, to: b },
    lanes,
  );
  const drawn = simplify([a, ...points, b], false);
  assert.deepEqual(drawn, route(from, to, spec, extra, lanes).points);
  return { points: drawn, cost };
}

test("the search charges exactly 16 px for each crossing of the drawn route", () => {
  const h = (x0, x1, y) => ({ a: { x: x0, y }, b: { x: x1, y } }),
    v = (x, y0, y1) => ({ a: { x, y: y0 }, b: { x, y: y1 } });
  // Two lines share y = 67.5 across the end stub. Touching them and turning
  // back before the stub would hide both crossings; the stub still makes them.
  const top = { fromPort: { side: "top", at: 0.5 }, toPort: { side: "top", at: 0.5 } },
    avoid = [h(209, 400, 67.5), h(209, 450, 67.5), h(279.5, 310, 60)];
  const back = search(
    { x: 150, y: 89, w: 57, h: 104 },
    { x: 290, y: 74, w: 59, h: 91 },
    top,
    [],
    { avoid, channels: [{ y: 67.5 }] },
  );
  assert.deepEqual(plain(back.points), [
    [178.5, 89],
    [178.5, 55.5],
    [319.5, 55.5],
    [319.5, 74],
  ]);
  assert.deepEqual(price(back.points, avoid), { crossings: 2, total: 257 });
  assert.equal(back.cost, 257);
  // A crossing inside a segment or on a grid vertex, without stubs.
  for (const x of [95, 100]) {
    const avoid = [v(x, -70, -29)],
      { points, cost } = orthogonal(
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        [{ x: 90, y: -30, w: 20, h: 68.5 }],
        [],
        {},
        { avoid },
      );
    assert.deepEqual(price(points, avoid), { crossings: 1, total: cost });
  }
  // Crossings inside both stubs and where each stub meets the searched path.
  const stubs = [v(107, 0, 40), v(114, 10, 30), v(293, 110, 130), v(286, 110, 130)],
    { points, cost } = search(
      { x: 0, y: 0, w: 100, h: 40 },
      { x: 300, y: 100, w: 100, h: 40 },
      spec,
      [{ x: 150, y: -100, w: 100, h: 400 }],
      { avoid: stubs },
    );
  assert.deepEqual(plain(points), [
    [100, 20],
    [149, 20],
    [149, -101],
    [251, -101],
    [251, 120],
    [300, 120],
  ]);
  assert.deepEqual(price(points, stubs), { crossings: 4, total: cost });
});
