// 敵データ（第1幕スライス）。物理戦＝覚醒前（HP/攻撃）、盤戦＝覚醒後（魔石盤・弱点）。
import type { Attr } from '@core/board';
import { NAMES } from '@game/data/names';

export interface PhysEnemy { id: string; name: string; hp: number; atk: number; drop: number }
export interface BoardEnemy { id: string; name: string; hp: number; weakness: Attr }

// 物理戦の主人公の殴り火力（手書き）。バランス不変条件は core/phys.test.ts で固定。
export const PHYS_POWER = 6;

// 中間難易度: 各戦闘は開始時に全回復（state.heroHpMax=30 / phys.startPhys）。
// 主人公は雑魚を数発で倒し、番獣は5発で“ぎりぎり勝てる”（hp30/atk5・hero30 → 残HP10）。
export const PHYS_ENEMIES: Record<string, PhysEnemy> = {
  mob1: { id: 'mob1', name: NAMES.mob, hp: 10, atk: 3, drop: 1 },
  mob2: { id: 'mob2', name: NAMES.mob, hp: 14, atk: 4, drop: 1 },
  boss: { id: 'boss', name: NAMES.boss, hp: 30, atk: 5, drop: 5 },
};

// 盤戦: 覚醒後の最初の敵。弱点=炎。AWAKENED_START（strength6）の炎回路で12ダメージ×2発で倒せる入門戦。
export const BOARD_ENEMIES: Record<string, BoardEnemy> = {
  awakened: { id: 'awakened', name: NAMES.mob, hp: 24, weakness: 'fire' },
};
