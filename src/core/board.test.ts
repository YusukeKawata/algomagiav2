import { describe, it, expect } from 'vitest';
import { emptyBoard, place, circuits, skillCount, type Edge, type Board, type Stone } from '@core/board';

function S(id: string, edges: Edge[], value: number): Stone {
  return { id, edges, value };
}

/** 行ごとの駒並びから盤を作る（null=空き）。 */
function boardOf(rows: (Stone | null)[][]): Board {
  const height = rows.length;
  const width = rows[0]!.length;
  let b = emptyBoard(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) b = place(b, x, y, rows[y]![x]!);
  return b;
}

describe('魔石盤: 回路の成立', () => {
  it('左→右に直線でつながると1回路・強さ=value合計', () => {
    const b = boardOf([[S('a', ['L', 'R'], 1), S('b', ['L', 'R'], 2), S('c', ['L', 'R'], 3)]]);
    const cs = circuits(b);
    expect(cs).toHaveLength(1);
    expect(cs[0]!.strength).toBe(6);
    expect(skillCount(b)).toBe(1);
  });

  it('経路に隙間があるとつながらない（0回路）', () => {
    const b = boardOf([[S('a', ['L', 'R'], 1), null, S('c', ['L', 'R'], 3)]]);
    expect(circuits(b)).toHaveLength(0);
  });

  it('縦に迂回して右端へ届けば1回路', () => {
    // (0,0)→(1,0)→下(1,1)→右(2,1)出口
    const b = boardOf([
      [S('a', ['L', 'R'], 1), S('b', ['L', 'D'], 1), null],
      [null, S('c', ['U', 'R'], 1), S('d', ['L', 'R'], 1)],
    ]);
    const cs = circuits(b);
    expect(cs).toHaveLength(1);
    expect(cs[0]!.stones.map((s) => s.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(cs[0]!.strength).toBe(4);
  });

  it('独立した2本の横線は2回路（=撃てるスキル2）', () => {
    const b = boardOf([
      [S('a', ['L', 'R'], 2), S('b', ['L', 'R'], 2)],
      [S('c', ['L', 'R'], 5), S('d', ['L', 'R'], 5)],
    ]);
    expect(skillCount(b)).toBe(2);
    expect(circuits(b).map((c) => c.strength)).toEqual([4, 10]);
  });

  it('入口に届いても出口に届かなければ回路にならない', () => {
    const b = boardOf([[S('a', ['L', 'R'], 1), S('b', ['L'], 9), null]]);
    expect(circuits(b)).toHaveLength(0);
  });

  it('辺が噛み合わない隣接は導通しない（aにRがあってもbにLが無い）', () => {
    const b = boardOf([[S('a', ['L', 'R'], 1), S('b', ['R'], 1)]]);
    expect(circuits(b)).toHaveLength(0);
  });
});
