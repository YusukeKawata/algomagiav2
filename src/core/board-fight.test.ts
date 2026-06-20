// 盤戦の「台本上の戦い」が勝てることをデータ（boards.ts/enemies.ts）から検証する。
// UIに依存せず、初期盤面＋最強回路を撃つ素朴戦略で覚醒後の最初の敵を倒せることを固定する。
import { describe, it, expect } from 'vitest';
import { circuits } from '@core/board';
import { castCircuit, enemyTurn, circuitCost, type BattleState } from '@core/battle';
import { AWAKENED_START, buildBoard } from '@game/data/boards';
import { BOARD_ENEMIES } from '@game/data/enemies';

describe('盤戦: 覚醒後の最初の戦い', () => {
  it('初期盤面の炎回路は strength 6（弱点で12ダメージ）', () => {
    const cs = circuits(buildBoard(AWAKENED_START));
    expect(cs).toHaveLength(1);
    expect(cs[0]!.strength).toBe(6);
    expect(cs[0]!.element).toBe('fire');
  });

  it('初期盤面のまま最強回路を撃ち続ければ awakened に勝てる', () => {
    const board = buildBoard(AWAKENED_START);
    const e = BOARD_ENEMIES['awakened']!;
    let s: BattleState = {
      freeWill: { max: 24, cur: 24 },
      enemy: { name: e.name, hp: e.hp, maxHp: e.hp, weakness: e.weakness },
      outcome: 'none',
    };
    let guard = 0;
    while (s.outcome === 'none' && guard++ < 50) {
      const affordable = circuits(board).filter((c) => circuitCost(c) <= s.freeWill.cur);
      expect(affordable.length).toBeGreaterThan(0); // 詰まない
      const best = affordable.reduce((a, b) => (b.strength > a.strength ? b : a));
      s = castCircuit(s, best).state;
      if (s.outcome === 'none') s = enemyTurn(s, 2).state;
    }
    expect(s.outcome).toBe('win');
  });
});
