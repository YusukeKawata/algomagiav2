// 土台のスモークテスト。テスト基盤(Vitest)が動くことの最小確認。
// core を実装したら本物のテストに置き換わる（決定論ロジックはここで固める）。
import { describe, it, expect } from 'vitest';

describe('foundation smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
