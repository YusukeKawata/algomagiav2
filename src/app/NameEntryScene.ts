// 名前入力。英字を打ち、Enter で確定（空なら既定名）。Backspace で消す。〔簡易版〕
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { game } from '@game/state';
import { NAMES } from '@game/data/names';
import { startFlow, route } from '@game/flow';

export class NameEntryScene extends Phaser.Scene {
  private name = '';
  private label!: Phaser.GameObjects.Text;

  constructor() { super('Name'); }

  create(): void {
    this.name = '';
    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x070a12).setOrigin(0);
    this.add.text(CANVAS_W / 2, 220, 'なまえを いれてください', {
      fontFamily: 'sans-serif', fontSize: '30px', color: COLORS.text,
    }).setOrigin(0.5);
    this.label = this.add.text(CANVAS_W / 2, 320, '', {
      fontFamily: 'monospace', fontSize: '44px', color: COLORS.accent,
    }).setOrigin(0.5);
    this.add.text(CANVAS_W / 2, 430, '英字で入力 / Backspace=消す / Enter=決定', {
      fontFamily: 'sans-serif', fontSize: '18px', color: COLORS.dim,
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.refresh();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      game.heroName = this.name.trim() || NAMES.heroDefault;
      startFlow();
      route(this);
      return;
    }
    if (e.key === 'Backspace') { this.name = this.name.slice(0, -1); this.refresh(); return; }
    if (e.key.length === 1 && this.name.length < 8 && /[A-Za-z0-9ぁ-んァ-ンー一-龠]/.test(e.key)) {
      this.name += e.key; this.refresh();
    }
  }

  private refresh(): void {
    this.label.setText(this.name || `（${NAMES.heroDefault}）`);
  }
}
