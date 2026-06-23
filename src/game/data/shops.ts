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
    greeting: '丈夫なのを縫っといたよ。…炎やら氷やら、魔物に合わせて着替えな。',
    stock: ['leather', 'scale', 'emberhide', 'frostweave', 'stormhide', 'ward'],
  },
  // 旅の途中（荒野の廃墟）で店を開く行商人。街が遠い道中の補給＝回復薬を売り、余った魔石を買い取る。
  road: {
    id: 'road', kind: 'item', name: '旅の荷', clerk: '旅の行商人',
    greeting: 'こんな荒れ地で人に会うとはね。…薬がいるだろう。余った魔石は買い取るよ。',
    stock: ['herb', 'potion', 'dew', 'spring'],
  },
};
