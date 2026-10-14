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
test('一覧: パックは 11 (シリーズ)。なかまわけ 1 つにつき 1 パック。記号・id・名前は重ならない', () => {
  assert.strictEqual(Core.SETS.length, 11);
  assert.deepStrictEqual(Core.SETS.map((st) => st.id), ['animal', 'sea', 'bird', 'dino', 'ghost', 'future', 'okashi', 'tabemono', 'kisetsu', 'machi', 'mahou']);
  assert.deepStrictEqual(Core.SETS.map((st) => st.cat), Core.CATS.map((c) => c.id));
  assert.strictEqual(new Set(Core.SETS.map((st) => st.code)).size, 11);
  assert.strictEqual(new Set(Core.SETS.map((st) => st.name)).size, 11);
  Core.SETS.forEach((st) => assert.ok(st.name && st.title && st.mark && st.colors.length === 3 && st.mascots.length === 3 && st.scene, st.id));
  assert.strictEqual(Core.CARDS.length, 11 * 34);
});

test('一覧: どのパックも 34 まい = C 8・U 6・R 4・RR 2 (ふつう 20) + AR 6・SR 4・SAR 2・MUR 1・LR 1 (シークレット 14)', () => {
  const want = { C: 8, U: 6, R: 4, RR: 2, AR: 6, SR: 4, SAR: 2, MUR: 1, LR: 1 };
  Core.SETS.forEach((st) => {
    assert.strictEqual(st.mainCount, 20, st.id);
    Core.RARITY_ORDER.forEach((r) => assert.strictEqual(Core.POOL[st.id][r].length, want[r], `${st.id} ${r}`));
  });
});

test('一覧: 同じ子が同じレア度で 2 まい入らない。MUR は「おうごんの」、LR は「でんせつの」。説明が全部ある', () => {
  Core.SETS.forEach((st) => {
    const seen = {};
    st.cards.forEach((c) => {
      const k = c.chara + c.rarity;
      assert.ok(!seen[k], `${st.id} ${k}`);
      seen[k] = 1;
      assert.ok(c.text && c.text.length >= 10, c.no);
      if (c.rarity === 'MUR') assert.ok(c.name.startsWith('おうごんの '), c.no);
      if (c.rarity === 'LR') assert.ok(c.name.startsWith('でんせつの '), c.no);
    });
    // いちばんの スターは MUR と LR が同じ子
    assert.strictEqual(Core.POOL[st.id].MUR[0].chara, Core.POOL[st.id].LR[0].chara, st.id);
  });
});

test('一覧: パックごとに番号は 001 から順。見分け (A1-001) は全部で重ならない', () => {
  Core.SETS.forEach((st) => {
    st.cards.forEach((c, i) => {
      assert.strictEqual(c.num, String(i + 1).padStart(3, '0'), `${st.id} ${c.num}`);
      assert.strictEqual(c.no, st.code + '-' + c.num);
      assert.strictEqual(c.set, st.id);
    });
  });
  assert.strictEqual(new Set(Core.CARDS.map((c) => c.no)).size, Core.CARDS.length);
});

test('一覧: 通常 (C〜RR) が先、シークレット (AR 以上) があと', () => {
  Core.SETS.forEach((st) => {
    st.cards.forEach((c) => {
      const main = Number(c.num) <= st.mainCount;
      assert.strictEqual(main, Core.rank(c.rarity) <= Core.rank('RR'), `${c.no} ${c.rarity}`);
    });
  });
});

test('一覧: どのパックも、どのレア度にも 1 まい以上・C は 3 まい以上 (パックから出せないレア度がない)', () => {
  Core.SETS.forEach((st) => {
    Core.RARITY_ORDER.forEach((r) => assert.ok(Core.POOL[st.id][r].length > 0, `${st.id} ${r}`));
    assert.ok(Core.POOL[st.id].C.length >= 3, st.id);
  });
});

test('一覧: 名前・分類・説明が全部ある。仮の絵・だいこうぶつ・パックの顔のキャラも全部ある', () => {
  Core.CARDS.forEach((c) => {
    assert.ok(c.name && c.kind && c.text, c.no);
    assert.ok(Animals.ids.includes(c.chara), `${c.no}: ${c.chara} の仮の絵`);
    assert.ok(Core.CHARAS[c.chara], `${c.no}: ${c.chara} の だいこうぶつ`);
    assert.strictEqual(typeof c.art, 'string');
  });
  Core.SETS.forEach((st) => st.mascots.forEach((m) => assert.ok(Animals.ids.includes(m), `${st.id}: ${m}`)));
});

test('一覧: 手で書いた表に、同じパックの中で同じ番号が 2 回書かれていない (あとの方だけ残る事故よけ)', () => {
  const src = fs.readFileSync(require.resolve('./cards.js'), 'utf8');
  const blocks = src.split(/\n {6}id: '/).slice(1);
  assert.strictEqual(blocks.length, 6, '手で書いたパックは 6 つ');
  blocks.forEach((b, i) => {
    // 手で書いた分 (001〜)。足したぶん (シリーズで広げた分) は含まない
    const nos = [...b.matchAll(/no: '(\d{3})'/g)].map((m) => m[1]);
    assert.strictEqual(new Set(nos).size, nos.length, Core.SETS[i].id);
    assert.ok(nos.length <= Core.SETS[i].cards.length, Core.SETS[i].id);
  });
});

test('番号の表示はポケモンカードと同じ数え方 (021/020)。パックごとに数える', () => {
  assert.strictEqual(Core.numberLabel(Core.cardByNo('A1-001')), '001/020');
  assert.strictEqual(Core.numberLabel(Core.cardByNo('A1-033')), '033/020');
  assert.strictEqual(Core.numberLabel(Core.cardByNo('S1-021')), '021/020');
  assert.strictEqual(Core.numberLabel(Core.cardByNo('W1-034')), '034/020');
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
    assert.strictEqual((tops.SR || 0) + (tops.SAR || 0) + (tops.MUR || 0) + (tops.LR || 0), 1);
    assert.strictEqual(box.packs.filter((p) => p.ar).length, 3);
  }
});

test('BOX: SR 以上の 1 まいは、SAR が約 5 BOX に 1、MUR が約 50 BOX に 1、LR が約 150 BOX に 1', () => {
  const N = 150000;
  const rng = Core.mulberry32(77);
  const n = { SR: 0, SAR: 0, MUR: 0, LR: 0 };
  for (let i = 0; i < N; i++) n[Core.newBox(rng).packs.find((p) => p.top !== 'R' && p.top !== 'RR').top]++;
  assert.ok(Math.abs(n.SAR / N - 0.2) < 0.01, `SAR ${n.SAR / N}`);
  assert.ok(Math.abs(n.MUR / N - 0.02) < 0.002, `MUR ${n.MUR / N}`);
  assert.ok(Math.abs(n.LR / N - 1 / 150) < 0.001, `LR ${n.LR / N}`);
});

test('パック: 5 まいで、1〜3 まいめ C・4 まいめ U か AR・5 まいめ R 以上。中で同じカードは出ない。そのパックのカードだけ', () => {
  const rng = Core.mulberry32(5);
  for (let i = 0; i < 2400; i++) {
    const st = Core.SETS[i % Core.SETS.length].id;
    const box = Core.newBox(rng, st);
    assert.strictEqual(box.set, st);
    box.packs.forEach((slot) => {
      const nos = Core.rollPack(slot, rng, st);
      nos.forEach((no) => assert.strictEqual(Core.cardByNo(no).set, st));
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
    const g = Core.POOL.animal[r].map((c) => count[c.no] || 0);
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
  assert.strictEqual(s.shop.animal.next, 2);
});

test('パックの種類: お店の BOX はパックごとに別。むりょうは どのパックでも 1 日 1 回 (合わせて)', () => {
  const s = richState(1e9);
  const rng = Core.mulberry32(10);
  const r1 = Core.openPack(s, 'buy', NOON, rng, 'sea');
  assert.ok(r1.ok && r1.set === 'sea');
  r1.cards.forEach((c) => assert.strictEqual(Core.cardByNo(c.no).set, 'sea'));
  Core.openPack(s, 'buy', NOON, rng, 'ghost');
  assert.deepStrictEqual([s.shop.sea.next, s.shop.ghost.next], [1, 1]);
  assert.ok(Core.openPack(s, 'free', NOON, rng, 'dino').ok);
  assert.strictEqual(Core.openPack(s, 'free', NOON, rng, 'bird').ok, false, 'ほかのパックでも、むりょうは 1 日 1 回');
  assert.strictEqual(Core.openPack(s, 'buy', NOON, rng, 'nope').set, 'animal', '知らないパックは どうぶつパック');
});

test('パックの種類: どのパックも、BOX 30 パックで SR 以上が必ず 1 まい', () => {
  Core.SETS.forEach((st, k) => {
    const s = richState(1e9);
    const rng = Core.mulberry32(100 + k);
    for (let box = 0; box < 5; box++) {
      let srUp = 0;
      for (let i = 0; i < 30; i++) {
        srUp += Core.openPack(s, 'buy', NOON, rng, st.id).cards.filter((c) => Core.rank(rarityOf(c.no)) >= Core.rank('SR')).length;
      }
      assert.strictEqual(srUp, 1, `${st.id} BOX ${box}`);
    }
  });
});


// ------------------------------------------------------------ BOX ごと買う
test('BOX 買い: 30 パックぶんの値段で、手もとに 30 パック入る。お店の BOX は進まない', () => {
  assert.strictEqual(Core.BOX_PRICE, Core.PACK_PRICE * 30);
  const s = richState(Core.BOX_PRICE + 7);
  const shop = JSON.stringify(s.shop);
  assert.deepStrictEqual(Core.buyBox(s, Core.mulberry32(1)), { ok: true });
  assert.strictEqual(s.money, 7);
  assert.strictEqual(Core.packsInHand(s), 30);
  assert.strictEqual(JSON.stringify(s.shop), shop);
});

test('BOX 買い: お金が足りなければ失敗し、何も変わらない', () => {
  const s = richState(Core.BOX_PRICE - 1);
  const before = JSON.stringify(s);
  assert.deepStrictEqual(Core.buyBox(s, Core.mulberry32(1)), { ok: false, reason: 'money' });
  assert.strictEqual(JSON.stringify(s), before);
});

test('BOX 買い: 買った BOX を 30 パック開けると、SR 以上 1・RR 4・AR 3 が必ず出て、箱は空になる (200 箱)', () => {
  const rng = Core.mulberry32(12);
  for (let b = 0; b < 200; b++) {
    const s = richState(Core.BOX_PRICE);
    Core.buyBox(s, rng);
    const n = {};
    for (let i = 0; i < 30; i++) {
      const r = Core.openPack(s, 'box', NOON, rng);
      assert.ok(r.ok);
      assert.strictEqual(r.boxLeft, 29 - i);
      r.cards.forEach((c) => { const k = rarityOf(c.no); n[k] = (n[k] || 0) + 1; });
    }
    assert.strictEqual((n.SR || 0) + (n.SAR || 0) + (n.MUR || 0) + (n.LR || 0), 1, `箱 ${b}`);
    assert.strictEqual(n.RR || 0, 4);
    assert.strictEqual(n.AR || 0, 3);
    assert.strictEqual(Core.packsInHand(s), 0);
    assert.strictEqual(s.boxes.length, 0);
    assert.strictEqual(s.money, 0, 'BOX から開けるときはお金が減らない');
  }
});

test('BOX 買い: 2 箱買うと、1 箱目を開け切ってから 2 箱目。BOX が無いと開けられない', () => {
  const s = richState(Core.BOX_PRICE * 2);
  assert.deepStrictEqual(Core.openPack(s, 'box', NOON), { ok: false, reason: 'nobox' });
  Core.buyBox(s, Core.mulberry32(1));
  Core.buyBox(s, Core.mulberry32(2));
  const second = JSON.stringify(s.boxes[1]);
  for (let i = 0; i < 30; i++) Core.openPack(s, 'box', NOON, Core.mulberry32(i));
  assert.strictEqual(s.boxes.length, 1);
  assert.strictEqual(JSON.stringify(s.boxes[0]), second);
  assert.strictEqual(Core.packsInHand(s), 30);
});

test('BOX 買い: パックの種類ごとに別の箱。開けるときも、そのパックの箱から', () => {
  const s = richState(Core.BOX_PRICE * 2);
  Core.buyBox(s, Core.mulberry32(1), 'sea');
  Core.buyBox(s, Core.mulberry32(2), 'future');
  assert.deepStrictEqual([Core.packsInHand(s, 'sea'), Core.packsInHand(s, 'future'), Core.packsInHand(s, 'animal'), Core.packsInHand(s)], [30, 30, 0, 60]);
  assert.deepStrictEqual(Core.openPack(s, 'box', NOON, Core.mulberry32(3), 'animal'), { ok: false, reason: 'nobox' });
  const r = Core.openPack(s, 'box', NOON, Core.mulberry32(3), 'future');
  r.cards.forEach((c) => assert.strictEqual(Core.cardByNo(c.no).set, 'future'));
  assert.deepStrictEqual([Core.packsInHand(s, 'sea'), Core.packsInHand(s, 'future')], [30, 29]);
  const all = Core.openBoxAll(s, NOON, Core.mulberry32(4), 'sea');
  assert.strictEqual(all.packs.length, 30);
  assert.deepStrictEqual([Core.packsInHand(s, 'sea'), Core.packsInHand(s, 'future')], [0, 29]);
});

test('BOX 買い: むりょうパックとは別枠 (BOX から開けても、むりょうは残る)', () => {
  const s = richState(Core.BOX_PRICE);
  Core.buyBox(s, Core.mulberry32(3));
  Core.openPack(s, 'box', NOON, Core.mulberry32(4));
  assert.ok(Core.canOpenFree(s, NOON));
});

test('BOX 買い: SR 以上がもう出たかが分かる', () => {
  const box = Core.newBox(Core.mulberry32(5));
  const at = box.packs.findIndex((p) => Core.rank(p.top) >= Core.rank('SR'));
  box.next = at;
  assert.deepStrictEqual(Core.boxStatus(box), { left: 30 - at, srUpOut: false });
  box.next = at + 1;
  assert.strictEqual(Core.boxStatus(box).srUpOut, true);
});

test('まとめて開ける: 1 箱の残りを全部開け、レア (RR 以上と AR) だけを弱い順に並べる', () => {
  const rng = Core.mulberry32(21);
  for (let b = 0; b < 100; b++) {
    const s = richState(Core.BOX_PRICE * 2);
    Core.buyBox(s, rng);
    Core.buyBox(s, rng);
    for (let i = 0; i < b % 7; i++) Core.openPack(s, 'box', NOON, rng);   // 途中まで開けた箱でも
    const left = Core.packsInHand(s) - 30;
    const r = Core.openBoxAll(s, NOON, rng);
    assert.ok(r.ok);
    assert.strictEqual(r.packs.length, left, '1 箱目の残りだけ開ける');
    assert.strictEqual(Core.packsInHand(s), 30, '2 箱目は手つかず');
    const want = r.packs.flatMap((p) => p.cards).filter((c) => Core.rank(rarityOf(c.no)) >= Core.rank('RR'));
    assert.strictEqual(r.cards.length, want.length, '演出に出すのは RR 以上と AR だけ');
    for (let i = 1; i < r.cards.length; i++) {
      assert.ok(Core.rank(rarityOf(r.cards[i].no)) >= Core.rank(rarityOf(r.cards[i - 1].no)), '弱い順 (いちばん良いのが最後)');
    }
    r.show.specials.forEach((sp, i) => {
      assert.strictEqual(sp.index, i);
      assert.strictEqual(sp.rarity, rarityOf(r.cards[i].no), '演出の光はそのカードのレア度のまま');
    });
    const total = Object.values(r.counts).reduce((a, x) => a + x, 0);
    assert.strictEqual(total, left * 5);
  }
});

test('まとめて開ける: 丸ごと 1 箱なら SR 以上が必ず最後に来る。NEW は 1 回目だけ', () => {
  const s = richState(Core.BOX_PRICE);
  Core.buyBox(s, Core.mulberry32(5));
  const r = Core.openBoxAll(s, NOON, Core.mulberry32(6));
  assert.strictEqual(r.packs.length, 30);
  assert.ok(Core.rank(r.show.tier) >= Core.rank('SR'));
  assert.ok(Core.rank(rarityOf(r.cards[r.cards.length - 1].no)) >= Core.rank('SR'));
  assert.strictEqual(new Set(r.newNos).size, r.newNos.length);
  assert.strictEqual(r.newNos.length, Core.collectedCount(s));
  assert.deepStrictEqual(Core.openBoxAll(s, NOON), { ok: false, reason: 'nobox' });
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
  const tops = ['R', 'RR', 'SR', 'SAR', 'MUR', 'LR'];
  for (let i = 0; i < 20000; i++) {
    const r = ['C', 'C', 'C', rng() < 0.1 ? 'AR' : 'U', tops[Math.floor(rng() * tops.length)]];
    const sh = Core.makeShow(r, rng);
    const tierLadder = Core.LADDER.indexOf(Core.RARITIES[sh.tier].color);
    assert.ok(Core.LADDER.indexOf(sh.tearLight) <= tierLadder, `あける光 ${sh.tearLight} / ${sh.tier}`);
    if (sh.omen === 'rainbow') assert.ok(Core.rank(sh.tier) >= Core.rank('SAR'), `虹の予兆は SAR 以上だけ (${sh.tier})`);
    if (sh.omen === 'gold') assert.ok(Core.rank(sh.tier) >= Core.rank('MUR'), '金の予兆は MUR 以上だけ');
    if (sh.omen === 'cosmos') assert.strictEqual(sh.tier, 'LR', '流れ星の予兆は LR だけ');
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
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'LR'], rng).tearLight, 'gold');
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'RR'], rng).tearLight, 'blue');
  assert.strictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'R'], rng).tearLight, 'white');
});

test('演出: RR・AR はタップでめくる / SR 以上は長押し。段は SR 2・SAR 3・MUR 4', () => {
  const rng = Core.mulberry32(4);
  const sh = Core.makeShow(['C', 'C', 'C', 'AR', 'MUR'], rng);
  assert.deepStrictEqual(sh.specials.map((s) => [s.index, s.mode, s.stages.length]), [[3, 'tap', 1], [4, 'hold', 4]]);
  assert.deepStrictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'SR'], rng).specials[0].stages, ['blue', 'gold']);
  assert.deepStrictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'SAR'], rng).specials[0].stages, ['blue', 'gold', 'rainbow']);
  assert.deepStrictEqual(Core.makeShow(['C', 'C', 'C', 'U', 'LR'], rng).specials[0].stages, ['blue', 'gold', 'rainbow', 'mega', 'legend']);
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
  assert.ok(Math.abs(rate('LR', 'cosmos') - 0.7) < 0.02);
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
  assert.strictEqual(Core.tap(s), 2);   // (1 + 0) x 1.5 を四捨五入
  s.money = Core.upgradeCost(0) - 1;
  assert.strictEqual(Core.buyUpgrade(s), false);
  s.money = Core.upgradeCost(0);
  assert.strictEqual(Core.buyUpgrade(s), true);
  assert.strictEqual(s.money, 0);
  assert.strictEqual(Core.tap(s), 3);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(Core.tapPowerAt), [2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 20]);
  assert.strictEqual(Core.tapPowerAt(Core.MAX_LEVEL), 20);   // いちばん強くて 1 かいで 20 コイン
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

test('バランス: 毎日 1 分 (300 タップ) で 1 日 5〜8 パック (1 タップを 1.5 倍にしたあと。測った値 6.2)', () => {
  const p = packsPerDay(300, 20);
  assert.ok(p >= 5 && p <= 8, `${p.toFixed(1)} パック/日`);
});

test('バランス: 毎日 20 秒でも むりょう + 少し買える / 3 分でも 1 日 30 パックは越えない', () => {
  const light = packsPerDay(100, 20);
  const heavy = packsPerDay(900, 20);
  assert.ok(light >= 1.8, `20秒: ${light.toFixed(1)}`);
  assert.ok(heavy <= 30, `3分: ${heavy.toFixed(1)}`);
});

// ------------------------------------------------------------ なかよし (お気に入り・おやつ)
function withCharas(money, charas) {
  const s = richState(money);
  charas.forEach((ch) => { s.owned[Core.CARDS.find((c) => c.chara === ch).no] = 1; });
  return s;
}

test('なかよし: どのキャラにも、だいこうぶつ (絵と名前) がある', () => {
  new Set(Core.CARDS.map((c) => c.chara)).forEach((ch) => {
    assert.ok(Core.CHARAS[ch] && Core.CHARAS[ch].food && Core.CHARAS[ch].foodName, ch);
  });
});

test('おやつ: 値段ぶんコインが減り、なかよし度が上がる (りんご 1・クッキー 3・だいこうぶつ 6)', () => {
  const s = withCharas(1000, ['neko']);
  assert.strictEqual(Core.feed(s, 'neko', 'apple', NOON).gain, 1);
  assert.strictEqual(Core.feed(s, 'neko', 'cookie', NOON).gain, 3);
  assert.strictEqual(Core.feed(s, 'neko', 'fav', NOON).gain, 6);
  assert.strictEqual(s.money, 1000 - 30 - 80 - 150);
  assert.strictEqual(Core.petInfo(s, 'neko', NOON).aff, 10);
});

test('おやつ: 1 人 1 日 3 こまで。次の日にはまた食べられる', () => {
  const s = withCharas(1e6, ['neko']);
  for (let i = 0; i < 3; i++) assert.ok(Core.feed(s, 'neko', 'apple', NOON).ok);
  const before = JSON.stringify(s);
  assert.deepStrictEqual(Core.feed(s, 'neko', 'apple', NOON + 3600e3), { ok: false, reason: 'full' });
  assert.strictEqual(JSON.stringify(s), before, 'おなか いっぱいのときは何も変わらない');
  assert.strictEqual(Core.petInfo(s, 'neko', NOON).snacksLeft, 0);
  assert.strictEqual(Core.petInfo(s, 'neko', NOON + DAY).snacksLeft, 3);
  assert.ok(Core.feed(s, 'neko', 'apple', NOON + DAY).ok);
});

test('おやつ: お金が足りない・持っていない子には あげられず、何も変わらない', () => {
  const s = withCharas(29, ['neko']);
  const before = JSON.stringify(s);
  assert.deepStrictEqual(Core.feed(s, 'neko', 'apple', NOON), { ok: false, reason: 'money' });
  assert.deepStrictEqual(Core.feed(s, 'inu', 'apple', NOON), { ok: false, reason: 'notOwned' });
  assert.deepStrictEqual(Core.pet(s, 'inu', NOON), { ok: false, reason: 'notOwned' });
  assert.strictEqual(JSON.stringify(s), before);
});

test('なでる: 1 日 1 回 +1 (ただ)。次の日にまた なでられる', () => {
  const s = withCharas(0, ['neko']);
  assert.strictEqual(Core.pet(s, 'neko', NOON).gain, 1);
  assert.deepStrictEqual(Core.pet(s, 'neko', NOON + 1000), { ok: false, reason: 'already' });
  assert.ok(Core.pet(s, 'neko', NOON + DAY).ok);
  assert.strictEqual(s.money, 0);
});

test('なかよしレベル: 5 段。上がった瞬間だけ levelUp', () => {
  assert.deepStrictEqual([0, 4, 5, 14, 15, 29, 30, 54, 55, 999].map(Core.petLevel), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  const s = withCharas(1e6, ['neko']);
  const ups = [];
  for (let d = 0; d < 10; d++) {
    for (let i = 0; i < 3; i++) { const r = Core.feed(s, 'neko', 'fav', NOON + d * DAY); if (r.levelUp) ups.push(r.level); }
  }
  assert.deepStrictEqual(ups, [2, 3, 4, 5]);
  assert.strictEqual(Core.petInfo(s, 'neko', NOON).progress, 1);
});

test('なかよし: 毎日 クッキー 3 こ + なでる で、いちばん上まで 1 週間くらい', () => {
  const s = withCharas(1e6, ['neko']);
  let d = 0;
  while (Core.petInfo(s, 'neko', NOON + d * DAY).level < 5 && d < 100) {
    for (let i = 0; i < 3; i++) Core.feed(s, 'neko', 'cookie', NOON + d * DAY);
    Core.pet(s, 'neko', NOON + d * DAY);
    d++;
  }
  assert.ok(d >= 4 && d <= 8, `${d} 日`);
});

// ------------------------------------------------------------ 保存データ
test('保存: こわれたデータでも落ちず、まともな値に直る', () => {
  [null, undefined, 5, 'x', [], { money: -5 }, { money: 'abc' }, { v: 2, owned: { '001': -1, '999': 3, '002': 2.9 } },
    { tapLevel: 999 }, { lastFreeDay: 'きのう' }, { money: Infinity }, { v: 2, box: { packs: [1, 2], next: 'a' } }].forEach((raw) => {
    const s = Core.normalize(raw);
    assert.ok(Number.isFinite(s.money) && s.money >= 0);
    assert.ok(s.tapLevel >= 0 && s.tapLevel <= Core.MAX_LEVEL);
    Object.keys(s.owned).forEach((no) => assert.ok(Core.cardByNo(no) && s.owned[no] > 0));
    assert.ok(typeof s.shop === 'object' && Object.values(s.shop).every((b) => b.packs.length === 30));
    assert.ok(Array.isArray(s.boxes));
  });
  // なかよし度はこわれていても数に直る。知らないキャラは捨てる
  const f = Core.normalize({ v: 4, pets: { neko: { aff: 'x', fed: 99, fedDay: 'きのう' }, nope: { aff: 3 } } });
  assert.deepStrictEqual(f.pets, { neko: { aff: 0, fedDay: '', fed: 3, pettedDay: '' } });
  assert.deepStrictEqual(Core.normalize({ v: 2, boxes: [null, 3, { packs: [] }] }).boxes, []);
  assert.deepStrictEqual(Core.normalize({ v: 2, owned: { '001': -1, '999': 3, '002': 2.9 } }).owned, { 'A1-002': 2 });
  assert.deepStrictEqual(Core.normalize({ v: 4, owned: { 'S1-003': 2, 'X9-001': 1, '001': 1 } }).owned, { 'S1-003': 2 });
  // v3 (100 パックのとき) のもちものは、どうぶつパック (A1) だけ引き継ぐ。ほかは同じ番号が別のカードになったので
  assert.deepStrictEqual(Core.normalize({ v: 3, money: 9, owned: { 'A1-005': 2, 'S1-003': 2, 'K1-001': 1 } }).owned, { 'A1-005': 2 });
  assert.strictEqual(Core.normalize({ v: 3, money: 9 }).money, 9);
});

test('保存: 前の版 (どうぶつの名前で持っていた図鑑) を引き継ぐ', () => {
  const s = Core.normalize({ v: 1, money: 120, owned: { neko: 3, dragon: 1, unicorn: 2, nope: 4 }, lastFreeDay: '2026-10-11' });
  assert.deepStrictEqual(s.owned, { 'A1-001': 3, 'A1-019': 2, 'A1-020': 1 });
  assert.strictEqual(s.money, 120);
  assert.strictEqual(s.lastFreeDay, '2026-10-11');
  assert.strictEqual(s.v, 4);
});

test('保存: その前の版 (v2: 番号で持つ図鑑・お店の BOX が 1 つ) を引き継ぐ', () => {
  const box = Core.newBox(Core.mulberry32(1));
  delete box.set;
  box.next = 7;
  const s = Core.normalize({ v: 2, money: 50, owned: { '001': 2, '033': 1 }, box: box, boxes: [Object.assign({}, box, { next: 3 })] });
  assert.deepStrictEqual(s.owned, { 'A1-001': 2, 'A1-033': 1 });
  assert.strictEqual(s.shop.animal.next, 7);
  assert.strictEqual(s.boxes[0].set, 'animal');
  assert.strictEqual(Core.packsInHand(s, 'animal'), 27);
});

test('保存: 書き出して読み直しても同じ (BOX の残りも、手もとの BOX も)', () => {
  const s = richState(1e6);
  const rng = Core.mulberry32(1);
  for (let i = 0; i < 7; i++) Core.openPack(s, 'buy', NOON, rng);
  Core.buyBox(s, rng);
  Core.buyBox(s, rng);
  for (let i = 0; i < 4; i++) Core.openPack(s, 'box', NOON, rng);
  Core.openPack(s, 'buy', NOON, rng, 'dino');
  Core.buyBox(s, rng, 'ghost');
  const ch = Core.cardByNo(Object.keys(s.owned)[0]).chara;
  Core.feed(s, ch, 'cookie', NOON);
  Core.pet(s, ch, NOON);
  s.tapLevel = 3;
  assert.deepStrictEqual(Core.normalize(JSON.parse(JSON.stringify(s))), s);
});

test('表示: コイン数は 3 けたごとにカンマ', () => {
  assert.strictEqual(Core.formatMoney(1234567), '1,234,567');
});

test('アイコン: iPhone のホーム画面用は PNG で 180x180 (iOS は SVG を使えない)。タブ用も PNG', () => {
  const html = fs.readFileSync(require.resolve('./index.html'), 'utf8');
  const touch = html.match(/<link rel="apple-touch-icon" href="\.\/([^"]+)"/);
  const icon = html.match(/<link rel="icon" href="\.\/([^"]+)"/);
  assert.ok(touch && /\.png$/.test(touch[1]) && icon && /\.png$/.test(icon[1]));
  const size = (f) => {
    const b = fs.readFileSync(require.resolve('./' + f));
    assert.strictEqual(b.toString('latin1', 1, 4), 'PNG', f);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  assert.deepStrictEqual(size(touch[1]), [180, 180]);
  assert.deepStrictEqual(size(icon[1]), [64, 64]);
});

test('画面の高さ: 根っこ (html, body) の高さに vh を使わない (状態バーの下から始まる画面で、下が切れる)', () => {
  const css = fs.readFileSync(require.resolve('./styles.css'), 'utf8');
  const rule = css.match(/html,\s*body\s*\{[^}]*\}/);
  assert.ok(rule, 'html, body の規則');
  assert.ok(/height:\s*100%/.test(rule[0]), rule[0]);
  assert.ok(!/\b\d+d?v?s?vh\b/.test(rule[0].replace(/\/\*[\s\S]*?\*\//g, '')), 'vh / dvh / svh を使わない');
});

// ------------------------------------------------------------ ミニゲーム
test('ミニゲーム: 1 日 3 回まで。日が変わると戻り、回数が残っていないと何も変わらない', () => {
  const s = Core.newState();
  ['memory', 'catch'].forEach((g) => {
    assert.strictEqual(Core.miniLeft(s, g, NOON), 3);
    for (let i = 0; i < 3; i++) assert.ok(Core.miniFinish(s, g, g === 'memory' ? { turns: 4 } : { score: 40 }, NOON).ok);
    assert.strictEqual(Core.miniLeft(s, g, NOON), 0);
    const m = s.money;
    assert.strictEqual(Core.miniFinish(s, g, { turns: 4, score: 40 }, NOON).ok, false);
    assert.strictEqual(s.money, m);
    assert.strictEqual(Core.miniLeft(s, g, NOON + DAY), 3);
  });
  assert.strictEqual(Core.miniFinish(s, 'nanika', {}, NOON).ok, false);
});

test('ミニゲーム: ごほうびは 満点で 5,000 コイン (ゆびのちからに関係しない)', () => {
  assert.deepStrictEqual([3, 4, 5, 6, 7, 8, 10, 11, 30].map((t) => Core.miniReward('memory', { turns: t })), [5000, 5000, 5000, 4000, 4000, 3000, 3000, 2000, 2000]);
  assert.strictEqual(Core.miniReward('catch', { score: 0 }), 1500);
  assert.strictEqual(Core.miniReward('catch', { score: 40 }), 5000);
  assert.strictEqual(Core.miniReward('catch', { score: 999 }), 5000);
  assert.strictEqual(Core.miniReward('catch', { score: -5 }), 1500);
  const s = Core.newState();
  s.money = 10;
  s.tapLevel = 8;
  assert.strictEqual(Core.miniFinish(s, 'memory', { turns: 4 }, NOON).coins, 5000);
  assert.strictEqual(s.money, 5010);
  // どんな得点でも、まえより悪い点が 多くはならない (点が上がるほど コインは増える)
  let prev = 0;
  for (let sc = 0; sc <= 60; sc++) { const r = Core.miniReward('catch', { score: sc }); assert.ok(r >= prev && r <= 5000); prev = r; }
});

test('ミニゲーム: 1 日の上限は 満点 x 6 回 = 30,000 コイン (60 パックぶん)', () => {
  const day = 3 * Core.miniReward('memory', { turns: 4 }) + 3 * Core.miniReward('catch', { score: 40 });
  assert.strictEqual(day, 30000);
  assert.strictEqual(day / Core.PACK_PRICE, 60);
});

test('めくり: 4 組 (8 まい)。同じ絵が 2 まいずつ。もっている子を先に使う', () => {
  const s = Core.newState();
  const own = Core.CARDS.filter((c, i, a) => a.findIndex((x) => x.chara === c.chara) === i).slice(0, 6);
  own.forEach((c) => { s.owned[c.no] = 1; });
  for (let seed = 1; seed <= 200; seed++) {
    const deal = Core.memoryDeal(s, Core.mulberry32(seed));
    assert.strictEqual(deal.length, 8);
    const cnt = {};
    deal.forEach((x) => { cnt[x] = (cnt[x] || 0) + 1; assert.ok(Core.CHARAS[x], x); });
    assert.deepStrictEqual(Object.values(cnt), Array(4).fill(2).slice(0, Object.keys(cnt).length));
    assert.strictEqual(Object.keys(cnt).length, 4);
    Object.keys(cnt).forEach((x) => assert.ok(own.some((c) => c.chara === x), '持っている子から'));
  }
  const empty = Core.memoryDeal(Core.newState(), Core.mulberry32(1));   // 何も持っていなくても 4 組できる
  assert.strictEqual(new Set(empty).size, 4);
});

test('キャッチ: くり以外は点が付く。ふつうの確率で 4 しゅるいぜんぶ出る', () => {
  const rng = Core.mulberry32(5), n = {};
  for (let i = 0; i < 20000; i++) { const k = Core.catchPick(rng); n[k] = (n[k] || 0) + 1; }
  assert.strictEqual(Object.keys(n).length, 4);
  assert.ok(n.apple > n.cookie && n.cookie > n.chestnut && n.chestnut > n.gold, JSON.stringify(n));
  assert.ok(Core.CATCH_ITEMS.chestnut.points < 0 && Core.CATCH_ITEMS.gold.points > Core.CATCH_ITEMS.cookie.points);
});

test('ミニゲーム: 保存したあと読み込んでも、きょうの回数が残る・こわれていても落ちない', () => {
  const s = Core.newState();
  Core.miniFinish(s, 'catch', { score: 10 }, NOON);
  const r = Core.normalize(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(Core.miniLeft(r, 'catch', NOON), 2);
  assert.strictEqual(Core.miniLeft(r, 'memory', NOON), 3);
  const bad = Core.normalize({ mini: { day: 5, plays: { memory: 'x', catch: 1e9 } } });
  assert.strictEqual(Core.miniLeft(bad, 'memory', NOON), 3);
  assert.ok(Core.miniLeft(Core.normalize({ money: 5 }), 'catch', NOON) === 3);
});

// ------------------------------------------------------------ パックの表紙と色
test('パックの表紙の 3 人は そのパックに 出る子。せかい パックは 中身の ちがう 小さいパックから 1 人ずつ', () => {
  const P = require('./packs.js');
  const packOf = {};
  (P.PACKS || P).forEach((pk) => pk.charas.forEach((c) => { packOf[c.id] = pk.id; }));
  Core.SETS.forEach((st) => {
    const charas = new Set(st.cards.map((c) => c.chara));
    assert.strictEqual(st.mascots.length, 3, st.id);
    st.mascots.forEach((m) => assert.ok(charas.has(m), `${st.id}: ${m} は このパックに 出ない`));
  });
  ['okashi', 'tabemono', 'kisetsu', 'machi'].forEach((id) => {
    const st = Core.setById(id);
    assert.strictEqual(new Set(st.mascots.map((m) => packOf[m])).size, 3, `${id}: ${st.mascots.map((m) => packOf[m])}`);
  });
});

test('パックの色は どれも 見分けられる (3 つの色を 位置ごとに くらべた 平均の へだたりが 55 以上。前は おかしと きせつが 39)', () => {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const S = Core.SETS;
  for (let i = 0; i < S.length; i++) {
    for (let j = i + 1; j < S.length; j++) {
      const a = S[i].colors.map(hex), b = S[j].colors.map(hex);
      const m = (d(a[0], b[0]) + d(a[1], b[1]) + d(a[2], b[2])) / 3;
      assert.ok(m >= 55, `${S[i].id} と ${S[j].id}: ${m.toFixed(0)}`);
    }
  }
});

test('パックは「いきもの」6 つと「せかい」5 つに わかれる', () => {
  const g = (st) => Core.CATS.find((c) => c.id === st.cat).group;
  assert.deepStrictEqual(Core.SETS.map(g), ['ikimono', 'ikimono', 'ikimono', 'ikimono', 'ikimono', 'ikimono', 'sekai', 'sekai', 'sekai', 'sekai', 'sekai']);
});
