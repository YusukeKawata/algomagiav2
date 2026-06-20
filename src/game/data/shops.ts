// 店の品揃え（第1幕の里＝行商人が開く小さな店）。世界観では里は閉じた貧しい集落なので、
// 旅の行商人が立ち寄って店を開く、という軽い口実で道具屋/武器屋/防具屋を置く（ponti 指示）。
export type ShopKind = 'item' | 'weapon' | 'armor';

export interface Shop {
  id: string;
  kind: ShopKind;
  name: string;
  clerk: string;       // 店主の表示名
  greeting: string;
  stock: string[];     // 取り扱い ID（kind に応じて ITEMS/WEAPONS/ARMORS を引く）
}

export const SHOPS: Record<string, Shop> = {
  item: {
    id: 'item', kind: 'item', name: '道具屋', clerk: '行商人',
    greeting: '旅の道具、揃えてくよ。やくそうは安いよ。',
    stock: ['herb', 'potion', 'dew', 'spring'],
  },
  weapon: {
    id: 'weapon', kind: 'weapon', name: '武器屋', clerk: '鍛冶のドラム',
    greeting: '里の鉄はたかが知れてるが…身は守れる。',
    stock: ['knife', 'spear', 'blade'],
  },
  armor: {
    id: 'armor', kind: 'armor', name: '防具屋', clerk: '仕立てのメイ',
    greeting: '丈夫なのを縫っといたよ。魔物は爪が鋭いからね。',
    stock: ['leather', 'scale', 'ward'],
  },
};
