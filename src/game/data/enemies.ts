// 敵データ（第1幕スライス）。物理戦＝覚醒前（HP/攻撃）、盤戦＝覚醒後（魔石盤・弱点）。
import type { Attr } from '@core/board';
import { NAMES } from '@game/data/names';

export interface PhysEnemy { id: string; name: string; hp: number; atk: number; drop: number; xp: number; color?: number }
export interface BoardEnemy { id: string; name: string; hp: number; weakness: Attr; xp: number; color?: number }

// 物理戦のレベル1基準火力（バランス不変条件 core/phys.test.ts 用）。実戦は state.physPower() を使う。
export const PHYS_POWER = 6;

// 中間難易度: 各戦闘は開始時に全回復（startPhys は heroHpMax 満タン）。
// 遺構の徘徊石（排斥プログラム端末・§8.2）に種類を持たせ、奥へ進むほど手強くなる。
// color は PhysBattle のトークン色（人物アートが無いので種類を色で示す）。
export const PHYS_ENEMIES: Record<string, PhysEnemy> = {
  mob1:     { id: 'mob1',     name: '徘徊石',       hp: 10, atk: 3, drop: 1, xp: 4,  color: 0x8a7d5a },
  mob2:     { id: 'mob2',     name: '徘徊石・群',    hp: 14, atk: 4, drop: 1, xp: 6,  color: 0x9a6a4a },
  gnawer:   { id: 'gnawer',   name: '石喰い',       hp: 18, atk: 4, drop: 2, xp: 9,  color: 0x6a8a5a },
  shade:    { id: 'shade',    name: '淀みの影',      hp: 16, atk: 6, drop: 2, xp: 10, color: 0x4a4a6a },
  sentinel: { id: 'sentinel', name: '番い石',       hp: 24, atk: 5, drop: 3, xp: 14, color: 0x7a5a8a },
  boss:     { id: 'boss',     name: NAMES.boss,     hp: 34, atk: 5, drop: 5, xp: 28, color: 0xb0405a },
};

// 遺構の遭遇テーブル（弱い順）。奥へ進むほど後ろの敵が出る（FieldScene が深さで選ぶ）。
export const RUIN_ENCOUNTERS: string[] = ['mob1', 'mob2', 'gnawer', 'shade', 'sentinel'];

// 森の小道の遭遇（里→遺構の道中・軽め）。
export const PATH_ENCOUNTERS: string[] = ['mob1', 'mob1', 'mob2'];

// マップID→遭遇テーブル。歩いて遭遇するフィールドだけ登録する。
export const ENCOUNTER_POOLS: Record<string, string[]> = {
  path: PATH_ENCOUNTERS,
  ruin: RUIN_ENCOUNTERS,
};

// 盤戦: 覚醒後の敵。弱点属性ちがいを用意（入門=炎）。
// awakened は AWAKENED_START（strength6）の炎回路で12ダメージ×2発で倒せる入門戦。
export const BOARD_ENEMIES: Record<string, BoardEnemy> = {
  awakened: { id: 'awakened', name: '徘徊石',     hp: 24, weakness: 'fire',    xp: 12, color: 0xff7043 },
  frost:    { id: 'frost',    name: '凍てつき端末', hp: 30, weakness: 'fire',    xp: 16, color: 0x4fc3f7 },
  spark:    { id: 'spark',    name: '帯電端末',    hp: 28, weakness: 'wind',    xp: 16, color: 0xffd54f },
  gale:     { id: 'gale',     name: '荒風端末',    hp: 32, weakness: 'thunder', xp: 18, color: 0x81c784 },
};
