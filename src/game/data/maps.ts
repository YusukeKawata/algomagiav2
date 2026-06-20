// フィールドのマップ（タイル文字列）。'#'=壁 / '.'=床 / 'P'=開始 / 'G'=祖父ガロ / 'N'=ニナ
//  'I'/'W'/'A'=道具屋/武器屋/防具屋 / 'E'=里の南口（遺構方面） / 'w'/'e'=西/東の通路口 / 'B'=番獣。
// exits: 出口タイル文字 → 行き先マップと到着座標。これでマップ間を自由に行き来できる。
export interface MapExit { to: string; sx: number; sy: number }
export interface FieldMap { id: string; rows: string[]; exits: Record<string, MapExit> }

export const MAPS: Record<string, FieldMap> = {
  village: {
    id: 'village',
    rows: [
      '#############',
      '#...........#',
      '#..G.....N..#',
      '#...........#',
      '#.I...W...A.#',
      '#.....P.....#',
      '#...........#',
      '#.....E.....#',
      '#############',
    ],
    exits: { E: { to: 'path', sx: 2, sy: 4 } }, // 南口→森の小道（覚醒後は番獣戦の引き金になる）
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
      w: { to: 'village', sx: 6, sy: 6 }, // 西口→里
      e: { to: 'ruin', sx: 2, sy: 5 },    // 東口→歌の遺構
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
