/*!
 * app.js — 画面まわり。操作と描画はここに書く。
 *
 * ロジックは core.js、絵は animals.js。ここは「押されたら何をするか」と「どう見せるか」だけ。
 */
(function () {
  'use strict';

  const C = window.Core;
  const A = window.Animals;
  const SAVE_KEY = 'animalPacks:v1';

  const $ = function (id) { return document.getElementById(id); };
  const els = {
    moneyNum: $('moneyNum'), tree: $('tree'), plaza: $('plaza'), ground: $('ground'), tapHint: $('tapHint'),
    upLv: $('upLv'), upSub: $('upSub'), btnUp: $('btnUp'), btnUpLabel: $('btnUpLabel'),
    packFree: $('packFree'), artFree: $('artFree'), btnFree: $('btnFree'), btnFreeLabel: $('btnFreeLabel'),
    packShop: $('packShop'), packDot: $('packDot'),
    zkCount: $('zkCount'), zkGrid: $('zkGrid'),
    reveal: $('reveal'), rvPack: $('rvPack'), rvPackArt: $('rvPackArt'), rvCards: $('rvCards'),
    rvActions: $('rvActions'), btnFlipAll: $('btnFlipAll'), btnClose: $('btnClose'),
    detail: $('detail'), dtBox: $('dtBox')
  };

  // ---------------------------------------------------------------- 保存
  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return C.normalize(raw ? JSON.parse(raw) : null);
    } catch (e) {
      return C.newState();
    }
  }

  let state = load();
  let saveTimer = 0;

  /** タップのたびに書くと重いので、まとめて書く。 */
  function markDirty() {
    if (saveTimer) return;
    saveTimer = window.setTimeout(saveNow, 800);
  }

  function saveNow() {
    if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = 0; }
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 保存できなくても遊べる */ }
  }

  // ---------------------------------------------------------------- 部品の HTML
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function randomDelay() { return -(Math.random() * 0.9).toFixed(2); }

  function cardHTML(a, opts) {
    const o = opts || {};
    const r = C.RARITIES[a.rarity];
    return '<div class="card r-' + a.rarity + (o.compact ? ' compact' : '') + '"><div class="card-in">' +
      '<div class="c-head"><span class="c-name">' + a.name + '</span><span class="c-star">' + '★'.repeat(r.stars) + '</span></div>' +
      '<div class="c-art">' + A.svg(a.id, { delay: randomDelay() }) + '</div>' +
      '<div class="c-foot"><span class="c-likes">すき: ' + a.likes + '</span><span class="c-no">No.' + pad2(a.no) + '</span></div>' +
      '</div>' + (o.count > 1 ? '<span class="badge-count">×' + o.count + '</span>' : '') + '</div>';
  }

  function lockedCardHTML(a) {
    return '<div class="card locked compact"><div class="card-in">' +
      '<div class="c-head"><span class="c-name">？？？</span></div>' +
      '<div class="c-art">' + A.svg(a.id, { locked: true }) + '</div>' +
      '<div class="c-foot"><span class="c-likes"></span><span class="c-no">No.' + pad2(a.no) + '</span></div>' +
      '</div></div>';
  }

  const MASCOT = { free: 'usagi', normal: 'kuma', special: 'unicorn' };
  const PACK_TEXT = { free: 'まいにち', normal: 'ふつう', special: 'スペシャル' };

  function packHTML(kind) {
    return '<div class="pack k-' + kind + '"><div class="pk-mascot">' + A.svg(MASCOT[kind], { walk: false }) +
      '</div><div class="pk-text">' + PACK_TEXT[kind] + '</div></div>';
  }

  // ---------------------------------------------------------------- コイン表示
  let canUpCache = null;
  let hintHidden = false;

  function renderMoney() {
    els.moneyNum.textContent = C.formatMoney(state.money);
    const cost = C.upgradeCost(state.tapLevel);
    const canUp = cost !== null && state.money >= cost;
    if (canUp !== canUpCache) {
      canUpCache = canUp;
      els.btnUp.disabled = !canUp;
    }
    if (!hintHidden && state.totalTaps >= 10) {
      hintHidden = true;
      els.tapHint.style.visibility = 'hidden';
    }
    if (!$('scPacks').hidden) renderShop();
  }

  function renderUpgrade() {
    const cost = C.upgradeCost(state.tapLevel);
    els.upLv.textContent = 'Lv.' + (state.tapLevel + 1);
    if (cost === null) {
      els.upSub.textContent = '1かいで ' + C.tapPower(state) + 'コイン (いちばんつよい！)';
      els.btnUpLabel.textContent = 'MAX';
      els.btnUp.classList.add('max');
    } else {
      els.upSub.textContent = '1かいで ' + C.tapPower(state) + 'コイン → ' + (C.tapPower(state) + 1) + 'コイン';
      els.btnUpLabel.textContent = C.formatMoney(cost);
      els.btnUp.classList.remove('max');
    }
    canUpCache = null;
    renderMoney();
  }

  // ---------------------------------------------------------------- タップ
  let squishAnim = null;

  function tapTree(e) {
    const gain = C.tap(state);
    markDirty();
    renderMoney();
    pop(e, gain);
    if (squishAnim) squishAnim.cancel();
    squishAnim = els.tree.animate(
      [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.05, .94)' }, { transform: 'scale(1, 1)' }],
      { duration: 160, easing: 'ease-out' }
    );
  }

  function pop(e, gain) {
    const box = els.plaza.getBoundingClientRect();
    const x = (e && e.clientX ? e.clientX : box.left + box.width / 2) - box.left + (Math.random() * 30 - 15);
    const y = (e && e.clientY ? e.clientY : box.top + 120) - box.top - 24;
    const old = els.plaza.querySelectorAll('.pop');
    if (old.length > 14) old[0].remove();
    const p = document.createElement('div');
    p.className = 'pop';
    p.textContent = '+' + gain;
    els.plaza.appendChild(p);
    p.animate(
      [
        { transform: 'translate(' + x + 'px,' + y + 'px) scale(.6)', opacity: 1 },
        { transform: 'translate(' + x + 'px,' + (y - 40) + 'px) scale(1.15)', opacity: 1, offset: 0.3 },
        { transform: 'translate(' + x + 'px,' + (y - 90) + 'px) scale(1)', opacity: 0 }
      ],
      { duration: 700, easing: 'ease-out' }
    ).onfinish = function () { p.remove(); };
  }

  els.tree.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    tapTree(e);
  });
  // キーボードや、click() で呼ばれたとき (指のタップは pointerdown で数えているので detail 0 だけ)
  els.tree.addEventListener('click', function (e) {
    if (e.detail === 0) tapTree(null);
  });

  els.btnUp.addEventListener('click', function () {
    if (!C.buyUpgrade(state)) return;
    saveNow();
    renderUpgrade();
    els.btnUp.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
      { duration: 260 }
    );
  });

  // ---------------------------------------------------------------- ひろば (歩くどうぶつ)
  function renderWalkers() {
    const owned = C.ANIMALS.filter(function (a) { return state.owned[a.id] > 0; });
    owned.sort(function (a, b) {
      return C.RARITY_ORDER.indexOf(b.rarity) - C.RARITY_ORDER.indexOf(a.rarity) || a.no - b.no;
    });
    const shown = owned.slice(0, 6);
    const width = els.ground.clientWidth || 430;
    // ひろい草原を、それぞれ自分の道すじで行ったり来たりする。奥 (上) の子から先に描き、手前の子が前に出る
    const walkers = shown.map(function (a, i) {
      const dist = 130 + Math.random() * 110;
      const dur = dist / (14 + Math.random() * 6);
      return {
        a: a, dist: dist, dur: dur,
        left: Math.random() * Math.max(0, width - 80 - dist),
        bottom: 6 + (i % 3) * 14
      };
    }).sort(function (x, y) { return y.bottom - x.bottom; });
    els.ground.innerHTML = walkers.map(function (w) {
      return '<div class="walker" style="left:' + w.left.toFixed(0) + 'px;bottom:' + w.bottom + 'px;--dist:' + w.dist.toFixed(0) +
        'px;--dur:' + w.dur.toFixed(1) + 's;--del:-' + (Math.random() * w.dur).toFixed(1) + 's">' +
        A.svg(w.a.id, { delay: randomDelay() }).replace('<svg ', '<svg width="100%" height="100%" ') + '</div>';
    }).join('');
  }

  // ---------------------------------------------------------------- パック画面
  let shopBuilt = false;

  function buildShop() {
    els.packFree.querySelector('#artFree').innerHTML = packHTML('free');
    els.packShop.innerHTML = ['normal', 'special'].map(function (k) {
      const p = C.PACKS[k];
      const sub = k === 'special' ? 'レアが でやすい！' : p.size + 'まいいり';
      return '<div class="shop-item" data-kind="' + k + '"><div class="pack-art">' + packHTML(k) + '</div>' +
        '<div class="shop-name">' + p.label + '</div><div class="shop-sub">' + sub + '</div>' +
        '<button type="button" class="btn" data-buy="' + k + '"><span class="btn-label"></span></button></div>';
    }).join('');
    shopBuilt = true;
  }

  function renderShop() {
    if (!shopBuilt) buildShop();
    els.packShop.querySelectorAll('button[data-buy]').forEach(function (b) {
      const p = C.PACKS[b.dataset.buy];
      const enough = state.money >= p.price;
      const label = b.firstElementChild;
      const text = enough ? C.formatMoney(p.price) : 'あと' + C.formatMoney(p.price - state.money) + 'コイン';
      if (label.textContent !== text) label.textContent = text;
      b.disabled = !enough;
      b.classList.toggle('short', !enough);
    });
  }

  function renderFree() {
    const now = Date.now();
    const ready = C.canOpenFree(state, now);
    els.packFree.classList.toggle('ready', ready);
    els.btnFree.disabled = !ready;
    const text = ready ? 'あける！' : 'また あした (' + C.formatWait(C.msUntilNextDay(now)) + ')';
    if (els.btnFreeLabel.textContent !== text) els.btnFreeLabel.textContent = text;
    els.packDot.hidden = !ready;
  }

  function renderPacks() {
    renderShop();
    renderFree();
  }

  els.btnFree.addEventListener('click', function () { startOpen('free'); });
  els.packShop.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-buy]');
    if (b && !b.disabled) startOpen(b.dataset.buy);
  });

  // ---------------------------------------------------------------- ずかん
  function renderZukan() {
    els.zkCount.textContent = C.collectedCount(state) + ' / ' + C.ANIMALS.length;
    els.zkGrid.innerHTML = C.ANIMALS.map(function (a) {
      const n = state.owned[a.id] || 0;
      return '<button type="button" class="zk-cell" data-id="' + a.id + '"' + (n ? '' : ' disabled') + '>' +
        (n ? cardHTML(a, { compact: true, count: n }) : lockedCardHTML(a)) + '</button>';
    }).join('');
  }

  els.zkGrid.addEventListener('click', function (e) {
    const cell = e.target.closest('.zk-cell');
    if (!cell || cell.disabled) return;
    const a = C.animalById(cell.dataset.id);
    const n = state.owned[a.id] || 0;
    els.dtBox.innerHTML = cardHTML(a) +
      '<div class="dt-meta">' + C.RARITIES[a.rarity].label + '<small>もっている かず: ' + n + 'まい</small></div>';
    els.detail.hidden = false;
  });
  els.detail.addEventListener('click', function () { els.detail.hidden = true; });

  // ---------------------------------------------------------------- タブ
  const SCREENS = ['Home', 'Packs', 'Zukan'];

  function showTab(name) {
    SCREENS.forEach(function (n) { $('sc' + n).hidden = n !== name; });
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === name); });
    if (name === 'Packs') renderPacks();
    if (name === 'Zukan') renderZukan();
    if (name === 'Home') renderWalkers();
  }

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.dataset.tab); });
  });

  // ---------------------------------------------------------------- パックを開ける
  let session = null;   // { kind, cards, flipped: [] }

  function startOpen(kind) {
    if (session) return;
    const res = C.openPack(state, kind, Date.now());
    if (!res.ok) return;
    saveNow();   // 開けた時点で記録する (途中で閉じても、もらったカードは残る)
    session = { kind: kind, cards: res.cards, flipped: res.cards.map(function () { return false; }), tearing: false };
    els.rvPackArt.innerHTML = packHTML(kind);
    els.rvPack.hidden = false;
    els.rvCards.hidden = true;
    els.rvCards.innerHTML = '';
    els.rvActions.hidden = true;
    els.btnClose.hidden = true;
    els.btnFlipAll.hidden = false;
    els.reveal.hidden = false;
    renderMoney();
    renderFree();
    els.rvPack.animate([{ opacity: 0, transform: 'translateY(30px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
  }

  function tearPack() {
    if (!session || session.tearing) return;
    session.tearing = true;
    const a = els.rvPack.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1.18)', offset: 0.5 }, { opacity: 0, transform: 'scale(1.5)' }],
      { duration: 380, easing: 'ease-in', fill: 'forwards' }
    );
    a.onfinish = function () {
      els.rvPack.hidden = true;
      a.cancel();
      buildCards();
    };
  }

  function buildCards() {
    els.rvCards.innerHTML = session.cards.map(function (c, i) {
      const a = C.animalById(c.id);
      return '<div class="rv-card" data-i="' + i + '"><div class="rv-flip">' +
        '<div class="rv-face back"></div><div class="rv-face front">' + cardHTML(a) + '</div></div>' +
        (c.isNew ? '<span class="rv-new" hidden>NEW!</span>' : '') + '</div>';
    }).join('');
    els.rvCards.hidden = false;
    els.rvActions.hidden = false;
    els.rvCards.querySelectorAll('.rv-card').forEach(function (card, i) {
      card.animate(
        [{ opacity: 0, transform: 'translateY(40px) scale(.8)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, delay: i * 80, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' }
      );
    });
  }

  function flip(i) {
    if (!session || session.flipped[i]) return;
    session.flipped[i] = true;
    const card = els.rvCards.children[i];
    const c = session.cards[i];
    const a = C.animalById(c.id);
    const anim = card.querySelector('.rv-flip').animate(
      [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }],
      { duration: 520, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'forwards' }
    );
    anim.onfinish = function () {
      const badge = card.querySelector('.rv-new');
      if (badge) badge.hidden = false;
      if (a.rarity === 'SR' || a.rarity === 'UR') sparkle(card, a.rarity === 'UR' ? 18 : 10);
    };
    if (session.flipped.every(Boolean)) {
      els.btnFlipAll.hidden = true;
      els.btnClose.hidden = false;
    }
  }

  function sparkle(card, n) {
    const colors = ['#ffe066', '#ff9ccf', '#8ccfff', '#b4f0a8', '#fff'];
    for (let k = 0; k < n; k++) {
      const s = document.createElement('i');
      s.className = 'rv-spark';
      s.style.background = colors[k % colors.length];
      card.appendChild(s);
      const ang = (Math.PI * 2 * k) / n;
      const r = 70 + Math.random() * 50;
      s.animate(
        [
          { transform: 'translate(0,0) scale(.3)', opacity: 1 },
          { transform: 'translate(' + Math.cos(ang) * r + 'px,' + Math.sin(ang) * r + 'px) scale(1.4) rotate(120deg)', opacity: 0 }
        ],
        { duration: 700 + Math.random() * 300, easing: 'ease-out' }
      ).onfinish = function () { s.remove(); };
    }
  }

  els.rvPack.addEventListener('click', tearPack);
  els.rvPack.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') tearPack(); });
  els.rvCards.addEventListener('click', function (e) {
    const card = e.target.closest('.rv-card');
    if (card) flip(Number(card.dataset.i));
  });
  els.btnFlipAll.addEventListener('click', function () {
    if (!session) return;
    session.flipped.forEach(function (done, i) {
      if (!done) window.setTimeout(function () { flip(i); }, i * 140);
    });
  });
  els.btnClose.addEventListener('click', function () {
    session = null;
    els.reveal.hidden = true;
    renderWalkers();
    if (!$('scZukan').hidden) renderZukan();
    renderPacks();
  });

  // ---------------------------------------------------------------- 起動
  function tick() { renderFree(); }

  function main() {
    buildShop();
    renderUpgrade();
    renderWalkers();
    renderFree();
    window.setInterval(tick, 20000);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) saveNow(); else tick();
    });
    window.addEventListener('pagehide', saveNow);

    // 自動テストから中身をのぞくための入口
    window.__app = {
      state: function () { return state; },
      core: C,
      session: function () { return session; },
      setMoney: function (n) { state.money = n; saveNow(); renderMoney(); },
      renderFree: renderFree,
      flush: saveNow
    };
  }

  main();
})();
