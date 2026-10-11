/*!
 * core.js — ロジック。DOM を触らないので node でテストできる。
 *
 * ブラウザでは <script> で読み込むと window.Core になり、node からは require() できる。
 * カードの一覧は cards.js (先に読み込む)。
 *
 * ■ 封入 (ポケモンカードの日本の拡張パックと同じ作り)
 *   1 BOX = 30 パック、1 パック = 5 まい。
 *   1〜3 まいめ C / 4 まいめ U (BOX に 3 パックだけ AR) / 5 まいめ レア枠
 *   レア枠は BOX ごとに R 25・RR 4・SR 以上 1 を混ぜて配る (BOX 確定)。
 *   SR 以上の 1 まいは SR / SAR (約 5 BOX に 1) / MUR (約 50 BOX に 1)。
 *   公式は確率を出していないので、開封の集計から広く言われている目安に合わせた。
 *   むりょうパックも、買うパックも、同じ BOX から 1 パックずつ出てくる。
 *
 * ■ 演出の計画 (makeShow)
 *   出たカードから「どう見せるか」を先に決める。光の色は本当のレア度より上には絶対に上がらない。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('./cards.js'));
  } else {
    root.Core = factory(root.Cards);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Cards) {
  'use strict';

  // ---------------------------------------------------------------- 乱数
  /** 同じ seed からは同じ並びが出る乱数 (mulberry32)。テストで結果を固定できる。 */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(array, rng) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = array[i];
      array[i] = array[j];
      array[j] = t;
    }
    return array;
  }

  // ---------------------------------------------------------------- レア度
  // full = 全面イラストの枠 / color = 演出の光の色 (ひかりの はしご)
  const RARITIES = {
    C: { label: 'コモン', rank: 0, full: false, color: 'white' },
    U: { label: 'アンコモン', rank: 1, full: false, color: 'white' },
    R: { label: 'レア', rank: 2, full: false, color: 'white' },
    RR: { label: 'ダブルレア', rank: 3, full: false, color: 'blue' },
    AR: { label: 'アートレア', rank: 4, full: true, color: 'blue' },
    SR: { label: 'スーパーレア', rank: 5, full: true, color: 'gold' },
    SAR: { label: 'スペシャルアートレア', rank: 6, full: true, color: 'rainbow' },
    MUR: { label: 'メガウルトラレア', rank: 7, full: true, color: 'mega' }
  };
  const RARITY_ORDER = ['C', 'U', 'R', 'RR', 'AR', 'SR', 'SAR', 'MUR'];
  /** 光の色の段。左ほど弱い。演出はこの順にしか上がらない */
  const LADDER = ['white', 'blue', 'gold', 'rainbow', 'mega'];

  function rank(r) { return RARITIES[r].rank; }
  function ladderOf(r) { return LADDER.indexOf(RARITIES[r].color); }

  // ---------------------------------------------------------------- カード
  const SET = Cards.SET;
  const CARDS = Cards.CARDS;
  const BY_NO = {};
  CARDS.forEach(function (c) { BY_NO[c.no] = c; });
  const POOL = {};
  RARITY_ORDER.forEach(function (r) { POOL[r] = CARDS.filter(function (c) { return c.rarity === r; }); });

  function cardByNo(no) { return BY_NO[no] || null; }

  // ---------------------------------------------------------------- BOX と パック
  const BOX_PACKS = 30;
  const PACK_SIZE = 5;
  const BOX = { RR: 4, SR_UP: 1, AR: 3 };             // 1 BOX あたり
  const SR_UP_SPLIT = { MUR: 1 / 50, SAR: 1 / 5 };     // 「SR 以上」の 1 まいが何になるか (BOX あたり)

  /** 新しい BOX。30 パックぶんの「レア枠」と「AR が入るか」を先に決めて混ぜる */
  function newBox(rng) {
    const r = rng();
    const top = r < SR_UP_SPLIT.MUR ? 'MUR' : r < SR_UP_SPLIT.MUR + SR_UP_SPLIT.SAR ? 'SAR' : 'SR';
    const tops = [top];
    for (let i = 0; i < BOX.RR; i++) tops.push('RR');
    while (tops.length < BOX_PACKS) tops.push('R');
    shuffle(tops, rng);
    const ar = [];
    for (let i = 0; i < BOX_PACKS; i++) ar.push(i < BOX.AR);
    shuffle(ar, rng);
    return { packs: tops.map(function (t, i) { return { top: t, ar: ar[i] }; }), next: 0 };
  }

  /** 同じレア度のカードを、パックの中で重ならないように選ぶ */
  function pick(rarity, used, rng) {
    const pool = POOL[rarity].filter(function (c) { return !used[c.no]; });
    const from = pool.length ? pool : POOL[rarity];
    const c = from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
    used[c.no] = true;
    return c.no;
  }

  /** パック 1 つぶんのレア度の並び (BOX の 1 パックぶんから) */
  function packRarities(slot) {
    return ['C', 'C', 'C', slot.ar ? 'AR' : 'U', slot.top];
  }

  function rollPack(slot, rng) {
    const used = {};
    return packRarities(slot).map(function (r) { return pick(r, used, rng); });
  }

  // ---------------------------------------------------------------- 演出の計画
  /**
   * 出たカードの並びから、開封の見せ方を決める。
   *   tier      パックでいちばん上のレア度 (R 未満は R)
   *   omen      パックが出てきたときの予兆: none / shake / rainbow / gold
   *   tearLight あけたときに漏れる光: white / blue / gold (虹と MUR はここでは見せない)
   *   specials  裏向きで出して、特別にめくるカード
   *             mode tap = タップでめくる / hold = 長押しで力をためる
   *             stages = ためている間に上がっていく光の色 (最後が本当の色)
   */
  function makeShow(rarities, rng) {
    let tier = 'R';
    rarities.forEach(function (r) { if (rank(r) > rank(tier)) tier = r; });

    const x = rng();
    let omen = 'none';
    if (tier === 'MUR') omen = x < 0.7 ? 'gold' : 'rainbow';
    else if (tier === 'SAR') omen = x < 0.6 ? 'rainbow' : x < 0.9 ? 'shake' : 'none';
    else if (tier === 'SR') omen = x < 0.5 ? 'shake' : 'none';
    else if (tier === 'RR' || tier === 'AR') omen = x < 0.12 ? 'shake' : 'none';
    else omen = x < 0.03 ? 'shake' : 'none';   // ふつうのパックでも、たまに揺れる (揺れだけでは当たりと限らない)

    const tearLight = LADDER[Math.min(ladderOf(tier), 2)];

    const specials = [];
    rarities.forEach(function (r, i) {
      if (rank(r) < rank('RR')) return;
      const top = ladderOf(r);
      specials.push({
        index: i,
        rarity: r,
        mode: rank(r) >= rank('SR') ? 'hold' : 'tap',
        stages: LADDER.slice(1, top + 1)
      });
    });
    return { tier: tier, omen: omen, tearLight: tearLight, specials: specials };
  }

  // ---------------------------------------------------------------- 日付
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /** 端末の日付 (YYYY-MM-DD)。日が変わるとむりょうパックがまた開けられる。 */
  function dayKey(now) {
    const d = new Date(now);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function msUntilNextDay(now) {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now;
  }

  // ---------------------------------------------------------------- 状態
  const SAVE_VERSION = 2;

  function newState() {
    return {
      v: SAVE_VERSION, money: 0, tapLevel: 0, totalTaps: 0, owned: {}, lastFreeDay: '',
      packsOpened: 0, box: null, muted: false
    };
  }

  function toCount(x, max) {
    const n = Math.floor(Number(x));
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(n, max);
  }

  function validBox(b) {
    if (!b || typeof b !== 'object' || !Array.isArray(b.packs) || b.packs.length !== BOX_PACKS) return null;
    const ok = b.packs.every(function (p) {
      return p && (p.top === 'R' || p.top === 'RR' || p.top === 'SR' || p.top === 'SAR' || p.top === 'MUR') &&
        typeof p.ar === 'boolean';
    });
    const next = toCount(b.next, BOX_PACKS);
    return ok ? { packs: b.packs.map(function (p) { return { top: p.top, ar: p.ar }; }), next: next } : null;
  }

  /** 前の版 (v1) は どうぶつの名前で図鑑を持っていた。いちばん下のレア度のカードへ移す */
  function migrateOwnedV1(owned) {
    const out = {};
    Object.keys(owned).forEach(function (chara) {
      const n = toCount(owned[chara], 1e6);
      if (!n) return;
      const base = CARDS.filter(function (c) { return c.chara === chara; })
        .sort(function (a, b) { return rank(a.rarity) - rank(b.rarity); })[0];
      if (base) out[base.no] = (out[base.no] || 0) + n;
    });
    return out;
  }

  /** 保存データを安全な形にそろえる (こわれていても、前の版でも落ちない)。 */
  function normalize(raw) {
    const s = newState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
    s.money = toCount(raw.money, 1e15);
    s.tapLevel = Math.min(toCount(raw.tapLevel, MAX_LEVEL), MAX_LEVEL);
    s.totalTaps = toCount(raw.totalTaps, 1e12);
    s.packsOpened = toCount(raw.packsOpened, 1e9);
    s.lastFreeDay = typeof raw.lastFreeDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastFreeDay)
      ? raw.lastFreeDay : '';
    s.muted = raw.muted === true;
    let owned = raw.owned && typeof raw.owned === 'object' ? raw.owned : {};
    if (!(raw.v >= 2)) owned = migrateOwnedV1(owned);
    CARDS.forEach(function (c) {
      const n = toCount(owned[c.no], 1e6);
      if (n > 0) s.owned[c.no] = n;
    });
    s.box = validBox(raw.box);
    return s;
  }

  // ---------------------------------------------------------------- タップで稼ぐ
  const MAX_LEVEL = 8;
  const PACK_PRICE = 500;

  function tapPower(state) { return 1 + state.tapLevel; }

  /** 次のレベルにするのに要るコイン。MAX なら null。 */
  function upgradeCost(level) {
    if (level >= MAX_LEVEL) return null;
    return Math.round(60 * Math.pow(1.9, level));
  }

  function tap(state) {
    const gain = tapPower(state);
    state.money += gain;
    state.totalTaps++;
    return gain;
  }

  function buyUpgrade(state) {
    const cost = upgradeCost(state.tapLevel);
    if (cost === null || state.money < cost) return false;
    state.money -= cost;
    state.tapLevel++;
    return true;
  }

  // ---------------------------------------------------------------- パックを開ける
  function canOpenFree(state, now) { return state.lastFreeDay !== dayKey(now); }

  /**
   * パックを開ける。BOX から 1 パック出し、お金を引き、図鑑を増やす。
   * kind: 'free' (毎日のむりょう) / 'buy' (コインで買う)
   * 失敗 (もう開けた・お金が足りない) のときは何も変えない。
   */
  function openPack(state, kind, now, rng) {
    rng = rng || Math.random;
    if (kind === 'free') {
      if (!canOpenFree(state, now)) return { ok: false, reason: 'already' };
    } else if (kind === 'buy') {
      if (state.money < PACK_PRICE) return { ok: false, reason: 'money' };
    } else {
      return { ok: false, reason: 'unknown' };
    }
    if (!state.box || state.box.next >= BOX_PACKS) state.box = newBox(rng);
    const slot = state.box.packs[state.box.next];
    state.box.next++;
    const rarities = packRarities(slot);
    const nos = rollPack(slot, rng);

    if (kind === 'buy') state.money -= PACK_PRICE;
    else state.lastFreeDay = dayKey(now);
    state.packsOpened++;
    const cards = nos.map(function (no) {
      const isNew = !state.owned[no];
      state.owned[no] = (state.owned[no] || 0) + 1;
      return { no: no, isNew: isNew };
    });
    return { ok: true, cards: cards, show: makeShow(rarities, rng), boxLeft: BOX_PACKS - state.box.next };
  }

  function collectedCount(state, filter) {
    return CARDS.filter(function (c) { return (!filter || filter(c)) && state.owned[c.no] > 0; }).length;
  }

  // ---------------------------------------------------------------- 表示用
  function formatMoney(n) {
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatWait(ms) {
    const totalMin = Math.max(1, Math.ceil(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? 'あと' + h + 'じかん' + m + 'ふん' : 'あと' + m + 'ふん';
  }

  function numberLabel(card) { return card.no + '/' + pad2(SET.mainCount).padStart(3, '0'); }

  return {
    mulberry32: mulberry32,
    RARITIES: RARITIES,
    RARITY_ORDER: RARITY_ORDER,
    LADDER: LADDER,
    SET: SET,
    CARDS: CARDS,
    POOL: POOL,
    cardByNo: cardByNo,
    BOX_PACKS: BOX_PACKS,
    PACK_SIZE: PACK_SIZE,
    PACK_PRICE: PACK_PRICE,
    MAX_LEVEL: MAX_LEVEL,
    newBox: newBox,
    packRarities: packRarities,
    rollPack: rollPack,
    makeShow: makeShow,
    rank: rank,
    dayKey: dayKey,
    msUntilNextDay: msUntilNextDay,
    newState: newState,
    normalize: normalize,
    tapPower: tapPower,
    upgradeCost: upgradeCost,
    tap: tap,
    buyUpgrade: buyUpgrade,
    canOpenFree: canOpenFree,
    openPack: openPack,
    collectedCount: collectedCount,
    formatMoney: formatMoney,
    formatWait: formatWait,
    numberLabel: numberLabel
  };
});
