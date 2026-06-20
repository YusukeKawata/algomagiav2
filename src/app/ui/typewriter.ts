// 1文字ずつ表示する文字送り（純UI層）。Phaser の Text に対して使う。
// 「1入力＝1アクション」を守るため、表示中は skip() で即全表示し、完了後にだけ次へ進む（呼び出し側が isTyping で分岐）。
import type Phaser from 'phaser';

export interface TypewriterOpts { speed?: number; onChar?: () => void; onDone?: () => void }

export class Typewriter {
  private full = '';
  private i = 0;
  private timer?: Phaser.Time.TimerEvent;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly target: Phaser.GameObjects.Text,
    private readonly opts: TypewriterOpts = {},
  ) {}

  /** text の表示を頭から開始する。 */
  play(text: string): void {
    this.stop();
    this.full = text;
    this.i = 0;
    this.target.setText('');
    if (text.length === 0) { this.opts.onDone?.(); return; }
    this.timer = this.scene.time.addEvent({
      delay: this.opts.speed ?? 28,
      loop: true,
      callback: () => this.tick(),
    });
  }

  private tick(): void {
    this.i++;
    this.target.setText(this.full.slice(0, this.i));
    if (this.i < this.full.length) this.opts.onChar?.();
    if (this.i >= this.full.length) { this.stop(); this.opts.onDone?.(); }
  }

  /** 表示中なら残りを即時に全表示する。 */
  skip(): void {
    this.i = this.full.length;
    this.target.setText(this.full);
    this.stop();
    this.opts.onDone?.();
  }

  isTyping(): boolean { return this.timer !== undefined; }

  /** タイマーを止める（シーン終了時にも呼ぶ）。 */
  stop(): void {
    this.timer?.remove();
    this.timer = undefined;
  }
}
