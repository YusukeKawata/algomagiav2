import { describe, it, expect } from 'vitest';
import { castCircuit, enemyTurn, circuitCost, type BattleState } from '@core/battle';
import type { Circuit, Stone } from '@core/board';

function circuit(strength: number, element: Circuit['element'], stoneCount: number): Circuit {
  const stones: Stone[] = Array.from({ length: stoneCount }, (_, i) => ({ id: `s${i}`, edges: ['L', 'R'], value: 1, attr: element }));
  return { stones, strength, element };
}

function fresh(): BattleState {
  return { freeWill: { max: 20, cur: 20 }, enemy: { name: '石像兵', hp: 30, maxHp: 30, weakness: 'fire' }, outcome: 'none' };
}

describe('戦闘: 回路を撃つ', () => {
  it('ダメージ=強さ、自由意志はコスト(=石数)ぶん減る', () => {
    const r = castCircuit(fresh(), circuit(6, 'ice', 4));
    expect(r.ok).toBe(true);
    expect(r.damage).toBe(6);
    expect(r.cost).toBe(4);
    expect(r.state.enemy.hp).toBe(24);
    expect(r.state.freeWill.cur).toBe(16);
  });

  it('元素が弱点ならダメージ2倍', () => {
    const r = castCircuit(fresh(), circuit(6, 'fire', 3));
    expect(r.weak).toBe(true);
    expect(r.damage).toBe(12);
    expect(r.state.enemy.hp).toBe(18);
  });

  it('自由意志が足りなければ撃てず状態不変', () => {
    const s: BattleState = { ...fresh(), freeWill: { max: 20, cur: 2 } };
    const r = castCircuit(s, circuit(6, 'fire', 4));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-enough');
    expect(r.state.enemy.hp).toBe(30);
    expect(r.state.freeWill.cur).toBe(2);
  });

  it('敵HPが0で勝利', () => {
    const s: BattleState = { ...fresh(), enemy: { name: '石像兵', hp: 10, maxHp: 30, weakness: 'fire' } };
    const r = castCircuit(s, circuit(6, 'fire', 3)); // 弱点で12ダメージ
    expect(r.state.enemy.hp).toBe(0);
    expect(r.state.outcome).toBe('win');
  });
});

describe('戦闘: 敵の手番', () => {
  it('自由意志を削り、0で敗北', () => {
    const s: BattleState = { ...fresh(), freeWill: { max: 20, cur: 2 } };
    const r = enemyTurn(s, 2);
    expect(r.state.freeWill.cur).toBe(0);
    expect(r.state.outcome).toBe('lose');
  });

  it('circuitCost は経路の石数', () => {
    expect(circuitCost(circuit(9, 'fire', 5))).toBe(5);
  });
});
