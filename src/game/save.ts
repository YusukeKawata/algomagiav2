// セーブ/ロード（localStorage）。オートセーブは「魔石を装備してから＝覚醒後(skillUnlocked)」のみ走る。
// テーマと地続き＝魔石(キュビット)を使い始めて初めて“データが流れる”＝後の「データ奉納(精霊魔法)」の伏線。
import { game, type GameState } from '@game/state';

const KEY = 'algomagia-v2-save';
interface SaveData { v: 1; idx: number; game: GameState }

export function writeSave(idx: number): void {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, idx, game } satisfies SaveData)); } catch { /* noop */ }
}

/** 覚醒後（魔石を装備してから）だけオートセーブする。 */
export function maybeAutosave(idx: number): void {
  if (game.skillUnlocked) writeSave(idx);
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

/** セーブを読み込み game に反映。成功なら beat index を返す。 */
export function loadSave(): number | null {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const d = JSON.parse(s) as SaveData;
    if (d.v !== 1) return null;
    Object.assign(game, d.game);
    return d.idx;
  } catch { return null; }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
