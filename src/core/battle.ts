// 最小戦闘コア（決定論・UI非依存）。魔石盤の回路＝撃てるスキル。
// 自由意志を消費して撃ち、強さ＝ダメージ（元素が敵弱点なら×2）。自由意志0＝無気力＝敗北。
// 数値（コスト/ダメージ/敵）は手書きで調整可（ADR-0001 D3＝実opsは数えない）。
import type { Attr, Circuit } from '@core/board';

export interface Enemy {
  name: string;
  hp: number;
  maxHp: number;
  weakness: Attr;
}

export interface FreeWill {
  max: number;
  cur: number;
}

export type Outcome = 'none' | 'win' | 'lose';

export interface BattleState {
  freeWill: FreeWill;
  enemy: Enemy;
  outcome: Outcome;
}

/** 回路1本を撃つコスト（手書き＝経路の魔石数。長い回路ほど自由意志を食う）。 */
export function circuitCost(c: Pick<Circuit, 'stones'>): number {
  return c.stones.length;
}

export interface CastResult {
  state: BattleState;
  ok: boolean;
  damage: number;
  weak: boolean;
  cost: number;
  reason?: 'over' | 'not-enough';
}

/** 回路を撃つ。自由意志が足りなければ ok=false で状態不変。 */
export function castCircuit(s: BattleState, c: Pick<Circuit, 'stones' | 'strength' | 'element'>): CastResult {
  const cost = circuitCost(c);
  if (s.outcome !== 'none') return { state: s, ok: false, damage: 0, weak: false, cost, reason: 'over' };
  if (s.freeWill.cur < cost) return { state: s, ok: false, damage: 0, weak: false, cost, reason: 'not-enough' };

  const weak = c.element === s.enemy.weakness;
  const damage = weak ? c.strength * 2 : c.strength;
  const hp = Math.max(0, s.enemy.hp - damage);
  const cur = s.freeWill.cur - cost;
  const outcome: Outcome = hp <= 0 ? 'win' : 'none';
  const state: BattleState = { ...s, enemy: { ...s.enemy, hp }, freeWill: { ...s.freeWill, cur }, outcome };
  return { state, ok: true, damage, weak, cost };
}

/** 敵の手番＝自由意志を削る干渉。0になったら無気力＝敗北。 */
export function enemyTurn(s: BattleState, drain = 2): { state: BattleState; drain: number } {
  if (s.outcome !== 'none') return { state: s, drain: 0 };
  const cur = Math.max(0, s.freeWill.cur - drain);
  const outcome: Outcome = cur <= 0 ? 'lose' : 'none';
  return { state: { ...s, freeWill: { ...s.freeWill, cur }, outcome }, drain };
}
