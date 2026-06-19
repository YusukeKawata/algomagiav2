// エントリ: Phaser 4 でゲームを起動する（ADR-0001 v2 / 公式 Vite+TS 構成）。
// 表示層は Phaser、決定論ロジックは src/core（UI非依存・テストで固める）に置く。
import Phaser from 'phaser';
import RexUIPlugin from 'phaser4-rex-plugins/templates/ui/ui-plugin.js';
import { CANVAS_W, CANVAS_H } from '@app/theme';
import { BootScene } from '@app/BootScene';

new Phaser.Game({
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
  scene: [BootScene],
});
