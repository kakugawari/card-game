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
 *   SR 以上の 1 まいは SR / SAR (約 5 BOX に 1) / MUR (約 50 BOX に 1) / LR (約 150 BOX に 1)。
 *   公式は確率を出していないので、開封の集計から広く言われている目安に合わせた。
 *   むりょうパックも、1 パックずつ買うパックも、お店の同じ BOX から 1 パックずつ出てくる。
 *   BOX ごと買う (buyBox) と、自分だけの新しい BOX が手もとに入る。30 パック開ければ必ず SR 以上が 1 まい。
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
    MUR: { label: 'メガウルトラレア', rank: 7, full: true, color: 'mega' },
    LR: { label: 'レジェンドレア', rank: 8, full: true, color: 'legend' }
  };
  const RARITY_ORDER = ['C', 'U', 'R', 'RR', 'AR', 'SR', 'SAR', 'MUR', 'LR'];
  /** 光の色の段。左ほど弱い。演出はこの順にしか上がらない */
  const LADDER = ['white', 'blue', 'gold', 'rainbow', 'mega', 'legend'];

  function rank(r) { return RARITIES[r].rank; }
  function ladderOf(r) { return LADDER.indexOf(RARITIES[r].color); }

  // ---------------------------------------------------------------- カード
  const SETS = Cards.SETS;
  const SET = SETS[0];
  const SET_BY_ID = {};
  SETS.forEach(function (st) { SET_BY_ID[st.id] = st; });
  function setById(id) { return SET_BY_ID[id] || null; }
  const CARDS = Cards.CARDS;
  const BY_NO = {};
  CARDS.forEach(function (c) { BY_NO[c.no] = c; });
  // POOL[パック][レア度] = そのパックの、そのレア度のカード
  const POOL = {};
  SETS.forEach(function (st) {
    POOL[st.id] = {};
    RARITY_ORDER.forEach(function (r) { POOL[st.id][r] = CARDS.filter(function (c) { return c.set === st.id && c.rarity === r; }); });
  });

  function cardByNo(no) { return BY_NO[no] || null; }

  // ---------------------------------------------------------------- BOX と パック
  const BOX_PACKS = 30;
  const PACK_SIZE = 5;
  const BOX = { RR: 4, SR_UP: 1, AR: 3 };             // 1 BOX あたり
  const SR_UP_SPLIT = { LR: 1 / 150, MUR: 1 / 50, SAR: 1 / 5 };     // 「SR 以上」の 1 まいが何になるか (BOX あたり)

  /** 新しい BOX。30 パックぶんの「レア枠」と「AR が入るか」を先に決めて混ぜる */
  function newBox(rng, setId) {
    const r = rng();
    const lr = SR_UP_SPLIT.LR, mur = lr + SR_UP_SPLIT.MUR, sar = mur + SR_UP_SPLIT.SAR;
    const top = r < lr ? 'LR' : r < mur ? 'MUR' : r < sar ? 'SAR' : 'SR';
    const tops = [top];
    for (let i = 0; i < BOX.RR; i++) tops.push('RR');
    while (tops.length < BOX_PACKS) tops.push('R');
    shuffle(tops, rng);
    const ar = [];
    for (let i = 0; i < BOX_PACKS; i++) ar.push(i < BOX.AR);
    shuffle(ar, rng);
    return { set: setId || SET.id, packs: tops.map(function (t, i) { return { top: t, ar: ar[i] }; }), next: 0 };
  }

  /** 同じレア度のカードを、パックの中で重ならないように選ぶ */
  function pick(setId, rarity, used, rng) {
    const all = POOL[setId][rarity];
    const pool = all.filter(function (c) { return !used[c.no]; });
    const from = pool.length ? pool : all;
    const c = from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
    used[c.no] = true;
    return c.no;
  }

  /** パック 1 つぶんのレア度の並び (BOX の 1 パックぶんから) */
  function packRarities(slot) {
    return ['C', 'C', 'C', slot.ar ? 'AR' : 'U', slot.top];
  }

  function rollPack(slot, rng, setId) {
    const used = {};
    const st = setId || SET.id;
    return packRarities(slot).map(function (r) { return pick(st, r, used, rng); });
  }

  // ---------------------------------------------------------------- 演出の計画
  /**
   * 出たカードの並びから、開封の見せ方を決める。
   *   tier      パックでいちばん上のレア度 (R 未満は R)
   *   omen      パックが出てきたときの予兆: none / shake / rainbow / gold / cosmos (流れ星。LR だけ)
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
    if (tier === 'LR') omen = x < 0.7 ? 'cosmos' : x < 0.9 ? 'gold' : 'rainbow';   // 流れ星は LR だけ
    else if (tier === 'MUR') omen = x < 0.7 ? 'gold' : 'rainbow';
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
  const SAVE_VERSION = 4;

  function newState() {
    return {
      v: SAVE_VERSION, money: 0, tapLevel: 0, totalTaps: 0, owned: {}, lastFreeDay: '',
      packsOpened: 0, shop: {}, boxes: [], muted: false, pets: {}
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
      return p && (p.top === 'R' || p.top === 'RR' || p.top === 'SR' || p.top === 'SAR' || p.top === 'MUR' || p.top === 'LR') &&
        typeof p.ar === 'boolean';
    });
    const next = toCount(b.next, BOX_PACKS);
    const st = setById(b.set) ? b.set : SET.id;   // 前の版の箱には set が無い (どうぶつパックだけだった)
    return ok ? { set: st, packs: b.packs.map(function (p) { return { top: p.top, ar: p.ar }; }), next: next } : null;
  }

  /** 前の版 (v1) は どうぶつの名前で図鑑を持っていた。いちばん下のレア度のカードへ移す */
  function migrateOwnedV1(owned) {
    const out = {};
    Object.keys(owned).forEach(function (chara) {
      const n = toCount(owned[chara], 1e6);
      if (!n) return;
      const base = CARDS.filter(function (c) { return c.set === SET.id && c.chara === chara; })
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
    if (raw.pets && typeof raw.pets === 'object') {
      Object.keys(CHARAS).forEach(function (ch) {
        const p = raw.pets[ch];
        if (!p || typeof p !== 'object') return;
        const day = function (d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''; };
        s.pets[ch] = { aff: toCount(p.aff, 1e6), fedDay: day(p.fedDay), fed: Math.min(toCount(p.fed, 99), DAILY_SNACKS), pettedDay: day(p.pettedDay) };
      });
    }
    let owned = raw.owned && typeof raw.owned === 'object' ? raw.owned : {};
    if (!(raw.v >= 2)) owned = migrateOwnedV1(owned);
    if (!(raw.v >= 3)) {
      // v2 までは どうぶつパックだけで、番号 (001) で持っていた → A1-001
      const o3 = {};
      Object.keys(owned).forEach(function (k) { o3[/^\d{3}$/.test(k) ? SET.code + '-' + k : k] = owned[k]; });
      owned = o3;
    }
    if (!(raw.v >= 4)) {
      // v3 までは 100 しゅるいのパックだった。シリーズ (11 パック) にまとめたとき、どうぶつパック (A1) のほかは
      // 同じ番号が別のカードになったので、持ち物は どうぶつパックだけ引き継ぐ (コインや強化は そのまま)
      const o4 = {};
      Object.keys(owned).forEach(function (k) { if (k.indexOf(SET.code + '-') === 0) o4[k] = owned[k]; });
      owned = o4;
    }
    CARDS.forEach(function (c) {
      const n = toCount(owned[c.no], 1e6);
      if (n > 0) s.owned[c.no] = n;
    });
    // お店の BOX (パックごと)。前の版は 1 つだけ (box)
    if (raw.shop && typeof raw.shop === 'object') {
      SETS.forEach(function (st) {
        const v = validBox(raw.shop[st.id]);
        if (v) { v.set = st.id; s.shop[st.id] = v; }
      });
    } else if (raw.box) {
      const v = validBox(raw.box);
      if (v) s.shop[SET.id] = v;
    }
    if (Array.isArray(raw.boxes)) {
      raw.boxes.forEach(function (b) {
        const v = validBox(b);
        if (v && v.next < BOX_PACKS && s.boxes.length < MAX_BOXES) s.boxes.push(v);
      });
    }
    return s;
  }

  // ---------------------------------------------------------------- タップで稼ぐ
  const MAX_LEVEL = 8;
  const PACK_PRICE = 500;
  const BOX_PRICE = PACK_PRICE * BOX_PACKS;   // BOX は 30 パックぶんの値段 (おまけは「SR 以上 確定」)
  const MAX_BOXES = 20;

  // 1 タップのコイン。(1 + レベル) の 1.5 倍を四捨五入 (コインは整数): 2・3・5・6・8・9・11・12・14
  function tapPowerAt(level) { return Math.round((1 + level) * 1.5); }
  function tapPower(state) { return tapPowerAt(state.tapLevel); }

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

  /** BOX ごと買う。手もとに 30 パック入りの新しい BOX が入る (お店の BOX とは別) */
  function buyBox(state, rng, setId) {
    if (state.money < BOX_PRICE) return { ok: false, reason: 'money' };
    if (state.boxes.length >= MAX_BOXES) return { ok: false, reason: 'full' };
    state.money -= BOX_PRICE;
    state.boxes.push(newBox(rng || Math.random, setById(setId) ? setId : SET.id));
    return { ok: true };
  }

  /** 手もとの BOX に残っているパックの数 (setId を渡すと、そのパックの BOX だけ) */
  function packsInHand(state, setId) {
    return state.boxes.reduce(function (n, b) { return n + (!setId || b.set === setId ? BOX_PACKS - b.next : 0); }, 0);
  }

  /** そのパックの、手もとの 1 箱目 */
  function boxInHand(state, setId) {
    return state.boxes.find(function (b) { return b.set === setId; }) || null;
  }

  /** 手もとの BOX (いま開けている 1 箱目) から、SR 以上がもう出たか */
  function boxStatus(box) {
    if (!box) return null;
    let srUp = false;
    for (let i = 0; i < box.next; i++) if (rank(box.packs[i].top) >= rank('SR')) srUp = true;
    return { left: BOX_PACKS - box.next, srUpOut: srUp };
  }

  /**
   * パックを開ける。BOX から 1 パック出し、お金を引き、図鑑を増やす。
   * kind: 'free' (毎日のむりょう) / 'buy' (コインで 1 パック買う) / 'box' (手もとの BOX から)
   * 失敗 (もう開けた・お金が足りない・BOX が無い) のときは何も変えない。
   */
  function openPack(state, kind, now, rng, setId) {
    rng = rng || Math.random;
    const st = setById(setId) ? setId : SET.id;
    if (kind === 'free') {
      if (!canOpenFree(state, now)) return { ok: false, reason: 'already' };
    } else if (kind === 'buy') {
      if (state.money < PACK_PRICE) return { ok: false, reason: 'money' };
    } else if (kind === 'box') {
      if (!boxInHand(state, st)) return { ok: false, reason: 'nobox' };
    } else {
      return { ok: false, reason: 'unknown' };
    }
    let box;
    if (kind === 'box') {
      box = boxInHand(state, st);
    } else {
      if (!state.shop[st] || state.shop[st].next >= BOX_PACKS) state.shop[st] = newBox(rng, st);
      box = state.shop[st];
    }
    const slot = box.packs[box.next];
    box.next++;
    const rarities = packRarities(slot);
    const nos = rollPack(slot, rng, st);

    if (kind === 'buy') state.money -= PACK_PRICE;
    else if (kind === 'free') state.lastFreeDay = dayKey(now);
    if (kind === 'box' && box.next >= BOX_PACKS) state.boxes.splice(state.boxes.indexOf(box), 1);   // 空になった箱はしまう
    state.packsOpened++;
    const cards = nos.map(function (no) {
      const isNew = !state.owned[no];
      state.owned[no] = (state.owned[no] || 0) + 1;
      return { no: no, isNew: isNew };
    });
    return { ok: true, cards: cards, show: makeShow(rarities, rng), boxLeft: BOX_PACKS - box.next, kind: kind, set: st };
  }

  /**
   * 手もとの BOX (1 箱目) の残りを、まとめて全部開ける。
   * 返すもの: packs (1 パックずつの結果) と、演出で見せるレアだけを並べたもの (bulkHighlights)
   */
  function openBoxAll(state, now, rng, setId) {
    const st = setById(setId) ? setId : SET.id;
    const box = boxInHand(state, st);
    if (!box) return { ok: false, reason: 'nobox' };
    const packs = [];
    while (state.boxes.indexOf(box) >= 0) packs.push(openPack(state, 'box', now, rng || Math.random, st));
    return Object.assign({ ok: true, packs: packs, set: st }, bulkHighlights(packs));
  }

  /**
   * まとめて開けた結果から、演出で 1 まいずつ見せるカード (RR 以上と AR) を選ぶ。
   * 弱い順に並べて、いちばん良いカードが最後に来るようにする。演出のしかたは、そのパックの計画をそのまま使う
   */
  function bulkHighlights(packs) {
    const items = [];
    const counts = {};
    const newNos = [];
    packs.forEach(function (p) {
      p.cards.forEach(function (c, i) {
        const r = BY_NO[c.no].rarity;
        counts[r] = (counts[r] || 0) + 1;
        if (c.isNew) newNos.push(c.no);
        const sp = p.show.specials.find(function (x) { return x.index === i; });
        if (sp) items.push({ card: c, sp: sp });
      });
    });
    items.sort(function (a, b) { return rank(a.sp.rarity) - rank(b.sp.rarity); });   // 同じレア度は開けた順のまま
    return {
      cards: items.map(function (x) { return x.card; }),
      show: {
        tier: items.length ? items[items.length - 1].sp.rarity : 'R',
        omen: 'none',
        tearLight: 'white',
        specials: items.map(function (x, i) { return Object.assign({}, x.sp, { index: i }); })
      },
      counts: counts,
      newNos: newNos
    };
  }

  function collectedCount(state, filter) {
    return CARDS.filter(function (c) { return (!filter || filter(c)) && state.owned[c.no] > 0; }).length;
  }

  // ---------------------------------------------------------------- なかよし (お気に入り・おやつ)
  /*
   * ひろばを歩いている子をタップすると、おやつ (コイン) と なでる (1 日 1 回・ただ) で なかよし度が上がる。おやつは 1 人 1 日 3 こまで (おなか いっぱい)。
   * なかよし度はお金に戻らない (おやつで得をする道を作らない)。レベルが上がると、できることが増える (はねる・まわる・かんむり)
   */
  const CHARAS = Cards.CHARAS;
  const DAILY_SNACKS = 3;
  const SNACKS = {
    apple: { name: 'りんご', icon: '🍎', price: 30, aff: 1 },
    cookie: { name: 'クッキー', icon: '🍪', price: 80, aff: 3 },
    fav: { name: 'だいこうぶつ', icon: '', price: 150, aff: 6 }   // 名前と絵はキャラごと (CHARAS)
  };
  const PET_LEVELS = [0, 5, 15, 30, 55];   // なかよしレベル 1〜5 になる なかよし度

  function ownedCharas(state) {
    const out = {};
    CARDS.forEach(function (c) { if (state.owned[c.no] > 0) out[c.chara] = true; });
    return out;
  }

  function petLevel(aff) {
    let lv = 1;
    for (let i = 1; i < PET_LEVELS.length; i++) if (aff >= PET_LEVELS[i]) lv = i + 1;
    return lv;
  }

  function petOf(state, chara) {
    if (!state.pets[chara]) state.pets[chara] = { aff: 0, fedDay: '', fed: 0, pettedDay: '' };
    return state.pets[chara];
  }

  /** なかよしの様子 (画面用)。状態は変えない */
  function petInfo(state, chara, now) {
    const p = state.pets[chara] || { aff: 0, fedDay: '', fed: 0, pettedDay: '' };
    const lv = petLevel(p.aff);
    const today = dayKey(now);
    const from = PET_LEVELS[lv - 1];
    const to = lv < PET_LEVELS.length ? PET_LEVELS[lv] : null;
    return {
      aff: p.aff, level: lv, maxLevel: PET_LEVELS.length,
      progress: to === null ? 1 : (p.aff - from) / (to - from), toNext: to === null ? 0 : to - p.aff,
      fedToday: p.fedDay === today ? p.fed : 0, snacksLeft: DAILY_SNACKS - (p.fedDay === today ? p.fed : 0),
      canPet: p.pettedDay !== today
    };
  }

  function addAff(state, chara, gain) {
    const p = petOf(state, chara);
    const before = petLevel(p.aff);
    p.aff += gain;
    const after = petLevel(p.aff);
    return { gain: gain, level: after, levelUp: after > before };
  }

  /** おやつをあげる。持っている子だけ・お金が足りるときだけ・1 日 3 こまで。失敗は何も変えない */
  function feed(state, chara, snackId, now) {
    const sn = SNACKS[snackId];
    if (!sn) return { ok: false, reason: 'unknown' };
    if (!ownedCharas(state)[chara]) return { ok: false, reason: 'notOwned' };
    if (petInfo(state, chara, now).snacksLeft <= 0) return { ok: false, reason: 'full' };
    if (state.money < sn.price) return { ok: false, reason: 'money' };
    state.money -= sn.price;
    const p = petOf(state, chara);
    const today = dayKey(now);
    if (p.fedDay !== today) { p.fedDay = today; p.fed = 0; }
    p.fed++;
    return Object.assign({ ok: true, snack: snackId }, addAff(state, chara, sn.aff));
  }

  /** なでる。1 日 1 回、なかよし度 +1 (ただ) */
  function pet(state, chara, now) {
    if (!ownedCharas(state)[chara]) return { ok: false, reason: 'notOwned' };
    const p = petOf(state, chara);
    const today = dayKey(now);
    if (p.pettedDay === today) return { ok: false, reason: 'already' };
    p.pettedDay = today;
    return Object.assign({ ok: true }, addAff(state, chara, 1));
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

  function numberLabel(card) { return card.num + '/' + String(SET_BY_ID[card.set].mainCount).padStart(3, '0'); }

  return {
    mulberry32: mulberry32,
    RARITIES: RARITIES,
    RARITY_ORDER: RARITY_ORDER,
    LADDER: LADDER,
    SET: SET,
    SETS: SETS,
    setById: setById,
    boxInHand: boxInHand,
    CARDS: CARDS,
    POOL: POOL,
    cardByNo: cardByNo,
    BOX_PACKS: BOX_PACKS,
    PACK_SIZE: PACK_SIZE,
    PACK_PRICE: PACK_PRICE,
    BOX_PRICE: BOX_PRICE,
    MAX_BOXES: MAX_BOXES,
    buyBox: buyBox,
    openBoxAll: openBoxAll,
    bulkHighlights: bulkHighlights,
    packsInHand: packsInHand,
    boxStatus: boxStatus,
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
    tapPowerAt: tapPowerAt,
    upgradeCost: upgradeCost,
    tap: tap,
    buyUpgrade: buyUpgrade,
    canOpenFree: canOpenFree,
    openPack: openPack,
    collectedCount: collectedCount,
    CATS: Cards.CATS,
    formatMoney: formatMoney,
    formatWait: formatWait,
    numberLabel: numberLabel,
    CHARAS: CHARAS,
    DAILY_SNACKS: DAILY_SNACKS,
    SNACKS: SNACKS,
    PET_LEVELS: PET_LEVELS,
    ownedCharas: ownedCharas,
    petLevel: petLevel,
    petInfo: petInfo,
    feed: feed,
    pet: pet
  };
});
