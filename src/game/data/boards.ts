// 魔石盤のデータ（駒の文様＝形と、盤戦の初期配置）。UI(BoardScene)と core テストの両方が参照する単一の出所。
// 形(edges/value)は core 寄りだが「どの形を遊ばせるか」はコンテンツ＝game/data に置く（第2幕で増やす想定）。
import { emptyBoard, place, type Board, type Edge, type Attr } from '@core/board';

// 駒の形（文様）。key=表示記号、edges=導通する辺、value=強さ寄与。属性は配置時に別途選ぶ（形と属性は独立）。
export interface Shape { key: string; edges: Edge[]; value: number }
export const SHAPES: Shape[] = [
  { key: '─', edges: ['L', 'R'], value: 1 },
  { key: '│', edges: ['U', 'D'], value: 1 },
  { key: '┌', edges: ['D', 'R'], value: 1 },
  { key: '┐', edges: ['L', 'D'], value: 1 },
  { key: '└', edges: ['U', 'R'], value: 1 },
  { key: '┘', edges: ['L', 'U'], value: 1 },
  { key: '├', edges: ['U', 'D', 'R'], value: 2 },
  { key: '┼', edges: ['L', 'R', 'U', 'D'], value: 3 },
];

export interface StartPiece { x: number; y: number; shape: number; attr: Attr }
export interface BoardLayout { cols: number; rows: number; pieces: StartPiece[] }

// 覚醒後・最初の盤戦のデモ初期配置（炎の一本道：strength 6＝弱点なら12ダメージ）。
// プレイヤーはここから形/属性を足して、より強い／安い回路に組み替えられる。
export const AWAKENED_START: BoardLayout = {
  cols: 5,
  rows: 4,
  pieces: [
    { x: 0, y: 1, shape: 0, attr: 'fire' }, // ─
    { x: 1, y: 1, shape: 0, attr: 'fire' }, // ─
    { x: 2, y: 1, shape: 3, attr: 'fire' }, // ┐
    { x: 2, y: 2, shape: 4, attr: 'fire' }, // └
    { x: 3, y: 2, shape: 0, attr: 'fire' }, // ─
    { x: 4, y: 2, shape: 0, attr: 'fire' }, // ─
  ],
};

/** レイアウトから盤を組む（決定論・core の place を使う）。配置駒の id は init0.. で安定。 */
export function buildBoard(layout: BoardLayout): Board {
  let b = emptyBoard(layout.cols, layout.rows);
  layout.pieces.forEach((p, i) => {
    const s = SHAPES[p.shape]!;
    b = place(b, p.x, p.y, { id: `init${i}`, edges: [...s.edges], value: s.value, attr: p.attr });
  });
  return b;
}
