// フィールドのマップ（タイル文字列＋構造化データ）。
// 地形タイル: '#'=壁/木 / '.'=床 / 'P'=開始 / 'H'=建物 / 'C'=守り石(記念碑) / 'g','d'=扉(出入口) /
//   'E'=里の南口 / 'w','e'=西/東の通路 / 'B'=番獣 / 'O'=この先へ / 'I','W','A'=道具/武器/防具屋(旧式) / 'G','N','J','M'=NPC(旧式)。
// npcs/examines/decor を持つマップは「データ駆動」（村・ガロの家）。持たないマップは旧来の文字ベース。
// exits: 出口タイル文字 → 行き先マップと到着座標。
import { NAMES as N } from '@game/data/names';
import { makeRng } from '@core/rng';

export interface MapExit { to: string; sx: number; sy: number }

export type NpcKind = 'villager' | 'garo' | 'nina' | 'shopItem' | 'shopWeapon' | 'shopArmor' | 'underElder' | 'maker' | 'inn';
export interface NpcDef { x: number; y: number; kind: NpcKind; name?: string; color?: number; lines?: string[] }

export interface ExamineDef { x: number; y: number; who?: string; title?: string; lines: string[]; give?: { gold?: number; pool?: string; xp: number; flag: string } }

export type DecorKey = 'crystal' | 'flowers' | 'crate' | 'deadTree' | 'skull' | 'grave' | 'statue' | 'sign';
export interface DecorDef { x: number; y: number; key: DecorKey; scale?: number }

// 宝箱：歩いて重なると一度だけ開く（flag で重複防止）。gold/item/pool(魔石)のいずれかを与える。
export interface TreasureDef { x: number; y: number; flag: string; gold?: number; item?: string; itemN?: number; pool?: string; note?: string }

export interface FieldMap {
  id: string;
  rows: string[];
  exits: Record<string, MapExit>;
  npcs?: NpcDef[];
  examines?: ExamineDef[];
  decor?: DecorDef[];
  treasures?: TreasureDef[];
  intro?: string[]; // 初回入場時に一度だけ流す到着ナレーション（FieldScene が flag で重複防止）
}

// 生成済みの洞窟/草原に「バイオーム」を上書きする（決定論・連結性に影響しない範囲で）。
//   wastelandFromX 以降の床 '.' を荒野床 ':'（歩ける・見た目だけ）に。
//   ponds の各座標は、そこが壁 '#' のときだけ水 '~'（壁のまま・見た目だけ）に＝連結性を壊さない。
function withBiome(rows: string[], wastelandFromX: number, ponds: [number, number][]): string[] {
  const g = rows.map((r) => r.split(''));
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y]!.length; x++)
      if (g[y]![x] === '.' && x >= wastelandFromX) g[y]![x] = ':';
  for (const [px, py] of ponds) if (g[py] && g[py]![px] === '#') g[py]![px] = '~';
  return g.map((r) => r.join(''));
}

// ——— 有機的なダンジョン生成（決定論・シード付き） ———
// 「ドランカーズウォーク」で開けた空間を掘り（洞窟/森らしい不定形）、特別点(入口/出口/ボス)どうしを
// L字の直線通路で必ず連結する＝四角くない＆連結保証（孤立して詰むことがない）。床='.'/壁=obstacle。
interface CavePoint { x: number; y: number; ch?: string }
function genCave(w: number, h: number, seed: number, points: CavePoint[], walkRatio = 0.34, obstacle = '#'): string[] {
  const rng = makeRng(seed);
  const g: string[][] = Array.from({ length: h }, () => new Array<string>(w).fill(obstacle));
  const carve = (x: number, y: number): void => { if (x > 0 && x < w - 1 && y > 0 && y < h - 1) g[y]![x] = '.'; };
  // 複数の酔歩で不定形の空間を掘る。
  const walks = Math.floor(w * h * walkRatio);
  let cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  for (let i = 0; i < walks; i++) {
    carve(cx, cy);
    if (rng() < 0.5) carve(cx + 1, cy); // たまに2マス幅＝開けた感じ
    const d = Math.floor(rng() * 4);
    cx = Math.max(1, Math.min(w - 2, cx + (d === 0 ? 1 : d === 1 ? -1 : 0)));
    cy = Math.max(1, Math.min(h - 2, cy + (d === 2 ? 1 : d === 3 ? -1 : 0)));
  }
  // 特別点をこの順にL字で連結（連結保証）。
  const lcarve = (a: CavePoint, b: CavePoint): void => {
    let x = a.x, y = a.y;
    while (x !== b.x) { carve(x, y); carve(x, y + 1); x += x < b.x ? 1 : -1; }
    while (y !== b.y) { carve(x, y); carve(x + 1, y); y += y < b.y ? 1 : -1; }
    carve(x, y);
  };
  for (let i = 0; i < points.length - 1; i++) lcarve(points[i]!, points[i + 1]!);
  // 特別点を床にして記号を置く。
  for (const p of points) { carve(p.x, p.y); if (p.ch) g[p.y]![p.x] = p.ch; }
  return g.map((r) => r.join(''));
}

// 行を生成する小道具：幅 w の内部（左右#）行。features=[x,char] を上書き。
function row(w: number, ...features: [number, string][]): string {
  const a = new Array(w).fill('.');
  a[0] = '#'; a[w - 1] = '#';
  for (const [x, c] of features) a[x] = c;
  return a.join('');
}
const wall = (w: number): string => '#'.repeat(w);

// ——— 霧の里（広いスクロール村ハブ・36×22） ———
const VW = 36, VH = 22;
const villageRows: string[] = (() => {
  const r: string[] = [];
  for (let y = 0; y < VH; y++) {
    if (y === 0) { r.push(wall(VW)); continue; }
    if (y === VH - 1) { r.push(wall(VW).slice(0, 18) + 'E' + wall(VW).slice(19)); continue; } // 南口[E]
    const feats: [number, string][] = [];
    // ガロの家（建物 H・x4-9, y3-5）＋扉 g(6,6)
    if (y >= 3 && y <= 5) for (let x = 4; x <= 9; x++) feats.push([x, 'H']);
    if (y === 6) feats.push([6, 'g']);
    if (y === 4) feats.push([18, 'C']);   // 守り石（記念碑）
    if (y === 17) feats.push([18, 'P']);  // 開始位置
    r.push(row(VW, ...feats));
  }
  return r;
})();

export const MAPS: Record<string, FieldMap> = {
  village: {
    id: 'village',
    rows: villageRows,
    exits: {
      E: { to: 'path', sx: 2, sy: 7 },         // 南口→森の小道（覚醒後の探索ではワールドマップへ＝FieldSceneが分岐）
      g: { to: 'garo_house', sx: 6, sy: 7 },   // ガロの家へ
    },
    npcs: [
      { x: 16, y: 16, kind: 'nina', name: N.friend, color: 0x9ec5ff },
      // 宿屋（休息＝HP/自由意志を全回復。消耗を持ち越す設計の回復拠点）。
      { x: 22, y: 5, kind: 'inn', name: '宿屋', color: 0xffd27a },
      // 行商人の露店（道具/武器/防具）。
      { x: 25, y: 5, kind: 'shopItem', name: '道具屋', color: 0xffe0a0 },
      { x: 28, y: 5, kind: 'shopWeapon', name: '武器屋', color: 0xffb070 },
      { x: 31, y: 5, kind: 'shopArmor', name: '防具屋', color: 0xc0a0ff },
      // サブNPC（里の人々）。
      { x: 9, y: 13, kind: 'villager', name: '畑のドゥエ', color: 0x9fd0a0, lines: [
        'この畑も、守り石の光があってこそだ。…霧が薄れてから、虫が増えてな。',
        'お前さん、ガロ様の使いだろう。…あの方が見込むんだ、ただ者じゃないさ。',
      ] },
      { x: 27, y: 12, kind: 'villager', name: '猟師バルク', color: 0xc08a5a, lines: [
        '谷のふちまでなら出るが、それより先は行かん。霧の外は、別の世界だ。',
        '武器も防具も、無いよりはずっといい。…命あっての狩りだぞ。',
      ] },
      { x: 14, y: 8, kind: 'villager', name: '子どものミィ', color: 0xffd0e0, lines: [
        'ねえ、ほんとに遺構へ行くの？ こわくないの？',
        'ニナ姉が、ずっと窓の外みてたよ。…はやく帰ってきてね。',
      ] },
      { x: 30, y: 14, kind: 'villager', name: '老婆セン', color: 0xb0b0b0, lines: [
        '昔はな、霧の外にも里があったと聞く。…今は、もう誰も知らんが。',
        '「据炉」か。…あれに触れるのは、おやめ。何人も、ああして抜け殻になった。',
      ] },
    ],
    examines: [
      { x: 18, y: 4, who: N.wardStone, lines: [
        '里を守る古い魔石＝守り石。…近くで見ると、光の脈がひどく細い。',
        `祖父いわく、これは「${N.device}」と対で里に遺されたものだという。`,
      ] },
      { x: 33, y: 18, who: '', lines: ['打ち捨てられた井戸。底をのぞくと、自分の顔が暗く揺れている。'] },
      { x: 4, y: 18, who: '', lines: ['物干しに、繕いかけのニナの上着。…帰る場所が、ここにある。'] },
    ],
    decor: [
      { x: 18, y: 4, key: 'crystal', scale: 0.95 },   // 守り石
      { x: 12, y: 10, key: 'flowers' }, { x: 22, y: 9, key: 'flowers' }, { x: 8, y: 18, key: 'flowers' },
      { x: 26, y: 6, key: 'crate', scale: 0.85 }, { x: 29, y: 6, key: 'crate', scale: 0.85 }, { x: 32, y: 6, key: 'crate', scale: 0.85 },
      { x: 9, y: 14, key: 'crate', scale: 0.8 }, { x: 33, y: 18, key: 'crate', scale: 0.7 },
    ],
  },

  // ガロの家（屋内・13×9）。
  garo_house: {
    id: 'garo_house',
    rows: [
      wall(13),
      row(13), row(13), row(13), row(13), row(13), row(13), row(13),
      '######d######',
    ],
    exits: { d: { to: 'village', sx: 6, sy: 7 } },
    npcs: [{ x: 6, y: 3, kind: 'garo', name: N.elder, color: 0xffd089 }],
    examines: [
      { x: 2, y: 2, who: '', lines: ['暖炉。小さな火が、いつも絶やさず灯っている。…祖父の手だ。'] },
      { x: 10, y: 2, who: '', lines: ['古い棚に、色あせた歌の本。…「強き獣の腹には、大いなる石が眠る」。'] },
      { x: 10, y: 6, who: '', lines: ['寝台がふたつ。片方は、お前が幼い頃から使ってきたものだ。'] },
    ],
    decor: [
      { x: 2, y: 2, key: 'crystal', scale: 0.55 }, { x: 10, y: 2, key: 'crate', scale: 0.8 }, { x: 10, y: 6, key: 'crate', scale: 0.8 },
      { x: 3, y: 6, key: 'flowers', scale: 0.8 },
    ],
  },

  // 主人公の自室（屋内・11×8）。ゲーム最初の場面＝目覚め。扉[d]で外（里）へ＝フロー進行。
  hero_room: {
    id: 'hero_room',
    rows: [
      wall(11),
      row(11, [2, 'P']),
      row(11),
      row(11),
      row(11),
      row(11),
      row(11),
      '#####d#####',
    ],
    exits: {}, // 扉[d]はフロー進行（FieldScene が advance）。
    examines: [
      { x: 2, y: 2, who: '', lines: [
        '寝台。さっきまで、ここで眠りこけていた。…ニナの声で、やっと目が覚めた。',
        '（幼い頃から使ってきた、自分の寝床。へこんだ場所まで、身体が覚えている。）',
      ] },
      { x: 8, y: 1, who: '', lines: [
        '小さな窓。外は、いつもの霧。乳色の世界が、ゆっくりと流れていく。',
        '（…なぜ、霧はこの谷だけ晴れないのだろう。誰に聞いても「そういうものだ」と笑うだけだ。…そういうもの、か。）',
      ] },
      { x: 8, y: 5, who: '', lines: [
        '使い込んだ手帳。思いついた「なぜ?」を書き留める、子どもの頃からの癖だ。',
        '最後の頁にも、答えの出ない問いがいくつも並んでいる。…里の皆は、これを「悪い癖」と呼ぶ。',
      ] },
      { x: 2, y: 5, who: '', lines: [
        '棚の上の、小さな木彫り。祖父ガロが、まだ手の器用だった頃に彫ってくれたものだ。',
      ] },
    ],
    decor: [
      { x: 2, y: 2, key: 'crate', scale: 0.95 },   // 寝台がわり
      { x: 8, y: 5, key: 'crate', scale: 0.8 },     // 机
      { x: 2, y: 5, key: 'crystal', scale: 0.5 },   // 木彫り（形見）
      { x: 8, y: 2, key: 'flowers', scale: 0.8 },   // 窓辺の鉢
    ],
  },
  // 森の小道（里→遺構）。不定形の森＝木立の間を縫う。西口[w]→里／東口[e]→遺構。
  path: {
    id: 'path',
    rows: genCave(25, 15, 1101, [
      { x: 1, y: 7, ch: 'w' }, { x: 2, y: 7 }, { x: 7, y: 4 }, { x: 13, y: 11 }, { x: 19, y: 5 }, { x: 22, y: 7 }, { x: 23, y: 7, ch: 'e' },
    ]),
    exits: {
      w: { to: 'village', sx: 18, sy: 19 }, // 西口→里（南口の内側に戻る）
      e: { to: 'ruin', sx: 2, sy: 9 },       // 東口→歌の遺構
    },
    intro: ['霧の薄れた谷ぐちに、細い小道が東へ続いている。木立の影が、まだらに揺れている。'],
  },
  // 歌の遺構。崩れた墓所＝入り組んだ石室。最奥に番獣[B]。西口[w]→小道。
  ruin: {
    id: 'ruin',
    rows: genCave(30, 18, 2203, [
      { x: 1, y: 9, ch: 'w' }, { x: 2, y: 9 }, { x: 8, y: 12 }, { x: 15, y: 5 }, { x: 21, y: 13 }, { x: 27, y: 3, ch: 'B' },
    ]),
    exits: { w: { to: 'path', sx: 22, sy: 7 } }, // 西口→森の小道
    examines: [
      { x: 15, y: 5, who: '', lines: ['崩れた祭壇のくぼみに、小さな魔石が落ちている。…拾っておこう。'], give: { gold: 5, pool: 'mid', xp: 5, flag: 'ruin-cache' } },
      { x: 8, y: 12, who: '', lines: ['ひび割れた頭蓋骨。…遺構に挑んで還らなかった者だろうか。'] },
      { x: 21, y: 13, who: '', lines: ['名も知れぬ墓標。歌の遺構は、いにしえの墓所でもあったらしい。'] },
    ],
  },
  // ======== 旅の地表（覚醒後）。里→草原→丘陵→荒野→山道の関→地中への裂け目。隣の里まで“歩く旅”。 ========
  // —— 第1脚：草原（里のすぐ外）。広い・軽い魔物・隠れ洞窟[K]。西=里[V]へ／東口[e]=丘陵へ。 ——
  world: {
    id: 'world',
    rows: genCave(48, 30, 3307, [
      { x: 3, y: 24, ch: 'V' }, { x: 5, y: 24, ch: 'P' }, { x: 12, y: 20, ch: 'T' }, { x: 8, y: 5, ch: 'K' }, { x: 10, y: 6 },
      { x: 20, y: 16 }, { x: 28, y: 10, ch: 'T' }, { x: 36, y: 18 }, { x: 43, y: 12 }, { x: 46, y: 12, ch: 'e' },
    ], 0.5),
    exits: {
      V: { to: 'village', sx: 18, sy: 17 },   // 里へ戻る（宿・店・魔石盤）
      K: { to: 'wilds', sx: 2, sy: 11 },       // 隠れ洞窟＝任意の隠しダンジョンへ
      e: { to: 'hills', sx: 2, sy: 13 },       // 東口＝丘陵の道へ（旅は続く）
    },
    examines: [
      { x: 20, y: 16, who: '', lines: [
        '苔むした道標。風雨にかすれた字が、かろうじて読める。',
        '「東へ、岩山の底へ。されど、山道は遠し」。…里[V]は西。北の洞窟[K]は古い狩り場——寄り道だ。',
      ] },
      { x: 36, y: 18, who: '', lines: [
        '誰かが組んだ小さな石積み。旅の無事を祈る、古いまじないだと祖父が言っていた。',
        '（こんな石積みが、ぽつりぽつりと東へ続いている。…昔は、人が行き交う道だったのだろうか。）',
      ] },
    ],
    treasures: [
      { x: 12, y: 20, flag: 'tr-world-1', gold: 30, note: '草に埋もれた革袋' },
      { x: 28, y: 10, flag: 'tr-world-2', item: 'potion', note: '打ち捨てられた木箱' },
    ],
    intro: [
      '——里を囲う霧を抜けると、世界はばかみたいに広かった。見渡すかぎりの草原。空が、こんなにも高い。',
      '据炉のあの声が記していた“座標”。霧の谷の外、岩山の底に、もう一つの隠れ里があるという。',
      '（道は、ただ東へ。歩いて、歩いて、ようやく辿り着く——そういう距離だ。里[V]へはいつでも戻れる。右上の小地図を見ろ。）',
    ],
  },
  // —— 第2脚：丘陵の道。見晴らし台・古い道標。やや手強い。西口[w]=草原へ／東口[e]=荒野へ。 ——
  hills: {
    id: 'hills',
    rows: genCave(44, 28, 7711, [
      { x: 1, y: 13, ch: 'w' }, { x: 2, y: 13 }, { x: 10, y: 8, ch: 'T' }, { x: 16, y: 18 }, { x: 24, y: 10 },
      { x: 30, y: 20, ch: 'T' }, { x: 38, y: 12 }, { x: 42, y: 14, ch: 'e' },
    ], 0.46),
    exits: {
      w: { to: 'world', sx: 43, sy: 12 },     // 西口→草原（戻る）
      e: { to: 'barrens', sx: 2, sy: 15 },    // 東口→涸れ谷／荒野
    },
    examines: [
      { x: 24, y: 10, who: '', lines: [
        '丘の上の見晴らし台——だったものの残骸。崩れた石組みに登ると、来た道のはるか向こうに、霧の谷がかすむ。',
        'もう、あんなに遠い。…逆の東には、赤茶けた涸れ谷と、その奥に黒々とした岩山の稜線。まだ、ずっと先だ。',
      ] },
      { x: 16, y: 18, who: '', lines: [
        '道端に、半ば土に還った標石。文字はもう読めないが、矢印だけが東を指している。',
        '（誰が、いつ、何のために置いたのか。…ただ、自分と同じ方角へ歩いた者がいた、という事実だけが残っている。）',
      ] },
    ],
    treasures: [
      { x: 10, y: 8, flag: 'tr-hills-1', item: 'dew', note: '見晴らし台の物入れ' },
      { x: 30, y: 20, flag: 'tr-hills-2', pool: 'mid', note: '旅人の落とし物' },
    ],
    intro: [
      '草原はやがて、なだらかな丘の連なりに変わった。登っては下り、また登る。足が、旅の重さを覚えはじめる。',
      '風が変わった。草の匂いに、乾いた土と石の匂いが混じる。…この丘を越えれば、緑は終わるのだと、なぜか分かった。',
    ],
  },
  // —— 第3脚：涸れ谷／荒野。強い魔物・遺物。乾いた赤土。西口[w]=丘陵へ／東口[e]=山道へ。 ——
  barrens: {
    id: 'barrens',
    rows: withBiome(genCave(46, 30, 8822, [
      { x: 1, y: 15, ch: 'w' }, { x: 2, y: 15 }, { x: 10, y: 9, ch: 'T' }, { x: 18, y: 20 }, { x: 26, y: 12 },
      { x: 34, y: 22, ch: 'T' }, { x: 40, y: 10 }, { x: 43, y: 14, ch: 'e' },
    ], 0.42), 0, [[14, 6], [15, 6], [28, 25], [29, 25], [38, 5]]),
    exits: {
      w: { to: 'hills', sx: 38, sy: 12 },     // 西口→丘陵（戻る）
      e: { to: 'pass', sx: 2, sy: 12 },       // 東口→山道の関
    },
    examines: [
      { x: 26, y: 12, who: '', lines: [
        '砂に半ば埋もれた、奇妙な遺物。錆びた金属の板に、規則正しい細かな溝が——まるで、無数の細い道が刻まれているようだ。',
        '（守り石の中の「光の脈」に、どこか似ている。…これは、何かの破片だ。何の？ 分からない。だが、魔法のものとは思えない。）',
      ] },
      { x: 18, y: 20, who: '', lines: [
        '干からびた川床。ずっと昔、ここに水が流れ、人が暮らした名残か——崩れた壁の列が、地平へと続いている。',
        '（街だ。これは、街の跡だ。…こんな荒れ果てた所に、かつては。誰が、どうして、いなくなった？）',
      ] },
    ],
    treasures: [
      { x: 10, y: 9, flag: 'tr-barrens-1', item: 'potion', note: '遺物に紛れた小箱' },
      { x: 34, y: 22, flag: 'tr-barrens-2', pool: 'strong', note: '砂中の封印箱' },
    ],
    intro: [
      '丘を下りきると、緑は嘘のように消え、赤茶けた荒野が広がっていた。乾いた風が、砂と熱を運んでくる。',
      'ところどころに、崩れた壁や、錆びた“何か”の残骸。…ここには、かつて何かがあった。そして、滅んだ。',
      '（魔物は手強い。装備と道具を確かめろ。…この谷を抜けた先に、最後の関がある。）',
    ],
  },
  // —— 第4脚：山道の関。旅の最難所・landmark・物語。西口[w]=荒野へ／裂け目[D]=坑道へ（次の里へ）。 ——
  pass: {
    id: 'pass',
    rows: genCave(40, 26, 9933, [
      { x: 1, y: 12, ch: 'w' }, { x: 2, y: 12 }, { x: 9, y: 7, ch: 'T' }, { x: 16, y: 17 }, { x: 24, y: 8 },
      { x: 30, y: 14 }, { x: 36, y: 6, ch: 'D' },
    ], 0.36),
    exits: {
      w: { to: 'barrens', sx: 40, sy: 10 },   // 西口→荒野（戻る）
      D: { to: 'tunnels', sx: 2, sy: 8 },      // 裂け目→坑道（地中の里へ・旅の終わり）
    },
    examines: [
      { x: 24, y: 8, who: '', lines: [
        '岩を穿った、古い関所。半ば崩れているが、確かに人の手で築かれたものだ。…ここを通った者たちが、いた。',
        '門柱に、刻みつけられた言葉。「ここより先、地の底。隠れよ。声を潜めよ。あの目から」。',
        '（あの目。…据炉も、同じことを言っていた。「Qの観測対象から除外」と。…だんだん、繋がってくる。何かが。）',
      ] },
      { x: 16, y: 17, who: '', lines: [
        '関のそばに、寄り添うように並んだ小さな墓標がいくつも。名前も、日付もない。',
        '（ここまで来て、辿り着けなかった者たち。…自分は、ここを越える。越えて、この目で確かめる。それが、はみ出し者の務めだと、なぜか思う。）',
      ] },
    ],
    treasures: [
      { x: 9, y: 7, flag: 'tr-pass-1', item: 'spring', note: '関守の隠し棚' },
    ],
    intro: [
      '荒野の果て、黒い岩山が壁のようにそびえ、その裂け目に細い山道が刻まれていた。風が、笛のように鳴る。',
      '——長い旅だった。霧の里を出て、草原を越え、丘を登り、荒野を渡って。ようやく、ここまで来た。',
      '（この山道を抜け、岩の裂け目[D]へ。その底に、もう一つの隠れ里があるはずだ。…あと、ひと息だ。）',
    ],
  },
  // —— 任意の隠しダンジョン「忘れられた狩り場」。手強い魔物が徘徊し、最奥に任意ボス[X]＝倒さなくても進める。 ——
  wilds: {
    id: 'wilds',
    rows: genCave(30, 22, 6620, [
      { x: 1, y: 11, ch: 'k' }, { x: 2, y: 11 }, { x: 8, y: 7, ch: 'T' }, { x: 14, y: 14 },
      { x: 20, y: 8, ch: 'T' }, { x: 25, y: 11 }, { x: 27, y: 11, ch: 'X' },
    ], 0.34),
    exits: { k: { to: 'world', sx: 10, sy: 6 } }, // 入口へ戻る（草原の[K]の隣＝床）
    examines: [
      { x: 14, y: 14, who: '', lines: [
        '古い狩りの跡。錆びた罠、砕けた骨。…ここで多くの狩人が、何かを狩り、何かに狩られた。',
        '（壁に、爪痕とも、刃の跡ともつかない無数の傷。…“主”は、まだ、ここにいる。）',
      ] },
    ],
    treasures: [
      { x: 8, y: 7, flag: 'tr-wilds-1', item: 'potion', note: '狩人の遺品袋' },
      { x: 20, y: 8, flag: 'tr-wilds-2', pool: 'strong', note: '封じられた箱' },
    ],
    intro: [
      '草原の北の岩肌に、ぽっかりと口を開けた洞窟。…昔、狩人たちが「狩り場」と呼んだ場所だ。',
      '濃い気配が奥でとぐろを巻いている。徘徊する魔物は手強い。最奥に潜む“主[X]”は——挑むも退くも、自由だ。',
      '（無理だと思ったら、入口[k]から草原へ戻れる。倒せば、大きな実りがある。）',
    ],
  },
  // —— 坑道（地中の里への下り）。属性持ちの魔物が徘徊する（遭遇）。西口[w]→世界／東口[e]→地中の里。 ——
  tunnels: {
    id: 'tunnels',
    rows: genCave(26, 16, 4409, [
      { x: 1, y: 8, ch: 'w' }, { x: 2, y: 8 }, { x: 8, y: 12 }, { x: 16, y: 4 }, { x: 23, y: 8 }, { x: 24, y: 8, ch: 'e' },
    ]),
    exits: {
      w: { to: 'pass', sx: 30, sy: 14 },        // 西口→山道の関（地表へ戻る）
      e: { to: 'underville', sx: 2, sy: 7 },    // 東口→地中の里（'w'の隣＝即時逆流を防ぐ）
    },
    intro: [
      '山道の裂け目を、地の底へ下りていく。霧ではなく、土と岩が「あの目」を遮る——別のやり方の、観測の死角。',
      '壁に結晶が埋もれて燐光を放つ。…守り石と、同じ匂いだ。長い旅の果ての、最後の下り坂。',
      '坑道には魔物が徘徊している。属性の攻撃を使う個体もいる——[C]で防具を、敵に合わせて選べ。',
    ],
  },
  // —— 第2幕：地中の里（安全な拠点）。里長タルゴ[J]・石工リーゼ[M]（工房）・宿屋・この先へ[O]。西口→坑道。 ——
  underville: {
    id: 'underville',
    rows: genCave(22, 14, 5511, [
      { x: 1, y: 7, ch: 'w' }, { x: 2, y: 7 }, { x: 7, y: 4 }, { x: 10, y: 5 }, { x: 14, y: 4 }, { x: 11, y: 8 }, { x: 11, y: 12, ch: 'O' },
    ], 0.55),
    exits: { w: { to: 'tunnels', sx: 23, sy: 8 } },
    npcs: [
      { x: 7, y: 4, kind: 'underElder', name: N.underElder, color: 0xb0a0c0 },
      { x: 14, y: 4, kind: 'maker', name: N.maker, color: 0xffcf8a },
      { x: 10, y: 5, kind: 'inn', name: '宿の岩室', color: 0xffd27a },
    ],
    intro: [
      '坑道を抜けると、地下の空洞に灯りが点る集落があった——地中の里。自分たちだけじゃ、なかった。',
      '（石工リーゼ[M]で「魔石工房」が開ける。宿の岩室で休める。支度ができたら、この先へ[O]。）',
    ],
  },
};

export function tileAt(map: FieldMap, x: number, y: number): string {
  if (y < 0 || y >= map.rows.length) return '#';
  const row = map.rows[y]!;
  if (x < 0 || x >= row.length) return '#';
  return row[x]!;
}

export function isWall(map: FieldMap, x: number, y: number): boolean {
  return tileAt(map, x, y) === '#';
}

export function findChar(map: FieldMap, ch: string): { x: number; y: number } | null {
  for (let y = 0; y < map.rows.length; y++) {
    const x = map.rows[y]!.indexOf(ch);
    if (x >= 0) return { x, y };
  }
  return null;
}

export function mapCols(map: FieldMap): number { return map.rows[0]?.length ?? 0; }
export function mapRows(map: FieldMap): number { return map.rows.length; }
