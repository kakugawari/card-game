/*!
 * fx.js — 演出の部品。粒 (キャンバス) と、効果音 (Web Audio で合成)。
 *
 *   Fx.particles(canvas)   粒を描くしくみを作る。burst / stream / rain / clear
 *   Fx.Sfx                 効果音。unlock() をタップの中で呼んでから play(name)
 *
 * 粒は 1 枚のキャンバスにまとめて描き、粒が 1 つも無いときはコマを回さない。
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const COLORS = {
    white: ['#ffffff', '#fff6d6', '#ffe9f2'],
    blue: ['#ffffff', '#9fd8ff', '#7ab8ff', '#c9b3ff'],
    gold: ['#fff6c2', '#ffd84a', '#ffbf1f', '#ffffff'],
    rainbow: ['#ff7eb3', '#ffd36b', '#8fe3b0', '#7ec8ff', '#c39bff', '#ffffff'],
    mega: ['#fff3a8', '#ffd84a', '#f5b52e', '#ffffff', '#ffe9a0'],
    pastel: ['#ffc2dc', '#ffe3b3', '#c9f0ff', '#e3d1ff', '#ffffff']
  };

  // ---------------------------------------------------------------- 粒
  function particles(canvas) {
    const ctx = canvas.getContext('2d');
    const list = [];
    const rains = [];
    let w = 0, h = 0, dpr = 1;
    let raf = 0;
    let last = 0;
    const MAX = 520;
    // 粒は小さくて動いているので、細かく描いても見分けられない。画素の倍率を 1 にして、塗る面積を 1/4 にする
    // (CPU 4 倍遅で、粒の多い場面が 1 コマ 33ms → 16.7ms)
    const DPR = 1;

    function resize() {
      const b = canvas.getBoundingClientRect();
      // 枠を組み直している最中は 0 が来ることがある。そのときは前の大きさのまま
      if (!(b.width >= 1 && b.height >= 1)) return;
      dpr = DPR;
      w = b.width;
      h = b.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function add(p) {
      if (list.length >= MAX) list.shift();
      list.push(p);
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }

    /** 1 点から飛び散る */
    function burst(x, y, o) {
      const cols = COLORS[o.color] || COLORS.white;
      const n = o.count || 30;
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU);
        const sp = rnd(o.speed * 0.35 || 120, o.speed || 420);
        add({
          shape: o.shape || 'star', x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0),
          g: o.gravity === undefined ? 260 : o.gravity, drag: o.drag || 1.6,
          size: rnd(o.size * 0.5 || 4, o.size || 10), rot: rnd(0, TAU), vr: rnd(-8, 8),
          life: 0, max: rnd((o.life || 1.2) * 0.6, o.life || 1.2),
          color: cols[i % cols.length], add: !!o.add, flutter: rnd(0, TAU)
        });
      }
    }

    /** 外から 1 点へ吸い込まれる (ためている最中) */
    function inward(x, y, o) {
      const cols = COLORS[o.color] || COLORS.white;
      for (let i = 0; i < (o.count || 2); i++) {
        const a = rnd(0, TAU);
        const r = rnd(o.r0 || 160, o.r1 || 260);
        const t = rnd(0.45, 0.8);
        add({
          shape: 'dot', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
          vx: -Math.cos(a) * r / t, vy: -Math.sin(a) * r / t, g: 0, drag: 0,
          size: rnd(2, o.size || 5), rot: 0, vr: 0, life: 0, max: t, color: cols[i % cols.length], add: true, flutter: 0
        });
      }
    }

    /** 上から降らせる (紙ふぶき・コイン・花びら)。dur 秒のあいだ、1 秒に rate こ */
    function rain(o) {
      rains.push({ o: o, left: o.dur || 3, acc: 0 });
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }

    function spawnRain(o) {
      const cols = COLORS[o.color] || COLORS.white;
      add({
        shape: o.shape || 'confetti', x: rnd(-10, w + 10), y: rnd(-40, -10),
        vx: rnd(-40, 40), vy: rnd(o.speed * 0.6 || 80, o.speed || 180), g: o.gravity || 60, drag: 0.4,
        size: rnd(o.size * 0.6 || 6, o.size || 12), rot: rnd(0, TAU), vr: rnd(-6, 6),
        life: 0, max: o.life || 4.5, color: cols[Math.floor(Math.random() * cols.length)], add: !!o.add, flutter: rnd(0, TAU)
      });
    }

    function clear() { list.length = 0; rains.length = 0; if (w) ctx.clearRect(0, 0, canvas.width, canvas.height); }

    function drawStar(p, s) {
      const k = s * 0.26;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(k, -k, s, 0);
      ctx.quadraticCurveTo(k, k, 0, s);
      ctx.quadraticCurveTo(-k, k, -s, 0);
      ctx.quadraticCurveTo(-k, -k, 0, -s);
      ctx.fill();
    }

    function tick(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0;     // 1 コマ目は負になることがある (上も下も止める)
      if (dt > 0.05) dt = 0.05;
      if (!w) resize();

      for (let i = rains.length - 1; i >= 0; i--) {
        const r = rains[i];
        r.left -= dt;
        r.acc += dt * (r.o.rate || 30);
        while (r.acc >= 1) { r.acc -= 1; spawnRain(r.o); }
        if (r.left <= 0) rains.splice(i, 1);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // 動かす
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life += dt;
        if (p.life >= p.max || p.y > h + 60) { list.splice(i, 1); continue; }
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy = p.vy * damp + p.g * dt;
        p.flutter += dt * 6;
        p.x += (p.vx + (p.shape === 'confetti' || p.shape === 'petal' ? Math.sin(p.flutter) * 30 : 0)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      // 描く。重ね方を切りかえる回数を減らすため、ふつう → 光 (lighter) の 2 回に分ける
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          if (p.add !== (pass === 1)) continue;
          const t = p.life / p.max;
          const alpha = t < 0.1 ? t / 0.1 : t > 0.7 ? (1 - t) / 0.3 : 1;
          if (alpha <= 0.02) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          const cr = Math.cos(p.rot), sr = Math.sin(p.rot);
          ctx.setTransform(dpr * cr, dpr * sr, -dpr * sr, dpr * cr, dpr * p.x, dpr * p.y);
          const s = p.size;
          if (p.shape === 'star') {
            drawStar(p, s * (0.6 + 0.4 * Math.abs(Math.sin(p.flutter))));
          } else if (p.shape === 'dot') {
            ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
          } else if (p.shape === 'confetti') {
            ctx.scale(1, Math.cos(p.flutter));
            ctx.fillRect(-s / 2, -s / 4, s, s / 2);
          } else if (p.shape === 'coin') {
            ctx.scale(Math.cos(p.flutter * 0.8), 1);
            ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#c98a0b'; ctx.lineWidth = s * 0.22; ctx.stroke();
          } else if (p.shape === 'petal') {
            ctx.scale(1, 0.55 + 0.45 * Math.cos(p.flutter));
            ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.6, 0, 0, TAU); ctx.fill();
          } else if (p.shape === 'bubble') {
            ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU);
            ctx.strokeStyle = p.color; ctx.lineWidth = 1.6; ctx.stroke();
          }
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (list.length || rains.length) raf = requestAnimationFrame(tick);
      else { raf = 0; ctx.clearRect(0, 0, w, h); }
    }

    window.addEventListener('resize', function () { resize(); });
    return { resize: resize, burst: burst, inward: inward, rain: rain, clear: clear, count: function () { return list.length; } };
  }

  // ---------------------------------------------------------------- 効果音
  /*
   * どの音も「すっと立ち上がって、0 まで下がりきってから止める」。止めるときは今の値を読まずに
   * setTargetAtTime で落とす (予定を入れた値は .value に出ないので、読むと「バチッ」と鳴る)。
   * 出口に圧縮器を置いて、重なっても割れないようにする。
   */
  const NOTE = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };   // MIDI 番号 → Hz

  function makeSfx() {
    let ctx = null;
    let master = null;
    let noiseBuf = null;
    let muted = false;

    function graph(c) {
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 8;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      const g = c.createGain();
      g.gain.value = 0.85;
      g.connect(comp);
      comp.connect(c.destination);
      const n = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return { master: g, noise: n };
    }

    /** タップの中で呼ぶ (iOS は人の操作の中でしか音を出させてくれない) */
    function unlock() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const gr = graph(ctx);
        master = gr.master;
        noiseBuf = gr.noise;
      }
      if (ctx.state === 'suspended') ctx.resume();
    }

    // ---- 部品 (c: AudioContext, out: 出口, t: 鳴らしはじめ)
    function tone(c, out, t, f, dur, o) {
      o = o || {};
      const osc = c.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      if (o.detune) osc.detune.value = o.detune;
      const g = c.createGain();
      const peak = o.vol === undefined ? 0.2 : o.vol;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + (o.attack || 0.008));
      g.gain.setTargetAtTime(0, t + (o.hold || 0), (dur - (o.hold || 0)) / 4);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    function noise(c, out, buf, t, dur, o) {
      o = o || {};
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = o.filter || 'bandpass';
      f.frequency.setValueAtTime(o.f0 || 2000, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
      f.Q.value = o.q || 1;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.vol || 0.3, t + (o.attack || 0.005));
      g.gain.setTargetAtTime(0, t + (o.hold || 0), (dur - (o.hold || 0)) / 4);
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    }

    function chord(c, out, t, notes, dur, o) {
      notes.forEach(function (n, i) { tone(c, out, t + (o && o.spread ? i * o.spread : 0), NOTE(n), dur, o); });
    }

    // ---- 音の一覧 (どれも c, out, buf, t を受け取る。テストで OfflineAudioContext に描き出せるように)
    const SOUNDS = {
      tear: function (c, out, buf, t) { noise(c, out, buf, t, 0.09, { f0: 3500, f1: 1800, q: 0.8, vol: 0.35 }); },
      rip: function (c, out, buf, t) {
        noise(c, out, buf, t, 0.35, { f0: 4000, f1: 700, q: 0.7, vol: 0.55 });
        tone(c, out, t + 0.05, 500, 0.4, { to: 1400, type: 'triangle', vol: 0.12 });
      },
      whoosh: function (c, out, buf, t) { noise(c, out, buf, t, 0.28, { f0: 1500, f1: 400, q: 1.2, vol: 0.4, attack: 0.04 }); },
      flip: function (c, out, buf, t) {
        noise(c, out, buf, t, 0.06, { f0: 2500, q: 2, vol: 0.4 });
        tone(c, out, t, 900, 0.08, { to: 600, type: 'triangle', vol: 0.15 });
      },
      shine: function (c, out, buf, t) { chord(c, out, t, [88, 93, 100], 0.5, { spread: 0.06, vol: 0.12 }); },
      omen: function (c, out, buf, t) {
        tone(c, out, t, 70, 0.9, { vol: 0.35, type: 'sine' });
        chord(c, out, t + 0.1, [84, 91, 96], 0.8, { spread: 0.08, vol: 0.1 });
      },
      stage1: function (c, out, buf, t) { chord(c, out, t, [72, 76, 79, 84], 0.7, { spread: 0.05, vol: 0.12, type: 'triangle' }); },
      stage2: function (c, out, buf, t) { chord(c, out, t, [74, 79, 83, 86, 91], 0.9, { spread: 0.05, vol: 0.12, type: 'triangle' }); },
      stage3: function (c, out, buf, t) {
        chord(c, out, t, [76, 80, 83, 88, 92, 95], 1.1, { spread: 0.05, vol: 0.11, type: 'triangle' });
        noise(c, out, buf, t, 0.8, { f0: 6000, filter: 'highpass', vol: 0.08, attack: 0.1 });
      },
      heartbeat: function (c, out, buf, t) {
        [0, 0.22, 0.85, 1.07].forEach(function (d, i) { tone(c, out, t + d, 62, 0.22, { to: 40, vol: i % 2 ? 0.45 : 0.6 }); });
      },
      crack: function (c, out, buf, t) {
        noise(c, out, buf, t, 0.5, { f0: 5000, f1: 1200, q: 0.5, vol: 0.5 });
        chord(c, out, t + 0.02, [96, 100, 103], 0.6, { vol: 0.08 });
      },
      pop: function (c, out, buf, t) { tone(c, out, t, 600, 0.12, { to: 1200, type: 'triangle', vol: 0.12 }); },
      fanfareRR: function (c, out, buf, t) {
        chord(c, out, t, [72, 76, 79, 84], 0.5, { spread: 0.08, type: 'triangle', vol: 0.16 });
        chord(c, out, t + 0.34, [84, 88, 91], 0.9, { type: 'triangle', vol: 0.1 });
      },
      fanfareAR: function (c, out, buf, t) {
        chord(c, out, t, [77, 81, 84, 88, 89, 93], 1.4, { spread: 0.11, vol: 0.13 });
        chord(c, out, t + 0.7, [65, 72, 76], 1.4, { vol: 0.08 });
      },
      fanfareSR: function (c, out, buf, t) {
        const o = { type: 'sawtooth', vol: 0.06, attack: 0.02 };
        chord(c, out, t, [60, 64, 67, 72], 0.3, o);
        chord(c, out, t + 0.28, [65, 69, 72, 77], 0.3, o);
        chord(c, out, t + 0.56, [67, 71, 74, 79], 0.3, o);
        chord(c, out, t + 0.84, [72, 76, 79, 84, 88], 1.6, Object.assign({}, o, { hold: 0.4 }));
        chord(c, out, t + 0.84, [96, 100, 103, 108], 0.8, { spread: 0.05, vol: 0.06 });
      },
      fanfareSAR: function (c, out, buf, t) {
        for (let i = 0; i < 12; i++) tone(c, out, t + i * 0.045, NOTE(72 + [0, 4, 7, 11, 12, 16, 19, 23, 24, 28, 31, 35][i]), 0.6, { vol: 0.09, type: 'triangle' });
        const o = { type: 'sawtooth', vol: 0.055, attack: 0.03, hold: 0.8 };
        chord(c, out, t + 0.55, [60, 67, 72, 76, 79, 83], 2.4, o);
        chord(c, out, t + 0.55, [60, 67, 72, 76, 79, 83], 2.4, Object.assign({}, o, { detune: 9 }));
        noise(c, out, buf, t + 0.55, 1.8, { f0: 7000, filter: 'highpass', vol: 0.06, attack: 0.2 });
      },
      fanfareMUR: function (c, out, buf, t) {
        tone(c, out, t, 55, 2.8, { vol: 0.5, hold: 0.3 });                 // どーん
        noise(c, out, buf, t, 2.6, { f0: 300, filter: 'lowpass', vol: 0.35, hold: 0.2 });
        const o = { type: 'sawtooth', vol: 0.05, attack: 0.05, hold: 1.2 };
        [0, 7, -7].forEach(function (d) { chord(c, out, t + 0.15, [48, 55, 60, 64, 67, 72, 76], 3.2, Object.assign({}, o, { detune: d })); });
        for (let i = 0; i < 16; i++) tone(c, out, t + 0.4 + i * 0.07, NOTE(84 + [0, 4, 7, 12][i % 4] + 12 * Math.floor(i / 8)), 0.7, { vol: 0.07 });
      }
    };

    function play(name, delay) {
      if (muted || !ctx || !SOUNDS[name]) return;
      SOUNDS[name](ctx, master, noiseBuf, ctx.currentTime + (delay || 0));
    }

    /** 長押しのあいだ鳴りつづける「ためる」音。set(0〜1) で高さと大きさが上がる */
    function charge() {
      if (muted || !ctx) return { set: function () {}, stop: function () {} };
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 160;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.setTargetAtTime(0.08, t, 0.08);
      osc.connect(g);
      osc2.connect(g);
      g.connect(master);
      osc.start(t);
      osc2.start(t);
      let done = false;
      return {
        set: function (p) {
          if (done) return;
          const now = ctx.currentTime;
          osc.frequency.setTargetAtTime(160 + p * 700, now, 0.05);
          osc2.frequency.setTargetAtTime(320 + p * 1500 + Math.sin(now * 30) * 20, now, 0.05);
          g.gain.setTargetAtTime(0.06 + p * 0.12, now, 0.05);
        },
        stop: function () {
          if (done) return;
          done = true;
          const now = ctx.currentTime;
          g.gain.cancelScheduledValues(now);
          g.gain.setTargetAtTime(0, now, 0.04);
          osc.stop(now + 0.3);
          osc2.stop(now + 0.3);
        }
      };
    }

    /** テスト用: 1 つの音を OfflineAudioContext に描き出し、いちばん大きい所と平均を返す */
    function measure(name, seconds) {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const c = new OAC(1, Math.round(44100 * (seconds || 4)), 44100);
      const gr = graph(c);
      SOUNDS[name](c, gr.master, gr.noise, 0.05);
      return c.startRendering().then(function (buf) {
        const d = buf.getChannelData(0);
        let peak = 0, sum = 0, tail = 0;
        for (let i = 0; i < d.length; i++) {
          const a = Math.abs(d[i]);
          if (a > peak) peak = a;
          sum += a;
        }
        for (let i = d.length - 2205; i < d.length; i++) tail = Math.max(tail, Math.abs(d[i]));
        return { peak: peak, mean: sum / d.length, tail: tail };
      });
    }

    return {
      unlock: unlock,
      play: play,
      charge: charge,
      measure: measure,
      names: Object.keys(SOUNDS),
      setMuted: function (m) { muted = !!m; if (muted && master && ctx) { /* 鳴っている音は自然に消える */ } },
      isMuted: function () { return muted; }
    };
  }

  root.Fx = { particles: particles, Sfx: makeSfx(), COLORS: COLORS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
