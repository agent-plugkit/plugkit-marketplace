import * as G from "./geometry.js";

export const quality = Object.freeze({
  corner: 12,
  portGap: 12,
  minPortGap: 6,
  clearance: 4,
  run: 24,
  stub: 14,
  straightInset: 20,
});
const fixes = {
  bounds: ["move-node", "move-label", "edit-bends", "grow-canvas"],
  header: ["move-body", "move-label", "edit-bends"],
  overflow: ["resize-node"],
  overlap: ["move-node"],
  route: ["move-node", "edit-ports", "edit-bends"],
  backtrack: ["edit-bends", "reset-route"],
  crossing: ["move-node", "edit-bends"],
  label: ["move-label", "move-node"],
  "label-line": ["move-label", "edit-bends"],
  sequence: ["move-row"],
  "shared-route": ["edit-ports", "edit-bends"],
  "border-run": ["edit-bends", "move-node"],
  "label-clearance": ["move-label", "edit-bends"],
  "port-crowding": ["resize-node", "edit-ports"],
  misaligned: ["move-node"],
  unbalanced: ["move-node"],
  "uneven-peers": ["resize-node"],
  "uneven-gaps": ["move-node"],
};
export function issue(
  type,
  id,
  message,
  {
    severity = "error",
    relatedIds = [],
    evidence = {},
    supportedFixes = fixes[type] || [],
  } = {},
) {
  return {
    type,
    id,
    message,
    code: `geometry/${type}`,
    severity,
    relatedIds: [...new Set(relatedIds)].sort(),
    evidence,
    supportedFixes,
  };
}
export function orderedIssues(items) {
  const key = (v) =>
    JSON.stringify([v.code, v.id, v.relatedIds, v.message, v.evidence]);
  const unique = new Map(items.map((v) => [key(v), v]));
  return [...unique.values()].sort(
    (a, b) =>
      (a.severity === "error" ? 0 : 1) - (b.severity === "error" ? 0 : 1) ||
      key(a).localeCompare(key(b)),
  );
}

const opposite = { right: "left", left: "right", bottom: "top", top: "bottom" };
const order = (a, b) =>
  a.coordinate - b.coordinate ||
  a.edge.localeCompare(b.edge) ||
  a.endpoint.localeCompare(b.endpoint);
// Feasible slots in each free interval of [lo, hi]. Choose consecutive slots closest to the target.
function place(count, lo, hi, fixed, gap, target) {
  const occupied = [...fixed].sort((a, b) => a - b),
    candidates = [];
  const boundaries = [lo - gap, ...occupied, hi + gap];
  for (let i = 1; i < boundaries.length; i++) {
    const start = Math.max(lo, boundaries[i - 1] + gap),
      end = Math.min(hi, boundaries[i] - gap);
    if (end < start) continue;
    const count = Math.floor((end - start + G.EPS) / gap) + 1;
    const offset = (start + end - (count - 1) * gap) / 2;
    for (let j = 0; j < count; j++) candidates.push(offset + j * gap);
  }
  if (candidates.length < count) return null;
  let best = null,
    score = Infinity;
  for (let i = 0; i <= candidates.length - count; i++) {
    const slots = candidates.slice(i, i + count);
    const s = Math.abs((slots[0] + slots.at(-1)) / 2 - target);
    if (s < score) {
      score = s;
      best = slots;
    }
  }
  return best;
}
// Facing endpoints share one coordinate when their nodes overlap enough, so the
// relation is drawn straight. Straight lines stay clear of the nodes' corners
// and of other nodes; endpoints on a side keep their order and spacing.
function align(entries, groups, records, obstacles) {
  const gap = quality.portGap,
    units = new Map();
  const inset = (p) =>
    Math.min(
      p.extent / 2,
      Math.max(quality.corner, Math.min(p.extent / 5, quality.straightInset)),
    );
  const at = (p) => p.start + p.at * p.extent;
  for (const { edge, spec } of entries) {
    const from = records.get(`${edge.id}\0fromPort`),
      to = records.get(`${edge.id}\0toPort`);
    if (
      !from ||
      !to ||
      opposite[from.side] !== to.side ||
      ![undefined, "orthogonal"].includes(edge.kind) ||
      edge.from === edge.to ||
      spec.points?.length ||
      (from.fixed && to.fixed) ||
      !(from.extent > 0 && to.extent > 0)
    )
      continue;
    const F = from.rect,
      T = to.rect;
    const corridor = {
      right: [G.right(F), T.x],
      left: [G.right(T), F.x],
      bottom: [G.bottom(F), T.y],
      top: [G.bottom(T), F.y],
    }[from.side];
    if (!(corridor[1] - corridor[0] > G.EPS)) continue;
    let lo, hi, target, key;
    if (from.fixed || to.fixed) {
      // An author-fixed end keeps its position; the automatic end follows it.
      const fixed = from.fixed ? from : to,
        free = from.fixed ? to : from;
      target = lo = hi = at(fixed);
      if (
        target < free.start + inset(free) - G.EPS ||
        target > free.start + free.extent - inset(free) + G.EPS
      )
        continue;
      key = edge.id;
    } else {
      const overlap = [
        Math.max(from.start, to.start),
        Math.min(from.start + from.extent, to.start + to.extent),
      ];
      lo = Math.max(from.start + inset(from), to.start + inset(to));
      hi = Math.min(
        from.start + from.extent - inset(from),
        to.start + to.extent - inset(to),
      );
      target = Math.min(hi, Math.max(lo, (overlap[0] + overlap[1]) / 2));
      // Relations between the same two sides form one bundle of parallel lines.
      key = [from.key, to.key].sort().join("\0\0");
    }
    if (hi < lo - G.EPS) continue;
    hi = Math.max(lo, hi);
    const unit = units.get(key) || {
      members: [],
      lo,
      hi,
      target,
      corridor,
      from,
      to,
      cost:
        Math.abs(target - from.start - from.extent / 2) +
        Math.abs(target - to.start - to.extent / 2),
    };
    unit.members.push([from, to].filter((p) => !p.fixed));
    units.set(key, unit);
  }
  // Well-centered relations go first; later ones may continue their lines through a node.
  const sorted = [...units.values()]
    .map((u) => ({
      ...u,
      members: u.members.sort((a, b) => a[0].edge.localeCompare(b[0].edge)),
    }))
    .sort(
      (a, b) =>
        a.cost - b.cost ||
        a.members[0][0].edge.localeCompare(b.members[0][0].edge),
    );
  for (const unit of sorted) {
    const half = ((unit.members.length - 1) * gap) / 2,
      mine = unit.members.flat();
    if (unit.hi - unit.lo < 2 * half - G.EPS) continue;
    let free = [[unit.lo + half, Math.max(unit.lo + half, unit.hi - half)]];
    // Remove an open interval; touching its ends remains allowed.
    const cut = (a, b) => {
      free = free.flatMap(([u, v]) =>
        b <= u || a >= v
          ? [[u, v]]
          : [...(a >= u ? [[u, a]] : []), ...(b <= v ? [[b, v]] : [])],
      );
    };
    for (const key of new Set(mine.map((p) => p.key))) {
      const list = groups.get(key),
        own = mine.filter((p) => p.key === key).sort(order);
      const aligned = list
          .filter((p) => p.aligned !== undefined)
          .sort(order),
        waiting = list.filter(
          (p) => !p.fixed && p.aligned === undefined && !own.includes(p),
        );
      const prev = aligned.filter((p) => order(p, own[0]) < 0).at(-1),
        next = aligned.find((p) => order(p, own.at(-1)) > 0);
      if (
        aligned.some(
          (p) => order(p, own[0]) > 0 && order(p, own.at(-1)) < 0,
        ) ||
        waiting.some((p) => order(p, own[0]) > 0 && order(p, own.at(-1)) < 0)
      ) {
        free = [];
        break;
      }
      // Leave room for the automatic endpoints that will be spread on either side.
      const before = waiting.filter(
          (p) => (!prev || order(prev, p) < 0) && order(p, own[0]) < 0,
        ).length,
        after = waiting.filter(
          (p) => order(p, own.at(-1)) > 0 && (!next || order(p, next) < 0),
        ).length;
      const p = own[0],
        lo = Math.min(quality.corner, p.extent / 2),
        hi = Math.max(lo, p.extent - quality.corner);
      cut(
        -Infinity,
        (prev ? prev.aligned + gap : p.start + lo) + before * gap + half,
      );
      cut(
        (next ? next.aligned - gap : p.start + hi) - after * gap - half,
        Infinity,
      );
      for (const q of list)
        if (!own.includes(q) && (q.fixed || q.aligned !== undefined)) {
          const position = q.fixed ? at(q) : q.aligned;
          cut(position - gap - half, position + gap + half);
        }
    }
    const { from, to, corridor } = unit,
      across = from.vertical ? ["y", "h"] : ["x", "w"],
      along = from.vertical ? ["x", "w"] : ["y", "h"];
    for (const r of obstacles)
      if (
        r.id !== from.id &&
        r.id !== to.id &&
        r[along[0]] < corridor[1] - G.EPS &&
        r[along[0]] + r[along[1]] > corridor[0] + G.EPS
      )
        cut(r[across[0]] - half, r[across[0]] + r[across[1]] + half);
    if (!free.length) continue;
    const closest = (v) =>
      free
        .map(([u, w]) => Math.min(w, Math.max(u, v)))
        .reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) - G.EPS ? b : a));
    // Continue a straight line that already passes through either node.
    const rails =
      unit.members.length === 1 && !unit.from.fixed && !unit.to.fixed
        ? [
            ...(groups.get(`${from.id}\0${opposite[from.side]}`) || []),
            ...(groups.get(`${to.id}\0${opposite[to.side]}`) || []),
          ]
            .filter((p) => p.aligned !== undefined)
            .map((p) => p.aligned)
            .filter((v) => Math.abs(closest(v) - v) < G.EPS)
            .sort(
              (a, b) =>
                Math.abs(a - unit.target) - Math.abs(b - unit.target) || a - b,
            )
        : [];
    const center = rails.length ? rails[0] : closest(unit.target);
    unit.members.forEach((member, i) => {
      for (const p of member) p.aligned = center - half + i * gap;
    });
  }
}

// One complete pass over effective endpoints, never a second topology or saved layout.
export function distributePorts(entries, boxes, obstacles = []) {
  const groups = new Map(),
    records = new Map(),
    ports = new Map(),
    issues = [];
  for (const { edge, spec, fixedFrom, fixedTo } of entries) {
    if (edge.kind === "sequence") continue;
    for (const [endpoint, id, other, fixed] of [
      ["fromPort", edge.from, edge.to, fixedFrom],
      ["toPort", edge.to, edge.from, fixedTo],
    ]) {
      const rect = boxes.get(id),
        counterpart = boxes.get(other),
        p = spec[endpoint];
      if (!rect || !counterpart || !p) continue;
      const vertical = p.side === "left" || p.side === "right";
      const key = `${id}\0${p.side}`,
        list = groups.get(key) || [];
      const record = {
        id,
        edge: edge.id,
        endpoint,
        key,
        rect,
        side: p.side,
        vertical,
        start: vertical ? rect.y : rect.x,
        extent: vertical ? rect.h : rect.w,
        fixed:
          fixed ||
          ![undefined, "orthogonal"].includes(edge.kind) ||
          edge.from === edge.to ||
          !!spec.points?.length,
        at: p.at ?? 0.5,
        coordinate: vertical
          ? counterpart.y + counterpart.h / 2
          : counterpart.x + counterpart.w / 2,
      };
      list.push(record);
      groups.set(key, list);
      records.set(`${edge.id}\0${endpoint}`, record);
    }
  }
  align(entries, groups, records, obstacles);
  const assign = (p, at) => {
    const value = ports.get(p.edge) || {};
    value[p.endpoint] = { side: p.side, at };
    ports.set(p.edge, value);
  };
  for (const list of groups.values()) {
    const { start, extent } = list[0];
    const aligned = list.filter((p) => p.aligned !== undefined).sort(order);
    for (const p of aligned) assign(p, (p.aligned - start) / extent);
    if (list.length < 2) continue;
    const autos = list
      .filter((p) => !p.fixed && p.aligned === undefined)
      .sort(order);
    if (!autos.length) continue;
    const lo = Math.min(quality.corner, extent / 2),
      hi = Math.max(lo, extent - quality.corner);
    const fixed = list.filter((p) => p.fixed).map((p) => p.at * extent),
      dividers = aligned.map((p) => p.aligned - start);
    // Endpoints between two straight lines stay between them, so lines do not cross.
    const between = (gap) => {
      const result = [];
      for (let i = 0, j = 0; i <= aligned.length; i++) {
        const run = [];
        while (
          j < autos.length &&
          (i === aligned.length || order(autos[j], aligned[i]) < 0)
        )
          run.push(autos[j++]);
        if (!run.length) continue;
        const slots = place(
          run.length,
          Math.max(lo, i ? dividers[i - 1] + gap : lo),
          Math.min(hi, i < aligned.length ? dividers[i] - gap : hi),
          fixed,
          gap,
          extent / 2,
        );
        if (!slots) return null;
        result.push(...slots);
      }
      return result;
    };
    const anywhere = (gap) =>
      place(autos.length, lo, hi, [...fixed, ...dividers], gap, extent / 2);
    const slots =
      (aligned.length &&
        (between(quality.portGap) || between(quality.minPortGap))) ||
      anywhere(quality.portGap) ||
      anywhere(quality.minPortGap);
    if (!slots) {
      issues.push(
        issue(
          "port-crowding",
          list[0].id,
          "端口空间不足，请扩大节点或手动调整端口",
          {
            severity: "warning",
            relatedIds: list.map((p) => p.edge),
            evidence: {
              region: list[0].rect,
              side: list[0].side,
              available: hi - lo,
              minimumGap: quality.minPortGap,
            },
          },
        ),
      );
      continue; // Keep the deterministic original anchors rather than overwrite fixed positions.
    }
    for (const [i, p] of autos.entries())
      assign(p, extent ? slots[i] / extent : 0.5);
  }
  return { ports, issues };
}

const near = (a, b) => Math.abs(a - b) < 0.02;
function segments(points) {
  const result = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (G.distance(a, b) < G.EPS) continue;
    const previous = result.at(-1);
    const cross =
      previous &&
      (previous.b.x - previous.a.x) * (b.y - a.y) -
        (previous.b.y - previous.a.y) * (b.x - a.x);
    const dot =
      previous &&
      (previous.b.x - previous.a.x) * (b.x - a.x) +
        (previous.b.y - previous.a.y) * (b.y - a.y);
    if (previous && Math.abs(cross) < G.EPS && dot > 0) previous.b = b;
    else result.push({ a, b });
  }
  return result;
}
function trimEnds(points, start = true, end = true) {
  const ps = points.map((p) => ({ ...p }));
  const trim = () => {
    let left = quality.stub;
    while (ps.length > 1 && left > 0) {
      const distance = G.distance(ps[0], ps[1]);
      if (distance <= left) {
        ps.shift();
        left -= distance;
      } else {
        ps[0] = {
          x: ps[0].x + ((ps[1].x - ps[0].x) * left) / distance,
          y: ps[0].y + ((ps[1].y - ps[0].y) * left) / distance,
        };
        left = 0;
      }
    }
  };
  if (start) trim();
  ps.reverse();
  if (end) trim();
  ps.reverse();
  return ps;
}
function parallelRun(a, b) {
  const dx = a.b.x - a.a.x,
    dy = a.b.y - a.a.y,
    length = Math.hypot(dx, dy);
  if (!length) return null;
  const ux = dx / length,
    uy = dy / length;
  if (Math.abs(ux * (b.b.y - b.a.y) - uy * (b.b.x - b.a.x)) > 0.02) return null;
  const project = (p) => (p.x - a.a.x) * ux + (p.y - a.a.y) * uy;
  const from = Math.max(0, Math.min(project(b.a), project(b.b))),
    to = Math.min(length, Math.max(project(b.a), project(b.b)));
  const distance = Math.abs(ux * (b.a.y - a.a.y) - uy * (b.a.x - a.a.x));
  const start = { x: a.a.x + from * ux, y: a.a.y + from * uy },
    end = { x: a.a.x + to * ux, y: a.a.y + to * uy };
  return {
    distance,
    length: Math.max(0, to - from),
    region: G.union([
      { ...start, w: 0, h: 0 },
      { ...end, w: 0, h: 0 },
    ]),
  };
}
function pointSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function clearance(segment, rect) {
  const { a, b } = segment;
  if (G.segmentHits(a, b, rect)) return 0;
  const pointRect = (p) =>
    Math.hypot(
      Math.max(rect.x - p.x, 0, p.x - G.right(rect)),
      Math.max(rect.y - p.y, 0, p.y - G.bottom(rect)),
    );
  return Math.min(
    pointRect(a),
    pointRect(b),
    ...[
      { x: rect.x, y: rect.y },
      { x: G.right(rect), y: rect.y },
      { x: rect.x, y: G.bottom(rect) },
      { x: G.right(rect), y: G.bottom(rect) },
    ].map((p) => pointSegment(p, a, b)),
  );
}
export function readability(edges, frames = [], existing = []) {
  const issues = [],
    entries = [...edges].sort(([a], [b]) => a.localeCompare(b));
  const add = (type, id, message, relatedIds, evidence) =>
    issues.push(
      issue(type, id, message, { severity: "warning", relatedIds, evidence }),
    );
  for (let i = 0; i < entries.length; i++) {
    const [id, edge] = entries[i],
      full = segments(edge.points);
    for (let j = i + 1; j < entries.length; j++) {
      const [other, next] = entries[j];
      const shared = (id, other) => id === other.from || id === other.to;
      const a = segments(
        trimEnds(edge.points, shared(edge.from, next), shared(edge.to, next)),
      );
      const b = segments(
        trimEnds(next.points, shared(next.from, edge), shared(next.to, edge)),
      );
      for (const left of a)
        for (const right of b) {
          const run = parallelRun(left, right);
          if (run && near(run.distance, 0) && run.length + G.EPS >= quality.run)
            add("shared-route", id, `与连线 ${other} 长距离重合`, [other], {
              ...run,
              minimumLength: quality.run,
            });
        }
    }
    for (const {
      id: group,
      rect,
      sides = ["top", "right", "bottom", "left"],
    } of frames) {
      const borders = {
        top: [
          { x: rect.x, y: rect.y },
          { x: G.right(rect), y: rect.y },
        ],
        bottom: [
          { x: rect.x, y: G.bottom(rect) },
          { x: G.right(rect), y: G.bottom(rect) },
        ],
        left: [
          { x: rect.x, y: rect.y },
          { x: rect.x, y: G.bottom(rect) },
        ],
        right: [
          { x: G.right(rect), y: rect.y },
          { x: G.right(rect), y: G.bottom(rect) },
        ],
      };
      for (const segment of full)
        for (const side of sides) {
          const [a, b] = borders[side],
            run = parallelRun(segment, { a, b });
          if (
            run &&
            run.distance < quality.clearance &&
            run.length + G.EPS >= quality.run
          )
            add("border-run", id, `连线贴近分组 ${group} 的边框`, [group], {
              ...run,
              side,
              minimumClearance: quality.clearance,
              minimumLength: quality.run,
            });
        }
    }
    if (!edge.label) continue;
    for (const [other, next] of entries) {
      if (
        other === id ||
        existing.some(
          (v) =>
            v.type === "label-line" &&
            v.id === id &&
            v.relatedIds.includes(other),
        )
      )
        continue;
      const distance = Math.min(
        ...segments(next.points).map((s) => clearance(s, edge.label)),
      );
      if (distance < quality.clearance)
        add("label-clearance", id, `标签过于接近连线 ${other}`, [other], {
          region: edge.label,
          distance,
          minimumClearance: quality.clearance,
        });
    }
  }
  return orderedIssues(issues);
}
