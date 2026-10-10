// Geometry uses unscaled canvas CSS pixels. No content or theme policy lives here.
export const EPS = 0.01;
export const right = (r) => r.x + r.w;
export const bottom = (r) => r.y + r.h;
export const expand = (r, p) => ({
  x: r.x - p,
  y: r.y - p,
  w: r.w + 2 * p,
  h: r.h + 2 * p,
});
export const overlaps = (a, b, padding = EPS) =>
  a.x < right(b) - padding &&
  right(a) > b.x + padding &&
  a.y < bottom(b) - padding &&
  bottom(a) > b.y + padding;
export const inside = (p, r) =>
  p.x > r.x + EPS &&
  p.x < right(r) - EPS &&
  p.y > r.y + EPS &&
  p.y < bottom(r) - EPS;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const union = (rs) =>
  rs.length
    ? {
        x: Math.min(...rs.map((r) => r.x)),
        y: Math.min(...rs.map((r) => r.y)),
        w: Math.max(...rs.map(right)) - Math.min(...rs.map((r) => r.x)),
        h: Math.max(...rs.map(bottom)) - Math.min(...rs.map((r) => r.y)),
      }
    : { x: 0, y: 0, w: 0, h: 0 };

export function port(r, spec = {}) {
  const side = spec.side || "right",
    at = Math.max(0, Math.min(1, spec.at ?? 0.5));
  if (side === "left") return { x: r.x, y: r.y + r.h * at };
  if (side === "top") return { x: r.x + r.w * at, y: r.y };
  if (side === "bottom") return { x: r.x + r.w * at, y: bottom(r) };
  return { x: right(r), y: r.y + r.h * at };
}
export function stub(p, side, length = 14) {
  return {
    x: p.x + (side === "right" ? length : side === "left" ? -length : 0),
    y: p.y + (side === "bottom" ? length : side === "top" ? -length : 0),
  };
}
export function segmentHits(a, b, r) {
  // Liang–Barsky against the open rectangle: touching an obstacle border is OK.
  const q = expand(r, -EPS),
    dx = b.x - a.x,
    dy = b.y - a.y;
  let lo = 0,
    hi = 1;
  for (const [p, v] of [
    [-dx, a.x - q.x],
    [dx, right(q) - a.x],
    [-dy, a.y - q.y],
    [dy, bottom(q) - a.y],
  ]) {
    if (Math.abs(p) < EPS) {
      if (v < 0) return false;
      continue;
    }
    const t = v / p;
    if (p < 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (lo > hi) return false;
  }
  return true;
}
export const pathHits = (points, r) =>
  points.slice(1).some((p, i) => segmentHits(points[i], p, r));
export function pathBacktracks(points, tolerance = 1) {
  return points.slice(2).some((p, i) => {
    const a = points[i], b = points[i + 1];
    const ux = b.x - a.x, uy = b.y - a.y,
      vx = p.x - b.x, vy = p.y - b.y;
    return Math.abs(ux * vy - uy * vx) < EPS &&
      ux * vx + uy * vy < 0 &&
      Math.min(Math.hypot(ux, uy), Math.hypot(vx, vy)) > tolerance;
  });
}
export function simplify(points, preserveReversals = true) {
  const out = [];
  for (const p of points) {
    if (out.length && distance(out.at(-1), p) < EPS) continue;
    while (out.length > 1) {
      const a = out.at(-2),
        b = out.at(-1);
      if (
        Math.abs((b.x - a.x) * (p.y - b.y) - (b.y - a.y) * (p.x - b.x)) > EPS ||
        (preserveReversals &&
          (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) < -EPS)
      )
        break;
      out.pop();
    }
    out.push(p);
  }
  return out;
}
export const pathData = (ps) =>
  ps.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
const BEND = 16;
const cost = (ps) =>
  ps.slice(1).reduce((n, p, i) => n + distance(ps[i], p), 0) +
  (ps.length - 2) * BEND;
// 0: +x, 1: -x, 2: +y, 3: -y; -1 when the points coincide.
const heading = (a, b) =>
  distance(a, b) < EPS
    ? -1
    : Math.abs(b.x - a.x) > Math.abs(b.y - a.y)
      ? b.x > a.x
        ? 0
        : 1
      : b.y > a.y
        ? 2
        : 3;

class Heap {
  items = [];
  push(v) {
    const a = this.items;
    a.push(v);
    let i = a.length - 1;
    while (i) {
      let p = (i - 1) >> 1;
      if (a[p].score <= v.score) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = v;
  }
  pop() {
    const a = this.items,
      first = a[0],
      last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].score < a[c].score) c++;
        if (a[c].score >= last.score) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = last;
    }
    return first;
  }
}

export function orthogonal(start, end, obstacles, hints = [], ports = {}) {
  const clear = (ps) => !obstacles.some((r) => pathHits(ps, r));
  // Optional port points before start and after end: corners where the path
  // meets the port stubs count like any other corner.
  const full = (ps) =>
    simplify(
      [
        ...(ports.from ? [ports.from] : []),
        ...ps,
        ...(ports.to ? [ports.to] : []),
      ],
      false,
    );
  if (hints.length) {
    // Preserve every user pin, adding axis-aligned joins when a bound endpoint moves.
    const ps = [start];
    for (const target of [...hints, end]) {
      const a = ps.at(-1);
      if (Math.abs(a.x - target.x) > EPS && Math.abs(a.y - target.y) > EPS) {
        const choices = [
          { x: a.x, y: target.y },
          { x: target.x, y: a.y },
        ];
        ps.push(choices.find((p) => clear([a, p, target])) || choices[0]);
      }
      ps.push(target);
    }
    return { points: ps, blocked: !clear(ps) };
  }
  const xs = [start.x, end.x, (start.x + end.x) / 2],
    ys = [start.y, end.y, (start.y + end.y) / 2];
  const candidates = [
    [start, { x: start.x, y: end.y }, end],
    [start, { x: end.x, y: start.y }, end],
  ];
  for (const x of xs)
    candidates.push([start, { x, y: start.y }, { x, y: end.y }, end]);
  for (const y of ys)
    candidates.push([start, { x: start.x, y }, { x: end.x, y }, end]);
  const simple = candidates
    .map(simplify)
    .filter(clear)
    .sort((a, b) => cost(full(a)) - cost(full(b)));
  if (simple.length) return { points: simple[0], blocked: false };
  // Visibility grid from measured obstacle boundaries; only neighboring grid points connect.
  for (const r of obstacles) {
    xs.push(r.x - 1, right(r) + 1);
    ys.push(r.y - 1, bottom(r) + 1);
  }
  xs.push(Math.min(...xs) - 24, Math.max(...xs) + 24);
  ys.push(Math.min(...ys) - 24, Math.max(...ys) + 24);
  const xx = [...new Set(xs)].sort((a, b) => a - b),
    yy = [...new Set(ys)].sort((a, b) => a - b),
    nx = xx.length;
  const key = (x, y) => y * nx + x,
    point = (k) => ({ x: xx[k % nx], y: yy[Math.floor(k / nx)] });
  const first = key(xx.indexOf(start.x), yy.indexOf(start.y)),
    last = key(xx.indexOf(end.x), yy.indexOf(end.y));
  // States carry the travel direction, so equal-length staircases lose to
  // paths with fewer corners. The goal is a separate state reached after the
  // turn into the end stub has been charged.
  const steps = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ],
    goal = -1,
    enter = ports.from ? heading(ports.from, start) : -1,
    leave = ports.to ? heading(end, ports.to) : -1;
  const heap = new Heap(),
    best = new Map(),
    prev = new Map(),
    blocked = new Map();
  const push = (s, g, from, score) => {
    if (g >= (best.get(s) ?? Infinity)) return;
    best.set(s, g);
    prev.set(s, from);
    heap.push({ s, g, score });
  };
  const estimate = (p) => Math.abs(p.x - end.x) + Math.abs(p.y - end.y);
  for (const d of enter < 0 ? [0, 1, 2, 3] : [enter])
    push(first * 4 + d, 0, undefined, estimate(start));
  while (heap.items.length) {
    const cur = heap.pop();
    if (cur.g !== best.get(cur.s)) continue;
    if (cur.s === goal) break;
    const k = Math.floor(cur.s / 4),
      d = cur.s % 4,
      a = point(k);
    if (k === last) {
      const g = cur.g + (leave >= 0 && leave !== d ? BEND : 0);
      push(goal, g, cur.s, g);
      continue;
    }
    const x = k % nx,
      y = Math.floor(k / nx);
    steps.forEach(([dx, dy], next) => {
      const cx = x + dx,
        cy = y + dy;
      if (cx < 0 || cx >= nx || cy < 0 || cy >= yy.length) return;
      const n = key(cx, cy),
        b = point(n);
      if (!blocked.has(k * 4 + next))
        blocked.set(
          k * 4 + next,
          obstacles.some((r) => segmentHits(a, b, r)),
        );
      if (blocked.get(k * 4 + next)) return;
      const g = cur.g + distance(a, b) + (next === d ? 0 : BEND);
      push(n * 4 + next, g, cur.s, g + estimate(b));
    });
  }
  if (!best.has(goal))
    return { points: [start, { x: end.x, y: start.y }, end], blocked: true };
  const path = [];
  for (let s = prev.get(goal); s !== undefined; s = prev.get(s))
    path.push(point(Math.floor(s / 4)));
  return { points: simplify(path.reverse()), blocked: false };
}

export function route(from, to, spec, obstacles) {
  const fp = spec.fromPort || { side: "right" },
    tp = spec.toPort || { side: "left" };
  let a = port(from, fp),
    b = port(to, tp);
  // Facing ports within a pixel of each other draw straight, so sub-pixel
  // layout rounding never leaves a hairline step. Ends stay on their sides.
  const c = { left: "y", right: "y", top: "x", bottom: "x" }[fp.side],
    size = c === "y" ? "h" : "w",
    on = (r, v) => v >= r[c] - EPS && v <= r[c] + r[size] + EPS;
  if (
    fp.side !== tp.side &&
    c === { left: "y", right: "y", top: "x", bottom: "x" }[tp.side] &&
    Math.abs(a[c] - b[c]) <= 1
  ) {
    if (on(to, a[c])) b = { ...b, [c]: a[c] };
    else if (on(from, b[c])) a = { ...a, [c]: b[c] };
  }
  if (spec.kind === "straight")
    return {
      points: [a, b],
      blocked: obstacles.some((r) => pathHits([a, b], r)),
    };
  const gap = Math.max(
    to.x - right(from),
    from.x - right(to),
    to.y - bottom(from),
    from.y - bottom(to),
    0,
  );
  const length = gap > 0 ? Math.min(14, gap / 2) : 14,
    clearance = gap > 0 ? Math.min(6, gap / 4) : 6;
  const s = stub(a, fp.side, length),
    e = stub(b, tp.side, length);
  const all = [...obstacles, expand(from, clearance), expand(to, clearance)];
  const middle = orthogonal(s, e, all, spec.points || [], { from: a, to: b });
  return {
    // Port stubs can briefly double back into the automatic path. Remove that
    // redundant travel, while keeping an author's explicit pins intact.
    points: simplify([a, ...middle.points, b], !!spec.points?.length),
    blocked: middle.blocked,
  };
}

export function labelPosition(points, size, obstacles, preferred) {
  const candidates = [];
  if (preferred) candidates.push({ x: preferred.x, y: preferred.y });
  const segments = points
    .slice(1)
    .map((p, i) => ({ a: points[i], b: p, length: distance(points[i], p) }))
    .sort((a, b) => b.length - a.length);
  for (const { a, b } of segments)
    for (const t of [0.5, 0.25, 0.75]) {
      const cx = a.x + (b.x - a.x) * t,
        cy = a.y + (b.y - a.y) * t;
      if (Math.abs(b.y - a.y) < EPS)
        for (const d of [-1, 1])
          candidates.push({
            x: cx - size.w / 2,
            y: d < 0 ? cy - size.h - 8 : cy + 8,
          });
      else
        for (const d of [1, -1])
          candidates.push({
            x: d < 0 ? cx - size.w - 8 : cx + 8,
            y: cy - size.h / 2,
          });
    }
  const candidate = candidates.find(
    (p) => !obstacles.some((r) => overlaps({ ...p, ...size }, r)),
  );
  return {
    ...(candidate || candidates[0] || { x: 0, y: 0 }),
    blocked: !candidate,
  };
}
