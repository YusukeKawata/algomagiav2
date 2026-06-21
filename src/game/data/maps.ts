// フィールドのマップ（タイル文字列＋構造化データ）。
// 地形タイル: '#'=壁/木 / '.'=床 / 'P'=開始 / 'H'=建物 / 'C'=守り石(記念碑) / 'g','d'=扉(出入口) /
//   'E'=里の南口 / 'w','e'=西/東の通路 / 'B'=番獣 / 'O'=この先へ / 'I','W','A'=道具/武器/防具屋(旧式) / 'G','N','J','M'=NPC(旧式)。
// npcs/examines/decor を持つマップは「データ駆動」（村・ガロの家）。持たないマップは旧来の文字ベース。
// exits: 出口タイル文字 → 行き先マップと到着座標。
import { NAMES as N } from '@game/data/names';

export interface MapExit { to: string; sx: number; sy: number }

export type NpcKind = 'villager' | 'garo' | 'nina' | 'shopItem' | 'shopWeapon' | 'shopArmor' | 'underElder' | 'maker';
export interface NpcDef { x: number; y: number; kind: NpcKind; name?: string; color?: number; lines?: string[] }

export interface ExamineDef { x: number; y: number; who?: string; lines: string[]; give?: { gold?: number; pool?: string; xp: number; flag: string } }

export type DecorKey = 'crystal' | 'flowers' | 'crate' | 'deadTree' | 'skull' | 'grave' | 'statue' | 'sign';
export interface DecorDef { x: number; y: number; key: DecorKey; scale?: number }

export interface FieldMap {
  id: string;
  rows: string[];
  exits: Record<string, MapExit>;
  npcs?: NpcDef[];
  examines?: ExamineDef[];
  decor?: DecorDef[];
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
      E: { to: 'path', sx: 2, sy: 4 },         // 南口→森の小道（覚醒後は番獣戦/盤戦の引き金）
      g: { to: 'garo_house', sx: 6, sy: 7 },   // ガロの家へ
    },
    npcs: [
      { x: 16, y: 16, kind: 'nina', name: N.friend, color: 0x9ec5ff },
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

  path: {
    id: 'path',
    rows: [
      '###############',
      '#.............#',
      '#..##..##..##.#',
      '#.............#',
      '#w...........e#',
      '#..##..##..##.#',
      '#.............#',
      '#.............#',
      '###############',
    ],
    exits: {
      w: { to: 'village', sx: 18, sy: 19 }, // 西口→里（南口の内側に戻る）
      e: { to: 'ruin', sx: 2, sy: 5 },      // 東口→歌の遺構
    },
  },
  ruin: {
    id: 'ruin',
    rows: [
      '#################',
      '#...............#',
      '#..##..##..##...#',
      '#...............#',
      '#..##..##..##...#',
      '#w..............#',
      '#..##..##..##...#',
      '#...............#',
      '#..##..##..##...#',
      '#..............B#',
      '#################',
    ],
    exits: { w: { to: 'path', sx: 12, sy: 4 } }, // 西口→森の小道
  },
  // —— 第2幕：地中の里への坑道（descent）。属性持ちの魔物が徘徊する（遭遇）。東口→地中の里。 ——
  tunnels: {
    id: 'tunnels',
    rows: [
      '###############',
      '#P............#',
      '#..##..##.....#',
      '#.............#',
      '#....##..##...e#',
      '#.............#',
      '#..##.....##..#',
      '#.............#',
      '###############',
    ],
    exits: { e: { to: 'underville', sx: 1, sy: 5 } },
  },
  // —— 第2幕：地中の里（安全な拠点）。里長タルゴ[J]・石工リーゼ[M]（工房）・この先へ[O]。西口→坑道。 ——
  underville: {
    id: 'underville',
    rows: [
      '#############',
      '#...........#',
      '#..J.....M..#',
      '#...........#',
      '#w..........#',
      '#.....P.....#',
      '#.....O.....#',
      '#############',
    ],
    exits: { w: { to: 'tunnels', sx: 13, sy: 4 } },
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
