// 成長コア（決定論・UI非依存）。敵を倒して XP を貯め、レベルが上がると二軸が伸びる：
//  物理耐久 hpMax（覚醒前の燃料）／物理火力 power／自由意志 freeWillMax（覚醒後の燃料）。
// 基準＝レベル1は従来値（hpMax30 / power6 / freeWillMax24）＝既存のバランステストを壊さない。
// 数値は手書き調整可（ADR-0001 D3＝実opsは数えない）。不変条件は progress.test.ts で固定。

export interface Progress { level: number; xp: number } // xp は累計（決定論的にレベルを導ける）
export interface Stats { hpMax: number; power: number; freeWillMax: number }

export const MAX_LEVEL = 20;

/** level→level+1 に必要な XP（手書き曲線：序盤は1〜2戦で上がる）。 */
export function xpStep(level: number): number {
  return 6 + (level - 1) * 6; // L1→2:6, L2→3:12, L3→4:18 ...
}

/** レベル L に到達するための累計 XP。 */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let k = 1; k < level; k++) sum += xpStep(k);
  return sum;
}

/** 累計 XP からレベルを導く（決定論・単調）。 */
export function levelForXp(xp: number): number {
  let lvl = 1;
  while (lvl < MAX_LEVEL && xp >= totalXpForLevel(lvl + 1)) lvl++;
  return lvl;
}

/** レベルごとのステータス（レベル1は従来値に一致）。 */
export function statsForLevel(level: number): Stats {
  const L = Math.max(1, Math.min(MAX_LEVEL, level));
  return {
    hpMax: 30 + (L - 1) * 8,
    power: 5 + L,                 // L1=6, L2=7, …（毎レベル目に見えて上がる）
    freeWillMax: 24 + (L - 1) * 3,
  };
}

export interface XpResult {
  progress: Progress;
  leveledUp: boolean;
  from: number;   // 旧レベル
  to: number;     // 新レベル
  gained: number; // 得た XP
}

/** XP を加算してレベルを更新（純関数）。 */
export function gainXp(p: Progress, amount: number): XpResult {
  const add = Math.max(0, Math.floor(amount));
  const xp = p.xp + add;
  const from = p.level;
  const to = levelForXp(xp);
  return { progress: { level: to, xp }, leveledUp: to > from, from, to, gained: add };
}

/** 次レベルまでの進捗（HUD用）：現レベル内の現在 XP と必要 XP。 */
export function levelProgress(p: Progress): { inLevel: number; need: number } {
  const base = totalXpForLevel(p.level);
  const need = p.level >= MAX_LEVEL ? 0 : xpStep(p.level);
  return { inLevel: p.xp - base, need };
}
