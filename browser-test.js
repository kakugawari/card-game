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

/** パックを開けて、全部めくって、閉じる。出たカードの id を返す */
async function openAndFlipAll(page, openSelector) {
  await page.tap(openSelector);
  await page.waitForSelector('#rvPack', { state: 'visible' });
  await page.waitForTimeout(300);
  await page.tap('#rvPack');
  await page.waitForSelector('.rv-card');
  await page.waitForTimeout(700);
  const cards = await page.evaluate(() => window.__app.session().cards.map((c) => c.id));
  await page.tap('#btnFlipAll');
  await page.waitForSelector('#btnClose', { state: 'visible' });
  await page.waitForTimeout(700);
  return cards;
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

  try {
    // ------------------------------------------------ 開く
    section('開く');
    let { context, page } = await newGame(browser, errors);
    ok(true, 'ページが開いて、画面のしくみが立ち上がる');
    const fit = await page.evaluate(() => ({
      wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      title: document.title,
      tabs: [...document.querySelectorAll('.tab')].map((t) => t.textContent.trim())
    }));
    ok(fit.wide <= 0, `横スクロールが出ない (${fit.wide})`);
    ok(fit.tabs.length === 3, `下のタブが 3 つ (${fit.tabs.join(' / ')})`);

    // ------------------------------------------------ 安全域 (実機は上 59・下 34。ここでは 0 なので差し込んで測る)
    section('安全域を差し込んで、画面に収まる');
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
        const inner = [...scr.querySelectorAll(t === 'Zukan' ? '.zk-head' : '.btn, .upgrade, .shop-item, .tree-btn')];
        const worst = inner.reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
        const right = inner.reduce((m, e) => Math.max(m, e.getBoundingClientRect().right), 0);
        const topbar = document.getElementById('topbar').getBoundingClientRect();
        return {
          barBottom: bar.bottom, barTop: bar.top, worst, right, topbarTop: topbar.top,
          wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      }, tab);
      ok(r.barBottom <= 932 + 0.5, `${tab}: 下のタブが画面の下に収まる (${r.barBottom})`);
      ok(r.worst <= r.barTop + 0.5, `${tab}: ボタンが下のタブにかぶらない (${Math.round(r.worst)} <= ${Math.round(r.barTop)})`);
      ok(r.right <= 430 + 0.5 && r.wide <= 0, `${tab}: 右にはみ出さない`);
      ok(r.topbarTop >= 59, `${tab}: コインの帯が上の安全域より下 (${r.topbarTop})`);
    }
    await goTab(page, 'Home');

    // ------------------------------------------------ タップで稼ぐ
    section('タップでコインが増える');
    ok((await money(page)) === 0, 'はじめは 0 コイン');
    for (let i = 0; i < 10; i++) await page.tap('#tree', { position: { x: 80 + i * 12, y: 90 } });
    ok((await money(page)) === 10, `10 回タップで 10 コイン (${await money(page)})`);
    ok((await page.textContent('#moneyNum')) === '10', '上のコイン表示も 10');
    ok((await page.locator('.pop').count()) > 0, 'タップした所に +1 が浮かぶ');

    // 速く連打しても、1 回も取りこぼさない (指 2 本ぶんの同時押しも)
    await page.evaluate(() => {
      const t = document.getElementById('tree');
      for (let i = 0; i < 30; i++) {
        t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 200, clientY: 300, pointerId: 1 + (i % 2) }));
      }
    });
    ok((await money(page)) === 40, `連打 30 回ぶんも数える (${await money(page)})`);

    // 見張り: タップのたびに歩く動物を作り直さない (作り直すと重くなり、歩きもとぶ)
    await page.evaluate(() => {
      window.__app.state().owned.neko = 1;
      window.__app.state().owned.inu = 1;
    });
    await goTab(page, 'Zukan');
    await goTab(page, 'Home');
    await page.evaluate(() => { document.querySelector('.walker').dataset.mark = 'same'; });
    for (let i = 0; i < 5; i++) await page.tap('#tree', { position: { x: 100, y: 100 } });
    ok(await page.evaluate(() => document.querySelector('.walker').dataset.mark === 'same'),
      'タップしても歩く動物の要素は作り直されない');

    section('ゆびのちからを強くする');
    await page.evaluate(() => window.__app.setMoney(39));
    ok(await page.locator('#btnUp').isDisabled(), '39 コインでは押せない');
    await page.evaluate(() => window.__app.setMoney(40));
    ok(await page.locator('#btnUp').isEnabled(), '40 コインで押せる');
    await page.tap('#btnUp');
    const up = await page.evaluate(() => ({ lv: window.__app.state().tapLevel, m: window.__app.state().money, t: document.getElementById('upLv').textContent }));
    ok(up.lv === 1 && up.m === 0 && up.t === 'Lv.2', `強くなり、40 コイン減る (${JSON.stringify(up)})`);
    await page.tap('#tree', { position: { x: 100, y: 100 } });
    ok((await money(page)) === 2, '強くしたあとは 1 回で 2 コイン');
    ok(await page.locator('#btnUp').isDisabled(), '足りなくなったらまた押せない');

    // ------------------------------------------------ 保存
    section('保存');
    for (let i = 0; i < 3; i++) await page.tap('#tree', { position: { x: 100, y: 100 } });
    await page.waitForTimeout(1200);   // まとめ書きを待つ
    const before = await page.evaluate(() => JSON.stringify(window.__app.state()));
    await page.reload();
    await page.waitForFunction(() => window.__app);
    const after = await page.evaluate(() => JSON.stringify(window.__app.state()));
    ok(before === after, '開き直しても、コイン・強さ・図鑑が残る');
    await context.close();

    // ------------------------------------------------ 毎日のパック
    section('毎日のパック');
    ({ context, page } = await newGame(browser, errors));
    ok(await page.locator('#packDot').isVisible(), 'まだ開けていない日は、パックのタブに赤い点');
    await goTab(page, 'Packs');
    ok(await page.locator('#btnFree').isEnabled(), 'むりょうパックが押せる (お金 0 でも)');
    const cards = await openAndFlipAll(page, '#btnFree');
    ok(cards.length === 5, '5 まい出る');
    const shown = await page.evaluate(() => [...document.querySelectorAll('.rv-card')].map((c) => {
      const b = c.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { name: c.querySelector('.c-name').textContent, front: !!(hit && hit.closest('.rv-face.front')), inside: b.left >= 0 && b.right <= 430 };
    }));
    const names = await page.evaluate((ids) => ids.map((id) => window.__app.core.animalById(id).name), cards);
    ok(shown.every((s) => s.front), '全部めくると、全部おもて面が見えている');
    ok(shown.every((s) => s.inside), 'カードが画面の外にはみ出さない');
    ok(JSON.stringify(shown.map((s) => s.name)) === JSON.stringify(names), `出たカードの名前が画面に出ている (${names.join(',')})`);
    ok(await page.locator('#btnClose').isVisible(), 'めくり終わると「とじる」が出る');
    await page.tap('#btnClose');
    ok(await page.locator('#reveal').isHidden(), '閉じられる');
    ok(await page.locator('#btnFree').isDisabled(), '開けたあとは押せない');
    ok((await page.textContent('#btnFreeLabel')).includes('また あした'), `「また あした」と出る (${await page.textContent('#btnFreeLabel')})`);
    ok(await page.locator('#packDot').isHidden(), '赤い点も消える');

    section('日付が変わると、また開けられる');
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 5, 0);
    await page.clock.setFixedTime(tomorrow);
    await page.evaluate(() => window.__app.renderFree());
    ok(await page.locator('#btnFree').isEnabled(), '次の日になったら押せる');
    ok(await page.locator('#packDot').isVisible(), '赤い点がまた出る');
    const cards2 = await openAndFlipAll(page, '#btnFree');
    await page.tap('#btnClose');
    ok(cards2.length === 5, '次の日のパックも 5 まい');
    const total = await page.evaluate(() => Object.values(window.__app.state().owned).reduce((a, b) => a + b, 0));
    ok(total === 10, `図鑑のまい数が 5 + 5 = 10 (${total})`);

    section('パックを開けている途中で閉じても、もらったカードは残る');
    const day3 = new Date(tomorrow); day3.setDate(day3.getDate() + 1);
    await page.clock.setFixedTime(day3);
    await page.evaluate(() => window.__app.renderFree());
    await page.tap('#btnFree');
    await page.waitForSelector('#rvPack', { state: 'visible' });
    const sortedOwned = () => JSON.stringify(Object.entries(window.__app.state().owned).sort());
    const mid = await page.evaluate(sortedOwned);
    await page.reload();
    await page.waitForFunction(() => window.__app);
    const restored = await page.evaluate(sortedOwned);
    ok(mid === restored, '開けた直後に開き直しても、図鑑に入っている');
    await context.close();

    // ------------------------------------------------ 買う
    section('パックを買う');
    ({ context, page } = await newGame(browser, errors));
    await goTab(page, 'Packs');
    await page.evaluate(() => window.__app.setMoney(299));
    const n1 = await page.evaluate(() => {
      const b = document.querySelector('[data-buy=normal]');
      return { dis: b.disabled, txt: b.textContent.trim() };
    });
    ok(n1.dis && n1.txt === 'あと1コイン', `299 コインでは買えず、「あと1コイン」(${n1.txt})`);
    await page.evaluate(() => window.__app.setMoney(300));
    ok(await page.locator('[data-buy=normal]').isEnabled(), '300 コインで買える');
    ok(await page.locator('[data-buy=special]').isDisabled(), 'スペシャルはまだ買えない');
    const bought = await openAndFlipAll(page, '[data-buy=normal]');
    await page.tap('#btnClose');
    ok(bought.length === 5 && (await money(page)) === 0, `買うと 300 コイン減って 5 まい出る (残り ${await money(page)})`);
    ok(await page.locator('#btnFree').isEnabled(), 'むりょうパックは、買ったあとも別に開けられる');
    await page.evaluate(() => window.__app.setMoney(2000));
    ok(await page.locator('[data-buy=special]').isEnabled(), '2000 コインでスペシャルが買える');
    await openAndFlipAll(page, '[data-buy=special]');
    await page.tap('#btnClose');
    ok((await money(page)) === 0, 'スペシャルで 2000 コイン減る');

    // ------------------------------------------------ ずかん
    section('ずかん');
    await goTab(page, 'Zukan');
    const zk = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.zk-cell')];
      const owned = window.__app.core.collectedCount(window.__app.state());
      const lockedText = cells.filter((c) => c.disabled).map((c) => c.textContent).join('');
      const names = window.__app.core.ANIMALS.map((a) => a.name);
      return {
        n: cells.length, locked: cells.filter((c) => c.disabled).length, owned,
        count: document.getElementById('zkCount').textContent,
        leaked: names.filter((n) => lockedText.includes(n)),
        wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    ok(zk.n === 20, `20 ひきぶんの枠 (${zk.n})`);
    ok(zk.locked === 20 - zk.owned, `見つけていない子は押せない (${zk.locked} / 見つけた ${zk.owned})`);
    ok(zk.count === `${zk.owned} / 20`, `「${zk.count}」と出る`);
    ok(zk.leaked.length === 0, '見つけていない子の名前は出ない (？？？)');
    await page.tap('.zk-cell:not([disabled])');
    ok(await page.locator('#detail').isVisible(), 'もっている子を押すと大きく出る');
    const dt = await page.evaluate(() => {
      const b = document.querySelector('#dtBox .card').getBoundingClientRect();
      return { l: b.left, r: b.right, t: b.top, bt: b.bottom };
    });
    ok(dt.l >= 0 && dt.r <= 430 && dt.t >= 0 && dt.bt <= 932, '大きいカードが画面に収まる');
    await page.tap('#detail');
    ok(await page.locator('#detail').isHidden(), 'どこかを押すと閉じる');

    // ------------------------------------------------ 歩く
    section('動物が歩いている');
    await goTab(page, 'Home');
    await page.waitForTimeout(300);
    const feet = await measureMotion(page, '.walker .footL', 1500);
    ok(feet.dy >= 1.5, `足が上がっている (上下に ${feet.dy.toFixed(1)}px)`);
    const body = await measureMotion(page, '.walker .bob', 1500);
    ok(body.dy >= 0.4, `1 歩ごとに体がはずむ (${body.dy.toFixed(1)}px)`);
    const stroll = await measureMotion(page, '.walker', 3000);
    ok(stroll.dx >= 6, `草原を横に歩いている (3 秒で ${stroll.dx.toFixed(0)}px)`);
    const inField = await page.evaluate(() => {
      const g = document.getElementById('ground').getBoundingClientRect();
      return [...document.querySelectorAll('.walker')].every((w) => {
        const b = w.getBoundingClientRect();
        return b.left >= g.left - 2 && b.right <= g.right + 2 && b.top >= g.top - 20;
      });
    });
    ok(inField, '歩く動物が草原からはみ出さない');
    await goTab(page, 'Zukan');
    const zkWalk = await measureMotion(page, '.zk-cell:not([disabled]) .footL', 1500);
    ok(zkWalk.dy >= 1, `ずかんの中でも歩いている (${zkWalk.dy.toFixed(1)}px)`);
    await context.close();

    // ------------------------------------------------ 古い保存データ・こわれた保存データ
    section('保存データがこわれていても開ける');
    for (const bad of ['{"money":"abc","owned":{"neko":-3,"ぬ":9}}', 'これはJSONじゃない', '[]', 'null']) {
      const ctx = await browser.newContext({ ...PHONE });
      await ctx.addInitScript((v) => { try { localStorage.setItem('animalPacks:v1', v); } catch (e) { /* */ } }, bad);
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', (e) => errs.push(e.message));
      await pg.goto(URL);
      await pg.waitForFunction(() => window.__app);
      const m = await pg.evaluate(() => window.__app.state().money);
      ok(errs.length === 0 && Number.isFinite(m), `開ける: ${bad.slice(0, 24)}`);
      await ctx.close();
    }

    // ------------------------------------------------ 遅い端末 (CPU 4 倍遅)
    section('遅い端末でもなめらか (CPU 4 倍遅)');
    ({ context, page } = await newGame(browser, errors));
    await page.evaluate(() => {
      const s = window.__app.state();
      ['lion', 'unicorn', 'dragon', 'panda', 'neko', 'kuma', 'kaeru'].forEach((id) => { s.owned[id] = 1; });
    });
    await goTab(page, 'Zukan');
    await goTab(page, 'Home');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.waitForTimeout(500);
    const frame = (label, act) => page.evaluate(async ({ act }) => {
      // eslint-disable-next-line no-new-func
      const run = new Function('return (async () => {' + act + '})()');
      const times = [];
      let last = performance.now();
      let stop = false;
      const loop = () => { const n = performance.now(); times.push(n - last); last = n; if (!stop) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      await run();
      stop = true;
      await new Promise((r) => requestAnimationFrame(r));
      times.shift();
      times.sort((a, b) => a - b);
      return { median: times[Math.floor(times.length / 2)], p90: times[Math.floor(times.length * 0.9)], n: times.length };
    }, { act });
    const idle = await frame('ひろば', 'await new Promise(r => setTimeout(r, 2500));');
    ok(idle.median <= 25, `ひろばで 6 ひき歩いている: 1 コマ ${idle.median.toFixed(1)}ms (90%点 ${idle.p90.toFixed(1)}ms, ${idle.n} コマ)`);
    const tapping = await frame('連打', `
      const t = document.getElementById('tree');
      for (let i = 0; i < 40; i++) {
        t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 150 + i * 3, clientY: 250, pointerId: 1 }));
        await new Promise(r => setTimeout(r, 40));
      }`);
    ok(tapping.median <= 30, `連打中: 1 コマ ${tapping.median.toFixed(1)}ms (90%点 ${tapping.p90.toFixed(1)}ms)`);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await context.close();

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
