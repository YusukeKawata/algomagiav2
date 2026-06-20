import { describe, it, expect } from 'vitest';
import {
  startCombat, heroAttack, heroSkill, heroGuard, heroHealHp, heroHealFw, enemyTurn, circuitCost, autoWinnable,
  type CombatState,
} from '@core/combat';
import { emptyBoard, place, circuits, type Circuit, type Stone } from '@core/board';
import { makeStone, GARO_STONE } from '@game/data/stones';
import { ENEMIES, RUIN_ENCOUNTERS } from '@game/data/enemies';
import { statsForLevel } from '@core/progress';
import { nextBoardDims } from '@game/state';

const HERO = { hpMax: 30, freeWillMax: 24, atk: 6, def: 0 };
function fresh(over: Partial<{ atk: number; def: number; ehp: number; eatk: number }> = {}): CombatState {
  return startCombat(
    { ...HERO, atk: over.atk ?? HERO.atk, def: over.def ?? HERO.def },
    { name: '霧狼', hp: over.ehp ?? 24, atk: over.eatk ?? 4, weakness: 'fire' },
  );
}
function circuit(strength: number, element: Circuit['element'], stoneCount: number): Circuit {
  const stones: Stone[] = Array.from({ length: stoneCount }, (_, i) => ({ id: `s${i}`, edges: ['L', 'R'], value: 1, attr: element }));
  return { stones, strength, element };
}

describe('ターン制戦闘: 行動', () => {
  it('攻撃は atk ぶん敵HPを削る', () => {
    const r = heroAttack(fresh({ atk: 7 }));
    expect(r.dealt).toBe(7);
    expect(r.state.enemy.hp).toBe(17);
  });

  it('スキルは自由意志をコスト(=石数)ぶん消費、弱点なら2倍', () => {
    const r = heroSkill(fresh(), circuit(5, 'fire', 3)); // 敵弱点=fire
    expect(r.weak).toBe(true);
    expect(r.dealt).toBe(10);
    expect(r.cost).toBe(3);
    expect(r.state.hero.freeWill).toBe(21);
  });

  it('自由意志が足りなければスキルは撃てず不変', () => {
    let s = fresh();
    s = { ...s, hero: { ...s.hero, freeWill: 1 } };
    const r = heroSkill(s, circuit(5, 'fire', 3));
    expect(r.ok).toBe(false);
    expect(r.state.enemy.hp).toBe(24);
  });

  it('看破中は敵の攻撃が大幅軽減され、自由意志を少し取り戻す', () => {
    const g = heroGuard(fresh({ eatk: 8 }));
    expect(g.state.hero.guarding).toBe(true);
    expect(g.state.hero.freeWill).toBe(24); // 既に満タンなら上限まで
    const e = enemyTurn(g.state);
    expect(e.guarded).toBe(true);
    expect(e.dealt).toBe(2); // floor(8*0.25)
    expect(e.state.hero.guarding).toBe(false);
  });

  it('道具でHP・自由意志を回復（上限超えない）', () => {
    let s = fresh();
    s = { ...s, hero: { ...s.hero, hp: 10, freeWill: 5 } };
    expect(heroHealHp(s, 100).state.hero.hp).toBe(30);
    expect(heroHealFw(s, 100).state.hero.freeWill).toBe(24);
  });

  it('敵HP0で勝利、ヒーローHP0で敗北', () => {
    expect(heroAttack(fresh({ atk: 99 })).state.outcome).toBe('win');
    let s = fresh({ eatk: 99 });
    s = { ...s, hero: { ...s.hero, hp: 1 } };
    expect(enemyTurn(s).state.outcome).toBe('lose');
  });

  it('circuitCost は経路の石数（最低1）', () => {
    expect(circuitCost(circuit(9, 'fire', 5))).toBe(5);
    expect(circuitCost({ stones: [] })).toBe(1);
  });
});

describe('魔石盤: 覚醒後レベルアップで1段ずつ広がる（1×1スタート→心域優先→上限3×3）', () => {
  it('成長スケジュールが単調（駒の保持はsetBoardSize側）', () => {
    let d = { mind: 1, compute: 1 };
    const seq = [d];
    for (let i = 0; i < 6; i++) { d = nextBoardDims(d.mind, d.compute); seq.push(d); }
    expect(seq).toEqual([
      { mind: 1, compute: 1 }, { mind: 2, compute: 1 }, { mind: 2, compute: 2 },
      { mind: 3, compute: 2 }, { mind: 3, compute: 3 }, { mind: 3, compute: 3 }, { mind: 3, compute: 3 },
    ]);
  });
});

describe('魔石盤: 最初の1×1スロット＋ガロの魔石', () => {
  it('1×1 盤にガロの魔石(─物理)を置くと、物理スキルが1本・強さ1で成立', () => {
    const b = place(emptyBoard(1, 1), 0, 0, makeStone(GARO_STONE));
    const cs = circuits(b);
    expect(cs).toHaveLength(1);
    expect(cs[0]!.strength).toBe(1);
    expect(cs[0]!.element).toBe('physical');
  });
});

describe('ターン制戦闘: 強敵の「ためる→大攻撃」と看破', () => {
  const bigEnemy = () => startCombat({ hpMax: 100, freeWillMax: 24, atk: 6, def: 0 }, { name: '番獣', hp: 100, atk: 5, weakness: 'ice', bigEvery: 2 });

  it('bigEvery回ふつう攻撃→ためる(0・予兆)→次手番で2倍', () => {
    let s = bigEnemy();
    const r1 = enemyTurn(s); expect(r1.dealt).toBe(5); expect(r1.telegraph).toBe(false); s = r1.state;
    const r2 = enemyTurn(s); expect(r2.telegraph).toBe(true); expect(r2.dealt).toBe(0); expect(r2.state.enemy.charging).toBe(true); s = r2.state;
    const r3 = enemyTurn(s); expect(r3.big).toBe(true); expect(r3.dealt).toBe(10); expect(r3.state.enemy.charging).toBe(false);
  });

  it('看破(みやぶる)中は大攻撃も大幅軽減', () => {
    let s = bigEnemy();
    s = enemyTurn(s).state;          // ふつう
    s = enemyTurn(s).state;          // ためる（予兆）
    s = heroGuard(s).state;          // 看破
    const r = enemyTurn(s);          // 大攻撃を看破で受ける
    expect(r.big).toBe(true);
    expect(r.dealt).toBe(Math.floor(10 * 0.25)); // 2
  });
});

describe('ターン制戦闘: バランス不変条件（ふつうに戦えば勝てる＝詰まない）', () => {
  const base = statsForLevel(1);
  const fistHero = (level: number) => ({ hpMax: statsForLevel(level).hpMax, freeWillMax: statsForLevel(level).freeWillMax, atk: statsForLevel(level).power, def: 0 });

  it('道中/遺構の遭遇敵と番獣は、覚醒前の素手(L1)で勝てる', () => {
    for (const id of [...RUIN_ENCOUNTERS, 'boss']) {
      const e = ENEMIES[id]!;
      expect(autoWinnable({ hpMax: base.hpMax, freeWillMax: base.freeWillMax, atk: base.power, def: 0 }, e)).toBe(true);
    }
  });

  it('覚醒後の盤戦の敵は、到達レベル(L4)の素手で勝てる（スキル無しでも詰まない）', () => {
    for (const id of ['awakened', 'frost', 'spark', 'gale']) {
      expect(autoWinnable(fistHero(4), ENEMIES[id]!)).toBe(true);
    }
  });
});
