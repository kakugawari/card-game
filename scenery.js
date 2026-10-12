/*!
 * scenery.js — 全面イラスト (AR・SAR・SR) の仮の背景。SVG の文字列を作る (DOM は触らない)。
 *
 *   render(scene, level, seed) → { bg, svg }
 *     scene  … パック (シリーズ) の けしき: forest sea sky dino night future candy kitchen season town castle / geo (SR 用)
 *     level  … 'AR' = けしき・小物まで描いた「作品」 / 'SAR' = ARより 描き込みが多い (光・小さな生きもの・飾り) / 'SR' = 幾何学もよう
 *     seed   … カードごとの小さな ちがい (キャラの id)。きせつ (season) は 春夏秋冬のどれかも これで決まる
 *   bg は CSS の背景 (空のグラデーション)、svg は 100 x 140 の絵 (その上に重ねる)。
 *   グラデーションを SVG の defs に入れると、隠れた入れ物の中で効かないことがあるので、空は CSS で描く。
 *
 * 絵が届いたら (cards.js の art) 使われない。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
  else root.Scenery = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hash(String(seed));
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const f = function (n) { return +Number(n).toFixed(1); };
  const op = function (o) { return o == null ? '' : ' opacity="' + o + '"'; };

  // ---------------------------------------------------------------- 部品
  const rect = function (x, y, w, h, c, o) { return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" fill="' + c + '"' + op(o) + '/>'; };
  const circ = function (x, y, r, c, o) { return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="' + c + '"' + op(o) + '/>'; };
  const ell = function (x, y, rx, ry, c, o) { return '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + c + '"' + op(o) + '/>'; };
  const poly = function (pts, c, o) { return '<polygon points="' + pts + '" fill="' + c + '"' + op(o) + '/>'; };
  const path = function (d, c, o) { return '<path d="' + d + '" fill="' + c + '"' + op(o) + '/>'; };
  const stroke = function (d, c, w, o) { return '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"' + op(o) + '/>'; };
  const cloud = function (x, y, s, c, o) {
    return circ(x, y, 5 * s, c, o) + circ(x + 6 * s, y - 2.5 * s, 6.5 * s, c, o) + circ(x + 13 * s, y, 5 * s, c, o) + ell(x + 6.5 * s, y + 2.5 * s, 12 * s, 3.5 * s, c, o);
  };
  const hill = function (y, amp, c, ph) {
    return path('M0 ' + y + ' C 25 ' + (y - amp) + ' 55 ' + (y + amp * ph) + ' 100 ' + (y - amp * 0.4) + ' V140 H0 Z', c);
  };
  const sparkle = function (x, y, s, c, o) {
    const k = s * 0.22;
    return path('M' + f(x) + ' ' + f(y - s) + ' Q' + f(x + k) + ' ' + f(y - k) + ' ' + f(x + s) + ' ' + f(y) + ' Q' + f(x + k) + ' ' + f(y + k) + ' ' + f(x) + ' ' + f(y + s) +
      ' Q' + f(x - k) + ' ' + f(y + k) + ' ' + f(x - s) + ' ' + f(y) + ' Q' + f(x - k) + ' ' + f(y - k) + ' ' + f(x) + ' ' + f(y - s) + 'Z', c, o);
  };
  const tree = function (x, y, s, leaf, trunk) {
    return rect(x - s, y - 8 * s, 2 * s, 9 * s, trunk || '#8a5a34') + circ(x, y - 14 * s, 8 * s, leaf) + circ(x - 6 * s, y - 9 * s, 6 * s, leaf) + circ(x + 6 * s, y - 9 * s, 6 * s, leaf);
  };
  const pine = function (x, y, s, c) {
    return poly(f(x) + ',' + f(y - 24 * s) + ' ' + f(x - 8 * s) + ',' + f(y - 8 * s) + ' ' + f(x + 8 * s) + ',' + f(y - 8 * s), c) +
      poly(f(x) + ',' + f(y - 15 * s) + ' ' + f(x - 11 * s) + ',' + f(y) + ' ' + f(x + 11 * s) + ',' + f(y), c) + rect(x - 1.3 * s, y, 2.6 * s, 4 * s, '#7a5030');
  };
  const flower = function (x, y, s, c, ctr) {
    let p = '';
    for (let i = 0; i < 5; i++) { const a = i * 1.2566; p += circ(x + Math.cos(a) * 2.1 * s, y + Math.sin(a) * 2.1 * s, 1.7 * s, c); }
    return p + circ(x, y, 1.5 * s, ctr || '#ffd84a');
  };
  const bubble = function (x, y, r) {
    return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.75)" stroke-width=".5"/>' + circ(x - r * 0.35, y - r * 0.35, r * 0.2, '#fff', 0.8);
  };
  const house = function (x, y, w, h, wall, roof, win) {
    let s = rect(x, y - h, w, h, wall) + poly(f(x - 1.5) + ',' + f(y - h) + ' ' + f(x + w / 2) + ',' + f(y - h - w * 0.45) + ' ' + f(x + w + 1.5) + ',' + f(y - h), roof);
    for (let i = 0; i < 2; i++) s += rect(x + w * (0.18 + i * 0.45), y - h * 0.62, w * 0.25, w * 0.25, win);
    return s + rect(x + w * 0.4, y - h * 0.3, w * 0.2, h * 0.3, roof);
  };
  const building = function (x, y, w, h, c, win, rows) {
    let s = rect(x, y - h, w, h, c);
    for (let r = 0; r < rows; r++) for (let k = 0; k < 2; k++) s += rect(x + w * (0.18 + k * 0.45), y - h + 3 + r * (h - 6) / rows, w * 0.26, (h - 6) / rows * 0.6, win);
    return s;
  };
  const rays = function (x, y, c, o, n) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = -1.2 + i * (2.4 / (n - 1)) + 1.57;
      s += poly(f(x) + ',' + f(y) + ' ' + f(x + Math.cos(a - 0.07) * 150) + ',' + f(y + Math.sin(a - 0.07) * 150) + ' ' + f(x + Math.cos(a + 0.07) * 150) + ',' + f(y + Math.sin(a + 0.07) * 150), c, o);
    }
    return s;
  };
  const scatter = function (R, n, x0, x1, y0, y1, fn) {
    let s = '';
    for (let i = 0; i < n; i++) s += fn(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), i);
    return s;
  };

  // ---------------------------------------------------------------- けしき (どれも 100 x 140。どうぶつは y 20〜108、せつめいの帯は y 95 から下)
  const SCENES = {
    forest: function (R, rich) {
      let s = circ(78, 26, 15, '#fff3b0', 0.5) + circ(78, 26, 8.5, '#fff8d0') + rays(78, 26, '#fffbe0', 0.18, 5);
      s += cloud(8, 24, 0.9, '#fff', 0.9) + cloud(40, 14, 0.6, '#fff', 0.8);
      s += hill(88, 7, '#bfe6a0', 0.6) + tree(10, 96, 0.9, '#79c474') + tree(90, 94, 1.0, '#6fbb6a') + tree(26, 94, 0.6, '#8fd07e') + tree(72, 93, 0.6, '#8fd07e');
      s += hill(104, 5, '#8fd16e', -0.5);
      s += scatter(R, 14, 4, 96, 108, 134, function (x, y, i) { return flower(x, y, 0.85, ['#ff9ecb', '#fff', '#ffe27a', '#c9a6ff'][i % 4]); });
      if (rich) {
        s += rays(40, -10, '#fff', 0.12, 4);
        s += tree(-2, 100, 1.3, '#5fae62') + tree(104, 102, 1.4, '#5fae62');
        s += scatter(R, 5, 12, 88, 40, 90, function (x, y) { return sparkle(x, y, 1.6 + R(), '#fff9c4', 0.9); });
        s += scatter(R, 3, 14, 86, 30, 70, function (x, y, i) { return ell(x - 1.6, y, 1.6, 1.1, '#ffb3d1') + ell(x + 1.6, y, 1.6, 1.1, '#ff8fb8') + rect(x - 0.2, y - 1, 0.5, 2.2, '#5b4040'); });
        s += circ(20, 117, 3.2, '#ff7a7a') + rect(19.2, 117, 1.6, 4, '#fff4dd') + circ(80, 120, 3, '#ff7a7a') + rect(79.2, 120, 1.6, 4, '#fff4dd');
        s += stroke('M0 128 Q30 120 55 128 T100 124', '#9fe0ff', 3, 0.8);
      }
      return { bg: 'linear-gradient(#9fdcff, #e6f7ff 45%, #fff3d2 72%)', svg: s };
    },
    sea: function (R, rich) {
      let s = rays(30, -8, '#fff', 0.16, 5) + rays(76, -8, '#e8fbff', 0.12, 4);
      s += scatter(R, 9, 6, 94, 24, 100, function (x, y) { return bubble(x, y, 1 + R() * 2.2); });
      s += hill(112, 5, '#f3dba2', 0.5) + hill(120, 4, '#e8c98a', -0.4);
      const weed = function (x, h, c) { return stroke('M' + x + ' 125 Q' + (x - 6) + ' ' + (125 - h * 0.4) + ' ' + x + ' ' + (125 - h * 0.7) + ' T' + x + ' ' + (125 - h), c, 2.6); };
      s += weed(8, 36, '#3fb87a') + weed(14, 26, '#58cf8e') + weed(90, 40, '#3fb87a') + weed(96, 28, '#58cf8e');
      s += circ(24, 118, 4, '#ff8fb0') + circ(30, 115, 3.2, '#ff9ec2') + circ(77, 117, 4.4, '#ffb36b') + circ(83, 120, 3, '#ff9a5a');
      s += path('M46 128 L50 120 L54 128 Z', '#ffd36b');
      if (rich) {
        s += scatter(R, 6, 8, 92, 30, 90, function (x, y) { return ell(x, y, 3, 1.5, '#fff', 0.45) + poly(f(x + 3) + ',' + f(y) + ' ' + f(x + 5.5) + ',' + f(y - 1.6) + ' ' + f(x + 5.5) + ',' + f(y + 1.6), '#fff', 0.45); });
        s += sparkle(20, 40, 2.6, '#fff', 0.95) + sparkle(82, 56, 2, '#fff', 0.9) + sparkle(60, 30, 1.6, '#fff', 0.9);
        s += ell(50, 124, 9, 3.4, '#a8744a') + rect(41, 117, 18, 7, '#c08a58') + rect(41, 119.5, 18, 1.4, '#ffd36b') + circ(50, 121.5, 1.3, '#ffd36b');
        s += poly('66,126 69,119 72,126', '#ff9ec2') + poly('10,126 13,120 16,126', '#ffd36b');
      }
      return { bg: 'linear-gradient(#b8f1ff, #4fb4ee 52%, #1f6cc0 100%)', svg: s };
    },
    sky: function (R, rich) {
      let s = circ(24, 30, 15, '#fff6c8', 0.55) + circ(24, 30, 8.5, '#fffbe0');
      s += cloud(56, 24, 1.1, '#fff', 0.95) + cloud(-2, 60, 1.0, '#fff', 0.85) + cloud(70, 74, 1.2, '#fff', 0.85);
      s += cloud(10, 112, 1.6, '#fff', 0.95) + cloud(46, 118, 1.8, '#fff', 0.98) + cloud(78, 108, 1.3, '#fff', 0.95);
      if (rich) {
        const arcs = ['#ff7eb3', '#ffd36b', '#8fe3b0', '#7ec8ff', '#c39bff'];
        arcs.forEach(function (c, i) { s += stroke('M-4 ' + (118 - i * 3) + ' Q50 ' + (26 + i * 3) + ' 104 ' + (118 - i * 3), c, 3, 0.7); });
        s += scatter(R, 4, 10, 90, 20, 70, function (x, y) { return stroke('M' + f(x - 3) + ' ' + f(y) + ' Q' + f(x - 1.5) + ' ' + f(y - 2) + ' ' + f(x) + ' ' + f(y) + ' Q' + f(x + 1.5) + ' ' + f(y - 2) + ' ' + f(x + 3) + ' ' + f(y), '#5b4a7a', 0.9); });
        s += ell(86, 52, 4, 5, '#ff6b8a') + stroke('M86 57 L86 66', '#fff', 0.5) + ell(14, 40, 3.4, 4.2, '#ffd23f') + stroke('M14 44 L14 52', '#fff', 0.5);
        s += sparkle(40, 44, 2, '#fff', 0.95) + sparkle(70, 30, 1.7, '#fff', 0.95);
      }
      return { bg: 'linear-gradient(#4aaeff, #9fdcff 48%, #fff0d8 82%)', svg: s };
    },
    dino: function (R, rich) {
      let s = circ(72, 30, 17, '#fff0a0', 0.55) + circ(72, 30, 10, '#fff6c0');
      s += poly('4,100 24,52 44,100', '#a6603a') + poly('18,66 24,52 30,66 27,62 24,68 21,62', '#ff7a3a') + poly('62,100 80,64 98,100', '#b8714a');
      s += ell(24, 48, 6, 4, '#fff', 0.6) + ell(30, 42, 8, 5, '#fff', 0.45) + ell(20, 40, 5, 3.5, '#fff', 0.4);
      s += hill(98, 6, '#8fcf6a', 0.4);
      const fern = function (x, y, s2) { let p = ''; for (let i = 0; i < 6; i++) p += ell(x + (i - 2.5) * 3.5 * s2, y - Math.abs(i - 2.5) * -1.5 * s2 - 4 * s2, 5 * s2, 1.6 * s2, '#4fae5a'); return p + stroke('M' + x + ' ' + (y + 3) + ' L' + x + ' ' + (y - 6 * s2), '#3a8a48', 1); };
      s += fern(10, 112, 1.2) + fern(90, 110, 1.3) + fern(30, 118, 0.9);
      s += hill(114, 5, '#78b855', -0.5);
      if (rich) {
        s += stroke('M76 20 Q81 15 86 20', '#6a4a3a', 1.2) + stroke('M88 30 Q92 26 96 30', '#6a4a3a', 1.2) + stroke('M10 30 Q14 26 18 30', '#6a4a3a', 1);
        s += ell(50, 122, 11, 3.6, '#a07040') + ell(45, 119, 3.4, 4.4, '#fff4dd') + ell(51, 118.5, 3.4, 4.4, '#e8f5d0') + ell(57, 119, 3.4, 4.4, '#fff4dd');
        s += scatter(R, 4, 8, 92, 118, 134, function (x, y) { return ell(x, y, 1.6, 2.2, '#8a6a44', 0.5) + ell(x - 1.2, y - 3, 0.7, 1, '#8a6a44', 0.5) + ell(x + 1.2, y - 3, 0.7, 1, '#8a6a44', 0.5); });
        s += scatter(R, 5, 20, 86, 36, 80, function (x, y) { return circ(x, y, 0.9, '#ff7a3a', 0.8); });
      }
      return { bg: 'linear-gradient(#ffc27a, #ffe5b0 50%, #fff4d8 78%)', svg: s };
    },
    night: function (R, rich) {
      let s = circ(70, 34, 22, '#fff6c0', 0.18) + circ(70, 34, 14, '#fff7cf') + circ(65, 31, 2.4, '#f3e6a0') + circ(75, 38, 1.8, '#f3e6a0');
      s += scatter(R, 16, 4, 96, 6, 80, function (x, y, i) { return sparkle(x, y, 0.9 + (i % 3) * 0.5, '#fff', 0.9); });
      s += cloud(4, 58, 0.9, '#7a6ac0', 0.55) + cloud(60, 70, 0.8, '#8a7ad0', 0.5);
      s += hill(100, 6, '#3a2a6e', 0.4);
      s += rect(8, 80, 18, 20, '#2a1f56') + poly('6,80 17,66 28,80', '#241a4a') + rect(24, 70, 4, 14, '#2a1f56') + rect(12, 86, 4, 5, '#ffd84a') + rect(19, 86, 4, 5, '#ffb347');
      s += circ(86, 112, 6, '#ff9a3d') + rect(85.4, 105, 1.2, 3, '#4a7a3a') + circ(76, 116, 4.4, '#ff8a2d');
      s += hill(116, 4, '#241a4a', -0.4);
      if (rich) {
        s += stroke('M12 36 Q20 28 28 36', '#c39bff', 0.9, 0.9) + path('M40 24 l3 -2 l1 3 l3 -1 l-2 3 l3 2 l-4 0 l-1 3 l-2 -3 l-3 1z', '#2a1f56');
        s += scatter(R, 3, 14, 86, 30, 60, function (x, y) { return path('M' + f(x) + ' ' + f(y) + ' q-3 -3 -6 0 q2 0 3 2 q1 -2 3 -1 q1 1 3 -1 q1 -1 3 1 q3 -3 6 0 q-4 0 -4 3 q-2 -3 -3 -1 q-1 -2 -3 0 q-1 -2 -3 1z', '#1a123a'); });
        s += scatter(R, 8, 8, 92, 70, 130, function (x, y) { return circ(x, y, 1.1, '#ffe27a', 0.9) + circ(x, y, 2.6, '#ffe27a', 0.22); });
        s += rect(44, 106, 0.6, 6, '#c9b8ff') + ell(44.3, 115, 3, 3.8, '#ffe27a') + rect(66, 100, 0.6, 6, '#c9b8ff') + ell(66.3, 109, 2.6, 3.4, '#ffb36b');
        s += stroke('M0 52 Q30 40 60 52 T100 46', '#7affc0', 2.4, 0.3) + stroke('M0 58 Q30 46 60 58 T100 52', '#c39bff', 2.4, 0.3);
      }
      return { bg: 'linear-gradient(#1b1858, #4a3a98 55%, #a07ae0 100%)', svg: s };
    },
    future: function (R, rich) {
      let s = circ(78, 34, 11, '#8fd8ff') + ell(78, 34, 19, 4.2, 'none') + '<ellipse cx="78" cy="34" rx="19" ry="4.4" fill="none" stroke="#c9b3ff" stroke-width="1.4" transform="rotate(-20 78 34)"/>' + circ(75, 31, 2.6, '#fff', 0.5);
      s += scatter(R, 14, 4, 96, 6, 70, function (x, y, i) { return circ(x, y, 0.5 + (i % 3) * 0.3, '#fff', 0.85); });
      const skyline = [[2, 22, 12, '#2a3a8a'], [14, 34, 10, '#34479e'], [25, 26, 13, '#2a3a8a'], [40, 40, 11, '#3a4eaa'], [52, 28, 12, '#2a3a8a'], [65, 36, 10, '#34479e'], [76, 24, 12, '#2a3a8a'], [89, 32, 11, '#3a4eaa']];
      skyline.forEach(function (b) { s += building(b[0], 112, b[3 - 1], b[1], b[3], '#7fe3ff', 3); });
      s += rect(0, 112, 100, 28, '#1a2260') + rect(0, 112, 100, 1.2, '#7fe3ff', 0.8);
      for (let i = 0; i < 8; i++) s += rect(i * 13 + 2, 120, 7, 1.2, '#7fe3ff', 0.5) + rect(i * 13 + 6, 130, 7, 1.2, '#c9b3ff', 0.5);
      if (rich) {
        s += rect(20, 56, 8, 2.6, '#ff9ed2') + rect(28, 56.4, 3, 1.8, '#fff') + circ(20, 57.3, 1.2, '#ffd84a');
        s += rect(60, 74, 8, 2.6, '#7fe3ff') + rect(68, 74.4, 3, 1.8, '#fff') + circ(60, 75.3, 1.2, '#ffd84a');
        s += '<circle cx="50" cy="60" r="30" fill="none" stroke="#7fe3ff" stroke-width=".6" opacity=".5"/><circle cx="50" cy="60" r="38" fill="none" stroke="#c9b3ff" stroke-width=".5" stroke-dasharray="2 3" opacity=".5"/>';
        s += stroke('M8 18 L30 10', '#fff', 0.7, 0.8) + stroke('M60 8 L92 20', '#fff', 0.6, 0.7);
        s += circ(88, 80, 2, '#ff5d73') + stroke('M88 78 L88 70', '#8e9bb5', 0.8) + rect(84, 80, 8, 1, '#8e9bb5');
      }
      return { bg: 'linear-gradient(#0f1a4a, #2a3a8a 55%, #6a5ad0 100%)', svg: s };
    },
    candy: function (R, rich) {
      let s = cloud(6, 28, 1.0, '#fff', 0.95) + cloud(58, 20, 1.3, '#ffe3f1', 0.95) + cloud(70, 58, 0.9, '#fff', 0.9);
      const cane = function (x, y, h, c) { return stroke('M' + x + ' ' + y + ' L' + x + ' ' + (y - h) + ' q0 -6 5 -6 q5 0 5 5', '#fff', 3.2) + stroke('M' + x + ' ' + y + ' L' + x + ' ' + (y - h) + ' q0 -6 5 -6 q5 0 5 5', c, 1.8) + '<path d="M' + x + ' ' + y + ' L' + x + ' ' + (y - h) + '" stroke="#fff" stroke-width="1.4" stroke-dasharray="1.6 2.6" fill="none"/>'; };
      s += cane(8, 98, 38, '#ff6b9a') + cane(92, 100, 34, '#6bb8ff');
      s += hill(96, 6, '#ffd0e4', 0.5);
      s += circ(26, 94, 5, '#ff9ecb') + rect(25.4, 94, 1.2, 12, '#fff') + circ(74, 92, 5.4, '#9fe0ff') + rect(73.4, 92, 1.2, 12, '#fff');
      s += hill(110, 5, '#ffb3d1', -0.5);
      s += scatter(R, 24, 2, 98, 108, 138, function (x, y, i) { return rect(x, y, 3, 0.9, ['#ffd84a', '#7fe3ff', '#fff', '#c39bff'][i % 4]).replace('/>', ' transform="rotate(' + Math.round(R() * 180) + ' ' + f(x) + ' ' + f(y) + ')"/>'); });
      if (rich) {
        s += '<circle cx="82" cy="30" r="8" fill="none" stroke="#e8a85a" stroke-width="4.4"/><circle cx="82" cy="30" r="8" fill="none" stroke="#ff9ecb" stroke-width="2.4" stroke-dasharray="14 6"/>';
        const arcs = ['#ff7eb3', '#ffd36b', '#8fe3b0', '#7ec8ff', '#c39bff'];
        arcs.forEach(function (c, i) { s += stroke('M2 ' + (92 - i * 2.2) + ' Q30 ' + (44 + i * 2.5) + ' 62 ' + (92 - i * 2.2), c, 2.2, 0.55); });
        s += path('M44 118 l5 -12 l5 12 z', '#f3c27a') + circ(49, 104, 4.6, '#ffd1e8') + circ(49, 99, 2, '#ff3b5c');
        s += sparkle(14, 56, 2.2, '#fff', 0.95) + sparkle(88, 74, 1.8, '#fff', 0.95) + sparkle(44, 36, 1.5, '#fff', 0.9);
      }
      return { bg: 'linear-gradient(#ffd0e6, #fff0f6 55%, #ffe6b8)', svg: s };
    },
    kitchen: function (R, rich) {
      let s = rect(10, 14, 30, 32, '#bfe6ff') + rect(10, 14, 30, 32, 'none') + rect(24.4, 14, 1.2, 32, '#fff') + rect(10, 29.4, 30, 1.2, '#fff') + '<rect x="9" y="13" width="32" height="34" fill="none" stroke="#c98a58" stroke-width="2"/>';
      s += cloud(14, 24, 0.5, '#fff', 0.95);
      s += rect(58, 22, 30, 3, '#c98a58') + circ(64, 33, 6, '#ffb870') + rect(60, 27, 8, 1.6, '#a8744a') + circ(80, 32, 5.4, '#ff9a8a') + rect(76, 26.5, 8, 1.6, '#a8744a');
      s += rect(0, 100, 100, 40, '#fff6e8');
      for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) if ((r + c) % 2) s += rect(c * 9, 100 + r * 7, 9, 7, '#ff9a8a', 0.55);
      s += rect(0, 99, 100, 2, '#e8c898');
      s += ell(20, 108, 11, 3.6, '#fff') + ell(20, 106, 8, 2.4, '#ffe0b0') + circ(16, 105, 2.4, '#ff5050') + circ(22, 104, 2.2, '#7ed957') + circ(26, 106, 2, '#ffd23f');
      s += ell(80, 108, 10, 3.2, '#fff') + path('M72 106 q8 -14 16 0 z', '#ffb36b') + circ(80, 96, 2, '#fff', 0.7);
      if (rich) {
        s += stroke('M18 98 q-3 -4 0 -8 q3 -4 0 -8', '#fff', 1.4, 0.8) + stroke('M24 98 q-3 -4 0 -8 q3 -4 0 -8', '#fff', 1.2, 0.7);
        s += stroke('M44 6 L44 18', '#8a6a4a', 0.8) + ell(44, 24, 8, 6, '#b8c4d4') + rect(36, 18, 16, 2, '#8e9bb5') + stroke('M64 6 L64 12', '#8a6a4a', 0.8) + ell(64, 16, 4, 3.2, '#ffb36b');
        s += circ(48, 120, 5, '#ff7a7a') + circ(56, 122, 5, '#ffd23f') + circ(44, 126, 4.4, '#7ed957') + circ(52, 128, 4.8, '#ff9a3d');
        s += sparkle(46, 60, 1.8, '#fff', 0.9) + sparkle(92, 60, 1.5, '#fff', 0.9);
      }
      return { bg: 'linear-gradient(#fff3d8, #ffe2b0 70%, #ffd6a0)', svg: s };
    },
    town: function (R, rich) {
      let s = cloud(8, 22, 0.9, '#fff', 0.95) + cloud(60, 14, 1.1, '#fff', 0.9);
      const cols = ['#ffb0a0', '#ffd060', '#a8d8ff', '#c9e8a0', '#ffc0e0', '#ffe0a0', '#b8c4ff'];
      let x = -2, i = 0;
      while (x < 100) { const w = 12 + R() * 8, h = 28 + R() * 34; s += building(x, 104, w, h, cols[i % cols.length], '#fff7d0', 3 + (i % 2)); x += w + 1.4; i++; }
      s += rect(0, 104, 100, 36, '#7a8090') + rect(0, 104, 100, 2.2, '#c8ccd4');
      for (let k = 0; k < 7; k++) s += rect(k * 15 + 4, 122, 9, 1.6, '#fff', 0.9);
      s += rect(14, 82, 1.2, 24, '#5a6070') + circ(14.6, 80, 3, '#fff') + circ(14.6, 80, 2, '#ff6b6b');
      if (rich) {
        s += stroke('M0 40 Q25 52 50 40 T100 40', '#5a4040', 0.5);
        const flags = ['#ff6b6b', '#ffd23f', '#6bb8ff', '#7ed957'];
        for (let k = 0; k < 14; k++) { const fx = 3 + k * 7; const fy = 40 + Math.sin(k / 14 * 6.28 * 1.0) * 5.2 + 4; s += poly(f(fx) + ',' + f(fy) + ' ' + f(fx + 4) + ',' + f(fy) + ' ' + f(fx + 2) + ',' + f(fy + 5), flags[k % 4]); }
        s += ell(86, 70, 4.4, 5.4, '#ff6b8a') + stroke('M86 76 L86 88', '#fff', 0.5) + ell(94, 62, 3.6, 4.4, '#ffd23f') + stroke('M94 67 L94 76', '#fff', 0.5);
        s += tree(90, 114, 0.7, '#6fbb6a') + tree(4, 116, 0.7, '#6fbb6a');
        s += sparkle(50, 30, 1.8, '#fff', 0.95);
      }
      return { bg: 'linear-gradient(#9fd8ff, #e6f6ff 62%, #fff4dc)', svg: s };
    },
    castle: function (R, rich) {
      const arcs = ['#ff7eb3', '#ffd36b', '#8fe3b0', '#7ec8ff', '#c39bff'];
      let s = '';
      arcs.forEach(function (c, i) { s += stroke('M-6 ' + (104 - i * 3) + ' Q50 ' + (20 + i * 3) + ' 106 ' + (104 - i * 3), c, 3, 0.55); });
      s += scatter(R, 9, 6, 94, 10, 70, function (x, y, i) { return sparkle(x, y, 1 + (i % 3) * 0.6, '#fff', 0.95); });
      s += cloud(4, 60, 0.9, '#fff', 0.85) + cloud(66, 52, 1.0, '#fff', 0.85);
      const wall = '#e8d8ff', roof = '#ff9ed2';
      s += rect(38, 66, 24, 40, wall) + rect(24, 76, 14, 30, '#dcc8ff') + rect(62, 76, 14, 30, '#dcc8ff');
      s += poly('36,66 50,38 64,66', roof) + poly('22,76 31,56 40,76', roof) + poly('60,76 69,56 78,76', roof);
      s += stroke('M50 38 L50 28', '#8a6a9a', 0.8) + poly('50,28 58,31 50,34', '#ffd23f');
      s += rect(46, 90, 8, 16, '#8a5ac8') + path('M46 90 q4 -6 8 0 z', '#8a5ac8') + rect(44, 72, 4, 6, '#ffd84a') + rect(52, 72, 4, 6, '#ffd84a') + rect(28, 84, 3, 5, '#ffd84a') + rect(69, 84, 3, 5, '#ffd84a');
      s += hill(106, 5, '#bff0b8', 0.4) + hill(116, 4, '#9fe0a0', -0.5);
      s += scatter(R, 8, 4, 96, 112, 136, function (x, y, i) { return flower(x, y, 0.8, ['#ff9ecb', '#fff', '#ffe27a', '#c9a6ff'][i % 4]); });
      if (rich) {
        s += circ(16, 22, 9, '#fff6c0', 0.5) + circ(16, 22, 5.5, '#fff8d0') + circ(13, 21, 5.5, '#c9b0ff');
        const fw = function (x, y, c) { let p = ''; for (let k = 0; k < 10; k++) { const a = k * 0.628; p += stroke('M' + f(x + Math.cos(a) * 3) + ' ' + f(y + Math.sin(a) * 3) + ' L' + f(x + Math.cos(a) * 8) + ' ' + f(y + Math.sin(a) * 8), c, 0.9, 0.95); p += circ(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 0.8, c); } return p; };
        s += fw(80, 28, '#ffd84a') + fw(28, 40, '#ff9ed2');
        s += '<ellipse cx="50" cy="118" rx="26" ry="6" fill="none" stroke="#ffd84a" stroke-width=".8" opacity=".9"/><ellipse cx="50" cy="118" rx="20" ry="4.4" fill="none" stroke="#ff9ed2" stroke-width=".6" opacity=".9" stroke-dasharray="2 2"/>';
        s += scatter(R, 6, 10, 90, 60, 120, function (x, y) { return circ(x, y, 1, '#fff6a8', 0.95) + circ(x, y, 2.6, '#fff6a8', 0.25); });
      }
      return { bg: 'linear-gradient(#c3a8ff, #ffc6e4 55%, #fff0c8)', svg: s };
    }
  };
  // きせつ: カードごとに 春・夏・秋・冬 のどれか
  SCENES.season = function (R, rich, variant) {
    let s = '', bg;
    if (variant === 0) {            // 春: さくら
      bg = 'linear-gradient(#ffd0e4, #fff0f6 55%, #fff7e0)';
      s += cloud(10, 26, 0.9, '#fff', 0.9) + hill(92, 6, '#e8f5c8', 0.5);
      const sakura = function (x, y, k) { return rect(x - 1.4 * k, y - 8 * k, 2.8 * k, 10 * k, '#8a5a44') + circ(x, y - 14 * k, 9 * k, '#ffb3d1') + circ(x - 8 * k, y - 9 * k, 7 * k, '#ffc2dc') + circ(x + 8 * k, y - 9 * k, 7 * k, '#ff9ec8'); };
      s += sakura(10, 100, 1) + sakura(92, 98, 1.1) + hill(106, 5, '#bfe6a0', -0.4);
      s += scatter(R, rich ? 26 : 14, 2, 98, 20, 130, function (x, y) { return ell(x, y, 1.5, 0.9, '#ffb3d1', 0.95).replace('/>', ' transform="rotate(' + Math.round(R() * 180) + ' ' + f(x) + ' ' + f(y) + ')"/>'); });
      if (rich) s += rect(42, 118, 16, 10, '#fff', 0.9) + rect(42, 118, 16, 2, '#ff9ecb') + circ(47, 115, 2.4, '#ff9a8a') + circ(53, 115, 2.4, '#fff4dd') + sparkle(30, 44, 2, '#fff', 0.95);
    } else if (variant === 1) {     // 夏: ひまわり・うみ・入道雲
      bg = 'linear-gradient(#3fa8ff, #9fdcff 55%, #fff4d0)';
      s += circ(78, 28, 16, '#fff3a0', 0.55) + circ(78, 28, 9, '#ffe27a') + cloud(4, 44, 1.5, '#fff', 0.98) + cloud(10, 36, 1.2, '#fff', 0.98);
      s += rect(0, 88, 100, 12, '#37a0e8') + stroke('M0 92 Q12 88 25 92 T50 92 T75 92 T100 92', '#fff', 1, 0.8) + hill(104, 4, '#f6e0a8', 0.5);
      const sun = function (x, y, k) { let p = stroke('M' + x + ' ' + (y + 4) + ' L' + x + ' ' + (y + 22 * k), '#3a8a48', 1.4); for (let i = 0; i < 10; i++) { const a = i * 0.628; p += ell(x + Math.cos(a) * 5 * k, y + Math.sin(a) * 5 * k, 3.2 * k, 1.6 * k, '#ffd23f').replace('/>', ' transform="rotate(' + Math.round(a * 57.3) + ' ' + f(x + Math.cos(a) * 5 * k) + ' ' + f(y + Math.sin(a) * 5 * k) + ')"/>'); } return p + circ(x, y, 4 * k, '#8a5a2a'); };
      s += sun(10, 108, 1) + sun(92, 106, 1.1);
      if (rich) s += rect(44, 100, 12, 5, '#ff6b6b') + stroke('M46 100 L50 92 L54 100', '#fff', 1) + ell(50, 112, 9, 2, '#ff9a8a') + sparkle(26, 60, 2, '#fff', 0.95) + circ(70, 100, 2, '#ffd23f');
    } else if (variant === 2) {     // 秋: もみじ
      bg = 'linear-gradient(#ffb36b, #ffe0a8 55%, #fff4dc)';
      s += circ(24, 34, 13, '#fff0c0', 0.6) + hill(90, 7, '#e8b060', 0.5);
      const maple = function (x, y, k) { return rect(x - 1.4 * k, y - 8 * k, 2.8 * k, 10 * k, '#7a4a2a') + circ(x, y - 14 * k, 9 * k, '#e8472a') + circ(x - 8 * k, y - 9 * k, 7 * k, '#ff7a3a') + circ(x + 8 * k, y - 9 * k, 7 * k, '#ffb02a'); };
      s += maple(10, 100, 1) + maple(92, 98, 1.1) + hill(106, 5, '#d89a4a', -0.4);
      s += scatter(R, rich ? 22 : 12, 2, 98, 20, 132, function (x, y, i) { return poly(f(x) + ',' + f(y - 2) + ' ' + f(x + 1.8) + ',' + f(y) + ' ' + f(x) + ',' + f(y + 2) + ' ' + f(x - 1.8) + ',' + f(y), ['#e8472a', '#ff9a3d', '#ffc23a'][i % 3]); });
      if (rich) s += circ(46, 120, 4, '#ff9a3d') + circ(54, 122, 3.6, '#c0602a') + circ(50, 116, 3, '#ffd23f') + sparkle(30, 56, 2, '#fff', 0.9) + circ(80, 36, 6, '#fff6c8', 0.9);
    } else {                        // 冬: ゆき
      bg = 'linear-gradient(#a8c8f0, #dff0ff 55%, #fff)';
      s += cloud(8, 24, 1.0, '#fff', 0.9) + hill(92, 6, '#fff', 0.5);
      s += pine(10, 102, 1.1, '#3f8a68') + pine(90, 100, 1.2, '#3f8a68') + pine(24, 98, 0.7, '#58a880');
      s += poly('6,86 10,78 14,86', '#fff') + poly('85,80 90,70 95,80', '#fff') + hill(108, 5, '#fff', -0.4);
      s += scatter(R, rich ? 28 : 16, 2, 98, 8, 132, function (x, y, i) { return circ(x, y, 0.7 + (i % 3) * 0.4, '#fff', 0.95); });
      if (rich) s += circ(50, 120, 5.6, '#fff') + circ(50, 113, 4, '#fff') + circ(48.8, 112, 0.6, '#3d2c2e') + circ(51.2, 112, 0.6, '#3d2c2e') + poly('50,113 54,114 50,115', '#ff9a3d') + sparkle(34, 50, 2.4, '#fff', 0.95) + sparkle(76, 44, 1.8, '#fff', 0.95);
    }
    return { bg: bg, svg: s };
  };

  // SR: 銀の幾何学もよう (三角のカットが並んだ背景 + 大きな六角のふち)
  SCENES.geo = function (R) {
    let s = '';
    const cw = 100 / 8, ch = 140 / 11;
    for (let r = 0; r < 11; r++) for (let c = 0; c < 8; c++) {
      const x = c * cw, y = r * ch;
      s += poly(f(x) + ',' + f(y) + ' ' + f(x + cw) + ',' + f(y) + ' ' + f(x) + ',' + f(y + ch), '#fff', 0.04 + R() * 0.2);
      s += poly(f(x + cw) + ',' + f(y) + ' ' + f(x + cw) + ',' + f(y + ch) + ' ' + f(x) + ',' + f(y + ch), '#1a2440', 0.03 + R() * 0.2);
    }
    const hex = function (cx, cy, r) { let d = ''; for (let i = 0; i < 6; i++) { const a = i * 1.0472 - 1.5708; d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * r) + ' ' + f(cy + Math.sin(a) * r); } return d + 'Z'; };
    s += '<path d="' + hex(50, 62, 44) + '" fill="rgba(255,255,255,.14)" stroke="#fff" stroke-width="1.2" opacity=".9"/>';
    s += '<path d="' + hex(50, 62, 34) + '" fill="none" stroke="#fff" stroke-width=".6" opacity=".7"/>';
    s += '<path d="' + hex(50, 62, 52) + '" fill="none" stroke="#fff" stroke-width=".5" opacity=".5"/>';
    s += stroke('M0 100 L100 24 M0 24 L100 100', '#fff', 0.4, 0.45) + sparkle(14, 20, 3, '#fff', 0.95) + sparkle(88, 34, 2.4, '#fff', 0.95) + sparkle(76, 120, 2, '#fff', 0.9);
    return { bg: 'linear-gradient(160deg, #6f7a92, #b8c2d4 42%, #8591a8 70%, #cdd5e2)', svg: s };
  };

  function render(scene, level, seed) {
    const fn = SCENES[scene] || SCENES.forest;
    const R = rng((scene || '') + '|' + (seed || ''));
    const variant = hash(String(seed || '')) % 4;
    const out = fn(R, level === 'SAR', variant);
    return { bg: out.bg, svg: '<svg class="pc-sc" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + out.svg + '</svg>' };
  }

  return { render: render, scenes: Object.keys(SCENES) };
});
