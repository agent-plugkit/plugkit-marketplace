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
const cost = (ps) =>
  ps.slice(1).reduce((n, p, i) => n + distance(ps[i], p), 0) +
  (ps.length - 2) * 16;

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

export function orthogonal(start, end, obstacles, hints = []) {
  const clear = (ps) => !obstacles.some((r) => pathHits(ps, r));
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
    .sort((a, b) => cost(a) - cost(b));
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
  const heap = new Heap(),
    best = new Map([[first, 0]]),
    prev = new Map();
  heap.push({ k: first, g: 0, score: 0 });
  while (heap.items.length) {
    const cur = heap.pop();
    if (cur.g !== best.get(cur.k)) continue;
    if (cur.k === last) break;
    const x = cur.k % nx,
      y = Math.floor(cur.k / nx),
      a = point(cur.k);
    for (const [cx, cy] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (cx < 0 || cx >= nx || cy < 0 || cy >= yy.length) continue;
      const k = key(cx, cy),
        b = point(k);
      if (obstacles.some((r) => segmentHits(a, b, r))) continue;
      const g = cur.g + distance(a, b);
      if (g >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g);
      prev.set(k, cur.k);
      heap.push({
        k,
        g,
        score: g + Math.abs(b.x - end.x) + Math.abs(b.y - end.y),
      });
    }
  }
  if (!best.has(last))
    return { points: [start, { x: end.x, y: start.y }, end], blocked: true };
  const path = [];
  for (let k = last; k !== undefined; k = prev.get(k)) path.push(point(k));
  return { points: simplify(path.reverse()), blocked: false };
}

export function route(from, to, spec, obstacles) {
  const fp = spec.fromPort || { side: "right" },
    tp = spec.toPort || { side: "left" };
  const a = port(from, fp),
    b = port(to, tp);
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
  const middle = orthogonal(s, e, all, spec.points || []);
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
