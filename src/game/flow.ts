// 第1幕のフロー駆動。ACT1 の beat を順に、対応するシーンへ振り分ける。
// 各シーンは完了時に advance(this) を呼ぶ＝次の beat のシーンへ。
import type Phaser from 'phaser';
import { ACT1, type Beat } from '@game/script';

let idx = 0;

export function startFlow(): void { idx = 0; }
export function currentBeat(): Beat | undefined { return ACT1[idx]; }

/** 現在の beat に対応するシーンを開始する。 */
export function route(scene: Phaser.Scene): void {
  const b = ACT1[idx];
  if (!b) { scene.scene.start('TheEnd'); return; }
  switch (b.kind) {
    case 'dialog':
    case 'awaken':
      scene.scene.start('Story');
      break;
    case 'field':
      scene.scene.start('Field');
      break;
    case 'battle':
      scene.scene.start(b.mode === 'board' ? 'Board' : 'Phys');
      break;
    case 'end':
      scene.scene.start('TheEnd');
      break;
  }
}

/** 次の beat へ進み、そのシーンを開始する。 */
export function advance(scene: Phaser.Scene): void {
  idx++;
  route(scene);
}
