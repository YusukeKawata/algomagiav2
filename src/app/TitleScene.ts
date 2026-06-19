// タイトル。セーブがあれば「つづきから」を出す。決定=Z/Enter、選択=上下。
import Phaser from 'phaser';
import { CANVAS_W, COLORS } from '@app/theme';
import { resetGame } from '@game/state';
import { setFlowIndex, route } from '@game/flow';
import { hasSave, loadSave, clearSave } from '@game/save';

export class TitleScene extends Phaser.Scene {
  private items: string[] = [];
  private sel = 0;
  private menu!: Phaser.GameObjects.Text;

  constructor() { super('Title'); }

  create(): void {
    this.add.text(CANVAS_W / 2, 200, 'Algomagia', {
      fontFamily: 'serif', fontSize: '72px', color: COLORS.text,
    }).setOrigin(0.5);
    this.add.text(CANVAS_W / 2, 272, '— 読まれる運命か、覆す自由か —', {
      fontFamily: 'serif', fontSize: '22px', color: COLORS.dim,
    }).setOrigin(0.5);

    this.items = hasSave() ? ['つづきから', 'はじめから'] : ['はじめから'];
    this.sel = 0;
    this.menu = this.add.text(CANVAS_W / 2, 420, '', {
      fontFamily: 'monospace', fontSize: '26px', color: COLORS.text, align: 'center', lineSpacing: 14,
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-UP', () => { this.sel = (this.sel + this.items.length - 1) % this.items.length; this.refresh(); });
    this.input.keyboard?.on('keydown-DOWN', () => { this.sel = (this.sel + 1) % this.items.length; this.refresh(); });
    this.input.keyboard?.on('keydown-Z', () => this.choose());
    this.input.keyboard?.on('keydown-ENTER', () => this.choose());
    this.refresh();
  }

  private refresh(): void {
    this.menu.setText(this.items.map((t, i) => (i === this.sel ? `▶ ${t}` : `   ${t}`)).join('\n'));
  }

  private choose(): void {
    const pick = this.items[this.sel];
    if (pick === 'つづきから') {
      const i = loadSave();
      if (i != null) { setFlowIndex(i); route(this); return; }
    }
    resetGame();
    clearSave();
    this.scene.start('Name');
  }
}
