/*
 * ブラウザで実際に動かして確かめるテスト。
 *
 *   npm i -D playwright && npm run test:ui
 *
 * 本物のブラウザを iPhone 16 Plus の大きさ (430 x 932pt) で立ち上げ、指のタップをそのまま再現する。
 * 画面まわりの不具合は node のテストでは捕まらない。
 * 直した不具合には、かならずここに見張り役を足すこと。
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const PORT = Number(process.env.PORT || 8123);
const URL = `http://localhost:${PORT}/`;
const ROOT = __dirname;
const CHROMIUM = process.env.CHROMIUM_PATH;   // 手元の Chromium を使いたいとき

// 端末名は playwright の版で通じないことがあるので、大きさを直に書く
const PHONE = {
  viewport: { width: 430, height: 932 },
  screen: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
};

let passed = 0;
let failed = 0;

function ok(condition, message) {
  if (condition) {
    passed++;
    console.log('  \x1b[32m✓\x1b[0m ' + message);
  } else {
    failed++;
    console.log('  \x1b[31m✗ FAIL\x1b[0m ' + message);
  }
}

function section(name) { console.log('\n' + name); }

function waitForServer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      http.get(URL, (res) => { res.resume(); resolve(); })
        .on('error', () => {
          if (Date.now() - started > 10000) reject(new Error('サーバーが起動しない'));
          else setTimeout(tick, 100);
        });
    };
    tick();
  });
}

async function newGame(browser, errors, opts) {
  const { title, ...ctxOpts } = opts || {};
  const context = await browser.newContext({ ...PHONE, ...ctxOpts });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL + (title ? '' : '?title=0'));   // タイトルを出さない (出すのは「タイトル」の試験だけ)
  await page.waitForFunction(() => window.__app);
  return { context, page };
}

const money = (page) => page.evaluate(() => window.__app.state().money);
const goTab = (page, name) => page.tap(`[data-tab=${name}]`);

const opState = (page) => page.evaluate(() => window.__app.opening.state());
const box = (page, sel) => page.locator(sel).boundingBox();

/** パックの上の線を、指で左から右へなぞる (frac = なぞる長さ、パックの幅に対して) */
async function tearSwipe(page, frac) {
  const pk = await box(page, '#opPack .pk');
  const y = pk.y + pk.height * 0.13;
  const x0 = pk.x + pk.width * 0.08;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x0 + (pk.width * frac * i) / 12, y + (i % 2 ? 3 : -3));
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
}

/** 束のいちばん上のカードを、指で横にはらう */
async function swipeTop(page, dir) {
  const b = await box(page, '#opStack');
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(cx + dir * i * 30, cy + i * 2); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(380);
}

async function tapTop(page) {
  const b = await box(page, '#opStack');
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

/** 長押し。押している間の様子 (光の色・ためた量) を 1 コマずつ記録して返す */
async function holdTop(page, ms) {
  const b = await box(page, '#opStack');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.evaluate(() => {
    window.__rec = [];
    const loop = () => {
      const st = window.__app.opening.state();
      const slot = document.querySelector('.slot.charging');
      const aura = slot ? (slot.className.match(/aura-(\w+)/) || [])[1] : null;
      window.__rec.push({ p: st.charge ? st.charge.p : null, stage: st.charge ? st.charge.stage : null, aura, phase: st.phase,
        black: Number(getComputedStyle(document.getElementById('opBlack')).opacity) });
      if (window.__rec.length < 2000) window.__recRaf = requestAnimationFrame(loop);
    };
    loop();
  });
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  return page.evaluate(() => { cancelAnimationFrame(window.__recRaf); return window.__rec; });
}

/** 開封を最後まで進める: やぶる → めくる (特別なカードはタップ / 長押し) → 結果 */
/** パック画面の中だけを縦に送って、ボタンをタブの上に出す (scrollIntoView は外側の入れ物まで送ってしまう) */
async function scrollToBtn(page, id) {
  await page.evaluate((i) => {
    const b = document.getElementById(i);
    const sc = b.closest('.screen');
    const bar = document.getElementById('tabbar').getBoundingClientRect();
    sc.scrollTop += b.getBoundingClientRect().bottom - bar.top + 12;
  }, id);
}

/** パックの種類を えらぶ: 「ほかの パック」→ 一覧から 1 つ (where = setPick / zkPick) */
async function pickSet(page, where, id) {
  await page.tap('#' + where + ' .sp-bar');
  await page.waitForSelector('#packSheet:not([hidden])');
  const b = page.locator('#pshBody .sp-btn[data-set="' + id + '"]');
  await b.scrollIntoViewIfNeeded();
  await b.tap();
  await page.waitForSelector('#packSheet', { state: 'hidden' });
}

async function playThrough(page, log) {
  await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
  await page.waitForTimeout(800);
  await tearSwipe(page, 0.85);
  await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 5000 });
  for (let guard = 0; guard < 12; guard++) {
    const s = await opState(page);
    if (s.phase === 'result') break;
    if (s.phase !== 'stack') { await page.waitForTimeout(200); continue; }
    const sp = s.show.specials.find((x) => x.index === s.index);
    if (sp && !s.revealed.includes(s.index)) {
      if (sp.mode === 'tap') await tapTop(page);
      else {
        const rec = await holdTop(page, { SR: 2900, SAR: 4000, MUR: 5200, LR: 5200 }[sp.rarity]);
        if (log) log.push({ rarity: sp.rarity, rec });
      }
      await page.waitForFunction((i) => window.__app.opening.state().revealed.includes(i), s.index, { timeout: 14000 });
      await page.waitForTimeout(1500);
      await tapTop(page);
      await page.waitForTimeout(400);
    } else {
      await swipeTop(page, -1);
    }
  }
  await page.waitForFunction(() => window.__app.opening.state().phase === 'result', null, { timeout: 5000 });
  await page.waitForTimeout(900);
  return opState(page);
}

/** 1 コマずつ、要素の位置を測って、どれだけ動いたかを返す */
function measureMotion(page, selector, ms) {
  return page.evaluate(async ({ sel, ms }) => {
    const el = document.querySelector(sel);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      await new Promise((r) => requestAnimationFrame(r));
      const b = el.getBoundingClientRect();
      minX = Math.min(minX, b.left); maxX = Math.max(maxX, b.left);
      minY = Math.min(minY, b.top); maxY = Math.max(maxY, b.top);
    }
    return { dx: maxX - minX, dy: maxY - minY };
  }, { sel: selector, ms });
}

async function run() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    console.error('playwright が必要です:  npm i -D playwright');
    process.exit(1);
  }

  const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await waitForServer();

  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const errors = [];
  const only = process.env.ONLY;   // ONLY=開封 などで、その見出しだけ流す
  const want = (name) => !only || name.includes(only);

  try {
    let context, page;

    // ------------------------------------------------ タイトル画面
    if (want('タイトル')) {
      section('タイトル: 開くたびに はじめに出る → 「あそぶ」で ひろば (木をタップする画面)');
      ({ context, page } = await newGame(browser, errors, { title: true }));
      await page.waitForFunction(() => document.querySelector('.tt-img').complete);
      const t0 = await page.evaluate(() => {
        const img = document.querySelector('.tt-img').getBoundingClientRect();
        const btn = document.getElementById('btnPlay').getBoundingClientRect();
        const hit = document.elementFromPoint(btn.left + btn.width / 2, btn.top + btn.height / 2);
        return { open: window.__app.titleOpen(), ok: document.querySelector('.tt-img').naturalWidth > 0, w: img.width, h: img.height,
          btnTop: btn.top, btnBottom: btn.bottom, btnL: btn.left, btnR: btn.right, hit: !!(hit && hit.closest('#btnPlay')),
          covers: document.getElementById('title').getBoundingClientRect().height, sky: document.getElementById('title').hidden };
      });
      ok(t0.open && !t0.sky && t0.ok, '開くと タイトルが出ていて、絵が読み込めている');
      ok(Math.abs(t0.w - 430) < 1 && Math.abs(t0.h - 931.5) < 2 && t0.covers >= 932, `絵は 幅いっぱい・縦も画面ぜんたい (${Math.round(t0.w)} x ${Math.round(t0.h)})`);
      ok(t0.hit && t0.btnBottom <= 932 - 20 && t0.btnL >= 20 && t0.btnR <= 410, `「あそぶ」が 画面の中で押せる (${Math.round(t0.btnTop)}〜${Math.round(t0.btnBottom)})`);
      const dg = await page.evaluate(() => {
        const d = document.getElementById('diag'), r = d.getBoundingClientRect();
        return { inTitle: !!d.closest('#title'), inTop: !!d.closest('#topbar'), text: d.textContent, l: r.left, t: r.top, r: r.right, b: r.bottom, vis: getComputedStyle(d).display !== 'none' };
      });
      ok(dg.inTitle && !dg.inTop && dg.vis && /^v\d+ 描ける\d+ 窓\d+ vh\d+$/.test(dg.text) && dg.l >= 0 && dg.r <= 430 && dg.t >= 0 && dg.b <= 80,
        `バージョンの診断は タイトル画面の左上に出る (「${dg.text}」)`);
      ok(await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content) === '#9ed4f8', 'タイトルのあいだは 状態バーの色が タイトルの空に近い色');
      ok(await page.evaluate(() => document.documentElement.classList.contains('on-title') && getComputedStyle(document.body).backgroundImage.includes('linear-gradient')),
        'タイトルのあいだは html・body の背景も 絵の上端の色 (状態バーの帯が見える端末向け)');
      const m0 = await money(page);
      const tb = await box(page, '#tree');
      await page.touchscreen.tap(tb.x + 100, tb.y + 100);   // 本物の指と同じ。うしろの木は、タイトルにさえぎられて受け取らない
      await page.waitForTimeout(150);
      ok((await money(page)) === m0, 'タイトルが出ている間は うしろの木を タップしても コインは増えない');
      const pb = await box(page, '#btnPlay');   // ゆれて大きさが変わる ボタンは、Playwright の「止まるまで待つ」に合わないので、指でまんなかを押す
      await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
      await page.waitForFunction(() => document.getElementById('title').hidden, null, { timeout: 3000 });
      ok(await page.locator('#scHome').isVisible() && !(await page.evaluate(() => window.__app.titleOpen())), '「あそぶ」で タイトルが消えて、ひろば (木の画面) になる');
      ok(await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content) === '#fff3d6', '「あそぶ」のあとは 状態バーの色が もとのクリーム色にもどる');
      ok(await page.evaluate(() => !document.documentElement.classList.contains('on-title') && getComputedStyle(document.querySelector('.tree-btn')).touchAction === 'none'
        && getComputedStyle(document.documentElement).touchAction === 'manipulation'), '木は touch-action: none・ふだんは manipulation (連打で拡大されない)・タイトルの背景は外れる');
      for (let i = 0; i < 5; i++) await page.tap('#tree', { position: { x: 90 + i * 10, y: 90 } });
      ok((await money(page)) >= 5, `そのまま 木をタップして コインがかせげる (${await money(page)})`);
      await page.reload();
      await page.waitForFunction(() => window.__app);
      ok(await page.evaluate(() => window.__app.titleOpen() && !document.getElementById('title').hidden), '開き直すと、また タイトルから はじまる');
      // 状態バーの下から始まる低い画面 (873) でも 「あそぶ」が見える・押せる
      await page.setViewportSize({ width: 430, height: 873 });
      await page.waitForTimeout(100);
      const low = await page.evaluate(() => {
        const btn = document.getElementById('btnPlay').getBoundingClientRect();
        const hit = document.elementFromPoint(btn.left + btn.width / 2, btn.top + btn.height / 2);
        return { bottom: btn.bottom, hit: !!(hit && hit.closest('#btnPlay')) };
      });
      ok(low.hit && low.bottom <= 873, `高さ 873 でも 「あそぶ」が画面の中 (下 ${Math.round(low.bottom)})`);
      await context.close();
    }

    // ------------------------------------------------ 開く・安全域
    if (want('画面')) {
      section('画面: 開く・安全域を差し込んで収まる');
      ({ context, page } = await newGame(browser, errors));
      const fit = await page.evaluate(() => ({
        wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        tabs: document.querySelectorAll('.tab').length
      }));
      ok(fit.wide <= 0 && fit.tabs === 3, `横スクロールなし・タブ 3 つ (${fit.wide})`);
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--safe-top', '59px');
        document.documentElement.style.setProperty('--safe-bottom', '34px');
      });
      // 渡された画面の高さ (innerHeight) にぴったり合い、タブが画面の外へ出ない。状態バーの下から始まる画面 (873) でも
      for (const h of [932, 873]) {
        await page.setViewportSize({ width: 430, height: h });
        await page.waitForTimeout(100);
        const fitH = await page.evaluate(() => ({
          app: document.getElementById('app').getBoundingClientRect().height, win: window.innerHeight,
          bar: document.getElementById('tabbar').getBoundingClientRect().bottom, root: document.documentElement.getBoundingClientRect().height,
          diag: document.getElementById('diag').textContent
        }));
        ok(Math.abs(fitH.app - fitH.win) < 0.5 && fitH.bar <= fitH.win + 0.5 && Math.abs(fitH.root - fitH.win) < 0.5,
          `高さ ${h}: 画面にぴったり (描ける ${Math.round(fitH.app)} / 窓 ${fitH.win} / タブの下 ${Math.round(fitH.bar)}) 診断「${fitH.diag}」`);
      }
      await page.setViewportSize({ width: 430, height: 932 });
      for (const tab of ['Home', 'Packs', 'Zukan']) {
        await goTab(page, tab);
        await page.waitForTimeout(100);
        const r = await page.evaluate((t) => {
          const bar = document.getElementById('tabbar').getBoundingClientRect();
          const scr = document.getElementById('sc' + t);
          const inner = [...scr.querySelectorAll(t === 'Zukan' ? '.zk-head' : t === 'Packs' ? '.stage-arrow, .shop-pack, .sp-list, #btnFree' : '.btn, .upgrade, .tree-btn')];
          return {
            barBottom: bar.bottom, barTop: bar.top,
            worst: inner.reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0),
            right: inner.reduce((m, e) => Math.max(m, e.getBoundingClientRect().right), 0),
            top: document.getElementById('topbar').getBoundingClientRect().top
          };
        }, tab);
        ok(r.barBottom <= 932.5 && r.worst <= r.barTop + 0.5 && r.right <= 430.5 && r.top >= 59,
          `${tab}: タブ・ボタンが画面に収まり、重ならない (ボタンの下 ${Math.round(r.worst)} / タブの上 ${Math.round(r.barTop)})`);
      }
      await context.close();
    }

    // ------------------------------------------------ タップ
    if (want('タップ')) {
      section('タップ: コインが増える・強化・保存');
      ({ context, page } = await newGame(browser, errors));
      for (let i = 0; i < 10; i++) await page.tap('#tree', { position: { x: 80 + i * 12, y: 90 } });
      ok((await money(page)) === 20 && (await page.textContent('#moneyNum')) === '20', '10 回タップで 20 コイン (1 回 2 コイン)');
      await page.evaluate(() => {
        const t = document.getElementById('tree');
        for (let i = 0; i < 30; i++) t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 200, clientY: 300, pointerId: 1 + (i % 2) }));
      });
      ok((await money(page)) === 80, `連打 30 回も 1 回も取りこぼさない (${await money(page)})`);
      const mu = await page.evaluate(() => {
        const bt = document.getElementById('btnMute'), sl = bt.querySelector('.mu-slash');
        return { emoji: /[🔊🔇]/.test(bt.textContent), svg: !!bt.querySelector('svg'), slash: getComputedStyle(sl).display, w: bt.getBoundingClientRect().width };
      });
      await page.tap('#btnMute');
      const mu2 = await page.evaluate(() => ({ off: document.getElementById('btnMute').classList.contains('off'), slash: getComputedStyle(document.querySelector('.mu-slash')).display }));
      await page.tap('#btnMute');
      ok(!mu.emoji && mu.svg && mu.slash === 'none' && mu2.off && mu2.slash !== 'none' && mu.w >= 44, '音のボタンは 絵文字ではなく おんぷの絵。止めると斜めの線が出る');
      const cost = await page.evaluate(() => window.__app.core.upgradeCost(0));
      await page.evaluate((c) => window.__app.setMoney(c - 1), cost);
      ok(await page.locator('#btnUp').isDisabled(), `強化: ${cost - 1} コインでは押せない`);
      await page.evaluate((c) => window.__app.setMoney(c), cost);
      await page.tap('#btnUp');
      await page.tap('#tree', { position: { x: 100, y: 100 } });
      ok((await money(page)) === 3, '強化すると 1 回で 3 コイン');
      await page.waitForTimeout(1200);
      const before = await page.evaluate(() => JSON.stringify(window.__app.state()));
      await page.reload();
      await page.waitForFunction(() => window.__app);
      ok(before === (await page.evaluate(() => JSON.stringify(window.__app.state()))), '開き直しても残る');
      await context.close();
    }

    // ------------------------------------------------ 開封 (ふつうのパック・指で)
    if (want('開封')) {
      section('開封: 指でなぞってやぶる → スワイプでめくる → 結果');
      ({ context, page } = await newGame(browser, errors));
      ok(await page.locator('#packDot').isVisible(), 'むりょうパックがある日は、タブに赤い点');
      await goTab(page, 'Packs');
      await page.evaluate(() => window.__app.rigNextPack('R', false));
      await page.tap('#btnFree');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
      await page.waitForTimeout(900);
      await tearSwipe(page, 0.35);
      await page.waitForTimeout(400);
      ok((await opState(page)).phase === 'pack', 'パックの幅の 3 割しかなぞらないと、まだ開かない');
      const leakW = await page.evaluate(() => parseFloat(document.querySelector('#opPack .pk-leak').style.width));
      ok(leakW > 20 && leakW < 60, `なぞったぶんだけ切り口が光る (${leakW}%)`);
      await tearSwipe(page, 0.85);
      await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 4000 });
      ok(true, 'なぞりきると開いて、カードの束が出る');
      const first = await page.evaluate(() => {
        const s = document.querySelector('.slot');
        const b = s.getBoundingClientRect();
        // 3D で裏返したカードは、当たり判定 (elementFromPoint) が見えていない裏の面を返すことがある。向きは印で見る
        return { front: s.querySelector('.c3-in').classList.contains('up'), inside: b.left >= 0 && b.right <= 430 && b.top >= 0 && b.bottom <= 932 };
      });
      ok(first.front && first.inside, 'ふつうのカードは表向きで、画面に収まる');
      await swipeTop(page, -1);
      ok((await opState(page)).index === 1, '左へスワイプすると次のカード');
      await swipeTop(page, 1);
      ok((await opState(page)).index === 2, '右へスワイプしても次のカード');
      // 少しだけ動かして離すと、元にもどる (めくれない)
      const b = await box(page, '#opStack');
      await page.mouse.move(b.x + 135, b.y + 190);
      await page.mouse.down();
      await page.mouse.move(b.x + 175, b.y + 192, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      ok((await opState(page)).index === 2, 'ちょっとずらしただけでは めくれない');
      await tapTop(page);
      await page.waitForTimeout(400);
      ok((await opState(page)).index === 3, 'タップでも次のカード');
      await swipeTop(page, -1);
      await swipeTop(page, -1);
      await page.waitForFunction(() => window.__app.opening.state().phase === 'result', null, { timeout: 4000 });
      await page.waitForTimeout(900);
      const res = await page.evaluate(() => ({
        cells: document.querySelectorAll('.op-cell').length,
        news: document.querySelectorAll('.op-cell .op-new').length,
        expectNew: window.__app.opening.state().cards.filter((c) => c.isNew).length,
        names: [...document.querySelectorAll('.op-cell .pc-name')].map((e) => e.textContent),
        want: window.__app.opening.state().cards.map((c) => window.__app.core.cardByNo(c.no).name)
      }));
      ok(res.cells === 5 && JSON.stringify(res.names) === JSON.stringify(res.want), `結果に 5 まい、出た順にならぶ (${res.names.join(',')})`);
      ok(res.news === res.expectNew, `はじめてのカードに NEW (${res.news})`);
      await page.tap('.op-cell >> nth=0');
      ok(await page.locator('#opZoom').isVisible(), '結果のカードを押すと大きく見られる');
      await page.tap('#opZoom', { position: { x: 20, y: 20 } });
      ok(await page.locator('#opAgain').isHidden(), 'むりょうを使って、お金も無いときは「もう1パック」が出ない');
      await page.tap('#opClose');
      ok(await page.locator('#open').isHidden(), '「とじる」で もどる');
      ok(await page.locator('#btnFree').isDisabled(), 'むりょうパックは 1 日 1 回');
      ok(await page.locator('#packDot').isHidden(), '赤い点も消える');

      section('開封: ちょんと押すだけでも開く・スキップ');
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 5, 0);
      await page.clock.setFixedTime(tomorrow);
      await page.evaluate(() => window.__app.renderFree());
      ok(await page.locator('#btnFree').isEnabled() && await page.locator('#packDot').isVisible(), '次の日になると、また むりょう');
      await page.evaluate(() => window.__app.rigNextPack('SR', false));
      await page.tap('#btnFree');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
      await page.waitForTimeout(900);
      const pk = await box(page, '#opPack');
      await page.mouse.click(pk.x + pk.width / 2, pk.y + pk.height / 2);
      await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 4000 });
      ok(true, 'なぞれなくても、パックをタップすれば開く');
      await page.tap('#opSkip');
      await page.waitForTimeout(500);
      const sk = await opState(page);
      ok(sk.index === 4 && sk.phase === 'stack', `スキップで、ふつうのカードを飛ばして SR の前で止まる (${sk.index})`);
      ok(await page.locator('#opSkip').isHidden(), 'ためている間はスキップを出さない');
      // ちょんと押しただけでは SR はめくれない
      await tapTop(page);
      await page.waitForTimeout(600);
      const st2 = await opState(page);
      ok(!st2.revealed.includes(4) && st2.charge && st2.charge.p < 0.5, `SR はタップではめくれない (ためた量 ${st2.charge && st2.charge.p.toFixed(2)})`);

      section('開封: 開けた直後に閉じても、カードは残る');
      const sorted = () => JSON.stringify(Object.entries(window.__app.state().owned).sort());
      const mid = await page.evaluate(sorted);
      await page.reload();
      await page.waitForFunction(() => window.__app);
      ok(mid === (await page.evaluate(sorted)), 'めくる途中で開き直しても、図鑑に入っている');
      await context.close();
    }

    // ------------------------------------------------ レア演出
    if (want('レア')) {
      for (const [top, ar] of [['RR', false], ['R', true], ['SR', false], ['SAR', true], ['MUR', false], ['LR', false]]) {
        section(`レア演出: ${top}${ar ? ' + AR' : ''}`);
        ({ context, page } = await newGame(browser, errors));
        await page.evaluate(() => window.__app.setMoney(500));
        await goTab(page, 'Packs');
        await page.evaluate(([t, a]) => window.__app.rigNextPack(t, a), [top, ar]);
        await page.tap('#btnBuy');
        await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
        const show = (await opState(page)).show;
        ok(show.tier === (top === 'R' && ar ? 'AR' : top), `いちばん上のレア度 ${show.tier}`);
        const log = [];
        // 特別なカードは、めくる前は裏向き
        await page.waitForTimeout(800);
        await tearSwipe(page, 0.85);
        await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 4000 });
        const backs = await page.evaluate(() => [...document.querySelectorAll('.slot')].map((s) => !s.querySelector('.c3-in').classList.contains('up')));
        const wantBacks = [0, 1, 2, 3, 4].map((i) => show.specials.some((sp) => sp.index === i));
        ok(JSON.stringify(backs) === JSON.stringify(wantBacks), `特別なカードだけ裏向き (${backs.map((x) => (x ? '裏' : '表')).join('')})`);
        await page.evaluate(() => window.__app.opening.close());
        await page.evaluate(([t, a]) => { window.__app.setMoney(500); window.__app.rigNextPack(t, a); }, [top, ar]);
        await page.tap('#btnBuy');
        // 背景の移り変わりを記録する (宇宙 = LR だけ)
        await page.evaluate(() => {
          window.__bgs = [];
          const o = document.getElementById('open');
          new MutationObserver(() => { const b = o.dataset.bg; if (window.__bgs[window.__bgs.length - 1] !== b) window.__bgs.push(b); })
            .observe(o, { attributes: true, attributeFilter: ['data-bg'] });
        });
        const end = await playThrough(page, log);
        const bgs = await page.evaluate(() => window.__bgs);
        ok(bgs.includes('cosmos') === (top === 'LR'), `宇宙の背景は LR のときだけ (${bgs.join(' → ')})`);
        if (top === 'LR') ok(bgs.indexOf('gold') >= 0 && bgs.indexOf('gold') < bgs.indexOf('cosmos'), 'LR: 金の世界を通ってから 宇宙へ');
        ok(end.phase === 'result' && end.revealed.length === show.specials.length, `最後まで進んで、特別なカードを全部めくった (${end.revealed.length})`);
        for (const { rarity, rec } of log) {
          const colors = [];
          rec.forEach((x) => { if (x.aura && colors[colors.length - 1] !== x.aura) colors.push(x.aura); });
          const ladder = ['white', 'blue', 'gold', 'rainbow', 'mega', 'legend'];
          const up = colors.every((c, i) => i === 0 || ladder.indexOf(c) > ladder.indexOf(colors[i - 1]));
          const want = { SR: ['white', 'blue', 'gold'], SAR: ['white', 'blue', 'gold', 'rainbow'], MUR: ['white', 'blue', 'gold', 'rainbow'], LR: ['white', 'blue', 'gold', 'rainbow'] }[rarity];
          ok(up && JSON.stringify(colors) === JSON.stringify(want), `${rarity}: 押している間に光が ${colors.join(' → ')} と上がる (下がらない)`);
          if (rarity === 'MUR' || rarity === 'LR') {
            const black = Math.max(...rec.map((x) => x.black));
            ok(black >= 0.85, `${rarity}: 虹のあと まっ暗になる (幕の濃さ ${black.toFixed(2)})`);
          }
        }
        const bannerSeen = await page.evaluate(() => document.querySelectorAll('.op-cell').length);
        ok(bannerSeen === 5, '結果に 5 まい');
        await context.close();
      }

      section('レア演出: 途中で指を離すと、ためた量は減るが、上がった色までは下がらない');
      ({ context, page } = await newGame(browser, errors));
      await goTab(page, 'Packs');
      await page.evaluate(() => window.__app.rigNextPack('SAR', false));
      await page.tap('#btnFree');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
      await page.waitForTimeout(800);
      await tearSwipe(page, 0.85);
      await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 4000 });
      await page.tap('#opSkip');
      await page.waitForTimeout(500);
      await holdTop(page, 1700);
      const held = await opState(page);
      await page.waitForTimeout(1500);
      const later = await opState(page);
      const th = 0.12 + held.charge.stage * (0.88 / 3);
      ok(later.charge.p < held.charge.p && later.charge.p >= th - 0.001 && later.charge.stage === held.charge.stage,
        `離すと ${held.charge.p.toFixed(2)} → ${later.charge.p.toFixed(2)} (色の段 ${held.charge.stage} はそのまま)`);
      await context.close();
    }

    // ------------------------------------------------ 前の演出の名残
    if (want('名残')) {
      section('名残: 開けてすぐ閉じて、すぐ次を開いても、パックが見える (前の演出の名残で隠れない)');
      ({ context, page } = await newGame(browser, errors));
      await page.evaluate(() => window.__app.setMoney(1000));
      await goTab(page, 'Packs');
      await page.tap('#btnBuy');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
      await page.waitForTimeout(800);
      await tearSwipe(page, 0.85);
      await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 4000 });
      await page.evaluate(() => { window.__app.opening.close(); document.getElementById('btnBuy').click(); });
      await page.waitForTimeout(900);
      const vis = await page.evaluate(() => {
        const el = document.getElementById('opPack');
        return { hidden: el.hidden, op: getComputedStyle(el).opacity, tf: getComputedStyle(el).transform };
      });
      ok(!vis.hidden && vis.op === '1' && vis.tf === 'none', `新しいパックが見えている (hidden ${vis.hidden} / 濃さ ${vis.op} / ${vis.tf})`);
      await context.close();

    }

    // ------------------------------------------------ 買う
    if (want('買う')) {
      section('買う');
      ({ context, page } = await newGame(browser, errors));
      await goTab(page, 'Packs');
      await page.evaluate(() => window.__app.setMoney(499));
      ok(await page.locator('#btnBuy').isDisabled() && (await page.textContent('#btnBuyLabel')).includes('あと 1'), '499 コインでは買えず「あと 1 コイン」');
      await page.evaluate(() => window.__app.setMoney(1000));
      ok(await page.locator('#btnBuy').isEnabled(), '500 コインあれば買える');
      await page.tap('#btnBuy');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
      ok((await money(page)) === 500, '買うと 500 コイン減る');
      ok((await page.evaluate(() => window.__app.state().shop.animal.next)) === 1, 'BOX から 1 パック出る');
      await page.evaluate(() => window.__app.opening.skip());
      await page.waitForTimeout(1500);
      for (let i = 0; i < 8 && (await opState(page)).phase !== 'result'; i++) {
        const s = await opState(page);
        const sp = s.show.specials.find((x) => x.index === s.index);
        if (sp && !s.revealed.includes(s.index)) {
          if (sp.mode === 'tap') await tapTop(page); else await holdTop(page, 5200);
          await page.waitForTimeout(1600);
        }
        await tapTop(page);
        await page.waitForTimeout(400);
      }
      await page.waitForFunction(() => window.__app.opening.state().phase === 'result', null, { timeout: 8000 });
      await page.waitForTimeout(900);
      ok(await page.locator('#opAgain').isVisible(), 'まだ買える・むりょうがあるときは「もう1パック」');
      await page.tap('#opAgain');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
      ok(true, '「もう1パック」で、そのまま次のパック (むりょうから先に使う)');
      ok((await money(page)) === 500, `むりょうを使ったので、お金は減らない (${await money(page)})`);
      await context.close();
    }

    // ------------------------------------------------ BOX ごと買う
    if (want('BOX')) {
      section('BOX: まとめて買って、1 パックずつ開ける');
      ({ context, page } = await newGame(browser, errors));
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--safe-top', '59px');
        document.documentElement.style.setProperty('--safe-bottom', '34px');
      });
      await goTab(page, 'Packs');
      const price = await page.evaluate(() => window.__app.core.BOX_PRICE);
      await page.evaluate((p) => window.__app.setMoney(p - 1), price);
      ok(await page.locator('#btnBox').isDisabled(), `${price - 1} コインでは BOX を買えない (${await page.textContent('#btnBoxLabel')})`);
      await page.evaluate((p) => window.__app.setMoney(p), price);
      // BOX は大きいパックの台の下。縦に送れば、タブに隠れずに押せる
      await scrollToBtn(page, 'btnBox');
      const vis = await page.evaluate(() => {
        const b = document.getElementById('btnBox').getBoundingClientRect();
        const bar = document.getElementById('tabbar').getBoundingClientRect();
        const sc = document.getElementById('scPacks');
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { bottom: b.bottom, barTop: bar.top, hit: !!(hit && hit.closest('#btnBox')) };
      });
      ok(vis.bottom <= vis.barTop + 0.5 && vis.hit, `BOX のボタンは、縦に送るとタブに隠れずに押せる (下 ${Math.round(vis.bottom)} / タブ ${Math.round(vis.barTop)})`);
      await page.tap('#btnBox');
      const first = await page.evaluate(() => ({ money: window.__app.state().money, label: document.getElementById('btnBoxLabel').textContent }));
      ok(first.money === price && first.label.includes('ほんとうに'), `1 回目のタップは「ほんとうに かう？」だけで、まだ買わない (${first.label})`);
      await page.waitForTimeout(3300);
      ok(!(await page.textContent('#btnBoxLabel')).includes('ほんとうに'), '3 秒たつと元にもどる');
      await page.tap('#btnBox');
      await page.tap('#btnBox');
      await page.waitForTimeout(300);
      const bought = await page.evaluate(() => ({
        money: window.__app.state().money, hand: window.__app.core.packsInHand(window.__app.state()),
        shop: window.__app.state().shop.animal || null, text: document.getElementById('myBoxLeft').textContent,
        sr: document.getElementById('myBoxSr').textContent
      }));
      ok(bought.money === 0 && bought.hand === 30, `2 回タップで買える: コイン ${bought.money}・手もとに ${bought.hand} パック`);
      ok(bought.shop === null, 'BOX を買っても、お店の BOX (1 パックずつの方) は進まない');
      ok(bought.text.includes('30') && bought.sr.includes('まだ'), `手もとの BOX の様子が出る (${bought.text} / ${bought.sr})`);
      await scrollToBtn(page, 'btnOpenBox');
      const ob = await page.evaluate(() => {
        const b = document.getElementById('btnOpenBox').getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return b.bottom <= document.getElementById('tabbar').getBoundingClientRect().top + 0.5 && !!(hit && hit.closest('#btnOpenBox'));
      });
      ok(ob, '「BOX から あける」も、縦に送るとタブに隠れずに押せる');

      await page.evaluate(() => { window.__app.state().lastFreeDay = window.__app.core.dayKey(Date.now()); });
      await page.tap('#btnOpenBox');
      const end = await playThrough(page);
      ok(end.phase === 'result', 'BOX から 1 パック開けられる');
      const after = await page.evaluate(() => ({ hand: window.__app.core.packsInHand(window.__app.state()), money: window.__app.state().money }));
      ok(after.hand === 29 && after.money === 0, `開けると手もとが 1 パック減り、お金は減らない (のこり ${after.hand})`);
      ok((await page.textContent('#opAgainLabel')).includes('BOX から'), `「もう1パック」は BOX から (${await page.textContent('#opAgainLabel')})`);
      await page.tap('#opAgain');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
      ok((await page.evaluate(() => window.__app.core.packsInHand(window.__app.state()))) === 28, '「もう1パック」で BOX の次のパック');
      await page.evaluate(() => window.__app.opening.close());

      // SR 以上が出たあとは「もう でた」
      await page.evaluate(() => {
        const s = window.__app.state();
        const b = s.boxes[0];
        b.next = b.packs.findIndex((p) => window.__app.core.rank(p.top) >= window.__app.core.rank('SR')) + 1;
        window.__app.flush();
      });
      await goTab(page, 'Home');
      await goTab(page, 'Packs');
      ok((await page.textContent('#myBoxSr')).includes('もう でた'), `SR 以上を引いたあとは「もう でた」(${await page.textContent('#myBoxSr')})`);
      await page.reload();
      await page.waitForFunction(() => window.__app);
      ok((await page.evaluate(() => window.__app.state().boxes.length)) === 1, '開き直しても、手もとの BOX は残る');

      section('BOX: のこりを まとめて開けて、レアだけ演出で見せる');
      await goTab(page, 'Packs');
      const leftBefore = await page.evaluate(() => window.__app.core.packsInHand(window.__app.state()));
      ok((await page.textContent('#btnOpenAllLabel')).includes(String(leftBefore)), `ボタンに残りの数 (${await page.textContent('#btnOpenAllLabel')})`);
      await page.tap('#btnOpenAll');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'bulk');
      ok(await page.locator('#opBulk').isVisible(), 'パックが次々にやぶれる画面が出る');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 8000 });
      const bulk = await page.evaluate(() => {
        const st = window.__app.opening.state();
        const rk = (no) => window.__app.core.rank(window.__app.core.cardByNo(no).rarity);
        return {
          n: st.total, hand: window.__app.core.packsInHand(window.__app.state()),
          count: document.getElementById('obCount').textContent,
          backs: [...document.querySelectorAll('.slot')].every((x) => !x.querySelector('.c3-in').classList.contains('up')),
          allRare: st.cards.every((c) => rk(c.no) >= window.__app.core.rank('RR')),
          sorted: st.cards.every((c, i) => i === 0 || rk(c.no) >= rk(st.cards[i - 1].no))
        };
      });
      ok(bulk.count.startsWith(leftBefore + ' /'), `${leftBefore} パックぶん数えあげる (${bulk.count})`);
      ok(bulk.hand === 0, '手もとの BOX は空になる');
      ok(bulk.n > 0 && bulk.backs && bulk.allRare, `レア (RR 以上と AR) だけ ${bulk.n} まいが裏向きで並ぶ`);
      ok(bulk.sorted, '弱い順 (いちばん良いカードが最後)');
      for (let g = 0; g < 30; g++) {
        const st = await opState(page);
        if (st.phase === 'result') break;
        if (st.phase !== 'stack') { await page.waitForTimeout(250); continue; }
        const sp = st.show.specials.find((x) => x.index === st.index);
        if (sp && !st.revealed.includes(st.index)) {
          if (sp.mode === 'tap') await tapTop(page); else await holdTop(page, { SR: 2900, SAR: 4000, MUR: 5200 }[sp.rarity]);
          await page.waitForFunction((i) => window.__app.opening.state().revealed.includes(i), st.index, { timeout: 9000 });
          await page.waitForTimeout(1300);
        }
        await tapTop(page);
        await page.waitForTimeout(400);
      }
      await page.waitForFunction(() => window.__app.opening.state().phase === 'result', null, { timeout: 8000 });
      await page.waitForTimeout(900);
      const sum = await page.evaluate(() => ({
        title: document.getElementById('opResTitle').textContent,
        total: [...document.querySelectorAll('#opSum .sum-i')].reduce((a, e) => a + Number(e.textContent.split('×')[1]), 0),
        cells: document.querySelectorAll('.op-cell').length,
        inside: (() => { const g = document.getElementById('opGrid').getBoundingClientRect(); const a = document.getElementById('opClose').getBoundingClientRect(); return g.bottom <= a.top && a.bottom <= 932; })()
      }));
      ok(sum.title === leftBefore + 'パック あけた！' && sum.total === leftBefore * 5, `まとめ: 「${sum.title}」・合計 ${sum.total} まい`);
      ok(sum.cells >= bulk.n && sum.inside, `レアと はじめてのカードを並べ (${sum.cells} まい)、ボタンにかぶらない`);
      await page.tap('#opClose');
      ok(await page.locator('#myBox').isHidden(), '閉じると、手もとの BOX の欄は消える');
      await context.close();
    }

    // ------------------------------------------------ ミニゲーム
    if (want('ミニゲーム')) {
      section('ミニゲーム: どうぶつ めくり・おやつキャッチ (1 日 3 回ずつ・ゆびのちからぶんのコイン)');
      ({ context, page } = await newGame(browser, errors));
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--safe-top', '59px');
        document.documentElement.style.setProperty('--safe-bottom', '34px');
      });
      const tb = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const g = r('btnGames'), m = r('money'), u = r('btnMute');
        return { gR: g.right, gL: g.left, mL: m.left, mR: m.right, uL: u.left, w: g.width, badge: document.getElementById('gmBadge').textContent, bh: document.getElementById('gmBadge').hidden };
      });
      ok(tb.gR <= tb.mL && tb.mR <= tb.uL && tb.gL >= 0 && tb.w >= 44, `ひろばの左上に ミニゲームのボタン (コインの表示・音のボタンと重ならない)`);
      ok(tb.badge === '6' && !tb.bh, `ボタンの数字は きょうの のこり回数 (${tb.badge})`);
      await page.tap('#btnGames');
      const mn = await page.evaluate(() => ({ cards: document.querySelectorAll('.gm-card').length, txt: document.getElementById('gmList').textContent,
        inside: [...document.querySelectorAll('.gm-card, .gm-go')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= 430 && r.bottom <= 932 - 34; }) }));
      ok(mn.cards === 2 && /どうぶつ めくり/.test(mn.txt) && /おやつキャッチ/.test(mn.txt) && /さいだい 600 コイン/.test(mn.txt) && /あと 3 かい/.test(mn.txt) && mn.inside,
        'メニューに 2 つのゲーム・さいだいのコイン (600)・のこり 3 かい。画面の中に収まる');

      // --- どうぶつ めくり
      const memStart = async () => { await page.tap('.gm-go[data-game=memory]'); await page.waitForSelector('.mm-card'); };
      await memStart();
      const faces = await page.evaluate(() => [...document.querySelectorAll('.mm-card')].map((c) => c.dataset.ch));
      const cnt = {}; faces.forEach((f) => { cnt[f] = (cnt[f] || 0) + 1; });
      ok(faces.length === 8 && Object.keys(cnt).length === 4 && Object.values(cnt).every((n) => n === 2), 'めくり: 8 まい・同じ絵が 2 まいずつ (4 くみ)');
      // まちがい: ちがう 2 まいをめくる → ひとまず見える → あとで裏に戻る。回数は 1 ふえる
      const iA = 0, iB = faces.findIndex((f, i) => i > 0 && f !== faces[0]);
      await page.tap(`.mm-card[data-i="${iA}"]`);
      await page.tap(`.mm-card[data-i="${iB}"]`);
      ok(await page.evaluate(() => document.querySelectorAll('.mm-card.up').length) === 2 && (await page.textContent('#mmTurns')) === '1', 'ちがう 2 まいは めくれて、かいすうが 1 になる');
      await page.waitForFunction(() => document.querySelectorAll('.mm-card.up').length === 0, null, { timeout: 3000 });
      ok(true, 'ちがう 2 まいは あとで 裏にもどる');
      // 3 まいめを すばやく押しても 2 まいを こえない (戻る前の連打)
      await page.tap(`.mm-card[data-i="${iA}"]`);
      await page.tap(`.mm-card[data-i="${iB}"]`);
      await page.tap(`.mm-card[data-i="${faces.findIndex((f, i) => i !== iA && i !== iB)}"]`);
      ok(await page.evaluate(() => document.querySelectorAll('.mm-card.up').length) === 2, '戻るまでの あいだに 3 まいめを押しても めくれない');
      await page.waitForFunction(() => document.querySelectorAll('.mm-card.up').length === 0, null, { timeout: 3000 });
      // ぜんぶ そろえる (かいすう = 2 + 4 = 6 ではなく、ここから 4 くみを 1 回ずつ。まちがい 2 回ぶんが かいすうに入る)
      const m0 = await money(page);
      const pairs = {}; faces.forEach((f, i) => { (pairs[f] = pairs[f] || []).push(i); });
      for (const k of Object.keys(pairs)) { for (const i of pairs[k]) await page.tap(`.mm-card[data-i="${i}"]`); await page.waitForTimeout(80); }
      await page.waitForSelector('#gmResult:not([hidden])', { timeout: 4000 });
      const turns = Number(await page.textContent('#mmTurns'));
      const want1 = await page.evaluate((t) => window.__app.core.miniReward('memory', { turns: t }, 0), turns);
      ok((await money(page)) === m0 + want1 && turns === 6 && /^\+/.test(await page.textContent('#gmResCoins')), `めくり: ぜんぶ そろうと コインが入る (${turns} かい → +${want1})`);
      ok((await page.textContent('#gmAgainLabel')).includes('あと 2 かい') && await page.locator('#gmAgain').isEnabled(), '1 回あそぶと のこり 2 かい');
      // 完璧に (4 かい) そろえる = 600 コイン
      await page.tap('#gmAgain');
      await page.waitForSelector('.mm-card');
      const f2 = await page.evaluate(() => [...document.querySelectorAll('.mm-card')].map((c) => c.dataset.ch));
      const pr2 = {}; f2.forEach((f, i) => { (pr2[f] = pr2[f] || []).push(i); });
      const m1 = await money(page);
      for (const k of Object.keys(pr2)) { for (const i of pr2[k]) await page.tap(`.mm-card[data-i="${i}"]`); await page.waitForTimeout(80); }
      await page.waitForSelector('#gmResult:not([hidden])', { timeout: 4000 });
      ok((await money(page)) === m1 + 600, `めくり: 4 かいで ぜんぶ そろえると 600 コイン (ゆびのちから Lv.1 の 300 かいぶん)`);
      // 途中でやめた (✕) あそびは 1 回に数えない
      await page.tap('#gmAgain');
      await page.waitForSelector('.mm-card');
      await page.tap('.mm-card[data-i="0"]');
      await page.tap('#gmClose');
      ok(await page.evaluate(() => window.__app.core.miniLeft(window.__app.state(), 'memory', Date.now())) === 1 && !(await page.locator('#gmMenu').isHidden()), '途中で ✕ すると メニューにもどり、1 回に 数えない (のこり 1 かい)');

      // --- おやつキャッチ
      await page.evaluate(() => { window.__app.mini.opts.catchSeconds = 7; });
      await page.tap('.gm-go[data-game=catch]');
      await page.waitForSelector('.ct-player svg');
      // ゆびで うごかす: 画面の左はしへ → 右はしへ
      const fb = await box(page, '#ctField');
      await page.mouse.move(fb.x + 60, fb.y + 300); await page.mouse.down(); await page.mouse.move(fb.x + 70, fb.y + 300, { steps: 3 });
      const pxL = await page.evaluate(() => window.__app.mini.catchState().px);
      await page.mouse.move(fb.x + fb.width - 60, fb.y + 300, { steps: 6 });
      const pxR = await page.evaluate(() => window.__app.mini.catchState().px);
      await page.mouse.up();
      ok(pxL < 120 && pxR > fb.width - 120, `ゆびを ずらすと 遊ぶ子がついてくる (${Math.round(pxL)} → ${Math.round(pxR)})`);
      // 自動で 取りにいく (いちばん下の 良いおやつの下へ)。くりは よける
      const t0 = Date.now();
      let kinds = new Set(), maxItems = 0;
      while (Date.now() - t0 < 10000 && (await page.locator('#gmResult').isHidden())) {
        const s = await page.evaluate(() => {
          const s = window.__app.mini.catchState();
          const good = s.items.filter((i) => i.kind !== 'chestnut' && i.y > -10).sort((a, b) => b.y - a.y)[0];
          if (good) window.__app.mini.moveTo(good.x);
          return { kinds: s.items.map((i) => i.kind), n: s.items.length };
        });
        s.kinds.forEach((k) => kinds.add(k)); maxItems = Math.max(maxItems, s.n);
        await page.waitForTimeout(30);
      }
      await page.waitForSelector('#gmResult:not([hidden])', { timeout: 4000 });
      const sc = Number((await page.textContent('#gmResSub')).match(/\d+/)[0]);
      const cm = Number((await page.textContent('#gmResCoins')).replace(/[^0-9]/g, ''));
      ok(sc >= 3 && cm === (100 + Math.min(200, sc * 5)) * 2, `キャッチ: おやつを とって てんが入り、コインが 入る (${sc} てん → +${cm})`);
      ok(maxItems >= 2 && kinds.size >= 2, `おやつが つぎつぎ おちてくる (同時に ${maxItems} こ・${[...kinds].join('/')})`);
      ok(await page.evaluate(() => document.querySelectorAll('.ct-item').length) === 0, 'おわると 落ちていた おやつは 片づく');
      // ✕ は ひろばに もどる。ボタンの数字が へる
      await page.tap('#gmBack');
      await page.tap('#gmClose');
      ok(await page.locator('#games').isHidden() && (await page.textContent('#gmBadge')) === '3', 'ミニゲームを閉じると ひろばに もどる (数字は 3 = めくり 1 + キャッチ 2)');

      // --- 1 日 3 回まで・保存
      await page.evaluate(() => { const s = window.__app.state(); s.mini.plays = { memory: 3, catch: 3 }; window.__app.flush(); window.__app.mini.refresh(); });
      await page.tap('#btnGames');
      const lim = await page.evaluate(() => [...document.querySelectorAll('.gm-go')].map((b) => b.disabled + ':' + b.textContent));
      ok(lim.length === 2 && lim.every((t) => t.startsWith('true:') && t.includes('また あした')), `3 回あそぶと「また あした」で 押せない (${lim.join(' ')})`);
      ok(await page.locator('#gmBadge').isHidden(), 'のこり 0 のとき ボタンの数字は消える');
      await page.reload();
      await page.waitForFunction(() => window.__app);
      ok(await page.evaluate(() => window.__app.core.miniLeft(window.__app.state(), 'memory', Date.now()) === 0 && window.__app.core.miniLeft(window.__app.state(), 'catch', Date.now()) === 0), '開き直しても きょうの回数は のこる');
      await page.evaluate(() => { const s = window.__app.state(); s.mini.day = '2000-01-01'; window.__app.mini.refresh(); });
      ok((await page.textContent('#gmBadge')) === '6', '日が かわると また 3 かいずつ (6)');
      // ゆびのちからを上げると、ごほうびも増える
      await page.evaluate(() => { const s = window.__app.state(); s.tapLevel = 12; s.mini.day = ''; window.__app.mini.open(); });
      ok(/さいだい 6,000 コイン/.test(await page.textContent('#gmList')), 'ゆびのちから Lv.13 (20 コイン) では さいだい 6,000 コイン');
      // 遅い端末 (CPU 4 倍遅) でも おやつキャッチが なめらか (落ちてくる物が 同時に何こもある間)
      await page.evaluate(() => { const s = window.__app.state(); s.mini.day = ''; s.mini.plays = {}; window.__app.mini.opts.catchSeconds = 14; window.__app.mini.open(); });
      const cdpM = await context.newCDPSession(page);
      await cdpM.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.tap('.gm-go[data-game=catch]');
      await page.waitForTimeout(4500);
      const fm = await page.evaluate(async () => {
        const t = []; let last = performance.now(); const t0 = last;
        await new Promise((res) => { const loop = (now) => { t.push(now - last); last = now; if (now - t0 < 2500) requestAnimationFrame(loop); else res(); }; requestAnimationFrame(loop); });
        t.shift(); t.sort((a, c) => a - c);
        return { median: t[t.length >> 1], p90: t[Math.floor(t.length * 0.9)], items: document.querySelectorAll('.ct-item').length };
      });
      await cdpM.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      ok(fm.median <= 17.5 && fm.p90 <= 25, `おやつキャッチ (CPU 4 倍遅・おやつ ${fm.items} こ): 1 コマ ${fm.median.toFixed(1)}ms (90%点 ${fm.p90.toFixed(1)})`);
      await context.close();
    }

    // ------------------------------------------------ なかよし (歩いている子に おやつ)
    if (want('なかよし')) {
      section('なかよし: 歩いている子を タップ → おやつ・なでる');
      ({ context, page } = await newGame(browser, errors));
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--safe-top', '59px');
        document.documentElement.style.setProperty('--safe-bottom', '34px');
        const s = window.__app.state();
        ['A1-001', 'A1-003', 'A1-020', 'A1-011', 'S1-001', 'S1-002', 'G1-001', 'F1-001'].forEach((n) => { s.owned[n] = 1; });
        window.__app.setMoney(1000);
      });
      await goTab(page, 'Zukan');
      await goTab(page, 'Home');
      await page.waitForTimeout(300);
      ok(await page.locator('.wk-hint').isVisible(), 'まだ おやつを あげたことが無いときは、案内が出る');
      const field = await page.evaluate(() => {
        const g = document.getElementById('ground').getBoundingClientRect();
        const up = document.getElementById('upgrade').getBoundingClientRect();
        const ws = [...document.querySelectorAll('.walker')];
        // 歩く範囲ぜんぶ (left から left + dist まで) が草原の中か
        const inside = ws.every((w) => {
          const l = parseFloat(w.style.left), d = parseFloat(w.style.getPropertyValue('--dist'));
          return l >= 0 && l + d + w.offsetWidth <= g.width + 0.5;
        });
        const rs = ws.map((w) => w.getBoundingClientRect());
        return { n: ws.length, inside, bottom: Math.max(...rs.map((r) => r.bottom)), upTop: up.top, gTop: g.top, top: Math.min(...rs.map((r) => r.top)),
          tags: ws.map((w) => w.tagName) };
      });
      ok(field.n === 7 && field.tags.every((t) => t === 'BUTTON'), `持っている子が 7 人まで歩き、どの子も押せる (${field.n})`);
      ok(field.inside && field.bottom <= field.upTop + 0.5 && field.top >= field.gTop - 30, `歩く範囲が草原の中に収まる (下 ${Math.round(field.bottom)} / 強化の上 ${Math.round(field.upTop)})`);

      // 歩いている子を そのまま タップ (止まらない)
      // 7 人いると重なることがある。指の下でいちばん手前にいる子をタップする (指で押したときと同じ)
      const tapWalker = async (want) => {
        let hit = null;
        // 指の下で手前に出てくるまで待つ (重なっていても、歩いているうちに見える)
        for (let k = 0; k < 30 && !hit; k++) {
          if (k) await page.waitForTimeout(300);
          hit = await page.evaluate((w) => {
          for (const el of document.querySelectorAll('.walker')) {
            if (w && el.dataset.ch !== w) continue;
            const r = el.getBoundingClientRect();
            for (const [fx, fy] of [[0.5, 0.6], [0.35, 0.7], [0.65, 0.7], [0.5, 0.4]]) {
              const x = r.left + r.width * fx, y = r.top + r.height * fy;
              const top = document.elementFromPoint(x, y);
              if (top && top.closest('.walker') === el) return { ch: el.dataset.ch, x, y };
            }
          }
          return null;
          }, want || null);
        }
        await page.touchscreen.tap(hit.x, hit.y);
        return hit.ch;
      };
      const ch = await tapWalker();
      ok(await page.locator('#petSheet').isVisible(), `歩いている子をタップすると、おやつの画面が出る (${ch})`);
      const snackNames = await page.evaluate(() => [...document.querySelectorAll('#psSnacks .sn-name')].map((e) => e.textContent));
      const fav = await page.evaluate((c) => window.__app.core.CHARAS[c].foodName, ch);
      ok(snackNames[2] === fav, `3 つめは その子の だいこうぶつ (${snackNames.join('・')})`);
      await page.tap('[data-snack="cookie"]');
      await page.waitForTimeout(900);
      let st = await page.evaluate((c) => ({ money: window.__app.state().money, aff: window.__app.state().pets[c].aff, coin: document.getElementById('moneyNum').textContent }), ch);
      ok(st.money === 920 && st.aff === 3 && st.coin === '920', `クッキーで 80 コイン減り、なかよし度 +3 (${st.money} / ♥${st.aff})`);
      ok((await page.locator('.ps-heart').count()) > 0, 'ハートが出る');
      await page.tap('#psAnimal');
      await page.waitForTimeout(300);
      await page.tap('#psAnimal');
      await page.waitForTimeout(300);
      st = await page.evaluate((c) => ({ aff: window.__app.state().pets[c].aff, tip: document.getElementById('psTip').textContent }), ch);
      ok(st.aff === 4 && st.tip.includes('もう'), `なでるのは 1 日 1 回だけ ♥+1 (${st.aff} / ${st.tip})`);
      await page.tap('[data-snack="fav"]');
      await page.waitForTimeout(900);
      const lv = await page.evaluate(() => ({ shown: !document.getElementById('psLevelUp').hidden, text: document.getElementById('psLevelUp').textContent, lv: document.getElementById('psLv').textContent }));
      ok(lv.shown && lv.text.includes('Lv.2') && lv.lv.includes('Lv.2'), `レベルが上がると知らせが出る (${lv.text})`);
      await page.tap('[data-snack="apple"]');
      await page.waitForTimeout(700);
      const fullTummy = await page.evaluate(() => ({
        dis: [...document.querySelectorAll('#psSnacks button')].every((b) => b.disabled),
        txt: document.getElementById('psTummy').textContent
      }));
      ok(fullTummy.dis && fullTummy.txt.includes('いっぱい'), '3 こ食べると「おなか いっぱい」で、おやつボタンが押せない');
      await page.tap('#psClose');
      ok(await page.locator('#petSheet').isHidden(), '× で閉じる');
      const after = await page.evaluate((c) => {
        const w = document.querySelector('.walker[data-ch="' + c + '"]');
        return { badge: w && w.querySelector('.wk-lv') ? w.querySelector('.wk-lv').textContent : '', first: document.querySelector('.walker').dataset.ch,
          hint: !!document.querySelector('.wk-hint') };
      }, ch);
      ok(after.badge.includes('2') && !after.hint, `歩いている子に ♥ のレベルが付き、案内は消える (${after.badge})`);

      // ずかんからも おやつを あげられる (歩いていない子にも)
      await goTab(page, 'Zukan');
      await pickSet(page, 'zkPick', 'ghost');
      await page.tap('.zk-cell[data-no="G1-001"]');
      await page.waitForTimeout(150);
      await page.tap('.dt-feed');
      await page.waitForTimeout(200);
      const fromZk = await page.evaluate(() => ({ sheet: !document.getElementById('petSheet').hidden, detail: !document.getElementById('detail').hidden, name: document.getElementById('psName').textContent }));
      ok(fromZk.sheet && !fromZk.detail && fromZk.name === 'しろおばけ', `ずかんの「おやつを あげる」で、その子の おやつ画面が出る (${fromZk.name})`);
      await page.tap('#psClose');
      await goTab(page, 'Home');

      await page.waitForTimeout(1100);
      await page.reload();
      await page.waitForFunction(() => window.__app);
      const kept = await page.evaluate((c) => ({ aff: window.__app.state().pets[c].aff, favs: window.__app.state().favs }), ch);
      ok(kept.aff === 11 && kept.favs === undefined, `開き直しても なかよし度が残る (♥${kept.aff})`);
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
      await page.clock.setFixedTime(tomorrow);
      await page.waitForTimeout(500);
      await tapWalker(ch);
      ok(await page.locator('[data-snack="apple"]').isEnabled(), '次の日になると、また おやつを あげられる');
      await context.close();
    }

    // ------------------------------------------------ パックの種類
    if (want('しゅるい')) {
      section('しゅるい: パックの種類を えらんで、その種類のパックを開ける');
      ({ context, page } = await newGame(browser, errors));
      await goTab(page, 'Packs');
      const bar = await page.evaluate(() => {
        const r = document.getElementById('shopPack').getBoundingClientRect();
        return { w: r.width, h: r.height, name: document.getElementById('shopName').textContent, idx: document.getElementById('stageIndex').textContent };
      });
      ok(bar.w >= 230 && bar.h >= 330 && bar.name === 'どうぶつパック' && bar.idx === '1 / 11', `大きいパック (${Math.round(bar.w)}x${Math.round(bar.h)}) と名前・番号が出る (${bar.idx})`);
      await page.tap('#btnNext');
      ok((await page.textContent('#shopName')) === 'さかなパック', '▶ で つぎの パックへ');
      await page.tap('#btnPrev');
      await page.tap('#btnPrev');
      ok((await page.textContent('#stageIndex')) === '11 / 11', `◀ で まえへ。はじめの まえは さいご (${await page.textContent('#stageIndex')})`);
      await page.waitForTimeout(450);   // ◀ の すべりこみが 終わってから 位置を測る
      const pr = await box(page, '#shopPack');
      await page.mouse.move(pr.x + pr.width * 0.8, pr.y + pr.height / 2);
      await page.mouse.down();
      await page.mouse.move(pr.x + pr.width * 0.2, pr.y + pr.height / 2, { steps: 6 });
      await page.mouse.up();
      ok((await page.textContent('#stageIndex')) === '1 / 11', 'パックを 左へ はらうと つぎへ');
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--safe-top', '59px');
        document.documentElement.style.setProperty('--safe-bottom', '34px');
      });
      const t0 = Date.now();
      await page.tap('#setPick .sp-bar');
      await page.waitForSelector('#packSheet:not([hidden])');
      const sh = await page.evaluate(() => {
        const bs = [...document.querySelectorAll('#pshBody .sp-btn')];
        const panel = document.querySelector('.psh-panel').getBoundingClientRect();
        const body = document.getElementById('pshBody');
        return { n: bs.length, top: panel.top, bottom: panel.bottom,
          left: Math.min(...bs.map((b) => b.getBoundingClientRect().left)), right: Math.max(...bs.map((b) => b.getBoundingClientRect().right)),
          scroll: body.scrollHeight > body.clientHeight, wide: body.scrollWidth - body.clientWidth,
          on: bs.filter((b) => b.classList.contains('on')).map((b) => b.dataset.set) };
      });
      ok(sh.n === 11, `「いちらん」で 11 パックが並ぶ (${Date.now() - t0}ms で開いた)`);
      ok(sh.left >= 0 && sh.right <= 430 && sh.wide <= 0 && sh.top >= 59 && sh.bottom <= 932.5, `横には はみ出さず、画面の中に収まる (上 ${Math.round(sh.top)} / 下 ${Math.round(sh.bottom)})`);
      ok(sh.on.join() === 'animal', 'いま えらんでいる パックに印');
      await page.tap('#pshClose');
      for (const [id, word] of [['sea', 'さかな'], ['okashi', 'おかし'], ['tabemono', 'たべもの'], ['mahou', 'まほう']]) {
        await pickSet(page, 'setPick', id);
        const v = await page.evaluate(() => ({ name: document.getElementById('shopName').textContent, pack: document.querySelector('#shopPack .pk').className,
          bar: document.getElementById('stageIndex').textContent }));
        ok(v.name.includes(word) && v.pack.includes('pk-' + id) && v.bar.includes('/ 11'), `${word}: お店のパックと名前が変わる (${v.name})`);
      }
      // packs.js から作ったシリーズも開けられる
      await pickSet(page, 'setPick', 'okashi');
      await page.evaluate(() => window.__app.rigNextPack('RR', true, 'okashi'));
      await page.tap('#btnFree');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
      const cake = await page.evaluate(() => ({ pack: document.querySelector('#opPack .pk').className,
        sets: window.__app.opening.state().cards.map((c) => window.__app.core.cardByNo(c.no).set) }));
      ok(cake.pack.includes('pk-okashi') && cake.sets.every((x) => x === 'okashi'), `おかしパックを開けると、おかしパックのカードだけ (${cake.sets.length} まい)`);
      const endCake = await playThrough(page);
      ok(endCake.phase === 'result', 'おかしパック (packs.js から作ったシリーズ) も最後まで開けられる');
      await page.tap('#opClose');
      await page.evaluate(() => { const s = window.__app.state(); s.lastFreeDay = ''; s.owned = {}; s.shop = {}; window.__app.renderFree(); });
      await pickSet(page, 'setPick', 'sea');
      await page.evaluate(() => window.__app.rigNextPack('RR', false, 'sea'));
      await page.tap('#btnFree');
      await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
      const op = await page.evaluate(() => ({
        pack: document.querySelector('#opPack .pk').className,
        sets: window.__app.opening.state().cards.map((c) => window.__app.core.CARDS.find((k) => k.no === c.no).set),
        top: window.__app.core.CARDS.find((k) => k.no === window.__app.opening.state().cards[4].no).rarity
      }));
      ok(op.pack.includes('pk-sea') && op.sets.every((x) => x === 'sea') && op.top === 'RR', `さかなパックを開けると、さかなのカードだけ出る (${op.sets.join(',')})`);
      const end = await playThrough(page);
      ok(end.phase === 'result', 'さかなパックも最後まで開けられる');
      await page.waitForTimeout(500);
      const got = await page.evaluate(() => Object.keys(window.__app.state().owned));
      ok(got.length > 0 && got.every((k) => k.startsWith('S1-')), `図鑑に さかなのカードが入る (${got.join(',')})`);
      const shops = await page.evaluate(() => ({ sea: window.__app.state().shop.sea.next, animal: window.__app.state().shop.animal }));
      ok(shops.sea === 1 && !shops.animal, 'お店の BOX は種類ごとに別 (さかなだけ進む)');
      await context.close();
    }

    // ------------------------------------------------ ずかん
    if (want('ずかん')) {
      section('ずかん');
      ({ context, page } = await newGame(browser, errors));
      await page.evaluate(() => {
        const s = window.__app.state();
        s.owned['A1-001'] = 2; s.owned['A1-021'] = 1; s.owned['A1-033'] = 1; s.owned['S1-001'] = 1;
      });
      await goTab(page, 'Zukan');
      const zk = await page.evaluate(() => {
        const cells = [...document.querySelectorAll('.zk-cell')];
        const locked = cells.filter((c) => c.disabled);
        const names = window.__app.core.CARDS.map((c) => c.name);
        const lockedText = locked.map((c) => c.textContent).join('');
        return {
          n: cells.length, locked: locked.length, count: document.getElementById('zkCount').textContent,
          sub: document.getElementById('zkSub').textContent, leaked: names.filter((n) => lockedText.includes(n))
        };
      });
      ok(zk.n === 34 && zk.locked === 31, `34 まいの枠、もっていない 31 まいは押せない (${zk.locked})`);
      ok(zk.count === '3 / 34' && zk.sub.includes('ふつう 1/20') && zk.sub.includes('シークレット 2/14'), `数の表示 (${zk.count} ${zk.sub})`);
      ok(zk.leaked.length === 0, 'もっていないカードの名前は出ない');
      await pickSet(page, 'zkPick', 'sea');
      const sea = await page.evaluate(() => ({
        n: document.querySelectorAll('.zk-cell').length, count: document.getElementById('zkCount').textContent,
        title: document.getElementById('zkTitle').textContent, first: document.querySelector('.zk-cell').dataset.no
      }));
      ok(sea.n === 34 && sea.count === '1 / 34' && sea.title.includes('さかな') && sea.first === 'S1-001', `パックの種類を えらぶと、その図鑑に変わる (${sea.title} ${sea.count})`);
      await pickSet(page, 'zkPick', 'animal');
      // どのカードも、名前がカードの中に収まる (ずかんの小さい表示と、大きい表示の両方。6 しゅるい全部)
      const names = await page.evaluate(() => {
        const out = [];
        for (const [small, w] of [[true, 125], [false, 300]]) {
          const host = document.createElement('div');
          host.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;';
          document.body.appendChild(host);
          for (const c of window.__app.core.CARDS) {
            host.innerHTML = window.CardView.html(c, { small });
            const pc = host.querySelector('.pc').getBoundingClientRect();
            const nm = host.querySelector('.pc-name');
            const r = nm.getBoundingClientRect();
            const fs = parseFloat(getComputedStyle(nm).fontSize);
            if (r.left < pc.left - 0.5 || r.right > pc.right + 0.5 || fs < w * 0.05) out.push(c.no + (small ? ' 小' : ' 大') + ' ' + fs.toFixed(1) + 'px');
          }
          host.remove();
        }
        return { bad: out, n: window.__app.core.CARDS.length };
      });
      ok(names.bad.length === 0, `${names.n} まい × 2 の大きさで、名前がカードからはみ出さず、字が小さすぎない (${names.bad.join(', ') || 'OK'})`);
      await page.tap('.zk-cell[data-no="A1-033"]');
      ok(await page.locator('#detail').isVisible(), 'もっているカードを押すと大きく出る');
      const before = await page.evaluate(() => getComputedStyle(document.querySelector('.dt-card')).getPropertyValue('--mx'));
      await page.waitForTimeout(800);
      const after = await page.evaluate(() => getComputedStyle(document.querySelector('.dt-card')).getPropertyValue('--mx'));
      ok(before !== after, `さわらなくても、キラがゆっくり動く (--mx ${before} → ${after})`);
      const dc = await box(page, '.dt-card');
      // 指を置いたまま右上へすべらせる (かたむいて指の下からカードが逃げても、離すまで追う)
      await page.mouse.move(dc.x + dc.width * 0.6, dc.y + dc.height * 0.4);
      await page.mouse.down();
      await page.mouse.move(dc.x + dc.width * 0.95, dc.y + dc.height * 0.05, { steps: 6 });
      await page.waitForTimeout(700);
      const tl = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector('.dt-card'));
        return { ry: parseFloat(cs.getPropertyValue('--ry')), rx: parseFloat(cs.getPropertyValue('--rx')), mx: parseFloat(cs.getPropertyValue('--mx')) };
      });
      await page.mouse.up();
      ok(tl.ry > 8 && tl.rx > 8 && tl.mx > 80, `指の方へ かたむき、光も指の方へ (右上: rotateY ${tl.ry.toFixed(1)}° rotateX ${tl.rx.toFixed(1)}° 光 ${tl.mx.toFixed(0)})`);
      await page.mouse.click(dc.x + dc.width / 2, dc.y + dc.height / 2);
      ok(await page.locator('#detail').isVisible(), 'カードをさわっても閉じない');
      await page.mouse.click(20, 900);
      ok(await page.locator('#detail').isHidden(), 'そとを押すと閉じる');
      await context.close();
    }

    // ------------------------------------------------ 保存データ
    if (want('保存')) {
      section('保存: 前の版の記録を引き継ぐ・こわれていても開ける');
      const ctx = await browser.newContext({ ...PHONE });
      await ctx.addInitScript(() => {
        if (!localStorage.getItem('animalPacks:v2')) {
          localStorage.setItem('animalPacks:v1', JSON.stringify({ v: 1, money: 345, tapLevel: 2, owned: { neko: 2, dragon: 1 }, lastFreeDay: '2000-01-01' }));
        }
      });
      const pg = await ctx.newPage();
      pg.on('pageerror', (e) => errors.push(e.message));
      await pg.goto(URL);
      await pg.waitForFunction(() => window.__app);
      const st = await pg.evaluate(() => window.__app.state());
      ok(st.money === 345 && st.tapLevel === 2 && st.owned['A1-001'] === 2 && st.owned['A1-020'] === 1, `前の版のコイン・強さ・図鑑が残る (${JSON.stringify(st.owned)})`);
      await pg.evaluate(() => window.__app.flush());
      await pg.reload();
      await pg.waitForFunction(() => window.__app);
      ok((await pg.evaluate(() => window.__app.state().owned['A1-001'])) === 2, '新しい形で保存し直し、開き直しても残る');
      await ctx.close();
      for (const bad of ['{"money":"abc","owned":{"001":-3,"ぬ":9},"box":{"packs":[1]}}', 'これはJSONじゃない', '[]', 'null']) {
        const c2 = await browser.newContext({ ...PHONE });
        await c2.addInitScript((v) => { try { localStorage.setItem('animalPacks:v2', v); } catch (e) { /* */ } }, bad);
        const p2 = await c2.newPage();
        const errs = [];
        p2.on('pageerror', (e) => errs.push(e.message));
        await p2.goto(URL);
        await p2.waitForFunction(() => window.__app);
        ok(errs.length === 0 && Number.isFinite(await p2.evaluate(() => window.__app.state().money)), `開ける: ${bad.slice(0, 26)}`);
        await c2.close();
      }
    }

    // ------------------------------------------------ 歩く
    if (want('歩く')) {
      section('歩く: ひろばと、カードの中の動物');
      ({ context, page } = await newGame(browser, errors));
      await page.evaluate(() => { const s = window.__app.state(); ['A1-001', 'A1-019', 'A1-033', 'A1-011'].forEach((n) => { s.owned[n] = 1; }); });
      await goTab(page, 'Zukan');
      await goTab(page, 'Home');
      await page.waitForTimeout(300);
      ok((await page.locator('.walker').count()) === 4, `持っているキャラが草原を歩く (同じキャラは 1 ぴき: ${await page.locator('.walker').count()})`);
      const feet = await measureMotion(page, '.walker .footL', 1500);
      ok(feet.dy >= 1.5, `足が上がる (${feet.dy.toFixed(1)}px)`);
      const stroll = await measureMotion(page, '.walker', 3000);
      ok(stroll.dx >= 6, `横に歩く (3 秒で ${stroll.dx.toFixed(0)}px)`);
      await context.close();
    }

    // ------------------------------------------------ 効果音
    if (want('音')) {
      section('音: どの効果音も、割れず・小さすぎず・最後は静かに終わる (OfflineAudioContext で描き出して測る)');
      ({ context, page } = await newGame(browser, errors));
      const levels = await page.evaluate(async () => {
        const out = {};
        for (const n of window.Fx.Sfx.names) out[n] = await window.Fx.Sfx.measure(n, 4);
        return out;
      });
      for (const [n, v] of Object.entries(levels)) {
        ok(v.peak >= 0.05 && v.peak <= 1 && v.tail < 0.01, `${n}: いちばん大きい所 ${v.peak.toFixed(2)} / 終わり ${v.tail.toFixed(4)}`);
      }
      await context.close();
    }

    // ------------------------------------------------ 遅い端末
    if (want('遅い')) {
      section('遅い端末 (CPU 4 倍遅): いちばん重い演出の最中も なめらか');
      ({ context, page } = await newGame(browser, errors));
      const cdp = await context.newCDPSession(page);
      const frames = (ms) => page.evaluate(async (ms) => {
        const t = [];
        let last = performance.now();
        const t0 = last;
        await new Promise((res) => {
          const loop = (now) => { t.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(loop); else res(); };
          requestAnimationFrame(loop);
        });
        t.shift();
        t.sort((a, b) => a - b);
        return { median: t[Math.floor(t.length / 2)], p90: t[Math.floor(t.length * 0.9)], n: t.length };
      }, ms);
      for (const top of ['SAR', 'MUR', 'LR']) {
        await page.evaluate(([t]) => { window.__app.setMoney(500); window.__app.rigNextPack(t, true); }, [top]);
        await goTab(page, 'Packs');
        await page.tap('#btnBuy');
        await page.waitForFunction(() => window.__app.opening.state().phase === 'pack');
        await page.waitForTimeout(800);
        await tearSwipe(page, 0.85);
        await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 4000 });
        await page.tap('#opSkip');
        await page.waitForTimeout(400);
        await tapTop(page);   // AR
        await page.waitForTimeout(1600);
        await tapTop(page);
        await page.waitForTimeout(500);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        const b = await box(page, '#opStack');
        await page.mouse.move(b.x + 135, b.y + 190);
        await page.mouse.down();
        const charging = await frames(1500);
        await page.waitForFunction(() => window.__app.opening.state().phase === 'reveal', null, { timeout: 12000 });
        await page.mouse.up();
        let cosmos = null;
        if (top === 'LR') {
          await page.waitForFunction(() => document.getElementById('open').dataset.bg === 'cosmos', null, { timeout: 16000 });
          cosmos = await frames(1500);   // 宇宙へ ぬけて 星が すいこまれる ところ
        }
        await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 20000 });
        const reveal = await frames(2000);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        ok(charging.median <= 20, `${top} ためている最中: 1 コマ ${charging.median.toFixed(1)}ms (90%点 ${charging.p90.toFixed(1)})`);
        if (cosmos) ok(cosmos.median <= 20, `LR 宇宙へ ぬける ところ: 1 コマ ${cosmos.median.toFixed(1)}ms (90%点 ${cosmos.p90.toFixed(1)})`);
        ok(reveal.median <= 20, `${top} 出た直後 (紙ふぶき・キラ): 1 コマ ${reveal.median.toFixed(1)}ms (90%点 ${reveal.p90.toFixed(1)})`);
        await page.evaluate(() => window.__app.opening.close());
      }
      await context.close();
    }

    section('エラー');
    ok(errors.length === 0, errors.length ? '画面のエラー: ' + errors.join(' / ') : 'JS エラーなし');
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(`\n${passed} 件合格 / ${failed} 件失敗`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
