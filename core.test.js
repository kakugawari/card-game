const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Core = require('./core.js');
const Cards = require('./cards.js');
const Animals = require('./animals.js');

const NOON = new Date(2026, 9, 11, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;
const rarityOf = (no) => Core.cardByNo(no).rarity;

function richState(money) {
  const s = Core.newState();
  s.money = money;
  return s;
}

// ------------------------------------------------------------ カードの一覧
test('一覧: 番号は 001 から順に、重ならずに並ぶ', () => {
  Core.CARDS.forEach((c, i) => assert.strictEqual(c.no, String(i + 1).padStart(3, '0')));
});

test('一覧: 001〜020 は C/U/R/RR、021 以降 (シークレット) は AR 以上', () => {
  Core.CARDS.forEach((c) => {
    const main = Number(c.no) <= Core.SET.mainCount;
    assert.strictEqual(main, Core.rank(c.rarity) <= Core.rank('RR'), `${c.no} ${c.rarity}`);
  });
});

test('一覧: どのレア度にも 1 まい以上ある (パックから出せないレア度がない)', () => {
  Core.RARITY_ORDER.forEach((r) => assert.ok(Core.POOL[r].length > 0, r));
  assert.ok(Core.POOL.C.length >= 3, 'C は 1 パックに 3 まい、重ならずに選べる');
});

test('一覧: 名前・分類・説明が全部ある。仮の絵は全部のキャラにある', () => {
  Core.CARDS.forEach((c) => {
    assert.ok(c.name && c.kind && c.text, c.no);
    assert.ok(Animals.ids.includes(c.chara), `${c.no}: ${c.chara} の仮の絵`);
    assert.strictEqual(typeof c.art, 'string');
  });
});

test('一覧: 手で書いた表に、同じ番号が 2 回書かれていない (あとの方だけ残る事故よけ)', () => {
  const src = fs.readFileSync(require.resolve('./cards.js'), 'utf8');
  const nos = [...src.matchAll(/no: '(\d{3})'/g)].map((m) => m[1]);
  assert.strictEqual(new Set(nos).size, nos.length);
  assert.strictEqual(nos.length, Cards.CARDS.length);
});

test('番号の表示はポケモンカードと同じ数え方 (021/020)', () => {
  assert.strictEqual(Core.numberLabel(Core.cardByNo('001')), '001/020');
  assert.strictEqual(Core.numberLabel(Core.cardByNo('033')), '033/020');
});

// ------------------------------------------------------------ BOX の封入
test('BOX: 30 パックに、SR 以上が 1・RR が 4・R が 25・AR が 3 (BOX 確定)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const box = Core.newBox(Core.mulberry32(seed));
    assert.strictEqual(box.packs.length, 30);
    const tops = {};
    box.packs.forEach((p) => { tops[p.top] = (tops[p.top] || 0) + 1; });
    assert.strictEqual(tops.RR, 4);
    assert.strictEqual(tops.R, 25);
    assert.strictEqual((tops.SR || 0) + (tops.SAR || 0) + (tops.MUR || 0), 1);
    assert.strictEqual(box.packs.filter((p) => p.ar).length, 3);
  }
});

test('BOX: SR 以上の 1 まいは、SAR が約 5 BOX に 1、MUR が約 50 BOX に 1', () => {
  const N = 50000;
  const rng = Core.mulberry32(77);
  const n = { SR: 0, SAR: 0, MUR: 0 };
  for (let i = 0; i < N; i++) n[Core.newBox(rng).packs.find((p) => p.top !== 'R' && p.top !== 'RR').top]++;
  assert.ok(Math.abs(n.SAR / N - 0.2) < 0.01, `SAR ${n.SAR / N}`);
  assert.ok(Math.abs(n.MUR / N - 0.02) < 0.003, `MUR ${n.MUR / N}`);
});

test('パック: 5 まいで、1〜3 まいめ C・4 まいめ U か AR・5 まいめ R 以上。中で同じカードは出ない', () => {
  const rng = Core.mulberry32(5);
  for (let i = 0; i < 2000; i++) {
    const box = Core.newBox(rng);
    box.packs.forEach((slot) => {
      const nos = Core.rollPack(slot, rng);
      assert.strictEqual(nos.length, 5);
      assert.deepStrictEqual(nos.slice(0, 3).map(rarityOf), ['C', 'C', 'C']);
      assert.strictEqual(rarityOf(nos[3]), slot.ar ? 'AR' : 'U');
      assert.strictEqual(rarityOf(nos[4]), slot.top);
      assert.strictEqual(new Set(nos).size, 5);
    });
  }
});

test('パック: 同じレア度の中では、どのカードも同じくらい出る', () => {
  const rng = Core.mulberry32(41);
  const count = {};
  for (let b = 0; b < 3000; b++) {
    Core.newBox(rng).packs.forEach((slot) => Core.rollPack(slot, rng).forEach((no) => { count[no] = (count[no] || 0) + 1; }));
  }
  ['C', 'U', 'R', 'RR', 'AR'].forEach((r) => {
    const g = Core.POOL[r].map((c) => count[c.no] || 0);
    const mean = g.reduce((a, b) => a + b, 0) / g.length;
    g.forEach((v) => assert.ok(Math.abs(v - mean) / mean < 0.08, `${r}: ${g}`));
  });
});

test('開封: BOX を使い切ると次の BOX になり、30 パックごとに必ず SR 以上が 1 まい出る', () => {
  const s = richState(1e9);
  const rng = Core.mulberry32(3);
  for (let box = 0; box < 20; box++) {
    let srUp = 0;
    for (let i = 0; i < 30; i++) {
      const r = Core.openPack(s, 'buy', NOON, rng);
      assert.strictEqual(r.boxLeft, 29 - i);
      srUp += r.cards.filter((c) => Core.rank(rarityOf(c.no)) >= Core.rank('SR')).length;
    }
    assert.strictEqual(srUp, 1, `BOX ${box}`);
  }
});

test('開封: むりょうパックも同じ BOX から出る (別の BOX にしない)', () => {
  const s = richState(1e9);
  const rng = Core.mulberry32(9);
  Core.openPack(s, 'buy', NOON, rng);
  Core.openPack(s, 'free', NOON, rng);
  assert.strictEqual(s.box.next, 2);
});

// ------------------------------------------------------------ 演出の計画
const ORDER = ['none', 'shake', 'rainbow', 'gold'];

test('演出: いちばん上のレア度 (tier) は、パックの中のいちばん上 (R 未満は R)', () => {
  const rng = Core.mulberry32(1);
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'R'], rng).tier, 'R');
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'AR', 'R'], rng).tier, 'AR');
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'AR', 'SR'], rng).tier, 'SR');
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'MUR'], rng).tier, 'MUR');
});

test('演出: 光の色は、本当のレア度より上に絶対に上がらない (がっかりさせない)', () => {
  const rng = Core.mulberry32(2);
  const tops = ['R', 'RR', 'SR', 'SAR', 'MUR'];
  for (let i = 0; i < 20000; i++) {
    const r = ['C', 'C', 'C', rng() < 0.1 ? 'AR' : 'U', tops[Math.floor(rng() * tops.length)]];
    const sh = Core.makeShow(r, rng);
    const tierLadder = Core.LADDER.indexOf(Core.RARITIES[sh.tier].color);
    assert.ok(Core.LADDER.indexOf(sh.tearLight) <= tierLadder, `あける光 ${sh.tearLight} / ${sh.tier}`);
    if (sh.omen === 'rainbow') assert.ok(Core.rank(sh.tier) >= Core.rank('SAR'), `虹の予兆は SAR 以上だけ (${sh.tier})`);
    if (sh.omen === 'gold') assert.strictEqual(sh.tier, 'MUR', '金の予兆は MUR だけ');
    sh.specials.forEach((sp) => {
      const top = Core.LADDER.indexOf(Core.RARITIES[sp.rarity].color);
      sp.stages.forEach((c) => assert.ok(Core.LADDER.indexOf(c) <= top));
      assert.strictEqual(sp.stages[sp.stages.length - 1], Core.RARITIES[sp.rarity].color, '最後は本当の色');
      for (let k = 1; k < sp.stages.length; k++) {
        assert.ok(Core.LADDER.indexOf(sp.stages[k]) > Core.LADDER.indexOf(sp.stages[k - 1]), '色は上がるだけ');
      }
    });
  }
});

test('演出: 虹と MUR は、あけた時の光ではまだ見せない (長押しまで取っておく)', () => {
  const rng = Core.mulberry32(3);
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'SAR'], rng).tearLight, 'gold');
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'MUR'], rng).tearLight, 'gold');
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'RR'], rng).tearLight, 'blue');
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'R'], rng).tearLight, 'white');
});

test('演出: RR・AR はタップでめくる / SR 以上は長押し。段は SR 2・SAR 3・MUR 4', () => {
  const rng = Core.mulberry32(4);
  const sh = Core.makeShow(['C', 'C', 'C', 'AR', 'MUR'], rng);
  assert.deepStrictEqual(sh.specials.map((s) => [s.index, s.mode, s.stages.length]), [[3, 'tap', 1], [4, 'hold', 4]]);
  assert.deepStrictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'SR'], rng).specials[0].stages, ['blue', 'gold']);
  assert.deepStrictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'SAR'], rng).specials[0].stages, ['blue', 'gold', 'rainbow']);
  assert.deepStrictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'R'], rng).specials, []);
});

test('演出: 予兆の出かた (揺れは外れのこともある / 虹・金は当たり確定)', () => {
  const rate = (r, omen) => {
    const rng = Core.mulberry32(11);
    let n = 0;
    for (let i = 0; i < 20000; i++) if (Core.makeShow(['C', 'C', 'C', 'U', r], rng).omen === omen) n++;
    return n / 20000;
  };
  assert.ok(Math.abs(rate('R', 'shake') - 0.03) < 0.006, 'R でも 3% 揺れる');
  assert.ok(Math.abs(rate('SR', 'shake') - 0.5) < 0.02);
  assert.ok(Math.abs(rate('SAR', 'rainbow') - 0.6) < 0.02);
  assert.ok(Math.abs(rate('MUR', 'gold') - 0.7) < 0.02);
  assert.ok(ORDER.includes(Core.makeShow(['C', 'C', 'C', 'U', 'R'], Math.random).omen));
});

// ------------------------------------------------------------ 日付と毎日のパック
test('毎日: はじめは開けられる / 開けたあと同じ日はもう開けられない', () => {
  const s = Core.newState();
  assert.ok(Core.canOpenFree(s, NOON));
  assert.ok(Core.openPack(s, 'free', NOON, Core.mulberry32(1)).ok);
  assert.ok(!Core.canOpenFree(s, NOON));
  assert.ok(!Core.canOpenFree(s, NOON + 5 * 3600 * 1000));
});

test('毎日: 2 回目は失敗し、何も変わらない (BOX も進まない)', () => {
  const s = Core.newState();
  Core.openPack(s, 'free', NOON, Core.mulberry32(1));
  const before = JSON.stringify(s);
  assert.deepStrictEqual(Core.openPack(s, 'free', NOON + 1000, Core.mulberry32(2)), { ok: false, reason: 'already' });
  assert.strictEqual(JSON.stringify(s), before);
});

test('毎日: 日付がかわる瞬間 (23:59 → 0:00)・年をまたいでも、また開けられる', () => {
  const s = Core.newState();
  const late = new Date(2026, 11, 31, 23, 59, 0).getTime();
  Core.openPack(s, 'free', late, Core.mulberry32(1));
  assert.ok(!Core.canOpenFree(s, late + 30 * 1000));
  assert.ok(Core.canOpenFree(s, new Date(2027, 0, 1, 0, 0, 0).getTime()));
});

test('毎日: むりょうパックはお金が 0 でも開けられ、お金は減らない', () => {
  const s = richState(0);
  assert.ok(Core.openPack(s, 'free', NOON, Core.mulberry32(3)).ok);
  assert.strictEqual(s.money, 0);
});

test('日付: 次の日まで残り時間と、その表示', () => {
  assert.strictEqual(Core.msUntilNextDay(new Date(2026, 9, 11, 23, 59, 0).getTime()), 60 * 1000);
  assert.strictEqual(Core.formatWait(3 * 3600 * 1000 + 12 * 60 * 1000), 'あと3じかん12ふん');
  assert.strictEqual(Core.formatWait(10), 'あと1ふん');
});

// ------------------------------------------------------------ 買う
test('買う: お金が足りなければ失敗し、何も変わらない', () => {
  const s = richState(Core.PACK_PRICE - 1);
  const before = JSON.stringify(s);
  assert.deepStrictEqual(Core.openPack(s, 'buy', NOON, Core.mulberry32(1)), { ok: false, reason: 'money' });
  assert.strictEqual(JSON.stringify(s), before);
});

test('買う: ちょうどのお金で買えて、値段ぶん減り、5 まい増える。むりょうとは別枠', () => {
  const s = richState(Core.PACK_PRICE);
  assert.ok(Core.openPack(s, 'free', NOON, Core.mulberry32(5)).ok);
  assert.ok(Core.openPack(s, 'buy', NOON, Core.mulberry32(6)).ok);
  assert.strictEqual(s.money, 0);
  assert.strictEqual(Object.values(s.owned).reduce((a, b) => a + b, 0), 10);
  assert.strictEqual(Core.openPack(s, 'gold', NOON).ok, false);
});

test('NEW: はじめて出たカードだけ NEW', () => {
  const s = richState(1e9);
  const seen = new Set();
  const rng = Core.mulberry32(8);
  for (let i = 0; i < 200; i++) {
    Core.openPack(s, 'buy', NOON, rng).cards.forEach((c) => {
      assert.strictEqual(c.isNew, !seen.has(c.no));
      seen.add(c.no);
    });
  }
  assert.strictEqual(Core.collectedCount(s), seen.size);
});

// ------------------------------------------------------------ タップで稼ぐ
test('タップ: 1 かいで「ゆびのちから」ぶん増える / 強化は足りるときだけ', () => {
  const s = Core.newState();
  assert.strictEqual(Core.tap(s), 1);
  s.money = Core.upgradeCost(0) - 1;
  assert.strictEqual(Core.buyUpgrade(s), false);
  s.money = Core.upgradeCost(0);
  assert.strictEqual(Core.buyUpgrade(s), true);
  assert.strictEqual(s.money, 0);
  assert.strictEqual(Core.tap(s), 2);
  for (let l = 1; l < Core.MAX_LEVEL; l++) assert.ok(Core.upgradeCost(l) > Core.upgradeCost(l - 1));
  assert.strictEqual(Core.upgradeCost(Core.MAX_LEVEL), null);
});

/** 毎日 tapsPerDay 回タップする子を何人か自動で遊ばせて、1 日に何パック開けられるかを測る */
function packsPerDay(tapsPerDay, kids) {
  const out = [];
  for (let seed = 1; seed <= kids; seed++) {
    const rng = Core.mulberry32(seed * 1000);
    const s = Core.newState();
    for (let day = 0; day < 30; day++) {
      const now = NOON + day * DAY;
      Core.openPack(s, 'free', now, rng);
      for (let t = 0; t < tapsPerDay; t++) {
        Core.tap(s);
        const cost = Core.upgradeCost(s.tapLevel);
        if (cost !== null && cost < (tapsPerDay / 2) * Core.tapPower(s) && s.money >= cost) Core.buyUpgrade(s);
      }
      while (s.money >= Core.PACK_PRICE) Core.openPack(s, 'buy', now, rng);
    }
    out.push(s.packsOpened / 30);
  }
  return out.sort((a, b) => a - b)[Math.floor(kids / 2)];
}

test('バランス: 毎日 1 分 (300 タップ) で 1 日 3〜5 パック (SR は 1〜2 週に 1 まいのめずらしさ)', () => {
  const p = packsPerDay(300, 20);
  assert.ok(p >= 3 && p <= 5, `${p.toFixed(1)} パック/日`);
});

test('バランス: 毎日 20 秒でも むりょう + 少し買える / 3 分でも 1 日 20 パックは越えない', () => {
  const light = packsPerDay(100, 20);
  const heavy = packsPerDay(900, 20);
  assert.ok(light >= 1.1, `20秒: ${light.toFixed(1)}`);
  assert.ok(heavy <= 20, `3分: ${heavy.toFixed(1)}`);
});

// ------------------------------------------------------------ 保存データ
test('保存: こわれたデータでも落ちず、まともな値に直る', () => {
  [null, undefined, 5, 'x', [], { money: -5 }, { money: 'abc' }, { v: 2, owned: { '001': -1, '999': 3, '002': 2.9 } },
    { tapLevel: 999 }, { lastFreeDay: 'きのう' }, { money: Infinity }, { v: 2, box: { packs: [1, 2], next: 'a' } }].forEach((raw) => {
    const s = Core.normalize(raw);
    assert.ok(Number.isFinite(s.money) && s.money >= 0);
    assert.ok(s.tapLevel >= 0 && s.tapLevel <= Core.MAX_LEVEL);
    Object.keys(s.owned).forEach((no) => assert.ok(Core.cardByNo(no) && s.owned[no] > 0));
    assert.ok(s.box === null || s.box.packs.length === 30);
  });
  assert.deepStrictEqual(Core.normalize({ v: 2, owned: { '001': -1, '999': 3, '002': 2.9 } }).owned, { '002': 2 });
});

test('保存: 前の版 (どうぶつの名前で持っていた図鑑) を引き継ぐ', () => {
  const s = Core.normalize({ v: 1, money: 120, owned: { neko: 3, dragon: 1, unicorn: 2, nope: 4 }, lastFreeDay: '2026-10-11' });
  assert.deepStrictEqual(s.owned, { '001': 3, '019': 2, '020': 1 });
  assert.strictEqual(s.money, 120);
  assert.strictEqual(s.lastFreeDay, '2026-10-11');
  assert.strictEqual(s.v, 2);
});

test('保存: 書き出して読み直しても同じ (BOX の残りも)', () => {
  const s = richState(1e6);
  const rng = Core.mulberry32(1);
  for (let i = 0; i < 7; i++) Core.openPack(s, 'buy', NOON, rng);
  s.tapLevel = 3;
  assert.deepStrictEqual(Core.normalize(JSON.parse(JSON.stringify(s))), s);
});

test('表示: コイン数は 3 けたごとにカンマ', () => {
  assert.strictEqual(Core.formatMoney(1234567), '1,234,567');
});
