/* app.js — 《经纬二重》H5 交互逻辑
 * 依赖 NHPattern（weave-pattern.js）。全部图形由代码绘制，无任何外部图片素材。
 */
(function () {
  'use strict';
  var P = window.NHPattern, W = P.W, H = P.H, CELL = 10;
  var LOOMW = W * CELL, LOOMH = H * CELL;   // 460 x 580

  var S = {
    page: 0, pattern: 'tuanhua', seed: 7, palette: 0,
    runs: [], woven: 0, auto: false, mirror: false, twist: 0.45, mode: 'tong', frame: null
  };

  function $(id) { return document.getElementById(id); }

  function fit(cv, w, h, d) {
    d = d || 2;
    cv.width = w * d; cv.height = h * d;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    return c;
  }

  function rr(c, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  /* ---------- 数据：把纹样展开成“梭”的序列 ---------- */
  function buildRuns() {
    var g = P.build(S.pattern, S.seed).grid;
    var rows = P.toRows(g), out = [];
    for (var y = 0; y < rows.length; y++) {
      for (var i = 0; i < rows[y].length; i++) {
        out.push({ row: y, x0: rows[y][i].x0, x1: rows[y][i].x1, c: rows[y][i].c });
      }
    }
    S.runs = out; S.total = out.length;
  }

  /* ---------- 织机绘制 ---------- */
  function drawLoom(c, upto, mirror, small) {
    var pal = P.PALETTES[S.palette], k = small || 1;
    var w = LOOMW * k, h = LOOMH * k;
    c.clearRect(0, 0, w, h);
    c.fillStyle = pal.ground; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.5; c.fillStyle = pal.warp;
    for (var i = 0; i < W; i++) c.fillRect((i * CELL + CELL / 2 - 0.7) * k, 0, 1.4 * k, h);
    c.globalAlpha = 1;
    for (var j = 0; j < upto && j < S.runs.length; j++) {
      var r = S.runs[j];
      var x = r.x0 * CELL + 1, ww = (r.x1 - r.x0 + 1) * CELL - 2, y = r.row * CELL + 1;
      if (mirror) x = LOOMW - x - ww;
      var col = pal.lines[r.c % pal.lines.length];
      c.fillStyle = col;
      rr(c, x * k, y * k, ww * k, (CELL - 2) * k, 3 * k); c.fill();
      c.fillStyle = 'rgba(255,255,255,.16)';
      c.fillRect(x * k, y * k, ww * k, 1.2 * k);
    }
  }

  /* ---------- 缩略图 ---------- */
  /* 缩略图的梭序缓存：动画每帧重绘，不能每次都重跑 build + toRows */
  var thumbCache = {};
  function thumbRuns(pid, seed) {
    var key = pid + '_' + seed;
    if (!thumbCache[key]) {
      var g = P.build(pid, seed).grid, rows = P.toRows(g), out = [];
      for (var y = 0; y < rows.length; y++) {
        for (var i = 0; i < rows[y].length; i++) {
          out.push({ row: y, x0: rows[y][i].x0, x1: rows[y][i].x1, c: rows[y][i].c });
        }
      }
      thumbCache[key] = out;
    }
    return thumbCache[key];
  }

  function drawThumb(cv, pid, seed, palIdx, upto) {
    var runs = thumbRuns(pid, seed), k = 0.5;
    var c = cv.__ctx;
    if (!c) {
      c = fit(cv, LOOMW * k, LOOMH * k, 2);
      cv.__ctx = c;
      /* 固定显示尺寸，避免四张卡片把页面撑出屏外 */
      cv.style.width = '167px'; cv.style.height = '210px';
    }
    var pal = P.PALETTES[palIdx];
    c.fillStyle = pal.ground; c.fillRect(0, 0, LOOMW * k, LOOMH * k);
    c.globalAlpha = 0.45; c.fillStyle = pal.warp;
    for (var i = 0; i < W; i++) c.fillRect((i * CELL + CELL / 2 - 0.6) * k, 0, 1.2 * k, LOOMH * k);
    c.globalAlpha = 1;
    var n = (upto === undefined) ? runs.length : Math.min(runs.length, Math.floor(upto));
    for (var j = 0; j < n; j++) {
      var r = runs[j];
      c.fillStyle = pal.lines[r.c % pal.lines.length];
      c.fillRect((r.x0 * CELL + 1) * k, (r.row * CELL + 1) * k, ((r.x1 - r.x0 + 1) * CELL - 2) * k, (CELL - 2) * k);
    }
  }

  /* ---------- P2 释义图：通经 / 断纬 ---------- */
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  /* 回纬折返的示意钩 */
  function drawHook(c, bx, k, blink) {
    c.save();
    c.strokeStyle = '#8E3B45'; c.lineWidth = 2 * k;
    c.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(blink * Math.PI));
    c.setLineDash([4 * k, 3 * k]);
    c.beginPath();
    c.moveTo(bx, 138 * k); c.lineTo(bx, 112 * k);
    c.lineTo(bx + 12 * k, 112 * k); c.lineTo(bx + 12 * k, 164 * k); c.lineTo(bx, 164 * k);
    c.stroke();
    c.restore();
  }

  function drawDiagram(c, k, prog) {
    k = k || 1;
    prog = (prog === undefined) ? 1 : Math.max(0, Math.min(1, prog));
    var w = 552 * k, h = 300 * k;
    var pal = P.PALETTES[S.palette], cols = 12, cw = w / cols;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#FFFDF7'; c.fillRect(0, 0, w, h);
    c.fillStyle = pal.warp; c.globalAlpha = 0.85;
    for (var i = 0; i < cols; i++) c.fillRect(i * cw + cw / 2 - 1.5 * k, 20 * k, 3 * k, 260 * k);
    c.globalAlpha = 1;

    c.textAlign = 'center';

    if (S.mode === 'tong') {
      var len = 504 * k * ease(prog);
      if (len > 1) {
        c.fillStyle = pal.lines[0];
        rr(c, 24 * k, 138 * k, len, 26 * k, 8 * k); c.fill();
      }
      if (prog < 1) {
        c.fillStyle = '#8E3B45';
        c.beginPath(); c.arc(24 * k + len, 151 * k, 5.5 * k, 0, 6.2832); c.fill();
      }
      c.fillStyle = '#2A2723'; c.font = (15 * k) + 'px sans-serif';
      c.fillText('一根纬线左右到头，通到底', w / 2, 196 * k);
      c.fillStyle = '#8E3B45';
      c.fillText('经线自始至终不断 · 通经', w / 2, 226 * k);
    } else {
      var segs = [[24, 150], [190, 160], [370, 158]];
      var cs = [pal.lines[0], pal.lines[1], pal.lines[2]];
      segs.forEach(function (s, i) {
        var lp = Math.max(0, Math.min(1, (prog - i * 0.26) / 0.30));
        var len = s[1] * k * ease(lp);
        if (len > 1) {
          c.fillStyle = cs[i];
          rr(c, s[0] * k, 138 * k, len, 26 * k, 8 * k); c.fill();
        }
        if (lp >= 1 && i < segs.length - 1) drawHook(c, (s[0] + s[1] + 6) * k, k, prog * 5);
      });
      c.fillStyle = '#2A2723'; c.font = (15 * k) + 'px sans-serif';
      c.fillText('纬线各走一段就折回，互不相通', w / 2, 200 * k);
      c.fillStyle = '#8E3B45';
      c.fillText('断纬 · 色界处遂留细缝', w / 2, 230 * k);
    }
  }

  /* ---------- P6 苏罗绞经 ---------- */
  /* 绞经：两根经线沿纵向正弦摆动且相位相反，周期性互绞，围出连续椒孔 */
  function drawLuo(c, k, ph, wp) {
    k = k || 1;
    ph = ph || 0;
    wp = (wp === undefined) ? 1 : Math.max(0, Math.min(1, wp));
    var w = 552 * k, h = 300 * k;
    c.clearRect(0, 0, w, h);
    c.fillStyle = pal0().ground; c.fillRect(0, 0, w, h);
    var pairs = 7, chh = 60 * k, amp = (w / pairs) * 0.20 * (0.35 + S.twist * 0.85);
    c.lineCap = 'round';

    for (var j = 0; j < pairs * 2; j++) {
      var base = Math.floor(j / 2) * (w / pairs) + (w / pairs) * 0.5;
      var phase = (j % 2) ? 0 : Math.PI;
      c.strokeStyle = (j % 2) ? '#8E3B45' : '#2F6B8F';
      c.lineWidth = 2.4 * k;
      c.beginPath();
      for (var y = 0; y <= h; y += 3) {
        /* 相位随时间推进：绞转点沿纵向流动，如同经线连续互绞 */
        var xx = base + amp * Math.sin((y / chh) * Math.PI * 2 + phase + ph);
        if (y === 0) c.moveTo(xx, y); else c.lineTo(xx, y);
      }
      c.stroke();
    }
    /* 纬线自上而下逐条织入，锁住孔眼 */
    c.strokeStyle = 'rgba(90,84,74,.42)'; c.lineWidth = 1.4 * k;
    var rowsN = h / (chh / 2);
    for (var ri = 0; ri <= rowsN; ri++) {
      var ry = ri * (chh / 2);
      if (ry > h * wp) break;
      c.beginPath(); c.moveTo(0, ry); c.lineTo(w, ry); c.stroke();
    }
  }
  function pal0() { return P.PALETTES[S.palette]; }

  /* ---------- 页面切换 ---------- */
  var NAMES = ['封面', '释义', '择样', '掷色', '上机', '互文', '成画'];
  function go(i) {
    if (i < 0 || i > 6) return;
    S.page = i;
    var pages = document.querySelectorAll('.page');
    for (var k = 0; k < pages.length; k++) pages[k].classList.toggle('on', k === i);
    var dots = $('pager').children;
    for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('act', d === i);
    $('nav').textContent = i === 6 ? '' : NAMES[i + 1] + ' ›';
    $('prev').textContent = i === 0 ? '' : '‹ ' + NAMES[i - 1];
    if (i === 4) { $('loom').style.display = 'block'; drawLoom(loomCtx(), S.woven, S.mirror); }
    if (i === 6) renderFinal();
  }

  var loomC = null, luoC = null, diaC = null;
  function loomCtx() {
    if (!loomC) loomC = fit($('loom'), LOOMW, LOOMH, 2);
    return loomC;
  }
  function luoCtx() { if (!luoC) luoC = fit($('luo'), 552, 300, 2); return luoC; }
  function diaCtx() { if (!diaC) diaC = fit($('diagram'), 552, 300, 2); return diaC; }

  /* ================= 声音 =================
   * BGM 由 Web Audio 实时合成：五声音阶缓行 + 织机投梭声，不使用任何网络音乐，规避版权风险。
   * 语音讲解默认用设备内置中文语音朗读；若 AUDIO_FILE 中填入 mp3 路径，则优先播放该录音。
   */
  var AUDIO_FILE = { bgm: '', tong: '', duan: '' };

  var NARR = {
    tong: '通经，就是经线从上到下贯通整幅，一根到底，从不剪断。它是缂丝的骨架，也是所有纬线依附的基础。',
    duan: '断纬，是缂丝最要紧的一刀。纬线不贯穿全幅，而是依照图稿的色区，一小段一小段地回梭，' +
          '所以每一个颜色的交界处，都会留下一道极细的缝。行家管它叫缂缝，也是辨别真假缂丝的凭据。'
  };

  var AU = {
    ctx: null, master: null, on: false, step: 0, timer: null, fileEl: null, manual: false,
    init: function () {
      if (this.ctx) return true;
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return false;
      try {
        this.ctx = new C();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; return false; }
      return true;
    },
    tone: function (f, dur, type, vol) {
      if (!this.ctx) return;
      var t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    },
    /* 织机投梭的短促声响 */
    clack: function () {
      if (!this.ctx) return;
      var c = this.ctx, len = Math.floor(c.sampleRate * 0.05);
      var buf = c.createBuffer(1, len, c.sampleRate), dat = buf.getChannelData(0);
      for (var i = 0; i < len; i++) dat[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
      var s = c.createBufferSource(); s.buffer = buf;
      var g = c.createGain(); g.gain.value = 0.05;
      var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700;
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start();
    },
    beat: function () {
      var sc = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
      var seq = [0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 1, 0];
      var n = sc[seq[this.step % seq.length]];
      this.tone(n / 2, 1.7, 'sine', 0.20);
      this.tone(n, 1.1, 'triangle', 0.09);
      if (this.step % 4 === 0) this.clack();
      this.step++;
    },
    start: function () {
      if (!this.init()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      var t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0.16, t + 1.2);
      if (AUDIO_FILE.bgm) {
        if (!this.fileEl) { this.fileEl = new Audio(AUDIO_FILE.bgm); this.fileEl.loop = true; }
        var p = this.fileEl.play(); if (p && p.catch) p.catch(function () {});
      }
      var self = this;
      if (!this.timer) this.timer = setInterval(function () { self.beat(); }, 500);
      this.on = true;
    },
    stop: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0.0001, t + 0.4);
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      if (this.fileEl) this.fileEl.pause();
      this.on = false;
      this.hush();
    },
    speak: function (key) {
      if (!this.on) return;
      var f = AUDIO_FILE[key];
      if (f) {
        try { var a = new Audio(f); var p = a.play(); if (p && p.catch) p.catch(function () {}); return; }
        catch (e) { /* 文件缺失则退回朗读 */ }
      }
      if (!('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(NARR[key]);
        u.lang = 'zh-CN'; u.rate = 0.92; u.pitch = 1;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    },
    hush: function () {
      try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
    }
  };

  /* ================= 动画调度 =================
   * 只驱动当前所在屏的动画，离屏即停，避免无谓耗电。
   * S.frame 为数字时锁定进度，供离线截图取中间帧。
   */
  var Ticker = (function () {
    var items = [], t0 = 0;
    function loop(now) {
      if (!t0) t0 = now;
      var t = (now - t0) / 1000;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.page !== S.page) continue;
        it.draw(S.frame === null ? t : S.frame);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return { add: function (page, draw) { items.push({ page: page, draw: draw }); } };
  })();

  /* ---------- P5 织造交互 ---------- */
  function weave(n) {
    var before = Math.floor(S.woven);
    S.woven = Math.max(0, Math.min(S.total, S.woven + n));
    if (Math.floor(S.woven) !== before) {
      drawLoom(loomCtx(), Math.floor(S.woven), S.mirror);
      $('pbar').style.width = (S.woven / S.total * 100).toFixed(1) + '%';
      $('pnum').textContent = Math.floor(S.woven) + ' / ' + S.total + ' 梭';
      if (S.woven >= S.total) $('hint').textContent = '织成了 · 可翻面验看，或向下继续';
    }
  }
  function bindLoom() {
    var cv = $('loom'), last = 0, down = false;
    cv.addEventListener('pointerdown', function (e) {
      down = true; last = e.clientX; cv.setPointerCapture(e.pointerId);
      $('hint').textContent = '引梭中…';
    });
    cv.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = Math.abs(e.clientX - last); last = e.clientX;
      weave(dx * 0.62);
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      cv.addEventListener(ev, function () { down = false; });
    });
    var ax = 0;
    (function loop() {
      if (S.auto && S.page === 4) weave(1.6);
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- P7 成画 ---------- */
  function renderFinal() {
    var src = $('loom');
    var fc = fit($('final'), 345, 435, 2);
    fc.drawImage(src, 0, 0, 345, 435);
    var url = src.toDataURL('image/png');
    var imgs = document.querySelectorAll('#p7 .mock img');
    for (var i = 0; i < imgs.length; i++) imgs[i].src = url;
    $('fname').textContent = P.BUILDERS.filter(function (b) { return b.id === S.pattern; })[0].name
      + ' · ' + pal0().name;
  }

  /* ---------- 初始化 ---------- */
  function init() {
    buildRuns();

    /* 素材导出（供展示海报高清取图）：?export=1 织造成品 2 苏罗绞经 3 通经断纬机制 */
    var ex = /export=(\d)/.exec(location.search);
    if (ex) {
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#fff';
      var cv = document.createElement('canvas'), c;
      if (+ex[1] === 1) { c = fit(cv, 1104, 1392, 1); S.woven = S.total; drawLoom(c, S.total, false, 2.4); }
      else if (+ex[1] === 2) { c = fit(cv, 1104, 600, 1); drawLuo(c, 2); }
      else { c = fit(cv, 1104, 600, 1); S.mode = 'duan'; drawDiagram(c, 2); }
      document.body.appendChild(cv);
      return;
    }

    loomCtx();

    /* 择样卡片 */
    var gs = $('picks'), pickCvs = [];
    P.BUILDERS.forEach(function (b) {
      var d = document.createElement('div');
      d.className = 'card' + (b.id === S.pattern ? ' act' : '');
      d.innerHTML = '<canvas></canvas><div class="nm">' + b.name + '</div><div class="nt">' + b.note + '</div>';
      gs.appendChild(d);
      pickCvs.push(d.querySelector('canvas'));
      drawThumb(d.querySelector('canvas'), b.id, S.seed, S.palette);
      d.onclick = function () {
        S.pattern = b.id;
        var cs = gs.children;
        for (var i = 0; i < cs.length; i++) cs[i].classList.remove('act');
        d.classList.add('act');
        reseed();
      };
    });

    /* 色卡 */
    var sw = $('sws');
    P.PALETTES.forEach(function (p, i) {
      var d = document.createElement('div');
      d.className = 'sw' + (i === S.palette ? ' act' : '');
      var bar = p.lines.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('');
      d.innerHTML = '<div class="bar">' + bar + '</div><div class="nm">' + p.name + '</div>';
      sw.appendChild(d);
      d.onclick = function () {
        S.palette = i;
        var cs = sw.children;
        for (var k = 0; k < cs.length; k++) cs[k].classList.remove('act');
        d.classList.add('act');
        recolor();
      };
    });

    /* 释义开关 */
    var tg = $('tog').children;
    for (var t = 0; t < tg.length; t++) {
      (function (idx) {
        tg[idx].onclick = function () {
          S.mode = idx === 0 ? 'tong' : 'duan';
          for (var q = 0; q < tg.length; q++) tg[q].classList.toggle('act', q === idx);
          AU.speak(S.mode);
        };
      })(t);
    }

    /* 翻页器 */
    var pg = $('pager');
    for (var i = 0; i < 7; i++) { var e = document.createElement('i'); if (i === 0) e.className = 'act'; pg.appendChild(e); }
    $('nav').onclick = function () { go(Math.min(6, S.page + 1)); };
    $('prev').onclick = function () { go(Math.max(0, S.page - 1)); };

    /* 按钮 */
    $('btnReseed').onclick = reseed;
    $('btnCast').onclick = function () {
      S.palette = Math.floor(Math.random() * P.PALETTES.length);
      var cs = sw.children;
      for (var k = 0; k < cs.length; k++) cs[k].classList.toggle('act', k === S.palette);
      recolor();
    };
    $('btnAuto').onclick = function () {
      S.auto = !S.auto;
      this.textContent = S.auto ? '停手' : '替我织';
      if (S.auto) $('hint').textContent = '自动织造中…';
    };
    $('btnFlip').onclick = function () {
      var cv = $('loom');
      cv.style.transition = 'transform .28s ease';
      cv.style.transform = 'rotateY(90deg)';
      setTimeout(function () {
        S.mirror = !S.mirror;
        drawLoom(loomCtx(), Math.floor(S.woven), S.mirror);
        cv.style.transform = 'rotateY(0deg)';
        $('hint').textContent = S.mirror ? '背面 · 双面同纹，此缂丝之所以为缂丝' : '正面';
        renderFinal();
      }, 290);
    };
    $('btnReset').onclick = function () { resetLoom(); renderFinal(); };
    $('btnSave').onclick = function () {
      var a = document.createElement('a');
      a.href = $('loom').toDataURL('image/png');
      a.download = '经纬二重-' + S.pattern + '.png';
      a.click();
    };
    $('btnAgain').onclick = function () { reseed(); go(2); };

    /* 苏罗拖动 */
    var lv = $('luo'), ld = false;
    lv.addEventListener('pointerdown', function (e) { ld = true; lv.setPointerCapture(e.pointerId); });
    lv.addEventListener('pointermove', function (e) {
      if (!ld) return;
      var r = lv.getBoundingClientRect();
      S.twist = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      $('luoTxt').textContent = S.twist < 0.35 ? '绞转松弛 · 椒孔舒张，罗面轻透'
        : (S.twist > 0.7 ? '绞转紧密 · 椒孔收敛，罗面致密' : '半绞 · 孔眼匀停');
    });
    lv.addEventListener('pointerup', function () { ld = false; });

    bindLoom();
    drawLoom(loomCtx(), 0, false);

    /* ---- 动画：P2 释义 / P3 择样（四样由空到满）/ P6 苏罗（绞转流动） ---- */
    /* ?still=1 为静态满幅模式：不注册动画，用于海报取图与省电降级 */
    if (/still=1/.test(location.search)) {
      drawDiagram(diaCtx(), 1, 1);
      P.BUILDERS.forEach(function (b, idx) { drawThumb(pickCvs[idx], b.id, S.seed, S.palette); });
      drawLuo(luoCtx(), 1, 0, 1);
    } else
    Ticker.add(1, function (t) {
      drawDiagram(diaCtx(), 1, Math.min(1, ((t % 4.2) / 4.2) / 0.8));
    });
    P.BUILDERS.forEach(function (b, idx) {
      Ticker.add(2, function (t) {
        var p = ((t + idx * 0.7) % 6.2) / 6.2;
        drawThumb(pickCvs[idx], b.id, S.seed, S.palette,
          Math.min(1, p / 0.86) * thumbRuns(b.id, S.seed).length);
      });
    });
    Ticker.add(5, function (t) {
      drawLuo(luoCtx(), 1, t * 1.1, Math.min(1, ((t % 5.2) / 5.2) / 0.85));
    });

    /* ---- 声音：右上角开关；首次触摸自动起播（移动端禁止无手势播放音频） ---- */
    var snd = $('sound');
    snd.onclick = function (e) {
      e.stopPropagation();
      AU.manual = true;
      if (AU.on) { AU.stop(); snd.className = 'off'; }
      else { AU.start(); snd.className = AU.on ? '' : 'off'; }
    };
    var kick = function (e) {
      if (e && e.target && e.target.id === 'sound') return;
      if (!AU.manual && !AU.on) {
        AU.start();
        snd.className = AU.on ? '' : 'off';
      }
      document.removeEventListener('pointerdown', kick);
    };
    document.addEventListener('pointerdown', kick);

    /* 调试/截图用：?static=1 关闭过渡，?full=1 直接织满，#pN 直跳第 N 屏 */
    if (/static=1/.test(location.search)) document.body.classList.add('nost');
    var fm = /frame=([\d.]+)/.exec(location.search);
    if (fm) S.frame = parseFloat(fm[1]);   /* 锁定动画进度，供离线截图取中间帧 */
    if (/full=1/.test(location.search)) {
      S.woven = S.total;
      drawLoom(loomCtx(), S.total, false);
      $('pbar').style.width = '100%';
      $('pnum').textContent = S.total + ' / ' + S.total + ' 梭';
      $('hint').textContent = '织成了 · 可翻面验看，或向下继续';
    }
    var m = /^#p(\d)$/.exec(location.hash);
    go(m ? Math.min(6, Math.max(0, +m[1] - 1)) : 0);
    if (/after=reset/.test(location.search)) { resetLoom(); go(4); }
  }

  /* 清空织面：必须强制重绘，不能只置零计数（weave() 在前后值相同时不重绘） */
  function resetLoom() {
    S.woven = 0; S.auto = false; S.mirror = false;
    $('btnAuto').textContent = '替我织';
    $('loom').style.transform = 'rotateY(0deg)';
    drawLoom(loomCtx(), 0, false);
    $('pbar').style.width = '0%';
    $('pnum').textContent = '0 / ' + S.total + ' 梭';
    $('hint').textContent = '按住画布横向拖动，引梭织入';
  }

  function reseed() {
    S.seed = 3 + Math.floor(Math.random() * 900);
    buildRuns();
    resetLoom();
  }

  function recolor() {
    drawLoom(loomCtx(), Math.floor(S.woven), S.mirror);
  }

  /* 视口适配：640x1008 设计稿整体等比缩放并居中。
     必须显式 translate 居中——若依赖 flex 居中，640px 布局宽在窄屏会溢出容器，
     浏览器退化为左对齐，缩放后右侧内容被切掉。 */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    var s = Math.min(w / 640, h / 1008);
    var st = $('stage');
    st.style.transformOrigin = '0 0';
    st.style.transform = 'translate(' + ((w - 640 * s) / 2).toFixed(2) + 'px,'
      + ((h - 1008 * s) / 2).toFixed(2) + 'px) scale(' + s.toFixed(4) + ')';
  }
  window.addEventListener('resize', resize);

  window.addEventListener('DOMContentLoaded', function () { init(); resize(); });
  window.__JW = { go: go, S: S };
})();
