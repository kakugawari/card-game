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
    btnBuy: $('btnBuy'), btnBuyLabel: $('btnBuyLabel'), btnBox: $('btnBox'), btnBoxLabel: $('btnBoxLabel'),
    boxArt: $('boxArt'), btnOpenAll: $('btnOpenAll'), btnOpenAllLabel: $('btnOpenAllLabel'), myBox: $('myBox'), myBoxLeft: $('myBoxLeft'), myBoxSr: $('myBoxSr'), btnOpenBox: $('btnOpenBox'), boxLeft: $('boxLeft'), rates: $('rates'), packDot: $('packDot'),
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
  const TRICK = { 2: 'うれしいと ハートが でるように なった！', 3: 'ぴょんと はねるように なった！', 4: 'くるっと まわるように なった！', 5: 'かんむりを もらった！' };

  /**
   * ひろばの草原: 手前に なかよしの子 (3 人まで・タップで おやつ)、奥を ほかの子が歩く。
   * なかよしの子は動き回らず、木の下で待っている (押しやすいように)
   */
  function renderWalkers() {
    const charas = [];
    const best = {};
    C.CARDS.forEach(function (c) {
      if (!state.owned[c.no]) return;
      if (best[c.chara] === undefined) charas.push(c.chara);
      best[c.chara] = Math.max(best[c.chara] || 0, C.rank(c.rarity));
    });
    charas.sort(function (a, b) { return best[b] - best[a]; });
    const shown = charas.filter(function (ch) { return state.favs.indexOf(ch) < 0; }).slice(0, state.favs.length ? 4 : 6);
    const width = els.ground.clientWidth || 430;
    const back = state.favs.length > 0;
    // 奥の子: ひろい草原を、それぞれ自分の道すじで行ったり来たりする。奥 (上) の子から先に描き、手前の子が前に出る
    const walkers = shown.map(function (id, i) {
      const dist = 130 + Math.random() * 110;
      const dur = dist / (14 + Math.random() * 6);
      return { id: id, dist: dist, dur: dur, left: Math.random() * Math.max(0, width - 80 - dist), bottom: (back ? 126 : 6) + (i % 2) * (back ? 6 : 14) };
    }).sort(function (x, y) { return y.bottom - x.bottom; });
    let html = walkers.map(function (w) {
      return '<div class="walker' + (back ? ' far' : '') + '" style="left:' + w.left.toFixed(0) + 'px;bottom:' + w.bottom + 'px;--dist:' + w.dist.toFixed(0) +
        'px;--dur:' + w.dur.toFixed(1) + 's;--del:-' + (Math.random() * w.dur).toFixed(1) + 's">' +
        A.svg(w.id, { delay: randomDelay() }).replace('<svg ', '<svg width="100%" height="100%" ') + '</div>';
    }).join('');
    // 手前: なかよしの子
    const n = state.favs.length;
    html += state.favs.map(function (ch, i) {
      const info = C.petInfo(state, ch, Date.now());
      const x = (width * (i + 1)) / (n + 1) - 52;
      return '<button type="button" class="fav lv' + info.level + '" data-ch="' + ch + '" style="left:' + x.toFixed(0) + 'px" aria-label="おやつ">' +
        '<span class="fav-lv">♥' + info.level + '</span>' + (info.level >= 5 ? '<span class="fav-crown">👑</span>' : '') +
        '<span class="fav-body">' + A.svg(ch, { delay: randomDelay() }).replace('<svg ', '<svg width="100%" height="100%" ') + '</span>' +
        (info.snacksLeft > 0 ? '<span class="fav-want">' + C.CHARAS[ch].food + '</span>' : '') + '</button>';
    }).join('');
    if (!n && charas.length) html += '<p class="fav-hint">ずかんで「なかよし」の子を えらぶと、ここで おやつを あげられるよ</p>';
    els.ground.innerHTML = html;
  }

  els.ground.addEventListener('click', function (e) {
    const f = e.target.closest('.fav');
    if (f) openPet(f.dataset.ch);
  });

  // ---------------------------------------------------------------- おやつ (なかよしの子)
  let petCh = null;

  function snackView(id) {
    const sn = C.SNACKS[id];
    if (id === 'fav') return { icon: C.CHARAS[petCh].food, name: C.CHARAS[petCh].foodName, price: sn.price, aff: sn.aff };
    return { icon: sn.icon, name: sn.name, price: sn.price, aff: sn.aff };
  }

  function renderPet() {
    const info = C.petInfo(state, petCh, Date.now());
    const card = C.CARDS.find(function (c) { return c.chara === petCh; });
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

    const inHand = C.packsInHand(state);
    els.myBox.hidden = inHand === 0;
    if (inHand) {
      const st = C.boxStatus(state.boxes[0]);
      const more = state.boxes.length - 1;
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
    if (!C.buyBox(state, Math.random).ok) return;
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

  els.btnOpenBox.addEventListener('click', function () { openPack('box'); });
  els.btnOpenAll.addEventListener('click', openBoxAll);

  /** 手もとの BOX の残りを全部開けて、レアだけ演出で見せる */
  function openBoxAll() {
    Sfx.unlock();
    const res = C.openBoxAll(state, Date.now());
    if (!res.ok) return;
    saveNow();
    renderPacks();
    O.start({
      cards: res.cards,
      show: res.show,
      bulk: { packs: res.packs.length, counts: res.counts, newNos: res.newNos },
      againLabel: againLabel,
      onAgain: function () {
        const k = nextKind();
        if (!k || !openPack(k)) O.close();
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

  function renderPacks() {
    renderBuy();
    renderFree();
    const left = state.box ? C.BOX_PACKS - state.box.next : C.BOX_PACKS;
    els.boxLeft.textContent = 'お店の BOX (' + C.BOX_PACKS + 'パック) の のこり: ' + (left === 0 ? C.BOX_PACKS : left) + 'パック';
  }

  function buildShop() {
    els.shopPack.innerHTML = V.packHTML();
    els.boxArt.innerHTML = '<i class="bx-pack"></i><i class="bx-pack"></i><i class="bx-pack"></i><i class="bx-pack"></i>' +
      '<div class="bx-front"><b>BOX</b><span>30パック入り</span></div>';
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
      'むりょうパックも 1パックずつ かうパックも、おみせの おなじ BOX から じゅんばんに でる。' +
      'BOX ごと かうと、じぶんだけの あたらしい BOX が もらえて、SR いじょうが かならず 1まい はいっている。</p>';
  }

  /** 「もう1パック」で次に開けるもの: むりょう → 手もとの BOX → 1 パック買う */
  function nextKind() {
    if (C.canOpenFree(state, Date.now())) return 'free';
    if (C.packsInHand(state) > 0) return 'box';
    if (state.money >= C.PACK_PRICE) return 'buy';
    return null;
  }

  function againLabel() {
    const k = nextKind();
    if (k === 'free') return 'むりょうパックを あける！';
    if (k === 'box') return 'BOX から つぎを あける (のこり ' + C.packsInHand(state) + ')';
    if (k === 'buy') return 'もう1パック かう (' + C.formatMoney(C.PACK_PRICE) + ')';
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
        const k = nextKind();
        if (!k || !openPack(k)) O.close();
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
      '<small>もっている かず: ' + state.owned[card.no] + 'まい</small></div>' +
      '<button type="button" class="btn btn-mid dt-fav" data-ch="' + card.chara + '"><span class="btn-label"></span></button>' +
      '<p class="dt-favmsg"></p>';
    renderFavButton();
    els.detail.hidden = false;
    detailTilt = V.tilt(els.dtBox.querySelector('.dt-card'), { idle: true });
  });
  function renderFavButton() {
    const b = els.dtBox.querySelector('.dt-fav');
    if (!b) return;
    const on = state.favs.indexOf(b.dataset.ch) >= 0;
    b.classList.toggle('on', on);
    b.firstChild.textContent = on ? '♥ なかよし (タップで やめる)' : '♡ なかよしに する';
    els.dtBox.querySelector('.dt-favmsg').textContent = on ? 'コインの木の下で まっているよ' :
      state.favs.length >= C.MAX_FAVS ? 'なかよしは ' + C.MAX_FAVS + 'にん まで。だれかを やめると えらべるよ' : '';
  }

  els.detail.addEventListener('click', function (e) {
    const fb = e.target.closest('.dt-fav');
    if (fb) {
      const r = C.toggleFav(state, fb.dataset.ch);
      if (r.ok) {
        saveNow();
        Sfx.unlock();
        if (r.on) { Sfx.play('shine'); fb.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 300 }); }
        renderWalkers();
      } else {
        fb.animate([{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 });
      }
      renderFavButton();
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
      setBoxConfirmed: function () { boxConfirmUntil = performance.now() + 3000; },
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
