// 魔石盤（回路パズル）の最小核。決定論・UI非依存。詳細は docs/design/magic-stone-workshop.md。
// 盤に1マス駒（魔石）を置き、駒の文様(edges)が左→右に一本つながった連結成分＝スキル1発。
// 強さ＝その回路に含まれる魔石の value 合計。成立した回路の数＝撃てるスキル数。

export type Edge = 'L' | 'R' | 'U' | 'D';

/** 属性（元素）。スキルの種類は経路の属性組成で決まる（magic-stone-workshop.md §8）。 */
export type Attr = 'fire' | 'ice' | 'thunder' | 'wind';
export const ATTRS: Attr[] = ['fire', 'ice', 'thunder', 'wind'];

/** 1マス駒。edges は互いに導通する辺の集合（例: ['L','R']＝直線, ['L','R','U','D']＝十字）。attr＝属性。 */
export interface Stone {
  id: string;
  edges: Edge[];
  value: number;
  attr: Attr;
}

export type Cell = Stone | null;

/** 盤。width=心域(横), height=演算(縦)。cells[y][x]。 */
export interface Board {
  width: number;
  height: number;
  cells: Cell[][];
}

/** 成立した回路（＝スキル1発）。element＝経路の属性組成で決まる元素。 */
export interface Circuit {
  stones: Stone[];
  strength: number;
  element: Attr;
}

/** 経路の元素＝属性別 value 合計が最大の属性（同点は ATTRS の順で先勝ち＝決定論）。 */
export function dominantAttr(stones: Stone[]): Attr {
  const total = new Map<Attr, number>();
  for (const s of stones) total.set(s.attr, (total.get(s.attr) ?? 0) + s.value);
  let best: Attr = ATTRS[0]!;
  let bestV = -1;
  for (const a of ATTRS) {
    const v = total.get(a) ?? 0;
    if (v > bestV) { best = a; bestV = v; }
  }
  return best;
}

/** 空の盤を作る。 */
export function emptyBoard(width: number, height: number): Board {
  const cells: Cell[][] = [];
  for (let y = 0; y < height; y++) cells.push(new Array<Cell>(width).fill(null));
  return { width, height, cells };
}

/** 盤に駒を置いた新しい盤を返す（immutable）。範囲外は変更なし。 */
export function place(board: Board, x: number, y: number, stone: Cell): Board {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return board;
  const cells = board.cells.map((row) => row.slice());
  cells[y]![x] = stone;
  return { ...board, cells };
}

function has(s: Stone, e: Edge): boolean {
  return s.edges.includes(e);
}

/**
 * 入口レール(左端でLを持つ)と出口レール(右端でRを持つ)の両方に届く連結成分を回路として返す。
 * 連結＝隣接2駒が共有辺で導通（右: a に R かつ b に L／下: a に D かつ b に U）。決定論的順序。
 */
export function circuits(board: Board): Circuit[] {
  const { width, height, cells } = board;
  const seen = new Set<string>(); // "x,y"
  const out: Circuit[] = [];

  const at = (x: number, y: number): Stone | null =>
    x >= 0 && y >= 0 && x < width && y < height ? (cells[y]![x] ?? null) : null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = at(x, y);
      if (!start || seen.has(`${x},${y}`)) continue;

      // BFS で連結成分を集める（決定論: 走査順に従う）。
      const comp: { x: number; y: number; s: Stone }[] = [];
      const queue: [number, number][] = [[x, y]];
      seen.add(`${x},${y}`);
      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        const s = at(cx, cy)!;
        comp.push({ x: cx, y: cy, s });
        // 4方向の導通隣接。
        const neighbors: [number, number, Edge, Edge][] = [
          [cx + 1, cy, 'R', 'L'],
          [cx - 1, cy, 'L', 'R'],
          [cx, cy + 1, 'D', 'U'],
          [cx, cy - 1, 'U', 'D'],
        ];
        for (const [nx, ny, eHere, eThere] of neighbors) {
          const ns = at(nx, ny);
          const key = `${nx},${ny}`;
          if (ns && !seen.has(key) && has(s, eHere) && has(ns, eThere)) {
            seen.add(key);
            queue.push([nx, ny]);
          }
        }
      }

      // 入口/出口レール接続を判定。
      const touchesIn = comp.some((c) => c.x === 0 && has(c.s, 'L'));
      const touchesOut = comp.some((c) => c.x === width - 1 && has(c.s, 'R'));
      if (touchesIn && touchesOut) {
        const stones = comp.map((c) => c.s);
        out.push({
          stones,
          strength: stones.reduce((sum, s) => sum + s.value, 0),
          element: dominantAttr(stones),
        });
      }
    }
  }
  return out;
}

/** 成立した回路の数＝戦闘で撃てるスキル数。 */
export function skillCount(board: Board): number {
  return circuits(board).length;
}
