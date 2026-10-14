/*!
 * cards.js — カードの一覧 (データだけ)。
 *
 * ★ 絵を差し替えるとき
 *   art に画像の場所を書く (例: 'art/001.png')。空なら仮の絵 (animals.js) が出る。
 *   ・ふつうの枠 (C U R RR)        … イラストの窓は 横4:縦3   (おすすめ 800 x 600)
 *   ・全面イラスト (AR SR SAR MUR LR) … カード全体   横63:縦88 (おすすめ 750 x 1048)
 *     下 1/3 に説明の帯が重なるので、顔は上の方に
 *   illus に描いた人の名前を書くと、カードの右下に出る
 *
 * ★ 番号
 *   パック (SETS) ごとに 001 から。C〜RR が通常のカードで、AR 以上は「シークレット」として
 *   番号が通常の数を越える (ポケモンカードと同じ数え方: 021/020)。
 *   ゲームの中では「パックの記号-番号」(A1-021) で 1 まいを見分ける
 *
 * ★ パックを増やすとき
 *   SETS に 1 つ足す。どのレア度にも 1 まい以上、C は 3 まい以上 (1 パックに C が 3 まい入るため)。
 *   仮の絵が要るキャラは animals.js にも足す
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.Cards = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SETS = [
    {
      id: 'animal', cat: 'mori', scene: 'forest', code: 'A1', name: 'どうぶつパック', title: 'はじめましての もり', mark: '🐾',
      colors: ['#ff9fc6', '#ffb27a', '#ffe27a'], mascots: ['usagi', 'neko', 'dragon'],
      cards: [
      // ---------------------------------------------------- C コモン
      { no: '001', chara: 'neko', name: 'ねこ', rarity: 'C', kind: 'ひなたぼっこ どうぶつ',
        text: 'おひさまの あたる ばしょを みつける めいじん。しっぽの うごきで きもちを おしえてくれる。' },
      { no: '002', chara: 'inu', name: 'いぬ', rarity: 'C', kind: 'おさんぽ どうぶつ',
        text: 'おさんぽの じかんを ぜったいに わすれない。うれしいと しっぽが プロペラみたいに まわる。' },
      { no: '003', chara: 'usagi', name: 'うさぎ', rarity: 'C', kind: 'ながみみ どうぶつ',
        text: 'ながい みみで とおくの ないしょばなしまで きこえる。にんじんは さきっぽから たべる。' },
      { no: '004', chara: 'kuma', name: 'くま', rarity: 'C', kind: 'もりの どうぶつ',
        text: 'はちみつの においなら 3つ むこうの やまでも わかる。だっこが とても じょうず。' },
      { no: '005', chara: 'hiyoko', name: 'ひよこ', rarity: 'C', kind: 'ぴよぴよ どうぶつ',
        text: 'うまれた ばかりで せかいが ぜんぶ ふしぎ。はじめて みた ものに ついていく。' },
      { no: '006', chara: 'buta', name: 'ぶた', rarity: 'C', kind: 'はなが いい どうぶつ',
        text: 'まんまるの はなで おいしい ものを さがしあてる。どろんこの あとは ちゃんと おふろ。' },
      { no: '007', chara: 'nezumi', name: 'ねずみ', rarity: 'C', kind: 'ちょこちょこ どうぶつ',
        text: 'ちいさな からだで すばやく はしる。チーズの あなは ぜんぶ じぶんで かぞえた。' },
      { no: '008', chara: 'kaeru', name: 'かえる', rarity: 'C', kind: 'あめふり どうぶつ',
        text: 'あめの ひが いちばん げんき。ケロケロの うたで みんなに あめを しらせる。' },
      // ---------------------------------------------------- U アンコモン
      { no: '009', chara: 'kitsune', name: 'きつね', rarity: 'U', kind: 'ふさふさ どうぶつ',
        text: 'ふさふさの しっぽが じまん。ゆきの したの おとを ききわけて ジャンプする。' },
      { no: '010', chara: 'tanuki', name: 'たぬき', rarity: 'U', kind: 'はっぱ どうぶつ',
        text: 'あたまに はっぱを のせると なにかに へんしん できる…と しんじている。' },
      { no: '011', chara: 'panda', name: 'ぱんだ', rarity: 'U', kind: 'ささのは どうぶつ',
        text: '1にちの はんぶんは たべて、のこりの はんぶんは ねている。ころがるのが すき。' },
      { no: '012', chara: 'hitsuji', name: 'ひつじ', rarity: 'U', kind: 'もこもこ どうぶつ',
        text: 'もこもこの けは さわると くもみたいに やわらかい。かぞえると みんな ねむくなる。' },
      { no: '013', chara: 'shirokuma', name: 'しろくま', rarity: 'U', kind: 'こおりの どうぶつ',
        text: 'さむい ところが だいすき。おきにいりの あかい マフラーは おばあちゃんの てあみ。' },
      { no: '014', chara: 'risu', name: 'りす', rarity: 'U', kind: 'どんぐり どうぶつ',
        text: 'ふゆに そなえて どんぐりを うめる。うめた ばしょを わすれて もりが ふえる。' },
      // ---------------------------------------------------- R レア
      { no: '015', chara: 'lion', name: 'らいおん', rarity: 'R', kind: 'たてがみ どうぶつ',
        text: 'りっぱな たてがみの もりの リーダー。ほんとうは おひるねの じかんが いちばん すき。' },
      { no: '016', chara: 'tora', name: 'とら', rarity: 'R', kind: 'しましま どうぶつ',
        text: 'しましまの もようは ひとりずつ ちがう。かけっこでは まだ いちども まけていない。' },
      { no: '017', chara: 'zou', name: 'ぞう', rarity: 'R', kind: 'ながい はな どうぶつ',
        text: 'ながい はなで みずを すいこみ、シャワーに する。おおきな みみで うちわも できる。' },
      { no: '018', chara: 'penguin', name: 'ぺんぎん', rarity: 'R', kind: 'こおりの うみの どうぶつ',
        text: 'そらは とべないけれど、うみの なかでは とぶように およぐ。おなかで すべるのが とくい。' },
      // ---------------------------------------------------- RR ダブルレア
      { no: '019', chara: 'unicorn', name: 'ゆにこーん', rarity: 'RR', kind: 'にじの どうぶつ',
        text: 'つのが ひかると、そらに にじが かかる。やさしい こころの こにだけ すがたを みせる。' },
      { no: '020', chara: 'dragon', name: 'ちびりゅう', rarity: 'RR', kind: 'ほしの どうぶつ',
        text: 'ながれぼしから うまれた ちいさな りゅう。ちいさな はねで いっしょうけんめい とぶ。' },
      // ---------------------------------------------------- AR アートレア (ここからシークレット)
      { no: '021', chara: 'neko', name: 'ねこ', rarity: 'AR', kind: 'ひなたぼっこ どうぶつ',
        text: 'まどべの ひだまりで おひるね ちゅう。ゆめの なかでも しっぽが ゆれている。' },
      { no: '022', chara: 'usagi', name: 'うさぎ', rarity: 'AR', kind: 'ながみみ どうぶつ',
        text: 'おつきさまの したで ぴょんと ひとっとび。みみの さきに つきの ひかりが とまった。' },
      { no: '023', chara: 'hiyoko', name: 'ひよこ', rarity: 'AR', kind: 'ぴよぴよ どうぶつ',
        text: 'はじめて みた はるの のはら。たんぽぽと せくらべを している。' },
      { no: '024', chara: 'kaeru', name: 'かえる', rarity: 'AR', kind: 'あめふり どうぶつ',
        text: 'あじさいの はっぱの かさで あまやどり。あめつぶの おとに あわせて うたう。' },
      { no: '025', chara: 'panda', name: 'ぱんだ', rarity: 'AR', kind: 'ささのは どうぶつ',
        text: 'たけばやしで ささの はっぱの おふとん。かぜが ふくと ゆりかごに なる。' },
      { no: '026', chara: 'kitsune', name: 'きつね', rarity: 'AR', kind: 'ふさふさ どうぶつ',
        text: 'はじめての ゆきの あさ。じぶんの あしあとを ふりかえって よろこんでいる。' },
      // ---------------------------------------------------- SR スーパーレア
      { no: '027', chara: 'lion', name: 'らいおん', rarity: 'SR', kind: 'たてがみ どうぶつ',
        text: 'ゆうひの おかの うえで ひと声 ほえると、もりじゅうの みんなが あつまってくる。' },
      { no: '028', chara: 'penguin', name: 'ぺんぎん', rarity: 'SR', kind: 'こおりの うみの どうぶつ',
        text: 'オーロラの したを なかまと いっしょに すべっていく。きょうは とくべつな よる。' },
      { no: '029', chara: 'unicorn', name: 'ゆにこーん', rarity: 'SR', kind: 'にじの どうぶつ',
        text: 'にじの はしを わたって、くもの うえの おしろへ かえる ところ。' },
      { no: '030', chara: 'dragon', name: 'ちびりゅう', rarity: 'SR', kind: 'ほしの どうぶつ',
        text: 'はじめて よぞらを ひとりで とんだ よる。ほしたちが みちを てらしてくれた。' },
      // ---------------------------------------------------- SAR スペシャルアートレア
      { no: '031', chara: 'unicorn', name: 'ゆにこーん', rarity: 'SAR', kind: 'にじの どうぶつ',
        text: 'もりの みんなを せなかに のせて、にじの むこうの おまつりへ。きょうは みんなの とくべつな ひ。' },
      { no: '032', chara: 'dragon', name: 'ちびりゅう', rarity: 'SAR', kind: 'ほしの どうぶつ',
        text: 'ほしの うみで ねむる ちびりゅう。だいじな なかまの ゆめを ひとつずつ ほしに かえている。' },
      // ---------------------------------------------------- MUR メガウルトラレア
      { no: '033', chara: 'dragon', name: 'おうごんの ちびりゅう', rarity: 'MUR', kind: 'でんせつの どうぶつ',
        text: '1000ねんに いちど、ながれぼしの よるに だけ あらわれる。みた ひとの ねがいが ひとつ かなう。' },
      { no: '034', chara: 'dragon', name: 'でんせつの ちびりゅう', rarity: 'LR', kind: 'レジェンドの どうぶつ',
        text: 'ほしの うみを こえて かえってきた ちびりゅう。つばさを ひろげると よぞらが にじいろに なる。' }
      ]
    },
    {
      id: 'sea', cat: 'umi', scene: 'sea', code: 'S1', name: 'さかなパック', title: 'うみの なかまたち', mark: '🐟',
      colors: ['#8fe0ff', '#4fa8e8', '#7fe3c8'], mascots: ['kumanomi', 'tako', 'iruka'],
      cards: [
      { no: '001', chara: 'kingyo', name: 'きんぎょ', rarity: 'C', kind: 'おまつり さかな',
        text: 'ひらひらの しっぽで すいすい およぐ。おまつりの よみせが だいすき。' },
      { no: '002', chara: 'kumanomi', name: 'くまのみ', rarity: 'C', kind: 'しましま さかな',
        text: 'イソギンチャクの おうちに すんでいる。しろい しましまが じまん。' },
      { no: '003', chara: 'fugu', name: 'ふぐ', rarity: 'C', kind: 'まんまる さかな',
        text: 'びっくりすると ぷくっと ふくらむ。ほんとうは とても こわがり。' },
      { no: '004', chara: 'tako', name: 'たこ', rarity: 'C', kind: 'すみ さかな',
        text: '8ほんの あしで いっぺんに 8こ あくしゅ できる。すみで おえかきも する。' },
      { no: '005', chara: 'kurage', name: 'くらげ', rarity: 'U', kind: 'ふわふわ さかな',
        text: 'うみの なかを ゆらゆら おさんぽ。つきの よるは ほんのり ひかる。' },
      { no: '006', chara: 'kani', name: 'かに', rarity: 'U', kind: 'はさみ さかな',
        text: 'よこあるきの めいじん。はさみで チョキチョキ じゃんけんを する。' },
      { no: '007', chara: 'iruka', name: 'いるか', rarity: 'U', kind: 'ジャンプ さかな',
        text: 'なみの うえを たかく ジャンプ。なかまと うたで おはなしする。' },
      { no: '008', chara: 'manta', name: 'マンタ', rarity: 'R', kind: 'おおきな さかな',
        text: 'おおきな ひれで うみを とぶように およぐ。せなかに のせてくれる。' },
      { no: '009', chara: 'kujira', name: 'くじら', rarity: 'R', kind: 'しおふき さかな',
        text: 'あたまの あなから しおを ふく。うみで いちばん おおきな こえで うたう。' },
      { no: '010', chara: 'nijiuo', name: 'にじいろうお', rarity: 'RR', kind: 'ひかりの さかな',
        text: 'うろこが にじいろに ひかる ふしぎな さかな。みつけると いいことが ある。' },
      { no: '011', chara: 'kumanomi', name: 'くまのみ', rarity: 'AR', kind: 'しましま さかな',
        text: 'イソギンチャクの なかで かくれんぼ。しっぽだけ でている。' },
      { no: '012', chara: 'tako', name: 'たこ', rarity: 'AR', kind: 'すみ さかな',
        text: 'うみの そこで すみの おえかき。きょうは なかまの にがおえ。' },
      { no: '013', chara: 'kurage', name: 'くらげ', rarity: 'AR', kind: 'ふわふわ さかな',
        text: 'まんげつの よる、くらげたちが いっせいに ひかりはじめた。' },
      { no: '014', chara: 'kujira', name: 'くじら', rarity: 'SR', kind: 'しおふき さかな',
        text: 'ゆうやけの うみで しおを ふく。しおの なかに にじが かかった。' },
      { no: '015', chara: 'nijiuo', name: 'にじいろうお', rarity: 'SR', kind: 'ひかりの さかな',
        text: 'うみの いちばん ふかい ところで、ひとりで にじいろに ひかっている。' },
      { no: '016', chara: 'nijiuo', name: 'にじいろうお', rarity: 'SAR', kind: 'ひかりの さかな',
        text: 'うみの なかまたちが あつまって、にじいろの パレードが はじまった。' },
      { no: '017', chara: 'nijiuo', name: 'おうごんの にじいろうお', rarity: 'MUR', kind: 'でんせつの さかな',
        text: '100ねんに いちど、きんいろの うろこを ひとつだけ うみに おとしていく。' },
      { no: '018', chara: 'nijiuo', name: 'でんせつの にじいろうお', rarity: 'LR', kind: 'レジェンドの さかな',
        text: 'うみの いちばん ふかい ところで ねむる でんせつ。めを さますと うみが ほしぞらに かわる。' }
      ]
    },
    {
      id: 'bird', cat: 'sora', scene: 'sky', code: 'B1', name: 'とりパック', title: 'そらの なかまたち', mark: '🐦',
      colors: ['#c8f5a8', '#7fd8a0', '#fff2a0'], mascots: ['inko', 'fukurou', 'hinotori'],
      cards: [
      { no: '001', chara: 'suzume', name: 'すずめ', rarity: 'C', kind: 'ちゅんちゅん とり',
        text: 'あさいちばんに ちゅんちゅん うたう。パンくずを みつける めいじん。' },
      { no: '002', chara: 'niwatori', name: 'にわとり', rarity: 'C', kind: 'あさの とり',
        text: 'コケコッコーで みんなを おこす。とさかの あかいろが じまん。' },
      { no: '003', chara: 'ahiru', name: 'あひる', rarity: 'C', kind: 'がーがー とり',
        text: 'おしりを ふりふり あるく。いけで およぐのが いちばん すき。' },
      { no: '004', chara: 'hato', name: 'はと', rarity: 'C', kind: 'ぽっぽ とり',
        text: 'くびの いろが みる むきで かわる。てがみを とどける のが とくい。' },
      { no: '005', chara: 'fukurou', name: 'ふくろう', rarity: 'U', kind: 'よるの とり',
        text: 'よるの もりの ものしり はかせ。くびが くるっと うしろまで まわる。' },
      { no: '006', chara: 'inko', name: 'いんこ', rarity: 'U', kind: 'おしゃべり とり',
        text: 'きいた ことばを まねっこ する。いちばん すきな ことばは「おはよう」。' },
      { no: '007', chara: 'tsuru', name: 'つる', rarity: 'U', kind: 'ながあし とり',
        text: 'すらっと ながい あしで そっと あるく。1000わ あつまると ねがいが かなう。' },
      { no: '008', chara: 'kujaku', name: 'くじゃく', rarity: 'R', kind: 'はなやか とり',
        text: 'しっぽの はねを ひろげると、めだまもようが きらきら ひかる。' },
      { no: '009', chara: 'flamingo', name: 'フラミンゴ', rarity: 'R', kind: 'いっぽんあし とり',
        text: 'かたあしで たったまま ねむれる。ピンクいろは たべものの いろ。' },
      { no: '010', chara: 'hinotori', name: 'ひのとり', rarity: 'RR', kind: 'ほのおの とり',
        text: 'ほのおの はねで そらを とぶ。さわっても あつくない やさしい ひ。' },
      { no: '011', chara: 'suzume', name: 'すずめ', rarity: 'AR', kind: 'ちゅんちゅん とり',
        text: 'でんせんの うえに なかよく ならんで、ゆうやけを みている。' },
      { no: '012', chara: 'ahiru', name: 'あひる', rarity: 'AR', kind: 'がーがー とり',
        text: 'おかあさんの うしろを あかちゃんが いちれつで ついていく。' },
      { no: '013', chara: 'fukurou', name: 'ふくろう', rarity: 'AR', kind: 'よるの とり',
        text: 'まんげつの まえで、ほんを よみながら よふかし ちゅう。' },
      { no: '014', chara: 'kujaku', name: 'くじゃく', rarity: 'SR', kind: 'はなやか とり',
        text: 'はなばたけの まんなかで、いちばん おおきく はねを ひろげた。' },
      { no: '015', chara: 'hinotori', name: 'ひのとり', rarity: 'SR', kind: 'ほのおの とり',
        text: 'よぞらを まっかに そめながら、ながれぼしと ならんで とぶ。' },
      { no: '016', chara: 'hinotori', name: 'ひのとり', rarity: 'SAR', kind: 'ほのおの とり',
        text: 'そらの とりたちが みんなで ひのとりを かこんで、おいわいの ダンス。' },
      { no: '017', chara: 'hinotori', name: 'おうごんの ひのとり', rarity: 'MUR', kind: 'でんせつの とり',
        text: 'きんいろの はねが いちまい おちてきたら、それは ひのとりの おくりもの。' },
      { no: '018', chara: 'hinotori', name: 'でんせつの ひのとり', rarity: 'LR', kind: 'レジェンドの とり',
        text: 'ひと はばたきで よるが あけて、ふた はばたきで にじが かかる。' }
      ]
    },
    {
      id: 'dino', cat: 'mukashi', scene: 'dino', code: 'D1', name: 'きょうりゅうパック', title: 'むかしむかしの なかま', mark: '🦖',
      colors: ['#b8e88a', '#e0b060', '#ff9a5a'], mascots: ['tirano', 'torikera', 'putera'],
      cards: [
      { no: '001', chara: 'tirano', name: 'ちびティラノ', rarity: 'C', kind: 'がおー きょうりゅう',
        text: 'おおきな こえで がおー。でも てが みじかくて、ばんざいが とどかない。' },
      { no: '002', chara: 'torikera', name: 'トリケラ', rarity: 'C', kind: 'つの きょうりゅう',
        text: '3ぼんの つのと えりまきが じまん。なかまを まもる やさしい こ。' },
      { no: '003', chara: 'sutego', name: 'ステゴ', rarity: 'C', kind: 'いた きょうりゅう',
        text: 'せなかの いたで おひさまの ひかりを あつめて ぽかぽか。' },
      { no: '004', chara: 'putera', name: 'プテラ', rarity: 'C', kind: 'そら きょうりゅう',
        text: 'おおきな つばさで そらを すいーっと すべる。うみの さかなが すき。' },
      { no: '005', chara: 'burakio', name: 'ブラキオ', rarity: 'U', kind: 'のっぽ きょうりゅう',
        text: 'ながい くびで いちばん たかい きの はっぱを たべる。' },
      { no: '006', chara: 'ankiro', name: 'アンキロ', rarity: 'U', kind: 'よろい きょうりゅう',
        text: 'かたい よろいと しっぽの こぶで みを まもる。ねがえりは にがて。' },
      { no: '007', chara: 'pakike', name: 'パキケファロ', rarity: 'U', kind: 'いしあたま きょうりゅう',
        text: 'かたい あたまで ごっつん あいさつ。なかよしの しるし。' },
      { no: '008', chara: 'supino', name: 'スピノ', rarity: 'R', kind: 'ほかけ きょうりゅう',
        text: 'せなかの ほで かぜを うけて、かわを すいすい およぐ。' },
      { no: '009', chara: 'raputoru', name: 'ラプトル', rarity: 'R', kind: 'はやあし きょうりゅう',
        text: 'かけっこが とても はやい。なかまと ちからを あわせて かりを する。' },
      { no: '010', chara: 'kohaku', name: 'こはくりゅう', rarity: 'RR', kind: 'たからもの きょうりゅう',
        text: 'こはくの なかで ねむっていた。めを さますと からだが きらきら ひかる。' },
      { no: '011', chara: 'tirano', name: 'ちびティラノ', rarity: 'AR', kind: 'がおー きょうりゅう',
        text: 'はじめての がおー。でも でてきたのは ちいさな くしゃみ だった。' },
      { no: '012', chara: 'torikera', name: 'トリケラ', rarity: 'AR', kind: 'つの きょうりゅう',
        text: 'かぞくみんなで まるく なって、ゆうひを ながめている。' },
      { no: '013', chara: 'burakio', name: 'ブラキオ', rarity: 'AR', kind: 'のっぽ きょうりゅう',
        text: 'ながい くびを すべりだいに して、なかまを あそばせている。' },
      { no: '014', chara: 'supino', name: 'スピノ', rarity: 'SR', kind: 'ほかけ きょうりゅう',
        text: 'おおきな かわの まんなかで、ほを たてて ゆうゆうと およぐ。' },
      { no: '015', chara: 'kohaku', name: 'こはくりゅう', rarity: 'SR', kind: 'たからもの きょうりゅう',
        text: 'かざんの ひかりを あびて、からだの こはくが あかく かがやいた。' },
      { no: '016', chara: 'kohaku', name: 'こはくりゅう', rarity: 'SAR', kind: 'たからもの きょうりゅう',
        text: 'むかしむかしの もりで、きょうりゅうたちと いっしょに おひるね。' },
      { no: '017', chara: 'kohaku', name: 'おうごんの こはくりゅう', rarity: 'MUR', kind: 'でんせつの きょうりゅう',
        text: '1おくねん ねむっていた たからもの。きんいろの こはくに ねがいが とじこめてある。' },
      { no: '018', chara: 'kohaku', name: 'でんせつの こはくりゅう', rarity: 'LR', kind: 'レジェンドの きょうりゅう',
        text: '1おくねんの ひかりを とじこめた こはくから めざめた。しっぽで ながれぼしを うつ。' }
      ]
    },
    {
      id: 'ghost', cat: 'yoru', scene: 'night', code: 'G1', name: 'おばけパック', title: 'よるの なかまたち', mark: '👻',
      colors: ['#9a8ae8', '#4a3a8a', '#c39bff'], mascots: ['shiroobake', 'kabocha', 'majoneko'],
      cards: [
      { no: '001', chara: 'shiroobake', name: 'しろおばけ', rarity: 'C', kind: 'ふわふわ おばけ',
        text: 'こわがらせるのが にがて。「ばあ」の れんしゅうを まいばん している。' },
      { no: '002', chara: 'kabocha', name: 'かぼちゃおばけ', rarity: 'C', kind: 'ハロウィン おばけ',
        text: 'ハロウィンの よるだけ めを さます。おかしを くれると にっこり する。' },
      { no: '003', chara: 'chouchin', name: 'ちょうちんおばけ', rarity: 'C', kind: 'あかり おばけ',
        text: 'くらい みちを あかるく てらして くれる。べろを だすのが くせ。' },
      { no: '004', chara: 'nekoobake', name: 'ねこおばけ', rarity: 'C', kind: 'にゃん おばけ',
        text: 'ねこの すがたの おばけ。かべを すりぬけて ねこじゃらしを おいかける。' },
      { no: '005', chara: 'koumori', name: 'こうもり', rarity: 'U', kind: 'さかさま おばけ',
        text: 'さかさまに ぶらさがって ねる。よるの そらの あんないやく。' },
      { no: '006', chara: 'miira', name: 'ミイラくん', rarity: 'U', kind: 'ぐるぐる おばけ',
        text: 'ほうたいが ほどけると はずかしがる。まきなおしを てつだって あげよう。' },
      { no: '007', chara: 'yukiobake', name: 'ゆきおばけ', rarity: 'U', kind: 'ひんやり おばけ',
        text: 'ふゆの よるに あらわれて、まどに ゆきの けっしょうを えがいていく。' },
      { no: '008', chara: 'majoneko', name: 'まじょねこ', rarity: 'R', kind: 'まほう おばけ',
        text: 'まじょの おとも。ほうきに のって、まんげつの そらを さんぽする。' },
      { no: '009', chara: 'gaikotsu', name: 'がいこつくん', rarity: 'R', kind: 'カタカタ おばけ',
        text: 'ほねを カタカタ ならして おどる。ダンスが とても じょうず。' },
      { no: '010', chara: 'obakeou', name: 'おばけのおうさま', rarity: 'RR', kind: 'おうさま おばけ',
        text: 'よるの おしろの おうさま。おばけたちの パーティーを ひらく。' },
      { no: '011', chara: 'shiroobake', name: 'しろおばけ', rarity: 'AR', kind: 'ふわふわ おばけ',
        text: 'ハロウィンの まちで、こどもたちに まざって おかしを もらっている。' },
      { no: '012', chara: 'kabocha', name: 'かぼちゃおばけ', rarity: 'AR', kind: 'ハロウィン おばけ',
        text: 'かぼちゃばたけの まんなかで、なかまの かぼちゃと せくらべ。' },
      { no: '013', chara: 'koumori', name: 'こうもり', rarity: 'AR', kind: 'さかさま おばけ',
        text: 'まんげつに むかって、なかまと いっしょに とびたった。' },
      { no: '014', chara: 'majoneko', name: 'まじょねこ', rarity: 'SR', kind: 'まほう おばけ',
        text: 'まほうの なべを ぐるぐる。きょうの まほうは ほしの あめ。' },
      { no: '015', chara: 'obakeou', name: 'おばけのおうさま', rarity: 'SR', kind: 'おうさま おばけ',
        text: 'おしろの バルコニーから、よるの まちを みまもっている。' },
      { no: '016', chara: 'obakeou', name: 'おばけのおうさま', rarity: 'SAR', kind: 'おうさま おばけ',
        text: 'おばけの おしろで だいパーティー。こんやは みんなが しゅやく。' },
      { no: '017', chara: 'obakeou', name: 'おうごんの おばけのおうさま', rarity: 'MUR', kind: 'でんせつの おばけ',
        text: '100ねんに いちどの かぼちゃの つきよに、きんいろの かんむりが ひかる。' },
      { no: '018', chara: 'obakeou', name: 'でんせつの おばけのおうさま', rarity: 'LR', kind: 'レジェンドの おばけ',
        text: 'つきよの ばんに だけ あらわれる。おうかんの ほうせきに うちゅうが うつっている。' }
      ]
    },
    {
      id: 'future', cat: 'mirai', scene: 'future', code: 'F1', name: 'みらいの どうぶつパック', title: 'ロボと うちゅうの なかま', mark: '🤖',
      colors: ['#9fe8ff', '#8e9bb5', '#c9b3ff'], mascots: ['robon', 'jetpen', 'galaxyuni'],
      cards: [
      { no: '001', chara: 'robon', name: 'ロボねこ', rarity: 'C', kind: 'ロボ どうぶつ',
        text: 'おなかの ランプが ひかると ごきげん。ねずみ ロボと なかよし。' },
      { no: '002', chara: 'roboinu', name: 'ロボいぬ', rarity: 'C', kind: 'ロボ どうぶつ',
        text: 'しっぽの モーターで ぶんぶん よろこぶ。みちあんないが とくい。' },
      { no: '003', chara: 'robousa', name: 'ロボうさぎ', rarity: 'C', kind: 'ロボ どうぶつ',
        text: 'ながい みみは アンテナ。とおくの ほしの おとまで きこえる。' },
      { no: '004', chara: 'robopiyo', name: 'ロボひよこ', rarity: 'C', kind: 'ロボ どうぶつ',
        text: 'うまれた ばかりの ロボ。はじめて みた ロボを おやだと おもっている。' },
      { no: '005', chara: 'robokuma', name: 'ロボくま', rarity: 'U', kind: 'ロボ どうぶつ',
        text: 'ちからもちの ロボ。はちみつで うごく ふしぎな エンジンつき。' },
      { no: '006', chara: 'jetpen', name: 'ジェットぺんぎん', rarity: 'U', kind: 'うちゅう どうぶつ',
        text: 'せなかの ジェットで そらも とべるように なった ぺんぎん。' },
      { no: '007', chara: 'neonkitsu', name: 'ネオンきつね', rarity: 'U', kind: 'ひかる どうぶつ',
        text: 'よるの まちで ネオンいろに ひかる きつね。ダンスが すき。' },
      { no: '008', chara: 'uchulion', name: 'うちゅうらいおん', rarity: 'R', kind: 'うちゅう どうぶつ',
        text: 'ヘルメットを かぶって うちゅうを ぼうけん。ほしの おうさま。' },
      { no: '009', chara: 'mechadra', name: 'メカりゅう', rarity: 'R', kind: 'ロボ どうぶつ',
        text: 'ぎんいろの はねで マッハで とぶ。じつは とても あまえんぼう。' },
      { no: '010', chara: 'galaxyuni', name: 'ギャラクシーユニコーン', rarity: 'RR', kind: 'うちゅう どうぶつ',
        text: 'ほしぞらの からだを もつ ユニコーン。つのから ながれぼしが でる。' },
      { no: '011', chara: 'robon', name: 'ロボねこ', rarity: 'AR', kind: 'ロボ どうぶつ',
        text: 'じゅうでん ちゅう。ゆめの なかでも ランプが ちかちか。' },
      { no: '012', chara: 'robousa', name: 'ロボうさぎ', rarity: 'AR', kind: 'ロボ どうぶつ',
        text: 'つきの うらがわで、ほかの ほしの うさぎと おはなし ちゅう。' },
      { no: '013', chara: 'jetpen', name: 'ジェットぺんぎん', rarity: 'AR', kind: 'うちゅう どうぶつ',
        text: 'オーロラの なかを ジェットで ひとっとび。' },
      { no: '014', chara: 'uchulion', name: 'うちゅうらいおん', rarity: 'SR', kind: 'うちゅう どうぶつ',
        text: 'あたらしい ほしに はじめて あしあとを のこした。' },
      { no: '015', chara: 'galaxyuni', name: 'ギャラクシーユニコーン', rarity: 'SR', kind: 'うちゅう どうぶつ',
        text: 'ぎんがの まんなかを かけぬける。うしろに ほしの みちが できる。' },
      { no: '016', chara: 'galaxyuni', name: 'ギャラクシーユニコーン', rarity: 'SAR', kind: 'うちゅう どうぶつ',
        text: 'みらいの どうぶつたちを のせて、うちゅうの ゆうえんちへ しゅっぱつ。' },
      { no: '017', chara: 'galaxyuni', name: 'おうごんの ギャラクシーユニコーン', rarity: 'MUR', kind: 'でんせつの どうぶつ',
        text: 'みらいから きた きんいろの ユニコーン。あえた ひとには みらいが ひかる。' },
      { no: '018', chara: 'galaxyuni', name: 'でんせつの ギャラクシーユニコーン', rarity: 'LR', kind: 'レジェンドの どうぶつ',
        text: 'ぎんがを ひとまわり して かえってきた。とおった あとに あたらしい ほしが うまれる。' }
      ]
    }
  ];

  // ---------------------------------------------------------------- ふえたパック (packs.js)
  // なかまわけ = シリーズ (1 つにつき 1 パック)。group: いきもの (どんな いきものが でるか) / せかい (どうぶつたちが いろんな せかいで あそぶ)
  const CATS = [
    { id: 'mori', group: 'ikimono', name: 'どうぶつ', mark: '🐾', code: 'A' },
    { id: 'umi', group: 'ikimono', name: 'うみ', mark: '🐟', code: 'S' },
    { id: 'sora', group: 'ikimono', name: 'そら', mark: '🐦', code: 'B' },
    { id: 'mukashi', group: 'ikimono', name: 'むかし', mark: '🦖', code: 'D' },
    { id: 'yoru', group: 'ikimono', name: 'よる・おばけ', mark: '👻', code: 'G' },
    { id: 'mirai', group: 'ikimono', name: 'みらい・うちゅう', mark: '🤖', code: 'F' },
    { id: 'okashi', group: 'sekai', name: 'おかし', mark: '🍰', code: 'K' },
    { id: 'tabemono', group: 'sekai', name: 'たべもの', mark: '🍙', code: 'T' },
    { id: 'kisetsu', group: 'sekai', name: 'きせつ・おまつり', mark: '🌸', code: 'Q' },
    { id: 'machi', group: 'sekai', name: 'まち・おしごと', mark: '🚒', code: 'M' },
    { id: 'mahou', group: 'sekai', name: 'まほう・おとぎばなし', mark: '🪄', code: 'W' }
  ];
  const PACKS = typeof module === 'object' && module.exports ? require('./packs.js') : (typeof globalThis !== 'undefined' ? globalThis : this).Packs;
  const PACK_BY_ID = {};
  (PACKS || []).forEach(function (pk) { PACK_BY_ID[pk.id] = pk; });
  const PREFIX = { MUR: 'おうごんの ', LR: 'でんせつの ' };
  const RANK = { C: 0, U: 1, R: 2, RR: 3, AR: 4, SR: 5, SAR: 6, MUR: 7, LR: 8 };

  // ---------------------------------------------------------------- 11 のシリーズ
  // 1 シリーズ = 34 まい (C 8・U 6・R 4・RR 2 / AR 6・SR 4・SAR 2・MUR 1・LR 1)。ふつう 20 まい + シークレット 14 まい
  //   base  … 手で書いたパック (cards.js の上の方)。足りないぶんを extra の 3 パックから足す
  //   full  … 手で書いたものが無いシリーズ。6 パックのキャラから 34 まいぜんぶを作る
  // packs.js のキャラ 1 人は [a, b, c] の順。texts は a: C U AR / b: C R AR / c (スター): C RR SR SAR MUR LR
  // [パックの番号, キャラ a=0 b=1 c=2, texts の番号, レア度]
  const EXTRA_PLAN = [
    [0, 2, 0, 'C'], [1, 2, 0, 'C'], [0, 1, 0, 'C'], [1, 1, 0, 'C'],
    [0, 0, 1, 'U'], [1, 0, 1, 'U'], [2, 0, 1, 'U'],
    [0, 1, 1, 'R'], [1, 1, 1, 'R'], [0, 2, 1, 'RR'],
    [0, 0, 2, 'AR'], [1, 0, 2, 'AR'], [2, 0, 2, 'AR'],
    [0, 2, 2, 'SR'], [1, 2, 2, 'SR'], [0, 2, 3, 'SAR']
  ];
  const FULL_PLAN = [].concat(
    [0, 1, 2, 3].map(function (i) { return [i, 2, 0, 'C']; }),
    [0, 1, 2, 3].map(function (i) { return [i, 1, 0, 'C']; }),
    [0, 1, 2, 3, 4, 5].map(function (i) { return [i, 0, 1, 'U']; }),
    [0, 1, 2, 3].map(function (i) { return [i, 1, 1, 'R']; }),
    [[0, 2, 1, 'RR'], [1, 2, 1, 'RR']],
    [0, 1, 2, 3, 4, 5].map(function (i) { return [i, 0, 2, 'AR']; }),
    [0, 1, 2, 3].map(function (i) { return [i, 2, 2, 'SR']; }),
    [[0, 2, 3, 'SAR'], [1, 2, 3, 'SAR'], [0, 2, 4, 'MUR'], [0, 2, 5, 'LR']]
  );
  const SERIES = {
    mori: { base: 'animal' },
    umi: { base: 'sea', extra: ['shinkai', 'sangosho', 'minamijima'] },
    sora: { base: 'bird', extra: ['kumogumo', 'nijisora', 'kazekaze'] },
    mukashi: { base: 'dino', extra: ['pbmammoth', 'pbkaseki', 'pbkazanjima'] },
    yoru: { base: 'ghost', extra: ['pbyoimatsuri', 'pbyumenokuni', 'pbyashiki'] },
    mirai: { base: 'future', extra: ['pbstation', 'pbwakusei', 'pbyuenchi'] },
    okashi: { full: ['oskcake', 'oskcandy', 'oskchoco', 'oskice', 'oskdonut', 'oskwagashi'],
      sid: 'okashi', name: 'おかしパック', title: 'あまい あまい おかしの くに', scene: 'candy', colors: ['#ffb6d9', '#c8f2e4', '#ff8cc6'],
      mascots: ['oskicedra', 'oskdonutinu', 'oskcandyuni'] },
    tabemono: { full: ['tbmfruit', 'tbmyasai', 'tbmonigiri', 'tbmsushi', 'tbmpasta', 'tbmnoodle'],
      sid: 'tabemono', name: 'たべものパック', title: 'おいしい ごちそうの くに', scene: 'kitchen', colors: ['#ffb070', '#ffe27a', '#8fd47a'],
      mascots: ['tbmyasaiusa', 'tbmpastainu', 'tbmfruitkuma'] },
    kisetsu: { full: ['harusakura', 'natsumatsuri', 'akimomiji', 'fuyuyukiasobi', 'xmaskirakira', 'oshogatsu'],
      sid: 'kisetsu', name: 'きせつパック', title: 'はる なつ あき ふゆ', scene: 'season', colors: ['#ffc0dc', '#9fe0a8', '#9fd4ff'],
      mascots: ['nmhanabikit', 'fydarumaru', 'hzsakuneko'] },
    machi: { full: ['shoubousho', 'oishasan', 'panyasan', 'gakkoubi', 'denshagotou', 'yuubinkyoku'],
      sid: 'machi', name: 'まちパック', title: 'にぎやかな まちの はたらきもの', scene: 'town', colors: ['#8fd0ff', '#ffe08a', '#ff8f7a'],
      mascots: ['oiishakuma', 'pnkoppetora', 'sbtaichopen'] },
    mahou: { full: ['mahougakuen', 'yumenoshiro', 'youseinomori', 'yuushanotabi', 'kaizokusen', 'royalpalace'],
      sid: 'mahou', name: 'まほうパック', title: 'ふしぎな まほうと おとぎばなし', scene: 'castle', colors: ['#c9a6ff', '#ff9ed2', '#ffe27a'] }
  };

  function cardFrom(pk, row) {
    const c = pk.charas[row[1]];
    return { chara: c.id, name: (PREFIX[row[3]] || '') + c.name, rarity: row[3], kind: c.kind, text: c.texts[row[2]] };
  }
  function packsOf(ids) {
    return ids.map(function (id) {
      if (!PACK_BY_ID[id]) throw new Error('packs.js に無いパック: ' + id);
      return PACK_BY_ID[id];
    });
  }

  const BASE_SETS = SETS.splice(0, SETS.length);   // 手で書いた 6 パックを いったん取り出す
  CATS.forEach(function (cat) {
    const sp = SERIES[cat.id];
    let set, extras = [];
    if (sp.base) {
      set = BASE_SETS.find(function (st) { return st.id === sp.base; });
      if (sp.extra) {
        const ps = packsOf(sp.extra);
        extras = EXTRA_PLAN.map(function (row) { return cardFrom(ps[row[0]], row); });
      }
    } else {
      const ps = packsOf(sp.full);
      extras = FULL_PLAN.map(function (row) { return cardFrom(ps[row[0]], row); });
      const first = ps[0].charas;
      set = { id: sp.sid, cat: cat.id, scene: sp.scene, code: cat.code + '1', name: sp.name, title: sp.title, mark: cat.mark,
        // 表紙の 3 人 (3 人めが スター)。中身の ちがう 小さいパックから 1 人ずつ えらぶと、パックの テーマが 伝わる
        colors: sp.colors, mascots: sp.mascots || [first[0].id, first[1].id, first[2].id], cards: [] };
    }
    // レア度の低い順に並べ (同じレア度は書いた順)、001 から振り直す。ふつう (C〜RR) が先、シークレットが後
    const all = set.cards.concat(extras).map(function (c, i) { return { c: c, i: i }; });
    all.sort(function (x, y) { return RANK[x.c.rarity] - RANK[y.c.rarity] || x.i - y.i; });
    set.cards = all.map(function (x, i) {
      x.c.no = String(i + 1).padStart(3, '0');
      return x.c;
    });
    SETS.push(set);
  });

  // カードに「どのパックか」を付け、ゲームの中で使う見分け (A1-001) を no にする。番号の見た目は num
  const MAIN = { C: 1, U: 1, R: 1, RR: 1 };
  const CARDS = [];
  SETS.forEach(function (set) {
    set.mainCount = set.cards.filter(function (c) { return MAIN[c.rarity]; }).length;
    set.cards.forEach(function (c) {
      c.set = set.id;
      c.num = c.no;
      c.no = set.code + '-' + c.num;
      if (c.art === undefined) c.art = '';
      if (c.illus === undefined) c.illus = '';
      CARDS.push(c);
    });
  });

  // キャラごとの だいこうぶつ (おやつをあげるときに使う)
  const CHARAS = {
    neko: { food: '🐟', foodName: 'おさかな' },
    inu: { food: '🦴', foodName: 'ほね' },
    usagi: { food: '🥕', foodName: 'にんじん' },
    kuma: { food: '🍯', foodName: 'はちみつ' },
    hiyoko: { food: '🌽', foodName: 'とうもろこし' },
    buta: { food: '🍠', foodName: 'おいも' },
    nezumi: { food: '🧀', foodName: 'チーズ' },
    kaeru: { food: '🍬', foodName: 'あめだま' },
    kitsune: { food: '🍙', foodName: 'おいなりさん' },
    tanuki: { food: '🍡', foodName: 'おだんご' },
    panda: { food: '🎋', foodName: 'ささ' },
    hitsuji: { food: '🍀', foodName: 'クローバー' },
    shirokuma: { food: '🍨', foodName: 'アイス' },
    risu: { food: '🌰', foodName: 'どんぐり' },
    lion: { food: '🍖', foodName: 'おにく' },
    tora: { food: '🍗', foodName: 'からあげ' },
    zou: { food: '🍌', foodName: 'バナナ' },
    penguin: { food: '🦐', foodName: 'えび' },
    unicorn: { food: '🍭', foodName: 'にじいろキャンディ' },
    dragon: { food: '🌟', foodName: 'ほしのこんぺいとう' },
    kingyo: { food: '🦐', foodName: 'えび' },
    kumanomi: { food: '🪸', foodName: 'プランクトン' },
    fugu: { food: '🐚', foodName: 'かいがら' },
    tako: { food: '🦀', foodName: 'かに' },
    kurage: { food: '✨', foodName: 'ひかるつぶ' },
    kani: { food: '🍙', foodName: 'おにぎり' },
    iruka: { food: '🐟', foodName: 'おさかな' },
    manta: { food: '🫧', foodName: 'あわあわ' },
    kujira: { food: '🦐', foodName: 'オキアミ' },
    nijiuo: { food: '🌈', foodName: 'にじのしずく' },
    suzume: { food: '🍞', foodName: 'パンくず' },
    niwatori: { food: '🌽', foodName: 'とうもろこし' },
    ahiru: { food: '🥬', foodName: 'はっぱ' },
    hato: { food: '🫘', foodName: 'まめ' },
    fukurou: { food: '📚', foodName: 'えほん' },
    inko: { food: '🌻', foodName: 'ひまわりのたね' },
    tsuru: { food: '🐸', foodName: 'かえるグミ' },
    kujaku: { food: '🍇', foodName: 'ぶどう' },
    flamingo: { food: '🦐', foodName: 'えび' },
    hinotori: { food: '🔥', foodName: 'ほのおのみ' },
    tirano: { food: '🍖', foodName: 'ほねつきにく' },
    torikera: { food: '🥬', foodName: 'しだのはっぱ' },
    sutego: { food: '🌿', foodName: 'やわらかいくさ' },
    putera: { food: '🐟', foodName: 'さかな' },
    burakio: { food: '🌳', foodName: 'きのてっぺん' },
    ankiro: { food: '🌱', foodName: 'わかば' },
    pakike: { food: '🍓', foodName: 'きのみ' },
    supino: { food: '🐟', foodName: 'おおきなさかな' },
    raputoru: { food: '🍗', foodName: 'からあげ' },
    kohaku: { food: '💎', foodName: 'ほうせき' },
    shiroobake: { food: '🍬', foodName: 'あめ' },
    kabocha: { food: '🍫', foodName: 'チョコ' },
    chouchin: { food: '🕯️', foodName: 'ろうそく' },
    nekoobake: { food: '🐟', foodName: 'にぼし' },
    koumori: { food: '🍑', foodName: 'もも' },
    miira: { food: '🧻', foodName: 'あたらしいほうたい' },
    yukiobake: { food: '🍧', foodName: 'かきごおり' },
    majoneko: { food: '🧁', foodName: 'まほうのカップケーキ' },
    gaikotsu: { food: '🥛', foodName: 'ぎゅうにゅう' },
    obakeou: { food: '🎃', foodName: 'かぼちゃパイ' },
    robon: { food: '🔋', foodName: 'でんち' },
    roboinu: { food: '🔩', foodName: 'ねじ' },
    robousa: { food: '🥕', foodName: 'ひかるにんじん' },
    robopiyo: { food: '⚙️', foodName: 'はぐるま' },
    robokuma: { food: '🍯', foodName: 'はちみつオイル' },
    jetpen: { food: '🧊', foodName: 'こおりのねんりょう' },
    neonkitsu: { food: '💡', foodName: 'ネオンのひかり' },
    uchulion: { food: '🌠', foodName: 'ながれぼし' },
    mechadra: { food: '⚡', foodName: 'でんき' },
    galaxyuni: { food: '🪐', foodName: 'ほしのキャンディ' }
  };

  (PACKS || []).forEach(function (pk) {
    pk.charas.forEach(function (c) { CHARAS[c.id] = { food: c.food, foodName: c.foodName }; });
  });

  return { SETS: SETS, SET: SETS[0], CARDS: CARDS, CHARAS: CHARAS, CATS: CATS };
});
