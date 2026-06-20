// 会話箱（純UI層）。下部の枠＋名前プレート＋1文字送り本文＋点滅▼ を1つにまとめた再利用部品。
// StoryScene / FieldScene が共用する＝会話の手触りを一箇所で揃える（第2幕でもそのまま使う）。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { Typewriter } from '@app/ui/typewriter';
import { playSfx } from '@app/ui/sfx';

const COLD_COLOR = '#9fb6d6'; // 据炉の「冷たい声」用（monospace＋青白）

export interface ShowOpts { cold?: boolean }

export class DialogBox {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly indicator: Phaser.GameObjects.Text;
  private readonly tw: Typewriter;

  constructor(scene: Phaser.Scene) {
    const boxY = CANVAS_H - 210;
    const h = 180;
    this.g = scene.add.graphics().setDepth(500);
    this.g.fillStyle(0x0e1422, 0.96).fillRoundedRect(40, boxY, CANVAS_W - 80, h, 14);
    this.g.lineStyle(2, 0x2a3350, 1).strokeRoundedRect(40, boxY, CANVAS_W - 80, h, 14);

    this.nameText = scene.add.text(64, boxY - 34, '', {
      fontFamily: 'sans-serif', fontSize: '22px', color: COLORS.accent,
      backgroundColor: '#0e1422', padding: { x: 12, y: 5 },
    }).setDepth(501);
    this.bodyText = scene.add.text(72, boxY + 28, '', {
      fontFamily: 'sans-serif', fontSize: '24px', color: COLORS.text, lineSpacing: 10,
      wordWrap: { width: CANVAS_W - 150 },
    }).setDepth(501);
    this.indicator = scene.add.text(CANVAS_W - 80, CANVAS_H - 52, '▼ [Z]', {
      fontFamily: 'monospace', fontSize: '18px', color: COLORS.dim,
    }).setOrigin(1, 0.5).setDepth(501);
    scene.tweens.add({ targets: this.indicator, alpha: 0.25, duration: 520, yoyo: true, repeat: -1 });

    this.tw = new Typewriter(scene, this.bodyText, {
      onChar: () => playSfx('text'),
      onDone: () => this.indicator.setVisible(true),
    });
    this.setVisible(false);
  }

  /** 1セリフを表示する（文字送り開始）。 */
  show(who: string, text: string, opts?: ShowOpts): void {
    this.setVisible(true);
    this.indicator.setVisible(false);
    this.nameText.setText(who).setVisible(who !== '');
    const cold = opts?.cold ?? false;
    this.bodyText.setColor(cold ? COLD_COLOR : COLORS.text).setFontFamily(cold ? 'monospace' : 'sans-serif');
    this.tw.play(text);
  }

  /** 入力1回ぶんの処理。表示途中なら全表示して 'skipped'、表示済みなら 'advance' を返す（1入力=1アクション）。 */
  press(): 'skipped' | 'advance' {
    if (this.tw.isTyping()) { this.tw.skip(); return 'skipped'; }
    return 'advance';
  }

  isTyping(): boolean { return this.tw.isTyping(); }

  setVisible(v: boolean): void {
    this.g.setVisible(v);
    this.nameText.setVisible(v && this.nameText.text !== '');
    this.bodyText.setVisible(v);
    this.indicator.setVisible(false);
  }

  stop(): void { this.tw.stop(); }
}
