/* weave-pattern.js
 * 《经纬二重》H5 · 纹样与色谱引擎
 * 说明：全部几何形体与配色均由手写参数化算法生成（三角函数 + 伪随机分布），
 *       不使用任何 AI 生成素材、不依赖任何外部图片资源。
 * 数据契约：grid 为 W*H 的 Int8Array，值 -1 表示“地”（不落纬，露出经线），
 *           0..N-1 表示色区索引，映射至配色方案的 lines 数组。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NHPattern = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 46, H = 58;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function set(g, x, y, v) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    g[y * W + x] = v;
  }

  function disc(g, cx, cy, r, v, aspect) {
    aspect = aspect || 1;
    var r2 = r * r;
    for (var y = Math.floor(cy - r / aspect); y <= Math.ceil(cy + r / aspect); y++) {
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        var dx = x - cx, dy = (y - cy) * aspect;
        if (dx * dx + dy * dy <= r2) set(g, x, y, v);
      }
    }
  }

  function ellipseFill(g, cx, cy, rx, ry, v, inner, innerV) {
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
        if (d <= 1) set(g, x, y, (inner && d <= inner) ? innerV : v);
      }
    }
  }

  /* ---------- 通用：底部海水江崖 ---------- */
  function addWaves(g, rnd, top) {
    var bands = 3, k = 2 * Math.PI / (W / (1.4 + rnd() * 1.4));
    for (var b = 0; b < bands; b++) {
      var base = top + (H - top) * (b / bands);
      var amp = 1.6 + rnd() * 1.8;
      var ph = rnd() * Math.PI * 2;
      for (var x = 0; x < W; x++) {
        var edge = base + amp * Math.sin(k * x + ph);
        for (var y = Math.round(edge); y < Math.round(base + (H - top) / bands + 2); y++) {
          if (y >= 0 && y < H) {
            var cur = g[y * W + x];
            if (cur === -1) set(g, x, y, 3 + (b % 2 ? 1 : 0));
          }
        }
      }
    }
  }

  /* ---------- 纹样一：宝相团花 ---------- */
  /* 沿 ang 方向摆放一枚胖椭圆花瓣：主轴沿径向，副轴沿切向 */
  function petalEllipse(g, px, py, ang, rl, tw, v, aspect) {
    var ca = Math.cos(ang), sa = Math.sin(ang);
    for (var y = Math.floor(py - rl) - 1; y <= Math.ceil(py + rl) + 1; y++) {
      for (var x = Math.floor(px - rl) - 1; x <= Math.ceil(px + rl) + 1; x++) {
        var dx = x - px, dy = (y - py) * aspect;
        var u = dx * ca + dy * sa, w = -dx * sa + dy * ca;
        if ((u * u) / (rl * rl) + (w * w) / (tw * tw) <= 1) set(g, x, y, v);
      }
    }
  }

  function tuantuan(rnd) {
    var g = new Int8Array(W * H).fill(-1);
    var cx = (W - 1) / 2, cy = H * 0.40, aspect = 0.86;
    var twist = (rnd() - 0.5) * 0.6;
    var n = 8;

    /* 外层八瓣（与内层错半格） */
    for (var k = 0; k < n; k++) {
      var a2 = (k / n) * Math.PI * 2 + Math.PI / n + twist;
      petalEllipse(g, cx + Math.cos(a2) * 12.5, cy + Math.sin(a2) * 12.5 / aspect,
        a2, 6.2, 4.0, 2, aspect);
    }
    /* 外层瓣尖另起一色，取宝相花“间晕”之貌 */
    for (var k2 = 0; k2 < n; k2++) {
      var a3 = (k2 / n) * Math.PI * 2 + Math.PI / n + twist;
      disc(g, cx + Math.cos(a3) * 17.6, cy + Math.sin(a3) * 17.6 / aspect, 1.5, 3, aspect);
    }
    /* 内层八瓣覆盖其上 */
    for (var k3 = 0; k3 < n; k3++) {
      var a1 = (k3 / n) * Math.PI * 2 + twist;
      petalEllipse(g, cx + Math.cos(a1) * 6.4, cy + Math.sin(a1) * 6.4 / aspect,
        a1, 5.0, 3.2, 1, aspect);
    }
    disc(g, cx, cy, 2.4, 4, aspect);
    addWaves(g, rnd, H * 0.84);
    return g;
  }

  /* ---------- 纹样二：缠枝莲 ---------- */
  function lianzhi(rnd) {
    var g = new Int8Array(W * H).fill(-1);
    var amp = 7 + rnd() * 6, freq = 1.3 + rnd() * 1.0, ph = rnd() * Math.PI * 2;
    var cx = (W - 1) / 2;

    for (var y = 0; y < H; y++) {
      var t = y / (H - 1);
      var sx = cx + amp * Math.sin(freq * t * Math.PI * 2 + ph);
      for (var x = 0; x < W; x++) {
        if (Math.abs(x - sx) < 1.5) set(g, x, y, 1);
      }
    }
    for (var i = 0; i < 4; i++) {
      var yy = 5 + i * 13 + Math.floor(rnd() * 4);
      if (yy >= H) continue;
      var tt = yy / (H - 1);
      var ss = cx + amp * Math.sin(freq * tt * Math.PI * 2 + ph);
      var dir = (i % 2) ? 1 : -1;
      /* 花头须收在画面内，否则会被边界裁切而失去花形 */
      var fx = Math.max(5, Math.min(W - 6, ss + dir * (5.5 + rnd() * 3.5)));
      for (var k = 0; k < 8; k++) {
        var aa = (k / 8) * Math.PI * 2 + i * 0.42;
        ellipseFill(g, fx + Math.cos(aa) * 3.1, yy + Math.sin(aa) * 3.1, 2.4, 2.4, 2);
      }
      disc(g, fx, yy, 2.1, 0);
      ellipseFill(g, Math.max(4, Math.min(W - 5, ss - dir * (4.5 + rnd() * 3))), yy + 3, 3.6 + rnd() * 1.6, 2.2 + rnd() * 1.2, 3);
    }
    addWaves(g, rnd, H * 0.8);
    return g;
  }

  /* ---------- 纹样三：游鱼戏藻（侧面角度，便于低分辨率成形） ---------- */
  function jinyu(rnd) {
    var g = new Int8Array(W * H).fill(-1);
    var cx = Math.round((W - 1) / 2), cy = Math.round(H * 0.38);

    /* 水草：自底部上扬的几缕 */
    for (var s = 0; s < 4; s++) {
      var bx = 4 + s * 12 + rnd() * 3;
      for (var yw = cy + 9; yw < H; yw++) {
        set(g, bx + Math.sin((yw - cy) * 0.26 + s * 1.7) * 2.4, yw, 3);
      }
    }

    /* 鱼身：横向橄榄形，外深内浅 */
    ellipseFill(g, cx - 1, cy, 13, 6.4, 1, 0.30, 0);
    /* 头部收钝 */
    for (var xh = Math.round(cx - 14); xh <= Math.round(cx - 10); xh++) {
      for (var yh = Math.round(cy - 6); yh <= Math.round(cy + 6); yh++) {
        if (g[yh * W + xh] !== -1) continue;
        var hh = 6.4 - (cx - 10 - xh) * 1.1;
        if (Math.abs(yh - cy) < hh) set(g, xh, yh, 1);
      }
    }
    /* 尾鳍：向右张开的两片 */
    for (var x = Math.round(cx + 10); x <= cx + 21; x++) {
      var t = (x - (cx + 10)) / 11;
      var sp = 1.2 + t * 6.4;
      for (var y = Math.round(cy - sp); y <= Math.round(cy + sp); y++) {
        if (Math.abs(Math.abs(y - cy) - sp) < 1.4) set(g, x, y, 2);
      }
    }
    /* 背鳍 */
    for (var y2 = Math.round(cy - 6); y2 >= cy - 13; y2--) {
      var t2 = (cy - 6 - y2) / 7;
      var hw = 4.2 * (1 - t2) + 0.6;
      for (var x2 = Math.round(cx - 3 - hw); x2 <= Math.round(cx - 3 + hw); x2++) set(g, x2, y2, 2);
    }
    /* 腹鳍 */
    for (var y3 = Math.round(cy + 6); y3 <= cy + 11; y3++) {
      var t3 = (y3 - (cy + 6)) / 5;
      var hw3 = 3.2 * (1 - t3) + 0.5;
      for (var x3 = Math.round(cx + 1 - hw3); x3 <= Math.round(cx + 1 + hw3); x3++) set(g, x3, y3, 2);
    }
    /* 鳃线与眼 */
    for (var y4 = cy - 4; y4 <= cy + 4; y4++) set(g, cx - 5, y4, 2);
    disc(g, cx - 8, cy - 1, 1.2, 4);
    addWaves(g, rnd, H * 0.86);
    return g;
  }

  /* ---------- 纹样四：海水江崖 ---------- */
  function shuiwen(rnd) {
    var g = new Int8Array(W * H).fill(-1);
    var top = H * 0.3, bands = 5;
    for (var b = 0; b < bands; b++) {
      var base = top + (H - top) * (b / bands);
      var amp = 2.2 + rnd() * 2.4;
      var k = 2 * Math.PI / (W / (1.2 + rnd() * 1.6));
      var ph = rnd() * Math.PI * 2;
      for (var x = 0; x < W; x++) {
        var edge = base + amp * Math.sin(k * x + ph);
        for (var y = Math.round(edge); y < Math.round(base + (H - top) / bands + 1.5); y++) {
          if (y >= 0 && y < H) set(g, x, y, b % 4 === 0 ? 0 : (1 + (b % 3)));
        }
      }
    }
    /* 立水浪头 */
    for (var s = 0; s < 3; s++) {
      var sx2 = 8 + s * 14 + rnd() * 4;
      for (var y4 = H * 0.86; y4 < H; y4++) {
        var hw = 1 + (y4 - H * 0.86) * 0.5;
        for (var x4 = Math.round(sx2 - hw); x4 <= Math.round(sx2 + hw); x4++) set(g, x4, y4, 2);
      }
    }
    return g;
  }

  var BUILDERS = [
    { id: 'tuanhua', name: '宝相团花', note: '放射对称·三层环花', fn: tuantuan },
    { id: 'lianzhi', name: '缠枝莲', note: '藤蔓绕 riots花·左右生', fn: lianzhi },
    { id: 'jinyu', name: '游鱼戏藻', note: '橄榄鱼身·尾鳍张立', fn: jinyu },
    { id: 'shuiwen', name: '海水江崖', note: '层波相叠·立水浪头', fn: shuiwen }
  ];

  /* ---------- 传统缂丝 / 苏罗常用丝色 ---------- */
  var PALETTES = [
    { id: 'songya', name: '宋韵雅', ground: '#EFE7D6', warp: '#D6C9AC',
      lines: ['#2F6B8F', '#5B8C51', '#D8A63D', '#A8324A', '#7A6A9B'] },
    { id: 'yuefu', name: '乐府红', ground: '#F6EDDF', warp: '#DFD2BA',
      lines: ['#D4537E', '#2F6B8F', '#E8A33D', '#3F7A5E', '#9C3B4E'] },
    { id: 'biluo', name: '碧螺青', ground: '#EDEEE2', warp: '#CBD4C0',
      lines: ['#3D7A6B', '#8FB27E', '#D9C87A', '#B0654C', '#4B6E8F'] },
    { id: 'mojin', name: '墨缂金', ground: '#1F2230', warp: '#3A3F52',
      lines: ['#C8A155', '#8E3B45', '#3F6B84', '#7C7A4A', '#E0D9C4'] },
    { id: 'oufen', name: '藕粉莲', ground: '#F6ECEC', warp: '#E2CDD2',
      lines: ['#C77B8C', '#86A6A0', '#E4B45C', '#6E5A7C', '#A9445A'] },
    { id: 'shiqing', name: '石青霜', ground: '#E9EEF2', warp: '#C6D1DA',
      lines: ['#25557A', '#5C8EA6', '#E0BE6B', '#8A4A3C', '#6B7B52'] }
  ];

  function build(patternId, seed) {
    var b = BUILDERS.filter(function (p) { return p.id === patternId; })[0] || BUILDERS[0];
    return { grid: b.fn(mulberry32(seed || 1)), meta: b };
  }

  /* 将 grid 按行切分为“梭”：每一梭 = 一行内连续的同色段（断纬的直接依据） */
  function toRows(grid) {
    var rows = [];
    for (var y = 0; y < H; y++) {
      var runs = [], cur = grid[y * W], start = 0;
      for (var x = 1; x <= W; x++) {
        var v = x < W ? grid[y * W + x] : -999;
        if (v !== cur) {
          if (cur !== -1) runs.push({ x0: start, x1: x - 1, c: cur });
          cur = v; start = x;
        }
      }
      rows.push(runs);
    }
    return rows;
  }

  return {
    W: W, H: H, BUILDERS: BUILDERS, PALETTES: PALETTES,
    build: build, toRows: toRows, rng: mulberry32
  };
});
