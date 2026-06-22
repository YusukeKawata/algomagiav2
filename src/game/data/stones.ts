// 魔石（キュビット＝駒）の生成とドロップ。文様(形)・属性・魔素量(value)は固定で、変更不可。
// プレイヤーは「ドロップした魔石をやりくり」して盤に嵌める＝思い通りの文様が欲しければ何度も戦う。
// 決定論：ドロップ抽選はシード付き RNG（core/rng）で行う（素の Math.random 禁止）。
import type { Attr, Stone } from '@core/board';
import { ATTR_LABEL } from '@core/board';
import { SHAPES } from '@game/data/boards';
import type { Rng } from '@core/rng';
import { pick } from '@core/rng';

// 魔石テンプレ＝「どの形・どの属性・魔素量いくつ」か。ドロップ時にこれが確定し、以後は不変。
export interface StoneTemplate { shape: number; attr: Attr; value: number }

let stoneSeq = 0;
/** テンプレから実体の魔石を作る（id は安定生成・インベントリ管理用）。 */
export function makeStone(t: StoneTemplate): Stone {
  const s = SHAPES[t.shape]!;
  return { id: `inv${stoneSeq++}`, edges: [...s.edges], value: t.value, attr: t.attr };
}

// ガロが最初に手渡す魔石＝左→右の一本線(─)・物理属性・魔素量1。
// 最初のスロットは 1×1（magic-stone-workshop.md §9）なので、これ1個で最初の回路が1本成立する。
export const GARO_STONE: StoneTemplate = { shape: 0, attr: 'physical', value: 1 };

// 石工リーゼが手渡す回復属性石＝左→右の一本線(─)・回復属性・魔素量6（§8.9・心域＝回復の入口）。
// heal-優勢の回路を組むと「スキル」が回復になる＝盤に嵌めれば回復魔法が使えるようになる。
export const RIESE_STONE: StoneTemplate = { shape: 0, attr: 'heal', value: 6 };

// 形インデックス（boards.ts SHAPES）: 0=─ 1=│ 2=┌ 3=┐ 4=└ 5=┘ 6=├ 7=┼
// 雑魚＝安い直線/曲がりの低 value。強敵＝分岐/十字や高 value も混じる。
const T = (shape: number, attr: Attr, value: number): StoneTemplate => ({ shape, attr, value });

/** 敵ティア別のドロップ抽選プール（弱い敵ほど安い魔石）。 */
export const STONE_POOLS: Record<string, StoneTemplate[]> = {
  weak: [
    T(0, 'physical', 1), T(0, 'fire', 1), T(1, 'physical', 1),
    T(0, 'ice', 1), T(2, 'physical', 1), T(3, 'fire', 1),
  ],
  mid: [
    T(0, 'fire', 2), T(0, 'ice', 2), T(0, 'thunder', 2), T(0, 'wind', 2),
    T(4, 'fire', 2), T(5, 'ice', 1), T(6, 'physical', 2),
  ],
  strong: [
    T(0, 'fire', 3), T(0, 'ice', 3), T(0, 'thunder', 3), T(0, 'wind', 3),
    T(6, 'fire', 2), T(7, 'physical', 3), T(7, 'fire', 3),
  ],
};

/** プールから魔石を1つ抽選して実体化（決定論）。 */
export function rollStone(r: Rng, poolId: string): Stone {
  const pool = STONE_POOLS[poolId] ?? STONE_POOLS['weak']!;
  const t = pick(r, pool) ?? GARO_STONE;
  return makeStone(t);
}

/** 魔石の売値（魔素量ベース＝強い文様ほど高い）。店で売ってゴールドにできる。 */
export function stoneSellValue(s: Stone): number {
  return 2 + s.value * 3 + (s.edges.length >= 3 ? 4 : 0);
}

const EDGE_KEY = (edges: string[]): string => [...edges].sort().join('');

/** 魔石の文様グリフ（─│┌┐└┘├┼ 等）。edges の集合から SHAPES を引く。 */
export function stoneGlyph(s: { edges: string[] }): string {
  const key = EDGE_KEY(s.edges);
  return SHAPES.find((sh) => EDGE_KEY(sh.edges) === key)?.key ?? '◦';
}

/** ログ/一覧用の短い表記。例: 「─炎2」。魔素量(value)＝ステータス。 */
export function stoneLabel(s: Stone): string {
  return `${stoneGlyph(s)}${ATTR_LABEL[s.attr]}${s.value}`;
}
