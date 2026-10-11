/*!
 * core.js — ロジック。DOM を触らないので node でテストできる。
 *
 * ブラウザでは <script> で読み込むと window.Core になり、
 * node からは require() できる。
 *
 * 動物のデータ (名前・レア度) と、お金・パック・図鑑のルールをここに持つ。
 * 絵は animals.js が id で引く。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.Core = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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

  // ---------------------------------------------------------------- 動物
  const RARITIES = {
    C: { label: 'コモン', stars: 1 },
    R: { label: 'レア', stars: 2 },
    SR: { label: 'スーパーレア', stars: 3 },
    UR: { label: 'ウルトラレア', stars: 4 }
  };
  const RARITY_ORDER = ['C', 'R', 'SR', 'UR'];

  // 図鑑の並び = この順 (No.1 から)
  const ANIMALS = [
    { id: 'neko', name: 'ねこ', rarity: 'C', likes: 'ひなたぼっこ' },
    { id: 'inu', name: 'いぬ', rarity: 'C', likes: 'おさんぽ' },
    { id: 'usagi', name: 'うさぎ', rarity: 'C', likes: 'にんじん' },
    { id: 'kuma', name: 'くま', rarity: 'C', likes: 'はちみつ' },
    { id: 'hiyoko', name: 'ひよこ', rarity: 'C', likes: 'ぴよぴよ' },
    { id: 'buta', name: 'ぶた', rarity: 'C', likes: 'どろあそび' },
    { id: 'nezumi', name: 'ねずみ', rarity: 'C', likes: 'チーズ' },
    { id: 'kaeru', name: 'かえる', rarity: 'C', likes: 'あまがえり' },
    { id: 'kitsune', name: 'きつね', rarity: 'R', likes: 'あぶらあげ' },
    { id: 'tanuki', name: 'たぬき', rarity: 'R', likes: 'おなかポンポン' },
    { id: 'panda', name: 'ぱんだ', rarity: 'R', likes: 'ささのは' },
    { id: 'hitsuji', name: 'ひつじ', rarity: 'R', likes: 'もこもこ' },
    { id: 'shirokuma', name: 'しろくま', rarity: 'R', likes: 'こおりのうえ' },
    { id: 'risu', name: 'りす', rarity: 'R', likes: 'どんぐり' },
    { id: 'lion', name: 'らいおん', rarity: 'SR', likes: 'おひるね' },
    { id: 'tora', name: 'とら', rarity: 'SR', likes: 'かけっこ' },
    { id: 'zou', name: 'ぞう', rarity: 'SR', likes: 'みずあび' },
    { id: 'penguin', name: 'ぺんぎん', rarity: 'SR', likes: 'おなかですべる' },
    { id: 'unicorn', name: 'ゆにこーん', rarity: 'UR', likes: 'にじのうえ' },
    { id: 'dragon', name: 'ちびりゅう', rarity: 'UR', likes: 'おほしさま' }
  ];

  const BY_ID = {};
  ANIMALS.forEach(function (a, i) { a.no = i + 1; BY_ID[a.id] = a; });

  function animalById(id) { return BY_ID[id] || null; }

  // ---------------------------------------------------------------- パック
  const PACKS = {
    free: { label: 'まいにちパック', price: 0, size: 5, odds: 'normal' },
    normal: { label: 'ふつうパック', price: 300, size: 5, odds: 'normal' },
    special: { label: 'スペシャルパック', price: 2000, size: 5, odds: 'special' }
  };

  // main = 1〜4 まいめ / last = 最後の 1 まい (コモンは出ない)
  const ODDS = {
    normal: {
      main: { C: 78, R: 17, SR: 4.5, UR: 0.5 },
      last: { R: 84, SR: 13.5, UR: 2.5 }
    },
    special: {
      main: { C: 45, R: 38, SR: 14, UR: 3 },
      last: { R: 55, SR: 34, UR: 11 }
    }
  };

  function rollRarity(weights, rng) {
    let sum = 0;
    RARITY_ORDER.forEach(function (r) { sum += weights[r] || 0; });
    let x = rng() * sum;
    for (let i = 0; i < RARITY_ORDER.length; i++) {
      const r = RARITY_ORDER[i];
      const w = weights[r] || 0;
      if (w <= 0) continue;
      if (x < w) return r;
      x -= w;
    }
    // 丸め誤差で外れたときは、出うるいちばん上を返す
    for (let i = RARITY_ORDER.length - 1; i >= 0; i--) {
      if ((weights[RARITY_ORDER[i]] || 0) > 0) return RARITY_ORDER[i];
    }
    return 'C';
  }

  function pickAnimal(rarity, rng) {
    const pool = ANIMALS.filter(function (a) { return a.rarity === rarity; });
    return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))].id;
  }

  /** パック 1 つぶんの動物 id を並べて返す (状態は触らない)。 */
  function rollPack(kind, rng) {
    const pack = PACKS[kind];
    const odds = ODDS[pack.odds];
    const ids = [];
    for (let i = 0; i < pack.size; i++) {
      const weights = i === pack.size - 1 ? odds.last : odds.main;
      ids.push(pickAnimal(rollRarity(weights, rng), rng));
    }
    return ids;
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
  function newState() {
    return { v: 1, money: 0, tapLevel: 0, totalTaps: 0, owned: {}, lastFreeDay: '', packsOpened: 0 };
  }

  function toCount(x, max) {
    const n = Math.floor(Number(x));
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(n, max);
  }

  /** 保存データを安全な形にそろえる (こわれていても落ちない)。 */
  function normalize(raw) {
    const s = newState();
    if (!raw || typeof raw !== 'object') return s;
    s.money = toCount(raw.money, 1e15);
    s.tapLevel = Math.min(toCount(raw.tapLevel, MAX_LEVEL), MAX_LEVEL);
    s.totalTaps = toCount(raw.totalTaps, 1e12);
    s.packsOpened = toCount(raw.packsOpened, 1e9);
    s.lastFreeDay = typeof raw.lastFreeDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastFreeDay)
      ? raw.lastFreeDay : '';
    if (raw.owned && typeof raw.owned === 'object') {
      ANIMALS.forEach(function (a) {
        const n = toCount(raw.owned[a.id], 1e6);
        if (n > 0) s.owned[a.id] = n;
      });
    }
    return s;
  }

  // ---------------------------------------------------------------- タップで稼ぐ
  const MAX_LEVEL = 15;

  function tapPower(state) { return 1 + state.tapLevel; }

  /** 次のレベルにするのに要るコイン。MAX なら null。 */
  function upgradeCost(level) {
    if (level >= MAX_LEVEL) return null;
    return Math.round(40 * Math.pow(1.55, level));
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
   * パックを開ける。お金を引き、図鑑を増やす。
   * 失敗 (もう開けた・お金が足りない) のときは何も変えない。
   */
  function openPack(state, kind, now, rng) {
    const pack = PACKS[kind];
    if (!pack) return { ok: false, reason: 'unknown' };
    if (kind === 'free') {
      if (!canOpenFree(state, now)) return { ok: false, reason: 'already' };
    } else if (state.money < pack.price) {
      return { ok: false, reason: 'money' };
    }
    const ids = rollPack(kind, rng || Math.random);
    state.money -= pack.price;
    if (kind === 'free') state.lastFreeDay = dayKey(now);
    state.packsOpened++;
    const cards = ids.map(function (id) {
      const isNew = !state.owned[id];
      state.owned[id] = (state.owned[id] || 0) + 1;
      return { id: id, isNew: isNew };
    });
    return { ok: true, cards: cards };
  }

  function collectedCount(state) {
    return ANIMALS.filter(function (a) { return state.owned[a.id] > 0; }).length;
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

  return {
    mulberry32: mulberry32,
    RARITIES: RARITIES,
    RARITY_ORDER: RARITY_ORDER,
    ANIMALS: ANIMALS,
    animalById: animalById,
    PACKS: PACKS,
    ODDS: ODDS,
    MAX_LEVEL: MAX_LEVEL,
    rollPack: rollPack,
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
    formatWait: formatWait
  };
});
