import * as G from "./geometry.js";
import { issue } from "./quality.js";

// Tidy refines an authored composition once, before editing starts. Nodes on a
// straight line keep the alignment they nearly have, split and merge hubs sit
// midway between their branches, same-role peers share a row height or column
// width, gaps along a chain even out, and labels get room. Objects move down or
// right and widen into free space; room is inserted instead of squeezing or
// nudging nodes aside. Only evening a chain moves nodes back, within its extent.
const FLOOR = 24,
  LABEL = 12,
  SLACK = 1;
const opposite = { right: "left", left: "right", bottom: "top", top: "bottom" };
const other = { x: "y", y: "x" };
// p/s: position and size along an axis; q/t: the cross axis.
const AXES = {
  y: { p: "y", s: "h", q: "x", t: "w" },
  x: { p: "x", s: "w", q: "y", t: "h" },
};
const end = (r, A) => r[A.p] + r[A.s];
const center = (r, A) => r[A.p] + r[A.s] / 2;
const crosses = (a, b, A) =>
  a[A.q] < b[A.q] + b[A.t] - G.EPS && b[A.q] < a[A.q] + a[A.t] - G.EPS;
// Nodes line up by their centers, starts or ends; centers win ties.
const MODES = [
  { name: "center", at: center },
  { name: "start", at: (r, A) => r[A.p] },
  { name: "end", at: end },
];
const spread = (boxes, mode, A) => {
  const v = boxes.map((r) => mode.at(r, A));
  return Math.max(...v) - Math.min(...v);
};
const nearest = (boxes, A) => {
  const spreads = MODES.map((m) => spread(boxes, m, A)),
    least = Math.min(...spreads);
  return spreads[0] <= least + SLACK
    ? { mode: MODES[0], spread: spreads[0] }
    : { mode: MODES[spreads.indexOf(least)], spread: least };
};
// Offsets above half the smaller node are a deliberate stagger, not a near miss.
const staggered = (a, b, A) =>
  nearest([a.box, b.box], A).spread > Math.min(a.box[A.s], b.box[A.s]) / 2;
// A group that only wraps one object moves with it as one block.
const blocks = (objects) => {
  const byId = new Map(objects.map((o) => [o.id, o])),
    count = new Map();
  for (const o of objects)
    if (byId.has(o.parent)) count.set(o.parent, (count.get(o.parent) || 0) + 1);
  return (o) => {
    while (count.get(o.parent) === 1) o = byId.get(o.parent);
    return o;
  };
};
// A line whose members follow one another through its links, as blocks that
// share a parent; null for anything else.
const chainOf = (line, axis, links, block) => {
  const S = AXES[other[axis]],
    order = [...line].sort((a, b) => a.box[S.p] - b.box[S.p]),
    units = order.map(block),
    steps = order
      .slice(1)
      .map((o, i) =>
        links.find(
          (l) => l.axis === axis && l.first === order[i] && l.second === o,
        ),
      );
  if (
    order.length < 3 ||
    steps.some((l) => !l) ||
    new Set(units).size !== units.length ||
    units.some((u) => u.parent !== units[0].parent)
  )
    return null;
  return { S, order, units, steps };
};
// Where an authored port ratio sits along the axis.
const anchor = ([o, at], A) => o.box[A.p] + at * o.box[A.s];
const gapsOf = ({ S, units }) =>
  units.slice(1).map((u, i) => u.box[S.p] - end(units[i].box, S));
// Gaps along a chain settle on their mean, which keeps the chain's extent,
// unless that would crowd the chain or a label on it.
const evenGap = (c) => {
  const gaps = gapsOf(c),
    mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length,
    { S, order, units } = c;
  const fits = c.steps.every(
    ({ label }, i) =>
      !label ||
      mean +
        (end(units[i].box, S) - end(order[i].box, S)) +
        (order[i + 1].box[S.p] - units[i + 1].box[S.p]) >=
        label[S.s] + 2 * LABEL - G.EPS,
  );
  return Math.max(...gaps) - Math.min(...gaps) > SLACK && mean >= FLOOR && fits
    ? mean
    : null;
};

// objects: {id, box, group, peer, resizable};
// edges: {id, from, to, kind, fromSide, toSide, fixed, ratios, label}.
// A straight link owns both facing sides, has no authored port ratio or bends,
// and its nodes overlap enough to read as one line. Linked nodes form lines:
// rows along y and columns along x. Fans and pins are returned per axis too.
export function straightLines(objects, edges) {
  const items = new Map(objects.map((o) => [o.id, o]));
  const used = new Map();
  for (const e of edges)
    for (const key of [`${e.from}\0${e.fromSide}`, `${e.to}\0${e.toSide}`])
      used.set(key, (used.get(key) || 0) + 1);
  // Nodes of a relation between facing sides, which a straight line can join.
  const facing = (e) => {
    const a = items.get(e.from),
      b = items.get(e.to);
    return a &&
      b &&
      !a.group &&
      !b.group &&
      e.from !== e.to &&
      [undefined, "orthogonal", "straight"].includes(e.kind) &&
      opposite[e.fromSide] === e.toSide
      ? [a, b]
      : null;
  };
  const links = [];
  for (const e of edges) {
    const [a, b] = facing(e) || [];
    if (
      !a ||
      e.fixed ||
      used.get(`${e.from}\0${e.fromSide}`) !== 1 ||
      used.get(`${e.to}\0${e.toSide}`) !== 1
    )
      continue;
    const forward = e.fromSide === "right" || e.fromSide === "bottom",
      [first, second] = forward ? [a, b] : [b, a],
      axis = e.fromSide === "left" || e.fromSide === "right" ? "y" : "x",
      A = AXES[axis],
      R = AXES[axis === "y" ? "x" : "y"];
    const overlap =
      Math.min(end(a.box, A), end(b.box, A)) - Math.max(a.box[A.p], b.box[A.p]);
    if (
      second.box[R.p] - end(first.box, R) > G.EPS &&
      overlap >= Math.min(a.box[A.s], b.box[A.s]) / 2 &&
      !staggered(a, b, A)
    )
      links.push({ edge: e.id, first, second, axis, label: e.label });
  }
  const lines = { x: [], y: [] };
  for (const axis of ["y", "x"]) {
    const root = new Map();
    const find = (o) => {
      while (root.get(o) !== o) o = root.get(o);
      return o;
    };
    for (const { first, second } of links.filter((l) => l.axis === axis)) {
      for (const o of [first, second]) if (!root.has(o)) root.set(o, o);
      root.set(find(first), find(second));
    }
    const sets = new Map();
    for (const o of root.keys())
      sets.set(find(o), [...(sets.get(find(o)) || []), o]);
    lines[axis] = [...sets.values()];
  }
  // A fan: one side of a hub carries several relations to branches whose own
  // facing sides carry nothing else, stacked across the axis with the hub near
  // their middle. A hub nearer one branch than that middle carries a main line
  // with side branches and keeps it.
  const sides = new Map();
  for (const e of edges) {
    const [a, b] = facing(e) || [];
    if (!a || e.fixed) continue;
    for (const [hub, side, branch] of [
      [a, e.fromSide, b],
      [b, e.toSide, a],
    ]) {
      const key = `${hub.id}\0${side}`;
      sides.set(key, [...(sides.get(key) || []), { hub, side, branch }]);
    }
  }
  const fans = { x: [], y: [] };
  for (const [key, list] of sides) {
    const { hub, side } = list[0],
      branches = list.map((x) => x.branch);
    if (
      list.length < 2 ||
      used.get(key) !== list.length ||
      new Set(branches).size !== branches.length ||
      branches.some((b) => used.get(`${b.id}\0${opposite[side]}`) !== 1)
    )
      continue;
    const axis = side === "left" || side === "right" ? "y" : "x",
      A = AXES[axis],
      R = AXES[axis === "y" ? "x" : "y"],
      forward = side === "right" || side === "bottom";
    if (
      branches.some(
        (b) =>
          (forward
            ? b.box[R.p] - end(hub.box, R)
            : hub.box[R.p] - end(b.box, R)) <= G.EPS,
      )
    )
      continue;
    branches.sort((p, q) => center(p.box, A) - center(q.box, A));
    const first = center(branches[0].box, A),
      last = center(branches.at(-1).box, A),
      at = center(hub.box, A),
      mid = (first + last) / 2;
    if (
      branches.some(
        (b, i) => i && end(branches[i - 1].box, A) > b.box[A.p] + G.EPS,
      ) ||
      Math.abs(at - mid) > (last - first) / 4 ||
      branches.some((b) => Math.abs(center(b.box, A) - at) < Math.abs(mid - at))
    )
      continue;
    fans[axis].push({ hub, branches });
  }
  // A pin: authored port ratios on facing sides, whose ports line up instead,
  // unless they sit apart on purpose. Pins between one pair of nodes must ask
  // for the same offset; ratios that disagree cannot all be straight.
  const pins = { x: [], y: [] },
    pairs = new Map();
  for (const e of edges) {
    const [a, b] = facing(e) || [];
    if (!a || !e.ratios) continue;
    const forward = e.fromSide === "right" || e.fromSide === "bottom",
      [first, second] = forward ? [a, b] : [b, a],
      axis = e.fromSide === "left" || e.fromSide === "right" ? "y" : "x",
      A = AXES[axis],
      R = AXES[other[axis]],
      ends = [
        [a, e.ratios[0]],
        [b, e.ratios[1]],
      ];
    if (
      second.box[R.p] - end(first.box, R) > G.EPS &&
      Math.abs(anchor(ends[0], A) - anchor(ends[1], A)) <=
        Math.min(a.box[A.s], b.box[A.s]) / 2
    ) {
      const [p, q] = a.id < b.id ? ends : [ends[1], ends[0]],
        key = `${axis}\0${p[0].id}\0${q[0].id}`;
      pairs.set(key, [
        ...(pairs.get(key) || []),
        { axis, pin: { edge: e.id, ends }, offset: anchor(p, A) - anchor(q, A) },
      ]);
    }
  }
  for (const list of pairs.values()) {
    const offsets = list.map((x) => x.offset);
    if (Math.max(...offsets) - Math.min(...offsets) <= SLACK)
      pins[list[0].axis].push(list[0].pin);
  }
  return { links, lines, fans, pins };
}

// Near misses that tidy would fix: linked nodes slightly off one center line,
// a split or merge hub off its branches' middle, same-role peers with
// different heights on a row or different widths in a column, and a chain
// whose gaps nearly agree.
export function layoutIssues(objects, edges) {
  const { links, lines, fans, pins } = straightLines(objects, edges),
    block = blocks(objects),
    issues = [];
  for (const axis of ["y", "x"])
    for (const { hub, branches } of fans[axis]) {
      const A = AXES[axis],
        offset = Math.abs(
          center(hub.box, A) -
            (center(branches[0].box, A) + center(branches.at(-1).box, A)) / 2,
        );
      if (offset > SLACK)
        issues.push(
          issue(
            "unbalanced",
            hub.id,
            `${hub.id} 偏离分支中点 ${Math.round(offset)} px`,
            {
              severity: "warning",
              relatedIds: branches.map((b) => b.id),
              evidence: {
                region: G.union([hub.box, ...branches.map((b) => b.box)]),
                axis,
                offset,
              },
            },
          ),
        );
    }
  const names = {
    y: { center: "中线", start: "顶边", end: "底边" },
    x: { center: "中线", start: "左边", end: "右边" },
  };
  for (const { edge, first, second, axis } of links) {
    const { mode, spread: offset } = nearest(
      [first.box, second.box],
      AXES[axis],
    );
    if (offset > SLACK)
      issues.push(
        issue(
          "misaligned",
          edge,
          `${first.id} 与 ${second.id} 的${names[axis][mode.name]}相差 ${Math.round(offset)} px`,
          {
            severity: "warning",
            relatedIds: [first.id, second.id],
            evidence: {
              region: G.union([first.box, second.box]),
              axis,
              alignment: mode.name,
              offset,
            },
          },
        ),
      );
  }
  for (const axis of ["y", "x"])
    for (const { edge, ends } of pins[axis]) {
      const [[a], [b]] = ends,
        offset = Math.abs(
          anchor(ends[0], AXES[axis]) - anchor(ends[1], AXES[axis]),
        );
      if (offset > SLACK)
        issues.push(
          issue(
            "misaligned",
            edge,
            `${a.id} 与 ${b.id} 的端口相差 ${Math.round(offset)} px`,
            {
              severity: "warning",
              relatedIds: [a.id, b.id],
              evidence: {
                region: G.union([a.box, b.box]),
                axis,
                alignment: "port",
                offset,
              },
            },
          ),
        );
    }
  for (const [axis, size, message] of [
    ["y", "h", "同一行的同类节点高度不同"],
    ["x", "w", "同一列的同类节点宽度不同"],
  ])
    for (const line of lines[axis]) {
      const peers = new Map();
      for (const o of line)
        if (o.peer && o.resizable)
          peers.set(o.peer, [...(peers.get(o.peer) || []), o]);
      for (const same of peers.values()) {
        const sizes = same.map((o) => o.box[size]);
        if (same.length > 1 && Math.max(...sizes) - Math.min(...sizes) > SLACK)
          issues.push(
            issue("uneven-peers", same[0].id, message, {
              severity: "warning",
              relatedIds: same.slice(1).map((o) => o.id),
              evidence: {
                region: G.union(same.map((o) => o.box)),
                [size === "h" ? "heights" : "widths"]: Object.fromEntries(
                  same.map((o) => [o.id, o.box[size]]),
                ),
              },
            }),
          );
      }
    }
  for (const [axis, message] of [
    ["y", "同一行的节点间距不同"],
    ["x", "同一列的节点间距不同"],
  ])
    for (const line of lines[axis]) {
      const c = chainOf(line, axis, links, block);
      if (c && evenGap(c) !== null)
        issues.push(
          issue("uneven-gaps", c.order[0].id, message, {
            severity: "warning",
            relatedIds: c.order.slice(1).map((o) => o.id),
            evidence: {
              region: G.union(c.order.map((o) => o.box)),
              gaps: gapsOf(c),
            },
          }),
        );
    }
  return issues;
}

// objects: {id, box, parent, group, movable, resizable, peer, pad}
// options.fixtures: visible content the runtime does not manage, {box, parent}.
// options.width: the right edge content may reach without widening the canvas.
// Returns Map id -> {dx, dy, w, h} of changes; null when tidy does not apply.
export function tidyLayout(objects, edges, options = {}) {
  if (edges.some((e) => e.kind === "sequence")) return null;
  const items = new Map(
    objects.map((o) => [
      o.id,
      { ...o, base: o.box, box: { ...o.box }, own: { x: 0, y: 0 } },
    ]),
  );
  const kids = new Map(),
    roots = [];
  for (const o of items.values())
    if (items.has(o.parent))
      kids.set(o.parent, [...(kids.get(o.parent) || []), o]);
    else roots.push(o);
  const below = (o) => (kids.get(o.id) || []).flatMap((c) => [c, ...below(c)]);
  const block = blocks([...items.values()]);
  const locked = (o) => [o, ...below(o)].some((m) => !m.movable);
  const move = (o, A, d) => {
    o.own[A.p] += d;
    for (const m of [o, ...below(o)]) m.box[A.p] += d;
  };
  const depth = (o) => (items.has(o.parent) ? 1 + depth(items.get(o.parent)) : 0);
  const frames = [...items.values()]
    .filter((o) => o.group)
    .sort((a, b) => depth(b) - depth(a));
  // Group frames grow around their content, as the runtime does.
  const grow = () => {
    for (const g of frames)
      for (const m of below(g)) {
        g.box.w = Math.max(g.box.w, G.right(m.box) - g.box.x + g.pad);
        g.box.h = Math.max(g.box.h, G.bottom(m.box) - g.box.y + g.pad);
      }
  };
  // The runtime pads frames before tidy moves anything; that is what the
  // author sees, so it bounds the canvas checks.
  grow();
  const drawn = new Map([...items.values()].map((o) => [o, { ...o.box }]));
  const {
    links,
    lines: all,
    fans,
    pins,
  } = straightLines([...items.values()], edges);
  // Near misses can add up along a chain; a drifting line stays as authored.
  const lines = {};
  for (const axis of ["y", "x"]) {
    const A = AXES[axis];
    lines[axis] = all[axis].filter(
      (line) =>
        nearest(
          line.map((o) => o.box),
          A,
        ).spread <=
        Math.max(...line.map((o) => o.box[A.s])) / 2,
    );
  }
  const peers = (line) => {
    const same = new Map();
    for (const o of line)
      if (o.peer && o.movable && o.resizable)
        same.set(o.peer, [...(same.get(o.peer) || []), o]);
    return [...same.values()].filter((list) => list.length > 1);
  };

  // Insert space at a cut: everything beyond it moves, lines move as a whole.
  // Evening may pass locked objects over as long as they end where they began.
  const shift = (A, cut, d, passing = false) => {
    const moving = new Set();
    const visit = (o) => {
      if (o.box[A.p] >= cut - G.EPS) moving.add(block(o));
      else for (const c of kids.get(o.id) || []) visit(c);
    };
    roots.forEach(visit);
    const covered = (o) => {
      for (let p = o; p; p = items.get(p.parent)) if (moving.has(p)) return true;
      return false;
    };
    const rigid = [
      ...lines[A.p],
      ...pins[A.p].map(({ ends }) => ends.map(([o]) => o)),
    ];
    for (let changed = true; changed; ) {
      changed = false;
      for (const line of rigid)
        if (line.some(covered) && !line.every(covered)) {
          for (const o of line) if (!covered(o)) moving.add(block(o));
          changed = true;
        }
    }
    if (!passing && [...moving].some(locked)) return false;
    for (const o of moving) move(o, A, d);
    grow();
    return true;
  };
  // Restore the room between stacked siblings: each keeps its nearest authored
  // clearance (at least FLOOR when something moved closer), and straight links
  // keep room for their labels.
  const settle = (A) => {
    const pairs = [];
    for (const group of [roots, ...kids.values()])
      for (const u of group)
        for (const l of group)
          if (
            u !== l &&
            end(u.base, A) <= l.base[A.p] + G.EPS &&
            crosses(u.base, l.base, A)
          )
            pairs.push({ u, l, gap: l.base[A.p] - end(u.base, A) });
    const clearance = new Map();
    for (const { l, gap } of pairs)
      clearance.set(l, Math.min(clearance.get(l) ?? Infinity, gap));
    for (const pair of pairs)
      pair.need = Math.min(pair.gap, Math.max(clearance.get(pair.l), FLOOR));
    for (const { first, second, axis, label } of links)
      if (label && axis !== A.p) {
        // Across groups, the room is kept between the containing siblings.
        let u = first,
          l = second;
        const inside = (o, p) => {
          for (let q = o; q; q = items.get(q.parent)) if (q === p) return true;
          return false;
        };
        while (items.has(u.parent) && !inside(l, items.get(u.parent)))
          u = items.get(u.parent);
        while (l.parent !== u.parent && items.has(l.parent))
          l = items.get(l.parent);
        const pair = pairs.find((p) => p.u === u && p.l === l);
        if (pair)
          pair.need = Math.max(
            pair.need,
            label[A.s] +
              2 * LABEL -
              (end(u.base, A) - end(first.base, A)) -
              (second.base[A.p] - l.base[A.p]),
          );
      }
    // Returns the number of insertions, or -1 when space cannot be made.
    let shifts = 0;
    for (let round = 0; round <= 4 * items.size; round++) {
      let cut = Infinity,
        deficit = 0;
      for (const { u, l, need } of pairs) {
        const d = end(u.box, A) + need - l.box[A.p];
        if (
          d > SLACK &&
          (l.box[A.p] < cut - G.EPS ||
            (Math.abs(l.box[A.p] - cut) < G.EPS && d > deficit))
        ) {
          cut = l.box[A.p];
          deficit = d;
        }
      }
      if (cut === Infinity) return shifts;
      if (!shift(A, cut, deficit)) return -1;
      shifts++;
    }
    return -1;
  };
  // Lines keep the alignment they nearly have, a fan's hub sits midway between
  // its outer branches, and pinned ports meet. Only the lagging side moves, so
  // repeated rounds settle on the nearest arrangement that satisfies them all.
  const align = (axis) => {
    const A = AXES[axis];
    let moved = false;
    // Offsets within SLACK already read as aligned.
    const push = (o, d) => {
      if (d <= SLACK) return;
      move(block(o), A, d);
      moved = true;
    };
    for (const line of lines[axis]) {
      const { mode } = nearest(
          line.map((o) => o.box),
          A,
        ),
        target = Math.max(...line.map((o) => mode.at(o.box, A)));
      if (
        line.some(
          (o) => locked(block(o)) && mode.at(o.box, A) < target - SLACK,
        )
      )
        continue;
      for (const o of line) push(o, target - mode.at(o.box, A));
    }
    for (const { hub, branches } of fans[axis]) {
      const mid =
          (center(branches[0].box, A) + center(branches.at(-1).box, A)) / 2,
        at = center(hub.box, A),
        movers = at < mid ? [hub] : branches;
      if (movers.some((o) => locked(block(o)))) continue;
      for (const o of movers) push(o, Math.abs(mid - at));
    }
    for (const { ends } of pins[axis]) {
      const target = Math.max(...ends.map((p) => anchor(p, A)));
      if (
        ends.some((p) => locked(block(p[0])) && anchor(p, A) < target - SLACK)
      )
        continue;
      for (const p of ends) push(p[0], target - anchor(p, A));
    }
    return moved;
  };
  const pass = (axis) => {
    const A = AXES[axis];
    if (axis === "y")
      for (const line of lines.y)
        for (const same of peers(line)) {
          const h = Math.max(...same.map((o) => o.box.h));
          for (const o of same) o.box.h = h;
        }
    // Constraints settle like longest paths: rounds grow with the objects.
    for (let round = 0; round < 16 + 2 * items.size; round++) {
      const moved = align(axis);
      grow();
      const shifts = settle(A);
      if (shifts < 0) return false;
      if (!moved && !shifts) return true;
    }
    return false;
  };
  const snapshot = () =>
    [...items.values()].map((o) => [o, { ...o.box }, { ...o.own }]);
  const restore = (saved) => {
    for (const [o, box, own] of saved) {
      o.box = box;
      o.own = own;
    }
  };
  // Lines, fans, pins and chains that already line up or run evenly.
  const reached = () => {
    const done = new Set();
    for (const axis of ["y", "x"]) {
      const A = AXES[axis];
      lines[axis].forEach((line, i) => {
        if (
          nearest(
            line.map((o) => o.box),
            A,
          ).spread <= SLACK
        )
          done.add(`line ${axis} ${i}`);
        const c = chainOf(line, axis, links, block),
          gaps = c && gapsOf(c);
        if (c && Math.max(...gaps) - Math.min(...gaps) <= SLACK)
          done.add(`chain ${axis} ${i}`);
      });
      fans[axis].forEach(({ hub, branches }, i) => {
        const mid =
          (center(branches[0].box, A) + center(branches.at(-1).box, A)) / 2;
        if (Math.abs(center(hub.box, A) - mid) <= SLACK)
          done.add(`fan ${axis} ${i}`);
      });
      pins[axis].forEach(({ ends }, i) => {
        if (Math.abs(anchor(ends[0], A) - anchor(ends[1], A)) <= SLACK)
          done.add(`pin ${axis} ${i}`);
      });
    }
    return done;
  };
  // A gap that closed keeps FLOOR, and a straight link keeps room for its label.
  const roomy = (A, saved) => {
    const was = new Map(saved.map(([o, box]) => [o, box]));
    const closed = (u, l, least) => {
      const gap = l.box[A.p] - end(u.box, A),
        before = was.get(l)[A.p] - end(was.get(u), A);
      return gap < before - G.EPS && gap < least - G.EPS;
    };
    for (const group of [roots, ...kids.values()])
      for (const u of group)
        for (const l of group)
          if (
            u !== l &&
            end(was.get(u), A) <= was.get(l)[A.p] + G.EPS &&
            crosses(was.get(u), was.get(l), A) &&
            closed(u, l, FLOOR)
          )
            return false;
    return !links.some(
      ({ first, second, axis, label }) =>
        label && axis !== A.p && closed(first, second, label[A.s] + 2 * LABEL),
    );
  };
  // Each chain evens out on its own and only when nothing else gives way:
  // every overlap, gap, label, alignment and even chain reached so far stays.
  // Closing gaps first keeps group frames from growing past the extent.
  const even = (axis) => {
    for (const line of lines[other[axis]]) {
      const c = chainOf(line, other[axis], links, block),
        mean = c && evenGap(c);
      if (mean === null) continue;
      const saved = snapshot(),
        before = reached(),
        gaps = gapsOf(c);
      const moves = c.units
        .slice(1)
        .map((u, i) => ({ u, d: mean - gaps[i] }))
        .sort((p, q) => p.d - q.d);
      const done =
        moves.every(
          ({ u, d }) =>
            Math.abs(d) <= G.EPS || shift(c.S, u.box[c.S.p], d, true),
        ) &&
        saved.every(
          ([o, box]) =>
            o.movable ||
            (Math.abs(o.box.x - box.x) <= G.EPS &&
              Math.abs(o.box.y - box.y) <= G.EPS),
        ) &&
        valid() &&
        roomy(c.S, saved);
      const kept = done && reached();
      if (!done || [...before].some((key) => !kept.has(key))) restore(saved);
    }
    return true;
  };
  // Same-role peers in a column share the widest width, where the space is
  // free. Each keeps the edge or center the column nearly shares. Text may
  // reflow, so the new height is measured.
  const widen = () => {
    const left = Math.min(...[...items.values()].map((o) => o.base.x));
    for (const line of lines.x)
      for (const same of peers(line)) {
        const w = Math.max(...same.map((o) => o.box.w)),
          keep = nearest(
            same.map((o) => o.box),
            AXES.x,
          ).mode.name;
        for (const o of same) {
          if (o.box.w >= w - G.EPS) continue;
          const box = {
            x:
              keep === "start"
                ? o.box.x
                : keep === "end"
                  ? G.right(o.box) - w
                  : center(o.box, AXES.x) - w / 2,
            y: o.box.y,
            w,
            h: options.measure ? options.measure(o.id, w) : o.box.h,
          };
          const parent = items.get(o.parent),
            room = { ...box, x: box.x - LABEL, w: box.w + 2 * LABEL };
          const ancestor = (q) => {
            for (let p = parent; p; p = items.get(p.parent)) if (p === q) return true;
            return false;
          };
          if (
            box.x < left - G.EPS ||
            (parent &&
              (box.x < parent.box.x - G.EPS ||
                G.right(box) > G.right(parent.box) + G.EPS)) ||
            [...items.values()].some(
              (q) =>
                q !== o &&
                !ancestor(q) &&
                !G.overlaps(o.box, q.box) &&
                G.overlaps(room, q.box),
            )
          )
            continue;
          o.own.x += box.x - o.box.x;
          o.box = box;
        }
      }
    return true;
  };
  const total = (o) => {
    const t = { x: 0, y: 0 };
    for (let p = o; p; p = items.get(p.parent)) {
      t.x += p.own.x;
      t.y += p.own.y;
    }
    return t;
  };
  const valid = () => {
    // Tidy never creates an overlap the drawn layout lacks, and a fixed canvas
    // keeps its extent.
    for (const group of [roots, ...kids.values()])
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++)
          if (
            !G.overlaps(drawn.get(group[i]), drawn.get(group[j]), 0.5) &&
            G.overlaps(group[i].box, group[j].box, 0.5)
          )
            return false;
    // Nor does it widen the canvas past what the author drew.
    if (
      Number.isFinite(options.width) &&
      [...items.values()].some(
        (o) =>
          G.right(o.box) > Math.max(options.width, G.right(drawn.get(o))) + 0.5,
      )
    )
      return false;
    if (options.fixedSize) {
      const limit = G.union([...drawn.values()]);
      if (
        [...items.values()].some(
          (o) =>
            G.right(o.box) > G.right(limit) + 0.5 ||
            G.bottom(o.box) > G.bottom(limit) + 0.5,
        )
      )
        return false;
    }
    // Unmanaged decorations stay where they are; none may stop lining up with
    // an object of its container that moved.
    for (const f of options.fixtures || []) {
      const container = items.get(f.parent),
        origin = container ? total(container) : { x: 0, y: 0 },
        scope = container ? below(container) : [...items.values()];
      for (const o of scope) {
        const t = total(o);
        if (
          (Math.abs(t.y - origin.y) > G.EPS ||
            (!o.group && Math.abs(o.box.h - o.base.h) > G.EPS)) &&
          G.bottom(f.box) > Math.min(o.base.y, o.box.y) + G.EPS
        )
          return false;
        if (
          (Math.abs(t.x - origin.x) > G.EPS ||
            (!o.group && Math.abs(o.box.w - o.base.w) > G.EPS)) &&
          G.right(f.box) > Math.min(o.base.x, o.box.x) + G.EPS
        )
          return false;
      }
    }
    return true;
  };
  // Each step is kept only when it fully succeeds. Wider nodes may take room
  // that a failed later step would have restored, so they need every step.
  const attempt = (steps) => {
    for (const o of items.values()) {
      o.box = { ...o.base };
      o.own = { x: 0, y: 0 };
    }
    let complete = true;
    for (const step of steps) {
      const saved = snapshot();
      if (!step() || !valid()) {
        complete = false;
        restore(saved);
      }
    }
    return complete;
  };
  const axes = [
    () => pass("y"),
    () => pass("x"),
    () => even("y"),
    () => even("x"),
  ];
  if (!attempt([widen, ...axes])) attempt(axes);
  const result = new Map();
  for (const o of items.values()) {
    const change = {};
    if (Math.abs(o.own.x) > G.EPS) change.dx = o.own.x;
    if (Math.abs(o.own.y) > G.EPS) change.dy = o.own.y;
    if (!o.group && Math.abs(o.box.w - o.base.w) > G.EPS) change.w = o.box.w;
    if (!o.group && Math.abs(o.box.h - o.base.h) > G.EPS) change.h = o.box.h;
    if (Object.keys(change).length) result.set(o.id, change);
  }
  return result;
}
