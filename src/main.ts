// エントリ: Phaser 4 でゲームを起動する（ADR-0001 v2 / 公式 Vite+TS 構成）。
// 表示層は Phaser、決定論ロジックは src/core（UI非依存・テストで固める）に置く。
// 第1幕は Title から flow.ts が beat を各シーンへ振り分けて駆動する。
import Phaser from 'phaser';
import RexUIPlugin from 'phaser4-rex-plugins/templates/ui/ui-plugin.js';
import { CANVAS_W, CANVAS_H } from '@app/theme';
import { TitleScene } from '@app/TitleScene';
import { NameEntryScene } from '@app/NameEntryScene';
import { StoryScene } from '@app/StoryScene';
import { FieldScene } from '@app/FieldScene';
import { PhysBattleScene } from '@app/PhysBattleScene';
import { BoardScene } from '@app/BoardScene';
import { TheEndScene } from '@app/TheEndScene';

const gameInstance = new Phaser.Game({
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  parent: 'app',
  backgroundColor: '#05060d',
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  plugins: {
    scene: [{ key: 'rexUI', plugin: RexUIPlugin, mapping: 'rexUI' }],
  },
  scene: [TitleScene, NameEntryScene, StoryScene, FieldScene, PhysBattleScene, BoardScene, TheEndScene],
});

// dev 限定: 実機目視スクリプト(playwright)が「いまどのシーンか」を読めるよう公開する。本番ビルドでは剥がれる。
const DEV = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false;
if (DEV) {
  (window as Window & { __game?: Phaser.Game }).__game = gameInstance;
}
