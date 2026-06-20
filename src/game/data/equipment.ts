// 装備（武器・防具）。魔石とは別系統の装備。武器＝物理火力(atk)、防具＝防御(def)＋HP上限(hpBonus)。
// 戦闘の「攻撃」コマンドのダメージ＝ heroAtk()＝physPower(level)＋武器atk、被ダメ軽減＝ heroDef()＝防具def。
// ゴールドで売買。既定の素手/布の服は price 0（外せない最低装備＝常に何か装備している扱い）。

export interface Weapon { id: string; name: string; atk: number; price: number; desc: string }
export interface Armor { id: string; name: string; def: number; hpBonus: number; price: number; desc: string }

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
  ward:    { id: 'ward',    name: '守りの外套', def: 8, hpBonus: 24, price: 280, desc: '魔石の粉を織り込んだ外套。' },
};

export function weaponSellValue(w: Weapon): number { return Math.floor(w.price / 2); }
export function armorSellValue(a: Armor): number { return Math.floor(a.price / 2); }
