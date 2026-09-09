import * as G from "./geometry.js";

export const quality = Object.freeze({
  corner: 12,
  portGap: 12,
  minPortGap: 6,
  clearance: 4,
  run: 24,
  stub: 14,
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

// One complete pass over effective endpoints, never a second topology or saved layout.
export function distributePorts(entries, boxes) {
  const groups = new Map(),
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
      list.push({
        id,
        edge: edge.id,
        endpoint,
        rect,
        side: p.side,
        vertical,
        fixed:
          fixed ||
          ![undefined, "orthogonal"].includes(edge.kind) ||
          edge.from === edge.to ||
          !!spec.points?.length,
        at: p.at ?? 0.5,
        coordinate: vertical
          ? counterpart.y + counterpart.h / 2
          : counterpart.x + counterpart.w / 2,
      });
      groups.set(key, list);
    }
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const autos = list
      .filter((p) => !p.fixed)
      .sort(
        (a, b) =>
          a.coordinate - b.coordinate ||
          a.edge.localeCompare(b.edge) ||
          a.endpoint.localeCompare(b.endpoint),
      );
    if (!autos.length) continue;
    const extent = list[0].vertical ? list[0].rect.h : list[0].rect.w;
    const lo = Math.min(quality.corner, extent / 2),
      hi = Math.max(lo, extent - quality.corner);
    const fixed = list.filter((p) => p.fixed).map((p) => p.at * extent);
    const place = (gap) => {
      // Feasible slots in each free interval. Choose consecutive slots closest to the center.
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
      if (candidates.length < autos.length) return null;
      let best = null,
        score = Infinity;
      for (let i = 0; i <= candidates.length - autos.length; i++) {
        const slots = candidates.slice(i, i + autos.length);
        const s = Math.abs((slots[0] + slots.at(-1)) / 2 - extent / 2);
        if (s < score) {
          score = s;
          best = slots;
        }
      }
      return best;
    };
    const slots = place(quality.portGap) || place(quality.minPortGap);
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
    autos.forEach((p, i) => {
      const value = ports.get(p.edge) || {};
      value[p.endpoint] = {
        side: p.side,
        at: extent ? slots[i] / extent : 0.5,
      };
      ports.set(p.edge, value);
    });
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
