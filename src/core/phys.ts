// 物理戦コア（覚醒前・決定論・UI非依存）。盤戦(battle.ts)と対になる、覚醒前の素手の戦い。
// 主人公が power のダメージで殴る→敵が生きていれば atk で反撃。HP0で勝敗が決まる。
// 数値（power/敵hp/atk）は手書きで調整可（ADR-0001 D3＝実opsは数えない）。
// バランスの不変条件は phys.test.ts で固定する（例: 番獣は素手で勝てる）。
import type { Outcome } from '@core/battle';

export interface PhysFighter { hp: number; max: number }
export interface PhysFoe { name: string; hp: number; max: number; atk: number }

export interface PhysState {
  hero: PhysFighter;
  enemy: PhysFoe;
  outcome: Outcome;
}

export interface StrikeResult {
  state: PhysState;
  dealt: number;     // 敵に与えたダメージ
  countered: number; // 反撃で受けたダメージ（勝利時は 0）
}

/** 物理戦の初期状態。HPは満タンから始まる（戦闘開始＝全回復ポリシー）。 */
export function startPhys(heroMax: number, enemy: { name: string; hp: number; atk: number }): PhysState {
  return {
    hero: { hp: heroMax, max: heroMax },
    enemy: { name: enemy.name, hp: enemy.hp, max: enemy.hp, atk: enemy.atk },
    outcome: 'none',
  };
}

/** 1ターン: 主人公が power で殴る→敵が生存なら atk で反撃。HP0で勝敗確定。 */
export function strike(s: PhysState, power: number): StrikeResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, countered: 0 };
  const ehp = Math.max(0, s.enemy.hp - power);
  if (ehp <= 0) {
    return { state: { ...s, enemy: { ...s.enemy, hp: 0 }, outcome: 'win' }, dealt: power, countered: 0 };
  }
  const hhp = Math.max(0, s.hero.hp - s.enemy.atk);
  const outcome: Outcome = hhp <= 0 ? 'lose' : 'none';
  return {
    state: { ...s, enemy: { ...s.enemy, hp: ehp }, hero: { ...s.hero, hp: hhp }, outcome },
    dealt: power,
    countered: s.enemy.atk,
  };
}

/**
 * 素手で power 連打したとき勝てるか（決定論シミュレーション）。
 * 「覚醒前でも番獣に勝てる」等のバランス不変条件をテストで担保するための予測関数。
 */
export function survivesStraightFight(heroMax: number, enemy: { name: string; hp: number; atk: number }, power: number): boolean {
  let s = startPhys(heroMax, enemy);
  // power>0 なら必ず有限手で終わる。
  while (s.outcome === 'none') s = strike(s, power).state;
  return s.outcome === 'win';
}
