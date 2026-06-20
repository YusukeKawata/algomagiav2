// 道具（消耗品）。道具屋で購入し、戦闘/フィールドで使う。ゴールドで売買。
// kind: healHp=HP回復 / healFw=自由意志回復 / revive=戦闘不能から復帰（将来）。
export type ItemKind = 'healHp' | 'healFw';

export interface Item {
  id: string;
  name: string;
  desc: string;
  price: number;   // 購入価格（ゴールド）。売値は半額（floor）。
  kind: ItemKind;
  power: number;   // 回復量
}

export const ITEMS: Record<string, Item> = {
  herb:    { id: 'herb',    name: 'やくそう',   desc: 'HPを20回復する。',          price: 8,  kind: 'healHp', power: 20 },
  potion:  { id: 'potion',  name: '回復薬',     desc: 'HPを45回復する。',          price: 22, kind: 'healHp', power: 45 },
  dew:     { id: 'dew',     name: '意志の雫',   desc: '自由意志を12回復する。',     price: 16, kind: 'healFw', power: 12 },
  spring:  { id: 'spring',  name: '泉の小瓶',   desc: '自由意志を28回復する。',     price: 40, kind: 'healFw', power: 28 },
};

/** 道具の売値（購入価格の半分）。 */
export function itemSellValue(item: Item): number {
  return Math.floor(item.price / 2);
}
