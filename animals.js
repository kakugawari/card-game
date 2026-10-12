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

  /** つばさ (とり・こうもり・プテラ)。armL / armR の入れ物に入れて、歩くときに羽ばたく */
  function wingL(c) { return pa('M31 64 Q12 66 14 84 Q22 80 26 84 Q30 78 34 76 Z', c, O); }

  function render(s) {
    const head = s.head || s.body;
    const arm = s.arm || s.body;
    const foot = s.foot || s.body;
    const cheek = s.cheek || '#ff9bb3';
    let o = '';
    o += s.behind || '';
    o += tailOf(s);
    if (!s.noFeet) {
      o += '<g class="footL">' + el(37, 88.5, 8, 5, foot, O) + '</g>';
      o += '<g class="footR">' + el(63, 88.5, 8, 5, foot, O) + '</g>';
    }
    if (s.bodyEl) o += s.bodyEl;
    else if (!s.noBody) {
      o += el(50, 75, 21, 16, s.body, O);
      if (s.belly && s.belly !== s.body) o += el(50, 78, 13, 10, s.belly);
    }
    if (s.wings) {
      o += '<g class="armL">' + wingL(s.wings) + '</g>';
      o += '<g class="armR"><g transform="matrix(-1 0 0 1 100 0)">' + wingL(s.wings) + '</g></g>';
    } else if (!s.noArms) {
      o += '<g class="armL"><g transform="rotate(14 29 73)">' + el(29, 73, 5.5, 8.5, arm, O) + '</g></g>';
      o += '<g class="armR"><g transform="rotate(-14 71 73)">' + el(71, 73, 5.5, 8.5, arm, O) + '</g></g>';
    }
    o += earsOf(s);
    o += s.headEl || el(50, 46, 30, 26, head, O);
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

  // ------------------------------------------------------------ ほかのパックの なかま (仮の絵)
  // ぜんぶ同じ「あたまの大きい正面向き」の作りを使い、部品を足して作る。絵が届いたら cards.js の art で差し替わる
  const smile = line('M46.5 57.5 Q48.25 60.2 50 57.5 Q51.75 60.2 53.5 57.5', INK, 1.5);
  const oMouth = el(50, 59, 2.6, 3, '#ff7f9d', O.replace('1.5', '1'));
  const fang = pg('46,58 48,58 47,61', '#fff', O.replace('1.5', '0.8')) + pg('52,58 54,58 53,61', '#fff', O.replace('1.5', '0.8'));
  const sparkles = star(12, 26, 4.5, '#ffd966') + star(88, 30, 3.6, '#ffd966', 'twinkle t2') + star(84, 12, 3, '#ffffff', 'twinkle t3');

  // ---- うみ (さかな): 足が無く、ふわふわ泳ぐ。からだ = 大きなまる
  function fish(o) {
    const fin = o.fin || o.body;
    return Object.assign({
      noFeet: true, noArms: true, noBody: true, float: true, ears: 'none', tail: 'none', noNose: true,
      behind: (o.tailFin === false ? '' : '<g class="tail">' + pa(o.tailPath || 'M74 46 L96 30 Q90 46 96 62 Z', fin, O) + '</g>') +
        (o.dorsal === false ? '' : pa('M38 24 Q50 4 64 22 Z', fin, O)) + (o.behind2 || ''),
      front: (o.sideFins === false ? '' : pair(pa('M22 58 Q12 64 18 72 Q24 66 26 62 Z', fin, O))) + (o.front2 || '')
    }, o);
  }

  // ---- そら (とり): つばさ・くちばし・オレンジの足
  function bird(o) {
    const beak = o.beak || '#ffab40';
    return Object.assign({
      ears: 'none', tail: 'none', foot: '#ffab40', wings: o.wing || o.body, noNose: true, noMouth: true,
      front: pg('45.5,53 54.5,53 50,60', beak, O) + (o.front2 || '')
    }, o);
  }

  // ---- むかし (きょうりゅう): とげ・つの・しっぽ
  function dino(o) {
    return Object.assign({ ears: 'none', tail: 'long', tailC: o.body }, o);
  }

  // ---- よる (おばけ): すそがひらひらの体で、ふわふわ浮く
  const SHEET = 'M21 50 Q19 92 29 89 Q35 96 42 89 Q50 97 58 89 Q65 96 71 89 Q81 92 79 50 Z';
  function ghost(o) {
    return Object.assign({
      noFeet: true, float: true, ears: 'none', tail: 'none', noNose: true,
      bodyEl: pa(SHEET, o.body, O), arm: o.body
    }, o);
  }

  // ---- みらい (ロボ): 元の子を金属の色にして、アンテナと目のバイザーを足す
  function robo(base, o) {
    const b = SPECS[base];
    const metal = o.body || '#c9d3e6';
    const r = Object.assign({}, b, {
      body: metal, head: o.head || metal, belly: o.belly || '#eef3fb', arm: o.arm || metal, foot: o.foot || '#8e9bb5',
      earC: o.earC || metal, inner: o.inner || '#7fe3ff', tailC: o.tailC || metal, cheek: '#7fe3ff', nose: '#4a5a7a'
    });
    r.under = (o.keepUnder ? b.under || '' : '') + (o.under2 || '');
    r.behind = (o.keepBehind === false ? '' : b.behind || '') + (o.behind2 || '');
    r.front = (o.keepFront ? b.front || '' : '') +
      line('M50 20 L50 9', '#5b6b8a', 2) + ci(50, 8, 3.2, o.light || '#ff5d73', O) +       // アンテナ
      line('M31 72 L35 72 M65 72 L69 72', '#5b6b8a', 1.4) + ci(50, 78, 2.2, o.light || '#7fe3ff') +   // むねのランプ
      (o.front2 || '');
    return r;
  }

  const MORE = {
    // ======================================== うみ
    kingyo: fish({ body: '#ff8a5b', fin: '#ff6b4a', under: el(50, 56, 15, 10, '#ffc2a0'),
      tailPath: 'M74 46 Q92 24 98 34 Q88 46 98 60 Q92 70 74 48 Z', front2: oMouth }),
    kumanomi: fish({ body: '#ff9a3c', fin: '#ff7a1c', under: el(34, 46, 4.5, 24, '#fff', O) + el(66, 46, 4.5, 24, '#fff', O), front2: smile }),
    fugu: fish({ body: '#ffe08a', fin: '#f5c542', dorsal: false, under: el(50, 58, 16, 10, '#fff8dc'),
      behind2: pair(pg('20,30 14,24 24,26', '#e0b030', O) + pg('16,46 8,46 16,40', '#e0b030', O) + pg('20,62 13,68 22,66', '#e0b030', O)), front2: oMouth }),
    tako: Object.assign({ body: '#ff7f8f', noFeet: true, noArms: true, noBody: true, float: true, ears: 'none', tail: 'none', noNose: true,
      behind: [28, 38, 46, 54, 62, 72].map(function (x, i) { return fat('M' + x + ' 64 Q' + (x + (i % 2 ? 4 : -4)) + ' 84 ' + (x + (i < 3 ? -6 : 6)) + ' 88', '#ff7f8f', 7); }).join(''),
      front: smile + ci(36, 66, 1.6, '#ffd0d8') + ci(64, 66, 1.6, '#ffd0d8') }),
    kurage: Object.assign({ body: '#ffc2e6', noFeet: true, noArms: true, noBody: true, float: true, ears: 'none', tail: 'none', noNose: true,
      headEl: pa('M20 52 Q20 18 50 18 Q80 18 80 52 Q72 58 65 52 Q57 58 50 52 Q43 58 35 52 Q28 58 20 52 Z', '#ffc2e6', O),
      behind: line('M32 54 Q28 70 34 86 M44 56 Q48 72 42 90 M56 56 Q52 72 58 90 M68 54 Q72 70 66 86', '#ff9ccf', 2.4),
      front: oMouth + ci(36, 30, 3, '#fff', 'opacity=".7"') }),
    kani: Object.assign({ body: '#ff6b5b', belly: '#ffb3a6', ears: 'none', tail: 'none', noNose: true, foot: '#ff6b5b',
      behind: pair(line('M28 34 L20 18', LINE, 6) + line('M28 34 L20 18', '#ff6b5b', 3.4) + ci(18, 14, 8, '#ff6b5b', O) + pg('14,8 22,14 12,16', '#fff8f0')) +
        pair(line('M24 74 L10 80 M24 80 L12 88', LINE, 3.4) + line('M24 74 L10 80 M24 80 L12 88', '#ff6b5b', 1.8)),
      front: smile }),
    iruka: fish({ body: '#8fb8e8', fin: '#7aa4d8', under: el(50, 60, 17, 10, '#eef6ff'),
      front2: el(50, 60, 8, 4.6, '#b9d4f2', O) + smile.replace(/57\.5/g, '63').replace(/60\.2/g, '65.6') }),
    manta: fish({ body: '#5a6f9e', fin: '#4a5e8a', dorsal: false, sideFins: false, tailFin: false, under: el(50, 58, 16, 10, '#e6ecf8'),
      behind2: pair(pa('M30 38 Q2 40 4 64 Q18 56 32 58 Z', '#5a6f9e', O)) + fat('M50 70 L50 96', '#5a6f9e', 2), front2: smile }),
    kujira: fish({ body: '#5f8fd6', fin: '#4f7cc0', dorsal: false,
      under: pa('M28 58 Q50 70 72 58 Q70 68 50 72 Q30 68 28 58 Z', '#e6f0ff') + line('M36 62 L36 68 M44 64 L44 71 M56 64 L56 71 M64 62 L64 68', '#b9cff2', 1.2),
      front2: line('M50 20 L50 10 M50 12 Q44 4 40 8 M50 12 Q56 4 60 8', '#7fc8ff', 2.4) + smile }),
    nijiuo: fish({ body: '#c9b3ff', fin: '#ff9ccf',
      under: line('M34 36 Q38 32 42 36 M46 34 Q50 30 54 34 M58 36 Q62 32 66 36 M30 46 Q34 42 38 46 M62 46 Q66 42 70 46', '#ffd36b', 2) +
        line('M36 66 Q40 62 44 66 M56 66 Q60 62 64 66', '#8fe3b0', 2),
      front2: smile + sparkles }),

    // ======================================== そら
    suzume: bird({ body: '#c89a6a', head: '#a86e42', belly: '#fff4e6', wing: '#8a5a34', cheek: '#5a3a2a',
      under: el(50, 58, 12, 8, '#fff4e6') }),
    niwatori: bird({ body: '#ffffff', belly: '#fff8ee', wing: '#f3ead8', beak: '#ffc04a',
      front2: ci(44, 21, 5, '#ff5d5d', O) + ci(51, 18, 6, '#ff5d5d', O) + ci(58, 22, 5, '#ff5d5d', O) + el(50, 64, 3.4, 4.4, '#ff5d5d', O) }),
    ahiru: bird({ body: '#fff3b0', belly: '#ffffff', wing: '#ffe680', beak: '#ff9a3c',
      front: el(50, 57, 9, 4.6, '#ff9a3c', O) + line('M43 57 L57 57', '#d97a20', 1) }),
    hato: bird({ body: '#b6c0d8', head: '#a8b2cc', belly: '#e4e8f2', wing: '#8e9ab8', beak: '#6b7280',
      under: pa('M26 64 Q50 76 74 64 Q72 70 50 74 Q28 70 26 64 Z', '#8fd0b8') }),
    fukurou: bird({ body: '#a57b56', belly: '#f2dcc0', wing: '#7a5636', ears: 'tri', earC: '#7a5636', inner: '#a57b56',
      under: ci(38.5, 48, 9, '#fff4e0', O) + ci(61.5, 48, 9, '#fff4e0', O),
      front: pg('47,54 53,54 50,59', '#ffab40', O) + line('M40 70 Q44 73 48 70 M52 70 Q56 73 60 70 M44 78 Q48 81 52 78', '#8a6644', 1.4) }),
    inko: bird({ body: '#8fe07a', head: '#ffe066', belly: '#c8f5b8', wing: '#5fc04a', beak: '#ff9a3c', cheek: '#7ab8ff',
      front2: line('M44 26 Q50 22 56 26', '#e0c040', 1.4) }),
    tsuru: bird({ body: '#ffffff', belly: '#ffffff', wing: '#3d3d4a', beak: '#e0c060', foot: '#3d3d4a',
      front2: ci(50, 22, 7, '#ff4a4a', O), behind: pair(pg('30,80 20,94 34,88', '#3d3d4a', O)) }),
    kujaku: bird({ body: '#4f8fdc', head: '#4f8fdc', belly: '#8fd0f5', wing: '#3a72b8', beak: '#ffc04a',
      behind: [-60, -36, -12, 12, 36, 60].map(function (a) {
        const r = a * Math.PI / 180, x = 50 + Math.sin(r) * 40, y = 60 - Math.cos(r) * 40;
        return line('M50 60 L' + x.toFixed(1) + ' ' + y.toFixed(1), '#4fb07a', 3) + el(x, y, 7, 9, '#4fb07a', O) + el(x, y, 3.5, 4.5, '#3a72b8') + ci(x, y, 1.6, '#ffd966');
      }).join(''),
      front2: line('M50 20 L46 12 M50 20 L50 10 M50 20 L54 12', '#3a72b8', 1.6) + ci(46, 12, 1.8, '#3a72b8') + ci(50, 10, 1.8, '#3a72b8') + ci(54, 12, 1.8, '#3a72b8') }),
    flamingo: bird({ body: '#ff9cc0', belly: '#ffc4da', wing: '#ff7fae', beak: '#ffffff', foot: '#ff7fae',
      front: pa('M45 53 L55 53 Q56 58 50 61 Q48 58 46 58 Z', '#fff', O) + pa('M49 58 Q50 61 52 59 L50 62 Z', '#3d3d4a') }),
    hinotori: bird({ body: '#ff7a3c', head: '#ff9a3c', belly: '#ffd36b', wing: '#ff5a3c', beak: '#ffe066',
      behind: pair(pa('M30 80 Q8 70 6 92 Q18 86 30 92 Z', '#ffb03b', O)),
      front2: pa('M42 24 Q40 8 46 16 Q48 4 52 16 Q56 4 58 16 Q62 10 58 24 Z', '#ffd36b', O) + sparkles }),

    // ======================================== むかし
    tirano: dino({ body: '#7ccf6a', belly: '#e9f7c9', front: fang + smile,
      behind: pg('34,22 38,12 42,22', '#4fa043', O) + pg('46,19 50,8 54,19', '#4fa043', O) + pg('58,22 62,12 66,22', '#4fa043', O) }),
    torikera: dino({ body: '#ffb26b', belly: '#fff0d6',
      behind: el(50, 34, 40, 26, '#ff8a4a', O) + pair(ci(20, 30, 3, '#ffd6a6') + ci(28, 16, 3, '#ffd6a6')),
      front: pair(pg('36,30 38,14 42,30', '#fff8ee', O)) + pg('47,52 50,42 53,52', '#fff8ee', O) + smile }),
    sutego: dino({ body: '#8fc9e8', belly: '#e6f5ff',
      behind: pg('22,40 16,20 34,30', '#ff9a5a', O) + pg('34,26 36,4 50,20', '#ff9a5a', O) + pg('50,20 64,4 66,26', '#ff9a5a', O) + pg('66,30 84,20 78,40', '#ff9a5a', O),
      tailTip: '#ff9a5a' }),
    putera: dino({ body: '#b49cf0', belly: '#ece4ff', tail: 'none', wings: '#9a7fe6', noNose: true, noMouth: true,
      behind: pg('60,26 92,14 70,34', '#9a7fe6', O),
      front: pg('44,54 56,54 50,66', '#ffd36b', O) }),
    burakio: dino({ body: '#9fd8c0', belly: '#e6fbf2',
      under: ci(30, 36, 3, '#7cc4a8') + ci(68, 32, 3.6, '#7cc4a8') + ci(62, 66, 2.6, '#7cc4a8'),
      behind: el(50, 26, 18, 18, '#9fd8c0', O) }),
    ankiro: dino({ body: '#c9a273', belly: '#f2e3cf', tailTip: '#a07a4a',
      behind: [20, 32, 44, 56, 68, 80].map(function (x, i) { return pg((x - 5) + ',' + (i % 2 ? 30 : 34) + ' ' + x + ',' + (i % 2 ? 18 : 22) + ' ' + (x + 5) + ',' + (i % 2 ? 30 : 34), '#a07a4a', O); }).join('') }),
    pakike: dino({ body: '#e0a46b', belly: '#fbe6cc',
      behind: el(50, 26, 26, 18, '#f5c48a', O) + pair(ci(26, 28, 3, '#c98a50', O) + ci(32, 18, 2.6, '#c98a50', O)) }),
    supino: dino({ body: '#5fa8c8', belly: '#d8f0fa',
      behind: pa('M24 40 Q22 4 40 16 Q50 -2 60 16 Q78 4 76 40 Z', '#ff7a5a', O) + line('M36 18 L40 38 M50 8 L50 36 M64 18 L60 38', '#e05a3a', 1.4),
      front: fang + smile }),
    raputoru: dino({ body: '#9bb06a', belly: '#eef5d6',
      under: line('M24 40 L30 44 M22 50 L29 52 M76 40 L70 44 M78 50 L71 52', '#6a7a3a', 2),
      front: pa('M44 22 Q48 8 52 20 Q56 10 58 22 Z', '#ff9a5a', O) + fang + smile }),
    kohaku: dino({ body: '#ffcf6b', belly: '#fff3c4', tailTip: '#ffe9a8',
      behind: pg('30,26 34,8 40,24', '#fff1b0', O) + pg('44,20 50,0 56,20', '#fff1b0', O) + pg('60,24 66,8 70,26', '#fff1b0', O),
      front: sparkles + smile }),

    // ======================================== よる
    shiroobake: ghost({ body: '#ffffff', head: '#ffffff', noMouth: true, cheek: '#ffb3c8',
      front: pa('M45 58 Q50 66 55 58 Z', '#ff7f9d', O.replace('1.5', '1')) }),
    kabocha: Object.assign({ body: '#ff9a3c', noFeet: true, noArms: true, noBody: true, float: true, ears: 'none', tail: 'none', noNose: true,
      headEl: el(50, 50, 32, 28, '#ff9a3c', O) + line('M38 24 Q30 50 38 76 M62 24 Q70 50 62 76 M50 22 L50 78', '#e07a1c', 1.6),
      behind: pa('M48 24 Q46 12 54 10 L56 14 Q52 16 53 24 Z', '#5fa040', O) + pa('M54 18 Q66 10 70 18 Q62 22 54 20 Z', '#7ed957', O),
      front: pa('M42 60 L46 64 L50 60 L54 64 L58 60 Q50 70 42 60 Z', '#5a3a2a') }),
    chouchin: Object.assign({ body: '#ffe7b0', noFeet: true, noArms: true, noBody: true, float: true, ears: 'none', tail: 'none', noNose: true,
      headEl: el(50, 50, 28, 32, '#ffe7b0', O) + line('M24 38 Q50 34 76 38 M23 50 Q50 46 77 50 M24 62 Q50 58 76 62', '#e0b070', 1.2) +
        '<rect x="38" y="15" width="24" height="7" rx="2" fill="#e05a4a" ' + O + '/>' + '<rect x="38" y="78" width="24" height="7" rx="2" fill="#e05a4a" ' + O + '/>',
      front: pa('M45 60 Q50 72 55 60 Z', '#ff5d73', O.replace('1.5', '1')) }),
    nekoobake: ghost({ body: '#f3ecff', head: '#f3ecff', ears: 'point', earC: '#f3ecff', inner: '#ffb3c8', front: whiskers }),
    koumori: Object.assign({ body: '#6b5a9e', belly: '#9a8ad0', ears: 'point', inner: '#ff9ccf', tail: 'none', wings: '#4a3a7a', foot: '#4a3a7a',
      noMouth: true, front: fang + line('M46.5 57 Q50 59.5 53.5 57', INK, 1.4) }),
    miira: Object.assign({ body: '#f2ead8', belly: '#f2ead8', ears: 'none', tail: 'none', noNose: true,
      under: line('M22 34 L78 30 M20 42 L80 40 M22 64 L78 66', '#d8ccb0', 2.4) + pg('20,42 50,44 22,50', '#d8ccb0'),
      front: smile }),
    yukiobake: ghost({ body: '#e6f4ff', head: '#e6f4ff', cheek: '#9fd0ff',
      front: smile + star(20, 22, 4, '#ffffff', 'twinkle') + star(82, 30, 3.4, '#ffffff', 'twinkle t2') + star(76, 80, 3, '#ffffff', 'twinkle t3') }),
    majoneko: Object.assign({}, SPECS.neko, { body: '#4a4466', head: '#4a4466', belly: '#7a7499', inner: '#ff9ccf', tailC: '#4a4466', earC: '#4a4466',
      front: whiskers + pa('M22 26 L50 -2 L78 26 Q50 32 22 26 Z', '#7a4ac0', O) + el(50, 26, 34, 5, '#7a4ac0', O) + '<rect x="40" y="18" width="20" height="5" fill="#ffd966"/>' }),
    gaikotsu: Object.assign({ body: '#3d3d4a', head: '#f8f8f0', belly: '#3d3d4a', arm: '#3d3d4a', foot: '#f8f8f0', ears: 'none', tail: 'none', noNose: true,
      under: pa('M47 53 L50 49 L53 53 Z', INK),
      front: line('M40 68 L60 68 M42 74 L58 74 M44 80 L56 80 M50 64 L50 84', '#f8f8f0', 2.2) + smile }),
    obakeou: ghost({ body: '#ffffff', head: '#ffffff', cheek: '#ffb3c8',
      behind: pa('M18 52 Q10 90 26 92 L74 92 Q90 90 82 52 Z', '#d0405a', O),
      front: smile + pg('34,24 36,8 43,16 50,4 57,16 64,8 66,24', '#ffd966', O) + ci(50, 16, 2.2, '#ff5d73') + sparkles })
  };
  Object.assign(SPECS, MORE);

  // みらい: ロボの なかま (元の子の形を使う)
  Object.assign(SPECS, {
    robon: robo('neko', { light: '#7fe3ff' }),
    roboinu: robo('inu', { body: '#d6dce8', earC: '#8e9bb5', light: '#ffd966' }),
    robousa: robo('usagi', { body: '#eef3fb', inner: '#ff9ccf' }),
    robopiyo: robo('hiyoko', { body: '#ffe680', head: '#ffe680', belly: '#fff6c2', keepFront: true }),
    robokuma: robo('kuma', { body: '#b8c2d6', light: '#ff9a3c' }),
    jetpen: robo('penguin', { body: '#5a6f9e', head: '#5a6f9e', belly: '#ffffff', arm: '#5a6f9e', foot: '#8e9bb5', keepFront: true, keepUnder: true,
      behind2: pair('<rect x="22" y="66" width="10" height="18" rx="3" fill="#b8c2d6" ' + O + '/>' + pa('M23 84 L31 84 L27 96 Z', '#ffb03b')) }),
    neonkitsu: robo('kitsune', { body: '#2a2f55', head: '#2a2f55', belly: '#3a4070', earC: '#2a2f55', inner: '#ff5df0', tailC: '#2a2f55', light: '#5dfff0',
      under2: line('M24 52 L36 56 M76 52 L64 56', '#5dfff0', 1.8) }),
    uchulion: robo('lion', { body: '#ffd166', head: '#ffd166', belly: '#fff1c9', keepBehind: true, keepUnder: true,
      front2: ci(50, 46, 38, 'rgba(180,230,255,.25)', 'stroke="#9fd8ff" stroke-width="2"') + ci(34, 24, 4, '#fff', 'opacity=".8"') }),
    mechadra: robo('dragon', { body: '#9aa6bf', head: '#9aa6bf', belly: '#d6dce8', light: '#ff5d73', keepBehind: true,
      front2: pair(pg('29,27 32,9 43,22', '#ffb03b', O)) }),
    galaxyuni: robo('unicorn', { body: '#2a2f6e', head: '#2a2f6e', belly: '#4a4f9e', earC: '#2a2f6e', inner: '#c39bff', tailC: '#c39bff', light: '#ffd966',
      keepBehind: true, keepFront: true, under2: ci(30, 34, 1.2, '#fff') + ci(66, 30, 1, '#fff') + ci(60, 62, 1.3, '#fff') + ci(40, 66, 1, '#fff') })
  });

  // ------------------------------------------------------------ かざり (packs.js のなかまに付ける)
  // ACC[名前](色) → { front, behind }。あたまは 中心 (50,46)・てっぺん y=20 あたり
  const heartD = function (x, y, r) {
    return 'M' + x + ' ' + (y + r) + ' C' + (x - r * 1.6) + ' ' + (y - r * 0.2) + ' ' + (x - r * 0.7) + ' ' + (y - r * 1.4) + ' ' + x + ' ' + (y - r * 0.4) +
      ' C' + (x + r * 0.7) + ' ' + (y - r * 1.4) + ' ' + (x + r * 1.6) + ' ' + (y - r * 0.2) + ' ' + x + ' ' + (y + r) + ' Z';
  };
  const starD = function (cx, cy, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      d += (i ? ' L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return d + ' Z';
  };
  const O1 = O.replace('1.5', '1.1');
  const ACC = {
    crown: function (c) { return { front: pg('37,23 36,9 43.5,16 50,6 56.5,16 64,9 63,23', c || '#ffd84a', O) + ci(50, 17, 2, '#ff5d8a') + ci(42, 19, 1.4, '#5dc8ff') + ci(58, 19, 1.4, '#7be07b') }; },
    tiara: function (c) { return { front: pa('M35 24 Q50 12 65 24 Q50 18 35 24 Z', c || '#e9eef8', O1) + pa('M50 9 L54 16 L50 21 L46 16 Z', '#9fe0ff', O1) }; },
    tophat: function (c) { return { front: el(50, 21, 17, 3.6, c || '#3d3a4a', O) + '<rect x="40" y="2" width="20" height="18" rx="2" fill="' + (c || '#3d3a4a') + '" ' + O + '/>' + '<rect x="40.8" y="14" width="18.4" height="3.6" fill="#ff6b8a"/>' }; },
    ribbon: function (c) { const k = c || '#ff6b9a'; return { front: pa('M66 22 L56 14 L57 30 Z', k, O) + pa('M66 22 L77 14 L76 30 Z', k, O) + ci(66, 22, 3.2, k, O) }; },
    flower: function (c) { const k = c || '#ff9ecb'; let f = ''; for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.57; f += ci(69 + Math.cos(a) * 4.6, 21 + Math.sin(a) * 4.6, 3.6, k, O1); } return { front: f + ci(69, 21, 2.8, '#ffd84a', O1) }; },
    leaf: function (c) { return { front: pa('M50 22 Q38 10 50 2 Q62 10 50 22 Z', c || '#7ed957', O) + line('M50 21 L50 6', '#4f9f35', 1.2) }; },
    sprout: function (c) { const k = c || '#7ed957'; return { front: line('M50 21 L50 11', '#5aa83c', 2) + pa('M50 12 Q40 4 36 10 Q42 16 50 12 Z', k, O1) + pa('M50 12 Q60 4 64 10 Q58 16 50 12 Z', k, O1) }; },
    star: function (c) { return { front: pa(starD(50, 12, 8.5), c || '#ffd84a', O) }; },
    heart: function (c) { return { front: pa(heartD(69, 22, 5.5), c || '#ff6b8a', O) }; },
    glasses: function (c) { const k = c || '#5b4040'; return { front: '<circle cx="38.5" cy="48" r="6.4" fill="rgba(255,255,255,.25)" stroke="' + k + '" stroke-width="1.8"/><circle cx="61.5" cy="48" r="6.4" fill="rgba(255,255,255,.25)" stroke="' + k + '" stroke-width="1.8"/>' + line('M44.9 47 Q50 44.5 55.1 47', k, 1.6) }; },
    sunglasses: function (c) { const k = c || '#2c2a3a'; return { front: pa('M30 43 H47 Q47 53 39 53 Q30 53 30 43 Z', k, O1) + pa('M53 43 H70 Q70 53 61 53 Q53 53 53 43 Z', k, O1) + line('M47 45 L53 45', k, 1.6) + line('M33 45 L37 47', '#fff', 1, 0.7) + line('M56 45 L60 47', '#fff', 1, 0.7) }; },
    scarf: function (c) { const k = c || '#ff6b6b'; return { front: pa('M29 65 Q50 80 71 65 L70 72 Q50 87 30 72 Z', k, O) + pa('M58 78 L65 92 L54 89 Z', k, O) }; },
    bowtie: function (c) { const k = c || '#ff5d73'; return { front: pa('M50 70 L41 65 L41 75 Z', k, O1) + pa('M50 70 L59 65 L59 75 Z', k, O1) + ci(50, 70, 2.2, k, O1) }; },
    cap: function (c) { const k = c || '#4d8dff'; return { front: pa('M28 27 Q30 8 50 8 Q70 8 72 27 Z', k, O) + pa('M50 27 Q66 22 82 27 Q70 31 50 29 Z', k, O) + ci(50, 9, 2, '#fff', O1) }; },
    beret: function (c) { return { front: '<g transform="rotate(-10 50 18)">' + el(50, 18, 19, 7, c || '#e0475b', O) + '</g>' + line('M50 11 L51 6', '#5b4040', 2) }; },
    witchhat: function (c) { const k = c || '#6a4bc4'; return { front: el(50, 22, 22, 4.5, k, O) + pa('M37 21 Q46 12 50 -2 Q58 4 63 21 Z', k, O) + '<rect x="38" y="16.5" width="24" height="3.6" fill="#ffd84a"/>' }; },
    halo: function (c) { return { front: '<ellipse cx="50" cy="8" rx="13" ry="4" fill="none" stroke="' + LINE + '" stroke-width="5"/><ellipse cx="50" cy="8" rx="13" ry="4" fill="none" stroke="' + (c || '#ffe680') + '" stroke-width="3"/>' }; },
    horns: function (c) { const k = c || '#fff1c9'; return { front: pa('M36 25 Q30 14 36 6 Q38 16 43 22 Z', k, O) + pa('M64 25 Q70 14 64 6 Q62 16 57 22 Z', k, O) }; },
    antenna: function (c) { const k = c || '#ff7fb0'; return { front: line('M43 21 Q38 12 34 6', LINE, 1.8) + line('M57 21 Q62 12 66 6', LINE, 1.8) + ci(34, 6, 3.4, k, O1) + ci(66, 6, 3.4, k, O1) }; },
    headphones: function (c) { const k = c || '#ff5d73'; return { front: line('M21 46 Q20 12 50 12 Q80 12 79 46', LINE, 4.6) + line('M21 46 Q20 12 50 12 Q80 12 79 46', '#5d5d70', 2.6) + el(20, 48, 5.5, 8, k, O) + el(80, 48, 5.5, 8, k, O) }; },
    chefhat: function (c) { const k = c || '#ffffff'; return { front: ci(41, 12, 7.5, k, O) + ci(59, 12, 7.5, k, O) + ci(50, 8, 8.5, k, O) + '<rect x="38" y="13" width="24" height="10" rx="2" fill="' + k + '" ' + O + '/>' }; },
    helmet: function (c) { const k = c || '#ff5d5d'; return { front: pa('M23 36 Q24 10 50 10 Q76 10 77 36 Q50 28 23 36 Z', k, O) + line('M50 11 L50 30', '#fff', 2.4, 0.8) }; },
    hardhat: function (c) { const k = c || '#ffd23f'; return { front: pa('M27 27 Q28 8 50 8 Q72 8 73 27 Z', k, O) + el(50, 27, 26, 3.5, k, O) + line('M50 9 L50 25', '#e8b800', 2.2) }; },
    strawhat: function (c) { const k = c || '#f3d28a'; return { front: el(50, 22, 28, 6, k, O) + pa('M36 22 Q36 6 50 6 Q64 6 64 22 Z', k, O) + '<rect x="36" y="15.5" width="28" height="4.4" fill="#ff5d5d"/>' }; },
    piratehat: function (c) { const k = c || '#33303d'; return { front: pa('M22 24 Q28 4 50 10 Q72 4 78 24 Q50 16 22 24 Z', k, O) + ci(50, 15, 3, '#fff') + line('M47 19 L53 19', '#fff', 1.4) }; },
    headband: function (c) { const k = c || '#ff5d5d'; return { front: pa('M22 30 Q50 22 78 30 L78 35 Q50 27 22 35 Z', k, O1) + pa('M78 31 L90 26 L88 34 Z', k, O1) + pa('M78 33 L91 37 L86 41 Z', k, O1) }; },
    santahat: function (c) { const k = c || '#e8434f'; return { front: pa('M30 23 Q40 0 66 4 Q80 8 82 22 Q74 14 70 23 Z', k, O) + el(50, 23, 21, 4.5, '#fff', O) + ci(83, 22, 4.5, '#fff', O) }; },
    knitcap: function (c) { const k = c || '#5db8ff'; return { front: pa('M26 28 Q27 6 50 6 Q73 6 74 28 Z', k, O) + '<rect x="25" y="23" width="50" height="7" rx="3.5" fill="' + k + '" ' + O + '/>' + ci(50, 5, 5, '#fff', O) + line('M38 10 L38 22 M50 7 L50 22 M62 10 L62 22', '#fff', 1, 0.45) }; },
    earmuffs: function (c) { const k = c || '#ff9ecb'; return { front: line('M22 44 Q22 14 50 14 Q78 14 78 44', LINE, 3.8) + line('M22 44 Q22 14 50 14 Q78 14 78 44', '#c9a0ff', 2) + ci(20, 46, 7.5, k, O) + ci(80, 46, 7.5, k, O) }; },
    cherry: function (c) { const k = c || '#e8334a'; return { front: line('M64 22 Q68 10 74 6 Q76 12 74 22', '#4f9f35', 1.4) + ci(64, 23, 4.2, k, O1) + ci(74, 23, 4.2, k, O1) + ci(63, 21.8, 1.1, '#fff') + ci(73, 21.8, 1.1, '#fff') }; },
    strawberry: function (c) { return { front: pa('M50 26 Q38 14 44 6 Q50 3 56 6 Q62 14 50 26 Z', c || '#ff4f66', O) + pa('M43 7 L50 3 L57 7 L53 9 L50 5 L47 9 Z', '#5dbb4a', O1) + ci(47, 12, 0.8, '#fff3b0') + ci(53, 12, 0.8, '#fff3b0') + ci(50, 17, 0.8, '#fff3b0') }; },
    apple: function (c) { return { front: pa('M50 22 Q38 22 39 12 Q41 5 50 8 Q59 5 61 12 Q62 22 50 22 Z', c || '#ff5050', O) + line('M50 8 L51 3', '#7a5030', 1.6) + pa('M51 5 Q57 1 59 4 Q55 7 51 5 Z', '#7ed957', O1) }; },
    cake: function (c) { return { front: '<rect x="39" y="10" width="22" height="12" rx="2" fill="#fff4e0" ' + O + '/>' + pa('M39 13 Q42 17 45 13 Q48 17 51 13 Q54 17 57 13 Q59 16 61 13 L61 11 Q61 10 60 10 L40 10 Q39 10 39 11 Z', c || '#ff9ecb') + ci(50, 7, 3.2, '#ff3b5c', O1) }; },
    donut: function (c) { return { front: ci(50, 13, 9, '#e8b36b', O) + ci(50, 13, 7.2, c || '#ff8fc7') + ci(50, 13, 3, '#fff', O1) + line('M44 9 L45 11 M55 9 L54 11 M47 18 L49 18 M56 15 L57 17', '#fff', 1.2) }; },
    icecream: function (c) { return { front: pg('43,14 57,14 50,28', '#f2c27a', O) + ci(50, 10, 7.5, c || '#ffd1e8', O) + ci(50, 3, 2.4, '#ff3b5c', O1) }; },
    candy: function (c) { const k = c || '#ff6b9a'; return { front: pa('M60 22 L54 17 L54 27 Z', k, O1) + pa('M78 22 L84 17 L84 27 Z', k, O1) + el(69, 22, 9, 6, '#fff', O) + line('M64 17.5 L66 26.5 M70 16.5 L72 27 M75 18 L76 25', k, 2) }; },
    mushroom: function (c) { return { front: '<rect x="45.5" y="12" width="9" height="10" rx="3" fill="#fff4e0" ' + O + '/>' + pa('M34 15 Q36 1 50 1 Q64 1 66 15 Z', c || '#ff5050', O) + ci(44, 8, 2.2, '#fff') + ci(56, 7, 2.6, '#fff') + ci(50, 12, 1.6, '#fff') }; },
    flame: function (c) { return { front: pa('M50 24 Q38 18 44 6 Q46 12 50 10 Q48 2 54 -2 Q56 8 60 10 Q64 18 50 24 Z', c || '#ff8a3d', O) + pa('M50 22 Q45 18 48 12 Q50 15 53 13 Q56 18 50 22 Z', '#ffe066') }; },
    bubble: function (c) { const k = c || '#9fe0ff'; return { front: '<circle cx="84" cy="30" r="6" fill="rgba(255,255,255,.35)" stroke="' + k + '" stroke-width="1.6"/><circle cx="90" cy="18" r="3.6" fill="rgba(255,255,255,.35)" stroke="' + k + '" stroke-width="1.4"/><circle cx="82" cy="12" r="2.2" fill="none" stroke="' + k + '" stroke-width="1.2"/>' + ci(82, 28, 1.4, '#fff') }; },
    note: function (c) { const k = c || '#6a8bff'; return { front: '<g class="twinkle t2">' + line('M86 30 L86 14 L93 12', k, 2) + el(83.5, 30.5, 3.2, 2.5, k) + '</g>' }; },
    bolt: function (c) { return { front: pg('84,6 76,22 83,22 78,34 92,16 85,16 90,6', c || '#ffd23f', O1) }; },
    cloud: function (c) { const k = c || '#ffffff'; return { front: '<g class="twinkle t3">' + ci(80, 22, 5.5, k, O1) + ci(87, 20, 6.5, k, O1) + ci(93, 24, 4.5, k, O1) + el(86, 26, 9, 3.5, k) + '</g>' }; },
    sun: function (c) { const k = c || '#ffc93c'; let r = ''; for (let i = 0; i < 8; i++) { const a = i * 0.785; r += line('M' + (84 + Math.cos(a) * 8).toFixed(1) + ' ' + (18 + Math.sin(a) * 8).toFixed(1) + ' L' + (84 + Math.cos(a) * 11).toFixed(1) + ' ' + (18 + Math.sin(a) * 11).toFixed(1), k, 1.8); } return { front: r + ci(84, 18, 6, k, O1) }; },
    moon: function (c) { return { front: pa('M84 8 Q74 14 78 24 Q82 32 92 28 Q80 26 80 18 Q80 11 84 8 Z', c || '#ffe680', O1) }; },
    snowflake: function (c) { const k = c || '#bfe6ff'; return { front: '<g class="twinkle">' + line('M84 10 L84 30 M75.3 15 L92.7 25 M75.3 25 L92.7 15', k, 2) + ci(84, 20, 2, '#fff') + '</g>' }; },
    shell: function (c) { const k = c || '#ffb3c8'; return { front: pa('M60 26 Q60 12 69 10 Q78 12 78 26 Q69 30 60 26 Z', k, O1) + line('M69 12 L69 27 M64 14 L65 27 M74 14 L73 27', '#fff', 1, 0.7) }; },
    cape: function (c) { const k = c || '#e0475b'; return { behind: pa('M30 64 Q16 82 20 96 L80 96 Q84 82 70 64 Z', k, O) }; },
    wand: function (c) { return { front: line('M72 80 L86 60', '#7a5030', 2.4) + pa(starD(87, 58, 6), c || '#ffd84a', O1) }; },
    gem: function (c) { return { front: pg('50,24 55,29 50,35 45,29', c || '#5dc8ff', O1) + pg('50,25.5 52.5,29 50,30', '#fff') }; },
    bell: function (c) { return { front: pa('M30 66 Q50 76 70 66', 'none', 'stroke="#ff5d73" stroke-width="3.2" stroke-linecap="round"') + ci(50, 73, 4.6, c || '#ffd23f', O1) + line('M47 73 L53 73', LINE, 1) }; },
    acorn: function (c) { return { front: el(50, 14, 7, 8.5, c || '#c98f5a', O) + pa('M42 12 Q42 4 50 4 Q58 4 58 12 Z', '#8a5a34', O) + line('M50 4 L51 1', '#5b4040', 1.6) }; }
  };
  const ACC_NAMES = Object.keys(ACC);

  /** もとの絵 (base) の色をかえて、かざりを足した新しい子 */
  function variant(base, pal, acc) {
    const b = SPECS[base];
    if (!b) throw new Error('もとの絵が無い: ' + base);
    const r = Object.assign({}, b, pal || {});
    if (pal && pal.body && !pal.head && b.head === undefined) r.head = pal.body;
    if (pal && pal.body && b.arm === undefined && !pal.arm) r.arm = pal.body;
    let behind = '', front = '';
    (acc || []).forEach(function (a) {
      const parts = String(a).split(':');
      const f = ACC[parts[0]];
      if (!f) throw new Error('かざりが無い: ' + a);
      const g = f(parts[1]);
      behind += g.behind || '';
      front += g.front || '';
    });
    r.behind = (b.behind || '') + behind;
    r.front = (b.front || '') + front;
    return r;
  }

  // packs.js のなかま (ブラウザでは先に packs.js を読む)
  const PACKS = typeof module === 'object' && module.exports ? require('./packs.js') : (typeof globalThis !== 'undefined' ? globalThis : this).Packs;
  (PACKS || []).forEach(function (pk) {
    pk.charas.forEach(function (ch) {
      if (SPECS[ch.id]) throw new Error('同じ id の絵がもうある: ' + ch.id);
      SPECS[ch.id] = variant(ch.base, ch.pal, ch.acc);
    });
  });

  /**
   * どうぶつの SVG 文字列。
   * opts.walk=false で止まった絵 / opts.locked で影絵 / opts.delay で歩きのずれ (秒)
   */
  function svg(id, opts) {
    const s = SPECS[id];
    if (!s) throw new Error('絵が無い: ' + id);
    const o = opts || {};
    const cls = 'animal' + (o.walk === false || o.locked ? '' : ' walk') + (o.locked ? ' locked' : '') + (s.float ? ' float' : '');
    const style = o.delay != null ? ' style="--d:' + o.delay + 's"' : '';
    return '<svg class="' + cls + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"' + style + '>' +
      '<ellipse class="shadow" cx="50" cy="93" rx="26" ry="4.5" fill="#000" opacity=".13"/>' +
      '<g class="sway"><g class="bob">' + render(s) + '</g></g></svg>';
  }

  /** 見本用: base にかざりを 1 つ付けた止まった絵 */
  function preview(base, acc, pal) {
    SPECS.__preview = variant(base, pal, [acc]);
    const out = svg('__preview', { walk: false });
    delete SPECS.__preview;
    return out;
  }

  return { svg: svg, ids: Object.keys(SPECS), ACC_NAMES: ACC_NAMES, preview: preview };
});
