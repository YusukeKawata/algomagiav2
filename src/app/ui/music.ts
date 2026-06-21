// 手続き合成の BGM（WebAudio）。アセット不要・決定論には関与しない純UI層。sfx.ts と同じ AudioContext を共有。
// シーン別に静かなループ（ベースのドローン＋淡いアルペジオ）を流す。[M]ミュート連動（isMuted を毎ステップ確認）。
// 自動再生制限：AudioContext はユーザー操作後に生成される（sfx.audioCtx 経由）。それまでは無音でスケジュールだけ進む。
import { audioCtx, isMuted } from '@app/ui/sfx';

export type BgmTrack = 'title' | 'village' | 'ruin' | 'battle' | 'under' | 'depart' | 'end';

// 各トラック＝テンポ・基準周波数・音色・コード進行（小節ごとの根音半音）・アルペジオ（8分ごとの半音列）。
interface TrackDef {
  bpm: number;
  root: number;            // 基準周波数（Hz）
  bass: OscillatorType;
  lead: OscillatorType;
  leadGain: number;
  chords: number[];        // 1小節ごとの根音オフセット（半音）。ループする。
  arp: number[];           // 8分音符ごとに鳴らす音（現在のコード根音からの半音）。0 は休符扱いの代わりに根音。
}

// minor/major のやさしい進行。数値は「いい感じ」に手書き（音楽理論に厳密でなくてよい）。
const TRACKS: Record<BgmTrack, TrackDef> = {
  // タイトル：静かで広がる短調。
  title:   { bpm: 60, root: 196.0, bass: 'sine',     lead: 'triangle', leadGain: 0.035, chords: [0, -3, -5, -3], arp: [0, 7, 12, 7, 3, 10, 7, 3] },
  // 霧の里：あたたかい長調寄り。
  village: { bpm: 72, root: 220.0, bass: 'sine',     lead: 'triangle', leadGain: 0.034, chords: [0, 5, -2, 3],   arp: [0, 4, 7, 12, 7, 4, 9, 7] },
  // 遺構：低く不穏でまばら。
  ruin:    { bpm: 54, root: 146.8, bass: 'sine',     lead: 'sine',     leadGain: 0.030, chords: [0, 1, 0, -2],   arp: [0, 6, 7, 6, 0, 11, 7, 6] },
  // 戦闘：やや前のめり（速い・短調）。
  battle:  { bpm: 104, root: 174.6, bass: 'sawtooth', lead: 'square',   leadGain: 0.026, chords: [0, 0, -2, 3],  arp: [0, 7, 3, 7, 0, 10, 3, 7] },
  // 地中の里：低いドローンと神秘的な揺らぎ。
  under:   { bpm: 58, root: 130.8, bass: 'sine',     lead: 'triangle', leadGain: 0.030, chords: [0, 3, 5, 3],    arp: [0, 5, 8, 12, 8, 5, 3, 8] },
  // 旅立ち：希望のある長調。
  depart:  { bpm: 76, root: 246.9, bass: 'sine',     lead: 'triangle', leadGain: 0.034, chords: [0, 5, 7, 5],    arp: [0, 4, 7, 11, 12, 7, 4, 7] },
  // エンド：静かな締め。
  end:     { bpm: 56, root: 196.0, bass: 'sine',     lead: 'sine',     leadGain: 0.030, chords: [0, -3, -5, 0],  arp: [0, 7, 12, 7, 3, 7, 0, 3] },
};

let timer: ReturnType<typeof setInterval> | null = null;
let master: GainNode | null = null;
let current: BgmTrack | null = null;
let def: TrackDef | null = null;
let step = 0;       // 8分音符カウンタ
let nextTime = 0;   // 次に鳴らす時刻（AudioContext時間）

function semis(root: number, n: number): number { return root * Math.pow(2, n / 12); }

function note(c: AudioContext, dest: GainNode, freq: number, dur: number, at: number, type: OscillatorType, gain: number): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

function scheduleStep(c: AudioContext, at: number): void {
  if (!def || !master) return;
  const beat = 60 / def.bpm;          // 4分音符
  const eighth = beat / 2;
  const barLen = def.arp.length;      // 8分音符いくつで1ループ（=1小節相当）
  const chordIdx = Math.floor(step / barLen) % def.chords.length;
  const chordRoot = def.chords[chordIdx]!;
  // 小節頭でベースのドローン。
  if (step % barLen === 0) {
    note(c, master, semis(def.root / 2, chordRoot), barLen * eighth * 0.98, at, def.bass, 0.05);
  }
  // 8分ごとにアルペジオ（一部間引いて軽く）。
  const a = def.arp[step % barLen]!;
  if ((step % 2 === 0) || (step % barLen) % 3 === 0) {
    note(c, master, semis(def.root, chordRoot + a), eighth * 1.4, at, def.lead, def.leadGain);
  }
}

function tick(): void {
  if (!def) return;
  const c = audioCtx();
  if (!c || !master) return;
  const beat = 60 / def.bpm;
  const eighth = beat / 2;
  // 0.15秒先までスケジュール（ミュート中は無音＝鳴らさず時間だけ進める）。
  while (nextTime < c.currentTime + 0.15) {
    if (!isMuted()) scheduleStep(c, Math.max(nextTime, c.currentTime + 0.02));
    nextTime += eighth;
    step++;
  }
}

/** トラックを切り替えて再生開始（同じトラックなら継続）。シーンの create() で呼ぶ。 */
export function startBgm(track: BgmTrack): void {
  if (current === track && timer !== null) return;
  stopBgm();
  current = track;
  def = TRACKS[track];
  step = 0;
  const c = audioCtx();
  if (c) {
    master = c.createGain();
    master.gain.setValueAtTime(0.0001, c.currentTime);
    master.gain.exponentialRampToValueAtTime(0.9, c.currentTime + 1.2); // ふわっと入る
    master.connect(c.destination);
    nextTime = c.currentTime + 0.05;
  }
  timer = setInterval(tick, 40);
}

/** BGM停止（マスターをフェードアウトしてスケジューラを止める）。 */
export function stopBgm(): void {
  if (timer !== null) { clearInterval(timer); timer = null; }
  const c = audioCtx();
  if (c && master) {
    try {
      master.gain.cancelScheduledValues(c.currentTime);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), c.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
      const m = master;
      setTimeout(() => { try { m.disconnect(); } catch { /* noop */ } }, 400);
    } catch { /* noop */ }
  }
  master = null;
  current = null;
  def = null;
}
