// 画面演出のヘルパ（純UI層・決定論には関与しない）。濃さ=中間（ポップ/軽い揺れ/フラッシュ）。
// 全シーンはこの共通作法に乗る＝第2幕でも同じ手触りを再利用できる（scene-template.md）。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from '@app/theme';
import { isMuted, toggleMute } from '@app/ui/sfx';

// 背景の沈んだ黒（フェードの基準色）。theme.COLORS.bg と揃える。
const FADE_RGB = [5, 6, 13] as const;

// シーンに「退場中」フラグを持たせ、フェード中の連打で遷移が多重起動するのを防ぐ。
type Leavable = Phaser.Scene & { __leaving?: boolean };

/** シーン開始時に黒からフェードイン。create() の先頭で呼ぶ（退場フラグもここで解除）。 */
export function fadeInOnCreate(scene: Phaser.Scene, dur = 240): void {
  (scene as Leavable).__leaving = false;
  scene.cameras.main.fadeIn(dur, ...FADE_RGB);
}

/**
 * 黒へフェードアウトしてから別シーンへ。シーン遷移はこれに統一する。
 * 既に退場中なら無視（フェード中の連打で fadeOut が再起動し続け、完了イベントが永久に発火しない事故を防ぐ）。
 */
export function transitionTo(scene: Phaser.Scene, key: string, data?: object, dur = 240): void {
  const s = scene as Leavable;
  if (s.__leaving) return;
  s.__leaving = true;
  const cam = scene.cameras.main;
  // data は必ず明示で渡す（undefined だと Phaser が前回 start 時の data を使い回す＝
  // 例: 直前の遭遇戦 {mode:'encounter'} がボス戦に漏れて番獣がmobになる事故を防ぐ）。
  cam.once('camerafadeoutcomplete', () => scene.scene.start(key, data ?? {}));
  cam.fadeOut(dur, ...FADE_RGB);
}

/** ダメージ/数値のポップアップ（上に昇って消える）。big=弱点など強調。 */
export function popupNumber(
  scene: Phaser.Scene, x: number, y: number, text: string,
  opts?: { color?: string; big?: boolean },
): void {
  const big = opts?.big ?? false;
  const t = scene.add.text(x, y, text, {
    fontFamily: 'sans-serif', fontSize: big ? '46px' : '30px', fontStyle: 'bold',
    color: opts?.color ?? '#ffffff', stroke: '#000000', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(1000);
  scene.tweens.add({ targets: t, y: y - (big ? 78 : 56), alpha: 0, duration: big ? 880 : 680, ease: 'Cubic.out', onComplete: () => t.destroy() });
  if (big) {
    t.setScale(0.5);
    scene.tweens.add({ targets: t, scale: 1.15, duration: 150, ease: 'Back.out', yoyo: true });
  }
}

/** 全画面フラッシュ（弱点・回路成立などの瞬間強調）。 */
export function flash(scene: Phaser.Scene, color = 0xffffff, dur = 160): void {
  const c = Phaser.Display.Color.IntegerToColor(color);
  scene.cameras.main.flash(dur, c.red, c.green, c.blue, false);
}

/** 画面を軽く揺らす（被弾など）。intensity の既定=中間。 */
export function shake(scene: Phaser.Scene, intensity = 0.008, dur = 180): void {
  scene.cameras.main.shake(dur, intensity);
}

/**
 * 右下にミュート表示＋[M]で切替（クリックは誤爆を避けキー専用）。全シーンの create() 末尾で呼ぶ。
 */
export function addMuteToggle(scene: Phaser.Scene): void {
  const label = (): string => (isMuted() ? '♪ ミュート中 [M]' : '♪ 音あり [M]');
  const t = scene.add.text(CANVAS_W - 14, CANVAS_H - 12, label(), {
    fontFamily: 'monospace', fontSize: '14px', color: '#5b6479',
  }).setOrigin(1, 1).setDepth(3000);
  scene.input.keyboard?.on('keydown-M', () => t.setText((toggleMute(), label())));
}
