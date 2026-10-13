/*!
 * opening.js — パックを開ける演出 (いちばん大事なところ)。
 *
 * 流れ
 *   1. パックが落ちてくる。当たりのときは、たまに「予兆」(揺れる・虹にひかる・金の粉)
 *   2. 上の線を指でなぞって、やぶる。切り口から光がもれる (白 / 青 / 金)
 *   3. カードの束が出てくる。スワイプ (かタップ) で 1 まいずつ めくる。レア枠は最後
 *   4. RR・AR は裏向きで出る → タップで めくる
 *      SR 以上は裏向きで出る → 長押しで力をためると、光の色が 青 → 金 → 虹 と上がっていく
 *      MUR は 虹のあと 画面がまっ暗になり、心臓の音 → 金のひび → 金色の世界
 *   5. 出たカードは指でかたむけるとキラが動く。最後に 5 まいをならべて見せる
 *
 * 光の色は core.js の makeShow が決める。本当のレア度より上には絶対に上がらない。
 */
(function (root) {
  'use strict';

  const C = root.Core;
  const V = root.CardView;
  const Fx = root.Fx;
  const S = Fx.Sfx;

  const $ = function (id) { return document.getElementById(id); };
  let els = null;
  let fx = null;
  let run = null;

  const CHARGE_TIME = { SR: 2.4, SAR: 3.4, MUR: 4.6, LR: 4.6 };     // 押しっぱなしで満タンになるまでの秒数
  const STAGE_TALK = ['…！？', 'きた！？', 'まだ あがる…！', 'えっ…！？'];
  const RAY = { blue: 'blue', gold: 'gold', rainbow: 'rainbow', mega: 'gold', legend: 'legend' };

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function alive(r) { return run === r; }

  function hint(text) {
    els.hint.textContent = text || '';
    els.hint.hidden = !text;
  }

  function setBg(name) { els.open.dataset.bg = name; }

  function rays(color) {
    els.rays.className = 'op-rays' + (color ? ' on ray-' + color : '');
  }

  function center(el) {
    const b = el.getBoundingClientRect();
    const o = els.open.getBoundingClientRect();
    return { x: b.left - o.left + b.width / 2, y: b.top - o.top + b.height / 2, w: b.width, h: b.height };
  }

  function flash(color, peak, ms) {
    els.flash.style.background = color;
    return els.flash.animate([{ opacity: 0 }, { opacity: peak, offset: 0.25 }, { opacity: 0 }],
      { duration: ms || 600, easing: 'ease-out' });
  }

  function shakeScreen(power, ms) {
    const k = [];
    for (let i = 0; i <= 10; i++) {
      const a = power * (1 - i / 10);
      k.push({ transform: 'translate(' + ((Math.random() * 2 - 1) * a).toFixed(1) + 'px,' + ((Math.random() * 2 - 1) * a).toFixed(1) + 'px)' });
    }
    k[k.length - 1] = { transform: 'none' };
    els.stage.animate(k, { duration: ms || 450 });
  }

  function shock(color, count) {
    const c = center(els.stack);
    for (let i = 0; i < count; i++) {
      const s = document.createElement('i');
      s.className = 'op-shock';
      s.style.left = c.x + 'px';
      s.style.top = c.y + 'px';
      s.style.borderColor = color;
      els.open.appendChild(s);
      s.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(4.2)', opacity: 0 }],
        { duration: 900, delay: i * 160, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }).onfinish = function () { s.remove(); };
    }
  }

  // ================================================================ バナー
  const BANNER_COLOR = { RR: '#7ab8ff', AR: '#ff9cc8', SR: '#ffcf40', SAR: '#c39bff', MUR: '#ffcf40', LR: '#c39bff' };

  function banner(rarity) {
    const label = C.RARITIES[rarity].label;
    const bang = { RR: '！', AR: '！', SR: '！！', SAR: '！！！', MUR: '！！！！', LR: '！！！！！' }[rarity] || '！';
    const code = rarity.split('').map(function (ch, i) { return '<span style="--i:' + i + '">' + ch + '</span>'; }).join('');
    els.banner.innerHTML = '<div class="bn bn-' + rarity + '"><div class="bn-code">' + code + '</div>' +
      '<div class="bn-name">' + label + bang + '</div></div>';
    els.banner.hidden = false;
    const bn = els.banner.firstChild;
    bn.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 520, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    bn.querySelectorAll('.bn-code span').forEach(function (s, i) {
      s.animate([{ transform: 'translateY(-40px) scale(1.6)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, delay: 120 + i * 90, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' });
    });
  }

  function hideBanner() {
    if (els.banner.hidden) return;
    const bn = els.banner.firstChild;
    if (!bn) { els.banner.hidden = true; return; }
    bn.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.9)' }], { duration: 200, fill: 'forwards' })
      .onfinish = function () {
        if (els.banner.firstChild !== bn) return;   // そのあいだに次のバナーが出ていたら消さない
        els.banner.hidden = true;
        els.banner.innerHTML = '';
      };
  }

  // ================================================================ 1. パック
  function start(opts) {
    if (!els) init();
    stopAll();
    const r = {
      cards: opts.cards, show: opts.show, opts: opts,
      phase: 'pack', index: 0, slots: [], special: {}, revealed: {}, tilts: [], charge: null, timers: [], tear: null
    };
    opts.show.specials.forEach(function (sp) { r.special[sp.index] = sp; });
    run = r;

    // 前の開封の名残 (fill: forwards で残った透明・位置) を片づける。
    // 片づけないと、前のパックの「沈んで消える」が終わった拍子に、新しいパックが隠れる
    [els.pack, els.stack, els.black, els.crack, els.flash, els.stage].forEach(function (el) {
      el.getAnimations().forEach(function (a) { a.cancel(); });
    });
    els.open.querySelectorAll('.op-shock, .op-beam, .op-heart, .op-shards, .op-arc').forEach(function (el) { el.remove(); });

    els.open.hidden = false;
    els.result.hidden = true;
    els.zoom.hidden = true;
    els.stack.innerHTML = '';
    els.stack.hidden = true;
    els.ring.hidden = true;
    els.banner.hidden = true;
    els.black.style.opacity = 0;
    els.crack.style.opacity = 0;
    setBg('day');
    rays(null);
    fx.resize();
    fx.clear();
    els.count.textContent = '';
    els.skip.hidden = false;

    els.bulk.hidden = true;
    els.result.classList.toggle('bulk', !!opts.bulk);
    if (opts.bulk) { els.pack.hidden = true; bulkIntro(r); return; }

    els.pack.innerHTML = V.packHTML(r.opts.set);
    els.pack.className = 'op-pack';
    els.pack.hidden = false;
    const leak = { white: ['#ffffff', 'rgba(255,255,255,.7)'], blue: ['#bfe6ff', 'rgba(110,180,255,.75)'], gold: ['#fff2a8', 'rgba(255,190,40,.85)'] }[r.show.tearLight];
    els.pack.style.setProperty('--leak', leak[0]);
    els.pack.style.setProperty('--leak-glow', leak[1]);
    hint('');

    els.pack.animate(
      [{ transform: 'translateY(-760px) rotate(-10deg)' }, { transform: 'translateY(26px) rotate(3deg)', offset: 0.72 },
        { transform: 'translateY(-6px) rotate(-1deg)', offset: 0.88 }, { transform: 'none' }],
      { duration: 720, easing: 'cubic-bezier(.4,0,.6,1)' }
    ).onfinish = function () { if (alive(r)) omen(r); };
  }

  function omen(r) {
    hint('うえの せんを よこに なぞって あけよう！');
    const o = r.show.omen;
    if (o === 'none') return;
    const c = center(els.pack);
    if (o === 'rainbow') els.pack.classList.add('aura-rainbow');
    if (o === 'gold') els.pack.classList.add('aura-gold');
    if (o === 'cosmos') els.pack.classList.add('aura-cosmos');
    S.play('omen');
    els.pack.animate(
      [{ transform: 'none' }, { transform: 'rotate(-4deg) translateX(-6px)' }, { transform: 'rotate(4deg) translateX(6px)' },
        { transform: 'rotate(-3deg) translateX(-4px)' }, { transform: 'rotate(3deg) translateX(4px)' }, { transform: 'none' }],
      { duration: 620, delay: 120 }
    );
    if (o === 'shake') return;
    if (o === 'cosmos') { shootingStars(r); return; }
    const color = o === 'gold' ? 'gold' : 'rainbow';
    const t = setInterval(function () {
      if (!alive(r) || r.phase !== 'pack') { clearInterval(t); return; }
      const a = Math.random() * Math.PI * 2;
      fx.burst(c.x + Math.cos(a) * c.w * 0.55, c.y + Math.sin(a) * c.h * 0.5,
        { color: color, count: o === 'gold' ? 4 : 3, shape: 'star', speed: 90, size: 9, gravity: o === 'gold' ? 120 : -40, life: 1.1, add: true });
    }, 140);
    r.timers.push(t);
  }

  /** LR の予兆: パックのうしろを 流れ星が ななめに 横切る (LR のときしか出ない) */
  function shootingStars(r) {
    const t = setInterval(function () {
      if (!alive(r) || r.phase !== 'pack') { clearInterval(t); return; }
      const o = els.open.getBoundingClientRect();
      const s = document.createElement('i');
      s.className = 'op-meteor';
      const x = o.width * (0.2 + Math.random() * 0.9);
      s.style.left = x + 'px';
      s.style.top = (Math.random() * o.height * 0.4) + 'px';
      els.open.appendChild(s);
      s.animate([{ transform: 'rotate(-35deg) translateX(0)', opacity: 0 }, { opacity: 1, offset: 0.2 },
        { transform: 'rotate(-35deg) translateX(-' + (o.width * 0.9).toFixed(0) + 'px)', opacity: 0 }],
      { duration: 900, easing: 'ease-in' }).onfinish = function () { s.remove(); };
      const c = center(els.pack);
      fx.burst(c.x + (Math.random() * 2 - 1) * c.w * 0.5, c.y + (Math.random() * 2 - 1) * c.h * 0.45,
        { color: 'legend', count: 3, shape: 'star', speed: 70, size: 8, gravity: -30, life: 1.1, add: true });
    }, 260);
    r.timers.push(t);
  }

  // ---------------------------------------------------------------- まとめて開ける
  /**
   * BOX の残りをまとめて開けたとき: パックが次々にやぶれる様子を数秒で見せてから、
   * レア (RR 以上と AR) だけを裏向きの束にして、1 まいずつ ふだんと同じ演出でめくる。弱い順なので、いちばん良いのが最後
   */
  async function bulkIntro(r) {
    r.phase = 'bulk';
    els.skip.hidden = true;
    els.bulk.hidden = false;
    els.bulkPack.innerHTML = V.packHTML(r.opts.set);
    hint('');
    const n = r.opts.bulk.packs;
    const dur = Math.min(2400, 500 + n * 65);
    const t0 = performance.now();
    let shown = 0;
    await new Promise(function (res) {
      function step(now) {
        if (!alive(r)) { res(); return; }
        const k = Math.min(n, Math.floor(((now - t0) / dur) * n) + 1);
        while (shown < k) {
          shown++;
          els.bulkCount.textContent = shown + ' / ' + n + ' パック';
          S.play('tear');
          els.bulkPack.animate([{ transform: 'none' }, { transform: 'scale(1.08) rotate(-3deg)' }, { transform: 'none' }], { duration: 140 });
          const c = center(els.bulkPack);
          fx.burst(c.x, c.y - c.h * 0.38, { color: 'white', count: 4, speed: 280, size: 7, life: 0.7, gravity: 420 });
        }
        if (shown < n) requestAnimationFrame(step); else res();
      }
      requestAnimationFrame(step);
    });
    if (!alive(r)) return;
    S.play('rip');
    await wait(420);
    if (!alive(r)) return;
    els.bulk.hidden = true;
    if (!r.cards.length) { showResult(r); return; }
    buildStack(r);
    els.stack.animate([{ transform: 'translateY(170px) scale(.86)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 560, easing: 'cubic-bezier(.3,1.2,.5,1)' });
    await wait(520);
    if (!alive(r)) return;
    r.phase = 'stack';
    onTop(r);
  }

  // ---------------------------------------------------------------- やぶる
  function tearStart(e) {
    const r = run;
    if (!r || r.phase !== 'pack') return;
    S.unlock();
    const pk = els.pack.querySelector('.pk');
    const b = pk.getBoundingClientRect();
    try { els.pack.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    r.tear = { x0: e.clientX, min: e.clientX, max: e.clientX, left: b.left, width: b.width, t0: performance.now(), lastSnd: 0, moved: 0 };
    pk.classList.add('tearing');
  }

  function tearMove(e) {
    const r = run;
    if (!r || r.phase !== 'pack' || !r.tear) return;
    const t = r.tear;
    t.moved = Math.max(t.moved, Math.abs(e.clientX - t.x0));
    t.min = Math.min(t.min, e.clientX);
    t.max = Math.max(t.max, e.clientX);
    const p = (t.max - t.min) / t.width;
    setLeak((t.min - t.left) / t.width, p);
    const now = performance.now();
    if (now - t.lastSnd > 55 && t.moved > 6) {
      t.lastSnd = now;
      S.play('tear');
      const o = els.open.getBoundingClientRect();
      const lineY = els.pack.querySelector('.pk-leak').getBoundingClientRect().top - o.top;
      fx.burst(e.clientX - o.left, lineY, { color: r.show.tearLight, count: 2, speed: 160, size: 6, life: 0.6, gravity: 300 });
    }
    if (p >= 0.7) tearDone(r);
  }

  function tearEnd() {
    const r = run;
    if (!r || r.phase !== 'pack' || !r.tear) return;
    const t = r.tear;
    r.tear = null;
    // ちょんと押しただけ (なぞれない子) でも開くようにする
    if (t.moved < 12 && performance.now() - t.t0 < 600) autoTear(r);
  }

  function setLeak(from, p) {
    const leak = els.pack.querySelector('.pk-leak');
    leak.style.left = (Math.max(0, Math.min(1, from)) * 100).toFixed(1) + '%';
    leak.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%';
  }

  function autoTear(r) {
    if (r.phase !== 'pack') return;
    r.phase = 'tearing';
    els.pack.querySelector('.pk').classList.add('tearing');
    const t0 = performance.now();
    let lastSnd = 0;
    function step(now) {
      if (!alive(r)) return;
      const p = Math.min(1, (now - t0) / 420);
      setLeak(0, p);
      if (now - lastSnd > 60) { lastSnd = now; S.play('tear'); }
      if (p < 1) requestAnimationFrame(step);
      else { r.phase = 'pack'; tearDone(r); }
    }
    requestAnimationFrame(step);
  }

  async function tearDone(r) {
    if (r.phase !== 'pack') return;
    r.phase = 'opening';
    r.tear = null;
    hint('');
    els.skip.hidden = true;
    const pk = els.pack.querySelector('.pk');
    pk.classList.add('torn');
    setLeak(0, 1);
    S.play('rip');
    pk.querySelector('.pk-top').animate(
      [{ transform: 'none', opacity: 1 }, { transform: 'translate(130px,-340px) rotate(40deg)', opacity: 0 }],
      { duration: 650, easing: 'cubic-bezier(.3,0,.8,.6)', fill: 'forwards' }
    );
    // 切り口から光が上へのびる
    const o = els.open.getBoundingClientRect();
    const line = pk.querySelector('.pk-leak').getBoundingClientRect();
    const beam = document.createElement('i');
    beam.className = 'op-beam beam-' + r.show.tearLight;
    const bw = line.width / 0.58;                       // 下のまん中 58% が 切り口。上へ ひろがる
    beam.style.left = (line.left - o.left - (bw - line.width) / 2) + 'px';
    beam.style.width = bw + 'px';
    beam.style.height = (line.top - o.top + 4) + 'px';
    const streaks = { white: 5, blue: 7, gold: 9 }[r.show.tearLight];
    for (let k = 0; k < streaks; k++) {
      const b = document.createElement('b');
      const f = (k + 0.5) / streaks;                    // 0〜1 (左〜右)
      b.style.left = (21 + f * 58) + '%';
      b.style.transform = 'rotate(' + ((f - 0.5) * 34).toFixed(1) + 'deg)';
      b.style.opacity = (0.45 + Math.random() * 0.5).toFixed(2);
      beam.appendChild(b);
    }
    els.open.appendChild(beam);
    beam.animate([{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.25 }, { transform: 'scaleY(1.04)', opacity: 0 }],
      { duration: r.show.tearLight === 'white' ? 1000 : 1300, easing: 'ease-out' }).onfinish = function () { beam.remove(); };
    const cx = line.left - o.left + line.width / 2;
    fx.burst(cx, line.top - o.top, {
      color: r.show.tearLight, count: r.show.tearLight === 'white' ? 26 : 50, shape: 'star',
      speed: r.show.tearLight === 'gold' ? 620 : 460, size: 10, lift: 200, gravity: 380, life: 1.3, add: r.show.tearLight !== 'white'
    });
    if (r.show.tearLight !== 'white') S.play('shine', 0.1);
    if (r.show.tearLight === 'gold') flash('rgba(255,220,120,.9)', 0.55, 700);

    await wait(520);
    if (!alive(r)) return;
    els.pack.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(420px)', opacity: 0 }],
      { duration: 520, easing: 'ease-in', fill: 'forwards' }).onfinish = function () { if (alive(r)) els.pack.hidden = true; };
    buildStack(r);
    els.stack.animate([{ transform: 'translateY(170px) scale(.86)', opacity: 0 }, { transform: 'translateY(-14px) scale(1.02)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }],
      { duration: 620, easing: 'cubic-bezier(.3,1.2,.5,1)' });
    await wait(500);
    if (!alive(r)) return;
    r.phase = 'stack';
    onTop(r);
  }

  // ================================================================ 2. カードの束
  function buildStack(r) {
    els.stack.hidden = false;
    els.stack.innerHTML = r.cards.map(function (c, i) {
      const card = C.cardByNo(c.no);
      const sp = r.special[i];
      return '<div class="slot" data-i="' + i + '" style="z-index:' + (20 - i) + '">' +
        '<div class="shake">' + (sp ? '<i class="aura"></i>' : '') +
        '<div class="c3"><div class="c3-in' + (sp ? '' : ' up') + '">' +
        '<div class="face front">' + V.html(card) + '</div>' +
        '<div class="face back">' + V.backHTML() + '</div></div></div>' +
        '<span class="op-new" hidden>NEW!</span></div></div>';
    }).join('');
    r.slots = Array.prototype.slice.call(els.stack.children);
    layoutStack(r, false);
  }

  /** めくっていないカードを、少しずつずらして重ねる */
  function layoutStack(r, animate) {
    r.slots.forEach(function (s, i) {
      if (i < r.index) return;
      const d = i - r.index;
      const tf = d === 0 ? 'none' : 'translateY(' + (d * 7) + 'px) scale(' + (1 - d * 0.035) + ')';
      if (animate && d === 0) {
        s.animate([{ transform: s.style.transform || 'none' }, { transform: 'scale(1.04)', offset: 0.6 }, { transform: 'none' }],
          { duration: 260, easing: 'ease-out' });
      }
      s.style.transform = tf;
    });
  }

  function onTop(r) {
    const i = r.index;
    els.count.textContent = (r.opts.bulk ? 'レア ' : '') + (i + 1) + ' / ' + r.cards.length;
    const slot = r.slots[i];
    const sp = r.special[i];
    const c = r.cards[i];
    if (sp && !r.revealed[i]) {
      els.skip.hidden = true;
      if (sp.mode === 'tap') {
        slot.classList.add('waiting', 'aura-blue');
        hint('タップして めくろう！');
        S.play('shine');
      } else {
        enterCharge(r, i, sp);
      }
      return;
    }
    els.skip.hidden = false;
    if (c.isNew) slot.querySelector('.op-new').hidden = false;
    const card = C.cardByNo(c.no);
    if (card.rarity === 'R') {
      // R はめくった瞬間にキラッ
      S.play('shine');
      const p = center(slot);
      fx.burst(p.x, p.y - p.h * 0.18, { color: 'white', count: 22, shape: 'star', speed: 280, size: 10, gravity: 0, life: 1, add: false });
      [[-0.45, -0.45], [0.45, 0.42]].forEach(function (q) {   // かどにも キラッ
        fx.burst(p.x + p.w * q[0], p.y + p.h * q[1], { color: 'white', count: 6, shape: 'star', speed: 120, size: 8, gravity: 0, life: 0.8, add: true });
      });
      slot.querySelector('.shake').animate([{ transform: 'none' }, { transform: 'scale(1.045)', offset: 0.35 }, { transform: 'none' }], { duration: 420, easing: 'ease-out' });
      slot.querySelector('.pc').classList.add('glint');
    }
    hint(i === 0 ? 'スワイプ か タップで つぎの カードへ' : '');
  }

  // ---------------------------------------------------------------- スワイプ
  let drag = null;

  function stackDown(e) {
    const r = run;
    if (!r || r.phase !== 'stack') return;
    const slot = r.slots[r.index];
    if (!slot || !slot.contains(e.target)) return;
    S.unlock();
    const sp = r.special[r.index];
    if (sp && !r.revealed[r.index] && sp.mode === 'hold') {
      r.charge.holding = true;
      if (!r.charge.snd) r.charge.snd = S.charge();
      try { els.stack.setPointerCapture(e.pointerId); } catch (err) { /* */ }
      return;
    }
    try { els.stack.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    drag = { r: r, slot: slot, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, t0: performance.now(), on: false };
  }

  function stackMove(e) {
    if (!drag || drag.r !== run) return;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    if (!drag.on && Math.abs(drag.dx) > 14) drag.on = true;
    if (drag.on) {
      drag.slot.style.transform = 'translate(' + drag.dx + 'px,' + (drag.dy * 0.25) + 'px) rotate(' + (drag.dx * 0.05) + 'deg)';
    }
  }

  function stackUp() {
    const r = run;
    if (r && r.charge && r.charge.holding) {
      r.charge.holding = false;
      if (r.charge.snd) { r.charge.snd.stop(); r.charge.snd = null; }
      return;
    }
    if (!drag || drag.r !== r) { drag = null; return; }
    const d = drag;
    drag = null;
    const quick = performance.now() - d.t0 < 300;
    const i = r.index;
    const sp = r.special[i];
    if (sp && !r.revealed[i]) {
      if (!d.on) tapReveal(r, i, sp);   // tap モードの特別なカード
      else springBack(d.slot);
      return;
    }
    if (!d.on && Math.abs(d.dx) < 10) { fling(r, -1); return; }
    if (Math.abs(d.dx) > 90 || (quick && Math.abs(d.dx) > 40)) fling(r, d.dx < 0 ? -1 : 1);
    else springBack(d.slot);
  }

  function springBack(slot) {
    slot.animate([{ transform: slot.style.transform }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    slot.style.transform = 'none';
  }

  function fling(r, dir) {
    if (r.phase !== 'stack') return;
    const i = r.index;
    const slot = r.slots[i];
    S.play('whoosh');
    if (r.revealed[i]) { hideBanner(); rays(null); removeArc(); }
    const from = slot.style.transform || 'none';
    slot.style.transform = 'translate(' + (dir * 560) + 'px,-80px) rotate(' + (dir * 28) + 'deg)';
    slot.animate([{ transform: from, opacity: 1 }, { transform: slot.style.transform, opacity: 0.2 }],
      { duration: 330, easing: 'cubic-bezier(.4,0,.8,.6)' }).onfinish = function () { slot.style.visibility = 'hidden'; };
    (r.tilts[i] || { stop: function () {} }).stop();
    r.index++;
    if (r.revealed[i] && els.open.dataset.bg !== 'day') setBg('day');
    if (r.index >= r.cards.length) { showResult(r); return; }
    layoutStack(r, true);
    onTop(r);
  }

  // ================================================================ 3. タップでめくる (RR / AR)
  async function tapReveal(r, i, sp) {
    if (r.phase !== 'stack') return;
    r.phase = 'reveal';
    hint('');
    const slot = r.slots[i];
    const shake = slot.querySelector('.shake');
    S.play('flip');
    shake.animate([{ transform: 'none' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(5deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'scale(1.06)' }],
      { duration: 380 });
    slot.classList.remove('aura-white');
    slot.classList.add('aura-blue');
    await wait(360);
    if (!alive(r)) return;
    const isAR = sp.rarity === 'AR';
    flash(isAR ? '#ffe3f1' : '#e3f2ff', 0.7, 500);
    await flip(slot, 460, 1);
    if (!alive(r)) return;
    slot.classList.remove('waiting', 'aura-blue');
    const p = center(slot);
    if (isAR) {
      setBg('pastel');
      rays('pastel');
      fx.burst(p.x, p.y, { color: 'pastel', count: 46, shape: 'petal', speed: 420, size: 11, gravity: 90, life: 2.2 });
      fx.burst(p.x, p.y, { color: 'pastel', count: 14, shape: 'bubble', speed: 200, size: 12, gravity: -70, life: 2.4 });
      fx.rain({ shape: 'petal', color: 'pastel', rate: 16, dur: 3.5, size: 11, speed: 110, gravity: 20, life: 6 });
      S.play('fanfareAR');
    } else {
      rays('blue');
      fx.burst(p.x, p.y, { color: 'blue', count: 54, shape: 'star', speed: 520, size: 11, gravity: 120, life: 1.4, add: false });
      shock('#9fd8ff', 1);
      S.play('fanfareRR');
    }
    banner(sp.rarity);
    revealed(r, i);
  }

  function flip(slot, ms, turns) {
    const inner = slot.querySelector('.c3-in');
    const end = 180 + 360 * (turns - 1);
    return new Promise(function (res) {
      inner.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(' + end + 'deg)' }],
        { duration: ms, easing: turns > 1 ? 'cubic-bezier(.15,.6,.3,1)' : 'cubic-bezier(.4,1.4,.6,1)' })
        .onfinish = function () { inner.classList.add('up'); res(); };
      S.play('flip', ms / 2000);
    });
  }

  /** めくり終わったカード: NEW を出し、指でかたむけられるようにする */
  function revealed(r, i) {
    r.revealed[i] = true;
    const slot = r.slots[i];
    if (r.cards[i].isNew) {
      const nb = slot.querySelector('.op-new');
      nb.hidden = false;
      nb.animate([{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'scale(1.3) rotate(8deg)', offset: 0.7 }, { transform: 'none' }],
        { duration: 420, delay: 300, fill: 'backwards' });
    }
    r.tilts[i] = V.tilt(slot.querySelector('.c3'), { idle: true, max: 14 });
    r.phase = 'stack';
    els.skip.hidden = false;
    setTimeout(function () {
      if (alive(r) && r.index === i) hint('さわると キラキラ ✨ タップで つぎへ');
    }, 1300);
  }

  // ================================================================ 4. 長押しでためる (SR / SAR / MUR)
  function enterCharge(r, i, sp) {
    r.phase = 'stack';    // 押しはじめを受け取れるように
    const slot = r.slots[i];
    slot.classList.add('waiting', 'charging', 'aura-white');
    setBg('night');
    els.ring.hidden = false;
    els.ring.className = 'op-ring ring-white';
    els.ring.style.setProperty('--p', 0);
    hint('ながおし して ちからを ためよう！');
    S.play('omen');
    const n = sp.stages.length;
    r.charge = {
      sp: sp, i: i, p: 0, stage: -1, holding: false, snd: null, done: false, acc: 0,
      th: sp.stages.map(function (_, k) { return 0.12 + k * (0.88 / n); }),
      T: CHARGE_TIME[sp.rarity] || 2.4, last: performance.now()
    };
    requestAnimationFrame(function loop(now) {
      if (!alive(r) || !r.charge || r.charge.done) return;
      chargeTick(r, now);
      requestAnimationFrame(loop);
    });
  }

  function chargeTick(r, now) {
    const ch = r.charge;
    let dt = (now - ch.last) / 1000;
    ch.last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.05) dt = 0.05;
    const floor = ch.stage >= 0 ? ch.th[ch.stage] : 0;   // 上がった色は下がらない
    if (ch.holding) ch.p = Math.min(1, ch.p + dt / ch.T);
    else ch.p = Math.max(floor, ch.p - dt / (ch.T * 1.5));
    if (ch.snd) ch.snd.set(ch.p);

    const slot = r.slots[ch.i];
    const shake = slot.querySelector('.shake');
    const a = (1.5 + ch.p * 9) * (ch.holding ? 1 : 0.35);
    shake.style.transform = 'translate(' + ((Math.random() * 2 - 1) * a).toFixed(1) + 'px,' + ((Math.random() * 2 - 1) * a).toFixed(1) + 'px) rotate(' + ((Math.random() * 2 - 1) * a * 0.15).toFixed(2) + 'deg)';
    slot.style.setProperty('--charge', ch.p.toFixed(3));
    els.ring.style.setProperty('--p', ch.p.toFixed(3));

    if (ch.holding) {
      ch.acc += dt;
      const every = 0.11 - ch.p * 0.08;
      const color = ch.stage >= 0 ? ch.sp.stages[ch.stage] : 'white';
      const c = center(els.stack);
      while (ch.acc > every) {
        ch.acc -= every;
        fx.inward(c.x, c.y, { color: color === 'mega' ? 'gold' : color, count: 2, r0: 170, r1: 280, size: 4 + ch.p * 3 });
      }
    }

    while (ch.stage + 1 < ch.th.length && ch.p >= ch.th[ch.stage + 1]) {
      ch.stage++;
      onStage(r, ch.sp.stages[ch.stage], ch.stage);
      if (ch.done) return;
    }
    if (ch.p >= 1) chargeReveal(r);
  }

  function onStage(r, color, k) {
    const ch = r.charge;
    const slot = r.slots[ch.i];
    if (color === 'mega') { megaSequence(r); return; }
    slot.classList.remove('aura-white', 'aura-blue', 'aura-gold', 'aura-rainbow');
    slot.classList.add('aura-' + color);
    els.ring.className = 'op-ring ring-' + color;
    const flashCol = { blue: '#bfe6ff', gold: '#ffe58a', rainbow: '#ffffff' }[color];
    flash(flashCol, 0.35 + k * 0.1, 420);
    S.play('stage' + Math.min(k + 1, 3));
    const c = center(els.stack);
    fx.burst(c.x, c.y, { color: color, count: 22 + k * 16, shape: 'star', speed: 380 + k * 130, size: 10 + k * 2, gravity: 0, life: 1, add: true });
    shakeScreen(4 + k * 4, 320);
    if (color === 'gold') rays('gold-faint');
    if (color === 'rainbow') rays('rainbow-faint');
    hint(STAGE_TALK[Math.min(k, STAGE_TALK.length - 1)] + '  もっと ながおし！');
  }

  /** その場で 枝わかれした ひびを 描く。(cx, cy) から 左右へ 走り、とちゅうで 上下へ 枝が のびる */
  function drawCrack(cx, cy, color) {
    const o = els.open.getBoundingClientRect();
    const W = o.width, H = o.height;
    els.crack.setAttribute('viewBox', '0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0));
    els.crack.style.setProperty('--ck', color);
    const lines = [];
    [-1, 1].forEach(function (dir) {
      let x = cx, y = cy;
      const pts = [[x, y]];
      while (x > -20 && x < W + 20) {
        x += dir * (26 + Math.random() * 34);
        y = cy + (Math.random() * 2 - 1) * 26;
        pts.push([x, y]);
        if (Math.random() < 0.55) {                    // 枝
          let bx = x, by = y;
          const up = Math.random() < 0.5 ? -1 : 1;
          const br = [[bx, by]];
          for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) {
            bx += dir * (8 + Math.random() * 22);
            by += up * (22 + Math.random() * 30);
            br.push([bx, by]);
          }
          lines.push({ pts: br, delay: 0.35 + Math.abs(x - cx) / W * 0.4, w: 0.7 });
        }
      }
      lines.push({ pts: pts, delay: 0, w: 1 });
    });
    els.crack.innerHTML = lines.map(function (l) {
      const d = 'M' + l.pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
      return '<path class="ck-glow" pathLength="1" d="' + d + '" style="stroke-width:' + (12 * l.w).toFixed(1) + 'px" data-delay="' + l.delay + '"/>' +
        '<path class="ck-core" pathLength="1" d="' + d + '" style="stroke-width:' + (3.2 * l.w).toFixed(1) + 'px" data-delay="' + l.delay + '"/>';
    }).join('');
    els.crack.getAnimations().forEach(function (a) { a.cancel(); });
    els.crack.style.opacity = 1;
    els.crack.querySelectorAll('path').forEach(function (p) {
      p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        { duration: 360, delay: Number(p.dataset.delay) * 1000, easing: 'ease-out', fill: 'both' });
    });
  }

  /** ひびから 光が もれる (太い光の線が ふくらむ) */
  function crackGlow(ms) {
    els.crack.querySelectorAll('.ck-glow').forEach(function (p) {
      p.animate([{ opacity: 0.45 }, { opacity: 0.95 }], { duration: ms, easing: 'ease-in', fill: 'forwards' });
    });
  }

  /**
   * 画面を おおっている物 (暗やみ・金の世界) が われて とびちる。(cx, cy) を中心に 三角の かけらに分け、外へ とばす。
   * かけらは キャンバス (倍率 1) に 描く。DOM の かけら 16 まい (clip-path) だと、遅い端末で われた瞬間に
   * 1 コマ 83〜133ms まで つまった (キャンバスなら 33ms で、かけらが無いときと 同じ)
   */
  function shatter(cx, cy, paint, n) {
    const o = els.open.getBoundingClientRect();
    const W = Math.round(o.width), H = Math.round(o.height);
    const cv = document.createElement('canvas');
    cv.className = 'op-shards';
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    let fill = paint;
    if (paint === 'gold') {   // 金の世界 (.b-gold と同じ色)
      fill = g.createRadialGradient(W * 0.5, H * 0.44, 0, W * 0.5, H * 0.44, Math.hypot(W, H) * 0.62);
      [[0, '#fffbe0'], [0.45, '#ffd65c'], [0.85, '#d99a12'], [1, '#9c6200']].forEach(function (st) { fill.addColorStop(st[0], st[1]); });
    }
    const R = Math.hypot(W, H) * 1.2;
    const angs = [];
    for (let k = 0; k < n; k++) angs.push((k + 0.2 + Math.random() * 0.6) / n * Math.PI * 2);
    const pieces = angs.map(function (a0, k) {
      const a1 = angs[(k + 1) % n] + (k === n - 1 ? Math.PI * 2 : 0);
      return {
        pts: [a0, (a0 + a1) / 2, a1].map(function (a) { return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; }),
        am: (a0 + a1) / 2, d: 160 + Math.random() * 220, rot: (Math.random() * 2 - 1) * 0.5, dur: 480 + Math.random() * 180
      };
    });
    els.open.appendChild(cv);
    const t0 = performance.now();
    (function loop(now) {
      if (!cv.isConnected) return;
      g.clearRect(0, 0, W, H);
      let live = 0;
      pieces.forEach(function (pc) {
        const t = Math.min(1, (now - t0) / pc.dur);
        if (t >= 1) return;
        live++;
        const e = t * t * (1.6 - 0.6 * t);    // はじめ ゆっくり → 速く (外へ ふきとぶ)
        g.save();
        g.globalAlpha = 1 - t;
        g.translate(cx + Math.cos(pc.am) * pc.d * e, cy + Math.sin(pc.am) * pc.d * e);
        g.rotate(pc.rot * e);
        g.scale(1 - 0.08 * e, 1 - 0.08 * e);
        g.translate(-cx, -cy);
        g.beginPath();
        g.moveTo(cx, cy);
        pc.pts.forEach(function (p) { g.lineTo(p[0], p[1]); });
        g.closePath();
        g.fillStyle = fill;
        g.fill();
        g.restore();
      });
      if (live) requestAnimationFrame(loop); else cv.remove();
    })(t0);
  }

  /** LR: カードの うしろに 大きな 虹が 左から右へ かかり、ゆっくり 息をする */
  function rainbowArc(slot) {
    const c = center(slot);
    const arc = document.createElement('i');
    arc.className = 'op-arc';
    arc.style.left = c.x + 'px';
    arc.style.top = (c.y + 40) + 'px';
    els.open.insertBefore(arc, els.stage);
    arc.animate([{ clipPath: 'inset(0 100% 50% 0)', opacity: 1 }, { clipPath: 'inset(0 0 50% 0)', opacity: 1 }],
      { duration: 900, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'forwards' });
    arc.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }],
      { duration: 2600, delay: 900, iterations: Infinity, easing: 'ease-in-out' });
  }

  function removeArc() {
    els.open.querySelectorAll('.op-arc').forEach(function (a) {
      a.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).onfinish = function () { a.remove(); };
    });
  }

  /** 暗やみを はらう。getAnimations() に たよらず、作った アニメーションを 自分で止める
   * (getAnimations() で止めたつもりが、10 回に 1 回ほど 暗いまま のこった) */
  function clearBlack(r) {
    if (r && r.blackAnim) { r.blackAnim.cancel(); r.blackAnim = null; }
    els.black.getAnimations().forEach(function (a) { a.cancel(); });
    els.black.style.opacity = 0;
  }

  /** 背景を いっきに 切りかえる (かけらの すきまから 新しい世界が 見えるように) */
  function cutBg(name) {
    els.open.classList.add('bg-cut');
    setBg(name);
    requestAnimationFrame(function () { requestAnimationFrame(function () { els.open.classList.remove('bg-cut'); }); });
  }

  /** 心臓の音 (どっくん どっくん) に あわせて、カードの うしろが 金に ひかり、カードが ふくらむ */
  function heartGlow(slot) {
    const c = center(els.stack);
    const h = document.createElement('i');
    h.className = 'op-heart';
    h.style.left = c.x + 'px';
    h.style.top = c.y + 'px';
    els.open.appendChild(h);
    // fx.js の heartbeat は 0・0.22・0.85・1.07 秒に 鳴る (1.5 秒のうち)
    const beat = [[0, 0], [0.02, 0.75], [0.1, 0.2], [0.16, 0.95], [0.32, 0.1], [0.56, 0.1], [0.58, 0.85], [0.66, 0.25], [0.72, 1], [0.92, 0.2], [1, 0.25]];
    h.animate(beat.map(function (b) { return { opacity: b[1], offset: b[0] }; }), { duration: 1500, fill: 'forwards' });
    slot.querySelector('.shake').animate(beat.map(function (b) { return { transform: 'scale(' + (1 + b[1] * 0.035).toFixed(3) + ')', offset: b[0] }; }), { duration: 1500 });
    return h;
  }

  async function megaSequence(r) {
    const ch = r.charge;
    ch.done = true;
    if (ch.snd) { ch.snd.stop(); ch.snd = null; }
    r.phase = 'reveal';
    hint('');
    els.ring.hidden = true;
    rays(null);
    // まっくら → 心臓の音
    r.blackAnim = els.black.animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: 350, fill: 'forwards' });   // カードがうっすら見えるくらい
    await wait(420);
    if (!alive(r)) return;
    S.play('heartbeat');
    const shake = r.slots[ch.i].querySelector('.shake');
    shake.style.transform = 'none';
    const heart = heartGlow(r.slots[ch.i]);
    await wait(1500);
    if (!alive(r)) { heart.remove(); return; }
    // 金のひび: カードの まん中から 左右へ 走り、枝わかれする → 光が もれる → 暗やみが われて とびちる
    const c = center(els.stack);
    S.play('crack');
    drawCrack(c.x, c.y, '#ffcf40');
    fx.burst(c.x, c.y, { color: 'gold', count: 30, shape: 'star', speed: 300, size: 8, gravity: 0, life: 0.9, add: true });
    heart.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 700, fill: 'forwards' });
    await wait(380);
    if (!alive(r)) { heart.remove(); return; }
    crackGlow(420);
    shakeScreen(6, 400);
    await wait(440);
    if (!alive(r)) { heart.remove(); return; }
    clearBlack(r);
    shatter(c.x, c.y, 'rgba(0,0,0,.9)', 11);
    cutBg('gold');
    flash('#fff3b0', 0.85, 650);
    shakeScreen(12, 450);
    els.crack.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
    heart.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = function () { heart.remove(); };
    if (ch.sp.rarity === 'LR') { legendSequence(r); return; }
    chargeReveal(r, true);
  }

  /**
   * LR だけ: 金の世界で おわらない。金が ひびわれて 宇宙へ ぬける → 星が すいこまれる → 虹の輪 → めくれる
   * (MUR までの演出を ぜんぶ通ってから、さらに 1 だん上がる)
   */
  async function legendSequence(r) {
    const ch = r.charge;
    rays('gold');
    const shake = r.slots[ch.i].querySelector('.shake');
    shake.animate([{ transform: 'none' }, { transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 500, iterations: 3 });
    hint('……！？ まだ ひかりが とまらない！');
    await wait(1300);
    if (!alive(r)) return;
    // 金の世界に もういちど ひび (こんどは 虹色) → 金の世界が われて とびちり、宇宙へ ぬける
    const cc = center(els.stack);
    S.play('crack');
    drawCrack(cc.x, cc.y, '#c39bff');
    shakeScreen(14, 500);
    await wait(380);
    if (!alive(r)) return;
    crackGlow(380);
    await wait(400);
    if (!alive(r)) return;
    shatter(cc.x, cc.y, 'gold', 12);
    cutBg('cosmos');
    flash('#ffffff', 0.9, 650);
    els.crack.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    rays(null);
    hint('');
    S.play('warp');
    const c = center(els.stack);
    const t0 = performance.now();
    await new Promise(function (res) {
      (function loop(now) {
        if (!alive(r)) { res(); return; }
        const k = Math.min(1, (now - t0) / 1600);
        fx.inward(c.x, c.y, { color: 'legend', count: 3, r0: 160, r1: 420, size: 4 + k * 5 });
        shake.style.transform = 'translate(' + ((Math.random() * 2 - 1) * k * 7).toFixed(1) + 'px,' + ((Math.random() * 2 - 1) * k * 7).toFixed(1) + 'px)';
        if (k < 1) requestAnimationFrame(loop); else res();
      })(t0);
    });
    if (!alive(r)) return;
    shake.style.transform = 'none';
    shock('#ff9ecb', 1);
    shock('#9fe0ff', 1);
    shock('#ffe680', 1);
    rays('legend');
    hint('レジェンド……！');
    await wait(700);
    if (!alive(r)) return;
    chargeReveal(r, true);
  }

  async function chargeReveal(r, fromMega) {
    const ch = r.charge;
    if (!ch || (ch.done && !fromMega)) return;
    ch.done = true;
    if (ch.snd) { ch.snd.stop(); ch.snd = null; }
    r.phase = 'reveal';
    hint('');
    els.ring.hidden = true;
    const i = ch.i;
    const sp = ch.sp;
    const rar = sp.rarity;
    const slot = r.slots[i];
    const shake = slot.querySelector('.shake');
    shake.style.transform = 'none';
    slot.classList.remove('waiting', 'charging', 'aura-white', 'aura-blue', 'aura-gold', 'aura-rainbow');
    const color = { SR: 'gold', SAR: 'rainbow', MUR: 'mega', LR: 'legend' }[rar];

    flash(rar === 'MUR' ? '#ffe27a' : '#ffffff', 1, rar === 'SR' ? 650 : 900);
    if (rar === 'SAR') setBg('night');
    if (rar === 'LR') {
      // LR: 宇宙から 虹の世界へ。カードの うしろに 大きな 虹が かかる
      // 回る 光の筋 (op-rays) は 出さない: 虹の背景の上で 回すと、遅い端末で 出た直後が 1 コマ ほぼ 1 つぶん 重くなった。
      // 光の筋は 背景に 止まった絵として 描いてある
      cutBg('rainbow');
      rays(null);
      rainbowArc(slot);
    } else rays(RAY[color]);
    S.play('fanfare' + rar);
    shakeScreen(rar === 'SR' ? 10 : 16, 520);
    if (rar === 'LR') ['#ff6fa8', '#ffb35c', '#ffe45c', '#6fe39a', '#5cc8ff', '#9a7bff'].forEach(function (col, k) { setTimeout(function () { if (alive(r)) shock(col, 1); }, k * 110); });
    else shock(rar === 'MUR' ? '#ffd84a' : rar === 'SAR' ? '#ffffff' : '#ffe58a', rar === 'SR' ? 2 : 3);
    shake.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(.96)', offset: 0.6 }, { transform: 'none' }],
      { duration: rar === 'SR' ? 600 : 1100, easing: 'ease-out' });
    const p = center(slot);
    if (rar === 'SR') {
      fx.burst(p.x, p.y, { color: 'gold', count: 90, shape: 'star', speed: 640, size: 12, gravity: 160, life: 1.6, add: false });
      fx.burst(p.x, p.y, { color: 'gold', count: 40, shape: 'confetti', speed: 560, size: 12, gravity: 300, life: 2.4 });
    } else if (rar === 'SAR') {
      fx.burst(p.x, p.y, { color: 'rainbow', count: 120, shape: 'star', speed: 720, size: 13, gravity: 120, life: 1.8 });
      fx.burst(p.x, p.y, { color: 'rainbow', count: 60, shape: 'confetti', speed: 640, size: 13, gravity: 300, life: 2.6 });
      fx.rain({ shape: 'confetti', color: 'rainbow', rate: 38, dur: 5, size: 13, speed: 170, life: 6 });
      fx.rain({ shape: 'star', color: 'rainbow', rate: 10, dur: 5, size: 10, speed: 90, gravity: 10, life: 6, add: true });
    } else if (rar === 'LR') {
      // 粒の数は MUR と同じくらいにおさえる (遅い端末で 1 コマ 16.7ms を守るため。色と星の量で LR らしさを出す)
      fx.burst(p.x, p.y, { color: 'rainbow', count: 140, shape: 'star', speed: 820, size: 15, gravity: 60, life: 2.2 });
      fx.burst(p.x, p.y, { color: 'gold', count: 30, shape: 'coin', speed: 700, size: 11, gravity: 520, life: 2.8, lift: 260 });
      fx.rain({ shape: 'star', color: 'rainbow', rate: 14, dur: 7, size: 11, speed: 110, gravity: 10, life: 6, add: true });
      fx.rain({ shape: 'confetti', color: 'rainbow', rate: 24, dur: 7, size: 12, speed: 170, life: 6 });
      fx.rain({ shape: 'coin', color: 'gold', rate: 10, dur: 7, size: 11, speed: 220, gravity: 120, life: 6 });
    } else {
      fx.burst(p.x, p.y, { color: 'mega', count: 140, shape: 'star', speed: 760, size: 14, gravity: 120, life: 2 });
      fx.burst(p.x, p.y, { color: 'gold', count: 50, shape: 'coin', speed: 680, size: 11, gravity: 520, life: 2.8, lift: 260 });
      fx.rain({ shape: 'coin', color: 'gold', rate: 20, dur: 6, size: 11, speed: 220, gravity: 120, life: 6 });
      fx.rain({ shape: 'confetti', color: 'mega', rate: 30, dur: 6, size: 12, speed: 170, life: 6 });
      fx.rain({ shape: 'star', color: 'mega', rate: 12, dur: 6, size: 10, speed: 80, gravity: 10, life: 6, add: true });
    }
    await flip(slot, rar === 'SR' ? 560 : 1150, rar === 'SR' ? 1 : 2);
    if (!alive(r)) return;
    slot.querySelector('.pc').classList.add('shine-once');
    banner(rar);
    revealed(r, i);
    r.charge = null;
  }

  // ================================================================ 5. 結果
  function showResult(r) {
    r.phase = 'result';
    removeArc();
    clearBlack(r);   // 念のため (結果に 暗やみを のこさない)
    hint('');
    els.count.textContent = '';
    els.skip.hidden = true;
    els.stack.hidden = true;
    hideBanner();
    rays(null);
    setBg('day');
    r.tilts.forEach(function (t) { if (t) t.stop(); });
    let list = r.cards;
    els.sum.hidden = !r.opts.bulk;
    els.resTitle.textContent = 'ゲット！';
    if (r.opts.bulk) {
      // まとめて開けたとき: 枚数のまとめ + レアと はじめてのカードだけを並べる (強い順)
      const b = r.opts.bulk;
      els.resTitle.textContent = b.packs + 'パック あけた！';
      els.sum.innerHTML = C.RARITY_ORDER.filter(function (k) { return b.counts[k]; }).map(function (k) {
        return '<span class="sum-i"><span class="rmark rm-' + k + '">' + k + '</span>×' + b.counts[k] + '</span>';
      }).join('') + '<span class="sum-new">NEW ' + b.newNos.length + 'まい</span>';
      const seen = {};
      list = [];
      r.cards.concat(b.newNos.map(function (no) { return { no: no, isNew: true }; })).forEach(function (c) {
        if (seen[c.no]) { if (c.isNew) seen[c.no].isNew = true; return; }
        seen[c.no] = { no: c.no, isNew: b.newNos.indexOf(c.no) >= 0 };
        list.push(seen[c.no]);
      });
      list.sort(function (x, y) { return C.rank(C.cardByNo(y.no).rarity) - C.rank(C.cardByNo(x.no).rarity) || (x.no < y.no ? -1 : 1); });
    }
    let best = 0;
    list.forEach(function (c, i) { if (C.rank(C.cardByNo(c.no).rarity) > C.rank(C.cardByNo(list[best].no).rarity)) best = i; });
    els.grid.innerHTML = list.map(function (c, i) {
      const card = C.cardByNo(c.no);
      return '<button type="button" class="op-cell' + (i === best && C.rank(card.rarity) >= C.rank('RR') ? ' best' : '') + '" data-no="' + c.no + '">' +
        V.html(card, { small: true }) + (c.isNew ? '<span class="op-new">NEW!</span>' : '') + '</button>';
    }).join('');
    const again = r.opts.againLabel ? r.opts.againLabel() : null;
    els.again.hidden = !again;
    if (again) els.againLabel.textContent = again;
    els.result.hidden = false;
    els.result.querySelectorAll('.op-cell').forEach(function (cell, i) {
      cell.animate([{ transform: 'translateY(40px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 380, delay: 80 + Math.min(i, 12) * 70, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'backwards' });
      if (i < 8) setTimeout(function () { if (alive(r)) S.play('pop'); }, 80 + i * 70);
    });
  }

  function zoom(no) {
    const card = C.cardByNo(no);
    els.zoomBox.innerHTML = '<div class="op-zoom-card">' + V.html(card) + '</div>' +
      '<p class="op-zoom-meta">' + card.rarity + ' ' + C.RARITIES[card.rarity].label + '</p>';
    els.zoom.hidden = false;
    if (run) run.zoomTilt = V.tilt(els.zoomBox.querySelector('.op-zoom-card'), { idle: true });
  }

  function closeZoom() {
    els.zoom.hidden = true;
    if (run && run.zoomTilt) { run.zoomTilt.stop(); run.zoomTilt = null; }
  }

  // ================================================================ スキップ・終わり
  function skip() {
    const r = run;
    if (!r) return;
    if (r.phase === 'pack') { autoTear(r); return; }
    if (r.phase !== 'stack') return;
    // 次の「まだめくっていない特別なカード」の手前まで、ふつうのカードを飛ばす
    let guard = 10;
    while (guard-- > 0 && r.phase === 'stack' && r.index < r.cards.length) {
      const sp = r.special[r.index];
      if (sp && !r.revealed[r.index]) break;
      fling(r, -1);
    }
  }

  function stopAll() {
    if (!run) return;
    run.timers.forEach(clearInterval);
    run.tilts.forEach(function (t) { if (t) t.stop(); });
    if (run.charge && run.charge.snd) run.charge.snd.stop();
    if (run.charge) run.charge.done = true;
    if (run.zoomTilt) run.zoomTilt.stop();
    run = null;
  }

  function close() {
    const r = run;
    stopAll();
    fx.clear();
    els.open.hidden = true;
    els.result.hidden = true;
    els.zoom.hidden = true;
    if (r && r.opts.onClose) r.opts.onClose();
  }

  function init() {
    els = {
      open: $('open'), stage: $('opStage'), pack: $('opPack'), stack: $('opStack'), ring: $('opRing'),
      rays: $('opRays'), hint: $('opHint'), banner: $('opBanner'), flash: $('opFlash'), black: $('opBlack'),
      crack: $('opCrack'), count: $('opCount'), skip: $('opSkip'), result: $('opResult'), grid: $('opGrid'),
      again: $('opAgain'), againLabel: $('opAgainLabel'), resTitle: $('opResTitle'), sum: $('opSum'),
      bulk: $('opBulk'), bulkPack: $('obPack'), bulkCount: $('obCount'), close: $('opClose'), zoom: $('opZoom'), zoomBox: $('opZoomBox')
    };
    fx = Fx.particles($('opFx'));
    els.pack.addEventListener('pointerdown', tearStart);
    els.pack.addEventListener('pointermove', tearMove);
    els.pack.addEventListener('pointerup', tearEnd);
    els.pack.addEventListener('pointercancel', tearEnd);
    els.stack.addEventListener('pointerdown', stackDown);
    els.stack.addEventListener('pointermove', stackMove);
    els.stack.addEventListener('pointerup', stackUp);
    els.stack.addEventListener('pointercancel', stackUp);
    els.skip.addEventListener('click', skip);
    els.close.addEventListener('click', close);
    els.again.addEventListener('click', function () {
      const r = run;
      if (r && r.opts.onAgain) r.opts.onAgain();
    });
    els.grid.addEventListener('click', function (e) {
      const cell = e.target.closest('.op-cell');
      if (cell) zoom(cell.dataset.no);
    });
    els.zoom.addEventListener('click', closeZoom);
    document.addEventListener('contextmenu', function (e) { if (run) e.preventDefault(); });
  }

  /** テスト用: いまの様子 */
  function state() {
    if (!run) return { phase: 'closed' };
    return {
      phase: run.phase, index: run.index, total: run.cards.length,
      charge: run.charge ? { p: run.charge.p, stage: run.charge.stage, holding: run.charge.holding } : null,
      revealed: Object.keys(run.revealed).map(Number), show: run.show, cards: run.cards
    };
  }

  root.Opening = { start: start, close: close, state: state, skip: skip, fx: function () { return fx; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
