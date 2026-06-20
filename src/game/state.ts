// ゲーム全体の状態（シングルトン）。シーン間で共有する。決定論ロジックは src/core。
// 〔将来〕セーブ/ロードはこの構造を localStorage に。いまは1セッションのスライス用。
import { NAMES } from '@game/data/names';
import { statsForLevel, gainXp, type XpResult } from '@core/progress';

export interface GameState {
  heroName: string;
  level: number;         // 成長（敵撃破で上がる）
  xp: number;            // 累計XP（レベルは progress.levelForXp で導ける）
  heroHpMax: number;     // = statsForLevel(level).hpMax（物理戦の燃料）
  heroHp: number;        // 物理戦（覚醒前）で使う
  freeWillMax: number;   // = statsForLevel(level).freeWillMax（盤戦の燃料）
  stones: number;        // 集めた魔石（覚醒前は使い道がない＝伏線）
  skillUnlocked: boolean; // 据炉での覚醒で true
  flags: Record<string, boolean>;
}

export const game: GameState = makeFresh();

function makeFresh(): GameState {
  const s = statsForLevel(1);
  return {
    heroName: NAMES.heroDefault,
    level: 1,
    xp: 0,
    heroHpMax: s.hpMax,
    heroHp: s.hpMax,
    freeWillMax: s.freeWillMax,
    stones: 0,
    skillUnlocked: false,
    flags: {},
  };
}

/** 現在レベルの物理火力（PhysBattle が使う）。 */
export function physPower(): number { return statsForLevel(game.level).power; }

/**
 * XP を加算してレベル・ステータスを更新（決定論は core/progress に委譲）。
 * レベルが上がったら hpMax/freeWillMax を伸ばし、HP は満タンに戻す（成長の報酬）。
 */
export function grantXp(amount: number): XpResult {
  const r = gainXp({ level: game.level, xp: game.xp }, amount);
  game.level = r.progress.level;
  game.xp = r.progress.xp;
  const s = statsForLevel(game.level);
  game.heroHpMax = s.hpMax;
  game.freeWillMax = s.freeWillMax;
  if (r.leveledUp) game.heroHp = s.hpMax;
  return r;
}

export function resetGame(): void {
  Object.assign(game, makeFresh());
  Object.assign(fieldResume, { active: false, mapId: '', x: 0, y: 0, step: 0, questGiven: false, encounters: 0 });
}

// フィールド→戦闘→フィールド の往復で、歩いていた位置/進捗を保持する。
export interface FieldResume {
  active: boolean; mapId: string; x: number; y: number; step: number; questGiven: boolean; encounters: number;
}
export const fieldResume: FieldResume = { active: false, mapId: '', x: 0, y: 0, step: 0, questGiven: false, encounters: 0 };
