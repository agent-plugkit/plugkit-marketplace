import * as G from "./geometry.js";
import {
  issue,
  orderedIssues,
  distributePorts,
  readability,
} from "./quality.js";
import { mountEditor } from "./editor.js";
import { toBlob } from "html-to-image";

const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const number = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const escJSON = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

export class Diagram {
  get state() {
    return this._state;
  }
  set state(value) {
    // Stable IDs may be JavaScript property names such as "constructor".
    this._state = value;
    value.nodes = Object.assign(Object.create(null), value.nodes);
    value.edges = Object.assign(Object.create(null), value.edges);
  }
  constructor(root, config, state = {}) {
    this.root = root;
    this.config = config;
    this.template = document.documentElement.cloneNode(true);
    this.state = {
      version: 1,
      nodes: {},
      edges: {},
      bodyOffset: 0,
      ...clone(state),
    };
    this.nodes = new Map();
    this.labels = new Map();
    this.edgeGeometry = new Map();
    this.computedPorts = new Map();
    this.history = [];
    this.future = [];
    this.listeners = new Set();
    this.body = root.querySelector('[data-diagram-region="body"]');
    this.header = root.querySelector('[data-diagram-region="header"]');
    this.footer = root.querySelector('[data-diagram-region="footer"]');
    this.ready = this.init();
  }
  box(el) {
    const r = el.getBoundingClientRect(),
      c = this.root.getBoundingClientRect(),
      s = this.scale();
    // Browsers expose tiny scale-dependent float differences. Quantize below a CSS
    // layout unit so label candidate choices are stable across zoom and reopening.
    const px = (value) => Math.round((value + 0.000001) * 64) / 64;
    return {
      x: px((r.left - c.left) / s.x),
      y: px((r.top - c.top) / s.y),
      w: px(r.width / s.x),
      h: px(r.height / s.y),
    };
  }
  scale() {
    const c = this.root.getBoundingClientRect();
    return {
      x: c.width / this.root.offsetWidth || 1,
      y: c.height / this.root.offsetHeight || 1,
    };
  }
  point(clientX, clientY) {
    const r = this.root.getBoundingClientRect(),
      s = this.scale();
    return { x: (clientX - r.left) / s.x, y: (clientY - r.top) / s.y };
  }
  async init() {
    if (!this.body) throw Error('缺少主体区域 data-diagram-region="body"');
    if (this.config.version !== 1 || this.state.version !== 1)
      throw Error("不支持此图解协议版本");
    if (![undefined, "center", "spread"].includes(this.config.portDistribution))
      throw Error("portDistribution 只支持 center 或 spread");
    await document.fonts.ready;
    await Promise.all(
      [...this.root.querySelectorAll("img")].map((i) =>
        i.decode().catch(() => {}),
      ),
    );
    this.root.style.position = "relative";
    this.originalSize = { w: this.root.offsetWidth, h: this.root.offsetHeight };
    this.originalBody = this.box(this.body);
    this.originalFooter = this.footer ? this.box(this.footer) : null;
    const elements = [
      ...this.root.querySelectorAll(
        "[data-diagram-node],[data-diagram-group],[data-diagram-row]",
      ),
    ];
    for (const el of elements) {
      const id =
        el.dataset.diagramNode ||
        el.dataset.diagramGroup ||
        el.dataset.diagramRow;
      if (this.nodes.has(id)) throw Error(`重复对象标识：${id}`);
      const parent = el.parentElement.closest("[data-diagram-group]")?.dataset
        .diagramGroup;
      const isSVG = el instanceof SVGElement,
        b = this.box(el);
      const n = {
        id,
        el,
        parent,
        group: el.hasAttribute("data-diagram-group"),
        row: el.hasAttribute("data-diagram-row"),
        actor: el.hasAttribute("data-diagram-actor"),
        locked: el.hasAttribute("data-diagram-locked"),
        isSVG,
        base: b,
      };
      this.nodes.set(id, n);
    }
    for (const edge of this.config.edges) {
      if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to))
        throw Error(`连线 ${edge.id} 的端点不存在`);
      if (edge.kind === "sequence" && !this.nodes.get(edge.row)?.row)
        throw Error(`消息 ${edge.id} 缺少时序行`);
    }
    for (const el of this.root.querySelectorAll("[data-diagram-label]")) {
      const id = el.dataset.diagramLabel;
      if (this.labels.has(id)) throw Error(`重复连线标签：${id}`);
      this.labels.set(id, {
        el,
        base: this.box(el),
        isSVG: el instanceof SVGElement,
      });
    }
    // Freeze the measured layout. Editable shells own geometry; the original elements own styling.
    // Unmarked layout containers must keep their flow space after children become absolute.
    for (const parent of new Set(
      [...this.nodes.values()]
        .filter((n) => !n.isSVG)
        .map((n) => n.el.parentElement),
    )) {
      if (
        parent === this.body ||
        parent === this.root ||
        parent.matches("[data-diagram-node],[data-diagram-group]")
      )
        continue;
      const cs = getComputedStyle(parent),
        r = this.box(parent);
      const extra =
        cs.boxSizing === "border-box"
          ? 0
          : parseFloat(cs.paddingTop) +
            parseFloat(cs.paddingBottom) +
            parseFloat(cs.borderTopWidth) +
            parseFloat(cs.borderBottomWidth);
      if (r.h > 0) parent.style.minHeight = `${r.h - extra}px`;
    }
    this.body.style.minHeight = `${this.originalBody.h}px`;
    this.root.style.width = `${this.originalSize.w}px`;
    this.root.style.height = `${this.originalSize.h}px`;
    for (const n of [...this.nodes.values()].reverse()) this.wrap(n);
    for (const n of this.nodes.values()) {
      if (!n.isSVG) {
        const r = this.box(n.shell);
        n.shell.style.left = `${parseFloat(n.shell.style.left) + n.base.x - r.x}px`;
        n.shell.style.top = `${parseFloat(n.shell.style.top) + n.base.y - r.y}px`;
      }
    }
    for (const n of this.nodes.values()) n.base = this.box(n.shell);
    for (const l of this.labels.values()) {
      if (l.isSVG) {
        l.originalTransform = l.el.getAttribute("transform") || "";
        l.base = this.box(l.el);
      } else {
        l.el.style.position = "absolute";
        l.el.style.margin = "0";
        l.el.style.transform = "none";
        l.el.style.translate = "none";
        l.el.style.zIndex = "4";
      }
    }
    this.layer = svg("svg", {
      "data-diagram-generated": "wires",
      "aria-label": "图解连线",
    });
    Object.assign(this.layer.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      overflow: "visible",
      pointerEvents: "none",
      zIndex: "3",
    });
    this.root.append(this.layer);
    const objects = [...this.nodes.values()]
      .filter((n) => !n.row)
      .map((n) => n.base);
    const top = objects.length
      ? Math.min(...objects.map((r) => r.y))
      : this.originalBody.y;
    this.baseContentTop = top;
    this.minimumOffset = Math.max(
      0,
      (this.header ? G.bottom(this.box(this.header)) : 0) +
        (this.config.gap ?? 24) -
        top,
    );
    this.state.bodyOffset = number(this.state.bodyOffset, this.minimumOffset);
    if (!Object.hasOwn(this.state, "initialized")) {
      this.state.bodyOffset = Math.max(
        this.minimumOffset,
        this.state.bodyOffset,
      );
      this.state.initialized = true;
    }
    this.apply();
    this.editor = mountEditor(this);
    this.observer = new ResizeObserver(() => this.schedule());
    for (const n of this.nodes.values()) this.observer.observe(n.el);
    document.fonts.addEventListener("loadingdone", () => this.schedule());
    window.addEventListener("resize", () => this.schedule());
    this.root.dataset.diagramReady = "true";
    this.savedState = JSON.stringify(this.state);
    return this;
  }
  wrap(n) {
    if (n.isSVG) {
      n.shell = svg("g", { "data-diagram-shell": n.id });
      n.el.before(n.shell);
      n.shell.append(n.el);
      n.frame = n.el.querySelector("[data-diagram-frame]");
      n.content = n.el.querySelector("[data-diagram-content]");
      n.frameBase = n.frame
        ? {
            w: parseFloat(n.frame.getAttribute("width")),
            h: parseFloat(n.frame.getAttribute("height")),
          }
        : null;
      n.frameBox = n.frame ? this.box(n.frame) : null;
      return;
    }
    const p = n.el.offsetParent || this.root,
      pr = this.box(p),
      cs = getComputedStyle(p);
    const shell = document.createElement("div");
    shell.dataset.diagramShell = n.id;
    Object.assign(shell.style, {
      position: "absolute",
      left: `${n.base.x - pr.x - parseFloat(cs.borderLeftWidth || 0)}px`,
      top: `${n.base.y - pr.y - parseFloat(cs.borderTopWidth || 0)}px`,
      width: `${n.base.w}px`,
      height: `${n.base.h}px`,
      boxSizing: "border-box",
      zIndex: getComputedStyle(n.el).zIndex,
    });
    n.el.before(shell);
    shell.append(n.el);
    n.shell = shell;
    for (const [k, v] of Object.entries({
      position: "relative",
      top: "0",
      left: "0",
      right: "auto",
      bottom: "auto",
      margin: "0",
      width: "100%",
      height: n.group ? "100%" : "auto",
      minHeight: "100%",
      maxHeight: "none",
      maxWidth: "none",
      boxSizing: "border-box",
      transform: "none",
      translate: "none",
    }))
      n.el.style.setProperty(
        k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
        v,
        "important",
      );
    n.el.style.overflow = "visible";
  }
  getState() {
    return clone(this.state);
  }
  getGeometry() {
    return {
      nodes: Object.fromEntries(
        [...this.nodes].map(([id, n]) => [id, this.box(n.shell)]),
      ),
      edges: Object.fromEntries(
        [...this.edgeGeometry].map(([id, e]) => [id, clone(e)]),
      ),
      issues: clone(this.issues || []),
    };
  }
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const fn of this.listeners) fn();
  }
  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.apply();
    });
  }
  snapshot() {
    return JSON.stringify(this.state);
  }
  record(before) {
    if (before === this.snapshot()) return;
    this.history.push(before);
    if (this.history.length > 100) this.history.shift();
    this.future = [];
    this.emit();
  }
  change(fn) {
    const before = this.snapshot();
    fn();
    this.apply();
    this.record(before);
  }
  undo() {
    if (!this.history.length) return;
    this.future.push(this.snapshot());
    this.state = JSON.parse(this.history.pop());
    this.apply();
  }
  redo() {
    if (!this.future.length) return;
    this.history.push(this.snapshot());
    this.state = JSON.parse(this.future.pop());
    this.apply();
  }
  descendants(id) {
    return [...this.nodes.values()]
      .filter((n) => n.parent === id)
      .flatMap((n) => [n, ...this.descendants(n.id)]);
  }
  outerSelection(ids) {
    return ids.filter((id) => {
      let p = this.nodes.get(id)?.parent;
      while (p) {
        if (ids.includes(p)) return false;
        p = this.nodes.get(p)?.parent;
      }
      return true;
    });
  }
  move(ids, dx, dy, referenceBoxes) {
    const selected = this.outerSelection(ids).filter(
      (id) => !this.nodes.get(id)?.locked,
    );
    dy = this.limitRowMove(selected, dy, referenceBoxes);
    for (const id of selected) {
      const n = this.nodes.get(id);
      if (!n || n.locked) continue;
      const v = (this.state.nodes[id] ||= {});
      v.dx = number(v.dx) + (n.row ? 0 : dx);
      v.dy = number(v.dy) + (n.actor ? 0 : dy);
    }
    // A manually pinned route belongs to the nearest shared moving group.
    for (const edge of this.config.edges) {
      const pins = this.edgeSpec(edge).points;
      if (!pins?.length) continue;
      for (const id of selected) {
        const members = new Set([id, ...this.descendants(id).map((n) => n.id)]);
        if (members.has(edge.from) && members.has(edge.to)) {
          const n = this.nodes.get(id),
            x = n.row ? 0 : dx,
            y = n.actor ? 0 : dy;
          // Materialize authored pins in layout state without modifying config.
          if (x || y)
            (this.state.edges[edge.id] ||= {}).points = pins.map((p) => ({
              x: p.x + x,
              y: p.y + y,
            }));
          break;
        }
      }
    }
    this.apply();
  }
  limitRowMove(ids, dy, referenceBoxes) {
    // Pointer deltas and restored state refer to the start of the gesture.
    // Their constraints must use the same geometry, even after reversing direction.
    const box = (n) => referenceBoxes?.get(n.id) || this.box(n.shell);
    const moving = new Set(
      ids.flatMap((id) => [id, ...this.descendants(id).map((n) => n.id)]),
    );
    const rows = [...this.nodes.values()]
      .filter((n) => n.row)
      .sort((a, b) => a.base.y - b.base.y);
    const gap = (a, b) => {
      const prev = this.config.edges.find((e) => e.row === a.id),
        next = this.config.edges.find((e) => e.row === b.id);
      const label = this.labels.get(next?.id);
      return Math.max(
        this.config.rowGap ?? 28,
        (label ? this.box(label.el).h : 0) +
          12 +
          (prev?.from === prev?.to ? 20 : 0),
      );
    };
    let low = -Infinity,
      high = Infinity;
    rows.forEach((n, i) => {
      if (!moving.has(n.id)) return;
      const y = box(n).y,
        prev = rows[i - 1],
        next = rows[i + 1];
      if (prev && !moving.has(prev.id))
        low = Math.max(low, box(prev).y + gap(prev, n) - y);
      if (next && !moving.has(next.id))
        high = Math.min(high, box(next).y - gap(n, next) - y);
      if (n.parent && !moving.has(n.parent)) {
        const parent = this.nodes.get(n.parent),
          captions = this.descendants(n.parent).filter(
            (x) => !x.row && !x.group,
          );
        const top = Math.max(
          box(parent).y,
          ...captions.map((c) => G.bottom(box(c))),
        );
        const edge = this.config.edges.find((e) => e.row === n.id),
          label = this.labels.get(edge?.id);
        low = Math.max(low, top + (label ? this.box(label.el).h : 0) + 12 - y);
      }
    });
    // A pre-existing tight row must not jump when the user makes a zero-distance move.
    return Math.max(Math.min(0, low), Math.min(Math.max(0, high), dy));
  }
  resize(id, w, h) {
    const n = this.nodes.get(id);
    if (!n || n.locked || n.row || n.actor) return;
    const v = (this.state.nodes[id] ||= {});
    v.w = Math.max(24, number(w, n.base.w));
    v.h = Math.max(16, number(h, n.base.h));
    this.apply();
  }
  minimum(n) {
    if (n.isSVG) {
      if (n.group && n.frame) {
        const frame = this.box(n.frame),
          children = this.descendants(n.id);
        return {
          w: Math.max(
            40,
            ...children
              .filter((c) => !c.row)
              .map((c) => G.right(this.box(c.shell)) - frame.x + 12),
          ),
          h: Math.max(
            40,
            ...children.map(
              (c) => G.bottom(this.box(c.shell)) - frame.y + (c.row ? 28 : 12),
            ),
          ),
        };
      }
      if (!n.frame || !n.content) return { w: n.base.w, h: n.base.h };
      const frame = this.box(n.frame),
        content = this.box(n.content);
      return {
        w: Math.max(24, G.right(content) - frame.x + 12),
        h: Math.max(16, G.bottom(content) - frame.y + 12),
      };
    }
    if (n.group) {
      const b = this.box(n.shell),
        rs = this.descendants(n.id).map((c) => this.box(c.shell));
      return {
        w: Math.max(40, ...rs.map((r) => G.right(r) - b.x + 16)),
        h: Math.max(40, ...rs.map((r) => G.bottom(r) - b.y + 16)),
      };
    }
    const cs = getComputedStyle(n.el),
      padding = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    const r = this.box(n.el),
      leaves = [...n.el.querySelectorAll("*")]
        .filter((e) => !e.children.length)
        .map((e) => this.box(e));
    return {
      w: Math.max(24, n.el.scrollWidth),
      h: Math.max(
        n.el.scrollHeight,
        ...leaves.map((e) => G.bottom(e) - r.y + padding),
      ),
    };
  }
  apply() {
    this.body.style.translate = `0px ${number(this.state.bodyOffset)}px`;
    for (const n of this.nodes.values()) {
      const s = this.state.nodes[n.id] || {};
      if (n.isSVG) {
        const m = n.shell.parentElement.getScreenCTM(),
          rootScale = this.scale();
        const sx = m ? Math.hypot(m.a, m.b) / rootScale.x : 1,
          sy = m ? Math.hypot(m.c, m.d) / rootScale.y : 1;
        n.shell.setAttribute(
          "transform",
          `translate(${number(s.dx) / sx} ${number(s.dy) / sy})`,
        );
        if (n.frame?.tagName === "rect") {
          const frameMatrix = n.frame.getScreenCTM();
          const frameScaleX =
            Math.hypot(frameMatrix.a, frameMatrix.b) / rootScale.x;
          const frameScaleY =
            Math.hypot(frameMatrix.c, frameMatrix.d) / rootScale.y;
          const extraW = n.base.w - n.frameBox.w,
            extraH = n.base.h - n.frameBox.h;
          n.frame.setAttribute(
            "width",
            s.w ? (s.w - extraW) / frameScaleX : n.frameBase.w,
          );
          n.frame.setAttribute(
            "height",
            s.h ? (s.h - extraH) / frameScaleY : n.frameBase.h,
          );
          const min = this.minimum(n),
            w = Math.max(s.w ? s.w - extraW : n.frameBox.w, min.w),
            h = Math.max(s.h ? s.h - extraH : n.frameBox.h, min.h);
          n.frame.setAttribute("width", w / frameScaleX);
          n.frame.setAttribute("height", h / frameScaleY);
          if (s.w) s.w = w + extraW;
          if (s.h) s.h = h + extraH;
        }
      } else {
        n.shell.style.translate = `${number(s.dx)}px ${number(s.dy)}px`;
        n.shell.style.width = `${s.w ?? n.base.w}px`;
        n.shell.style.height = `${s.h ?? n.base.h}px`;
        if (!n.group && !n.row) {
          const min = this.minimum(n),
            w = Math.max(s.w ?? n.base.w, min.w),
            h = Math.max(s.h ?? n.base.h, min.h);
          n.shell.style.width = `${w}px`;
          n.shell.style.height = `${h}px`;
          if (s.w) s.w = w;
          if (s.h) s.h = h;
        }
      }
    }
    for (const n of [...this.nodes.values()].reverse())
      if (n.group) {
        const min = this.minimum(n),
          s = this.state.nodes[n.id] || {};
        if (n.isSVG && n.frame?.tagName === "rect") {
          const frame = this.box(n.frame);
          if (min.w > frame.w)
            n.frame.setAttribute(
              "width",
              (parseFloat(n.frame.getAttribute("width")) * min.w) / frame.w,
            );
          if (min.h > frame.h)
            n.frame.setAttribute(
              "height",
              (parseFloat(n.frame.getAttribute("height")) * min.h) / frame.h,
            );
        } else if (!n.isSVG) {
          n.shell.style.width = `${Math.max(s.w ?? n.base.w, min.w)}px`;
          n.shell.style.height = `${Math.max(s.h ?? n.base.h, min.h)}px`;
        }
        if (s.w) s.w = this.box(n.shell).w;
        if (s.h) s.h = this.box(n.shell).h;
      }
    this.refresh();
  }
  edgeSpec(edge, boxes, computed = true) {
    const spec = {
      ...edge,
      ...this.state.edges[edge.id],
      fromPort: this.state.edges[edge.id]?.fromPort || edge.fromPort,
      toPort: this.state.edges[edge.id]?.toPort || edge.toPort,
    };
    if (edge.kind !== "sequence") {
      const from =
          boxes?.get(edge.from) || this.box(this.nodes.get(edge.from).shell),
        to = boxes?.get(edge.to) || this.box(this.nodes.get(edge.to).shell);
      if (!spec.fromPort)
        spec.fromPort = {
          side:
            edge.from === edge.to
              ? "top"
              : Math.abs(to.x - from.x) > Math.abs(to.y - from.y)
                ? to.x >= from.x
                  ? "right"
                  : "left"
                : to.y >= from.y
                  ? "bottom"
                  : "top",
        };
      if (!spec.toPort)
        spec.toPort = {
          side:
            edge.from === edge.to
              ? "right"
              : {
                  right: "left",
                  left: "right",
                  top: "bottom",
                  bottom: "top",
                }[spec.fromPort.side],
        };
    }
    if (computed) Object.assign(spec, this.computedPorts.get(edge.id));
    return spec;
  }
  refresh() {
    if (!this.layer) return;
    const boxes = new Map(
      [...this.nodes].map(([id, n]) => [id, this.box(n.shell)]),
    );
    const distribution =
      this.config.portDistribution === "spread"
        ? distributePorts(
            this.config.edges.map((edge) => ({
              edge,
              spec: this.edgeSpec(edge, boxes, false),
              fixedFrom: !!(
                this.state.edges[edge.id]?.fromPort || edge.fromPort
              ),
              fixedTo: !!(this.state.edges[edge.id]?.toPort || edge.toPort),
            })),
            boxes,
          )
        : { ports: new Map(), issues: [] };
    this.computedPorts = distribution.ports;
    this.portIssues = distribution.issues;
    const obstacles = [...this.nodes.values()]
      .filter((n) => !n.group && !n.row)
      .map((n) => ({ id: n.id, ...boxes.get(n.id) }));
    const headerBox = this.header ? this.box(this.header) : null;
    this.layer.replaceChildren();
    const defs = svg("defs");
    this.layer.append(defs);
    this.edgeGeometry.clear();
    const paths = [];
    for (const edge of this.config.edges) {
      const spec = this.edgeSpec(edge, boxes),
        from = boxes.get(edge.from),
        to = boxes.get(edge.to);
      const obs = obstacles
        .filter((r) => r.id !== edge.from && r.id !== edge.to)
        .map((r) => G.expand(r, 8));
      if (headerBox) obs.push(G.expand(headerBox, 8));
      let result;
      if (edge.kind === "sequence") {
        const row = boxes.get(edge.row),
          y = row.y + row.h / 2,
          a = { x: from.x + from.w / 2, y },
          b = { x: to.x + to.w / 2, y };
        result = {
          points:
            edge.from === edge.to
              ? [
                  a,
                  { x: a.x + 48, y },
                  { x: a.x + 48, y: y + 20 },
                  { x: a.x, y: y + 20 },
                ]
              : [a, b],
          blocked: false,
        };
      } else {
        if (spec.points)
          spec.points = spec.points.map((p) => ({
            x: p.x,
            y: p.y + number(this.state.bodyOffset),
          }));
        result = G.route(from, to, spec, obs);
        if (result.blocked) {
          const tight = obstacles
            .filter((r) => r.id !== edge.from && r.id !== edge.to)
            .map((r) => G.expand(r, 2));
          if (headerBox) tight.push(G.expand(headerBox, 8));
          const fallback = G.route(from, to, spec, tight);
          if (!fallback.blocked) result = fallback;
        }
      }
      const color = edge.color || "#334155",
        markerId = `mk-arrow-${edge.id}`;
      const marker = svg("marker", {
        id: markerId,
        viewBox: "0 0 10 10",
        refX: "10",
        refY: "5",
        markerWidth: "7",
        markerHeight: "7",
        orient: "auto-start-reverse",
        markerUnits: "userSpaceOnUse",
      });
      marker.append(
        svg("path", {
          d: "M0 0 L10 5 L0 10",
          fill: "none",
          stroke: color,
          "stroke-width": "1.5",
        }),
      );
      defs.append(marker);
      const p = svg("path", {
        d: G.pathData(result.points),
        fill: "none",
        stroke: color,
        "stroke-width": edge.width || 2,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        "data-diagram-edge": edge.id,
      });
      if (edge.arrow !== false)
        p.setAttribute("marker-end", `url(#${markerId})`);
      if (edge.dash) p.setAttribute("stroke-dasharray", edge.dash);
      this.layer.append(p);
      const geo = {
        ...result,
        from: edge.from,
        to: edge.to,
        fromPort: spec.fromPort,
        toPort: spec.toPort,
      };
      this.edgeGeometry.set(edge.id, geo);
      paths.push(geo);
    }
    const sequenceEdges = this.config.edges.filter(
      (e) => e.kind === "sequence",
    );
    for (const n of this.nodes.values())
      if (n.actor && sequenceEdges.length) {
        const b = boxes.get(n.id),
          last =
            Math.max(...sequenceEdges.map((e) => G.bottom(boxes.get(e.row)))) +
            28;
        const line = svg("path", {
          d: `M ${b.x + b.w / 2} ${G.bottom(b)} V ${last}`,
          fill: "none",
          stroke: "#94a3b8",
          "stroke-width": 1,
          "stroke-dasharray": "5 6",
          "data-diagram-lifeline": n.id,
        });
        this.layer.prepend(line);
      }
    const occupied = [
      ...obstacles.map((r) => G.expand(r, 4)),
      ...(headerBox ? [headerBox] : []),
    ];
    for (const edge of this.config.edges) {
      const l = this.labels.get(edge.id);
      if (!l) continue;
      const geo = this.edgeGeometry.get(edge.id),
        box = this.box(l.el),
        spec = this.state.edges[edge.id] || {};
      const candidates = [
        ...occupied,
        ...paths
          .filter((p) => p !== geo)
          .flatMap((p) =>
            p.points.slice(1).map((b, i) =>
              G.expand(
                G.union([
                  { ...p.points[i], w: 0, h: 0 },
                  { ...b, w: 0, h: 0 },
                ]),
                2,
              ),
            ),
          ),
      ];
      const position = G.labelPosition(
        geo.points,
        { w: box.w, h: box.h },
        candidates,
      );
      const x = position.x + number(spec.label?.dx),
        y = position.y + number(spec.label?.dy);
      if (l.isSVG) {
        // Measure the original label inside its current parent transform. The
        // parent may already include group movement and the body's translation.
        l.el.setAttribute("transform", l.originalTransform);
        const origin = this.box(l.el);
        const m = l.el.parentElement.getScreenCTM(),
          s = this.scale(),
          sx = Math.hypot(m.a, m.b) / s.x,
          sy = Math.hypot(m.c, m.d) / s.y;
        l.el.setAttribute(
          "transform",
          `translate(${(x - origin.x) / sx} ${(y - origin.y) / sy}) ${l.originalTransform}`,
        );
      } else {
        const p = l.el.offsetParent || this.root,
          pr = this.box(p),
          cs = getComputedStyle(p);
        l.el.style.left = `${x - pr.x - parseFloat(cs.borderLeftWidth || 0)}px`;
        l.el.style.top = `${y - pr.y - parseFloat(cs.borderTopWidth || 0)}px`;
      }
      geo.label = this.box(l.el);
      geo.labelBlocked = position.blocked && !spec.label;
      occupied.push(G.expand(geo.label, 4));
    }
    this.fitCanvas(boxes);
    // SVG labels share their art's stacking context. Cut the owning line under
    // its label so labels remain readable even when the wire overlay is above it.
    for (const [id, geometry] of this.edgeGeometry)
      if (geometry.label) {
        const maskId = `mk-label-mask-${id}`;
        const mask = svg("mask", {
          id: maskId,
          maskUnits: "userSpaceOnUse",
          x: 0,
          y: 0,
          width: this.root.offsetWidth,
          height: this.root.offsetHeight,
        });
        mask.append(
          svg("rect", {
            x: 0,
            y: 0,
            width: this.root.offsetWidth,
            height: this.root.offsetHeight,
            fill: "white",
          }),
        );
        const label = G.expand(geometry.label, 2);
        mask.append(
          svg("rect", {
            x: label.x,
            y: label.y,
            width: label.w,
            height: label.h,
            fill: "black",
          }),
        );
        defs.append(mask);
        this.layer
          .querySelector(`[data-diagram-edge="${id}"]`)
          .setAttribute("mask", `url(#${maskId})`);
      }
    this.issues = this.diagnose(boxes);
    this.emit();
  }
  fitCanvas(boxes) {
    const extent = G.union([
      ...boxes.values(),
      ...[...this.edgeGeometry.values()].flatMap((e) => [
        ...(e.label ? [e.label] : []),
        ...e.points.map((p) => ({ ...p, w: 0, h: 0 })),
      ]),
    ]);
    if (!this.config.fixedSize) {
      const w = Math.ceil(
          Math.max(this.originalSize.w, G.right(extent) + 32) - 0.001,
        ),
        footH = this.originalFooter?.h || 0;
      const h = Math.ceil(
        Math.max(this.originalSize.h, G.bottom(extent) + footH + 48) - 0.001,
      );
      this.root.style.width = `${Math.ceil(w)}px`;
      this.root.style.height = `${Math.ceil(h)}px`;
      // SVG documents share the same logical coordinate space as the HTML artboard.
      for (const s of this.root.querySelectorAll("svg[data-diagram-surface]")) {
        s.setAttribute("width", w);
        s.setAttribute("height", h);
        s.setAttribute("viewBox", `0 0 ${w} ${h}`);
        s.style.width = `${w}px`;
        s.style.height = `${h}px`;
      }
      for (const bg of this.root.querySelectorAll(
        "[data-diagram-background]",
      )) {
        bg.setAttribute("width", w);
        bg.setAttribute("height", h);
      }
      if (this.footer) {
        const y = Math.max(this.originalFooter.y, G.bottom(extent) + 24);
        if (this.footer instanceof SVGElement)
          this.footer.setAttribute(
            "transform",
            `translate(0 ${y - this.originalFooter.y})`,
          );
        else {
          this.footer.style.position = "absolute";
          this.footer.style.top = `${y}px`;
          this.footer.style.bottom = "auto";
        }
      }
    }
    this.layer.setAttribute(
      "viewBox",
      `0 0 ${this.root.offsetWidth} ${this.root.offsetHeight}`,
    );
  }
  diagnose(
    boxes = new Map([...this.nodes].map(([id, n]) => [id, this.box(n.shell)])),
  ) {
    const issues = [],
      nodes = [...this.nodes.values()].filter((n) => !n.group && !n.row),
      header = this.header ? this.box(this.header) : null;
    const region = (id) =>
      boxes.get(id) ||
      this.edgeGeometry.get(id)?.label ||
      G.union(
        (this.edgeGeometry.get(id)?.points || []).map((p) => ({
          ...p,
          w: 0,
          h: 0,
        })),
      );
    const add = (type, id, message, relatedIds = []) => {
      const diagnostic = issue(type, id, message, {
        relatedIds,
        evidence: {
          region: region(id),
          related: relatedIds.map((id) => ({ id, region: region(id) })),
        },
      });
      issues.push(diagnostic);
    };
    for (const n of [...this.nodes.values()].filter((n) => !n.row)) {
      const b = boxes.get(n.id);
      if (
        b.x < -0.5 ||
        b.y < -0.5 ||
        G.right(b) > this.root.offsetWidth + 0.5 ||
        G.bottom(b) > this.root.offsetHeight + 0.5
      )
        add("bounds", n.id, "对象超出画布");
      if (header && G.overlaps(b, header))
        add("header", n.id, "主体进入页眉区域");
      if (
        !n.isSVG &&
        (n.el.scrollWidth > n.shell.clientWidth + 1 ||
          n.el.scrollHeight > n.shell.clientHeight + 1)
      )
        add("overflow", n.id, "内容超出外框");
      if (n.isSVG && n.content && n.frame) {
        const c = this.box(n.content),
          f = this.box(n.frame);
        if (
          c.x < f.x ||
          c.y < f.y ||
          G.right(c) > G.right(f) + 1 ||
          G.bottom(c) > G.bottom(f) + 1
        )
          add("overflow", n.id, "SVG 内容超出外框");
      }
    }
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        if (G.overlaps(boxes.get(nodes[i].id), boxes.get(nodes[j].id), 0.5))
          add("overlap", nodes[i].id, `与 ${nodes[j].id} 重叠`, [nodes[j].id]);
    const entries = [...this.edgeGeometry];
    for (const [id, e] of entries) {
      if (e.blocked) add("route", id, "自动走线受阻，请调整折点或模块位置");
      if (G.pathBacktracks(e.points))
        add("backtrack", id, "相邻线段沿原路折回，请调整折点或恢复自动走线");
      if (e.labelBlocked) add("label", id, "未找到标签空位");
      const spec = this.config.edges.find((x) => x.id === id);
      for (const n of nodes) {
        if (
          n.id !== e.from &&
          n.id !== e.to &&
          G.pathHits(e.points, boxes.get(n.id))
        )
          add("crossing", id, `连线穿过 ${n.id}`, [n.id]);
        if (e.label && G.overlaps(e.label, boxes.get(n.id), 1))
          add("label", id, `标签遮挡 ${n.id}`, [n.id]);
      }
      if (e.label)
        for (const [other, p] of entries)
          if (id !== other && G.pathHits(p.points, G.expand(e.label, -1)))
            add("label-line", id, `标签覆盖连线 ${other}`, [other]);
      if (
        e.label &&
        (e.label.x < 0 ||
          e.label.y < 0 ||
          G.right(e.label) > this.root.offsetWidth + 0.5 ||
          G.bottom(e.label) > this.root.offsetHeight + 0.5)
      )
        add("bounds", id, "标签超出画布");
      if (
        header &&
        (G.pathHits(e.points, header) ||
          (e.label && G.overlaps(e.label, header)))
      )
        add("header", id, "连线或标签进入页眉");
      for (const p of e.points)
        if (
          p.x < 0 ||
          p.y < 0 ||
          p.x > this.root.offsetWidth ||
          p.y > this.root.offsetHeight
        ) {
          add("bounds", id, "连线超出画布");
          break;
        }
      if (spec.kind === "sequence" && e.blocked)
        add("sequence", id, "消息行需要更多空间");
    }
    for (let i = 0; i < entries.length; i++)
      for (let j = i + 1; j < entries.length; j++)
        if (
          entries[i][1].label &&
          entries[j][1].label &&
          G.overlaps(entries[i][1].label, entries[j][1].label, 1)
        )
          add("label", entries[i][0], `与标签 ${entries[j][0]} 重叠`, [
            entries[j][0],
          ]);
    const frames = [];
    const painted = (color) =>
      !["none", "transparent"].includes(color) &&
      !/(?:,\s*0(?:\.0*)?|\/\s*0(?:\.0*)?%?)\)$/.test(color);
    const visible = (el) => {
      for (let current = el; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (
          style.display === "none" ||
          style.visibility !== "visible" ||
          Number(style.opacity) === 0
        )
          return false;
        if (current === this.root) break;
      }
      return true;
    };
    for (const n of this.nodes.values()) {
      if (!n.group || !visible(n.el)) continue;
      if (n.isSVG) {
        const frame = n.el.querySelector(":scope > rect[data-diagram-frame]");
        if (frame) {
          const style = getComputedStyle(frame);
          if (
            visible(frame) &&
            painted(style.stroke) &&
            parseFloat(style.strokeWidth) > 0 &&
            Number(style.strokeOpacity) > 0
          )
            frames.push({ id: n.id, rect: this.box(frame) });
        }
      } else {
        const style = getComputedStyle(n.el);
        const sides = ["top", "right", "bottom", "left"].filter((side) => {
          const prefix = `border-${side}`;
          return (
            parseFloat(style.getPropertyValue(`${prefix}-width`)) > 0 &&
            !["none", "hidden"].includes(
              style.getPropertyValue(`${prefix}-style`),
            ) &&
            painted(style.getPropertyValue(`${prefix}-color`))
          );
        });
        if (sides.length)
          frames.push({ id: n.id, rect: boxes.get(n.id), sides });
      }
    }
    const diagnostics = [
      ...issues,
      ...(this.portIssues || []),
      ...readability(this.edgeGeometry, frames, issues),
    ];
    for (const diagnostic of diagnostics) {
      const ids = [diagnostic.id, ...diagnostic.relatedIds];
      const edges = this.config.edges.filter((e) => ids.includes(e.id));
      const objects = [
        ...new Set([...ids, ...edges.flatMap((e) => [e.from, e.to])]),
      ]
        .map((id) => this.nodes.get(id))
        .filter(Boolean);
      diagnostic.supportedFixes = diagnostic.supportedFixes.filter((fix) => {
        if (["edit-bends", "reset-route"].includes(fix))
          return edges.some((e) => !["straight", "sequence"].includes(e.kind));
        if (fix === "edit-ports")
          return edges.some((e) => e.kind !== "sequence");
        if (fix === "move-label")
          return edges.some((e) => this.labels.has(e.id));
        if (fix === "move-node")
          return objects.some((n) => !n.locked && !n.row);
        if (fix === "resize-node")
          return objects.some(
            (n) =>
              !n.locked &&
              !n.row &&
              !n.actor &&
              (!n.isSVG || n.frame?.tagName === "rect"),
          );
        if (fix === "move-row")
          return edges.some(
            (e) => e.kind === "sequence" && this.nodes.get(e.row)?.row,
          );
        return true;
      });
      if (!diagnostic.evidence.related?.length)
        diagnostic.evidence.related = diagnostic.relatedIds.map((id) => ({
          id,
          region: region(id),
        }));
    }
    return orderedIssues(diagnostics);
  }

  saveHTML() {
    const doc = this.template.cloneNode(true);
    for (const e of doc.querySelectorAll(
      "[data-diagram-generated],muse-diagram-editor",
    ))
      e.remove();
    let state = doc.querySelector("#diagram-state");
    if (!state) {
      state = document.createElement("script");
      state.id = "diagram-state";
      state.type = "application/json";
      doc.querySelector("body").append(state);
    }
    state.textContent = escJSON(this.state);
    doc.querySelector("[data-diagram]")?.removeAttribute("data-diagram-ready");
    return "<!doctype html>\n" + doc.outerHTML;
  }
  download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  save() {
    this.download(
      new Blob([this.saveHTML()], { type: "text/html;charset=utf-8" }),
      `${(this.config.name || "diagram").replace(/(?:\.editable)+$/, "")}.editable.html`,
    );
    this.savedState = this.snapshot();
    this.emit();
  }
  async exportPNG(ratio = 2) {
    await this.ready;
    await document.fonts.ready;
    if (![1, 2].includes(ratio)) throw Error("导出倍率只支持 1 或 2");
    const w = this.root.offsetWidth,
      h = this.root.offsetHeight;
    if (
      w * ratio > 16384 ||
      h * ratio > 16384 ||
      w * h * ratio * ratio > 64000000
    )
      throw Error("画布超过导出上限，请选择 1 倍或减小画布");
    if (this.issues.some((i) => i.type === "bounds"))
      throw Error("有对象超出画布，请调整位置或增加画布空间后导出");
    for (const img of this.root.querySelectorAll("img"))
      if (!img.complete || !img.naturalWidth)
        throw Error("图片资源未加载，无法完整导出");
    const resources = new Set();
    const collectImages = (cs) => {
      for (const value of [
        cs.backgroundImage,
        cs.borderImageSource,
        cs.maskImage,
        cs.listStyleImage,
        cs.content,
      ])
        for (const match of value.matchAll(/url\(["']?([^"')]+)["']?\)/g))
          if (!match[1].startsWith("#")) resources.add(match[1]);
    };
    for (const el of [this.root, ...this.root.querySelectorAll("*")]) {
      collectImages(getComputedStyle(el));
      for (const pseudo of ["::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (
          !["none", "normal", ""].includes(cs.content) &&
          cs.display !== "none"
        )
          collectImages(cs);
      }
      if (el instanceof SVGImageElement) resources.add(el.href.baseVal);
    }
    for (const src of resources) {
      const img = new Image();
      img.src = src;
      try {
        await img.decode();
      } catch {
        throw Error("嵌入图片资源损坏，无法完整导出");
      }
    }
    if ([...document.fonts].some((font) => font.status === "error"))
      throw Error("嵌入字体加载失败，无法完整导出");
    const blob = await toBlob(this.root, {
      pixelRatio: ratio,
      width: w,
      height: h,
      canvasWidth: w,
      canvasHeight: h,
      skipAutoScale: true,
      style: { transform: "none", translate: "none", margin: "0" },
      filter: (n) => !n.hasAttribute?.("data-diagram-ui"),
    });
    if (!blob || blob.size < 100) throw Error("PNG 导出失败");
    const bitmap = await createImageBitmap(blob),
      valid = bitmap.width === w * ratio && bitmap.height === h * ratio;
    bitmap.close();
    if (!valid) throw Error("浏览器未能导出完整尺寸，请降低倍率");
    return blob;
  }
}

const start = () => {
  const root = document.querySelector("[data-diagram]"),
    el = document.querySelector("#diagram-config");
  if (!root || !el) return;
  try {
    const diagram = new Diagram(
      root,
      JSON.parse(el.textContent),
      JSON.parse(document.querySelector("#diagram-state")?.textContent || "{}"),
    );
    window.museDiagram = diagram;
    diagram.ready.catch((error) => {
      root.dataset.diagramError = error.message;
      const p = document.createElement("p");
      p.textContent = `图解初始化失败：${error.message}`;
      p.setAttribute("role", "alert");
      root.before(p);
      console.error(error);
    });
  } catch (error) {
    root.dataset.diagramError = error.message;
    console.error(error);
  }
};
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
