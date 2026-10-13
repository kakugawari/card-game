// ミニゲーム (どうぶつ めくり / おやつキャッチ)。ひろばの左上のボタンから開く。
// ごほうびの決め方・1 日の回数・ならべ方は core.js (miniFinish など)。ここは画面と指の操作だけ
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  let C, A, Sfx, getState, onChange;
  let el = {};
  let running = null;          // いま遊んでいるゲームの片づけ関数 (✕で戻ったとき・もういちどのときに呼ぶ)
  const opts = { catchSeconds: 0 };   // テスト用: おやつキャッチの長さを短くする

  const ITEM_SVG = {
    apple: '<svg viewBox="0 0 40 40"><circle cx="20" cy="23" r="14" fill="#ff6b6b" stroke="#c0392b" stroke-width="2.5"/><path d="M20 10q0-6 6-7" stroke="#6b4a2b" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="27" cy="8" rx="5.5" ry="3" fill="#7bd36a" stroke="#4f9f35" stroke-width="1.4" transform="rotate(-25 27 8)"/><circle cx="14" cy="19" r="3" fill="#fff" opacity=".6"/></svg>',
    cookie: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#e8b36b" stroke="#a8743a" stroke-width="2.5"/><g fill="#6b4226"><circle cx="14" cy="15" r="2.6"/><circle cx="25" cy="13" r="2.4"/><circle cx="26" cy="24" r="2.8"/><circle cx="15" cy="26" r="2.4"/><circle cx="21" cy="19" r="2"/></g></svg>',
    gold: '<svg viewBox="0 0 40 40"><circle cx="20" cy="23" r="14" fill="#ffd23f" stroke="#c98a0b" stroke-width="2.5"/><path d="M20 10q0-6 6-7" stroke="#8a5a1f" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="27" cy="8" rx="5.5" ry="3" fill="#ffe98a" stroke="#c98a0b" stroke-width="1.4" transform="rotate(-25 27 8)"/><path d="M12 17l2 .8-.8 2-.8-2zM29 28l1.6.6-.6 1.6-.6-1.6z" fill="#fff"/><circle cx="14" cy="19" r="3" fill="#fff" opacity=".7"/></svg>',
    chestnut: '<svg viewBox="0 0 40 40"><g stroke="#4a3426" stroke-width="3" stroke-linecap="round"><path d="M20 3v7M20 30v7M3 20h7M30 20h7M8 8l5 5M27 27l5 5M32 8l-5 5M13 27l-5 5"/></g><circle cx="20" cy="20" r="12" fill="#8a5a34" stroke="#4a3426" stroke-width="2.5"/><path d="M13 16l5 2M27 16l-5 2" stroke="#2c1b12" stroke-width="2.4" stroke-linecap="round"/><circle cx="15" cy="21" r="2" fill="#2c1b12"/><circle cx="25" cy="21" r="2" fill="#2c1b12"/><path d="M16 27q4-3 8 0" stroke="#2c1b12" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>'
  };
  const PAW = '<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="#fff"><ellipse cx="20" cy="26" rx="8.5" ry="7"/><circle cx="9" cy="17" r="3.8"/><circle cx="16" cy="10" r="4"/><circle cx="24" cy="10" r="4"/><circle cx="31" cy="17" r="3.8"/></g></svg>';

  function fmt(n) { return C.formatMoney(n); }
  function show(pane) {
    ['gmMenu', 'gmMemory', 'gmCatch'].forEach(function (id) { $(id).hidden = id !== pane; });
    $('gmResult').hidden = true;
  }
  function stop() { if (running) { const f = running; running = null; f(); } }

  function totalLeft() {
    const st = getState(), now = Date.now();
    return Object.keys(C.MINI_GAMES).reduce(function (a, g) { return a + C.miniLeft(st, g, now); }, 0);
  }

  /** ひろばの左上のボタンの数字 (きょう あと何回あそべるか) と、メニューの中身 */
  function refresh() {
    const n = totalLeft();
    el.badge.textContent = String(n);
    el.badge.hidden = n === 0;
    if (!el.root.hidden) { $('gmMoney').textContent = fmt(getState().money); if (!$('gmMenu').hidden) renderMenu(); }
  }

  function bestOf(game) { return game === 'memory' ? { turns: 4 } : { score: 40 }; }

  function renderMenu() {
    const st = getState(), now = Date.now();
    const info = {
      memory: { rule: 'おなじ どうぶつを 2 まいずつ さがそう。すくない かいすうで ぜんぶ そろうと コインが おおい', art: '<div class="gm-art mm"><i></i><i></i></div>' },
      catch: { rule: 'おちてくる おやつを ゆびで うごいて キャッチ！ くりに あたると へるよ', art: '<div class="gm-art ct">' + ITEM_SVG.apple + ITEM_SVG.cookie + '</div>' }
    };
    $('gmList').innerHTML = Object.keys(C.MINI_GAMES).map(function (g) {
      const left = C.miniLeft(st, g, now);
      return '<div class="gm-card" data-game="' + g + '">' + info[g].art +
        '<div class="gm-info"><b>' + C.MINI_GAMES[g].name + '</b><span>' + info[g].rule + '</span>' +
        '<em>さいだい <b>' + fmt(C.miniReward(g, bestOf(g))) + '</b> コイン ・ きょうは あと ' + left + ' かい</em></div>' +
        '<button type="button" class="btn btn-open gm-go" data-game="' + g + '"' + (left ? '' : ' disabled') + '><span class="btn-label">' + (left ? 'あそぶ' : 'また あした') + '</span></button></div>';
    }).join('');
  }

  function openMenu() {
    stop();
    el.root.hidden = false;
    show('gmMenu');
    $('gmTitle').textContent = 'ミニゲーム';
    $('gmMoney').textContent = fmt(getState().money);
    renderMenu();
  }
  function closeAll() { stop(); el.root.hidden = true; refresh(); }

  // ---------------------------------------------------------------- 結果
  function finish(game, result, summary) {
    const st = getState();
    const r = C.miniFinish(st, game, result, Date.now());
    onChange();
    refresh();
    stop();
    $('gmMoney').textContent = fmt(st.money);
    const res = $('gmResult');
    res.hidden = false;
    res.dataset.game = game;
    $('gmResSub').textContent = summary;
    $('gmResCoins').textContent = r.ok ? '+' + fmt(r.coins) : '+0';
    $('gmResTaps').textContent = r.ok ? 'パック ' + (r.coins / C.PACK_PRICE).toFixed(r.coins % C.PACK_PRICE ? 1 : 0) + ' こ ぶん！' : '';
    const left = C.miniLeft(st, game, Date.now());
    $('gmAgain').disabled = left <= 0;
    $('gmAgainLabel').textContent = left > 0 ? 'もういちど (あと ' + left + ' かい)' : 'また あした';
    Sfx.play(r.ok && r.coins >= 4000 ? 'fanfareRR' : 'shine');
    if (r.ok) coinRain();
  }

  function coinRain() {
    const box = $('gmResult');
    for (let i = 0; i < 14; i++) {
      const c = document.createElement('i');
      c.className = 'gm-coin';
      box.appendChild(c);
      const x = 30 + Math.random() * 370, d = 700 + Math.random() * 700;
      c.animate([{ transform: 'translate(' + x + 'px,-30px)', opacity: 1 }, { transform: 'translate(' + (x + (Math.random() * 60 - 30)) + 'px,520px)', opacity: 1 }],
        { duration: d, delay: i * 50, easing: 'cubic-bezier(.3,0,.8,.6)', fill: 'backwards' }).onfinish = function () { c.remove(); };
    }
  }

  // ---------------------------------------------------------------- どうぶつ めくり
  function startMemory() {
    stop();
    show('gmMemory');
    $('gmTitle').textContent = C.MINI_GAMES.memory.name;
    const st = getState();
    const deal = C.memoryDeal(st, Math.random);
    const grid = $('mmGrid');
    grid.innerHTML = deal.map(function (ch, i) {
      return '<button type="button" class="mm-card" data-i="' + i + '" data-ch="' + ch + '" aria-label="カード"><span class="mm-in">' +
        '<span class="mm-face mm-back">' + PAW + '</span>' +
        '<span class="mm-face mm-front">' + A.svg(ch, { walk: false }) + '</span></span></button>';
    }).join('');
    let first = -1, locked = false, matched = 0, turns = 0, dead = false;
    const cards = Array.prototype.slice.call(grid.children);
    const label = function () { $('mmTurns').textContent = String(turns); $('mmLeft').textContent = String(deal.length / 2 - matched); };
    label();
    const timers = [];
    const later = function (f, ms) { timers.push(window.setTimeout(function () { if (!dead) f(); }, ms)); };
    running = function () { dead = true; timers.forEach(window.clearTimeout); };
    grid.onclick = function (e) {
      const b = e.target.closest('.mm-card');
      if (!b || locked || b.classList.contains('up')) return;
      const i = Number(b.dataset.i);
      b.classList.add('up');
      Sfx.play('flip');
      if (first < 0) { first = i; return; }
      const a = cards[first], c = b;
      first = -1;
      turns++;
      label();
      if (a.dataset.ch === c.dataset.ch) {
        matched++;
        a.classList.add('ok'); c.classList.add('ok');
        later(function () { Sfx.play('pop'); }, 250);
        label();
        if (matched === deal.length / 2) {
          locked = true;
          later(function () { finish('memory', { turns: turns }, turns + ' かいで ぜんぶ そろったよ！'); }, 900);
        }
      } else {
        locked = true;
        later(function () { a.classList.remove('up'); c.classList.remove('up'); locked = false; }, 700);
      }
    };
  }

  // ---------------------------------------------------------------- おやつキャッチ
  function startCatch() {
    stop();
    show('gmCatch');
    $('gmTitle').textContent = C.MINI_GAMES.catch.name;
    const st = getState();
    const field = $('ctField'), player = $('ctPlayer');
    // 遊ぶ子: もっている子のうち なかよしが いちばんの子 (いなければ さいしょの子)
    const have = Object.keys(C.ownedCharas(st));
    have.sort(function (a, b) { return ((st.pets[b] && st.pets[b].aff) || 0) - ((st.pets[a] && st.pets[a].aff) || 0); });
    const chara = have[0] || Object.keys(C.CHARAS)[0];
    player.innerHTML = A.svg(chara, { walk: false });
    field.querySelectorAll('.ct-item, .ct-pop').forEach(function (n) { n.remove(); });
    const W = field.clientWidth || 430, H = field.clientHeight || 600;
    const PW = 84, FOOT = 18;      // 遊ぶ子の幅・下からの高さ
    const total = opts.catchSeconds || C.MINI_GAMES.catch.seconds;
    let px = W / 2, score = 0, time = total, spawnIn = 0.6, items = [], last = 0, raf = 0, dead = false, ready = 0.9, over = false;
    const rng = Math.random;
    const place = function () { player.style.transform = 'translateX(' + (px - PW / 2).toFixed(1) + 'px)'; };
    place();
    const hud = function () { $('ctScore').textContent = String(score); $('ctTime').textContent = String(Math.max(0, Math.ceil(time))); };
    hud();
    const say = $('ctSay');
    say.hidden = false; say.textContent = 'よーい…';
    field.onpointerdown = function (e) {
      field.setPointerCapture && field.setPointerCapture(e.pointerId);
      px = Math.max(PW / 2, Math.min(W - PW / 2, e.clientX - field.getBoundingClientRect().left));
      place();
    };
    field.onpointermove = function (e) {
      if (!(e.buttons || e.pointerType === 'touch')) return;
      px = Math.max(PW / 2, Math.min(W - PW / 2, e.clientX - field.getBoundingClientRect().left));
      place();
    };
    const spawn = function () {
      const kind = C.catchPick(rng);
      const d = document.createElement('div');
      d.className = 'ct-item k-' + kind;
      d.innerHTML = ITEM_SVG[kind];
      field.appendChild(d);
      const prog = 1 - time / total;
      const it = { el: d, kind: kind, x: 24 + rng() * (W - 48), y: -40, vy: 190 + 130 * prog + rng() * 50 };
      items.push(it);
    };
    const popText = function (x, y, txt, bad) {
      const p = document.createElement('div');
      p.className = 'ct-pop' + (bad ? ' bad' : '');
      p.textContent = txt;
      field.appendChild(p);
      p.animate([{ transform: 'translate(' + (x - 20) + 'px,' + y + 'px)', opacity: 1 }, { transform: 'translate(' + (x - 20) + 'px,' + (y - 60) + 'px)', opacity: 0 }],
        { duration: 650, easing: 'ease-out' }).onfinish = function () { p.remove(); };
    };
    const end = function () {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      finish('catch', { score: score }, score + ' てん！');
    };
    const frame = function (now) {
      if (dead) return;
      let dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (!(dt > 0)) dt = 0;          // コマの間隔は 上も下も止める (負や 0 のときは進めない)
      if (dt > 0.05) dt = 0.05;
      if (ready > 0) {
        ready -= dt;
        if (ready <= 0) { say.textContent = 'スタート！'; later(function () { say.hidden = true; }, 600); }
      } else {
        time -= dt;
        spawnIn -= dt;
        if (spawnIn <= 0 && time > 0.8) { spawn(); spawnIn = 0.62 - 0.22 * (1 - time / total) + rng() * 0.18; }
        const top = H - FOOT - 84, bottom = H - FOOT - 18;   // 受け止める高さ (子の頭〜おなか)
        items = items.filter(function (it) {
          it.y += it.vy * dt;
          const cy = it.y + 20;
          if (cy >= top && cy <= bottom + 20 && Math.abs(it.x - px) <= PW / 2 + 6) {
            const pts = C.CATCH_ITEMS[it.kind].points;
            score = Math.max(0, score + pts);
            Sfx.play(pts > 0 ? 'pop' : 'flip');
            popText(it.x, it.y, (pts > 0 ? '+' : '') + pts, pts < 0);
            it.el.remove();
            hud();
            return false;
          }
          if (it.y > H + 10) { it.el.remove(); return false; }
          it.el.style.transform = 'translate(' + (it.x - 20).toFixed(1) + 'px,' + it.y.toFixed(1) + 'px)';
          return true;
        });
        hud();
        if (time <= 0) { end(); return; }
      }
      raf = requestAnimationFrame(frame);
    };
    const timers = [];
    const later = function (f, ms) { timers.push(window.setTimeout(function () { if (!dead) f(); }, ms)); };
    raf = requestAnimationFrame(frame);
    running = function () {
      dead = true; cancelAnimationFrame(raf); timers.forEach(window.clearTimeout);
      field.onpointerdown = field.onpointermove = null;
      field.querySelectorAll('.ct-item, .ct-pop').forEach(function (n) { n.remove(); });
      say.hidden = true;
    };
    api.catchState = function () { return { items: items.map(function (i) { return { x: i.x, y: i.y, kind: i.kind }; }), px: px, score: score, time: time, W: W, H: H }; };
    api.moveTo = function (x) { px = Math.max(PW / 2, Math.min(W - PW / 2, x)); place(); };
  }

  // ---------------------------------------------------------------- つなぐ
  const api = {
    opts: opts,
    refresh: refresh,
    isOpen: function () { return !el.root.hidden; },
    open: openMenu,
    close: closeAll,
    init: function (ctx) {
      C = ctx.C; A = ctx.A; Sfx = ctx.Sfx; getState = ctx.getState; onChange = ctx.onChange;
      el = { root: $('games'), badge: $('gmBadge') };
      $('btnGames').addEventListener('click', function () { Sfx.unlock(); Sfx.play('pop'); openMenu(); });
      $('gmClose').addEventListener('click', function () { if ($('gmMenu').hidden) openMenu(); else closeAll(); });
      $('gmList').addEventListener('click', function (e) {
        const b = e.target.closest('.gm-go');
        if (!b || b.disabled) return;
        Sfx.unlock();
        if (b.dataset.game === 'memory') startMemory(); else startCatch();
      });
      $('gmAgain').addEventListener('click', function () {
        if ($('gmAgain').disabled) return;
        if ($('gmResult').dataset.game === 'memory') startMemory(); else startCatch();
      });
      $('gmBack').addEventListener('click', openMenu);
      refresh();
    }
  };
  window.MiniGames = api;
})();
