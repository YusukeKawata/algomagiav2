// 手続き生成のドット絵スプライト（ドラクエ風）。外部素材ゼロ・決定論。
// 16×16 のピクセルグリッドを「役割コード」で組み、空セルのうち塗りに隣接するものを自動で輪郭線にする
//   ＝手描きの縁取りを書かずにくっきりしたドット絵になる。pixelArt:true で拡大してもクリア。
// 人物＝4方向×2歩行フレーム／魔物＝シルエット別の1〜2フレーム。色だけ差し替えてキャラを作り分ける。
import type Phaser from 'phaser';

// 役割コード（0=透明）。レンダリングでパレットの色に変換する。
const EMPTY = 0, OUT = 1, SKIN = 2, HAIR = 3, CLOTH = 4, DARK = 5, BOOT = 6, EYE = 7, ACCENT = 8;
const SZ = 16;

export type Dir = 'down' | 'up' | 'left' | 'right';

/** 役割→色（整数）。0(透明)は持たない。 */
export interface Palette { [role: number]: number }

function darken(c: number, f: number): number {
  const r = Math.floor(((c >> 16) & 0xff) * f), g = Math.floor(((c >> 8) & 0xff) * f), b = Math.floor((c & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}
function lighten(c: number, f: number): number {
  const mix = (v: number): number => Math.min(255, Math.floor(v + (255 - v) * f));
  return (mix((c >> 16) & 0xff) << 16) | (mix((c >> 8) & 0xff) << 8) | mix(c & 0xff);
}

/** 服の色1つから人物パレットを作る（肌/髪/靴などは既定値・上書き可）。 */
export function heroPalette(cloth: number, opts: { hair?: number; skin?: number; boot?: number; accent?: number } = {}): Palette {
  return {
    [OUT]: 0x16131f,
    [SKIN]: opts.skin ?? 0xf0c49a,
    [HAIR]: opts.hair ?? 0x5a3b27,
    [CLOTH]: cloth,
    [DARK]: darken(cloth, 0.55),
    [BOOT]: opts.boot ?? 0x3a2a1f,
    [EYE]: 0x20202c,
    [ACCENT]: opts.accent ?? lighten(cloth, 0.35),
  };
}

/** 魔物の色1つからパレットを作る（目は怪しく光る）。 */
export function monsterPalette(body: number, opts: { eye?: number; accent?: number } = {}): Palette {
  return {
    [OUT]: 0x0a0910,
    [SKIN]: lighten(body, 0.25),
    [HAIR]: darken(body, 0.7),
    [CLOTH]: body,
    [DARK]: darken(body, 0.5),
    [BOOT]: darken(body, 0.4),
    [EYE]: opts.eye ?? 0xfff0a0,
    [ACCENT]: opts.accent ?? lighten(body, 0.45),
  };
}

type Grid = number[][];
function blank(): Grid { return Array.from({ length: SZ }, () => new Array<number>(SZ).fill(EMPTY)); }
function set(g: Grid, x: number, y: number, r: number): void { if (x >= 0 && x < SZ && y >= 0 && y < SZ) g[y]![x] = r; }
function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, r: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, r);
}

/** 塗りに隣接する空セルを輪郭線(OUT)にする＝自動縁取り。 */
function autoOutline(g: Grid): void {
  const marks: [number, number][] = [];
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
    if (g[y]![x] !== EMPTY) continue;
    if ((g[y - 1]?.[x] ?? 0) || (g[y + 1]?.[x] ?? 0) || (g[y]![x - 1] ?? 0) || (g[y]![x + 1] ?? 0)) marks.push([x, y]);
  }
  for (const [x, y] of marks) g[y]![x] = OUT;
}

// ——— 人物（4方向×2フレーム） ———
function humanoid(dir: Dir, frame: number): Grid {
  const g = blank();
  // 頭・胴・腕（共通）。
  rect(g, 4, 2, 11, 8, SKIN);
  rect(g, 4, 9, 11, 12, CLOTH);
  rect(g, 4, 11, 11, 11, DARK);            // ベルト
  rect(g, 3, 9, 3, 11, CLOTH); rect(g, 12, 9, 12, 11, CLOTH); // 腕
  set(g, 3, 11, SKIN); set(g, 12, 11, SKIN); // 手

  // 髪・顔（向きで変える）。
  if (dir === 'up') {
    rect(g, 4, 1, 11, 7, HAIR);            // 後頭部＝髪で覆う（顔が見えない）
  } else {
    rect(g, 4, 1, 11, 3, HAIR);            // 前髪
    set(g, 4, 4, HAIR); set(g, 11, 4, HAIR);
    if (dir === 'down') { set(g, 6, 5, EYE); set(g, 9, 5, EYE); }
    else if (dir === 'left') { set(g, 6, 5, EYE); rect(g, 10, 2, 11, 6, HAIR); }
    else { set(g, 9, 5, EYE); rect(g, 4, 2, 5, 6, HAIR); }
  }

  // 脚（フレームで長さを互い違い＝歩行のバウンド）。
  const fa = frame === 0;
  rect(g, 5, 13, 6, fa ? 15 : 14, BOOT);
  rect(g, 9, 13, 10, fa ? 14 : 15, BOOT);

  autoOutline(g);
  return g;
}

// ——— 魔物（シルエット別） ———
export type MonsterShape = 'beast' | 'bug' | 'bird' | 'blob';

function monster(shape: MonsterShape, frame: number): Grid {
  const g = blank();
  const fa = frame === 0;
  if (shape === 'beast') {
    rect(g, 2, 7, 11, 11, CLOTH);          // 胴
    rect(g, 10, 4, 14, 9, CLOTH);          // 頭（右向き）
    set(g, 10, 3, HAIR); set(g, 13, 3, HAIR); // 耳
    set(g, 12, 6, EYE);
    set(g, 14, 8, ACCENT); set(g, 14, 9, ACCENT); // 鼻先/牙
    rect(g, 1, 8, 2, 9, CLOTH);            // 尾
    rect(g, 3, 12, 4, fa ? 14 : 13, DARK); // 脚
    rect(g, 6, 12, 7, fa ? 13 : 14, DARK);
    rect(g, 9, 12, 10, fa ? 14 : 13, DARK);
  } else if (shape === 'bug') {
    rect(g, 4, 5, 11, 12, CLOTH);          // 甲殻
    rect(g, 7, 5, 8, 12, DARK);            // 背の合わせ目
    set(g, 6, 7, EYE); set(g, 9, 7, EYE);
    rect(g, 5, 3, 5, 4, ACCENT); rect(g, 10, 3, 10, 4, ACCENT); // 触角
    rect(g, 2, 7, 3, 7, DARK); rect(g, 12, 7, 13, 7, DARK);     // 脚
    rect(g, 2, fa ? 9 : 10, 3, fa ? 9 : 10, DARK); rect(g, 12, fa ? 10 : 9, 13, fa ? 10 : 9, DARK);
  } else if (shape === 'bird') {
    rect(g, 6, 5, 9, 11, CLOTH);           // 胴
    set(g, 7, 7, EYE);
    rect(g, 9, 8, 10, 8, ACCENT);          // くちばし
    rect(g, 3, fa ? 6 : 8, 5, fa ? 8 : 10, ACCENT); // 翼（羽ばたき）
    rect(g, 10, fa ? 6 : 8, 12, fa ? 8 : 10, ACCENT);
    rect(g, 6, 12, 6, 13, DARK); rect(g, 9, 12, 9, 13, DARK);   // 脚
  } else { // blob（淀みの影・燐光虫の核）
    rect(g, 4, 6, 11, 12, CLOTH);
    rect(g, 5, fa ? 5 : 6, 10, 5, CLOTH);  // 上端の揺らぎ
    rect(g, 3, 9, 12, 12, CLOTH);
    set(g, 6, 9, EYE); set(g, 9, 9, EYE);
    rect(g, 5, 13, 6, fa ? 13 : 14, DARK); rect(g, 9, 13, 10, fa ? 14 : 13, DARK); // 滴る影
  }
  autoOutline(g);
  return g;
}

// ——— レンダリング（Graphics→テクスチャ。一度作れば TextureManager に常駐） ———
function renderToTexture(scene: Phaser.Scene, key: string, g: Grid, pal: Palette): void {
  if (scene.textures.exists(key)) return;
  const gr = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
    const role = g[y]![x] ?? EMPTY;
    if (role === EMPTY) continue;
    gr.fillStyle(pal[role] ?? 0xff00ff, 1);
    gr.fillRect(x, y, 1, 1);
  }
  gr.generateTexture(key, SZ, SZ);
  gr.destroy();
}

const DIRS: Dir[] = ['down', 'up', 'left', 'right'];

/** 人物テクスチャ一式（4方向×2フレーム）を生成。キー＝`<base>_<dir>_<frame>`。 */
export function ensureHumanoid(scene: Phaser.Scene, base: string, pal: Palette): void {
  for (const d of DIRS) for (let f = 0; f < 2; f++) renderToTexture(scene, humanoidKey(base, d, f), humanoid(d, f), pal);
}
export function humanoidKey(base: string, dir: Dir, frame: number): string { return `${base}_${dir}_${frame}`; }

/** 魔物テクスチャ（2フレーム）を生成。キー＝`<base>_<frame>`。 */
export function ensureMonster(scene: Phaser.Scene, base: string, shape: MonsterShape, pal: Palette): void {
  for (let f = 0; f < 2; f++) renderToTexture(scene, monsterKey(base, f), monster(shape, f), pal);
}
export function monsterKey(base: string, frame: number): string { return `${base}_${frame}`; }
