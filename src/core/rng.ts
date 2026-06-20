// シード付き乱数（決定論・UI非依存）。素の Math.random は禁止（CLAUDE.md）。
// mulberry32：軽量・再現可能。遭遇敵の抽選など「毎回同じ種なら同じ結果」が欲しい所で使う。

export interface Rng { (): number } // [0,1) を返す

/** 整数シードから乱数列を作る。 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** min..max（整数・両端含む）。 */
export function randInt(r: Rng, min: number, max: number): number {
  return min + Math.floor(r() * (max - min + 1));
}

/** 配列から1つ選ぶ（空なら undefined）。 */
export function pick<T>(r: Rng, arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(r() * arr.length)];
}
