import { describe, it, expect } from 'vitest';
import { MAPS, tileAt, findChar, mapCols, mapRows, type FieldMap } from '@game/data/maps';

// 床（歩ける）＝壁'#'・建物'H'・守り石'C'・水'~'以外。出口/ゲート/宝箱/荒野床などは床扱い。
function walkable(ch: string): boolean { return ch !== '#' && ch !== 'H' && ch !== 'C' && ch !== '~'; }

/** start から到達できる床セル集合（4近傍BFS）。 */
function reachable(map: FieldMap, sx: number, sy: number): Set<string> {
  const seen = new Set<string>();
  const q: [number, number][] = [[sx, sy]];
  seen.add(`${sx},${sy}`);
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      if (nx < 0 || ny < 0 || nx >= mapCols(map) || ny >= mapRows(map)) continue;
      if (!walkable(tileAt(map, nx, ny))) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

/** マップ上の記号 chars の全座標。 */
function allChars(map: FieldMap, chars: string[]): { x: number; y: number; ch: string }[] {
  const out: { x: number; y: number; ch: string }[] = [];
  for (let y = 0; y < mapRows(map); y++) for (let x = 0; x < mapCols(map); x++) {
    const t = tileAt(map, x, y);
    if (chars.includes(t)) out.push({ x, y, ch: t });
  }
  return out;
}

describe('マップ: 生成ダンジョンの連結性（孤立して詰まない＝不変条件）', () => {
  // 各マップの「必ず行ける必要がある」記号＝出口キー＋ゲート(B/O)＋開始(P)。
  const GATES: Record<string, string[]> = {
    path: ['w', 'e'],
    ruin: ['w', 'B'],
    world: ['V', 'P', 'K', 'e'],   // 草原（里・隠し洞窟・東口）
    hills: ['w', 'e'],             // 丘陵
    barrens: ['w', 'e'],           // 荒野
    pass: ['w', 'D'],              // 山道の関→裂け目
    wilds: ['k', 'X'],
    tunnels: ['w', 'e'],
    underville: ['w', 'O'],
  };

  for (const [id, gates] of Object.entries(GATES)) {
    it(`${id}: 全ての出口/ゲートが相互に到達可能`, () => {
      const map = MAPS[id]!;
      const pts = allChars(map, gates);
      // すべての必要記号が存在する。
      for (const g of gates) expect(pts.some((p) => p.ch === g), `${id} に '${g}' が無い`).toBe(true);
      // 最初の記号から、他のすべての必要記号へ到達できる。
      const start = pts[0]!;
      const reach = reachable(map, start.x, start.y);
      for (const p of pts) expect(reach.has(`${p.x},${p.y}`), `${id}: '${p.ch}'(${p.x},${p.y}) に到達不可`).toBe(true);
    });
  }

  it('各マップの行は同じ幅（タイルのズレ防止）', () => {
    for (const id of Object.keys(MAPS)) {
      const m = MAPS[id]!;
      const w = m.rows[0]!.length;
      for (const r of m.rows) expect(r.length, `${id} の行幅不一致`).toBe(w);
    }
  });

  it('全ての exit の着地座標(sx,sy)が床＝ワープ先が壁でハマらない', () => {
    for (const id of Object.keys(MAPS)) {
      const m = MAPS[id]!;
      for (const ex of Object.values(m.exits)) {
        const dest = MAPS[ex.to];
        if (!dest) continue;
        expect(walkable(tileAt(dest, ex.sx, ex.sy)), `${id}→${ex.to} の着地(${ex.sx},${ex.sy})が壁`).toBe(true);
      }
    }
  });

  it('village に開始位置P がある', () => { expect(findChar(MAPS['village']!, 'P')).not.toBeNull(); });

  it('village: 有機的な縁取りでも、開始Pから機能座標（南口E・扉g・NPC・調べる点）へ到達できる', () => {
    const v = MAPS['village']!;
    const p = findChar(v, 'P')!;
    const reach = reachable(v, p.x, p.y);
    // 必ず歩いて行き来できる機能座標（NPC・宿/店・調べる点・南口・扉前）。
    const must: [number, number][] = [
      [18, 21], [6, 7],                              // 南口E（外周）／家の出入口直下
      [16, 16], [22, 5], [25, 5], [28, 5], [31, 5],  // ニナ・宿・各店
      [9, 13], [27, 12], [14, 8], [30, 14],          // サブNPC
      [33, 18], [4, 18],                             // 調べる点
      [18, 19],                                      // 霧の野からの帰還着地
    ];
    for (const [x, y] of must) {
      expect(walkable(tileAt(v, x, y)), `village (${x},${y}) が床でない`).toBe(true);
      expect(reach.has(`${x},${y}`), `village: P から (${x},${y}) に到達不可`).toBe(true);
    }
  });
});
