// 属性の表示色（UI共通）。ラベルは core の ATTR_LABEL を使う。
import Phaser from 'phaser';
import type { Attr } from '@core/board';

export const ATTR_COLOR: Record<Attr, number> = {
  fire: 0xff7043, ice: 0x4fc3f7, thunder: 0xffd54f, wind: 0x81c784, physical: 0xcfd8e0,
};

export function attrCss(a: Attr): string {
  return Phaser.Display.Color.IntegerToColor(ATTR_COLOR[a]).rgba;
}
