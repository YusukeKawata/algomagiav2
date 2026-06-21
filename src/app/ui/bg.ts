// 手続き生成の雰囲気背景（純UI層・アセット不要）。シーンごとに空気感をコードで描く。
// 配置はシード付き乱数（決定論。素の Math.random は使わない＝CLAUDE.md 規約）。
// 動き（霧の流れ・瞬き・脈動）は tween＝時間ベースの装飾でゲームロジックには関与しない。
// 各シーンは create() 冒頭で paintScene(this, kind) を一度だけ呼ぶ（単色矩形の置き換え）。
import Phaser from 'phaser';
import { CANVAS_W as W, CANVAS_H as H } from '@app/theme';

export type SceneArt =
  | 'title'    // タイトル：霧の谷＋遠くの守り石の光＋星
  | 'village'  // 霧の里：温かい灯のある谷、霧が流れる
  | 'ruin'     // 歌の遺構：冷たい石柱とほこり
  | 'phys'     // 遺構最奥（物理戦）：暗い洞、赤い残り火
  | 'awaken'   // 据炉の覚醒：黒に沈み、冷たい裂け目が走る
  | 'board'    // 里の外れ（盤戦）：夜空と地平、淡い魔法陣
  | 'depart'   // 旅立ち：谷を出る夜明け
  | 'under'    // 地中の里：地下空洞、結晶の燐光と漂う塵
  | 'end';     // エンド：静かな締め

// --- シード付き乱数（mulberry32）。kind ごとに固定 seed で毎回同じ絵になる。 ---
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED: Record<SceneArt, number> = {
  title: 101, village: 202, ruin: 303, phys: 404, awaken: 505, board: 606, depart: 707, under: 757, end: 808,
};

interface Builder {
  scene: Phaser.Scene;
  c: Phaser.GameObjects.Container; // 全レイヤをまとめる（depth は呼び出し側で -100）
  r: () => number;
}

/** [0,1) 乱数を min..max に。 */
function rr(r: () => number, min: number, max: number): number { return min + (max - min) * r(); }

/** 縦グラデーション（上→下）の全画面ベース。 */
function gradient(b: Builder, top: number, bottom: number): void {
  const g = b.scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1, 1, 1, 1);
  g.fillRect(0, 0, W, H);
  b.c.add(g);
}

/** 上下を暗く落とすビネット（中央に視線を集める）。 */
function vignette(b: Builder, strength = 0.55): void {
  const g = b.scene.add.graphics();
  const dark = 0x000000;
  g.fillGradientStyle(dark, dark, dark, dark, strength, strength, 0, 0);
  g.fillRect(0, 0, W, H * 0.42);
  g.fillGradientStyle(dark, dark, dark, dark, 0, 0, strength, strength);
  g.fillRect(0, H * 0.58, W, H * 0.42);
  b.c.add(g);
}

/** 星（一部はゆっくり瞬く）。 */
function stars(b: Builder, count: number, color = 0xdfe8ff, maxY = H * 0.7): void {
  for (let i = 0; i < count; i++) {
    const x = rr(b.r, 0, W), y = rr(b.r, 0, maxY), rad = rr(b.r, 0.6, 1.8);
    const s = b.scene.add.circle(x, y, rad, color, rr(b.r, 0.3, 0.9));
    b.c.add(s);
    if (b.r() < 0.4) {
      b.scene.tweens.add({ targets: s, alpha: rr(b.r, 0.1, 0.3), duration: rr(b.r, 1400, 3200), yoyo: true, repeat: -1 });
    }
  }
}

/** 横に流れる霧の帯（ふわっとした楕円が左右に漂う）。 */
function fog(b: Builder, y: number, color: number, alpha: number, count = 4): void {
  for (let i = 0; i < count; i++) {
    const w = rr(b.r, 360, 720), h = rr(b.r, 80, 180);
    const startX = rr(b.r, -200, W);
    const e = b.scene.add.ellipse(startX, y + rr(b.r, -40, 40), w, h, color, alpha);
    b.c.add(e);
    const dur = rr(b.r, 14000, 26000);
    const dir = b.r() < 0.5 ? 1 : -1;
    b.scene.tweens.add({ targets: e, x: startX + dir * rr(b.r, 120, 260), duration: dur, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    b.scene.tweens.add({ targets: e, alpha: alpha * rr(b.r, 0.4, 0.8), duration: dur * 0.6, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

/** 連なる稜線シルエット（手前ほど暗い谷の重なり）。 */
function ridges(b: Builder, layers: { y: number; amp: number; color: number; alpha: number }[]): void {
  for (const L of layers) {
    const g = b.scene.add.graphics();
    g.fillStyle(L.color, L.alpha);
    const pts: number[] = [0, H];
    const steps = 10;
    let yPrev = L.y;
    for (let i = 0; i <= steps; i++) {
      const x = (W * i) / steps;
      yPrev = Phaser.Math.Clamp(yPrev + rr(b.r, -L.amp, L.amp), L.y - L.amp * 2, L.y + L.amp * 2);
      pts.push(x, yPrev);
    }
    pts.push(W, H);
    g.fillPoints(toPoints(pts), true);
    b.c.add(g);
  }
}

function toPoints(flat: number[]): Phaser.Math.Vector2[] {
  const out: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push(new Phaser.Math.Vector2(flat[i]!, flat[i + 1]!));
  return out;
}

/** ぼんやり光る円（守り石や残り火）。脈動つき。 */
function glow(b: Builder, x: number, y: number, radius: number, color: number, alpha = 0.5, pulse = true): void {
  const layers = 4;
  const made: Phaser.GameObjects.Arc[] = [];
  for (let i = layers; i >= 1; i--) {
    const a = (alpha * i) / layers / layers;
    const c = b.scene.add.circle(x, y, (radius * i) / layers, color, a);
    b.c.add(c); made.push(c);
  }
  if (pulse) {
    b.scene.tweens.add({ targets: made, scale: 1.12, alpha: '*=0.7', duration: rr(b.r, 1800, 2600), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

/** 縦の石柱シルエット（遺構）。 */
function pillars(b: Builder, count: number, color: number): void {
  const g = b.scene.add.graphics();
  g.fillStyle(color, 1);
  for (let i = 0; i < count; i++) {
    const x = rr(b.r, 40, W - 120);
    const w = rr(b.r, 50, 110);
    const top = rr(b.r, 60, 220);
    g.fillRect(x, top, w, H - top);
    // 上部の欠け
    g.fillStyle(color, 0.6);
    g.fillRect(x, top - 14, w, 14);
    g.fillStyle(color, 1);
  }
  b.c.add(g);
}

/** 漂うほこり/光の粒（ゆっくり上下）。 */
function motes(b: Builder, count: number, color: number): void {
  for (let i = 0; i < count; i++) {
    const x = rr(b.r, 0, W), y = rr(b.r, H * 0.2, H);
    const m = b.scene.add.circle(x, y, rr(b.r, 0.8, 2.2), color, rr(b.r, 0.2, 0.6));
    b.c.add(m);
    b.scene.tweens.add({ targets: m, y: y - rr(b.r, 30, 90), duration: rr(b.r, 4000, 9000), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

/** 冷たい裂け目（覚醒）。中心から走る稲妻状の線が明滅。 */
function cracks(b: Builder, cx: number, cy: number, count: number, color: number): void {
  for (let i = 0; i < count; i++) {
    const g = b.scene.add.graphics();
    g.lineStyle(rr(b.r, 1, 2.5), color, 0.85);
    let x = cx, y = cy;
    const ang0 = rr(b.r, 0, Math.PI * 2);
    g.beginPath(); g.moveTo(x, y);
    const segs = Math.floor(rr(b.r, 4, 8));
    let ang = ang0;
    for (let s = 0; s < segs; s++) {
      ang += rr(b.r, -0.6, 0.6);
      const len = rr(b.r, 50, 130);
      x += Math.cos(ang) * len; y += Math.sin(ang) * len;
      g.lineTo(x, y);
    }
    g.strokePath();
    b.c.add(g);
    b.scene.tweens.add({ targets: g, alpha: rr(b.r, 0.1, 0.4), duration: rr(b.r, 900, 2200), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

/** 淡い魔法陣（盤戦の足元）。回転する二重リング。 */
function magicCircle(b: Builder, cx: number, cy: number, radius: number, color: number): void {
  const ring = (rad: number, segs: number, lw: number, alpha: number): Phaser.GameObjects.Graphics => {
    const g = b.scene.add.graphics({ x: cx, y: cy });
    g.lineStyle(lw, color, alpha);
    g.strokeCircle(0, 0, rad);
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      g.lineBetween(Math.cos(a) * rad * 0.82, Math.sin(a) * rad * 0.82, Math.cos(a) * rad, Math.sin(a) * rad);
    }
    b.c.add(g);
    return g;
  };
  const outer = ring(radius, 12, 1.5, 0.28);
  const inner = ring(radius * 0.62, 6, 1, 0.22);
  b.scene.tweens.add({ targets: outer, rotation: Math.PI * 2, duration: 40000, repeat: -1 });
  b.scene.tweens.add({ targets: inner, rotation: -Math.PI * 2, duration: 28000, repeat: -1 });
}

/**
 * シーン別の雰囲気背景を描いて返す（depth=-100＝あらゆる前景の後ろ）。
 * create() の最初に呼び、従来の add.rectangle(全画面) を置き換える。
 */
export function paintScene(scene: Phaser.Scene, kind: SceneArt): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(-100);
  const b: Builder = { scene, c, r: rng(SEED[kind]) };

  switch (kind) {
    case 'title':
      gradient(b, 0x0a1124, 0x05060d);
      stars(b, 70);
      ridges(b, [
        { y: H * 0.66, amp: 26, color: 0x0c1430, alpha: 1 },
        { y: H * 0.78, amp: 34, color: 0x070c1d, alpha: 1 },
      ]);
      glow(b, W * 0.5, H * 0.62, 120, 0x6fb7ff, 0.45);
      fog(b, H * 0.74, 0x223152, 0.10, 4);
      vignette(b, 0.5);
      break;

    case 'village':
      gradient(b, 0x121a2c, 0x070a14);
      stars(b, 26, 0xcdd8f0, H * 0.4);
      ridges(b, [
        { y: H * 0.58, amp: 22, color: 0x16213a, alpha: 1 },
        { y: H * 0.7, amp: 30, color: 0x0e1626, alpha: 1 },
        { y: H * 0.82, amp: 26, color: 0x0a1019, alpha: 1 },
      ]);
      // 里の灯（温かい点）
      for (let i = 0; i < 7; i++) glow(b, rr(b.r, W * 0.2, W * 0.8), rr(b.r, H * 0.66, H * 0.8), rr(b.r, 16, 26), 0xffb567, 0.5);
      fog(b, H * 0.7, 0x2a3a58, 0.12, 5);
      fog(b, H * 0.86, 0x1c2740, 0.14, 4);
      vignette(b, 0.5);
      break;

    case 'ruin':
      gradient(b, 0x0c1418, 0x05080a);
      pillars(b, 6, 0x0a1014);
      motes(b, 40, 0x9fb9c4);
      fog(b, H * 0.8, 0x1a2a30, 0.12, 4);
      glow(b, W * 0.5, H * 0.3, 90, 0x3f6f74, 0.18, false);
      vignette(b, 0.62);
      break;

    case 'phys':
      gradient(b, 0x1a0c12, 0x07040a);
      pillars(b, 4, 0x140a10);
      motes(b, 24, 0xff8a6a);
      glow(b, W * 0.5, H * 0.32, 130, 0xff4d3a, 0.28);
      fog(b, H * 0.85, 0x2a121a, 0.16, 4);
      vignette(b, 0.66);
      break;

    case 'awaken':
      gradient(b, 0x02040c, 0x010109);
      cracks(b, W * 0.5, H * 0.42, 7, 0x8fe6ff);
      glow(b, W * 0.5, H * 0.42, 70, 0x4fd8ff, 0.3);
      motes(b, 30, 0x6fd3ff);
      vignette(b, 0.72);
      break;

    case 'board':
      gradient(b, 0x0a1430, 0x05060f);
      stars(b, 60, 0xdfe8ff);
      ridges(b, [{ y: H * 0.8, amp: 20, color: 0x0a1224, alpha: 1 }]);
      magicCircle(b, W * 0.5, H * 0.72, 220, 0x6fd3ff);
      glow(b, W * 0.5, H * 0.72, 60, 0x6fd3ff, 0.2);
      vignette(b, 0.5);
      break;

    case 'depart':
      gradient(b, 0x1a2440, 0xf0a35a); // 夜明けの空（上=群青→下=朝焼け）
      ridges(b, [
        { y: H * 0.7, amp: 24, color: 0x2a2030, alpha: 0.9 },
        { y: H * 0.82, amp: 30, color: 0x140e1a, alpha: 1 },
      ]);
      glow(b, W * 0.5, H * 0.74, 100, 0xffd9a0, 0.5);
      fog(b, H * 0.78, 0x6a5a6a, 0.1, 4);
      vignette(b, 0.4);
      break;

    case 'under':
      // 地下空洞：土と岩の暗がりに、埋もれた結晶（魔石）の燐光が灯る。星は無し（地中＝観測の死角）。
      gradient(b, 0x141019, 0x070509);
      ridges(b, [
        { y: H * 0.22, amp: 30, color: 0x0c0a12, alpha: 1 }, // 天井の岩肌（上から垂れる）
        { y: H * 0.8, amp: 26, color: 0x100b14, alpha: 1 },
      ]);
      for (let i = 0; i < 6; i++) glow(b, rr(b.r, W * 0.12, W * 0.88), rr(b.r, H * 0.3, H * 0.78), rr(b.r, 14, 26), 0x8a7bd8, 0.4);
      motes(b, 34, 0xb6a8e0);
      fog(b, H * 0.7, 0x241c33, 0.12, 4);
      vignette(b, 0.66);
      break;

    case 'end':
      gradient(b, 0x0a0e1a, 0x05060d);
      stars(b, 40, 0xcdd8f0);
      fog(b, H * 0.8, 0x1a2236, 0.1, 3);
      vignette(b, 0.5);
      break;
  }
  return c;
}
