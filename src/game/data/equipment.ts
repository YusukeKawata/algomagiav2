// 装備（武器・防具）。魔石とは別系統の装備。武器＝物理火力(atk)、防具＝防御(def)＋HP上限(hpBonus)。
// 戦闘の「攻撃」コマンドのダメージ＝ heroAtk()＝physPower(level)＋武器atk、被ダメ軽減＝ heroDef()＝防具def。
// ゴールドで売買。既定の素手/布の服は price 0（外せない最低装備＝常に何か装備している扱い）。

import type { Attr } from '@core/board';

// resist＝属性別の被ダメ係数（正=耐性で軽減・負=弱点で増加）。敵の属性攻撃に効く（core/combat strikeDamage）。
export interface Weapon { id: string; name: string; atk: number; price: number; desc: string }
export interface Armor { id: string; name: string; def: number; hpBonus: number; price: number; desc: string; resist?: Partial<Record<Attr, number>> }

export const WEAPONS: Record<string, Weapon> = {
  fist:    { id: 'fist',    name: '素手',         atk: 0, price: 0,   desc: '武器を持っていない。' },
  knife:   { id: 'knife',   name: '狩りのナイフ', atk: 3, price: 30,  desc: '里の狩人が使う小刀。' },
  spear:   { id: 'spear',   name: '猟の槍',       atk: 6, price: 90,  desc: '間合いの長い狩り槍。' },
  blade:   { id: 'blade',   name: '古い片刃',     atk: 10, price: 220, desc: '遺構で見つかる、よく斬れる刃。' },
};

export const ARMORS: Record<string, Armor> = {
  cloth:   { id: 'cloth',   name: '布の服',   def: 0, hpBonus: 0,  price: 0,   desc: 'ただの普段着。' },
  leather: { id: 'leather', name: '革の胴着', def: 2, hpBonus: 6,  price: 36,  desc: 'なめし革の軽い守り。' },
  scale:   { id: 'scale',   name: '鱗鎧',     def: 5, hpBonus: 14, price: 120, desc: '硬い鱗を綴じた鎧。' },
  ward:    { id: 'ward',    name: '守りの外套', def: 8, hpBonus: 24, price: 280, desc: '魔石の粉を織り込んだ外套。全属性をわずかに和らげる。', resist: { fire: 0.2, ice: 0.2, thunder: 0.2, wind: 0.2 } },
  // 第2幕・地中の里 で手に入る属性特化の守り（敵に合わせて着替える駆け引き）。耐性の裏に弱点を持つ。
  emberhide: { id: 'emberhide', name: '熾火の胴着', def: 4, hpBonus: 12, price: 150, desc: '炎を弾くが氷に脆い。', resist: { fire: 0.5, ice: -0.4 } },
  frostweave:{ id: 'frostweave', name: '凍霜の織衣', def: 4, hpBonus: 12, price: 150, desc: '氷を弾くが炎に脆い。', resist: { ice: 0.5, fire: -0.4 } },
  stormhide: { id: 'stormhide', name: '帯電の革鎧', def: 4, hpBonus: 12, price: 150, desc: '雷を逃がすが風に脆い。', resist: { thunder: 0.5, wind: -0.4 } },
};

export function weaponSellValue(w: Weapon): number { return Math.floor(w.price / 2); }
export function armorSellValue(a: Armor): number { return Math.floor(a.price / 2); }
