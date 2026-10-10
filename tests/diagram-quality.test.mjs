import test from "node:test";
import assert from "node:assert/strict";
import {
  distributePorts,
  readability,
  issue,
  orderedIssues,
} from "../plugins/musekit/skills/diagram-design/src/quality.js";

const boxes = new Map([
  ["A", { x: 0, y: 0, w: 100, h: 100 }],
  ["B", { x: 200, y: 0, w: 80, h: 40 }],
  ["C", { x: 200, y: 150, w: 80, h: 40 }],
]);
const entries = ["B", "C"].map((to, i) => ({
  edge: { id: `e${i}`, from: "A", to },
  spec: { fromPort: { side: "right" }, toPort: { side: "left" } },
}));
test("automatic ports are separated, sorted by counterpart and independent of relation order", () => {
  const a = distributePorts(entries, boxes),
    b = distributePorts([...entries].reverse(), boxes);
  assert.deepEqual([...a.ports].sort(), [...b.ports].sort());
  const first = a.ports.get("e0").fromPort.at * 100,
    second = a.ports.get("e1").fromPort.at * 100;
  assert.ok(first < second && second - first >= 6);
  assert.ok(first >= 12 && second <= 88);
  assert.equal(a.issues.length, 0);
});
test("fixed anchors are reserved; explicit pins and non-orthogonal edges are not moved", () => {
  const fixed = { ...entries[0], fixedFrom: true };
  const result = distributePorts([fixed, entries[1]], boxes);
  assert.equal(result.ports.get("e0"), undefined);
  assert.ok(Math.abs(result.ports.get("e1").fromPort.at * 100 - 50) >= 6);
  for (const kind of ["straight", "loop", "sequence"]) {
    const r = distributePorts(
      entries.map((e) => ({ ...e, edge: { ...e.edge, kind } })),
      boxes,
    );
    assert.equal(r.ports.size, 0);
  }
  const r = distributePorts(
    entries.map((e) => ({
      ...e,
      spec: { ...e.spec, points: [{ x: 150, y: 60 }] },
    })),
    boxes,
  );
  assert.equal(r.ports.size, 0);
});
test("small nodes report crowding without modifying fixed positions", () => {
  const r = distributePorts(
    entries,
    new Map([...boxes, ["A", { x: 0, y: 0, w: 20, h: 20 }]]),
  );
  assert.equal(r.ports.size, 0);
  assert.equal(r.issues[0].severity, "warning");
  assert.deepEqual(r.issues[0].relatedIds, ["e0", "e1"]);
});
// Horizontal relations; returns the absolute y of an effective endpoint.
const facing = (rects, relations, obstacles = []) => {
  const boxes = new Map(Object.entries(rects));
  const { ports } = distributePorts(
    relations.map((edge) => ({
      edge,
      spec: {
        fromPort: { side: "right" },
        toPort: { side: "left" },
        ...edge.spec,
      },
      fixedFrom: Number.isFinite(edge.spec?.fromPort?.at),
      fixedTo: Number.isFinite(edge.spec?.toPort?.at),
    })),
    boxes,
    obstacles,
  );
  return (id, endpoint) => {
    const edge = relations.find((e) => e.id === id),
      r = boxes.get(endpoint === "fromPort" ? edge.from : edge.to);
    return (
      r.y +
      r.h * (ports.get(id)?.[endpoint]?.at ?? edge.spec?.[endpoint]?.at ?? 0.5)
    );
  };
};
const card = (x, y, h) => ({ x, y, w: 150, h });
test("facing endpoints share one coordinate, and a row keeps one straight line", () => {
  const chain = [
    { id: "e1", from: "A", to: "B" },
    { id: "e2", from: "B", to: "C" },
  ];
  for (const heights of [
    [156, 132, 156],
    [100, 150, 200],
  ]) {
    const y = facing(
      { A: card(0, 0, heights[0]), B: card(200, 0, heights[1]), C: card(400, 0, heights[2]) },
      chain,
    );
    const shortest = Math.min(...heights) / 2;
    for (const id of ["e1", "e2"]) {
      assert.equal(y(id, "fromPort"), shortest);
      assert.equal(y(id, "toPort"), shortest);
    }
  }
});
test("straight endpoints keep side order, spacing and node clearance, while slivers stay orthogonal", () => {
  const fan = [
    { id: "e1", from: "A", to: "B" },
    { id: "e2", from: "A", to: "C" },
  ];
  for (const [below, rects] of [
    [true, { A: card(0, 0, 120), B: card(300, 10, 100), C: card(300, 220, 100) }],
    [false, { A: card(0, 200, 120), B: card(300, 210, 100), C: card(300, 0, 100) }],
  ]) {
    const y = facing(rects, fan);
    assert.equal(y("e1", "fromPort"), y("e1", "toPort"));
    const offset = y("e2", "fromPort") - y("e1", "fromPort");
    assert.ok(below ? offset >= 12 : offset <= -12);
  }
  const blocked = { id: "X", x: 212, y: 52, w: 116, h: 76 };
  const y = facing(
    { A: card(0, 0, 200), B: card(400, 0, 200) },
    [{ id: "e1", from: "A", to: "B" }],
    [blocked],
  );
  assert.equal(y("e1", "fromPort"), 128);
  assert.equal(y("e1", "toPort"), 128);
  const sliver = facing({ A: card(0, 0, 154), B: card(300, 131, 197) }, [
    { id: "e1", from: "A", to: "B" },
  ]);
  assert.equal(sliver("e1", "fromPort"), 77);
  assert.equal(sliver("e1", "toPort"), 131 + 197 / 2);
});
test("parallel relations stay straight, and an automatic end follows a fixed one only within reach", () => {
  const pair = facing({ A: card(0, 0, 100), B: card(300, 20, 120) }, [
    { id: "go", from: "A", to: "B" },
    {
      id: "back",
      from: "B",
      to: "A",
      spec: { fromPort: { side: "left" }, toPort: { side: "right" } },
    },
  ]);
  assert.equal(pair("go", "fromPort"), pair("go", "toPort"));
  assert.equal(pair("back", "fromPort"), pair("back", "toPort"));
  assert.equal(pair("go", "fromPort") - pair("back", "toPort"), 12);
  for (const [at, follows] of [
    [0.3, true],
    [0.9, false],
  ]) {
    const y = facing({ A: card(0, 0, 200), B: card(300, 20, 120) }, [
      {
        id: "e1",
        from: "A",
        to: "B",
        spec: { fromPort: { side: "right", at } },
      },
    ]);
    assert.equal(y("e1", "fromPort"), 200 * at);
    assert.equal(y("e1", "toPort") === 200 * at, follows);
  }
});
const edge = (points, extra = {}) => ({
  from: "A",
  to: "B",
  points: points.map(([x, y]) => ({ x, y })),
  ...extra,
});
test("shared runs merge forward collinear segments and exclude isolated crossings and short common stubs", () => {
  const detect = (a, b) =>
    readability(
      new Map([
        ["a", a],
        ["b", b],
      ]),
    ).filter((i) => i.type === "shared-route");
  const a = edge(
    [
      [0, 0],
      [40, 0],
      [80, 0],
    ],
    { from: "X", to: "Y" },
  );
  assert.ok(
    detect(
      a,
      edge([
        [20, 0],
        [44, 0],
      ]),
    ).length,
  );
  assert.equal(
    detect(
      a,
      edge([
        [20, 0],
        [43, 0],
      ]),
    ).length,
    0,
  );
  assert.equal(
    detect(
      a,
      edge([
        [30, -10],
        [30, 10],
      ]),
    ).length,
    0,
  );
  assert.equal(
    detect(
      edge([
        [0, 0],
        [14, 0],
        [14, 60],
      ]),
      edge([
        [0, 0],
        [14, 0],
        [14, -60],
      ]),
    ).length,
    0,
  );
});
test("shared endpoint exemptions do not shorten unrelated endpoint runs", () => {
  const a = edge([
    [0, 0],
    [0, 50],
    [100, 50],
  ]);
  const b = edge(
    [
      [0, 0],
      [76, 0],
      [76, 50],
      [100, 50],
    ],
    { to: "C" },
  );
  for (const reverse of [false, true]) {
    const next = reverse
      ? { ...b, from: b.to, to: b.from, points: [...b.points].reverse() }
      : b;
    assert.ok(
      readability(
        new Map([
          ["a", a],
          ["b", next],
        ]),
      ).some((i) => i.type === "shared-route" && i.evidence.length === 24),
    );
  }
});
test("label clearance observes strict 4px boundary, ignores own route and suppresses collision duplicates", () => {
  const a = edge(
    [
      [0, 20],
      [100, 20],
    ],
    { label: { x: 20, y: 10, w: 20, h: 10 } },
  );
  const build = (y) =>
    new Map([
      ["a", a],
      [
        "b",
        edge(
          [
            [0, y],
            [100, y],
          ],
          { from: "C", to: "D" },
        ),
      ],
    ]);
  assert.equal(
    readability(build(6)).filter((i) => i.type === "label-clearance").length,
    0,
  );
  assert.equal(
    readability(build(7)).filter((i) => i.type === "label-clearance").length,
    1,
  );
  assert.equal(
    readability(
      build(11),
      [],
      [issue("label-line", "a", "collision", { relatedIds: ["b"] })],
    ).filter((i) => i.type === "label-clearance").length,
    0,
  );
  assert.equal(readability(new Map([["a", a]])).length, 0);
});
test("border warnings ignore perpendicular crossings and enforce continuous length and clearance", () => {
  const frame = [
    { id: "group", rect: { x: 0, y: 0, w: 100, h: 100 }, sides: ["top"] },
  ];
  assert.equal(
    readability(
      new Map([
        [
          "a",
          edge([
            [30, -30],
            [30, 30],
          ]),
        ],
      ]),
      frame,
    ).length,
    0,
  );
  assert.equal(
    readability(
      new Map([
        [
          "a",
          edge([
            [-20, 4],
            [120, 4],
          ]),
        ],
      ]),
      frame,
    ).length,
    0,
  );
  assert.ok(
    readability(
      new Map([
        [
          "a",
          edge([
            [-20, 3],
            [120, 3],
          ]),
        ],
      ]),
      frame,
    ).some((i) => i.type === "border-run"),
  );
  for (const [length, expected] of [
    [23, 0],
    [24, 1],
  ]) {
    const found = readability(
      new Map([
        [
          "a",
          edge([
            [20, 3],
            [20 + length, 3],
          ]),
        ],
      ]),
      frame,
    ).filter((i) => i.type === "border-run");
    assert.equal(found.length, expected);
  }
});
test("diagnostics retain distinct subjects and stable identity even with matching text", () => {
  const a = issue("label", "a", "same", { relatedIds: ["b"] }),
    b = issue("label", "a", "same", { relatedIds: ["c"] });
  assert.equal(orderedIssues([a, b, a]).length, 2);
  assert.deepEqual(orderedIssues([b, a]), orderedIssues([a, b]));
});
