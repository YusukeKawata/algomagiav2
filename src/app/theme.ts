// 表示の基本定数（土台の最小版）。
// ⚠ 解像度・ピクセル戦略（pixelArt 320×180 拡大 vs ネイティブ）は未確定の設計判断。
// v2 はテキスト主体なので、まずは text-friendly なネイティブ解像度で起動する。
// 戦闘演出を canvas で描く段階で改めて詰める。
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

export const COLORS = {
  bg: 0x05060d,
  text: '#e8ecf4',
  dim: '#7d8597',
  accent: '#6fb7ff',
} as const;
