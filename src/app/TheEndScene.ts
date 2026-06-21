// 第1幕スライスの終わり。[Z] でタイトルへ。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { fadeInOnCreate, addMuteToggle, transitionTo } from '@app/ui/fx';
import { playSfx } from '@app/ui/sfx';
import { startBgm } from '@app/ui/music';
import { paintScene } from '@app/ui/bg';

export class TheEndScene extends Phaser.Scene {
  constructor() { super('TheEnd'); }

  create(): void {
    fadeInOnCreate(this, 600);
    paintScene(this, 'end');
    startBgm('end');
    this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 30, '第1幕 ——「霧の里」 おわり', {
      fontFamily: 'serif', fontSize: '40px', color: COLORS.text,
    }).setOrigin(0.5);
    this.add.text(CANVAS_W / 2, CANVAS_H / 2 + 30, 'ここまで遊んでくれてありがとう（縦スライス）', {
      fontFamily: 'sans-serif', fontSize: '20px', color: COLORS.dim,
    }).setOrigin(0.5);
    this.add.text(CANVAS_W / 2, CANVAS_H / 2 + 96, '[Z] でタイトルへ', {
      fontFamily: 'monospace', fontSize: '18px', color: COLORS.accent,
    }).setOrigin(0.5);

    const toTitle = (): void => { playSfx('confirm'); transitionTo(this, 'Title'); };
    this.input.keyboard?.once('keydown-Z', toTitle);
    this.input.once('pointerdown', toTitle);
    addMuteToggle(this);
  }
}
