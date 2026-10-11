/*!
 * animals.js — どうぶつの絵。SVG の文字列を作る (DOM は触らない)。
 *
 * 正面向きの、あたまが大きい等身。歩きは CSS (styles.css の .animal.walk) で動かす:
 *   sway = 左右にゆれる / bob = 1 歩ごとにはずむ / footL footR = 足を交互に上げる
 *   armL armR = 手をふる / tail = しっぽをふる / wingL wingR = はばたく
 * 絵そのものには transform を直書きしない (アニメーションが上書きするため)。
 * 左右対称にしたいものだけ、固定の matrix で反転する。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.Animals = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const INK = '#4a3436';
  const LINE = '#5b4040';
  const O = 'stroke="' + LINE + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';

  const el = function (cx, cy, rx, ry, f, x) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '" ' + (x || '') + '/>';
  };
  const ci = function (cx, cy, r, f, x) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '" ' + (x || '') + '/>';
  };
  const pg = function (pts, f, x) {
    return '<polygon points="' + pts + '" fill="' + f + '" ' + (x || '') + '/>';
  };
  const pa = function (d, f, x) {
    return '<path d="' + d + '" fill="' + f + '" ' + (x || '') + '/>';
  };
  const line = function (d, color, w, op) {
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w +
      '" stroke-linecap="round" stroke-linejoin="round"' + (op ? ' opacity="' + op + '"' : '') + '/>';
  };
  /** 左側に描いたものを、右側にも反転して描く */
  const pair = function (s) { return s + '<g transform="matrix(-1 0 0 1 100 0)">' + s + '</g>'; };
  /** ふち取りつきの太い線 (しっぽなど) */
  const fat = function (d, color, w) {
    return line(d, LINE, w + 3.2) + line(d, color, w);
  };
  const star = function (cx, cy, r, color, cls) {
    const k = r * 0.28;
    return '<path class="' + (cls || 'twinkle') + '" fill="' + color + '" d="M' + cx + ' ' + (cy - r) +
      ' Q' + (cx + k) + ' ' + (cy - k) + ' ' + (cx + r) + ' ' + cy +
      ' Q' + (cx + k) + ' ' + (cy + k) + ' ' + cx + ' ' + (cy + r) +
      ' Q' + (cx - k) + ' ' + (cy + k) + ' ' + (cx - r) + ' ' + cy +
      ' Q' + (cx - k) + ' ' + (cy - k) + ' ' + cx + ' ' + (cy - r) + 'Z"/>';
  };

  // ------------------------------------------------------------ 部品
  function earsOf(s) {
    const c = s.earC || s.body;
    const i = s.inner || s.belly || c;
    const p = s.earPos || [25, 26];
    switch (s.ears) {
      case 'round': {
        const r = s.earR || 10;
        return pair(ci(p[0], p[1], r, c, O) + ci(p[0], p[1], r * 0.5, i));
      }
      case 'point':
        return pair(pg('19,40 22,9 47,25', c, O) + pg('25,33 26,17 38,26', i));
      case 'tri':
        return pair(pg('22,36 20,16 40,25', c, O) + pg('25,31 24,22 33,26', i));
      case 'long':
        return pair('<g transform="rotate(-8 37 30)">' + el(37, 17, 7.5, 16.5, c, O) + el(37, 18, 3.6, 12, i) + '</g>');
      case 'floppy':
        return pair('<g transform="rotate(18 19 36)">' + el(19, 45, 9, 16, c, O) + '</g>');
      case 'wide':
        return pair(el(13, 47, 13, 17, c, O) + el(15, 48, 7.5, 11, i));
      default:
        return '';
    }
  }

  function tailOf(s) {
    const c = s.tailC || s.body;
    let g = '';
    switch (s.tail) {
      case 'ball':
        g = ci(76, 82, 6.5, c, O);
        break;
      case 'long':
      case 'tuft':
        g = fat('M66 84 Q92 88 88 62', c, 6);
        if (s.tailTip) g += ci(88, 61, 5, s.tailTip, O);
        break;
      case 'thin':
        g = fat('M66 84 Q90 90 88 66 Q87 58 80 60', c, 3);
        break;
      case 'fluffy':
        g = '<g transform="rotate(28 78 74)">' + el(78, 74, 9, 15, c, O) + '</g>';
        if (s.tailTip) g += ci(84.5, 63, 5.5, s.tailTip);
        break;
      case 'curl':
        g = fat('M68 80 Q82 78 79 70 Q76 65 72 70', c, 2.4);
        break;
      case 'upright':
        g = '<g transform="rotate(16 82 66)">' + el(82, 58, 12, 25, c, O) + el(83, 62, 5, 16, s.tailIn || s.belly) + '</g>';
        break;
      default:
        return '';
    }
    return '<g class="tail">' + g + '</g>';
  }

  function eyes(s) {
    if (s.noEyes) return '';
    const one = function (cx) {
      return el(cx, 48, 3.6, 4.6, INK) + ci(cx - 1.3, 46.2, 1.5, '#fff') + ci(cx + 1.2, 50.2, 0.7, '#fff');
    };
    return one(38.5) + one(61.5);
  }

  function render(s) {
    const head = s.head || s.body;
    const arm = s.arm || s.body;
    const foot = s.foot || s.body;
    const cheek = s.cheek || '#ff9bb3';
    let o = '';
    o += s.behind || '';
    o += tailOf(s);
    o += '<g class="footL">' + el(37, 88.5, 8, 5, foot, O) + '</g>';
    o += '<g class="footR">' + el(63, 88.5, 8, 5, foot, O) + '</g>';
    o += el(50, 75, 21, 16, s.body, O);
    if (s.belly && s.belly !== s.body) o += el(50, 78, 13, 10, s.belly);
    o += '<g class="armL"><g transform="rotate(14 29 73)">' + el(29, 73, 5.5, 8.5, arm, O) + '</g></g>';
    o += '<g class="armR"><g transform="rotate(-14 71 73)">' + el(71, 73, 5.5, 8.5, arm, O) + '</g></g>';
    o += earsOf(s);
    o += el(50, 46, 30, 26, head, O);
    o += s.under || '';
    o += eyes(s);
    o += el(29, 57, 5.2, 3.3, cheek, 'opacity=".55"') + el(71, 57, 5.2, 3.3, cheek, 'opacity=".55"');
    if (!s.noNose) o += el(50, 54, 2.8, 2, s.nose || INK);
    if (!s.noMouth) {
      o += line('M46.5 57.5 Q48.25 60.2 50 57.5 Q51.75 60.2 53.5 57.5', INK, 1.5);
    }
    o += s.front || '';
    return o;
  }

  // ------------------------------------------------------------ どうぶつごとの指定
  const whiskers = line('M21 55 L8 52 M21 59 L9 61', INK, 1.1, 0.55) + line('M79 55 L92 52 M79 59 L91 61', INK, 1.1, 0.55);

  const SPECS = {
    neko: {
      body: '#ffb870', belly: '#fff0dc', inner: '#ff9fb0', ears: 'point', tail: 'long',
      front: line('M46 28 L46 34 M50 27 L50 35 M54 28 L54 34', '#e08a45', 2.2) + whiskers
    },
    inu: {
      body: '#f3d9b1', belly: '#fff7ea', earC: '#b9814f', ears: 'floppy', tail: 'long',
      under: el(60.5, 46, 9.5, 10, '#b9814f'),
      front: el(50, 63.5, 3.2, 3.8, '#ff7f9d', O.replace('1.5', '1'))
    },
    usagi: {
      body: '#ffffff', belly: '#ffeef3', inner: '#ffb3c8', ears: 'long', tail: 'ball', nose: '#ff8fa8',
      tailC: '#ffeef3',
      front: '<rect x="47.4" y="59.2" width="5.2" height="5.4" rx="1.4" fill="#fff" ' + O.replace('1.5', '1') + '/>'
    },
    kuma: {
      body: '#c98f5a', belly: '#f3d3a8', inner: '#f3d3a8', ears: 'round', earR: 10, tail: 'ball',
      under: el(50, 56, 12, 9, '#f3d3a8')
    },
    hiyoko: {
      body: '#ffe066', belly: '#fff6c2', ears: 'none', tail: 'ball', foot: '#ffa94d',
      noNose: true, noMouth: true,
      front: pg('45,52.5 55,52.5 50,60.5', '#ffa94d', O) + line('M50 21 L50 12 M44.5 22 L41 14 M55.5 22 L59 14', '#e9b400', 2.4)
    },
    buta: {
      body: '#ffb3c7', belly: '#ffd9e4', earC: '#ff94b2', inner: '#ff7fa3', ears: 'tri', tail: 'curl',
      noNose: true, noMouth: true,
      front: el(50, 56, 10.5, 7.5, '#ff94b2', O) + el(46.3, 56, 1.6, 2.5, INK) + el(53.7, 56, 1.6, 2.5, INK)
    },
    nezumi: {
      body: '#c6cce0', belly: '#f2f4fb', inner: '#ffb3c8', ears: 'round', earR: 12, earPos: [24, 29],
      tail: 'thin', tailC: '#ffb3c8', nose: '#ff8fa8',
      front: whiskers + '<rect x="47.4" y="59.6" width="2.4" height="3.4" rx="0.8" fill="#fff" ' + O.replace('1.5', '0.8') + '/>' +
        '<rect x="50.2" y="59.6" width="2.4" height="3.4" rx="0.8" fill="#fff" ' + O.replace('1.5', '0.8') + '/>'
    },
    kaeru: {
      body: '#8fe388', belly: '#e6ffd6', foot: '#6fcf68', ears: 'none', tail: 'none',
      noEyes: true, noNose: true, noMouth: true,
      behind: ci(35, 26, 10, '#8fe388', O) + ci(65, 26, 10, '#8fe388', O),
      front: ci(35, 26, 7, '#fff') + ci(65, 26, 7, '#fff') +
        ci(36, 27, 3.8, INK) + ci(66, 27, 3.8, INK) + ci(34.8, 25.4, 1.4, '#fff') + ci(64.8, 25.4, 1.4, '#fff') +
        line('M36 57 Q50 67 64 57', INK, 1.6) + ci(47, 52, 0.9, INK) + ci(53, 52, 0.9, INK)
    },
    kitsune: {
      body: '#ff9a4a', belly: '#fff4e6', inner: '#fff4e6', ears: 'point', tail: 'fluffy', tailTip: '#ffffff',
      under: pair(pg('19,50 37,55 25,67', '#fff4e6'))
    },
    tanuki: {
      body: '#a98467', belly: '#f2e3cf', earC: '#6b4c3a', inner: '#8a6a55', ears: 'round', earR: 8.5, earPos: [27, 28],
      tail: 'fluffy', tailTip: '#6b4c3a',
      under: '<g transform="rotate(-22 38.5 49)">' + el(38.5, 49, 8, 6, '#7a5a46') + '</g>' +
        '<g transform="rotate(22 61.5 49)">' + el(61.5, 49, 8, 6, '#7a5a46') + '</g>' + el(50, 57, 11, 8, '#f2e3cf'),
      front: pa('M44 23 Q50 8 61 14 Q57 27 44 23 Z', '#7ed957', O) + line('M46 21 Q53 17 58 15', '#4f9f35', 1.2)
    },
    panda: {
      body: '#ffffff', belly: '#ffffff', arm: '#3d3d4a', foot: '#3d3d4a', earC: '#3d3d4a', inner: '#3d3d4a',
      ears: 'round', earR: 10, tail: 'ball',
      under: '<g transform="rotate(24 38.5 49)">' + el(38.5, 49, 7, 9.5, '#3d3d4a') + '</g>' +
        '<g transform="rotate(-24 61.5 49)">' + el(61.5, 49, 7, 9.5, '#3d3d4a') + '</g>'
    },
    hitsuji: {
      body: '#fffaf0', belly: '#fffaf0', head: '#f5dcc8', foot: '#6b5050', earC: '#f5dcc8', ears: 'floppy', tail: 'ball',
      behind: ci(24, 33, 12, '#fffaf0', O) + ci(76, 33, 12, '#fffaf0', O) + ci(50, 21, 13, '#fffaf0', O) +
        ci(19, 53, 11, '#fffaf0', O) + ci(81, 53, 11, '#fffaf0', O),
      front: ci(41, 24, 8, '#fffaf0', O) + ci(50, 21, 8.5, '#fffaf0', O) + ci(59, 24, 8, '#fffaf0', O)
    },
    shirokuma: {
      body: '#f4f9ff', belly: '#f4f9ff', inner: '#cfe3f7', ears: 'round', earR: 8.5, earPos: [27, 28], tail: 'ball',
      under: el(50, 56, 10.5, 8, '#dfeefc'),
      front: pa('M29 65 Q50 82 71 65 L70 72 Q50 88 30 72 Z', '#ff6b6b', O) + pa('M58 79 L64 92 L53 89 Z', '#ff6b6b', O)
    },
    risu: {
      body: '#d49a62', belly: '#fff0d9', inner: '#fff0d9', ears: 'tri', tail: 'upright', tailIn: '#f3c590',
      front: el(50, 79, 5.5, 6.5, '#9a6a3a', O) + pa('M43.5 76 Q50 68.5 56.5 76 Z', '#6e4524', O)
    },
    lion: {
      body: '#ffd166', belly: '#fff1c9', inner: '#e0883c', ears: 'round', earR: 7, earPos: [28, 28],
      tail: 'tuft', tailTip: '#e0883c', nose: '#c06a4a',
      behind: ci(50, 20, 13, '#e0883c', O) + ci(28, 24, 12, '#e0883c', O) + ci(72, 24, 12, '#e0883c', O) +
        ci(18, 42, 12, '#e0883c', O) + ci(82, 42, 12, '#e0883c', O) + ci(19, 61, 11, '#e0883c', O) +
        ci(81, 61, 11, '#e0883c', O) + ci(34, 70, 9, '#e0883c', O) + ci(66, 70, 9, '#e0883c', O),
      under: el(50, 57, 12, 8.5, '#fff1c9')
    },
    tora: {
      body: '#ffb03b', belly: '#fff4dd', inner: '#fff4dd', ears: 'round', earR: 9, earPos: [26, 27],
      tail: 'long', tailTip: '#4a3436',
      under: el(50, 57, 12, 8, '#fff4dd'),
      front: line('M44 27 H56 M46 31 H54 M44 35 H56 M50 27 V35', INK, 2.2) +
        pair(line('M21 44 L29 46 M20 51 L28 52', INK, 2.2)) + line('M31 70 L37 73 M69 70 L63 73', '#c9791a', 2.2)
    },
    zou: {
      body: '#b8c7e0', belly: '#e4ecf8', inner: '#ffc4d6', ears: 'wide', tail: 'thin', tailC: '#b8c7e0',
      noNose: true, noMouth: true,
      front: line('M50 53 L50 66 Q50 73 57 70', LINE, 11.5) + line('M50 53 L50 66 Q50 73 57 70', '#b8c7e0', 8.5) +
        line('M47 60 H53 M47 64 H53', '#9eb0cf', 1.1)
    },
    penguin: {
      body: '#44537a', belly: '#ffffff', arm: '#44537a', foot: '#ffab40', ears: 'none', tail: 'none',
      noNose: true, noMouth: true,
      under: pa('M29 47 Q40 36 50 44 Q60 36 71 47 Q75 63 50 71 Q25 63 29 47 Z', '#ffffff'),
      front: pg('44.5,53.5 55.5,53.5 50,61', '#ffab40', O)
    },
    unicorn: {
      body: '#fffafc', belly: '#ffeaf6', inner: '#ffc2e6', ears: 'point', tail: 'fluffy', tailC: '#ffb8e1', tailTip: '#a9a6ff',
      nose: '#ff8fb8', cheek: '#ff7fb0',
      behind: pair(ci(21, 42, 9.5, '#ff9ccf', O) + ci(18, 54, 8.5, '#b4a7ff', O) + ci(22, 64, 7, '#8fd8ff', O)),
      front: pa('M36 25 Q50 12 64 25 Q58 33 50 28 Q42 33 36 25 Z', '#ff9ccf', O) +
        pa('M43 22 Q50 20 57 22 Q54 29 50 26 Q46 29 43 22 Z', '#b4a7ff') +
        pg('45.5,22 50,1 54.5,22', '#ffd966', O) + line('M47 15 L53 13 M46.3 19 L53.7 17', '#fff3b0', 1.3) +
        star(12, 24, 5, '#ffd966') + star(89, 34, 4, '#ffd966', 'twinkle t2') + star(84, 12, 3.2, '#ff9ccf', 'twinkle t3')
    },
    dragon: {
      body: '#74d6b0', belly: '#fff1b3', ears: 'none', tail: 'long', tailTip: '#ffd966',
      nose: '#3a8f78', cheek: '#ff9bb3',
      behind: '<g class="wingL">' + pa('M36 66 Q8 48 6 70 Q14 66 18 76 Q24 70 30 78 Z', '#b49cf0', O) + '</g>' +
        '<g class="wingR">' + pa('M64 66 Q92 48 94 70 Q86 66 82 76 Q76 70 70 78 Z', '#b49cf0', O) + '</g>',
      front: pair(pg('29,27 32,9 43,22', '#ffd966', O)) +
        el(47.2, 54, 0.9, 1.1, '#3a8f78') + el(52.8, 54, 0.9, 1.1, '#3a8f78') +
        line('M44 74 H56 M45 79 H55', '#ffd54a', 1.4) + star(88, 22, 4.2, '#fff3b0') + star(10, 32, 3.4, '#fff3b0', 'twinkle t2')
    }
  };

  /**
   * どうぶつの SVG 文字列。
   * opts.walk=false で止まった絵 / opts.locked で影絵 / opts.delay で歩きのずれ (秒)
   */
  function svg(id, opts) {
    const s = SPECS[id];
    if (!s) throw new Error('絵が無い: ' + id);
    const o = opts || {};
    const cls = 'animal' + (o.walk === false || o.locked ? '' : ' walk') + (o.locked ? ' locked' : '');
    const style = o.delay != null ? ' style="--d:' + o.delay + 's"' : '';
    return '<svg class="' + cls + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"' + style + '>' +
      '<ellipse class="shadow" cx="50" cy="93" rx="26" ry="4.5" fill="#000" opacity=".13"/>' +
      '<g class="sway"><g class="bob">' + render(s) + '</g></g></svg>';
  }

  return { svg: svg, ids: Object.keys(SPECS) };
});
