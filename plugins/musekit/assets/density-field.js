/*
 * Musekit 密度方块团：在方格上生成一团软边的密度字形方块，对应 density-field Seed。
 *
 * 用法：把本文件复制进作品目录，用带 src="density-field.js" 的 script 标签引入（经典脚本，
 * file:// 下也能运行），得到全局对象 MusekitDensityField。没有依赖，不访问网络。
 * 单文件交付时，可以把本文件全文原样放进页面的一个 script 标签里；文件里没有会提前
 * 结束标签的字样。
 *
 *   const cells = MusekitDensityField.cluster({ cols, rows, seed, cx, cy, rx, ry });
 *   MusekitDensityField.draw(canvas, { cols, rows, cells, colors: { core, edge, ink } });
 *
 * cluster 返回 cols × rows 的密度表（按行排列，0 是空格，1 最浓）。cx、cy 是团心所在的格，
 * rx、ry 是横竖半轴（格数）；轮廓按 seed 不规则起伏，团心浓，向外变稀，半轴之外还有零散的
 * 淡格。同一 seed 在任何页面里结果相同；一个画面里的几团用不同的 seed 和半轴，不要复制。
 *
 * draw 按格画：每格一块底色加一个等宽字形。colors 取 style.md 的 token：
 *   core ← --color-tile-ochre（密度大于 0.2 的格）
 *   edge ← --color-tile-ash（外围与零散的格）
 *   ink  ← --color-ink（字形）
 * cell 默认 10（与方格同距），font 默认 9px 的 IBM Plex Mono（等 document.fonts 加载后再画）。
 * 画布左上角要落在方格的格线上。trail 可选，是一串渐隐短划 [[列, 行, 长度, 不透明度], …]。
 * strength 可选，是强度系数，或者按格给系数的函数 (列, 行) => 0..1：直接排在方格上的文字
 * 下方那几行压到约 0.42，其余保持 1。
 *
 * bounds(cells, cols) 返回团的外包框 { left, top, right, bottom, count }，单位是格，right 与
 * bottom 不含；乘以格距、加上画布位置，就能和玻璃面板比面积。
 *
 * 网页里让团漂移：每隔一段时间把 cx（或 cy）挪一格重新 cluster 和 draw，方块始终落在格上；
 * reduced-motion 下只画一帧。海报画一帧静止画面。
 */
(function (root) {
  'use strict';

  const GLYPHS = ['.', "'", ':', 'o', 't', 'x', 's', '%', '$', 'S', '#', '@', '8'];

  // mulberry32：小而确定的随机数序列。
  function random(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 64 × 64 的平滑值噪声，取值在 [0, 1]。
  function noise(seed) {
    const r = random(seed), grid = [];
    for (let i = 0; i < 64 * 64; i++) grid.push(r());
    const at = (x, y) => grid[((y & 63) * 64) + (x & 63)];
    const ease = (t) => t * t * (3 - 2 * t);
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = ease(x - xi), yf = ease(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
  }

  function cluster(opts) {
    const { cols, rows, seed, cx, cy, rx, ry } = opts;
    const r = random(seed), wobble = noise(seed + 7), grain = noise(seed + 13);
    const phase = [r() * 6.28, r() * 6.28];
    const out = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry;
        const angle = Math.atan2(dy, dx);
        // 轮廓：两三道谐波加低频噪声，让软边不圆。
        const edge = 1 + 0.12 * Math.sin(2 * angle + phase[0]) + 0.07 * Math.sin(3 * angle + phase[1])
          + 0.12 * (wobble(i * 0.09, j * 0.09) - 0.5);
        const k = Math.hypot(dx, dy) / edge;
        let d = 0;
        if (k < 1) {
          const t = 1 - k;
          d = t * t * (3 - 2 * t);
          d = d * (0.82 + 0.36 * grain(i * 0.35, j * 0.35)) + (r() - 0.5) * 0.08;
        }
        // 边缘之外按概率撒零散的淡格。
        if (d < 0.04) d = (k < 1.25 && r() < 6 * 0.5 * (1.25 - k) * (1.25 - k)) ? (r() < 0.6 ? 0.02 : 0.09) : 0;
        out.push(Math.max(0, Math.min(1, d)));
      }
    }
    return out;
  }

  function glyph(v) {
    return GLYPHS[Math.min(GLYPHS.length - 1, Math.floor(v * GLYPHS.length))];
  }

  const round = (x) => Math.round(x * 1000) / 1000;

  // 一格的底色与字形强度：团心用 core 色，外围用 edge 色，都随密度变浓；strength 整体压淡。
  function tone(v, strength) {
    const k = strength === undefined ? 1 : strength;
    const core = v > 0.2;
    return {
      fill: core ? 'core' : 'edge',
      fillAlpha: round(k * (core ? Math.min(1, 0.42 + 0.8 * v) : 0.16 + 1.1 * v)),
      inkAlpha: round(k * Math.min(0.9, 0.38 + 0.55 * v)),
    };
  }

  function bounds(cells, cols) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, count = 0;
    cells.forEach((v, n) => {
      if (!v) return;
      const i = n % cols, j = Math.floor(n / cols);
      count++;
      left = Math.min(left, i); top = Math.min(top, j);
      right = Math.max(right, i + 1); bottom = Math.max(bottom, j + 1);
    });
    return count ? { left, top, right, bottom, count } : { left: 0, top: 0, right: 0, bottom: 0, count: 0 };
  }

  function draw(canvas, opts) {
    const { cols, rows, cells, colors } = opts;
    const cell = opts.cell || 10;
    const dpr = opts.dpr || root.devicePixelRatio || 1;
    const width = cols * cell, height = rows * cell;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, width, height);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = opts.font || '400 9px "IBM Plex Mono", monospace';
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v = cells[j * cols + i];
        if (!v) continue;
        const k = typeof opts.strength === 'function' ? opts.strength(i, j) : opts.strength;
        const t = tone(v, k), x = i * cell, y = j * cell;
        c.globalAlpha = t.fillAlpha;
        c.fillStyle = t.fill === 'core' ? colors.core : colors.edge;
        c.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        c.globalAlpha = t.inkAlpha;
        c.fillStyle = colors.ink;
        c.fillText(glyph(v), x + cell / 2, y + cell / 2 + 0.5);
      }
    }
    if (opts.trail) {
      c.fillStyle = colors.edge;
      for (const [i, j, length, alpha] of opts.trail) {
        c.globalAlpha = alpha;
        c.fillRect(i * cell, j * cell + cell / 2 - 0.5, length * cell, 1);
      }
    }
    c.globalAlpha = 1;
  }

  root.MusekitDensityField = { glyphs: GLYPHS, cluster, glyph, tone, bounds, draw };
})(typeof window !== 'undefined' ? window : globalThis);
