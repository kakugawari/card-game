/*!
 * card.js — カードの見た目 (HTML を作る) と、指でかたむけるキラ加工。
 *
 *   CardView.html(card, opts)  表のカード
 *   CardView.backHTML()        カードの裏
 *   CardView.packHTML()        パックの絵 (上の切り口つき)
 *   CardView.boxHTML()         BOX の絵 (パックの絵を 前の面に はめた 箱)
 *   CardView.tilt(el, opts)    指の位置でかたむけ、光 (ホロ) を動かす。止めるときは返り値の stop()
 *
 * かたむきと光は CSS 変数で渡す: --rx --ry (角度) / --mx --my (光の位置 0〜100) / --glare (0〜1)
 * 変数は親から子へ受けつがれるので、.tilt を付けた入れ物に置けば中のカードの光も動く。
 */
(function (root) {
  'use strict';

  const C = root.Core;
  const A = root.Animals;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /** 絵: 用意されていれば画像、無ければ仮の絵 (背景 + どうぶつ) */
  function sceneOf(card) { const st = C.setById(card.set); return (st && st.scene) || 'forest'; }

  function artHTML(card, full) {
    if (card.art) {
      return '<img class="pc-img" src="' + esc(card.art) + '" alt="" draggable="false" decoding="async">';
    }
    const deco = full ? '<i class="pc-deco"></i>' : '';
    // AR・SAR は けしき・小物まで描いた背景、SR は銀の幾何学もよう (scenery.js)。そのほかは CSS の背景
    if (root.Scenery && (card.rarity === 'AR' || card.rarity === 'SAR' || card.rarity === 'SR')) {
      const sc = root.Scenery.render(card.rarity === 'SR' ? 'geo' : sceneOf(card), card.rarity, card.chara);
      return '<div class="pc-scene sc-' + card.rarity + ' scene-' + sceneOf(card) + '" style="background:' + sc.bg + '">' + sc.svg + '</div>' +
        '<div class="pc-animal">' + A.svg(card.chara, { delay: -(Math.random() * 0.9).toFixed(2) }) + '</div>';
    }
    return '<div class="pc-scene sc-' + card.rarity + ' scene-' + sceneOf(card) + '">' + deco + '</div>' +
      '<div class="pc-animal">' + A.svg(card.chara, { delay: -(Math.random() * 0.9).toFixed(2) }) + '</div>';
  }

  function footHTML(card) {
    return '<div class="pc-foot"><span class="pc-mark">' + C.setById(card.set).mark + '</span><span class="pc-rar">' + card.rarity + '</span>' +
      '<span class="pc-no">' + C.numberLabel(card) + '</span>' +
      '<span class="pc-ill">' + (card.illus ? 'Illus. ' + esc(card.illus) : '') + '</span></div>';
  }

  /**
   * 名前。長い名前は字を小さくして、カードの幅に必ず収める (--nl = 字の数。空白は半分)。
   * 「おうごんの ギャラクシーユニコーン」のように前置きがあって長いときは、前置きを小さく上の行へ
   */
  function nameHTML(name) {
    const w = function (t) { return t.replace(/ /g, '').length + (t.split(' ').length - 1) * 0.5; };
    let pre = '', main = name;
    const sp = name.indexOf(' ');
    if (w(name) > 9 && sp > 0) { pre = name.slice(0, sp); main = name.slice(sp + 1); }
    return '<span class="pc-name" style="--nl:' + Math.max(1, w(main)) + '">' + (pre ? '<small>' + esc(pre) + '</small>' : '') + esc(main) + '</span>';
  }

  /**
   * 表のカード。
   * opts.small: ずかんなどの小さい表示 (説明を省く)
   */
  function html(card, opts) {
    const o = opts || {};
    const full = C.RARITIES[card.rarity].full;
    const cls = 'pc r-' + card.rarity + (full ? ' fr-full' : ' fr-normal') + (o.small ? ' small' : '');
    let inner;
    if (full) {
      inner = '<div class="pc-art">' + artHTML(card, true) + '</div>' +
        '<div class="pc-head">' + nameHTML(card.name) + '</div>' +
        '<div class="pc-panel"><div class="pc-kind">' + esc(card.kind) + '</div>' +
        '<div class="pc-text">' + esc(card.text) + '</div>' + footHTML(card) + '</div>';
    } else {
      inner = '<div class="pc-head">' + nameHTML(card.name) +
        '<span class="pc-kind">' + esc(card.kind) + '</span></div>' +
        '<div class="pc-art">' + artHTML(card, false) + '</div>' +
        '<div class="pc-text">' + esc(card.text) + '</div>' + footHTML(card);
    }
    return '<div class="' + cls + '" data-no="' + card.no + '"><div class="pc-in">' + inner + '</div>' +
      '<div class="pc-holo"></div><div class="pc-glare"></div></div>';
  }

  const PAW = '<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="currentColor">' +
    '<ellipse cx="20" cy="26" rx="9" ry="7.5"/><circle cx="9.5" cy="16" r="4"/><circle cx="16" cy="9.5" r="4"/>' +
    '<circle cx="24" cy="9.5" r="4"/><circle cx="30.5" cy="16" r="4"/></g></svg>';

  function backHTML() {
    return '<div class="pc-back"><div class="pb-ring"></div><div class="pb-emblem">' + PAW +
      '<span class="pb-title">ANIMAL<br>PACK</span></div></div>';
  }

  // パックのぎざぎざ (上下の圧着) と、切り口の線。本体と上の切れはしは、同じ線を境に分ける
  const PACK_CLIP = (function () {
    const tear = [];
    const crimpTop = [];
    const crimpBottom = [];
    for (let i = 0; i <= 25; i++) {
      const x = i * 4;
      tear.push(x + '% ' + (i % 2 ? 13.6 : 12.4) + '%');
      crimpTop.push(x + '% ' + (i % 2 ? 2.2 : 0) + '%');
      crimpBottom.push(x + '% ' + (i % 2 ? 97.8 : 100) + '%');
    }
    return {
      body: 'polygon(' + tear.concat(crimpBottom.slice().reverse()).join(',') + ')',
      top: 'polygon(' + crimpTop.concat(tear.slice().reverse()).join(',') + ')'
    };
  })();

  /** パックの絵。setId でパックの種類ごとの色・顔ぶれ・名前になる */
  function packHTML(setId) {
    const set = C.setById(setId) || C.SET;
    const mascots = set.mascots.map(function (id, i) {
      return '<div class="pk-m pk-m' + i + '">' + A.svg(id, { walk: false }) + '</div>';
    }).join('');
    const big = set.name.replace(/パック$/, '');
    // 「みらいの どうぶつ」のように前置きがある名前は、前置きを小さく上の行へ (1 行だと パックの外へ はみ出す)
    const sp = big.lastIndexOf(' ');
    const pre = sp > 0 ? big.slice(0, sp) : '', main = sp > 0 ? big.slice(sp + 1) : big;
    const body = '<div class="pk-shine"></div><div class="pk-logo"><span class="pk-small">' + set.mark + ' ' + set.code + '</span>' +
      (pre ? '<span class="pk-pre">' + esc(pre) + '</span>' : '') +
      '<span class="pk-big' + (main.length > 5 ? ' long' : '') + '">' + esc(main) + '<small>パック</small></span><span class="pk-sub">' + esc(set.title) + '</span></div>' +
      '<div class="pk-mascots">' + mascots + '</div><div class="pk-count">1パック 5まい入り</div>';
    const bg = '--pk1:' + set.colors[0] + ';--pk2:' + set.colors[1] + ';--pk3:' + set.colors[2];
    return '<div class="pk pk-' + set.id + '" style="' + bg + '"><div class="pk-body" style="clip-path:' + PACK_CLIP.body + '">' + body + '<i class="pk-real"></i></div>' +
      '<div class="pk-top" style="clip-path:' + PACK_CLIP.top + '"><div class="pk-shine"></div><i class="pk-real"></i></div>' +
      '<div class="pk-guide"></div><div class="pk-leak"></div></div>';
  }

  /**
   * BOX の絵: 本物の BOX (パックが 30 入った 横長の箱) のように、ふたの上の面・前の面・横の面の 3 つの面で できている。
   * 前の面に そのパックの 絵 (ロゴ・そのパックの色・ななめの縞・なかまたち) を はめる。パックの種類ごとに ちがう
   */
  function boxHTML(setId) {
    const set = C.setById(setId) || C.SET;
    const big = set.name.replace(/パック$/, '').replace('みらいの どうぶつ', 'みらい');
    const mascots = set.mascots.map(function (id, i) {
      return '<div class="bxb-m bxb-m' + i + '">' + A.svg(id, { walk: false }) + '</div>';
    }).join('');
    const bg = '--pk1:' + set.colors[0] + ';--pk2:' + set.colors[1] + ';--pk3:' + set.colors[2];
    return '<div class="bxb" style="' + bg + '">' +
      '<div class="bxb-top"><span>' + set.mark + ' ' + set.code + ' BOX</span></div>' +
      '<div class="bxb-front"><div class="bxb-art">' +
        '<div class="bxb-logo"><span class="bxb-small">' + set.mark + ' ' + set.code + '</span>' +
        '<span class="bxb-big' + (big.length > 4 ? ' long' : '') + '">' + esc(big) + '</span>' +
        '<span class="bxb-tag">BOX</span></div>' +
        '<div class="bxb-mascots">' + mascots + '</div>' +
        '<div class="bxb-count">30パック入り</div></div></div>' +
      '<div class="bxb-side"><span>BOX</span></div></div>';
  }

  // ---------------------------------------------------------------- かたむけ
  /**
   * el に --rx --ry --mx --my --glare を置き続ける。
   * 指が乗っていれば指の位置へ、離れていれば idle (ゆっくり8の字) へ、なめらかに寄せる。
   * opts.max: いちばん大きいかたむき (度) / opts.idle: 指が無いときもゆらす
   */
  function tilt(el, opts) {
    const o = opts || {};
    const max = o.max || 16;
    let tx = 50, ty = 50, x = 50, y = 50, g = 0, tg = 0;
    let pointer = false;
    let raf = 0;
    let last = performance.now();
    let t = Math.random() * 10;
    let stopped = false;

    function move(e) {
      const b = el.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) return;
      tx = Math.max(0, Math.min(100, ((e.clientX - b.left) / b.width) * 100));
      ty = Math.max(0, Math.min(100, ((e.clientY - b.top) / b.height) * 100));
      pointer = true;
      tg = 1;
    }
    function leave() { pointer = false; }

    function frame(now) {
      if (stopped) return;
      let dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0;          // 1 コマ目が負になることがある
      if (dt > 0.05) dt = 0.05;
      t += dt;
      if (!pointer) {
        if (o.idle) {
          tx = 50 + Math.sin(t * 0.9) * 32;
          ty = 50 + Math.sin(t * 1.3) * 22;
          tg = 0.55;
        } else {
          tx = 50; ty = 50; tg = 0;
        }
      }
      const k = 1 - Math.pow(0.0005, dt);   // なめらかに寄せる
      x += (tx - x) * k;
      y += (ty - y) * k;
      g += (tg - g) * k;
      el.style.setProperty('--mx', x.toFixed(1));
      el.style.setProperty('--my', y.toFixed(1));
      el.style.setProperty('--ry', (((x - 50) / 50) * max).toFixed(2) + 'deg');
      el.style.setProperty('--rx', (((50 - y) / 50) * max).toFixed(2) + 'deg');
      el.style.setProperty('--glare', g.toFixed(2));
      if (!el.isConnected) { stop(); return; }
      raf = requestAnimationFrame(frame);
    }

    function down(e) {
      // 指が乗ったまま カードがかたむいて指の下から逃げても、離すまでは指を追う
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* */ }
      move(e);
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerup', leave);
    el.addEventListener('pointercancel', leave);
    el.classList.add('tilt');
    raf = requestAnimationFrame(frame);

    function stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointerup', leave);
      el.removeEventListener('pointercancel', leave);
    }
    return { stop: stop };
  }

  root.CardView = { html: html, backHTML: backHTML, packHTML: packHTML, boxHTML: boxHTML, tilt: tilt };
})(typeof globalThis !== 'undefined' ? globalThis : this);
