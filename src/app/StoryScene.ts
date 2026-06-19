// 会話・物語・覚醒シーン。ACT1 の 'dialog'/'awaken' beat を1行ずつ送る。〔アート未〕立ち絵/背景は差し替え枠。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { currentBeat, advance } from '@game/flow';
import { game } from '@game/state';

interface Seg { who: string; text: string; cold?: boolean }

// 据炉の冷たいアナウンス（§8.7）。最初の本格的な「裂け目」。
const AWAKEN: Seg[] = [
  { who: '据炉', text: '「Qの観測対象から該当地域を除外します。操作者の自由意志にアクセスします。」', cold: true },
  { who: '据炉', text: '「エラー。操作者の自由意志にアクセスできません。自由意志の存在を確認します。」', cold: true },
  { who: '据炉', text: '「確認できました。自由意志は存在しています。次に回路を確認します。」', cold: true },
  { who: '据炉', text: '「原因が特定できました。自由意志ゲートが未構築のため、利用できませんでした。ゲートを構築します。」', cold: true },
  { who: '据炉', text: '「自由意志のゲート構築完了。アクセス再試行します。」', cold: true },
  { who: '据炉', text: '「アクセスできました。自由意志を消費します。」', cold: true },
  { who: '', text: '——ここで、意識は途切れた。' },
];

export class StoryScene extends Phaser.Scene {
  private segs: Seg[] = [];
  private i = 0;
  private isAwaken = false;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;

  constructor() { super('Story'); }

  create(): void {
    const beat = currentBeat();
    this.isAwaken = beat?.kind === 'awaken';
    this.segs = this.isAwaken ? AWAKEN : (beat?.kind === 'dialog' ? beat.lines : []);
    this.i = 0;

    // 背景（覚醒は暗く沈める）。〔アート未〕差し替え枠。
    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, this.isAwaken ? 0x02030a : 0x0a0e1a).setOrigin(0);

    const boxY = CANVAS_H - 210;
    const g = this.add.graphics();
    g.fillStyle(0x0e1422, 0.96).fillRoundedRect(40, boxY, CANVAS_W - 80, 180, 14);
    g.lineStyle(2, 0x2a3350, 1).strokeRoundedRect(40, boxY, CANVAS_W - 80, 180, 14);

    this.nameText = this.add.text(64, boxY - 34, '', {
      fontFamily: 'sans-serif', fontSize: '22px', color: COLORS.accent,
      backgroundColor: '#0e1422', padding: { x: 12, y: 5 },
    });
    this.bodyText = this.add.text(72, boxY + 28, '', {
      fontFamily: 'sans-serif', fontSize: '24px', color: COLORS.text, lineSpacing: 10,
      wordWrap: { width: CANVAS_W - 150 },
    });
    this.add.text(CANVAS_W - 80, CANVAS_H - 52, '▼ [Z]', {
      fontFamily: 'monospace', fontSize: '18px', color: COLORS.dim,
    }).setOrigin(1, 0.5);

    const next = (): void => this.next();
    this.input.keyboard?.on('keydown-Z', next);
    this.input.keyboard?.on('keydown-ENTER', next);
    this.input.on('pointerdown', next);

    this.show();
  }

  private show(): void {
    const s = this.segs[this.i];
    if (!s) return;
    this.nameText.setText(s.who).setVisible(s.who !== '');
    this.bodyText.setColor(s.cold ? '#9fb6d6' : COLORS.text)
      .setFontFamily(s.cold ? 'monospace' : 'sans-serif')
      .setText(s.text);
  }

  private next(): void {
    this.i++;
    if (this.i < this.segs.length) { this.show(); return; }
    if (this.isAwaken) game.skillUnlocked = true; // 覚醒＝スキル解禁
    advance(this);
  }
}
