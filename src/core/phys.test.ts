import { describe, it, expect } from 'vitest';
import { startPhys, strike, survivesStraightFight } from '@core/phys';
import { PHYS_ENEMIES, PHYS_POWER, RUIN_ENCOUNTERS } from '@game/data/enemies';
import { statsForLevel } from '@core/progress';

describe('物理戦: 1ターン', () => {
  it('殴ると敵HPが power ぶん減る', () => {
    const r = strike(startPhys(30, { name: '徘徊石', hp: 10, atk: 3 }), 6);
    expect(r.dealt).toBe(6);
    expect(r.state.enemy.hp).toBe(4);
    expect(r.countered).toBe(3);
    expect(r.state.hero.hp).toBe(27);
    expect(r.state.outcome).toBe('none');
  });

  it('敵HPが0ちょうど以下なら勝利・反撃を受けない', () => {
    const r = strike(startPhys(30, { name: '徘徊石', hp: 6, atk: 99 }), 6);
    expect(r.state.outcome).toBe('win');
    expect(r.countered).toBe(0);
    expect(r.state.hero.hp).toBe(30); // 倒したので反撃なし
  });

  it('反撃で主人公HPが0になったら敗北', () => {
    const r = strike(startPhys(5, { name: '番獣', hp: 99, atk: 5 }), 6);
    expect(r.state.outcome).toBe('lose');
    expect(r.state.hero.hp).toBe(0);
  });

  it('決着後は状態不変', () => {
    const won = strike(startPhys(30, { name: 'x', hp: 6, atk: 1 }), 6).state;
    const again = strike(won, 6);
    expect(again.state).toBe(won);
    expect(again.dealt).toBe(0);
  });
});

describe('物理戦: バランス不変条件（第1幕が完走できる）', () => {
  it('番獣は覚醒前でも素手で勝てる（無限リトライにならない）', () => {
    expect(survivesStraightFight(30, PHYS_ENEMIES['boss']!, PHYS_POWER)).toBe(true);
  });

  it('道中のどの遭遇敵もレベル1の素手で勝てる（成長前でも詰まない）', () => {
    const base = statsForLevel(1);
    for (const id of RUIN_ENCOUNTERS) {
      expect(survivesStraightFight(base.hpMax, PHYS_ENEMIES[id]!, base.power)).toBe(true);
    }
  });

  it('成長するほど番獣の撃破は速く・安全になる（火力が単調）', () => {
    const boss = PHYS_ENEMIES['boss']!;
    expect(survivesStraightFight(statsForLevel(1).hpMax, boss, statsForLevel(1).power)).toBe(true);
    expect(survivesStraightFight(statsForLevel(5).hpMax, boss, statsForLevel(5).power)).toBe(true);
  });
});
