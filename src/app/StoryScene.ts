// 会話・物語・覚醒シーン。ACT1 の 'dialog'/'awaken' beat を DialogBox で1文字ずつ送る。
// 〔アート未〕立ち絵/背景は差し替え枠。覚醒だけ背景を暗く沈め、据炉の声を cold スタイルで出す。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from '@app/theme';
import { currentBeat, advance } from '@game/flow';
import { game } from '@game/state';
import { DialogBox } from '@app/ui/dialogbox';
import { fadeInOnCreate, addMuteToggle } from '@app/ui/fx';

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
  private box!: DialogBox;

  constructor() { super('Story'); }

  create(): void {
    fadeInOnCreate(this);
    const beat = currentBeat();
    this.isAwaken = beat?.kind === 'awaken';
    this.segs = this.isAwaken ? AWAKEN : (beat?.kind === 'dialog' ? beat.lines : []);
    this.i = 0;

    // 背景（覚醒は暗く沈める）。〔アート未〕差し替え枠。
    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, this.isAwaken ? 0x02030a : 0x0a0e1a).setOrigin(0);

    this.box = new DialogBox(this);

    const next = (): void => this.advanceLine();
    this.input.keyboard?.on('keydown-Z', next);
    this.input.keyboard?.on('keydown-ENTER', next);
    this.input.on('pointerdown', next);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.box.stop());

    addMuteToggle(this);
    this.showCurrent();
  }

  private showCurrent(): void {
    const s = this.segs[this.i];
    if (!s) return;
    this.box.show(s.who, s.text, { cold: s.cold });
  }

  private advanceLine(): void {
    if (this.box.press() === 'skipped') return; // 表示途中なら全表示だけ（1入力=1アクション）
    this.i++;
    if (this.i < this.segs.length) { this.showCurrent(); return; }
    if (this.isAwaken) game.skillUnlocked = true; // 覚醒＝スキル解禁
    advance(this);
  }
}
