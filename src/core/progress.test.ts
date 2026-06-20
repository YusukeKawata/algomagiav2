import { describe, it, expect } from 'vitest';
import {
  xpStep, totalXpForLevel, levelForXp, statsForLevel, gainXp, levelProgress, MAX_LEVEL,
} from '@core/progress';

describe('成長: レベル曲線', () => {
  it('レベル1の累計XPは0、XP0ならレベル1', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
  });

  it('累計XPからのレベルは単調（XPが増えてレベルが下がらない）', () => {
    let prev = 1;
    for (let xp = 0; xp <= 2000; xp += 7) {
      const lvl = levelForXp(xp);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });

  it('ちょうど閾値でレベルが上がる', () => {
    const need = totalXpForLevel(2); // = xpStep(1)
    expect(levelForXp(need - 1)).toBe(1);
    expect(levelForXp(need)).toBe(2);
  });

  it('レベルは MAX_LEVEL で頭打ち', () => {
    expect(levelForXp(10_000_000)).toBe(MAX_LEVEL);
  });

  it('xpStep は増加（後のレベルほど重い）', () => {
    for (let l = 1; l < 8; l++) expect(xpStep(l + 1)).toBeGreaterThan(xpStep(l));
  });
});

describe('成長: ステータス', () => {
  it('レベル1は従来値（既存バランステストと整合）', () => {
    expect(statsForLevel(1)).toEqual({ hpMax: 30, power: 6, freeWillMax: 24 });
  });

  it('レベルが上がると hpMax/power/freeWillMax がすべて単調増加', () => {
    for (let l = 1; l < MAX_LEVEL; l++) {
      const a = statsForLevel(l), b = statsForLevel(l + 1);
      expect(b.hpMax).toBeGreaterThan(a.hpMax);
      expect(b.power).toBeGreaterThan(a.power);
      expect(b.freeWillMax).toBeGreaterThan(a.freeWillMax);
    }
  });

  it('MAX_LEVEL を超えても頭打ち（statsForLevel が破綻しない）', () => {
    expect(statsForLevel(999)).toEqual(statsForLevel(MAX_LEVEL));
  });
});

describe('成長: XP獲得', () => {
  it('XPを足すとレベルが上がり、leveledUp/from/to を返す', () => {
    const r = gainXp({ level: 1, xp: 0 }, xpStep(1));
    expect(r.leveledUp).toBe(true);
    expect(r.from).toBe(1);
    expect(r.to).toBe(2);
    expect(r.progress.xp).toBe(xpStep(1));
    expect(r.gained).toBe(xpStep(1));
  });

  it('1回の大量XPで複数レベル上がりうる', () => {
    const big = totalXpForLevel(4);
    const r = gainXp({ level: 1, xp: 0 }, big);
    expect(r.to).toBe(4);
    expect(r.to - r.from).toBe(3);
  });

  it('XPが足りなければレベルは据え置き（純関数で状態不変の元は壊さない）', () => {
    const p = { level: 1, xp: 0 };
    const r = gainXp(p, 1);
    expect(r.leveledUp).toBe(false);
    expect(p.xp).toBe(0); // 元を破壊しない
  });

  it('負やNaNは0扱い', () => {
    expect(gainXp({ level: 2, xp: 10 }, -5).progress.xp).toBe(10);
  });
});

describe('成長: HUD進捗', () => {
  it('レベル内XPと必要XPを返す', () => {
    const p = { level: 2, xp: totalXpForLevel(2) + 3 };
    const lp = levelProgress(p);
    expect(lp.inLevel).toBe(3);
    expect(lp.need).toBe(xpStep(2));
  });

  it('最大レベルでは need=0', () => {
    expect(levelProgress({ level: MAX_LEVEL, xp: totalXpForLevel(MAX_LEVEL) }).need).toBe(0);
  });
});
