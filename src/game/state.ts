// ゲーム全体の状態（シングルトン）。シーン間で共有する。決定論ロジックは src/core。
// 〔将来〕セーブ/ロードはこの構造を localStorage に。いまは1セッションのスライス用。
import { NAMES } from '@game/data/names';

export interface GameState {
  heroName: string;
  heroHpMax: number;
  heroHp: number;        // 物理戦（覚醒前）で使う
  freeWillMax: number;   // 盤戦（覚醒後）で使う
  stones: number;        // 集めた魔石（覚醒前は使い道がない＝伏線）
  skillUnlocked: boolean; // 据炉での覚醒で true
  flags: Record<string, boolean>;
}

export const game: GameState = makeFresh();

function makeFresh(): GameState {
  return {
    heroName: NAMES.heroDefault,
    heroHpMax: 24,
    heroHp: 24,
    freeWillMax: 24,
    stones: 0,
    skillUnlocked: false,
    flags: {},
  };
}

export function resetGame(): void {
  Object.assign(game, makeFresh());
}
