// 起動時のアセット読み込み（最初のシーン）。タイル等を読み終えたら Title へ。
// テクスチャは TextureManager に常駐するので一度だけ。本番でも dev でも共通。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { loadTiles } from '@app/ui/tiles';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload(): void {
    const t = this.add.text(CANVAS_W / 2, CANVAS_H / 2, 'Loading…', {
      fontFamily: 'monospace', fontSize: '22px', color: COLORS.dim,
    }).setOrigin(0.5);
    this.load.on('complete', () => t.destroy());
    loadTiles(this);
  }

  create(): void {
    this.scene.start('Title');
  }
}
