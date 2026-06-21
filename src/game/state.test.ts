// 第2幕の状態ロジック（魔石工房の集積＝強化/属性うつし・盤上限の引き上げ）のテスト。
// 文様(edges)は不変・value/属性のみ変わる、素材は消える、盤の上限が伸びると1段広がる、を固定。
import { describe, it, expect, beforeEach } from 'vitest';
import { game, addStone, fuseValue, fuseAttr, raiseBoardCap, placeStone, resetGame, freeStones } from '@game/state';
import { makeStone } from '@game/data/stones';

beforeEach(() => resetGame());

describe('魔石工房：集積（強化＝魔素量+1）', () => {
  it('素材を1つ捧げて対象の value が+1、素材は消える、文様は不変', () => {
    const target = makeStone({ shape: 0, attr: 'physical', value: 2 }); // ─
    const mat = makeStone({ shape: 1, attr: 'fire', value: 1 });
    addStone(target); addStone(mat);
    const edgesBefore = [...target.edges];
    expect(fuseValue(target.id, mat.id)).toBe(true);
    expect(target.value).toBe(3);
    expect(target.edges).toEqual(edgesBefore);           // 文様は不変
    expect(game.stones.some((s) => s.id === mat.id)).toBe(false); // 素材は消費
  });

  it('対象と素材が同じ／存在しない場合は失敗（不変）', () => {
    const a = makeStone({ shape: 0, attr: 'physical', value: 1 });
    addStone(a);
    expect(fuseValue(a.id, a.id)).toBe(false);
    expect(fuseValue(a.id, 'nope')).toBe(false);
    expect(a.value).toBe(1);
  });
});

describe('魔石工房：集積（属性うつし）', () => {
  it('素材の属性を対象へ移す、素材は消える', () => {
    const target = makeStone({ shape: 0, attr: 'physical', value: 2 });
    const mat = makeStone({ shape: 0, attr: 'ice', value: 1 });
    addStone(target); addStone(mat);
    expect(fuseAttr(target.id, mat.id, mat.attr)).toBe(true);
    expect(target.attr).toBe('ice');
    expect(game.stones.some((s) => s.id === mat.id)).toBe(false);
  });

  it('盤に置いた素材を集積で消費すると盤からも外れる', () => {
    const target = makeStone({ shape: 0, attr: 'physical', value: 1 });
    const mat = makeStone({ shape: 0, attr: 'fire', value: 1 });
    addStone(target); addStone(mat);
    placeStone(0, 0, mat);                  // 素材を盤へ
    expect(fuseValue(target.id, mat.id)).toBe(true);
    expect(freeStones().some((s) => s.id === mat.id)).toBe(false);
    expect(game.board.cells[0]![0]).toBeNull(); // 盤からも消えている
  });
});

describe('盤の上限引き上げ（第2幕の工房）', () => {
  it('上限を4へ引き上げると即1段広がる。再度同じ上限なら何も起きない', () => {
    game.skillUnlocked = true;
    game.mind = 3; game.compute = 3;
    expect(raiseBoardCap(4)).toBe(true);
    expect(game.boardCap).toBe(4);
    expect(game.mind + game.compute).toBe(7); // 3×3 → 4×3（心域優先）
    expect(raiseBoardCap(4)).toBe(false);     // 同じ上限は無効
  });
});
