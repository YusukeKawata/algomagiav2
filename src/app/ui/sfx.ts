// 手続き合成の効果音（WebAudio）。アセット不要・決定論には関与しない純UI層。
// AudioContext はユーザー操作（最初のキー/クリック）まで作らない＝ブラウザの自動再生制限に従う。
// ミュート状態は localStorage に保存。BGM は未実装（後回し）。
export type SfxName =
  | 'text'     // 文字送りの微音
  | 'confirm'  // 決定
  | 'cancel'   // 取消/戻る
  | 'move'     // カーソル移動・歩行
  | 'hit'      // 通常の打撃/被弾
  | 'hurt'     // 主人公が痛打を受ける
  | 'weak'     // 弱点ヒット（明るく強い）
  | 'circuit'  // 回路成立のチャイム
  | 'fire'     // スキル発射
  | 'win'      // 勝利
  | 'lose';    // 敗北

const MUTE_KEY = 'algomagia-muted';

let ctx: AudioContext | null = null;
let muted = readMuted();
let lastText = 0; // 文字送りSEの間引き用

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 単音をエンベロープ付きで鳴らす（at=開始オフセット秒）。 */
function tone(c: AudioContext, freq: number, dur: number, type: OscillatorType, gain: number, at = 0): void {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 周波数を滑らかに変える単音（ヒット/敗北のうねり用）。 */
function sweep(c: AudioContext, f0: number, f1: number, dur: number, type: OscillatorType, gain: number): void {
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playSfx(name: SfxName): void {
  if (muted) return;
  const c = audio();
  if (!c) return;
  switch (name) {
    case 'text': {
      const now = c.currentTime;
      if (now - lastText < 0.022) return; // 連続文字送りを間引く
      lastText = now;
      tone(c, 1500, 0.03, 'square', 0.03);
      break;
    }
    case 'confirm': tone(c, 660, 0.08, 'square', 0.06); tone(c, 990, 0.1, 'square', 0.05, 0.06); break;
    case 'cancel': tone(c, 320, 0.12, 'square', 0.05); break;
    case 'move': tone(c, 520, 0.04, 'square', 0.035); break;
    case 'hit': sweep(c, 380, 120, 0.12, 'square', 0.08); break;
    case 'hurt': sweep(c, 240, 70, 0.22, 'sawtooth', 0.09); break;
    case 'weak': tone(c, 880, 0.07, 'square', 0.08); tone(c, 1320, 0.12, 'square', 0.07, 0.05); sweep(c, 520, 160, 0.14, 'square', 0.06); break;
    case 'fire': sweep(c, 900, 1600, 0.1, 'sawtooth', 0.05); break;
    case 'circuit': tone(c, 784, 0.1, 'triangle', 0.06); tone(c, 1175, 0.16, 'triangle', 0.05, 0.07); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(c, f, 0.16, 'triangle', 0.06, i * 0.1)); break;
    case 'lose': sweep(c, 440, 110, 0.6, 'sawtooth', 0.08); break;
  }
}

export function isMuted(): boolean { return muted; }

export function toggleMute(): boolean {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* noop */ }
  if (!muted) playSfx('confirm');
  return muted;
}
