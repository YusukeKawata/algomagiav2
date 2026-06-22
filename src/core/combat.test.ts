import { describe, it, expect } from 'vitest';
import {
  startCombat, heroAttack, heroSkill, heroGuard, heroHealHp, heroHealFw, enemyTurn, circuitCost, autoWinnable,
  skillBaseDamage, strikeDamage,
  type CombatState,
} from '@core/combat';
import { emptyBoard, place, circuits, type Circuit, type Stone } from '@core/board';
import { makeStone, GARO_STONE } from '@game/data/stones';
import { ENEMIES, RUIN_ENCOUNTERS, PATH_ENCOUNTERS, UNDER_ENCOUNTERS, WORLD_ENCOUNTERS, HILLS_ENCOUNTERS, BARRENS_ENCOUNTERS, PASS_ENCOUNTERS, WILDS_ENCOUNTERS } from '@game/data/enemies';
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

describe('物理スキルは「こうげき」に上乗せ（ponti 指示）', () => {
  it('物理属性スキル＝atk＋強さボーナス。単純なこうげきより必ず高い（＝攻撃＋α）', () => {
    const atk = 8;
    const plain = heroAttack(fresh({ atk })).dealt;       // 8
    const physSkill = heroSkill(fresh({ atk }), circuit(3, 'physical', 1)); // 8 + (3+0) = 11
    expect(physSkill.weak).toBe(false);                   // 物理は属性弱点を突けない（×2なし）
    expect(physSkill.dealt).toBe(atk + 3);
    expect(physSkill.dealt).toBeGreaterThan(plain);       // こうげきに上乗せ＝必ず上回る
    expect(physSkill.cost).toBe(1);                       // 自由意志コストは石数
  });

  it('長い物理回路ほど上乗せが増える（atk + 超線形ボーナス）', () => {
    const atk = 10;
    // 5石・強さ4 → atk + (4 + floor(4*4*0.25)=4) = 10 + 8 = 18
    const r = heroSkill(fresh({ atk }), circuit(4, 'physical', 5));
    expect(r.dealt).toBe(atk + 8);
    expect(r.cost).toBe(5);
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

  it('道中/遺構の遭遇敵は、覚醒前の素手(L1)で勝てる', () => {
    for (const id of RUIN_ENCOUNTERS) {
      const e = ENEMIES[id]!;
      expect(autoWinnable({ hpMax: base.hpMax, freeWillMax: base.freeWillMax, atk: base.power, def: 0 }, e)).toBe(true);
    }
  });

  it('番獣(初ボス)は無対策(L1素手)だと負け、到達Lv(L2素手＋リトライ全回復)で勝てる＝中の上・詰まない', () => {
    const boss = ENEMIES['boss']!;
    // L1 素手では負ける＝「そのまま行くと負ける」手応え（ponti 指示）。
    expect(autoWinnable(fistHero(1), boss)).toBe(false);
    // L2 以上の素手＋リトライ全回復なら勝てる＝softlock しない（遺構の遭遇で必ず L2 以上に育つ）。
    expect(autoWinnable(fistHero(2), boss)).toBe(true);
    expect(autoWinnable(fistHero(3), boss)).toBe(true);
  });

  it('覚醒後の盤戦の敵は、到達レベル(L4)の素手で勝てる（スキル無しでも詰まない）', () => {
    for (const id of ['awakened', 'frost', 'spark', 'gale']) {
      expect(autoWinnable(fistHero(4), ENEMIES[id]!)).toBe(true);
    }
  });

  it('道中/遺構/坑道の遭遇敵は、到達レベルの素手で勝てる（強さは固定＝スケールしない）', () => {
    const pools = [...new Set([...PATH_ENCOUNTERS, ...RUIN_ENCOUNTERS, ...UNDER_ENCOUNTERS])];
    for (let level = 2; level <= 12; level++) {
      for (const id of pools) {
        expect(autoWinnable(fistHero(level), ENEMIES[id]!), `${id} @L${level}`).toBe(true);
      }
    }
  });

  it('旅の地表（草原/丘陵/荒野/山道）の遭遇敵は、その地方に着く頃の素手で勝てる（地方ごとに強さ固定）', () => {
    // 強さは地方で固定。到達する頃のレベルの素手＋街帰還(全回復)で詰まない。
    const legs: [string[], number][] = [
      [WORLD_ENCOUNTERS, 5], [HILLS_ENCOUNTERS, 5], [BARRENS_ENCOUNTERS, 6], [PASS_ENCOUNTERS, 6],
    ];
    for (const [pool, minL] of legs) {
      for (let level = minL; level <= 12; level++) {
        for (const id of pool) {
          expect(autoWinnable(fistHero(level), ENEMIES[id]!), `${id} @L${level}`).toBe(true);
        }
      }
    }
  });

  it('隠しダンジョン(任意)の遭遇敵は、到達レベル(L6-12)の素手で勝てる', () => {
    for (let level = 6; level <= 12; level++) {
      for (const id of WILDS_ENCOUNTERS) {
        expect(autoWinnable(fistHero(level), ENEMIES[id]!), `${id} @L${level}`).toBe(true);
      }
    }
  });

  it('任意ボス(狩り場の主)は固定値・手強いが、育てば(L7素手＋街帰還で全回復)倒せる＝任意かつ詰まない', () => {
    const ravager = ENEMIES['ravager']!;
    expect(autoWinnable(fistHero(4), ravager)).toBe(false); // 覚醒直後の素手では勝てない＝歯ごたえ
    expect(autoWinnable(fistHero(7), ravager)).toBe(true);  // 育って挑めば倒せる（装備/スキルがあれば更に楽）
  });
});
