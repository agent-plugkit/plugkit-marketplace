import { mountReader } from "./reader.js";
import { right, bottom } from "./geometry.js";

export function mountEditor(d) {
  const host = document.createElement("muse-diagram-editor");
  host.dataset.diagramUi = "";
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>
    :host{all:initial;position:fixed;inset:0;z-index:2147483000;pointer-events:none;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#182435}
    *{box-sizing:border-box}button,input,select{font:inherit}button,select,input{pointer-events:auto}button{cursor:pointer;border:1px solid #dbe2eb;border-radius:7px;padding:7px 11px;background:#fff;color:#334155;min-height:34px}button:hover{background:#eef2f7}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #2563eb;outline-offset:2px}button:disabled{opacity:.4;cursor:default}.primary{background:#243b5a;color:#fff;border-color:#243b5a}.primary:hover{background:#334f74}
    .bar{position:absolute;top:16px;left:20px;right:20px;display:flex;align-items:center;gap:8px;pointer-events:none}.bar>*{pointer-events:auto}.brand{font-size:11px;letter-spacing:1.2px;font-weight:700;color:#475569;background:#fff;border:1px solid #dbe2eb;border-radius:7px;padding:9px 13px}.spacer{flex:1;pointer-events:none}.cluster{display:flex;gap:4px;padding:4px;background:#ffffffed;border:1px solid #dbe2eb;border-radius:10px;box-shadow:0 3px 15px #172b4d0c}.cluster button{border-color:transparent}.panel{position:absolute;right:20px;top:76px;bottom:24px;width:280px;overflow:auto;padding:18px;background:#fffffff5;border:1px solid #dbe2eb;border-radius:12px;box-shadow:0 8px 32px #172b4d12;pointer-events:auto}.panel h2{font-size:13px;margin:0 0 12px}.panel h3{font-size:11px;margin:20px 0 9px;color:#64748b;letter-spacing:.5px}.muted{color:#64748b;font-size:11px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fields label{font-size:11px;color:#64748b}.fields input,.fields select{width:100%;margin-top:4px;padding:6px;border:1px solid #dbe2eb;border-radius:6px;color:#182435;background:#fff}.actions{display:flex;flex-wrap:wrap;gap:5px}.actions button{font-size:11px;flex:1}.list{display:flex;flex-direction:column;gap:3px}.list button{text-align:left;font-size:12px;padding:5px 8px;border-color:transparent;min-height:30px}.list button[aria-pressed="true"]{background:#e8f0fc;color:#1d4ed8}.issues button{color:#a34a12;background:#fff8ed;border-color:#fde6c7}.status{position:absolute;bottom:16px;left:20px;background:#ffffffee;border:1px solid #dbe2eb;border-radius:7px;padding:7px 12px;color:#64748b;font-size:11px;pointer-events:auto}.toast{position:absolute;bottom:58px;left:20px;max-width:560px;background:#182435;color:#fff;padding:12px 16px;border-radius:8px;pointer-events:auto}.overlay{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none}.overlay [data-hit]{pointer-events:all;cursor:move}.overlay [data-edge-hit]{pointer-events:stroke;cursor:pointer}.overlay [data-resize]{pointer-events:all;cursor:nwse-resize}[hidden]{display:none!important}
    .bends{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.bend{display:flex;align-items:center;border:1px solid #cbd9ee;border-radius:7px;overflow:hidden;background:#fff}.bend button{min-height:30px;min-width:30px;padding:3px 7px;border:0;border-radius:0;color:#1d4ed8}.bend button:focus-visible{outline-offset:-2px}.bend .remove-bend{border-left:1px solid #dbe2eb;color:#64748b;font-size:17px}.bend .remove-bend:hover{background:#fff1f2;color:#b91c1c}.overlay [data-bend-number] text{font:600 11px/1 system-ui,sans-serif;pointer-events:none;user-select:none}
    .reader{width:min(320px,calc(100vw - 40px))}.reader-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.reader-heading h2{margin:0}.reader input{width:100%;padding:8px;border:1px solid #dbe2eb;border-radius:7px;margin:12px 0}.reader-results{max-height:30vh;overflow:auto}.reader-results button{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reader-detail h3,.reader-detail button{overflow-wrap:anywhere}.reader-count{margin-bottom:8px}.reader-overlay{pointer-events:none}.issues .warning{background:#fff8ed}.issues .error{background:#fff1f2;border-color:#fecdd3;color:#9f1239}.issue-detail{font-size:11px;color:#64748b;overflow-wrap:anywhere;margin:4px 0 10px}.bar{flex-wrap:wrap}.bar .brand{flex-shrink:0}
    .editor-panel{width:320px;padding:0;display:flex;flex-direction:column;overflow:hidden;top:var(--panel-top,76px);bottom:16px}
    .panel-header{padding:16px 18px 13px;border-bottom:1px solid #e5eaf1;display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none}.panel-header h2{margin:0;font-size:14px}.panel-header .muted{font-size:11px}.panel-status{display:none;font-size:11px;color:#64748b}
    .inspector{padding:16px 18px;overflow:auto;overscroll-behavior:contain;min-height:0;flex:0 1 auto;scrollbar-gutter:stable}.selection-title{font-size:15px;line-height:1.4;font-weight:650;overflow-wrap:anywhere;margin:0 0 3px}.selection-meta{font-size:11px;color:#64748b;overflow-wrap:anywhere;margin:0 0 14px}.empty-selection{margin:0 0 14px;color:#64748b;font-size:12px;line-height:1.6}
    .editor-panel h3{margin:16px 0 9px;letter-spacing:0}.editor-panel .fields{gap:10px 12px;margin-bottom:12px}.editor-panel .fields label{min-width:0}.editor-panel .fields input,.editor-panel .fields select{min-width:0;min-height:34px;padding:6px 8px;font-variant-numeric:tabular-nums}.editor-panel input:disabled,.editor-panel select:disabled{background:#f3f5f8;color:#8490a2}.editor-panel .actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.editor-panel .actions button{padding:6px 8px;line-height:1.4}.editor-panel .muted{line-height:1.6}.editor-panel .inspector>p:last-child{margin-bottom:0}
    .canvas-settings{border-top:1px solid #e5eaf1;padding-top:12px;margin-top:16px}.canvas-settings:first-child{border-top:0;margin-top:0;padding-top:0}.canvas-settings summary{cursor:pointer;font-size:12px;font-weight:600;list-style:none;display:flex;align-items:center;gap:6px;margin-bottom:12px}.canvas-settings summary::before{content:'›';font-size:16px;transform:rotate(0deg)}.canvas-settings[open] summary::before{transform:rotate(90deg)}summary:focus-visible{outline:2px solid #2563eb;outline-offset:3px}.canvas-settings:not([open]) summary{margin-bottom:0}.body-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px}.body-controls .fields{grid-template-columns:1fr;margin:0}.body-controls button{font-size:11px;white-space:nowrap;padding:6px 9px}
    .diagnostics{border-top:1px solid #e5eaf1;margin-top:16px;padding-top:12px}.diagnostics h3{margin:0 0 7px}.diagnostics .issues>p{margin:0}.diagnostics .issues .issue-detail{margin:4px 0 12px}.diagnostics .list button{white-space:normal;overflow-wrap:anywhere}.diagnostics .muted{font-size:11px}
    .navigator{border-top:1px solid #dbe2eb;background:#f8fafc;display:flex;flex-direction:column;flex:1 0 220px;min-height:160px;overflow:hidden}.navigator-header{padding:12px 18px 9px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none}.navigator-header h3{margin:0;font-size:12px;color:#334155}.navigator-scroll{overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;min-height:0;padding:0 10px 12px}.navigator-scroll h3{margin:10px 8px 6px;font-size:11px}.navigator-scroll h3:first-child{margin-top:0}.navigator .list{gap:2px}.navigator .list button{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:34px;padding:6px 8px;background:transparent}.navigator .list button:hover{background:#edf1f7}.navigator .list button[aria-pressed="true"]{background:#e8f0fc;box-shadow:inset 2px 0 #2563eb}.object-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.object-id{font:10px/1.5 ui-monospace,SFMono-Regular,monospace;color:#64748b;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.navigator .edge-item{flex-direction:column;align-items:flex-start!important;gap:1px!important}.edge-item .object-name{max-width:100%}.edge-item .object-id{max-width:100%;font-family:inherit}.editor-panel .bends{gap:6px}.panel{top:var(--panel-top,76px)}.bar select{border:1px solid #dbe2eb;border-radius:6px;background:#fff;color:#334155;padding:4px}.status{max-width:calc(100vw - 40px)}
    @media(max-width:1100px){.bar .brand{display:none}}
    @media(max-width:900px){.editor-panel{left:20px;right:20px;top:auto;bottom:16px;width:auto;height:42vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}.editor-panel .panel-header{grid-column:1/-1;padding:10px 14px}.inspector{padding:12px 14px;flex:none}.navigator{border-top:0;border-left:1px solid #dbe2eb;min-height:0}.navigator-header{padding:10px 14px 8px}.navigator-scroll{padding-left:6px;padding-right:6px}:host([editing]) .status{display:none}.panel-header>.muted{display:none}.panel-status{display:block}.bar .spacer{display:none}.bar{justify-content:space-between;gap:6px}.toast{bottom:16px;max-width:calc(100vw - 40px)}}
    @media(max-width:520px){.bar{top:10px;left:12px;right:12px}.cluster{gap:0}.cluster button{padding:6px 8px}.editor-panel{left:12px;right:12px;height:46vh;grid-template-columns:minmax(0,1fr) minmax(0,.85fr)}.inspector{padding:10px}.navigator-header{padding:10px}.navigator-header .muted{display:none}.body-controls{grid-template-columns:1fr}.body-controls button{width:100%}.editor-panel .fields{gap:8px}.editor-panel .actions{grid-template-columns:1fr}.object-id{display:none}.edge-item .object-id{display:block}.panel-header .muted{font-size:10px}}
  </style>
  <svg class="overlay" aria-hidden="true"></svg>
  <div class="bar"><span class="brand">MUSEKIT / DIAGRAM</span><div class="cluster"><button data-action="edit" class="primary">编辑布局</button><button data-action="undo" title="撤销 Ctrl/Cmd+Z">撤销</button><button data-action="redo" title="重做 Ctrl/Cmd+Shift+Z">重做</button></div><div class="cluster"><button data-action="find" title="查找节点 /">查找节点</button><button data-action="out" aria-label="缩小">−</button><button data-action="fit">适合窗口</button><button data-action="in" aria-label="放大">＋</button></div><span class="spacer"></span><div class="cluster"><button data-action="save">保存 HTML</button><select aria-label="PNG 导出倍率"><option value="2">PNG · 2 倍</option><option value="1">PNG · 1 倍</option></select><button data-action="png" class="primary">导出 PNG</button></div></div>
  <section class="panel editor-panel" hidden aria-label="布局属性"></section><div class="status" role="status"></div><div class="toast" role="alert" hidden></div>`;
  const $ = (s) => shadow.querySelector(s),
    overlay = $(".overlay"),
    panel = $(".panel");
  let editing = false,
    selection = [],
    selectedEdge = null,
    highlightedBend = null,
    zoom = 1,
    drag = null,
    space = false,
    busy = false,
    toastTimer;
  let fieldUpdates = [];
  let changingField = false;
  let panelBody = panel;
  let canvasExpanded = true;
  let resetInspectorScroll = false;
  let fitted = true;
  let reader;
  let issueRegions = [];
  const view = document.createElement("div");
  view.dataset.diagramGenerated = "viewport";
  Object.assign(view.style, {
    position: "fixed",
    inset: "0",
    overflow: "auto",
    background: "#e8edf3",
    padding: "88px 32px 64px",
    boxSizing: "border-box",
  });
  d.root.before(view);
  const stage = document.createElement("div");
  stage.style.position = "relative";
  view.append(stage);
  stage.append(d.root);
  d.root.style.transformOrigin = "0 0";
  d.root.style.margin = "0";
  function toast(text) {
    $(".toast").textContent = text;
    $(".toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($(".toast").hidden = true), 6000);
  }
  function setZoom(z) {
    fitted = false;
    zoom = Math.max(0.15, Math.min(2.5, z));
    d.root.style.transform = `scale(${zoom})`;
    stage.style.width = `${d.root.offsetWidth * zoom}px`;
    stage.style.height = `${d.root.offsetHeight * zoom}px`;
    renderOverlay();
    reader?.draw();
    renderStatus();
  }
  function availableSpace() {
    const top = $(".bar").getBoundingClientRect().bottom + 20;
    host.style.setProperty("--panel-top", `${top}px`);
    const dock = editing ? panel : reader?.isOpen() ? $(".reader") : null;
    const r = dock?.getBoundingClientRect();
    const bottomDock = editing && innerWidth <= 900;
    const left = innerWidth <= 520 ? 12 : 32;
    const width = Math.max(80, (r && !bottomDock ? r.left - 20 : innerWidth - left) - left);
    const height = Math.max(80, (r && bottomDock ? r.top - 20 : innerHeight - 56) - top);
    view.style.paddingTop = `${top}px`;
    view.style.paddingLeft = `${left}px`;
    view.style.paddingRight = `${r && !bottomDock ? innerWidth - r.left + 20 : left}px`;
    view.style.paddingBottom = `${r && bottomDock ? innerHeight - r.top + 20 : 56}px`;
    return { width, height };
  }
  function fit() {
    const { width, height } = availableSpace();
    setZoom(Math.min(width / d.root.offsetWidth, height / d.root.offsetHeight));
    fitted = true;
    view.scrollTo(0, 0);
  }
  function renderStatus() {
    const saved = d.snapshot() === d.savedState ? "已保存" : "未保存";
    $(".status").textContent =
      `${Math.round(zoom * 100)}% · ${d.root.offsetWidth} × ${d.root.offsetHeight} · ${saved}${editing ? " · 空格拖动画布，Shift 多选" : ""}`;
    const compact = $(".panel-status");
    if (compact) {
      compact.textContent = `${Math.round(zoom * 100)}% · ${saved}`;
      compact.title = $(".status").textContent;
    }
  }
  function choose(ids, edge = null) {
    // Commit a pending property edit before changing its target object.
    if (panel.contains(shadow.activeElement) && shadow.activeElement?.matches("input,select"))
      shadow.activeElement.blur();
    issueRegions = [];
    resetInspectorScroll = selectedEdge !== edge || selection.join("|") !== ids.join("|");
    selection = ids;
    selectedEdge = edge;
    highlightedBend = null;
    render();
  }
  function bends(id = selectedEdge) {
    const edge = d.config.edges.find((e) => e.id === id);
    if (!edge || ["sequence", "straight"].includes(edge.kind)) return [];
    const pins = d.edgeSpec(edge).points;
    // Explicit pins, including an empty override, own the editable handles.
    // Routing may add corners to keep the joins orthogonal; those are not new pins.
    return Array.isArray(pins)
      ? pins.map((p) => ({ x: p.x, y: p.y + d.state.bodyOffset }))
      : d.edgeGeometry.get(id)?.points.slice(1, -1) || [];
  }
  function setBends(id, points) {
    (d.state.edges[id] ||= {}).points = points.map((p) => ({
      x: p.x,
      y: p.y - d.state.bodyOffset,
    }));
  }
  function removeBend(id, index) {
    const points = bends(id);
    if (index < 0 || index >= points.length) return;
    points.splice(index, 1);
    highlightedBend = points.length ? Math.min(index, points.length - 1) : null;
    d.change(() => setBends(id, points));
    const next =
      panel.querySelector(`[data-remove-bend="${highlightedBend}"]`) ||
      panel.querySelector("[data-add-bend]");
    next?.focus({ preventScroll: true });
  }
  function make(tag, attrs = {}) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }
  function screen(r) {
    const c = d.root.getBoundingClientRect(),
      s = d.scale();
    return {
      x: c.left + r.x * s.x,
      y: c.top + r.y * s.y,
      w: r.w * s.x,
      h: r.h * s.y,
    };
  }
  function renderOverlay() {
    overlay.replaceChildren();
    if (!editing) return;
    const rect = (r, attrs) => {
      const b = screen(r);
      overlay.append(
        make("rect", {
          x: b.x,
          y: b.y,
          width: Math.max(1, b.w),
          height: Math.max(1, b.h),
          fill: "none",
          ...attrs,
        }),
      );
    };
    for (const edge of d.config.edges) {
      const e = d.edgeGeometry.get(edge.id);
      if (!e) continue;
      const pts = e.points.map((p) => screen({ ...p, w: 0, h: 0 }));
      overlay.append(
        make("path", {
          d: pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
          fill: "none",
          stroke: selectedEdge === edge.id ? "#2563eb" : "transparent",
          "stroke-width": selectedEdge === edge.id ? 3 : 14,
          "data-edge-hit": edge.id,
        }),
      );
    }
    for (const r of issueRegions)
      rect(r, {
        stroke: "#2563eb",
        "stroke-width": 2,
        "stroke-dasharray": "6 3",
      });
    for (const issue of d.issues || []) {
      const n = d.nodes.get(issue.id),
        e = d.edgeGeometry.get(issue.id);
      if (n)
        rect(d.box(n.shell), { stroke: "#d97706", "stroke-dasharray": "4 4" });
      else if (e?.label)
        rect(e.label, { stroke: "#d97706", "stroke-dasharray": "4 4" });
    }
    for (const id of selection) {
      const n = d.nodes.get(id);
      if (!n) continue;
      const r = d.box(n.shell);
      rect(r, { stroke: "#2563eb", "stroke-width": 1.5 });
      if (
        !n.locked &&
        !n.row &&
        !n.actor &&
        (!n.isSVG || n.frame?.tagName === "rect")
      ) {
        const b = screen(r);
        overlay.append(
          make("rect", {
            x: b.x + b.w - 5,
            y: b.y + b.h - 5,
            width: 10,
            height: 10,
            fill: "#fff",
            stroke: "#2563eb",
            "stroke-width": 2,
            "data-resize": id,
          }),
        );
      }
    }
    if (selectedEdge) {
      const e = d.edgeGeometry.get(selectedEdge);
      if (e?.label)
        rect(e.label, {
          stroke: "#2563eb",
          fill: "#2563eb08",
          "data-hit": `label:${selectedEdge}`,
        });
      for (const [i, point] of bends().entries()) {
        const p = screen({ ...point, w: 0, h: 0 }),
          active = highlightedBend === i,
          handle = make("g", {
            "data-hit": `bend:${i + 1}`,
            "data-bend-number": i + 1,
          });
        handle.append(
          make("circle", {
            cx: p.x,
            cy: p.y,
            r: 11,
            fill: active ? "#2563eb" : "#fff",
            stroke: "#2563eb",
            "stroke-width": active ? 3 : 2,
          }),
        );
        const number = make("text", {
          x: p.x,
          y: p.y,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          fill: active ? "#fff" : "#1d4ed8",
        });
        number.textContent = i + 1;
        handle.append(number);
        overlay.append(handle);
      }
    }
  }
  function button(text, fn, attrs = {}) {
    const b = document.createElement("button");
    b.textContent = text;
    b.dataset.focusKey = attrs["aria-label"] || text;
    for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
    b.addEventListener("click", fn);
    return b;
  }
  function heading(text) {
    const h = document.createElement("h3");
    h.textContent = text;
    panelBody.append(h);
  }
  function fields(items) {
    const container = document.createElement("div");
    container.className = "fields";
    for (const item of items) {
      const label = document.createElement("label");
      label.textContent = item.label;
      const input = document.createElement(item.options ? "select" : "input");
      if (item.options)
        for (const [value, text] of item.options) {
          const o = document.createElement("option");
          o.value = value;
          o.textContent = text;
          input.append(o);
        }
      else {
        input.type = "number";
        input.step = "1";
      }
      const update = () => {
        input.value = item.value();
      };
      update();
      fieldUpdates.push(() => {
        if (shadow.activeElement !== input) update();
      });
      input.setAttribute("aria-label", item.label);
      input.disabled = !!item.disabled;
      input.addEventListener("change", () => {
        // A blur can commit this field between pointerdown and click on a list
        // item. Keep that click target mounted until its selection is handled.
        changingField = true;
        try {
          item.onChange(item.options ? input.value : Number(input.value));
          update();
        } finally {
          changingField = false;
        }
      });
      label.append(input);
      container.append(label);
    }
    panelBody.append(container);
  }
  function renderBends() {
    const list = panel.querySelector(".bends");
    if (!list || !selectedEdge) return;
    list.replaceChildren();
    const id = selectedEdge,
      points = bends(id);
    for (const [i, p] of points.entries()) {
      const chip = document.createElement("div");
      chip.className = "bend";
      const highlight = () => {
        highlightedBend = i;
        renderOverlay();
      };
      chip.addEventListener("pointerenter", highlight);
      chip.addEventListener("focusin", highlight);
      chip.append(
        button(
          String(i + 1),
          () => {
            highlight();
            view.scrollTo({
              left: Math.max(0, p.x * zoom - (innerWidth - 360) / 2),
              top: Math.max(0, p.y * zoom - (innerHeight - 160) / 2),
            });
            renderOverlay();
          },
          { "aria-label": `定位折点 ${i + 1}`, title: `定位折点 ${i + 1}` },
        ),
        button("×", () => removeBend(id, i), {
          "aria-label": `删除折点 ${i + 1}`,
          title: `删除折点 ${i + 1}`,
          class: "remove-bend",
          "data-remove-bend": i,
        }),
      );
      list.append(chip);
    }
    if (!points.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "没有可删除的折点。";
      list.append(empty);
    }
  }
  function renderPanel() {
    // Do not replace focused inputs during observer-driven geometry updates.
    if (
      changingField ||
      (shadow.activeElement?.matches("input,select") &&
      panel.contains(shadow.activeElement))
    ) {
      // Port edits can change automatic corners while the select keeps focus.
      // Refresh their controls without replacing the active input.
      fieldUpdates.forEach((update) => update());
      renderBends();
      return;
    }
    const selectionChanged = resetInspectorScroll;
    const navigationScroll = panel.querySelector(".navigator-scroll")?.scrollTop || 0;
    const inspectorScroll = resetInspectorScroll ? 0 : panel.querySelector(".inspector")?.scrollTop || 0;
    const focusKey = shadow.activeElement?.dataset.focusKey;
    panel.replaceChildren();
    fieldUpdates = [];
    if (!editing) return;
    const header = document.createElement("header");
    header.className = "panel-header";
    header.innerHTML = '<h2>布局属性</h2><span class="muted">拖动或输入数值微调</span><span class="panel-status" role="status"></span>';
    panel.append(header);
    const inspector = document.createElement("div");
    inspector.className = "inspector";
    inspector.setAttribute("aria-label", "当前布局属性");
    panel.append(inspector);
    panelBody = inspector;
    const one = selection.length === 1 ? d.nodes.get(selection[0]) : null;
    const clean = (text) => (text || "").replace(/\s+/g, " ").trim();
    const nodeName = (n) => clean(n.el.getAttribute("data-diagram-title")) || clean(n.el.querySelector("h1,h2,h3,h4,h5,h6,title")?.textContent) || n.id;
    const title = document.createElement("p");
    title.className = "selection-title";
    title.textContent = selectedEdge ? "连线与标签" : one ? nodeName(one) : selection.length ? `已选 ${selection.length} 个对象` : "画布设置";
    inspector.append(title);
    const meta = document.createElement("p");
    meta.className = selection.length || selectedEdge ? "selection-meta" : "empty-selection";
    meta.textContent = selectedEdge
      ? (() => { const edge = d.config.edges.find(e => e.id === selectedEdge); return `${edge.from} ${edge.arrow === false ? "—" : "→"} ${edge.to} · ${selectedEdge}`; })()
      : one ? `${one.group ? "分组" : one.row ? "消息行" : one.actor ? "参与者" : "节点"} · ${one.id}`
      : selection.length ? "Shift 点击增选，方向键移动" : "点击图中对象，或从下方列表选择以调整位置与连线。";
    inspector.append(meta);
    if (one) {
      fields([
        {
          label: "水平位移",
          value: () => Math.round(d.state.nodes[one.id]?.dx || 0),
          disabled: one.locked || one.row,
          onChange: (v) =>
            d.change(() =>
              d.move([one.id], v - (d.state.nodes[one.id]?.dx || 0), 0),
            ),
        },
        {
          label: "垂直位移",
          value: () => Math.round(d.state.nodes[one.id]?.dy || 0),
          disabled: one.locked || one.actor,
          onChange: (v) =>
            d.change(() =>
              d.move([one.id], 0, v - (d.state.nodes[one.id]?.dy || 0)),
            ),
        },
        {
          label: "宽度",
          value: () => Math.round(d.box(one.shell).w),
          disabled:
            one.locked || one.actor || one.row || (one.isSVG && !one.frame),
          onChange: (v) =>
            d.change(() => d.resize(one.id, v, d.box(one.shell).h)),
        },
        {
          label: "高度",
          value: () => Math.round(d.box(one.shell).h),
          disabled:
            one.locked || one.actor || one.row || (one.isSVG && !one.frame),
          onChange: (v) =>
            d.change(() => d.resize(one.id, d.box(one.shell).w, v)),
        },
      ]);
    }
    if (selection.length > 1) {
      const actions = document.createElement("div");
      actions.className = "actions";
      for (const [name, type] of [
        ["左对齐", "left"],
        ["顶对齐", "top"],
        ["水平等距", "horizontal"],
        ["垂直等距", "vertical"],
      ])
        actions.append(button(name, () => arrange(type)));
      panelBody.append(actions);
    }
    if (selectedEdge) {
      const edge = d.config.edges.find((e) => e.id === selectedEdge);
      const ports = [
        ["left", "左侧"],
        ["right", "右侧"],
        ["top", "顶部"],
        ["bottom", "底部"],
      ];
      if (edge.kind !== "sequence")
        fields(
          ["fromPort", "toPort"].map((key, i) => ({
            label: i ? "终点端口" : "起点端口",
            value: () => d.edgeSpec(edge)[key]?.side || (i ? "left" : "right"),
            options: ports,
            onChange: (v) =>
              d.change(() => {
                (d.state.edges[edge.id] ||= {})[key] = {
                  side: v,
                  at: d.edgeSpec(edge)[key]?.at ?? 0.5,
                };
              }),
          })),
        );
      if (edge.kind !== "sequence")
        fields(
          ["fromPort", "toPort"].map((key, i) => ({
            label: i ? "终点比例 %" : "起点比例 %",
            value: () => (d.edgeSpec(edge)[key]?.at ?? 0.5) * 100,
            onChange: (v) =>
              d.change(() => {
                (d.state.edges[edge.id] ||= {})[key] = {
                  side: d.edgeSpec(edge)[key]?.side || (i ? "left" : "right"),
                  at: Math.max(0, Math.min(100, v)) / 100,
                };
              }),
          })),
        );
      if (d.labels.has(selectedEdge))
        fields(
          ["dx", "dy"].map((k, i) => ({
            label: i ? "标签上下偏移" : "标签左右偏移",
            value: () => Math.round(d.state.edges[edge.id]?.label?.[k] || 0),
            onChange: (v) =>
              d.change(() => {
                const e = (d.state.edges[edge.id] ||= {});
                (e.label ||= {})[k] = v;
              }),
          })),
        );
      const actions = document.createElement("div");
      actions.className = "actions";
      if (!["sequence", "straight"].includes(edge.kind)) {
        heading("折点 · 从起点依次编号");
        const list = document.createElement("div");
        list.className = "bends";
        panelBody.append(list);
        renderBends();
        actions.append(
          button(
            "增加折点",
            () =>
              d.change(() => {
                const route = d.edgeGeometry.get(selectedEdge).points,
                  ps = [route[0], ...bends(), route.at(-1)];
                const mid = Math.floor(ps.length / 2),
                  a = ps[mid - 1],
                  b = ps[mid];
                const pts = ps.slice(1, -1);
                pts.splice(Math.max(0, mid - 1), 0, {
                  x: (a.x + b.x) / 2,
                  y: (a.y + b.y) / 2,
                });
                setBends(selectedEdge, pts);
              }),
            { "data-add-bend": "" },
          ),
        );
        actions.append(
          button("恢复自动走线", () =>
            d.change(() => {
              // Empty pins also override any pins authored in diagram-config.
              if (edge.points?.length)
                (d.state.edges[selectedEdge] ||= {}).points = [];
              else delete (d.state.edges[selectedEdge] || {}).points;
            }),
          ),
        );
      }
      actions.append(
        button("恢复标签位置", () =>
          d.change(() => {
            delete (d.state.edges[selectedEdge] || {}).label;
          }),
        ),
      );
      panelBody.append(actions);
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent =
        edge.kind === "sequence"
          ? "拖动标签。消息端点随参与者与消息行同步。"
          : edge.kind === "straight"
            ? "直线由两个端点决定。移动节点或调整端口改变路径，标签可单独拖动。"
            : "拖动编号折点；点击右侧编号定位，× 删除对应折点。自动补齐正交连接，端点始终绑定原对象。";
      panelBody.append(note);
    }
    const canvas = document.createElement("details");
    canvas.className = "canvas-settings";
    canvas.open = canvasExpanded;
    const summary = document.createElement("summary");
    summary.textContent = "主体与画布";
    summary.dataset.focusKey = "canvas-settings";
    canvas.append(summary);
    canvas.addEventListener("toggle", () => { if (canvas.isConnected) canvasExpanded = canvas.open; });
    inspector.append(canvas);
    const bodyControls = document.createElement("div");
    bodyControls.className = "body-controls";
    canvas.append(bodyControls);
    panelBody = bodyControls;
    fields([
      {
        label: "主体顶部间距",
        value: () =>
          Math.round(
            d.baseContentTop +
              d.state.bodyOffset -
              (d.header ? bottom(d.box(d.header)) : 0),
          ),
        onChange: (v) =>
          d.change(() => {
            d.state.bodyOffset =
              (d.header ? bottom(d.box(d.header)) : 0) + v - d.baseContentTop;
          }),
      },
    ]);
    panelBody.append(
      button("整体下移 24px", () =>
        d.change(() => {
          d.state.bodyOffset += 24;
        }),
      ),
    );
    const diagnostics = document.createElement("div");
    diagnostics.className = "diagnostics";
    inspector.append(diagnostics);
    panelBody = diagnostics;
    heading(`布局提示 · ${d.issues?.length || 0}`);
    const issues = document.createElement("div");
    issues.className = "list issues";
    const labels = {
      "move-node": "移动节点",
      "resize-node": "调整节点尺寸",
      "move-label": "调整标签",
      "edit-ports": "调整端口",
      "edit-bends": "调整折点",
      "reset-route": "恢复自动走线",
      "grow-canvas": "扩大画布",
      "move-body": "整体下移主体",
      "move-row": "调整消息行",
    };
    for (const severity of ["error", "warning"]) {
      const group = (d.issues || []).filter(
        (i) => (i.severity || "error") === severity,
      );
      if (!group.length) continue;
      const title = document.createElement("h3");
      title.textContent = `${severity === "error" ? "错误" : "提示"} · ${group.length}`;
      issues.append(title);
      for (const issue of group) {
        issues.append(
          button(
            `${issue.id} · ${issue.message}`,
            () => {
              choose(
                d.nodes.has(issue.id) ? [issue.id] : [],
                d.nodes.has(issue.id) ? null : issue.id,
              );
              issueRegions = [
                issue.evidence?.region,
                ...(issue.evidence?.related || []).map((x) => x.region),
              ].filter(Boolean);
              if (!issueRegions.length) {
                const n = d.nodes.get(issue.id),
                  edge = d.edgeGeometry.get(issue.id);
                if (n) issueRegions.push(d.box(n.shell));
                else if (edge?.label) issueRegions.push(edge.label);
              }
              const r = issueRegions[0];
              if (r)
                view.scrollTo({
                  left: Math.max(0, r.x * zoom - 100),
                  top: Math.max(0, r.y * zoom - 160),
                  behavior: "instant",
                });
              renderOverlay();
            },
            { class: severity },
          ),
        );
        const help = document.createElement("p");
        help.className = "issue-detail";
        const evidence = issue.evidence || {};
        const measured = [
          typeof evidence.distance === "number"
            ? `间距 ${evidence.distance.toFixed(2)}px`
            : "",
          typeof evidence.length === "number"
            ? `连续长度 ${evidence.length.toFixed(2)}px`
            : "",
        ]
          .filter(Boolean)
          .join(" · ");
        help.textContent = `${issue.code || issue.type}${measured ? ` · ${measured}` : ""} · ${(issue.supportedFixes || []).map((fix) => labels[fix] || fix).join("、")}`;
        issues.append(help);
      }
    }
    if (!d.issues?.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "未发现几何冲突。仍需核对内容与关系。";
      issues.append(p);
    }
    diagnostics.append(issues);
    const navigator = document.createElement("div");
    navigator.className = "navigator";
    navigator.innerHTML = '<div class="navigator-header"><h3>对象与连线</h3><span class="muted">Shift 多选对象</span></div>';
    const navigation = document.createElement("div");
    navigation.className = "navigator-scroll";
    navigation.setAttribute("aria-label", "对象与连线列表");
    navigator.append(navigation);
    panel.append(navigator);
    panelBody = navigation;
    heading(`对象 · ${d.nodes.size}`);
    const list = document.createElement("div");
    list.className = "list";
    for (const n of d.nodes.values()) {
      const prefix = n.group ? "▣ " : n.row ? "↔ " : n.actor ? "│ " : "";
      const item = button(
        nodeName(n),
        (e) => choose(e.shiftKey ? [...new Set([...selection, n.id])] : [n.id]),
        { "aria-label": prefix + n.id, "aria-pressed": String(selection.includes(n.id)), title: `${nodeName(n)} · ${n.id}` },
      );
      const label = document.createElement("span");
      label.className = "object-name";
      label.textContent = prefix + nodeName(n);
      const id = document.createElement("span");
      id.className = "object-id";
      id.textContent = n.id === nodeName(n) ? "" : n.id;
      item.replaceChildren(label, id);
      list.append(item);
    }
    navigation.append(list);
    heading(`连线 · ${d.config.edges.length}`);
    const edges = document.createElement("div");
    edges.className = "list";
    for (const e of d.config.edges) {
      const endpoints = `${e.from} ${e.arrow === false ? "—" : "→"} ${e.to}`;
      const caption = clean(d.labels.get(e.id)?.el.textContent);
      const item = button(endpoints, () => choose([], e.id), {
        "aria-label": `连线 ${e.id}`,
        "aria-pressed": String(selectedEdge === e.id),
        class: "edge-item",
        title: `${caption ? caption + " · " : ""}${endpoints} · ${e.id}`,
      });
      const label = document.createElement("span");
      label.className = "object-name";
      label.textContent = caption || endpoints;
      const id = document.createElement("span");
      id.className = "object-id";
      id.textContent = `${caption ? endpoints + " · " : ""}${e.id}`;
      item.replaceChildren(label, id);
      edges.append(item);
    }
    navigation.append(edges);
    navigation.scrollTop = navigationScroll;
    inspector.scrollTop = inspectorScroll;
    // A taller inspector must not push the newly selected list item out of view.
    if (selectionChanged) {
      const selected = [...navigation.querySelectorAll('[aria-pressed="true"]')].at(-1);
      if (selected) {
        const item = selected.getBoundingClientRect(), frame = navigation.getBoundingClientRect();
        if (item.bottom > frame.bottom) navigation.scrollTop += item.bottom - frame.bottom + 6;
        else if (item.top < frame.top) navigation.scrollTop += item.top - frame.top - 6;
      }
    }
    resetInspectorScroll = false;
    if (focusKey) {
      const target = [...panel.querySelectorAll("[data-focus-key]")].find(el => el.dataset.focusKey === focusKey);
      target?.focus({ preventScroll: true });
    }
  }
  function render() {
    host.toggleAttribute("editing", editing);
    panel.hidden = !editing;
    $('[data-action="find"]').hidden = editing;
    $('[data-action="edit"]').textContent = editing ? "完成编辑" : "编辑布局";
    $('[data-action="undo"]').disabled = !d.history.length;
    $('[data-action="redo"]').disabled = !d.future.length;
    stage.style.width = `${d.root.offsetWidth * zoom}px`;
    stage.style.height = `${d.root.offsetHeight * zoom}px`;
    renderOverlay();
    renderPanel();
    renderStatus();
  }
  function arrange(type) {
    d.change(() => {
      const ids = d
          .outerSelection(selection)
          .filter((id) => !d.nodes.get(id).locked),
        items = ids.map((id) => ({ id, r: d.box(d.nodes.get(id).shell) }));
      if (items.length < 2) return;
      if (type === "left" || type === "top") {
        const target = Math.min(
          ...items.map((x) => x.r[type === "left" ? "x" : "y"]),
        );
        for (const { id, r } of items)
          d.move(
            [id],
            type === "left" ? target - r.x : 0,
            type === "top" ? target - r.y : 0,
          );
        return;
      }
      const horizontal = type === "horizontal",
        pos = horizontal ? "x" : "y",
        size = horizontal ? "w" : "h";
      items.sort((a, b) => a.r[pos] - b.r[pos]);
      if (items.length < 3) return;
      const gap =
        (items.at(-1).r[pos] +
          items.at(-1).r[size] -
          items[0].r[pos] -
          items.reduce((n, i) => n + i.r[size], 0)) /
        (items.length - 1);
      let at = items[0].r[pos];
      for (const { id, r } of items) {
        d.move([id], horizontal ? at - r.x : 0, horizontal ? 0 : at - r.y);
        at += r[size] + gap;
      }
    });
  }
  function begin(e, kind, data) {
    if (e.button !== 0) return;
    e.preventDefault();
    if (kind === "pan") fitted = false;
    drag = {
      kind,
      data,
      start: d.point(e.clientX, e.clientY),
      client: { x: e.clientX, y: e.clientY },
      before: d.snapshot(),
      boxes:
        kind === "nodes"
          ? new Map([...d.nodes].map(([id, n]) => [id, d.box(n.shell)]))
          : null,
      scroll: { x: view.scrollLeft, y: view.scrollTop },
    };
  }
  d.root.addEventListener("pointerdown", (e) => {
    if (space) {
      begin(e, "pan", null);
      return;
    }
    if (!editing) return;
    const label = e.target.closest("[data-diagram-label]");
    if (label) {
      choose([], label.dataset.diagramLabel);
      begin(e, "label", selectedEdge);
      return;
    }
    let el = e.target.closest("[data-diagram-shell]");
    if (e.altKey && el)
      el = el.parentElement.closest("[data-diagram-shell]") || el;
    if (!el) {
      choose([]);
      return;
    }
    const id = el.dataset.diagramShell;
    if (e.shiftKey)
      choose(
        selection.includes(id)
          ? selection.filter((x) => x !== id)
          : [...selection, id],
      );
    else if (!selection.includes(id)) choose([id]);
    begin(e, "nodes", selection);
  });
  overlay.addEventListener("pointerdown", (e) => {
    if (!editing) return;
    const target = e.target.closest("[data-resize],[data-hit],[data-edge-hit]"),
      resize = target?.dataset.resize,
      hit = target?.dataset.hit,
      edge = target?.dataset.edgeHit;
    if (resize) {
      choose([resize]);
      begin(e, "resize", { id: resize, box: d.box(d.nodes.get(resize).shell) });
    } else if (hit?.startsWith("label:")) begin(e, "label", selectedEdge);
    else if (hit?.startsWith("bend:")) {
      const route = d.edgeGeometry.get(selectedEdge).points;
      highlightedBend = Number(hit.split(":")[1]) - 1;
      begin(e, "bend", {
        id: selectedEdge,
        index: Number(hit.split(":")[1]),
        points: [route[0], ...bends(), route.at(-1)],
      });
    } else if (edge) choose([], edge);
  });
  view.addEventListener("pointerdown", (e) => {
    if (space && !drag) begin(e, "pan", null);
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const now = d.point(e.clientX, e.clientY),
      dx = now.x - drag.start.x,
      dy = now.y - drag.start.y;
    if (drag.kind === "pan") {
      view.scrollLeft = drag.scroll.x - e.clientX + drag.client.x;
      view.scrollTop = drag.scroll.y - e.clientY + drag.client.y;
      return;
    }
    d.state = JSON.parse(drag.before);
    if (drag.kind === "nodes") d.move(drag.data, dx, dy, drag.boxes);
    if (drag.kind === "resize")
      d.resize(drag.data.id, drag.data.box.w + dx, drag.data.box.h + dy);
    if (drag.kind === "label") {
      const s = (d.state.edges[drag.data] ||= {}),
        l = s.label || {};
      s.label = { dx: (l.dx || 0) + dx, dy: (l.dy || 0) + dy };
      d.apply();
    }
    if (drag.kind === "bend") {
      const ps = structuredClone(drag.data.points),
        i = drag.data.index,
        old = ps[i];
      ps[i] = { x: old.x + dx, y: old.y + dy };
      // Move the adjacent bend along its axis to keep the two interior segments orthogonal.
      if (i > 1) {
        if (ps[i - 1].x === old.x) ps[i - 1].x += dx;
        else if (ps[i - 1].y === old.y) ps[i - 1].y += dy;
      }
      if (i < ps.length - 2) {
        if (ps[i + 1].x === old.x) ps[i + 1].x += dx;
        else if (ps[i + 1].y === old.y) ps[i + 1].y += dy;
      }
      setBends(drag.data.id, ps.slice(1, -1));
      d.apply();
    }
  });
  const finish = () => {
    if (!drag) return;
    if (drag.kind !== "pan") d.record(drag.before);
    drag = null;
    render();
  };
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  window.addEventListener("keydown", (e) => {
    if (
      shadow.activeElement?.matches("input,select") ||
      e.target.matches("input,textarea,select,[contenteditable]")
    )
      return;
    if (e.code === "Space") {
      space = true;
      if (!shadow.activeElement?.matches("button,summary")) e.preventDefault();
    }
    if (!editing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? d.redo() : d.undo();
      return;
    }
    if (e.key === "Escape") {
      choose([]);
      return;
    }
    const delta = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key];
    if (delta && selection.length && !shadow.activeElement?.matches("summary")) {
      e.preventDefault();
      d.change(() =>
        d.move(
          selection,
          delta[0] * (e.shiftKey ? 10 : 1),
          delta[1] * (e.shiftKey ? 10 : 1),
        ),
      );
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") space = false;
  });
  window.addEventListener("blur", () => {
    space = false;
    finish();
  });
  shadow.addEventListener("click", async (e) => {
    const trigger = e.target.closest("[data-action]"),
      action = trigger?.dataset.action;
    if (!action) return;
    if (action === "edit") {
      reader?.close(false);
      editing = !editing;
      choose([]);
      render();
      if (fitted) fit();
      else availableSpace();
    }
    if (action === "undo") d.undo();
    if (action === "redo") d.redo();
    if (action === "fit") fit();
    if (action === "in") setZoom(zoom * 1.2);
    if (action === "out") setZoom(zoom / 1.2);
    if (action === "save") {
      d.save();
      toast("已下载可编辑 HTML；重新打开该文件可继续调整。");
    }
    if (action === "png" && !busy) {
      busy = true;
      trigger.disabled = true;
      try {
        const blob = await d.exportPNG(
          Number($('select[aria-label="PNG 导出倍率"]').value),
        );
        d.download(blob, `${d.config.name || "diagram"}.png`);
        toast("完整画布 PNG 已导出。");
      } catch (error) {
        toast(error.message);
      } finally {
        busy = false;
        trigger.disabled = false;
      }
    }
  });
  view.addEventListener("scroll", renderOverlay);
  const resizeView = () => {
    if (fitted) fit();
    else availableSpace();
    renderOverlay();
    reader?.draw();
  };
  window.addEventListener("resize", resizeView);
  new ResizeObserver(resizeView).observe($(".bar"));
  d.onChange(render);
  reader = mountReader(d, {
    shadow,
    view,
    active: () => !editing,
    screen,
    zoom: () => zoom,
  });
  fit();
  render();
  return { host, view, fit, setZoom, choose };
}
