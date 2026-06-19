// 土台確認用の最小シーン。Phaser が起動し描画できることを示すだけ。
// ここに v2 の本実装（タイトル→フィールド→戦闘→会話…）を段階的に積んでいく。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 - 40, 'Algomagia', {
        fontFamily: 'sans-serif',
        fontSize: '56px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 + 24, 'v2 — 土台（決定論SQ vs 自由意志exSQ）', {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: COLORS.dim,
      })
      .setOrigin(0.5);
  }
}
