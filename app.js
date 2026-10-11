/*!
 * app.js — 画面まわり (ひろば・パック・ずかん)。パックを開ける演出は opening.js。
 *
 * ロジックは core.js、カードの見た目は card.js。ここは「押されたら何をするか」と「どう見せるか」だけ。
 */
(function () {
  'use strict';

  const C = window.Core;
  const A = window.Animals;
  const V = window.CardView;
  const O = window.Opening;
  const Sfx = window.Fx.Sfx;
  const SAVE_KEY = 'animalPacks:v2';
  const OLD_KEYS = ['animalPacks:v1'];

  const $ = function (id) { return document.getElementById(id); };
  const els = {
    moneyNum: $('moneyNum'), tree: $('tree'), plaza: $('plaza'), ground: $('ground'), tapHint: $('tapHint'),
    upLv: $('upLv'), upSub: $('upSub'), btnUp: $('btnUp'), btnUpLabel: $('btnUpLabel'),
    shopPack: $('shopPack'), shopName: $('shopName'), btnFree: $('btnFree'), btnFreeLabel: $('btnFreeLabel'),
    btnBuy: $('btnBuy'), btnBuyLabel: $('btnBuyLabel'), boxLeft: $('boxLeft'), rates: $('rates'), packDot: $('packDot'),
    zkCount: $('zkCount'), zkSub: $('zkSub'), zkGrid: $('zkGrid'),
    detail: $('detail'), dtBox: $('dtBox'), btnMute: $('btnMute'), muteIco: $('muteIco')
  };

  // ---------------------------------------------------------------- 保存
  function load() {
    try {
      let raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) {
        // 前の版の記録があれば引き継ぐ (core.normalize が中身を新しい形に移す)
        for (let i = 0; i < OLD_KEYS.length && !raw; i++) raw = window.localStorage.getItem(OLD_KEYS[i]);
      }
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

  function randomDelay() { return -(Math.random() * 0.9).toFixed(2); }

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
    if (!$('scPacks').hidden) renderBuy();
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

  // 指・マウスは pointerdown で数える (連打に強い)。click はキーボード用。
  // 指のタップのあとにも click が来るが、その detail は 0 のことがある (Chromium で確認) ので、
  // 「直前に pointerdown があったか」で見分ける。detail で見分けると 1 タップが 2 回に数えられる
  let lastPointer = -1e9;
  els.tree.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    lastPointer = performance.now();
    tapTree(e);
  });
  els.tree.addEventListener('click', function () {
    if (performance.now() - lastPointer > 1000) tapTree(null);
  });

  els.btnUp.addEventListener('click', function () {
    if (!C.buyUpgrade(state)) return;
    saveNow();
    renderUpgrade();
    els.btnUp.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260 });
  });

  // ---------------------------------------------------------------- ひろば (歩くどうぶつ)
  function renderWalkers() {
    const charas = [];
    const best = {};
    C.CARDS.forEach(function (c) {
      if (!state.owned[c.no]) return;
      if (best[c.chara] === undefined) charas.push(c.chara);
      best[c.chara] = Math.max(best[c.chara] || 0, C.rank(c.rarity));
    });
    charas.sort(function (a, b) { return best[b] - best[a]; });
    const shown = charas.slice(0, 6);
    const width = els.ground.clientWidth || 430;
    // ひろい草原を、それぞれ自分の道すじで行ったり来たりする。奥 (上) の子から先に描き、手前の子が前に出る
    const walkers = shown.map(function (id, i) {
      const dist = 130 + Math.random() * 110;
      const dur = dist / (14 + Math.random() * 6);
      return { id: id, dist: dist, dur: dur, left: Math.random() * Math.max(0, width - 80 - dist), bottom: 6 + (i % 3) * 14 };
    }).sort(function (x, y) { return y.bottom - x.bottom; });
    els.ground.innerHTML = walkers.map(function (w) {
      return '<div class="walker" style="left:' + w.left.toFixed(0) + 'px;bottom:' + w.bottom + 'px;--dist:' + w.dist.toFixed(0) +
        'px;--dur:' + w.dur.toFixed(1) + 's;--del:-' + (Math.random() * w.dur).toFixed(1) + 's">' +
        A.svg(w.id, { delay: randomDelay() }).replace('<svg ', '<svg width="100%" height="100%" ') + '</div>';
    }).join('');
  }

  // ---------------------------------------------------------------- パック画面
  function renderBuy() {
    const enough = state.money >= C.PACK_PRICE;
    const text = enough ? C.formatMoney(C.PACK_PRICE) + ' コインで かう' : 'あと ' + C.formatMoney(C.PACK_PRICE - state.money) + ' コイン';
    if (els.btnBuyLabel.textContent !== text) els.btnBuyLabel.textContent = text;
    els.btnBuy.disabled = !enough;
  }

  function renderFree() {
    const now = Date.now();
    const ready = C.canOpenFree(state, now);
    els.btnFree.disabled = !ready;
    els.shopPack.classList.toggle('ready', ready);
    const text = ready ? 'きょうの むりょうパック！' : 'むりょうは また あした (' + C.formatWait(C.msUntilNextDay(now)) + ')';
    if (els.btnFreeLabel.textContent !== text) els.btnFreeLabel.textContent = text;
    els.packDot.hidden = !ready;
  }

  function renderPacks() {
    renderBuy();
    renderFree();
    const left = state.box ? C.BOX_PACKS - state.box.next : C.BOX_PACKS;
    els.boxLeft.textContent = 'いまの BOX (' + C.BOX_PACKS + 'パック) の のこり: ' + (left === 0 ? C.BOX_PACKS : left) + 'パック';
  }

  function buildShop() {
    els.shopPack.innerHTML = V.packHTML();
    els.shopName.textContent = C.SET.name + '「' + C.SET.title + '」';
    const rows = [
      ['C', '1パックに 3まい'], ['U', '1パックに 1まい'], ['R', 'レアわくに いちばん よく でる'],
      ['RR', '1BOX に 4まい くらい'], ['AR', '1BOX に 3まい くらい'], ['SR', '1BOX に 1まい くらい'],
      ['SAR', '5BOX に 1まい くらい'], ['MUR', '50BOX に 1まい くらい']
    ];
    els.rates.innerHTML = '<table>' + rows.map(function (r) {
      return '<tr><td><span class="rmark rm-' + r[0] + '">' + r[0] + '</span></td><td>' + C.RARITIES[r[0]].label +
        '</td><td>' + r[1] + '</td><td>' + C.POOL[r[0]].length + 'しゅ</td></tr>';
    }).join('') + '</table><p class="note">1BOX = 30パック。ポケモンカードの かくだいパックと おなじ くみあわせで でてくるよ。' +
      'むりょうパックも かうパックも、おなじ BOX から じゅんばんに でる。</p>';
  }

  function againLabel() {
    if (C.canOpenFree(state, Date.now())) return 'むりょうパックを あける！';
    if (state.money >= C.PACK_PRICE) return 'もう1パック かう (' + C.formatMoney(C.PACK_PRICE) + ')';
    return null;
  }

  function openPack(kind) {
    Sfx.unlock();
    const res = C.openPack(state, kind, Date.now());
    if (!res.ok) return false;
    saveNow();   // 開けた時点で記録する (途中で閉じても、もらったカードは残る)
    renderMoney();
    renderPacks();
    O.start({
      cards: res.cards,
      show: res.show,
      againLabel: againLabel,
      onAgain: function () {
        if (!openPack(C.canOpenFree(state, Date.now()) ? 'free' : 'buy')) O.close();
      },
      onClose: function () {
        renderWalkers();
        renderPacks();
        if (!$('scZukan').hidden) renderZukan();
      }
    });
    return true;
  }

  els.btnFree.addEventListener('click', function () { openPack('free'); });
  els.btnBuy.addEventListener('click', function () { openPack('buy'); });

  // ---------------------------------------------------------------- ずかん
  function renderZukan() {
    const all = C.collectedCount(state);
    const main = C.collectedCount(state, function (c) { return Number(c.no) <= C.SET.mainCount; });
    els.zkCount.textContent = all + ' / ' + C.CARDS.length;
    els.zkSub.textContent = 'ふつう ' + main + '/' + C.SET.mainCount + ' ・ シークレット ' + (all - main) + '/' + (C.CARDS.length - C.SET.mainCount);
    els.zkGrid.innerHTML = C.CARDS.map(function (c) {
      const n = state.owned[c.no] || 0;
      if (!n) {
        return '<button type="button" class="zk-cell locked" data-no="' + c.no + '" disabled>' + V.backHTML() +
          '<span class="zk-q">？</span><span class="zk-no">' + c.no + '</span></button>';
      }
      return '<button type="button" class="zk-cell" data-no="' + c.no + '">' + V.html(c, { small: true }) +
        (n > 1 ? '<span class="zk-n">×' + n + '</span>' : '') + '</button>';
    }).join('');
  }

  let detailTilt = null;
  els.zkGrid.addEventListener('click', function (e) {
    const cell = e.target.closest('.zk-cell');
    if (!cell || cell.disabled) return;
    const card = C.cardByNo(cell.dataset.no);
    els.dtBox.innerHTML = '<div class="dt-card">' + V.html(card) + '</div>' +
      '<div class="dt-meta">' + card.rarity + ' ' + C.RARITIES[card.rarity].label +
      '<small>もっている かず: ' + state.owned[card.no] + 'まい</small></div>';
    els.detail.hidden = false;
    detailTilt = V.tilt(els.dtBox.querySelector('.dt-card'), { idle: true });
  });
  els.detail.addEventListener('click', function (e) {
    if (e.target.closest('.dt-card')) return;   // カードをさわっている間は閉じない (かたむけて遊ぶ)
    els.detail.hidden = true;
    if (detailTilt) { detailTilt.stop(); detailTilt = null; }
  });

  // ---------------------------------------------------------------- タブ・音
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

  function renderMute() {
    els.muteIco.textContent = state.muted ? '🔇' : '🔊';
    Sfx.setMuted(state.muted);
  }
  els.btnMute.addEventListener('click', function () {
    state.muted = !state.muted;
    saveNow();
    renderMute();
    Sfx.unlock();
  });

  // ---------------------------------------------------------------- 起動
  function main() {
    buildShop();
    renderUpgrade();
    renderWalkers();
    renderFree();
    renderMute();
    window.setInterval(renderFree, 20000);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) saveNow(); else renderFree();
    });
    window.addEventListener('pagehide', saveNow);

    // 自動テストから中身をのぞくための入口
    window.__app = {
      state: function () { return state; },
      core: C,
      opening: O,
      setMoney: function (n) { state.money = n; saveNow(); renderMoney(); },
      renderFree: renderFree,
      /** テスト用: 次の BOX の 1 パック目の中身を決める (top: R/RR/SR/SAR/MUR, ar: true/false) */
      rigNextPack: function (top, ar) {
        state.box = C.newBox(Math.random);
        state.box.packs[0] = { top: top, ar: !!ar };
        saveNow();
      },
      flush: saveNow
    };
  }

  main();
})();
