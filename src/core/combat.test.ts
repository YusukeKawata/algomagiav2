import { describe, it, expect } from 'vitest';
import {
  startCombat, heroAttack, heroSkill, heroGuard, heroHealHp, heroHealFw, enemyTurn, circuitCost, autoWinnable,
  skillBaseDamage, strikeDamage,
  type CombatState,
} from '@core/combat';
import { emptyBoard, place, circuits, type Circuit, type Stone } from '@core/board';
import { makeStone, GARO_STONE } from '@game/data/stones';
import { ENEMIES, RUIN_ENCOUNTERS, PATH_ENCOUNTERS, UNDER_ENCOUNTERS, scaleEnemy } from '@game/data/enemies';
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

  it('スキルは自由意志をコスト(=石数)ぶん消費、弱点なら2倍（長回路ボーナス込み）', () => {
    const r = heroSkill(fresh(), circuit(5, 'fire', 3)); // 敵弱点=fire / 3石
    expect(r.weak).toBe(true);
    // base = 5 + floor(5*2*0.25)=2 → 7、弱点で ×2 = 14。
    expect(r.dealt).toBe(14);
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

  it('第2幕の工房で上限を4へ引き上げると 3×3 から 4×4 まで伸びる', () => {
    let d = { mind: 3, compute: 3 };
    const seq = [d];
    for (let i = 0; i < 3; i++) { d = nextBoardDims(d.mind, d.compute, 4); seq.push(d); }
    expect(seq).toEqual([
      { mind: 3, compute: 3 }, { mind: 4, compute: 3 }, { mind: 4, compute: 4 }, { mind: 4, compute: 4 },
    ]);
  });
});

describe('スキル火力カーブ: 長い回路ほど超線形（こうげきを上回る場面を作る）', () => {
  it('skillBaseDamage は石数で超線形（1石=等倍 / 3石=×1.5 / 5石=×2）', () => {
    expect(skillBaseDamage(circuit(4, 'fire', 1))).toBe(4);   // 4 + 0
    expect(skillBaseDamage(circuit(4, 'fire', 3))).toBe(6);   // 4 + floor(4*2*0.25)=2
    expect(skillBaseDamage(circuit(4, 'fire', 5))).toBe(8);   // 4 + floor(4*4*0.25)=4
  });

  it('育った盤の「長い弱点回路」は同レベルの「こうげき」を明確に上回る', () => {
    // L5・槍装備のこうげき相当 atk=16 を、3石・強さ9の弱点回路（dealt=27）が上回る。
    const atk = 16;
    const longWeak = heroSkill(fresh({ atk }), circuit(9, 'fire', 3));
    expect(longWeak.weak).toBe(true);
    expect(longWeak.dealt).toBeGreaterThan(atk);          // 9+floor(9*2*0.25)=13 → ×2 = 26
    expect(longWeak.dealt).toBe(26);
    // 一方、覚醒直後の 1石・強さ1 は弱点でも 2 ダメ＝こうげき優位（序盤は詰まない＝softlock担保）。
    expect(heroSkill(fresh(), circuit(1, 'fire', 1)).dealt).toBe(2);
  });
});

describe('属性攻撃と防具の耐性/弱点（strikeDamage）', () => {
  it('耐性で軽減・弱点で増加・看破で大幅軽減（最低0）', () => {
    expect(strikeDamage(10, 0, 'fire', {}, false)).toBe(10);            // 無耐性
    expect(strikeDamage(10, 0, 'fire', { fire: 0.5 }, false)).toBe(5);  // 50%耐性
    expect(strikeDamage(10, 0, 'fire', { fire: -0.4 }, false)).toBe(14);// 弱点+40%
    expect(strikeDamage(10, 0, 'fire', { fire: 0.5 }, true)).toBe(1);   // 耐性5→看破floor(5*0.25)=1
  });

  it('多段攻撃(multi)は連撃ぶん合計してダメージ＝群れ/速い敵の脅威', () => {
    const s = startCombat({ hpMax: 40, freeWillMax: 10, atk: 6, def: 0 }, { name: '群れ狼', hp: 20, atk: 3, weakness: 'fire', multi: 2 });
    const r = enemyTurn(s);
    expect(r.hits).toBe(2);
    expect(r.dealt).toBe(6); // 3+3
  });

  it('防具の属性耐性で敵の属性攻撃を実際に軽減できる', () => {
    const base = startCombat({ hpMax: 40, freeWillMax: 10, atk: 6, def: 0 }, ENEMIES['awakened']!); // atkAttr=fire
    const warded = startCombat({ hpMax: 40, freeWillMax: 10, atk: 6, def: 0, resist: { fire: 0.5 } }, ENEMIES['awakened']!);
    expect(enemyTurn(warded).dealt).toBeLessThan(enemyTurn(base).dealt);
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

  it('レベルスケールした遭遇敵も、到達レベルの素手で勝てる（作業ゲー化防止＋詰まない）', () => {
    const pools = [...new Set([...PATH_ENCOUNTERS, ...RUIN_ENCOUNTERS, ...UNDER_ENCOUNTERS])];
    for (let level = 1; level <= 8; level++) {
      for (const id of pools) {
        const scaled = scaleEnemy(ENEMIES[id]!, level);
        expect(autoWinnable(fistHero(level), scaled), `${id} @L${level}`).toBe(true);
      }
    }
  });
});
