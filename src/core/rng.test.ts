import { describe, it, expect } from 'vitest';
import { makeRng, randInt, pick } from '@core/rng';

describe('rng: 決定論', () => {
  it('同じシードは同じ列を返す', () => {
    const a = makeRng(42), b = makeRng(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('違うシードは違う列（最初の値が一致しない）', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });

  it('[0,1) の範囲に収まる', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('rng: randInt / pick', () => {
  it('randInt は両端を含む範囲', () => {
    const r = makeRng(3);
    for (let i = 0; i < 1000; i++) { const v = randInt(r, 2, 5); expect(v).toBeGreaterThanOrEqual(2); expect(v).toBeLessThanOrEqual(5); }
  });

  it('pick は配列要素を返し、空なら undefined', () => {
    const r = makeRng(9);
    expect(['a', 'b', 'c']).toContain(pick(r, ['a', 'b', 'c']));
    expect(pick(r, [])).toBeUndefined();
  });
});
