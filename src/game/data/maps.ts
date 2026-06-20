// フィールドのマップ（タイル文字列）。'#'=壁 / '.'=床 / 'P'=開始 / 'G'=祖父ガロ / 'N'=ニナ / 'E'=遺構への出口 / 'B'=番獣。
// 全行が同じ幅（13）。非'#'はすべて歩ける（NPC/出口/ボスの上は描画で重ねる）。
export interface FieldMap { id: string; rows: string[] }

export const MAPS: Record<string, FieldMap> = {
  village: {
    id: 'village',
    rows: [
      '#############',
      '#...........#',
      '#..G.....N..#',
      '#...........#',
      '#...........#',
      '#.....P.....#',
      '#...........#',
      '#.....E.....#',
      '#############',
    ],
  },
  path: {
    id: 'path',
    rows: [
      '###############',
      '#P............#',
      '#..##..##..##.#',
      '#.............#',
      '#..##..##..##.#',
      '#.............#',
      '#..##..##..##.#',
      '#...........E.#',
      '###############',
    ],
  },
  ruin: {
    id: 'ruin',
    rows: [
      '#################',
      '#P..............#',
      '#..##..##..##...#',
      '#...............#',
      '#..##..##..##...#',
      '#...............#',
      '#..##..##..##...#',
      '#...............#',
      '#..##..##..##...#',
      '#..............B#',
      '#################',
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
