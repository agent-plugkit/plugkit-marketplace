/*
 * Musekit 网点模块：把墨量场渲染成一块网点印版。
 *
 * 用法：把本文件复制进作品目录，用 <script src="halftone.js"></script> 引入（经典脚本，
 * file:// 下也能运行），得到全局对象 MusekitHalftone。没有依赖，不访问网络。
 *
 * 参数与 halftone-plate Seed 的 token 一一对应：
 *   cell      ← halftone-cell（px）
 *   angle     ← halftone-angle（主版）或 halftone-angle-accent（副版），单位为度
 *   drift     ← ink-drift：浓淡起伏幅度，0.08 表示墨量在 ±8% 内起伏
 *   dryBreak  ← dry-break：边缘圆点断开的比例，0.02 表示约 2% 的边缘圆点缺失
 *   offset    ← registration-offset：只给副版，[x, y]，向右下为正
 *
 * 墨量场是函数 (x, y) => 0..1，0 是纸，1 是满墨，坐标为 CSS 像素。题材（剪影、几何形、
 * 声波）由调用方画在离屏画布上，再用 fieldFromImage 转成墨量场；也可以直接写函数。
 *
 * 照片：file:// 打开的页面里，<img> 读取的本地图片会污染画布，getImageData 会抛出
 * SecurityError。照片请转成 data URL 引入，或者经本地服务器打开页面。
 */
(function (root) {
  'use strict';

  // 32 位整数哈希：按格子坐标取随机数，结果与遍历顺序无关。
  function hash(i, j, seed, salt) {
    let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul((seed | 0) + salt, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // 低频值噪声，取值在 [-1, 1]，用于大面积墨色的浓淡起伏。
  function valueNoise(seed, scale) {
    const at = (i, j) => hash(i, j, seed, 1) * 2 - 1;
    const smooth = (t) => t * t * (3 - 2 * t);
    return function (x, y) {
      x /= scale;
      y /= scale;
      const xi = Math.floor(x), yi = Math.floor(y);
      const u = smooth(x - xi), v = smooth(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const EDGE = 0.35; // 相邻格子墨量差超过它，就算边缘

  /**
   * 计算一块印版的圆点，返回 [[x, y, r], ...]。纯函数：同样的输入和 seed 得到同样的输出。
   * opts: { width, height, cell, angle, field, drift = 0, dryBreak = 0, seed = 1 }
   * 网屏原点固定在画布中心；圆点面积与墨量成正比，墨量 1 时一个圆点的面积等于一格。
   */
  function dots(opts) {
    const W = opts.width, H = opts.height, c = opts.cell, field = opts.field;
    const drift = opts.drift || 0, dryBreak = opts.dryBreak || 0, seed = opts.seed == null ? 1 : opts.seed;
    const a = ((opts.angle || 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const low = valueNoise(seed, Math.max(c * 20, 1));
    const n = Math.ceil(Math.hypot(W, H) / 2 / c) + 1;
    const at = (i, j) => [W / 2 + i * c * ca - j * c * sa, H / 2 + i * c * sa + j * c * ca];
    const out = [];
    for (let j = -n; j <= n; j++) {
      for (let i = -n; i <= n; i++) {
        const [x, y] = at(i, j);
        if (x < -c || x > W + c || y < -c || y > H + c) continue;
        let d = clamp01(field(x, y));
        if (d <= 0) continue;
        if (dryBreak > 0 && hash(i, j, seed, 2) < dryBreak) {
          const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => {
            const [nx, ny] = at(i + di, j + dj);
            return Math.abs(d - clamp01(field(nx, ny))) > EDGE;
          });
          if (edge) continue;
        }
        if (drift > 0) d = clamp01(d * (1 + drift * (0.7 * low(x, y) + 0.3 * (hash(i, j, seed, 3) * 2 - 1))));
        const r = c * Math.sqrt(d / Math.PI);
        if (r >= 0.25) out.push([x, y, r]);
      }
    }
    return out;
  }

  /**
   * 把圆点画到画布上。画布按 width × height（CSS 像素）和 dpr 设定尺寸。
   * opts: { width, height, dpr = 1, color = '#000', offset = [0, 0] }
   * 页面用 mix-blend-mode: multiply 把各版叠在纸色上；导出海报时按同样顺序合成。
   */
  function draw(canvas, list, opts) {
    const W = opts.width, H = opts.height, dpr = opts.dpr || 1, offset = opts.offset || [0, 0];
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (canvas.style) {
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, offset[0] * dpr, offset[1] * dpr);
    ctx.fillStyle = opts.color || '#000';
    ctx.beginPath();
    for (const [x, y, r] of list) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  /**
   * 把像素数据 { width, height, data }（RGBA）转成墨量场：越暗墨越多，透明处没有墨。
   * opts: { width, height, fit = 'cover' | 'contain', invert = false }
   * width、height 是印版尺寸；图像按 fit 缩放并居中。
   */
  function fieldFromPixels(img, opts) {
    const iw = img.width, ih = img.height, data = img.data;
    const s = (opts.fit === 'contain' ? Math.min : Math.max)(opts.width / iw, opts.height / ih);
    const ox = (opts.width - iw * s) / 2, oy = (opts.height - ih * s) / 2;
    const invert = !!opts.invert;
    return function (x, y) {
      const px = Math.floor((x - ox) / s), py = Math.floor((y - oy) / s);
      if (px < 0 || py < 0 || px >= iw || py >= ih) return 0;
      const k = (py * iw + px) * 4;
      // 整数加权，白色正好是 1、黑色正好是 0。
      const lum = (2126 * data[k] + 7152 * data[k + 1] + 722 * data[k + 2]) / 2550000;
      return (invert ? lum : 1 - lum) * (data[k + 3] / 255);
    };
  }

  /** 浏览器端：把图片或画布读成像素后交给 fieldFromPixels。opts 同上。 */
  function fieldFromImage(source, opts) {
    const iw = source.naturalWidth || source.width, ih = source.naturalHeight || source.height;
    const canvas = document.createElement('canvas');
    canvas.width = iw;
    canvas.height = ih;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
    return fieldFromPixels(ctx.getImageData(0, 0, iw, ih), opts);
  }

  root.MusekitHalftone = { dots, draw, fieldFromPixels, fieldFromImage };
})(typeof window !== 'undefined' ? window : globalThis);
