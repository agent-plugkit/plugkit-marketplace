const clean = (text) => (text || "").replace(/\s+/g, " ").trim();

// Reader state and overlays live outside the artwork and never enter layout history.
export function mountReader(d, { shadow, view, active, screen, zoom }) {
  const trigger = shadow.querySelector('[data-action="find"]');
  const panel = document.createElement("section");
  panel.className = "panel reader";
  panel.setAttribute("aria-label", "查找节点与关系");
  panel.hidden = true;
  panel.innerHTML = `<div class="reader-heading"><h2>查找节点</h2><button aria-label="关闭节点查找" data-reader-close>关闭</button></div>
    <input type="search" aria-label="搜索节点" placeholder="名称、ID 或正文" autocomplete="off">
    <div class="reader-count muted" role="status"></div><div class="reader-results list"></div><div class="reader-detail"></div>`;
  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlay.setAttribute("class", "overlay reader-overlay");
  overlay.setAttribute("aria-hidden", "true");
  shadow.append(overlay, panel);
  const input = panel.querySelector("input"),
    results = panel.querySelector(".reader-results"),
    detail = panel.querySelector(".reader-detail");
  let focused = null,
    origin = trigger,
    pointer = null;
  const nodes = [...d.nodes.values()].filter((n) => !n.group && !n.row);
  const name = (n) =>
    clean(n.el.getAttribute("data-diagram-title")) ||
    clean(n.el.querySelector("h1,h2,h3,h4,h5,h6,title")?.textContent) ||
    clean(n.el.textContent) ||
    n.id;
  const text = (parent, tag, value, className) => {
    const el = document.createElement(tag);
    el.textContent = value;
    if (className) el.className = className;
    parent.append(el);
    return el;
  };
  const button = (parent, value, action) => {
    const el = text(parent, "button", value);
    el.type = "button";
    el.addEventListener("click", action);
    return el;
  };
  function show() {
    if (!active()) return;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    view.style.paddingRight = `${panel.getBoundingClientRect().width + 52}px`;
  }
  function close(restore = true) {
    const wasOpen = !panel.hidden;
    focused = null;
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    overlay.replaceChildren();
    view.style.paddingRight = "32px";
    if (restore && wasOpen)
      (origin?.isConnected ? origin : trigger).focus({ preventScroll: true });
  }
  function locate(n) {
    const r = d.box(n.shell),
      z = zoom(),
      width = Math.max(
        80,
        view.clientWidth - panel.getBoundingClientRect().width - 84,
      );
    view.scrollTo({
      left: Math.max(0, (r.x + r.w / 2) * z + 32 - width / 2),
      top: Math.max(0, (r.y + r.h / 2) * z + 88 - view.clientHeight / 2),
      behavior: "instant",
    });
  }
  function draw() {
    overlay.replaceChildren();
    if (panel.hidden || !focused || !active()) return;
    const relations = d.config.edges.filter(
      (e) => e.from === focused || e.to === focused,
    );
    const ids = new Set([focused, ...relations.flatMap((e) => [e.from, e.to])]);
    const svg = (tag, attrs) => {
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      overlay.append(el);
    };
    for (const e of relations) {
      const geometry = d.edgeGeometry.get(e.id);
      if (!geometry) continue;
      const points = geometry.points.map((p) => screen({ ...p, w: 0, h: 0 }));
      svg("path", {
        d: points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
        fill: "none",
        stroke: "#2563eb",
        "stroke-width": 5,
        "stroke-opacity": 0.35,
      });
    }
    for (const id of ids) {
      const n = d.nodes.get(id);
      if (!n) continue;
      const r = screen(d.box(n.shell));
      svg("rect", {
        x: r.x - 3,
        y: r.y - 3,
        width: r.w + 6,
        height: r.h + 6,
        rx: 4,
        fill: "none",
        stroke: "#2563eb",
        "stroke-width": id === focused ? 3 : 1.5,
        "stroke-dasharray": id === focused ? "none" : "5 4",
      });
    }
  }
  function select(id) {
    const n = nodes.find((n) => n.id === id);
    if (!n || !active()) return;
    focused = id;
    show();
    detail.replaceChildren();
    const title = text(detail, "h3", name(n));
    title.title = name(n);
    text(detail, "p", n.id, "muted");
    const related = d.config.edges.filter((e) => e.from === id || e.to === id);
    for (const [label, filter] of [
      ["自循环", (e) => e.from === id && e.to === id],
      ["入边", (e) => e.to === id && e.from !== id && e.arrow !== false],
      ["出边", (e) => e.from === id && e.to !== id && e.arrow !== false],
      ["无箭头关联", (e) => e.arrow === false && e.from !== e.to],
    ]) {
      const edges = related.filter(filter);
      if (!edges.length) continue;
      text(detail, "h3", `${label} · ${edges.length}`);
      const list = text(detail, "div", "", "list");
      for (const edge of edges) {
        const otherId = edge.from === id ? edge.to : edge.from;
        const endpoint = (id) => {
          const node = d.nodes.get(id);
          return node ? `${name(node)} [${id}]` : id;
        };
        const caption =
          clean(d.labels.get(edge.id)?.el.textContent) || "未标注关系";
        const link = button(
          list,
          `${caption} · ${endpoint(edge.from)} ${edge.arrow === false ? "—" : "→"} ${endpoint(edge.to)} · ${edge.id}`,
          () => select(otherId),
        );
        link.title = link.textContent;
        link.disabled = !nodes.some((n) => n.id === otherId);
      }
    }
    if (!related.length) text(detail, "p", "此节点没有声明的关系。", "muted");
    for (const button of results.querySelectorAll("button"))
      button.setAttribute("aria-pressed", String(button.dataset.nodeId === id));
    locate(n);
    draw();
  }
  function search() {
    const query = clean(input.value).toLocaleLowerCase();
    const matches = nodes.filter((n) =>
      `${n.id} ${name(n)} ${clean(n.el.textContent)}`
        .toLocaleLowerCase()
        .includes(query),
    );
    results.replaceChildren();
    panel.querySelector(".reader-count").textContent = matches.length
      ? `${matches.length} 个节点`
      : "没有匹配的节点";
    for (const n of matches) {
      const el = button(results, `${name(n)} · ${n.id}`, () => select(n.id));
      el.dataset.nodeId = n.id;
      el.title = el.textContent;
      el.setAttribute("aria-pressed", String(focused === n.id));
    }
  }
  function open() {
    if (!active()) return;
    origin = shadow.activeElement || trigger;
    show();
    search();
    input.focus();
    input.select();
  }
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", open);
  panel
    .querySelector("[data-reader-close]")
    .addEventListener("click", () => close());
  input.addEventListener("input", search);
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    const list = [...results.querySelectorAll("button")];
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key) || !list.length)
      return;
    const focusedElement = shadow.activeElement;
    if (focusedElement !== input && !list.includes(focusedElement)) return;
    if (e.key === "Enter") {
      if (focusedElement === input) {
        e.preventDefault();
        list[0].click();
        list[0].focus();
      }
      return;
    }
    e.preventDefault();
    const index = list.indexOf(focusedElement);
    list[
      (index + (e.key === "ArrowDown" ? 1 : list.length - 1) + list.length) %
        list.length
    ].focus();
  });
  window.addEventListener("keydown", (e) => {
    if (!active() || e.defaultPrevented) return;
    if (e.key === "Escape" && !panel.hidden) {
      close();
      return;
    }
    const target = e.composedPath()[0];
    if (
      target?.closest?.("input,textarea,select,[contenteditable]") ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (e.key === "/") {
      e.preventDefault();
      open();
    }
  });
  d.root.addEventListener("pointerdown", (e) => {
    pointer = { x: e.clientX, y: e.clientY };
  });
  d.root.addEventListener("click", (e) => {
    if (
      !active() ||
      e.defaultPrevented ||
      (pointer && Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 4)
    )
      return;
    if (e.target.closest("a,button,input,textarea,select,[contenteditable]"))
      return;
    const el = e.target.closest("[data-diagram-node]");
    if (el) {
      origin = trigger;
      search();
      select(el.dataset.diagramNode);
    } else close(false);
  });
  view.addEventListener("scroll", draw);
  window.addEventListener("resize", () => {
    if (!panel.hidden) {
      show();
      if (focused) locate(d.nodes.get(focused));
      draw();
    }
  });
  d.onChange(draw);
  return { close, draw, isOpen: () => !panel.hidden };
}
