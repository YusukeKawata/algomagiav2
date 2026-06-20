// 店（道具屋/武器屋/防具屋）。フィールドの店主に [Z] で開くポーズ・オーバーレイ。買う/売る。
// 通貨＝ゴールドのみ。魔石は道具屋の「売る」でゴールドに換えられる（ponti 指示）。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { game, buyItem, buyWeapon, buyArmor, equipWeapon, equipArmor, sellStone, addItem, consumeItem, itemCount } from '@game/state';
import { ITEMS, itemSellValue } from '@game/data/items';
import { WEAPONS, ARMORS, weaponSellValue, armorSellValue } from '@game/data/equipment';
import { SHOPS, type Shop } from '@game/data/shops';
import { stoneLabel, stoneSellValue } from '@game/data/stones';
import { playSfx } from '@app/ui/sfx';

interface Row { id: string; label: string; price: number; owned?: boolean; kind?: string }

export class ShopScene extends Phaser.Scene {
  private shop!: Shop;
  private mode: 'buy' | 'sell' = 'buy';
  private idx = 0;
  private head!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private msg = '';

  constructor() { super('Shop'); }

  create(data?: { shopId?: string }): void {
    this.shop = SHOPS[data?.shopId ?? 'item'] ?? SHOPS['item']!;
    this.mode = 'buy'; this.idx = 0; this.msg = this.shop.greeting;
    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x05060d, 0.85).setOrigin(0);
    this.head = this.add.text(60, 40, '', { fontFamily: 'monospace', fontSize: '22px', color: COLORS.text });
    this.body = this.add.text(60, 110, '', { fontFamily: 'monospace', fontSize: '19px', color: COLORS.text, lineSpacing: 9 });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e.key));
    this.render();
  }

  private close(): void { playSfx('cancel'); this.scene.stop(); this.scene.resume('Field'); }

  private buyRows(): Row[] {
    return this.shop.stock.map((id) => {
      if (this.shop.kind === 'item') return { id, label: ITEMS[id]!.name, price: ITEMS[id]!.price };
      if (this.shop.kind === 'weapon') return { id, label: `${WEAPONS[id]!.name}（攻+${WEAPONS[id]!.atk}）`, price: WEAPONS[id]!.price, owned: game.ownedWeapons.includes(id) };
      return { id, label: `${ARMORS[id]!.name}（防+${ARMORS[id]!.def} HP+${ARMORS[id]!.hpBonus}）`, price: ARMORS[id]!.price, owned: game.ownedArmors.includes(id) };
    });
  }

  private sellRows(): Row[] {
    if (this.shop.kind === 'weapon') {
      return game.ownedWeapons.filter((id) => id !== 'fist').map((id) => ({ id, label: `${WEAPONS[id]!.name}（攻+${WEAPONS[id]!.atk}）`, price: weaponSellValue(WEAPONS[id]!), kind: 'weapon' }));
    }
    if (this.shop.kind === 'armor') {
      return game.ownedArmors.filter((id) => id !== 'cloth').map((id) => ({ id, label: `${ARMORS[id]!.name}（防+${ARMORS[id]!.def}）`, price: armorSellValue(ARMORS[id]!), kind: 'armor' }));
    }
    // 道具屋＝道具と魔石を売れる。
    const rows: Row[] = Object.keys(ITEMS).filter((id) => itemCount(id) > 0)
      .map((id) => ({ id, label: `${ITEMS[id]!.name} ×${itemCount(id)}`, price: itemSellValue(ITEMS[id]!), kind: 'item' }));
    for (const s of game.stones) rows.push({ id: s.id, label: `魔石 ${stoneLabel(s)}`, price: stoneSellValue(s), kind: 'stone' });
    return rows;
  }

  private rows(): Row[] { return this.mode === 'buy' ? this.buyRows() : this.sellRows(); }

  private onKey(key: string): void {
    const k = key.toLowerCase();
    if (k === 'x' || key === 'Escape') { this.close(); return; }
    if (key === 'ArrowLeft' || key === 'ArrowRight') { this.mode = this.mode === 'buy' ? 'sell' : 'buy'; this.idx = 0; this.msg = ''; playSfx('move'); this.render(); return; }
    const list = this.rows();
    if (key === 'ArrowUp') { if (list.length) this.idx = (this.idx + list.length - 1) % list.length; playSfx('move'); this.render(); return; }
    if (key === 'ArrowDown') { if (list.length) this.idx = (this.idx + 1) % list.length; playSfx('move'); this.render(); return; }
    if (k === 'z' || key === 'Enter') { this.confirm(); return; }
  }

  private confirm(): void {
    const row = this.rows()[this.idx];
    if (!row) return;
    if (this.mode === 'buy') this.doBuy(row); else this.doSell(row);
    // インデックスがリスト末尾を超えたら詰める。
    const len = this.rows().length;
    if (this.idx >= len) this.idx = Math.max(0, len - 1);
    this.render();
  }

  private doBuy(row: Row): void {
    if (this.shop.kind === 'item') {
      if (buyItem(row.id, row.price)) { playSfx('confirm'); this.msg = `${ITEMS[row.id]!.name}を買った（-${row.price}G）。`; }
      else { playSfx('cancel'); this.msg = 'ゴールドが足りない。'; }
    } else if (this.shop.kind === 'weapon') {
      if (row.owned) { playSfx('cancel'); this.msg = 'もう持っている。'; return; }
      if (buyWeapon(row.id, row.price)) { equipWeapon(row.id); playSfx('confirm'); this.msg = `${WEAPONS[row.id]!.name}を買って装備した（-${row.price}G）。`; }
      else { playSfx('cancel'); this.msg = 'ゴールドが足りない。'; }
    } else {
      if (row.owned) { playSfx('cancel'); this.msg = 'もう持っている。'; return; }
      if (buyArmor(row.id, row.price)) { equipArmor(row.id); playSfx('confirm'); this.msg = `${ARMORS[row.id]!.name}を買って装備した（-${row.price}G）。`; }
      else { playSfx('cancel'); this.msg = 'ゴールドが足りない。'; }
    }
  }

  private doSell(row: Row): void {
    playSfx('confirm');
    if (row.kind === 'stone') { const g = sellStone(row.id); this.msg = `魔石を売った（+${g}G）。`; return; }
    if (row.kind === 'item') {
      consumeItem(row.id); game.gold += row.price; addItem(row.id, 0); this.msg = `${ITEMS[row.id]!.name}を売った（+${row.price}G）。`; return;
    }
    if (row.kind === 'weapon') {
      game.ownedWeapons = game.ownedWeapons.filter((w) => w !== row.id);
      if (game.weaponId === row.id) equipWeapon('fist');
      game.gold += row.price; this.msg = `${WEAPONS[row.id]!.name}を売った（+${row.price}G）。`; return;
    }
    if (row.kind === 'armor') {
      game.ownedArmors = game.ownedArmors.filter((a) => a !== row.id);
      if (game.armorId === row.id) equipArmor('cloth');
      game.gold += row.price; this.msg = `${ARMORS[row.id]!.name}を売った（+${row.price}G）。`; return;
    }
  }

  private render(): void {
    this.head.setText(`${this.shop.name}（${this.shop.clerk}）    所持 ${game.gold}G    ［←→］${this.mode === 'buy' ? '【買う】 売る' : '買う 【売る】'}    ［X］出る`);
    const list = this.rows();
    const lines: string[] = [];
    if (list.length === 0) lines.push(this.mode === 'buy' ? '取り扱いがない。' : '売れる物がない。');
    list.forEach((r, i) => {
      const cur = i === this.idx ? '▶' : ' ';
      const own = r.owned ? ' (所持)' : '';
      lines.push(`${cur}${r.label.padEnd(20, '　')} ${r.price}G${own}`);
    });
    lines.push('', this.msg);
    this.body.setText(lines);
  }
}
