// 敵データ（第1幕スライス）。物理戦＝覚醒前（HP/攻撃）、盤戦＝覚醒後（魔石盤・弱点）。
import type { Attr } from '@core/board';
import { NAMES } from '@game/data/names';

export interface PhysEnemy { id: string; name: string; hp: number; atk: number; drop: number }
export interface BoardEnemy { id: string; name: string; hp: number; weakness: Attr }

export const PHYS_ENEMIES: Record<string, PhysEnemy> = {
  mob1: { id: 'mob1', name: NAMES.mob, hp: 10, atk: 3, drop: 1 },
  mob2: { id: 'mob2', name: NAMES.mob, hp: 14, atk: 4, drop: 1 },
  boss: { id: 'boss', name: NAMES.boss, hp: 34, atk: 6, drop: 5 },
};

export const BOARD_ENEMIES: Record<string, BoardEnemy> = {
  awakened: { id: 'awakened', name: NAMES.mob, hp: 24, weakness: 'fire' },
};
