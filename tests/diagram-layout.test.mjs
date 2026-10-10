import test from "node:test";
import assert from "node:assert/strict";
import {
  tidyLayout,
  layoutIssues,
} from "../plugins/musekit/skills/diagram-design/src/layout.js";

const node = (id, x, y, w, h, extra = {}) => ({
  id,
  box: { x, y, w, h },
  movable: true,
  resizable: true,
  peer: "ARTICLE.card",
  pad: 16,
  ...extra,
});
const link = (id, from, to, extra = {}) => ({
  id,
  from,
  to,
  fromSide: "right",
  toSide: "left",
  ...extra,
});
const changes = (result) => Object.fromEntries(result);

const cards = [
  node("read", 30, 190, 220, 156),
  node("check", 286, 190, 220, 132),
  node("write", 542, 190, 220, 156),
  node("note", 30, 420, 740, 140, { peer: "ARTICLE.note" }),
];
const chain = [link("e1", "read", "check"), link("e2", "check", "write")];
test("peers on a straight row share a height without moving what the row already cleared", () => {
  assert.deepEqual(changes(tidyLayout(cards, chain)), { check: { h: 156 } });
});

// The dataflow example: the discard outcome was raised to dodge the store below.
const flow = [
  node("Events", 50, 270, 180, 180, { peer: "A.node" }),
  node("Consent", 380, 270, 230, 179, { peer: "A.accent" }),
  node("Discard", 770, 230, 230, 179, { peer: "A.muted" }),
  node("Mask", 380, 610, 230, 179, { peer: "A.accent" }),
  node("Store", 870, 480, 230, 154, { peer: "A.node" }),
  node("Aggregate", 870, 770, 230, 154, { peer: "A.node" }),
  node("Report", 1270, 610, 230, 197, { peer: "A.node" }),
];
const relations = [
  link("e1", "Events", "Consent"),
  link("e2", "Consent", "Discard"),
  link("e3", "Consent", "Mask", { fromSide: "bottom", toSide: "top" }),
  link("e4", "Mask", "Store"),
  link("e5", "Mask", "Aggregate"),
  link("e6", "Store", "Report"),
  link("e7", "Aggregate", "Report"),
];
// Center of an object after tidy along y, or x when axis is "x".
const centerOf = (objects, result, id, axis = "y") => {
  const box = objects.find((o) => o.id === id).box,
    change = result.get(id) || {},
    [p, s, d] = axis === "y" ? ["y", "h", "dy"] : ["x", "w", "dx"];
  return box[p] + (change[d] || 0) + (change[s] ?? box[s]) / 2;
};
test("a raised node joins its row, the region below moves down, and split and merge hubs center on their branches", () => {
  const result = tidyLayout(flow, relations),
    at = (id) => centerOf(flow, result, id);
  assert.deepEqual(result.get("Discard"), { dy: 40.5 });
  assert.equal(result.get("Events"), undefined);
  // Consent sits half a pixel high, which already reads as aligned.
  assert.deepEqual(["Events", "Consent", "Discard"].map(at), [360, 359.5, 360]);
  const mid = (at("Store") + at("Aggregate")) / 2;
  assert.equal(at("Mask"), mid);
  assert.equal(at("Report"), mid);
  // Branches keep their spacing; the whole lower region only moves down.
  assert.equal(result.get("Store").dy, result.get("Aggregate").dy);
  for (const id of ["Mask", "Store", "Aggregate", "Report"])
    assert.ok(result.get(id).dy > 0);
});

test("a hub lined up with one branch keeps that straight line, while a tree parent centers over its children", () => {
  const side = [
    node("pay", 0, 100, 160, 80),
    node("ship", 260, 100, 160, 80),
    node("fail", 260, 260, 160, 80),
  ];
  assert.deepEqual(
    changes(
      tidyLayout(side, [link("a", "pay", "ship"), link("b", "pay", "fail")]),
    ),
    {},
  );
  const tree = [
    node("parent", 150, 0, 160, 60),
    node("left", 0, 160, 160, 60),
    node("right", 260, 160, 160, 60),
  ];
  const down = { fromSide: "bottom", toSide: "top" };
  const result = tidyLayout(tree, [
    link("a", "parent", "left", down),
    link("b", "parent", "right", down),
  ]);
  assert.equal(
    centerOf(tree, result, "parent", "x"),
    (centerOf(tree, result, "left", "x") +
      centerOf(tree, result, "right", "x")) /
      2,
  );
  // The parent sits right of the middle, so the children move right together.
  assert.deepEqual(changes(result), { left: { dx: 20 }, right: { dx: 20 } });
});

test("peers in a column share the widest width around their center, measured after text reflows", () => {
  const down = { fromSide: "bottom", toSide: "top" };
  const column = [
    node("a", 100, 0, 300, 80),
    node("b", 150, 140, 200, 110),
    node("c", 100, 300, 300, 80),
  ];
  const chain = [link("ab", "a", "b", down), link("bc", "b", "c", down)];
  const measured = [];
  const result = tidyLayout(column, chain, {
    measure: (id, w) => {
      measured.push([id, w]);
      return 84;
    },
  });
  assert.deepEqual(measured, [["b", 300]]);
  // The shorter reflowed node leaves gaps of 60 and 76, which even out.
  assert.deepEqual(changes(result), { b: { dx: -50, dy: 8, w: 300, h: 84 } });
  // A neighbor in the way keeps the narrower width; gaps of 60 and 50 even out.
  const crowded = [...column, node("note", 405, 150, 120, 60, { peer: "x" })];
  assert.deepEqual(tidyLayout(crowded, chain, { measure: () => 84 }).get("b"), {
    dy: -5,
  });
});

test("straight links make room for their labels and a wrapping group moves with its node", () => {
  const result = changes(
    tidyLayout(
      [
        node("a", 0, 0, 100, 60),
        node("lane", 140, -20, 140, 100, { group: true, peer: null }),
        node("b", 160, 0, 100, 60, { parent: "lane" }),
      ],
      [link("e", "a", "b", { label: { w: 80, h: 20 } })],
    ),
  );
  // 80 px label + 12 px on each side, measured from a.right to b.left.
  assert.deepEqual(result, { lane: { dx: 44 } });
});

test("locks, fixed canvases, authored routes, staggers and drifting decorations keep the composition", () => {
  const locked = flow.map((n) =>
    n.id === "Store" ? { ...n, movable: false } : n,
  );
  // Only the top row's gaps of 150 and 160 even out, within its extent; the
  // locked store ends where it began.
  const sideways = { Consent: { dx: 5 }, Mask: { dx: 5 } };
  assert.deepEqual(changes(tidyLayout(locked, relations)), sideways);
  assert.deepEqual(
    changes(tidyLayout(flow, relations, { fixedSize: true })),
    sideways,
  );
  // A relation with authored bends or one authored port keeps its nodes.
  const routed = relations.map((e) =>
    e.id === "e2" ? { ...e, fixed: true } : e,
  );
  assert.equal(changes(tidyLayout(flow, routed)).Discard, undefined);
  assert.deepEqual(
    changes(
      tidyLayout(
        [node("a", 0, 0, 100, 100), node("b", 200, 60, 100, 100)],
        [link("e", "a", "b")],
      ),
    ),
    {},
  );
  // A stage marker beside the lower rows would no longer line up with them.
  assert.deepEqual(
    changes(
      tidyLayout(flow, relations, {
        fixtures: [{ box: { x: 10, y: 600, w: 20, h: 20 } }],
      }),
    ),
    sideways,
  );
  // Content above every change is unaffected.
  assert.equal(
    changes(
      tidyLayout(flow, relations, {
        fixtures: [{ box: { x: 10, y: 100, w: 600, h: 40 } }],
      }),
    ).Discard.dy,
    40.5,
  );
  assert.equal(
    tidyLayout(cards, [link("e", "read", "check", { kind: "sequence" })]),
    null,
  );
});

test("layout issues report near misses and uneven peers, not deliberate staggers", () => {
  const codes = (objects, edges) =>
    layoutIssues(objects, edges).map((i) => `${i.code} ${i.id}`);
  assert.deepEqual(codes(cards, chain), ["geometry/uneven-peers read"]);
  assert.deepEqual(codes(flow, relations), [
    "geometry/unbalanced Mask",
    "geometry/unbalanced Report",
    "geometry/misaligned e2",
    "geometry/uneven-gaps Events",
  ]);
  const [mask, , discard] = layoutIssues(flow, relations);
  assert.equal(discard.severity, "warning");
  assert.deepEqual(discard.relatedIds, ["Consent", "Discard"]);
  assert.equal(discard.evidence.offset, 40);
  assert.deepEqual(discard.supportedFixes, ["move-node"]);
  assert.deepEqual(mask.relatedIds, ["Aggregate", "Store"]);
  assert.equal(mask.evidence.offset, 2.5);
  // Once tidied, nothing is left to report.
  assert.deepEqual(codes(tidied(flow, relations), relations), []);
});

// A workflow column whose authored tops gave uneven gaps; the fix step sits
// beside the verify step through relations with authored port ratios.
const fixed = { fixed: true };
const steps = [
  node("P", 0, 0, 300, 100),
  node("GA", 0, 160, 300, 60),
  node("AP", 0, 280, 300, 100),
  node("GB", 0, 470, 300, 60),
  node("V", 0, 590, 300, 100),
  node("GC", 0, 780, 300, 60),
  node("AR", 0, 900, 300, 100),
  node("F", 420, 590, 200, 100),
];
const down = { fromSide: "bottom", toSide: "top" };
const flowDown = [
  link("e0", "P", "GA", down),
  link("e1", "GA", "AP", down),
  link("e2", "AP", "GB", down),
  link("e3", "GB", "V", down),
  link("e4", "V", "GC", down),
  link("e5", "GC", "AR", down),
  link("fail", "V", "F", fixed),
  link("retry", "F", "V", { ...fixed, fromSide: "bottom", toSide: "right" }),
];
// Objects after tidy, for layout issues and gap checks.
const tidied = (objects, edges, options) => {
  const result = tidyLayout(objects, edges, options);
  return objects.map((o) => {
    const c = result.get(o.id) || {};
    return {
      ...o,
      box: {
        x: o.box.x + (c.dx || 0),
        y: o.box.y + (c.dy || 0),
        w: c.w ?? o.box.w,
        h: c.h ?? o.box.h,
      },
    };
  });
};
// A column of 200 x 100 nodes with the given gaps, linked top to bottom.
const column = (gaps, extra = {}) => {
  let y = 0;
  return ["a", "b", "c", "d"].slice(0, gaps.length + 1).map((id, i) => {
    const n = node(id, 0, y, 200, 100, extra[id]);
    y += 100 + (gaps[i] ?? 0);
    return n;
  });
};
const chainDown = (ids, extra = {}) =>
  ids
    .slice(1)
    .map((id, i) =>
      link(`${ids[i]}${id}`, ids[i], id, { ...down, ...extra[id] }),
    );
test("gaps along a chain even out at their mean, and what sits beside a step moves with it", () => {
  assert.deepEqual(changes(tidyLayout(steps, flowDown)), {
    GA: { dy: 10 },
    AP: { dy: 20 },
    V: { dy: 10 },
    F: { dy: 10 },
    GC: { dy: -10 },
  });
  const after = new Map(tidied(steps, flowDown).map((o) => [o.id, o.box]));
  const ids = ["P", "GA", "AP", "GB", "V", "GC", "AR"];
  assert.deepEqual(
    ids
      .slice(1)
      .map(
        (id, i) =>
          after.get(id).y - (after.get(ids[i]).y + after.get(ids[i]).h),
      ),
    [70, 70, 70, 70, 70, 70],
  );
  assert.deepEqual(
    layoutIssues(steps, flowDown).map((i) => [i.code, i.id, i.evidence.gaps]),
    [["geometry/uneven-gaps", "P", [60, 60, 90, 60, 90, 60]]],
  );
  assert.deepEqual(layoutIssues(tidied(steps, flowDown), flowDown), []);
  // A cramped gap is an accident like any other.
  assert.deepEqual(
    changes(tidyLayout(column([15, 60, 60]), chainDown(["a", "b", "c", "d"]))),
    { b: { dy: 30 }, c: { dy: 15 } },
  );
});

test("a label that needs room, a lock, a divider or an even neighbor keeps the authored gaps", () => {
  // Evened at 50, the 30 px label would lack its 12 px margins.
  assert.deepEqual(
    changes(
      tidyLayout(
        column([40, 60]),
        chainDown(["a", "b", "c"], { c: { label: { w: 60, h: 30 } } }),
      ),
    ),
    {},
  );
  // A locked step that would have to move keeps the gaps; the last step
  // never moves, so locking it changes nothing.
  assert.deepEqual(
    changes(
      tidyLayout(
        column([40, 60], { b: { movable: false } }),
        chainDown(["a", "b", "c"]),
      ),
    ),
    {},
  );
  assert.deepEqual(
    changes(
      tidyLayout(
        column([40, 60], { c: { movable: false } }),
        chainDown(["a", "b", "c"]),
      ),
    ),
    { b: { dy: 10 } },
  );
  assert.deepEqual(
    changes(
      tidyLayout(column([40, 60]), chainDown(["a", "b", "c"]), {
        fixtures: [{ box: { x: 0, y: 270, w: 200, h: 2 } }],
      }),
    ),
    {},
  );
  // Evening the left column would shift the right one, which is already even.
  const pair = [
    ...column([40, 60]),
    node("x", 400, 0, 200, 100),
    node("y", 400, 150, 200, 100),
    node("z", 400, 300, 200, 100),
  ];
  const both = [...chainDown(["a", "b", "c"]), ...chainDown(["x", "y", "z"])];
  assert.deepEqual(changes(tidyLayout(pair, both)), {});
});

test("authored port ratios on facing sides line up their ports unless set apart on purpose", () => {
  const ratios = { fixed: true, ratios: [0.35, 0.35] };
  // The verify step's port sits at 42 px, the fix step's at 10 + 35 = 45 px.
  const pair = [node("V", 0, 0, 300, 120), node("F", 420, 10, 200, 100)];
  const fail = [link("fail", "V", "F", ratios)];
  assert.deepEqual(changes(tidyLayout(pair, fail)), { V: { dy: 3 } });
  const [issue] = layoutIssues(pair, fail);
  assert.equal(issue.code, "geometry/misaligned");
  assert.equal(issue.message, "V 与 F 的端口相差 3 px");
  assert.equal(issue.evidence.alignment, "port");
  assert.deepEqual(layoutIssues(tidied(pair, fail), fail), []);
  // Ports 93 px apart, beyond half the shorter node, are a deliberate step.
  const apart = [pair[0], node("F", 420, 100, 200, 100)];
  assert.deepEqual(changes(tidyLayout(apart, fail)), {});
  assert.deepEqual(layoutIssues(apart, fail), []);
});

test("a hub nearer one of three branches than their middle keeps its main line", () => {
  const objects = [
    node("P", 0, 200, 160, 80),
    node("H", 240, 200, 160, 80),
    node("U", 520, 100, 160, 80),
    node("M", 520, 200, 160, 80),
    node("D", 520, 420, 160, 80),
  ];
  const edges = [
    link("ph", "P", "H"),
    link("hu", "H", "U"),
    link("hm", "H", "M"),
    link("hd", "H", "D"),
  ];
  assert.deepEqual(changes(tidyLayout(objects, edges)), {});
  assert.deepEqual(layoutIssues(objects, edges), []);
});

test("port ratios that disagree stay as drawn while the rest of the axis is tidied", () => {
  const ratios = (at) => ({ fixed: true, ratios: [at, at] });
  const objects = [
    node("A", 0, 0, 200, 120),
    node("B", 300, 0, 200, 100),
    node("C", 0, 300, 200, 100),
    node("D", 300, 304, 200, 100),
  ];
  // Requests and responses at 0.35 and 0.65 need offsets of 7 and 13 px.
  const edges = [
    link("ask", "A", "B", ratios(0.35)),
    link("reply", "B", "A", {
      ...ratios(0.65),
      fromSide: "left",
      toSide: "right",
    }),
    link("cd", "C", "D"),
  ];
  assert.deepEqual(changes(tidyLayout(objects, edges)), { C: { dy: 4 } });
  assert.deepEqual(
    layoutIssues(objects, edges).map((i) => i.id),
    ["cd"],
  );
});

test("cascaded splits and merges settle however many stages they have", () => {
  const objects = [],
    edges = [];
  for (let i = 0, x = 0; i <= 8; i++, x += 400) {
    objects.push(node(`S${i}`, x, 100 + 3 * i, 120, 60));
    if (i === 8) break;
    objects.push(
      node(`U${i}`, x + 200, 0, 120, 60),
      node(`D${i}`, x + 200, 200, 120, 60),
    );
    edges.push(
      link(`su${i}`, `S${i}`, `U${i}`),
      link(`sd${i}`, `S${i}`, `D${i}`),
      link(`us${i}`, `U${i}`, `S${i + 1}`),
      link(`ds${i}`, `D${i}`, `S${i + 1}`),
    );
  }
  assert.ok(layoutIssues(objects, edges).length > 0);
  assert.deepEqual(layoutIssues(tidied(objects, edges), edges), []);
});

test("a lock inside a wrapping group and the canvas width keep their nodes in place", () => {
  const wrapped = (extra) => [
    node("a", 0, 0, 100, 60),
    node("lane", 140, -26, 140, 100, { group: true, peer: null }),
    node("b", 160, -6, 100, 60, { parent: "lane", ...extra }),
  ];
  const edges = [link("e", "a", "b")];
  assert.deepEqual(changes(tidyLayout(wrapped(), edges)), {
    lane: { dy: 6 },
  });
  assert.deepEqual(changes(tidyLayout(wrapped({ movable: false }), edges)), {});
  // Aligning the column would push the upper step past the canvas edge.
  const column = [node("b", 100, 0, 200, 80), node("c", 150, 140, 200, 80)];
  const down = [link("bc", "b", "c", { fromSide: "bottom", toSide: "top" })];
  assert.deepEqual(changes(tidyLayout(column, down)), { b: { dx: 50 } });
  assert.deepEqual(changes(tidyLayout(column, down, { width: 320 })), {});
});

test("frames the runtime pads anyway and locked nodes already within a pixel do not stop tidy", () => {
  // The lane's authored padding is 6 px; the runtime pads it to 16 px anyway.
  const padded = [
    node("p", 0, 0, 100, 60),
    node("q", 200, 6, 100, 60),
    node("lane", 0, 120, 300, 80, { group: true, peer: null }),
    node("r", 10, 130, 284, 60, { parent: "lane" }),
  ];
  assert.deepEqual(
    changes(tidyLayout(padded, [link("pq", "p", "q")], { width: 305 })),
    { p: { dy: 6 } },
  );
  // L is half a pixel off the row, which already reads as aligned.
  const row = [
    node("L", 0, 100.5, 100, 80, { movable: false }),
    node("M", 200, 101, 100, 80),
    node("N", 400, 95, 100, 80),
  ];
  assert.deepEqual(
    changes(tidyLayout(row, [link("lm", "L", "M"), link("mn", "M", "N")])),
    { N: { dy: 6 } },
  );
});

test("frames the runtime pads into each other are not new overlaps", () => {
  // The left lane's padding grows it 10 px into the touching right lane.
  const lanes = [
    node("p", 0, 0, 100, 60),
    node("q", 250, 6, 100, 60),
    node("lane1", 0, 100, 200, 100, { group: true, peer: null }),
    node("c1", 10, 110, 184, 60, { parent: "lane1", peer: "x" }),
    node("lane2", 200, 100, 200, 100, { group: true, peer: null }),
    node("c2", 216, 110, 168, 60, { parent: "lane2", peer: "y" }),
  ];
  // The row lines up, and the right lane makes room, moving what lies right
  // of it, the upper row included.
  assert.deepEqual(changes(tidyLayout(lanes, [link("pq", "p", "q")])), {
    p: { dy: 6 },
    q: { dx: 10 },
    lane1: { dy: 6 },
    lane2: { dx: 10, dy: 6 },
  });
});
