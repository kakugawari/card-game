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
    shopPack: $('shopPack'), shopName: $('shopName'), stage: $('packStage'), stageRow: $('stageRow'), stageDesc: $('stageDesc'), stageMark: $('stageMark'), stageHave: $('stageHave'), stageIndex: $('stageIndex'), btnPrev: $('btnPrev'), btnNext: $('btnNext'), btnFree: $('btnFree'), btnFreeLabel: $('btnFreeLabel'),
    btnBuy: $('btnBuy'), btnBuyLabel: $('btnBuyLabel'), btnBox: $('btnBox'), btnBoxLabel: $('btnBoxLabel'),
    boxArt: $('boxArt'), btnOpenAll: $('btnOpenAll'), btnOpenAllLabel: $('btnOpenAllLabel'), myBox: $('myBox'), myBoxLeft: $('myBoxLeft'), myBoxSr: $('myBoxSr'), btnOpenBox: $('btnOpenBox'), boxLeft: $('boxLeft'), rates: $('rates'), packDot: $('packDot'), btnBoxBar: $('btnBoxBar'), boxBarSub: $('boxBarSub'), boxSheet: $('boxSheet'), bxClose: $('bxClose'),
    setPick: $('setPick'), packSheet: $('packSheet'), pshBody: $('pshBody'), pshTitle: $('pshTitle'), pshClose: $('pshClose'), zkPick: $('zkPick'), zkTitle: $('zkTitle'),
    zkCount: $('zkCount'), zkSub: $('zkSub'), zkGrid: $('zkGrid'),
    detail: $('detail'), dtBox: $('dtBox'),
    petSheet: $('petSheet'), psClose: $('psClose'), psAnimal: $('psAnimal'), psFx: $('psFx'), psName: $('psName'), psLv: $('psLv'),
    psBar: $('psBar'), psNext: $('psNext'), psTummy: $('psTummy'), psSnacks: $('psSnacks'), psTip: $('psTip'), psLevelUp: $('psLevelUp'), btnMute: $('btnMute'), muteIco: $('muteIco')
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
      els.upSub.textContent = '1かいで ' + C.tapPower(state) + 'コイン → ' + C.tapPowerAt(state.tapLevel + 1) + 'コイン';
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

  // 連打で画面が拡大されないように: 二本指の拡大 (gesture) を止め、300ms 以内の二度押しも木では止める (iOS は user-scalable=no を無視する)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }); });
  let lastTouchEnd = 0;
  els.tree.addEventListener('touchend', function (e) {   // 木だけ (ほかのボタンの click まで止めない。木は pointerdown で数えるので影響しない)
    const now = Date.now();
    if (now - lastTouchEnd < 300 && e.cancelable) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

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
  const TRICK = { 2: 'うれしいと ハートが でるように なった！', 3: 'ぴょんと はねるように なった！', 4: 'くるっと まわるように なった！', 5: 'かんむりを もらった！' };

  /**
   * ひろばの草原: 持っている子たちが、それぞれの道すじで行ったり来たり歩く。
   * 歩いている子をタップすると、おやつの画面が出る。なかよしレベルが上がると、歩きながら はねたり まわったりする
   */
  function renderWalkers() {
    const charas = [];
    const best = {};
    C.CARDS.forEach(function (c) {
      if (!state.owned[c.no]) return;
      if (best[c.chara] === undefined) charas.push(c.chara);
      best[c.chara] = Math.max(best[c.chara] || 0, C.rank(c.rarity));
    });
    const now = Date.now();
    const aff = function (ch) { return state.pets[ch] ? state.pets[ch].aff : 0; };
    // なかよしの子 → レアな子 の順に、草原に出てくる
    charas.sort(function (a, b) { return aff(b) - aff(a) || best[b] - best[a]; });
    const shown = charas.slice(0, 7);
    const width = els.ground.clientWidth || 430;
    // 草原を人数ぶんの区画に分け、それぞれの区画の中を行ったり来たりする (かたまらない)
    const lane = (width - 84) / Math.max(1, shown.length);
    const order = shown.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; });
    const walkers = shown.map(function (id, i) {
      const dist = Math.min(150, Math.max(40, lane + 40)) * (0.7 + Math.random() * 0.3);
      const dur = dist / (13 + Math.random() * 6);
      const left = Math.max(0, Math.min(width - 84 - dist, order[i] * lane + lane / 2 - dist / 2));
      return { id: id, dist: dist, dur: dur, left: left, bottom: 8 + (i % 3) * 30 };
    }).sort(function (x, y) { return y.bottom - x.bottom; });   // 奥 (上) の子から描き、手前の子が前に出る
    let html = walkers.map(function (w) {
      const info = C.petInfo(state, w.id, now);
      return '<button type="button" class="walker lv' + info.level + '" data-ch="' + w.id + '" aria-label="おやつ" style="left:' + w.left.toFixed(0) +
        'px;bottom:' + w.bottom + 'px;--dist:' + w.dist.toFixed(0) + 'px;--dur:' + w.dur.toFixed(1) + 's;--del:-' + (Math.random() * w.dur).toFixed(1) + 's">' +
        (info.level >= 2 ? '<span class="wk-lv">♥' + info.level + '</span>' : '') + (info.level >= 5 ? '<span class="wk-crown">👑</span>' : '') +
        '<span class="wk-body">' + A.svg(w.id, { delay: randomDelay() }).replace('<svg ', '<svg width="100%" height="100%" ') + '</span></button>';
    }).join('');
    const fedEver = Object.keys(state.pets).length > 0;
    if (shown.length && !fedEver) html += '<p class="wk-hint">あるいている こを タップすると、おやつを あげられるよ</p>';
    els.ground.innerHTML = html;
  }

  els.ground.addEventListener('click', function (e) {
    const w = e.target.closest('.walker');
    if (w) openPet(w.dataset.ch);
  });

  // ---------------------------------------------------------------- おやつ
  let petCh = null;

  function snackView(id) {
    const sn = C.SNACKS[id];
    if (id === 'fav') return { icon: C.CHARAS[petCh].food, name: C.CHARAS[petCh].foodName, price: sn.price, aff: sn.aff };
    return { icon: sn.icon, name: sn.name, price: sn.price, aff: sn.aff };
  }

  function renderPet() {
    const info = C.petInfo(state, petCh, Date.now());
    const card = C.CARDS.find(function (c) { return c.chara === petCh; });   // 名前は いちばん はじめの カードから
    els.psName.textContent = card.name;
    els.psLv.textContent = 'なかよし Lv.' + info.level + (info.level >= info.maxLevel ? ' (MAX)' : '');
    els.psBar.style.width = (info.progress * 100).toFixed(0) + '%';
    els.psNext.textContent = info.level >= info.maxLevel ? 'いちばん なかよし！' : 'つぎの レベルまで ♥' + info.toNext;
    let tummy = '';
    for (let i = 0; i < C.DAILY_SNACKS; i++) tummy += '<i class="' + (i < info.fedToday ? 'on' : '') + '"></i>';
    els.psTummy.innerHTML = '<span>きょうの おやつ</span>' + tummy + (info.snacksLeft ? '' : '<b>おなか いっぱい！</b>');
    els.psSnacks.querySelectorAll('button').forEach(function (b) {
      const v = snackView(b.dataset.snack);
      b.querySelector('.sn-ico').textContent = v.icon;
      b.querySelector('.sn-name').textContent = v.name;
      b.querySelector('.sn-price').textContent = C.formatMoney(v.price);
      b.querySelector('.sn-aff').textContent = '♥+' + v.aff;
      b.disabled = info.snacksLeft <= 0 || state.money < v.price;
    });
    els.psTip.textContent = info.canPet ? 'さわって なでてね (1にち1かい ♥+1)' : 'きょうは もう なでたよ';
  }

  function openPet(ch) {
    Sfx.unlock();
    petCh = ch;
    els.psAnimal.innerHTML = A.svg(ch, { delay: randomDelay() });
    els.psFx.innerHTML = '';
    els.psLevelUp.hidden = true;
    renderPet();
    els.petSheet.hidden = false;
    els.petSheet.querySelector('.ps-panel').animate([{ transform: 'translateY(100%)' }, { transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.3,1.2,.5,1)' });
  }

  function closePet() {
    els.petSheet.hidden = true;
    petCh = null;
    renderWalkers();
  }

  function hearts(n, big) {
    const box = els.psFx.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const h = document.createElement('span');
      h.className = 'ps-heart';
      h.textContent = '♥';
      h.style.left = (box.width / 2 + (Math.random() * 2 - 1) * 70) + 'px';
      h.style.top = (box.height * 0.45) + 'px';
      h.style.fontSize = (big ? 26 : 18) + Math.random() * 12 + 'px';
      els.psFx.appendChild(h);
      h.animate([{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { transform: 'translateY(-30px) scale(1.1)', opacity: 1, offset: 0.25 },
        { transform: 'translateY(-' + (110 + Math.random() * 60) + 'px) scale(1)', opacity: 0 }],
      { duration: 1100 + Math.random() * 400, delay: i * 70, easing: 'ease-out', fill: 'backwards' }).onfinish = function () { h.remove(); };
    }
  }

  function happy(kind) {
    const a = els.psAnimal;
    if (kind === 'munch') {
      a.animate([{ transform: 'none' }, { transform: 'scale(1.08, .92)' }, { transform: 'scale(.96, 1.05)' }, { transform: 'scale(1.06, .94)' }, { transform: 'none' }], { duration: 600 });
    } else if (kind === 'no') {
      a.animate([{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 });
    } else {
      a.animate([{ transform: 'none' }, { transform: 'translateY(-26px)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    }
  }

  function levelUp(lv) {
    els.psLevelUp.innerHTML = '<b>なかよし Lv.' + lv + ' に なった！</b><span>' + (TRICK[lv] || '') + '</span>';
    els.psLevelUp.hidden = false;
    els.psLevelUp.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }],
      { duration: 500, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    Sfx.play('fanfareRR');
    hearts(14, true);
    clearTimeout(levelUpTimer);
    levelUpTimer = setTimeout(function () { els.psLevelUp.hidden = true; }, 3500);
  }
  let levelUpTimer = 0;

  els.psAnimal.addEventListener('click', function () {
    const r = C.pet(state, petCh, Date.now());
    if (!r.ok) { happy('no'); return; }
    saveNow();
    Sfx.play('shine');
    happy('jump');
    hearts(4, false);
    renderPet();
    if (r.levelUp) levelUp(r.level);
  });

  els.psSnacks.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-snack]');
    if (!b || b.disabled) return;
    const id = b.dataset.snack;
    const r = C.feed(state, petCh, id, Date.now());
    if (!r.ok) return;
    saveNow();
    renderMoney();
    // おやつが口へ飛んでいく → もぐもぐ → ハート
    const from = b.querySelector('.sn-ico').getBoundingClientRect();
    const to = els.psAnimal.getBoundingClientRect();
    const host = els.petSheet.querySelector('.ps-panel').getBoundingClientRect();
    const fly = document.createElement('span');
    fly.className = 'ps-fly';
    fly.textContent = snackView(id).icon;
    els.petSheet.querySelector('.ps-panel').appendChild(fly);
    const x0 = from.left - host.left, y0 = from.top - host.top;
    const x1 = to.left - host.left + to.width / 2 - 16, y1 = to.top - host.top + to.height * 0.5;
    Sfx.play('pop');
    fly.animate([{ transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1)' },
      { transform: 'translate(' + ((x0 + x1) / 2) + 'px,' + (Math.min(y0, y1) - 60) + 'px) scale(1.3)', offset: 0.5 },
      { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.3)', opacity: 0.6 }],
    { duration: 520, easing: 'ease-in' }).onfinish = function () {
      fly.remove();
      happy('munch');
      Sfx.play('shine');
      hearts(r.gain * 2, id === 'fav');
      if (id === 'fav') {
        const say = document.createElement('span');
        say.className = 'ps-say';
        say.textContent = 'だいすき！';
        els.psFx.appendChild(say);
        say.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
          { duration: 1400 }).onfinish = function () { say.remove(); };
      }
      renderPet();
      if (r.levelUp) levelUp(r.level);
    };
    renderPet();
  });

  els.psClose.addEventListener('click', closePet);
  els.petSheet.addEventListener('click', function (e) { if (e.target === els.petSheet) closePet(); });

  // ---------------------------------------------------------------- パック画面
  function renderBuy() {
    const enough = state.money >= C.PACK_PRICE;
    const text = enough ? C.formatMoney(C.PACK_PRICE) + ' コインで かう' : 'あと ' + C.formatMoney(C.PACK_PRICE - state.money) + ' コイン';
    if (els.btnBuyLabel.textContent !== text) els.btnBuyLabel.textContent = text;
    els.btnBuy.disabled = !enough;
    renderBoxShop();
  }

  // ---- いま見ているパックの種類 (パック画面とずかんで別々に覚える)
  let curSet = C.SET.id;
  let zkSet = C.SET.id;

  function shortName(set) { return set.name.replace(/パック$/, '').replace('みらいの どうぶつ', 'みらい'); }

  /** パックの小さい絵 (えらぶ画面用。スターの子 1 人だけ描いて軽くする) */
  function miniPack(st) {
    return '<span class="sp-mini" style="--pk1:' + st.colors[0] + ';--pk2:' + st.colors[1] + ';--pk3:' + st.colors[2] + '">' +
      A.svg(st.mascots[2], { walk: false }) + '<i>' + st.mark + '</i></span>';
  }

  /** いまのパックを出して「えらぶ」を開くボタン */
  function barHTML(st, sub) {
    return '<button type="button" class="sp-bar" data-open="1">' + miniPack(st) +
      '<span class="sp-bar-text"><b>' + st.mark + ' ' + st.name + '</b><small>' + sub + '</small></span>' +
      '<span class="sp-bar-go">ほかの パック ▸</span></button>';
  }

  // ---- パックを えらぶ画面 (11 パックの一覧)
  let sheetMode = 'packs';
  let sheetBuilt = false;

  function buildSheet() {
    els.pshBody.innerHTML = '<div class="psh-grid">' + C.SETS.map(function (st) {
      return '<button type="button" class="sp-btn" data-set="' + st.id + '">' + miniPack(st) +
        '<span class="sp-name">' + shortName(st) + '</span><i class="sp-badge" hidden></i></button>';
    }).join('') + '</div>';
    sheetBuilt = true;
  }

  function openSheet(mode) {
    if (!sheetBuilt) buildSheet();
    sheetMode = mode;
    const sel = mode === 'packs' ? curSet : zkSet;
    els.pshTitle.textContent = mode === 'packs' ? 'あける パックを えらぶ' : 'ずかんの パックを えらぶ';
    els.pshBody.querySelectorAll('.sp-btn').forEach(function (b) {
      const id = b.dataset.set;
      b.classList.toggle('on', id === sel);
      let t = '', done = false;
      if (mode === 'packs') {
        const n = C.packsInHand(state, id);
        t = n ? '🎁' + n : '';
      } else {
        const st = C.setById(id);
        const n = C.collectedCount(state, function (c) { return c.set === id; });
        done = n === st.cards.length;
        t = n ? (done ? '★' : n + '/' + st.cards.length) : '';
      }
      const badge = b.querySelector('.sp-badge');
      badge.hidden = !t;
      badge.textContent = t;
      b.classList.toggle('done', done);
    });
    els.packSheet.hidden = false;
    els.packSheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    const on = els.pshBody.querySelector('.sp-btn.on');
    if (on) on.scrollIntoView({ block: 'center' });
  }

  function closeSheet() { els.packSheet.hidden = true; }

  els.pshClose.addEventListener('click', closeSheet);
  els.packSheet.addEventListener('click', function (e) {
    if (e.target === els.packSheet) { closeSheet(); return; }
    const b = e.target.closest('.sp-btn');
    if (!b) return;
    closeSheet();
    if (sheetMode === 'packs') pickPackSet(b.dataset.set);
    else pickZukanSet(b.dataset.set);
  });

  // ---- BOX ごと買う。高い買い物なので、1 回目のタップは「ほんとうに？」に変わるだけ
  let boxConfirmUntil = 0;
  let boxConfirmTimer = 0;

  function renderBoxShop() {
    const enough = state.money >= C.BOX_PRICE;
    const full = state.boxes.length >= C.MAX_BOXES;
    const confirming = enough && performance.now() < boxConfirmUntil;
    let text;
    if (full) text = 'BOX が いっぱい';
    else if (!enough) text = 'BOX: あと ' + C.formatMoney(C.BOX_PRICE - state.money) + ' コイン';
    else if (confirming) text = 'ほんとうに かう？ もういちど タップ';
    else text = C.formatMoney(C.BOX_PRICE) + ' コインで BOX を かう';
    if (els.btnBoxLabel.textContent !== text) els.btnBoxLabel.textContent = text;
    els.btnBox.disabled = !enough || full;
    els.btnBox.classList.toggle('confirm', confirming);

    const inHand = C.packsInHand(state, curSet);
    els.myBox.hidden = inHand === 0;
    els.btnBoxBar.classList.toggle('has', inHand > 0);
    els.boxBarSub.textContent = inHand ? 'てもとの BOX: のこり ' + inHand + 'パック ▸ ひらく' : '30パック入り・SR いじょう 1まい かくてい！';
    if (inHand) {
      const st = C.boxStatus(C.boxInHand(state, curSet));
      const more = state.boxes.filter(function (b) { return b.set === curSet; }).length - 1;
      els.myBoxLeft.textContent = 'てもとの BOX: のこり ' + st.left + 'パック' + (more ? ' (ほかに ' + more + 'はこ)' : '');
      els.myBoxSr.textContent = st.srUpOut ? 'SR いじょう: もう でた' : 'SR いじょう: まだ でていない！';
      els.btnOpenAllLabel.textContent = 'のこり ' + st.left + 'パック まとめて あける';
    }
  }

  els.btnBox.addEventListener('click', function () {
    if (state.money < C.BOX_PRICE) return;
    if (performance.now() >= boxConfirmUntil) {
      boxConfirmUntil = performance.now() + 3000;
      clearTimeout(boxConfirmTimer);
      boxConfirmTimer = setTimeout(renderBoxShop, 3050);
      renderBoxShop();
      return;
    }
    boxConfirmUntil = 0;
    if (!C.buyBox(state, Math.random, curSet).ok) return;
    saveNow();
    Sfx.unlock();
    Sfx.play('shine');
    renderMoney();
    renderPacks();
    els.boxArt.animate(
      [{ transform: 'translateY(-120px) rotate(-8deg)', opacity: 0 }, { transform: 'translateY(8px) rotate(2deg)', opacity: 1, offset: 0.7 }, { transform: 'none' }],
      { duration: 600, easing: 'cubic-bezier(.3,1.3,.5,1)' }
    );
    els.myBox.animate([{ transform: 'scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 400, delay: 250, fill: 'backwards' });
  });

  // BOX の画面 (いちらんと同じ下からの札)。あけはじめるときは閉じる
  function openBoxSheet() { els.boxSheet.hidden = false; els.boxSheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }); }
  function closeBoxSheet() { els.boxSheet.hidden = true; }
  els.btnBoxBar.addEventListener('click', openBoxSheet);
  els.bxClose.addEventListener('click', closeBoxSheet);
  els.boxSheet.addEventListener('click', function (e) { if (e.target === els.boxSheet) closeBoxSheet(); });
  els.btnOpenBox.addEventListener('click', function () { closeBoxSheet(); openPack('box'); });
  els.btnOpenAll.addEventListener('click', function () { closeBoxSheet(); openBoxAll(); });

  /** 手もとの BOX の残りを全部開けて、レアだけ演出で見せる */
  function openBoxAll() {
    Sfx.unlock();
    lastSet = curSet;
    const set = curSet;
    const res = C.openBoxAll(state, Date.now(), Math.random, set);
    if (!res.ok) return;
    saveNow();
    renderPacks();
    O.start({
      set: set,
      cards: res.cards,
      show: res.show,
      bulk: { packs: res.packs.length, counts: res.counts, newNos: res.newNos },
      againLabel: againLabel,
      onAgain: function () {
        const k = nextKind(set);
        if (!k || !openPack(k, set)) O.close();
      },
      onClose: function () {
        renderWalkers();
        renderPacks();
        if (!$('scZukan').hidden) renderZukan();
      }
    });
  }

  function renderFree() {
    const now = Date.now();
    const ready = C.canOpenFree(state, now);
    els.btnFree.disabled = !ready;
    els.shopPack.classList.toggle('ready', ready);
    const text = ready ? 'きょうの むりょうパック！' : 'むりょうは また あした (' + C.formatWait(C.msUntilNextDay(now)) + ')';
    if (els.btnFreeLabel.textContent !== text) els.btnFreeLabel.textContent = text;
    els.packDot.hidden = !ready && C.packsInHand(state) === 0;
  }

  function renderPicker() {
    els.setPick.innerHTML = '<button type="button" class="sp-bar sp-list" data-open="1">📚 いちらん</button>';
    const n = C.packsInHand(state, curSet);
    els.stageHave.textContent = 'てもと 🎁' + n;
    els.stageHave.classList.toggle('some', n > 0);
    els.stageIndex.textContent = (C.SETS.findIndex(function (st) { return st.id === curSet; }) + 1) + ' / ' + C.SETS.length;
  }

  function renderPacks() {
    renderPicker();
    renderBuy();
    renderFree();
    const shop = state.shop[curSet];
    const left = shop ? C.BOX_PACKS - shop.next : C.BOX_PACKS;
    els.boxLeft.textContent = 'お店の BOX (' + C.BOX_PACKS + 'パック) の のこり: ' + (left === 0 ? C.BOX_PACKS : left) + 'パック';
  }

  /** いま選んでいるパックの絵・名前・でるカードの表 */
  function buildShop() {
    const set = C.setById(curSet);
    els.shopPack.innerHTML = V.packHTML(curSet);
    els.boxArt.style.cssText = '--pk1:' + set.colors[0] + ';--pk2:' + set.colors[1] + ';--pk3:' + set.colors[2];
    els.boxArt.innerHTML = '<i class="bx-pack"></i><i class="bx-pack"></i><i class="bx-pack"></i><i class="bx-pack"></i>' +
      '<div class="bx-front"><b>BOX</b><span>' + shortName(set) + '</span></div>';
    els.shopName.textContent = set.name;
    els.stageMark.textContent = set.mark;
    const cat = C.CATS.find(function (c) { return c.id === set.cat; });
    els.stageDesc.textContent = '「' + set.title + '」 ・ ' + (cat ? cat.name : '') + ' ・ ' + set.cards.length + 'まい';
    els.stage.style.setProperty('--pk1', set.colors[0]);
    const rows = [
      ['C', '1パックに 3まい'], ['U', '1パックに 1まい'], ['R', 'レアわくに いちばん よく でる'],
      ['RR', '1BOX に 4まい くらい'], ['AR', '1BOX に 3まい くらい'], ['SR', '1BOX に 1まい くらい'],
      ['SAR', '5BOX に 1まい くらい'], ['MUR', '50BOX に 1まい くらい'], ['LR', '150BOX に 1まい くらい']
    ];
    els.rates.innerHTML = '<table>' + rows.map(function (r) {
      return '<tr><td><span class="rmark rm-' + r[0] + '">' + r[0] + '</span></td><td>' + C.RARITIES[r[0]].label +
        '</td><td>' + r[1] + '</td><td>' + C.POOL[curSet][r[0]].length + 'しゅ</td></tr>';
    }).join('') + '</table><p class="note">1BOX = 30パック。ポケモンカードの かくだいパックと おなじ くみあわせで でてくるよ。' +
      'むりょうパックは 1にち 1かい、' + C.SETS.length + 'しゅるいの なかから すきな パックを えらべる。1パックずつ かうと、おみせの おなじ BOX から じゅんばんに でる。' +
      'BOX ごと かうと、じぶんだけの あたらしい BOX が もらえて、SR いじょうが かならず 1まい はいっている。</p>';
  }

  els.setPick.addEventListener('click', function (e) {
    if (e.target.closest('.sp-bar')) openSheet('packs');
  });

  /** dir: 1 = つぎ (右から入る) / -1 = まえ / 0 = 一覧から (上から落ちる) */
  function pickPackSet(id, dir) {
    if (id === curSet) return;
    curSet = id;
    boxConfirmUntil = 0;
    buildShop();
    renderPacks();
    els.shopPack.getAnimations().forEach(function (a) { if (a.id === 'slide') a.cancel(); });
    const k = dir ? [{ transform: 'translateX(' + (dir * 70) + '%) rotate(' + (dir * 8) + 'deg)', opacity: 0 }, { transform: 'none', opacity: 1 }]
      : [{ transform: 'translateY(-24px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }];
    const a = els.shopPack.animate(k, { duration: 320, easing: 'cubic-bezier(.25,1.3,.5,1)' });
    a.id = 'slide';
  }

  function stepSet(dir) {
    const i = C.SETS.findIndex(function (st) { return st.id === curSet; });
    const n = C.SETS.length;
    pickPackSet(C.SETS[(i + dir + n) % n].id, dir);
    Sfx.play('whoosh');
  }

  els.btnPrev.addEventListener('click', function () { stepSet(-1); });
  els.btnNext.addEventListener('click', function () { stepSet(1); });

  // パックを指で 左右に はらっても めくれる
  (function () {
    let x0 = null, y0 = 0, id = null;
    els.stageRow.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.stage-arrow')) return;
      x0 = e.clientX; y0 = e.clientY; id = e.pointerId;
    });
    els.stageRow.addEventListener('pointerup', function (e) {
      if (x0 === null || e.pointerId !== id) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) stepSet(dx < 0 ? 1 : -1);
    });
    els.stageRow.addEventListener('pointercancel', function () { x0 = null; });
  })();

  /** 「もう1パック」で次に開けるもの: むりょう → 手もとの BOX → 1 パック買う */
  function nextKind(setId) {
    if (C.canOpenFree(state, Date.now())) return 'free';
    if (C.packsInHand(state, setId || curSet) > 0) return 'box';
    if (state.money >= C.PACK_PRICE) return 'buy';
    return null;
  }

  function againLabel() {
    const k = nextKind(lastSet);
    if (k === 'free') return 'むりょうパックを あける！';
    if (k === 'box') return 'BOX から つぎを あける (のこり ' + C.packsInHand(state, lastSet) + ')';
    if (k === 'buy') return 'もう1パック かう (' + C.formatMoney(C.PACK_PRICE) + ')';
    return null;
  }

  let lastSet = C.SET.id;   // いちばん最後に開けたパックの種類 (「もう1パック」はこれ)

  function openPack(kind, setId) {
    Sfx.unlock();
    const set = setId || curSet;
    const res = C.openPack(state, kind, Date.now(), Math.random, set);
    if (!res.ok) return false;
    lastSet = set;
    saveNow();   // 開けた時点で記録する (途中で閉じても、もらったカードは残る)
    renderMoney();
    renderPacks();
    O.start({
      set: set,
      cards: res.cards,
      show: res.show,
      againLabel: againLabel,
      onAgain: function () {
        const k = nextKind(set);
        if (!k || !openPack(k, set)) O.close();
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
    const set = C.setById(zkSet);
    const all = C.collectedCount(state, function (c) { return c.set === zkSet; });
    const total = C.collectedCount(state, function () { return true; });
    els.zkPick.innerHTML = barHTML(set, 'ぜんぶで ' + total + ' / ' + C.CARDS.length + ' まい');
    const main = C.collectedCount(state, function (c) { return c.set === zkSet && Number(c.num) <= set.mainCount; });
    els.zkTitle.textContent = set.mark + ' ' + set.name;
    els.zkCount.textContent = all + ' / ' + set.cards.length;
    els.zkSub.textContent = 'ふつう ' + main + '/' + set.mainCount + ' ・ シークレット ' + (all - main) + '/' + (set.cards.length - set.mainCount);
    els.zkGrid.innerHTML = set.cards.map(function (c) {
      const n = state.owned[c.no] || 0;
      if (!n) {
        return '<button type="button" class="zk-cell locked" data-no="' + c.no + '" disabled>' + V.backHTML() +
          '<span class="zk-q">？</span><span class="zk-no">' + c.num + '</span></button>';
      }
      return '<button type="button" class="zk-cell" data-no="' + c.no + '">' + V.html(c, { small: true }) +
        (n > 1 ? '<span class="zk-n">×' + n + '</span>' : '') + '</button>';
    }).join('');
  }

  els.zkPick.addEventListener('click', function (e) {
    if (e.target.closest('.sp-bar')) openSheet('zukan');
  });

  function pickZukanSet(id) {
    if (id === zkSet) return;
    zkSet = id;
    renderZukan();
    $('scZukan').scrollTop = 0;
  }

  let detailTilt = null;
  els.zkGrid.addEventListener('click', function (e) {
    const cell = e.target.closest('.zk-cell');
    if (!cell || cell.disabled) return;
    const card = C.cardByNo(cell.dataset.no);
    els.dtBox.innerHTML = '<div class="dt-card">' + V.html(card) + '</div>' +
      '<div class="dt-meta">' + card.rarity + ' ' + C.RARITIES[card.rarity].label +
      '<small>もっている かず: ' + state.owned[card.no] + 'まい</small></div>' +
      '<button type="button" class="btn btn-mid dt-feed" data-ch="' + card.chara + '"><span class="btn-label">' + C.CHARAS[card.chara].food + ' この子に おやつを あげる</span></button>';
    els.detail.hidden = false;
    detailTilt = V.tilt(els.dtBox.querySelector('.dt-card'), { idle: true });
  });
  function closeDetail() {
    els.detail.hidden = true;
    if (detailTilt) { detailTilt.stop(); detailTilt = null; }
  }

  els.detail.addEventListener('click', function (e) {
    const fb = e.target.closest('.dt-feed');
    if (fb) {
      closeDetail();
      openPet(fb.dataset.ch);
      return;
    }
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
    els.btnMute.classList.toggle('off', !!state.muted);   // 音がきれているときは おんぷに 斜めの線
    Sfx.setMuted(state.muted);
  }
  els.btnMute.addEventListener('click', function () {
    state.muted = !state.muted;
    saveNow();
    renderMute();
    Sfx.unlock();
  });

  // ---------------------------------------------------------------- タイトル画面
  // 開くたびに はじめに出る。「あそぶ」を押すと ひろば (木をタップする画面) へ。?title=0 のときは出さない (自動テスト用)
  const titleEl = $('title');
  let titleOpen = true;
  document.documentElement.classList.add('on-title');
  function closeTitle(instant) {
    if (!titleOpen) return;
    titleOpen = false;
    document.documentElement.classList.remove('on-title');
    // 状態バーの色は ウェブ画面の外なので絵を描けない。タイトルのあいだは絵の空に近い色にして つなげ、閉じたら もとの色へ
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', '#fff3d6');
    titleEl.classList.add('leave');
    const done = function () { titleEl.hidden = true; };
    if (instant) { done(); return; }
    window.setTimeout(done, 480);
  }
  $('btnPlay').addEventListener('click', function () {
    Sfx.unlock();
    Sfx.play('pop');
    showTab('Home');
    closeTitle(false);
  });
  if (/[?&]title=0\b/.test(window.location.search)) closeTitle(true);

  // ---------------------------------------------------------------- 画面の大きさの診断 (実機の写真 1 枚で確かめるため)
  // 版 / 描ける (#app の高さ) / 窓 (innerHeight) / vh。描ける = 窓 のとき、下が切れていない
  const APP_VER = 'v12';
  function renderDiag() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:100vh;visibility:hidden';
    document.body.appendChild(probe);
    const vh = probe.getBoundingClientRect().height;
    probe.remove();
    $('diag').textContent = APP_VER + ' 描ける' + Math.round($('app').getBoundingClientRect().height) + ' 窓' + Math.round(window.innerHeight) + ' vh' + Math.round(vh);
  }

  // ---------------------------------------------------------------- 起動
  function main() {
    renderDiag();
    window.MiniGames.init({ C: C, A: A, Sfx: Sfx, getState: function () { return state; }, onChange: function () { saveNow(); renderMoney(); } });
    window.addEventListener('resize', renderDiag);
    buildShop();
    renderUpgrade();
    renderWalkers();
    renderFree();
    renderMute();
    window.setInterval(function () { renderFree(); window.MiniGames.refresh(); }, 20000);

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
      curSet: function () { return curSet; },
      /** テスト用: 次の BOX の 1 パック目の中身を決める (top: R/RR/SR/SAR/MUR/LR, ar: true/false) */
      setBoxConfirmed: function () { boxConfirmUntil = performance.now() + 3000; },
      rigNextPack: function (top, ar, set) {
        const st = set || curSet;
        state.shop[st] = C.newBox(Math.random, st);
        state.shop[st].packs[0] = { top: top, ar: !!ar };
        saveNow();
      },
      mini: window.MiniGames,
      closeTitle: function () { closeTitle(true); },
      titleOpen: function () { return titleOpen; },
      flush: saveNow
    };
  }

  main();
})();
