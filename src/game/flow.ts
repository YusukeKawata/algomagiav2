// 第1幕のフロー駆動。ACT1 の beat を順に、対応するシーンへ振り分ける。
// 各シーンは完了時に advance(this) を呼ぶ＝次の beat のシーンへ。
import type Phaser from 'phaser';
import { ACT1, type Beat } from '@game/script';
import { maybeAutosave } from '@game/save';
import { transitionTo } from '@app/ui/fx';

let idx = 0;
let lastFieldIdx = 0; // 直近に通った field beat（敗北→直近の街へ戻すときの巻き戻し先）

export function startFlow(): void { idx = 0; lastFieldIdx = 0; }
export function setFlowIndex(i: number): void { idx = i; }
export function flowIndex(): number { return idx; }
export function currentBeat(): Beat | undefined { return ACT1[idx]; }

/** フロー戦闘で敗北したとき、直前の field beat（＝自由移動できた街/フィールド）へ巻き戻す。 */
export function rewindToLastField(): void { idx = lastFieldIdx; }

/** 現在の beat に対応するシーンへ（フェード遷移で統一）。 */
export function route(scene: Phaser.Scene): void {
  const b = ACT1[idx];
  if (!b) { transitionTo(scene, 'TheEnd'); return; }
  switch (b.kind) {
    case 'dialog':
    case 'awaken':
      transitionTo(scene, 'Story');
      break;
    case 'field':
      lastFieldIdx = idx;
      transitionTo(scene, 'Field');
      break;
    case 'battle':
      transitionTo(scene, 'Battle');
      break;
    case 'end':
      transitionTo(scene, 'TheEnd');
      break;
  }
}

/** 次の beat へ進み、そのシーンを開始する。退場中（フェード中）の二重呼びは無視＝ビート飛ばし防止。 */
export function advance(scene: Phaser.Scene): void {
  if ((scene as Phaser.Scene & { __leaving?: boolean }).__leaving) return;
  idx++;
  maybeAutosave(idx); // 覚醒後のみ保存される
  route(scene); // route→transitionTo が __leaving を立てる
}
