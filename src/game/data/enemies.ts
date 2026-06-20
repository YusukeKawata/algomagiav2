// 敵データ（第1幕スライス）。ターン制戦闘（core/combat）で使う統一モデル。
// ⚠ 名前はモンスターらしく（敵＝exSQ排斥プログラムという正体は物語で明かす伏せ事実）。
//   ドロップ品が「魔石」なので、敵名に「石」は付けない。
import type { Attr } from '@core/board';
import { NAMES } from '@game/data/names';

// hp/atk＝戦闘の体力と攻撃。weakness＝弱点属性（その元素スキルで2倍）。
// gold＝撃破で得る通貨。pool＝魔石ドロップ抽選（stones.ts STONE_POOLS）。color＝トークン色。
// bigEvery>0＝強敵の「ためる→大攻撃」周期（看破=みやぶる で受け流せる予測防御の見せ場）。
export interface Enemy { id: string; name: string; hp: number; atk: number; weakness: Attr; gold: number; pool: string; xp: number; color?: number; bigEvery?: number }

// 旧シーン/テスト互換のエイリアス（統一後も型名を温存）。
export type PhysEnemy = Enemy;
export type BoardEnemy = Enemy;

// レベル1基準火力（バランス不変条件 core/phys.test.ts 用）。実戦は state.heroAtk()。
export const PHYS_POWER = 6;

// 中間難易度: 各戦闘は開始時に全回復。奥へ進むほど手強い。color は人物アートが無い間のトークン色。
export const ENEMIES: Record<string, Enemy> = {
  // 道中/遺構の魔物（覚醒前は素手＝物理で戦う）。
  mob1:     { id: 'mob1',     name: '霧狼',     hp: 10, atk: 3, weakness: 'fire',    gold: 3,  pool: 'weak',   xp: 4,  color: 0x8a7d5a },
  mob2:     { id: 'mob2',     name: '群れ狼',   hp: 14, atk: 4, weakness: 'fire',    gold: 4,  pool: 'weak',   xp: 6,  color: 0x9a6a4a },
  gnawer:   { id: 'gnawer',   name: '岩噛み',   hp: 18, atk: 4, weakness: 'thunder', gold: 6,  pool: 'mid',    xp: 9,  color: 0x6a8a5a },
  shade:    { id: 'shade',    name: '淀みの影', hp: 16, atk: 6, weakness: 'fire',    gold: 7,  pool: 'mid',    xp: 10, color: 0x4a4a6a },
  sentinel: { id: 'sentinel', name: '双角獣',   hp: 24, atk: 5, weakness: 'ice',     gold: 10, pool: 'mid',    xp: 14, color: 0x7a5a8a, bigEvery: 4 },
  boss:     { id: 'boss',     name: NAMES.boss, hp: 34, atk: 5, weakness: 'ice',     gold: 30, pool: 'strong', xp: 28, color: 0xb0405a, bigEvery: 3 },
  // 覚醒後の盤戦で出る、弱点ちがいの魔物（入門=炎弱点）。
  awakened: { id: 'awakened', name: '霧狼',     hp: 24, atk: 4, weakness: 'fire',    gold: 8,  pool: 'mid',    xp: 12, color: 0xff7043 },
  frost:    { id: 'frost',    name: '氷狼',     hp: 30, atk: 5, weakness: 'fire',    gold: 12, pool: 'strong', xp: 16, color: 0x4fc3f7, bigEvery: 4 },
  spark:    { id: 'spark',    name: '雷甲虫',   hp: 28, atk: 5, weakness: 'wind',    gold: 12, pool: 'mid',    xp: 16, color: 0xffd54f, bigEvery: 4 },
  gale:     { id: 'gale',     name: '疾風鳥',   hp: 32, atk: 6, weakness: 'thunder', gold: 14, pool: 'strong', xp: 18, color: 0x81c784, bigEvery: 3 },
};

// 旧名アクセスの互換エイリアス（同一データ）。
export const PHYS_ENEMIES = ENEMIES;
export const BOARD_ENEMIES = ENEMIES;

// 遺構の遭遇テーブル（弱い順）。奥へ進むほど後ろの敵が出る（FieldScene が深さで選ぶ）。
export const RUIN_ENCOUNTERS: string[] = ['mob1', 'mob2', 'gnawer', 'shade', 'sentinel'];

// 森の小道の遭遇（里→遺構の道中・軽め）。
export const PATH_ENCOUNTERS: string[] = ['mob1', 'mob1', 'mob2'];

// マップID→遭遇テーブル。歩いて遭遇するフィールドだけ登録する。
export const ENCOUNTER_POOLS: Record<string, string[]> = {
  path: PATH_ENCOUNTERS,
  ruin: RUIN_ENCOUNTERS,
};
