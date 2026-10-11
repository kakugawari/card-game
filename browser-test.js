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
  const context = await browser.newContext({ ...PHONE, ...(opts || {}) });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
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
        const rec = await holdTop(page, { SR: 2900, SAR: 4000, MUR: 5200 }[sp.rarity]);
        if (log) log.push({ rarity: sp.rarity, rec });
      }
      await page.waitForFunction((i) => window.__app.opening.state().revealed.includes(i), s.index, { timeout: 9000 });
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
      for (const tab of ['Home', 'Packs', 'Zukan']) {
        await goTab(page, tab);
        await page.waitForTimeout(100);
        const r = await page.evaluate((t) => {
          const bar = document.getElementById('tabbar').getBoundingClientRect();
          const scr = document.getElementById('sc' + t);
          const inner = [...scr.querySelectorAll(t === 'Zukan' ? '.zk-head' : t === 'Packs' ? '.btn, .shop-pack' : '.btn, .upgrade, .tree-btn')];
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
      ok((await money(page)) === 10 && (await page.textContent('#moneyNum')) === '10', '10 回タップで 10 コイン');
      await page.evaluate(() => {
        const t = document.getElementById('tree');
        for (let i = 0; i < 30; i++) t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 200, clientY: 300, pointerId: 1 + (i % 2) }));
      });
      ok((await money(page)) === 40, `連打 30 回も 1 回も取りこぼさない (${await money(page)})`);
      const cost = await page.evaluate(() => window.__app.core.upgradeCost(0));
      await page.evaluate((c) => window.__app.setMoney(c - 1), cost);
      ok(await page.locator('#btnUp').isDisabled(), `強化: ${cost - 1} コインでは押せない`);
      await page.evaluate((c) => window.__app.setMoney(c), cost);
      await page.tap('#btnUp');
      await page.tap('#tree', { position: { x: 100, y: 100 } });
      ok((await money(page)) === 2, '強化すると 1 回で 2 コイン');
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
      for (const [top, ar] of [['RR', false], ['R', true], ['SR', false], ['SAR', true], ['MUR', false]]) {
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
        const end = await playThrough(page, log);
        ok(end.phase === 'result' && end.revealed.length === show.specials.length, `最後まで進んで、特別なカードを全部めくった (${end.revealed.length})`);
        for (const { rarity, rec } of log) {
          const colors = [];
          rec.forEach((x) => { if (x.aura && colors[colors.length - 1] !== x.aura) colors.push(x.aura); });
          const ladder = ['white', 'blue', 'gold', 'rainbow', 'mega'];
          const up = colors.every((c, i) => i === 0 || ladder.indexOf(c) > ladder.indexOf(colors[i - 1]));
          const want = { SR: ['white', 'blue', 'gold'], SAR: ['white', 'blue', 'gold', 'rainbow'], MUR: ['white', 'blue', 'gold', 'rainbow'] }[rarity];
          ok(up && JSON.stringify(colors) === JSON.stringify(want), `${rarity}: 押している間に光が ${colors.join(' → ')} と上がる (下がらない)`);
          if (rarity === 'MUR') {
            const black = Math.max(...rec.map((x) => x.black));
            ok(black >= 0.85, `MUR: 虹のあと まっ暗になる (幕の濃さ ${black.toFixed(2)})`);
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
      ok((await page.evaluate(() => window.__app.state().box.next)) === 1, 'BOX から 1 パック出る');
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

    // ------------------------------------------------ ずかん
    if (want('ずかん')) {
      section('ずかん');
      ({ context, page } = await newGame(browser, errors));
      await page.evaluate(() => {
        const s = window.__app.state();
        s.owned['001'] = 2; s.owned['021'] = 1; s.owned['033'] = 1;
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
      ok(zk.n === 33 && zk.locked === 30, `33 まいの枠、もっていない 30 まいは押せない (${zk.locked})`);
      ok(zk.count === '3 / 33' && zk.sub.includes('ふつう 1/20') && zk.sub.includes('シークレット 2/13'), `数の表示 (${zk.count} ${zk.sub})`);
      ok(zk.leaked.length === 0, 'もっていないカードの名前は出ない');
      await page.tap('.zk-cell[data-no="033"]');
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
      ok(st.money === 345 && st.tapLevel === 2 && st.owned['001'] === 2 && st.owned['020'] === 1, `前の版のコイン・強さ・図鑑が残る (${JSON.stringify(st.owned)})`);
      await pg.evaluate(() => window.__app.flush());
      await pg.reload();
      await pg.waitForFunction(() => window.__app);
      ok((await pg.evaluate(() => window.__app.state().owned['001'])) === 2, '新しい形で保存し直し、開き直しても残る');
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
      await page.evaluate(() => { const s = window.__app.state(); ['001', '019', '033', '011'].forEach((n) => { s.owned[n] = 1; }); });
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
      for (const top of ['SAR', 'MUR']) {
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
        await page.waitForFunction(() => window.__app.opening.state().phase === 'stack', null, { timeout: 8000 });
        const reveal = await frames(2000);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        ok(charging.median <= 20, `${top} ためている最中: 1 コマ ${charging.median.toFixed(1)}ms (90%点 ${charging.p90.toFixed(1)})`);
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
