// タイトル。Z/Enter で第1幕を開始する。〔アート未〕背景は差し替え枠。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { resetGame } from '@game/state';
import { startFlow, route } from '@game/flow';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create(): void {
    this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 70, 'Algomagia', {
      fontFamily: 'serif', fontSize: '72px', color: COLORS.text,
    }).setOrigin(0.5);
    this.add.text(CANVAS_W / 2, CANVAS_H / 2 + 6, '— 読まれる運命か、覆す自由か —', {
      fontFamily: 'serif', fontSize: '22px', color: COLORS.dim,
    }).setOrigin(0.5);
    const hint = this.add.text(CANVAS_W / 2, CANVAS_H / 2 + 96, '[Z] / [Enter] ではじめる', {
      fontFamily: 'monospace', fontSize: '20px', color: COLORS.accent,
    }).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    const start = (): void => { resetGame(); startFlow(); route(this); };
    this.input.keyboard?.once('keydown-Z', start);
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.once('pointerdown', start);
  }
}
