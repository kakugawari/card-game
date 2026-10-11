const test = require('node:test');
const assert = require('node:assert');
const Core = require('./core.js');
const Animals = require('./animals.js');

const NOON = new Date(2026, 9, 11, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

function richState(money) {
  const s = Core.newState();
  s.money = money;
  return s;
}

// ------------------------------------------------------------ データ
test('動物: id が重ならず、レア度は 4 種のどれかで、どのレア度にも 1 匹はいる', () => {
  const ids = new Set(Core.ANIMALS.map((a) => a.id));
  assert.strictEqual(ids.size, Core.ANIMALS.length);
  Core.ANIMALS.forEach((a) => assert.ok(Core.RARITIES[a.rarity], `${a.id} のレア度`));
  Core.RARITY_ORDER.forEach((r) => assert.ok(Core.ANIMALS.some((a) => a.rarity === r), `${r} がいない`));
});

test('動物: 図鑑の番号は 1 から順に並ぶ', () => {
  Core.ANIMALS.forEach((a, i) => assert.strictEqual(a.no, i + 1));
});

test('絵: 動物すべてに絵があり、絵だけ余ってもいない', () => {
  const core = Core.ANIMALS.map((a) => a.id).sort();
  assert.deepStrictEqual(Animals.ids.slice().sort(), core);
  core.forEach((id) => {
    const svg = Animals.svg(id);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), id);
    assert.ok(svg.includes('class="footL"') && svg.includes('class="footR"'), `${id}: 歩く足がある`);
  });
});

test('絵: 影絵 (locked) と止まった絵 (walk:false) は歩きの印が付かない', () => {
  assert.ok(Animals.svg('neko').includes('animal walk'));
  assert.ok(!Animals.svg('neko', { walk: false }).includes('walk'));
  assert.ok(!Animals.svg('neko', { locked: true }).includes('walk'));
});

// ------------------------------------------------------------ 日付と毎日のパック
test('毎日: はじめは開けられる / 開けたあと同じ日はもう開けられない', () => {
  const s = Core.newState();
  assert.ok(Core.canOpenFree(s, NOON));
  const r = Core.openPack(s, 'free', NOON, Core.mulberry32(1));
  assert.ok(r.ok);
  assert.ok(!Core.canOpenFree(s, NOON));
  assert.ok(!Core.canOpenFree(s, NOON + 5 * 3600 * 1000));
});

test('毎日: 2 回目は失敗し、図鑑も回数も変わらない', () => {
  const s = Core.newState();
  Core.openPack(s, 'free', NOON, Core.mulberry32(1));
  const before = JSON.stringify(s);
  const r = Core.openPack(s, 'free', NOON + 1000, Core.mulberry32(2));
  assert.deepStrictEqual(r, { ok: false, reason: 'already' });
  assert.strictEqual(JSON.stringify(s), before);
});

test('毎日: 日付がかわる瞬間 (23:59 → 0:00) にまた開けられる', () => {
  const s = Core.newState();
  const late = new Date(2026, 9, 11, 23, 59, 0).getTime();
  Core.openPack(s, 'free', late, Core.mulberry32(1));
  assert.ok(!Core.canOpenFree(s, late + 30 * 1000));
  assert.ok(Core.canOpenFree(s, new Date(2026, 9, 12, 0, 0, 0).getTime()));
});

test('毎日: 月・年をまたいでも、日が変われば開けられる', () => {
  const s = Core.newState();
  const t = new Date(2026, 11, 31, 20, 0, 0).getTime();
  Core.openPack(s, 'free', t, Core.mulberry32(1));
  assert.ok(Core.canOpenFree(s, new Date(2027, 0, 1, 0, 0, 1).getTime()));
});

test('毎日: むりょうパックはお金が 0 でも開けられ、お金は減らない', () => {
  const s = richState(0);
  assert.ok(Core.openPack(s, 'free', NOON, Core.mulberry32(3)).ok);
  assert.strictEqual(s.money, 0);
});

test('日付: 次の日まで残り時間は 0 より大きく 1 日以下', () => {
  for (const h of [0, 1, 12, 23]) {
    const ms = Core.msUntilNextDay(new Date(2026, 9, 11, h, 30).getTime());
    assert.ok(ms > 0 && ms <= DAY, `${h}時: ${ms}`);
  }
  assert.strictEqual(Core.msUntilNextDay(new Date(2026, 9, 11, 23, 59, 0).getTime()), 60 * 1000);
});

test('日付: 待ち時間の表示 (切り上げ・最低 1 ふん)', () => {
  assert.strictEqual(Core.formatWait(3 * 3600 * 1000 + 12 * 60 * 1000), 'あと3じかん12ふん');
  assert.strictEqual(Core.formatWait(59 * 60 * 1000), 'あと59ふん');
  assert.strictEqual(Core.formatWait(10), 'あと1ふん');
});

// ------------------------------------------------------------ 買う
test('買う: お金が足りなければ失敗し、何も変わらない', () => {
  const s = richState(99);
  const before = JSON.stringify(s);
  assert.deepStrictEqual(Core.openPack(s, 'normal', NOON, Core.mulberry32(1)), { ok: false, reason: 'money' });
  assert.strictEqual(JSON.stringify(s), before);
});

test('買う: ちょうどのお金で買えて、値段ぶん減り、5 まい増える', () => {
  const s = richState(Core.PACKS.normal.price);
  const r = Core.openPack(s, 'normal', NOON, Core.mulberry32(5));
  assert.ok(r.ok);
  assert.strictEqual(s.money, 0);
  assert.strictEqual(r.cards.length, 5);
  const total = Object.values(s.owned).reduce((a, b) => a + b, 0);
  assert.strictEqual(total, 5);
  assert.strictEqual(s.packsOpened, 1);
});

test('買う: むりょうパックを開けたあとでも、買うパックは開けられる (別枠)', () => {
  const s = richState(10000);
  assert.ok(Core.openPack(s, 'free', NOON, Core.mulberry32(1)).ok);
  assert.ok(Core.openPack(s, 'normal', NOON, Core.mulberry32(2)).ok);
  assert.ok(Core.openPack(s, 'special', NOON, Core.mulberry32(3)).ok);
  assert.strictEqual(s.money, 10000 - Core.PACKS.normal.price - Core.PACKS.special.price);
});

test('買う: 知らない種類のパックは失敗する', () => {
  assert.strictEqual(Core.openPack(richState(1e6), 'gold', NOON).ok, false);
});

test('NEW: はじめて出た 1 まいめだけ NEW。同じパックの 2 まいめ以降と、持っているものは NEW でない', () => {
  const s = richState(1e6);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const r = Core.openPack(s, 'normal', NOON, Core.mulberry32(i));
    r.cards.forEach((c) => {
      assert.strictEqual(c.isNew, !seen.has(c.id), `pack ${i} ${c.id}`);
      seen.add(c.id);
    });
  }
  assert.strictEqual(Core.collectedCount(s), seen.size);
});

// ------------------------------------------------------------ 出やすさ
function rarityShare(kind, packs, seed) {
  const rng = Core.mulberry32(seed);
  const main = { C: 0, R: 0, SR: 0, UR: 0 };
  const last = { C: 0, R: 0, SR: 0, UR: 0 };
  let noRare = 0;
  for (let i = 0; i < packs; i++) {
    const ids = Core.rollPack(kind, rng);
    assert.strictEqual(ids.length, 5);
    let rare = false;
    ids.forEach((id, k) => {
      const r = Core.animalById(id).rarity;
      (k === 4 ? last : main)[r]++;
      if (r !== 'C') rare = true;
    });
    if (!rare) noRare++;
  }
  return { main, last, noRare };
}

test('出やすさ: ふつうパック — 1〜4 まいめの割合が設定に近い', () => {
  const N = 20000;
  const { main } = rarityShare('normal', N, 11);
  const n = N * 4;
  const w = Core.ODDS.normal.main;
  Core.RARITY_ORDER.forEach((r) => {
    const want = w[r] / 100;
    const got = main[r] / n;
    assert.ok(Math.abs(got - want) < 0.01, `${r}: 期待 ${want} / 実際 ${got.toFixed(4)}`);
  });
});

test('出やすさ: 最後の 1 まいはコモンが出ない (どのパックでも)', () => {
  ['free', 'normal', 'special'].forEach((k) => {
    const { last } = rarityShare(k, 5000, 21);
    assert.strictEqual(last.C, 0, k);
    assert.ok(last.R > 0 && last.SR > 0, `${k}: レア以上は出る`);
  });
});

test('出やすさ: スペシャルは、ふつうよりレアが出やすい', () => {
  const a = rarityShare('normal', 10000, 31);
  const b = rarityShare('special', 10000, 31);
  assert.ok(b.main.SR + b.main.UR > (a.main.SR + a.main.UR) * 2);
  assert.ok(b.main.C < a.main.C);
});

test('出やすさ: 同じレア度の中では、どの動物も同じくらい出る', () => {
  const rng = Core.mulberry32(41);
  const count = {};
  for (let i = 0; i < 40000; i++) Core.rollPack('special', rng).forEach((id) => { count[id] = (count[id] || 0) + 1; });
  Core.RARITY_ORDER.forEach((r) => {
    const group = Core.ANIMALS.filter((a) => a.rarity === r).map((a) => count[a.id] || 0);
    const mean = group.reduce((x, y) => x + y, 0) / group.length;
    group.forEach((n) => assert.ok(Math.abs(n - mean) / mean < 0.12, `${r}: ${group}`));
  });
});

test('出やすさ: 同じ乱数なら同じパックが出る', () => {
  assert.deepStrictEqual(Core.rollPack('normal', Core.mulberry32(9)), Core.rollPack('normal', Core.mulberry32(9)));
});

// ------------------------------------------------------------ タップで稼ぐ
test('タップ: 1 かいで「ゆびのちから」ぶん増える', () => {
  const s = Core.newState();
  assert.strictEqual(Core.tap(s), 1);
  assert.strictEqual(s.money, 1);
  s.tapLevel = 4;
  assert.strictEqual(Core.tap(s), 5);
  assert.strictEqual(s.money, 6);
  assert.strictEqual(s.totalTaps, 2);
});

test('強化: お金が足りなければ変わらず、足りれば値段ぶん減ってレベルが上がる', () => {
  const s = richState(Core.upgradeCost(0) - 1);
  assert.strictEqual(Core.buyUpgrade(s), false);
  assert.strictEqual(s.tapLevel, 0);
  s.money = Core.upgradeCost(0);
  assert.strictEqual(Core.buyUpgrade(s), true);
  assert.strictEqual(s.tapLevel, 1);
  assert.strictEqual(s.money, 0);
});

test('強化: 値段はレベルとともに上がり続け、MAX では買えない', () => {
  for (let l = 1; l < Core.MAX_LEVEL; l++) assert.ok(Core.upgradeCost(l) > Core.upgradeCost(l - 1));
  assert.strictEqual(Core.upgradeCost(Core.MAX_LEVEL), null);
  const s = richState(1e12);
  s.tapLevel = Core.MAX_LEVEL;
  assert.strictEqual(Core.buyUpgrade(s), false);
  assert.strictEqual(s.money, 1e12);
});

test('バランス: はじめの 1 パック (300 コイン) は、5 タップ/秒で 2 分以内にためられる', () => {
  // 強化は買えるようになったらすぐ買う子を想定
  let taps = 0;
  const s = Core.newState();
  while (s.money < Core.PACKS.normal.price) {
    Core.tap(s);
    taps++;
    Core.buyUpgrade(s);
  }
  assert.ok(taps / 5 <= 120, `${taps / 5} 秒`);
  assert.ok(taps / 5 >= 20, `早すぎる: ${taps / 5} 秒`);
});

/** 毎日 tapsPerDay 回タップする子が、図鑑 20 種をそろえるまでの日数を、何人ぶんか自動で遊んで測る */
function daysToComplete(tapsPerDay, kids) {
  const days = [];
  for (let seed = 1; seed <= kids; seed++) {
    const rng = Core.mulberry32(seed * 1000);
    const s = Core.newState();
    let day = 0;
    while (Core.collectedCount(s) < Core.ANIMALS.length && day < 600) {
      const now = NOON + day * DAY;
      if (Core.canOpenFree(s, now)) Core.openPack(s, 'free', now, rng);
      for (let t = 0; t < tapsPerDay; t++) {
        Core.tap(s);
        const cost = Core.upgradeCost(s.tapLevel);
        if (cost !== null && cost < (tapsPerDay / 2) * Core.tapPower(s) && s.money >= cost) Core.buyUpgrade(s);
      }
      for (;;) {
        if (s.money >= Core.PACKS.special.price) Core.openPack(s, 'special', now, rng);
        else if (s.money >= Core.PACKS.normal.price) Core.openPack(s, 'normal', now, rng);
        else break;
      }
      day++;
    }
    days.push(day);
  }
  return days.sort((a, b) => a - b);
}

test('バランス: 毎日 1 分 (300 タップ) 遊ぶ子は、図鑑がそろうまで 1〜3 週間 (中央値)', () => {
  const d = daysToComplete(300, 40);
  const median = d[20];
  assert.ok(median >= 7 && median <= 21, `中央値 ${median} 日 (${d.join(',')})`);
});

test('バランス: 毎日 20 秒 (100 タップ) だけでも、全員 4 か月以内にそろう / 毎日 3 分でも 2 日ではそろわない', () => {
  const light = daysToComplete(100, 40);
  assert.ok(light[light.length - 1] <= 120, `20秒: ${light.join(',')}`);
  const heavy = daysToComplete(900, 40);
  assert.ok(heavy[0] >= 2, `3分: ${heavy.join(',')}`);
});

// ------------------------------------------------------------ 保存データ
test('保存: こわれたデータでも落ちず、まともな値に直る', () => {
  [null, undefined, 5, 'x', [], { money: -5 }, { money: 'abc' }, { owned: { neko: -1, nope: 3, inu: 2.9 } },
    { tapLevel: 999 }, { lastFreeDay: 'きのう' }, { money: Infinity }].forEach((raw) => {
    const s = Core.normalize(raw);
    assert.ok(Number.isFinite(s.money) && s.money >= 0);
    assert.ok(s.tapLevel >= 0 && s.tapLevel <= Core.MAX_LEVEL);
    Object.keys(s.owned).forEach((id) => assert.ok(Core.animalById(id) && s.owned[id] > 0));
    assert.ok(s.lastFreeDay === '' || /^\d{4}-\d{2}-\d{2}$/.test(s.lastFreeDay));
  });
  assert.deepStrictEqual(Core.normalize({ owned: { neko: -1, nope: 3, inu: 2.9 } }).owned, { inu: 2 });
});

test('保存: 書き出して読み直しても同じ', () => {
  const s = richState(1e6);
  Core.openPack(s, 'free', NOON, Core.mulberry32(1));
  Core.openPack(s, 'special', NOON, Core.mulberry32(2));
  s.tapLevel = 3;
  assert.deepStrictEqual(Core.normalize(JSON.parse(JSON.stringify(s))), s);
});

test('表示: コイン数は 3 けたごとにカンマ', () => {
  assert.strictEqual(Core.formatMoney(0), '0');
  assert.strictEqual(Core.formatMoney(999), '999');
  assert.strictEqual(Core.formatMoney(1234), '1,234');
  assert.strictEqual(Core.formatMoney(1234567), '1,234,567');
});
