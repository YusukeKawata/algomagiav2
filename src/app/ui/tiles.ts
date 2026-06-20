// Kenney Roguelike/RPG パック（CC0）のタイル参照。public/assets/tiles/roguelike.png を
// 16x16・spacing1 のスプライトシートとして読み込む（キー 'rl'）。frame = row*57 + col。
// 番地は art-src/ の原本をグリッド可視化して採取（.claude/tmp/grid.py）。
import Phaser from 'phaser';

export const RL = 'rl';
export const RL_COLS = 57;

/** (col,row) → フレーム番号。 */
export const f = (col: number, row: number): number => row * RL_COLS + col;

// 使用タイル（採取済み）。
export const TILE = {
  grass: f(5, 0),      // 草地（里の床）
  dirt: f(6, 0),       // 土（小道）
  stone: f(6, 3),      // 石畳（遺構の床）
  tree: f(13, 10),     // 木（里の囲い＝森）
  flowers: f(0, 7),    // 花（里の彩り）
  deadTree: f(14, 5),  // 枯れ木（遺構）
  sign: f(19, 0),      // 立て札（出口の目印）
  crate: f(16, 0),     // 木箱（里の小物）
  crystal: f(50, 9),   // 青い水晶＝守り石／魔石
  skull: f(49, 9),     // 髑髏（遺構）
  grave: f(51, 9),     // 墓石（遺構）
  statue: f(50, 10),   // 石像／祭壇（番獣の座）
} as const;

/** ロードを Preload でまとめて呼ぶ。 */
export function loadTiles(scene: Phaser.Scene): void {
  scene.load.spritesheet(RL, 'assets/tiles/roguelike.png', { frameWidth: 16, frameHeight: 16, spacing: 1 });
}

/**
 * 16px タイルを指定マスサイズで配置（中央原点）。size はマスの一辺(px)。
 * pixelArt(NEAREST) 前提で拡大してもくっきり。
 */
export function addTile(
  scene: Phaser.Scene, cx: number, cy: number, frame: number, size: number,
): Phaser.GameObjects.Image {
  const img = scene.add.image(cx, cy, RL, frame).setOrigin(0.5);
  img.setDisplaySize(size, size);
  return img;
}
