// 第2幕の状態ロジック（魔石工房の集積＝強化/属性うつし・盤上限の引き上げ）のテスト。
// 文様(edges)は不変・value/属性のみ変わる、素材は消える、盤の上限が伸びると1段広がる、を固定。
import { describe, it, expect, beforeEach } from 'vitest';
import { game, addStone, fuseValue, fuseAttr, raiseBoardCap, placeStone, resetGame, freeStones, setLastTown, faintReturnToTown, maxHp, recordLore } from '@game/state';
import { makeStone } from '@game/data/stones';

beforeEach(() => resetGame());

describe('記録帳（ロア収集）', () => {
  it('同じ id は一度だけ記録される（重複読みでも増えない）。新規追加だけ true', () => {
    expect(recordLore('ex:a', '道標', ['東へ。'])).toBe(true);
    expect(recordLore('ex:a', '道標', ['東へ。'])).toBe(false); // 再読は記録しない
    expect(recordLore('place:world', '草原', ['広い。'])).toBe(true);
    expect(game.codex.map((e) => e.id)).toEqual(['ex:a', 'place:world']); // 発見順
  });
});

describe('敗北→直近の街へ（ponti 指示：死んだら街に戻す）', () => {
  it('ゴールド半分・HP/自由意志は全回復・記録した直近の街へ戻る（経験/魔石は保持）', () => {
    game.gold = 41;
    game.heroHp = 1; game.freeWill = 0;
    setLastTown('underville');
    addStone(makeStone({ shape: 0, attr: 'fire', value: 2 })); // 魔石は失わない
    const dest = faintReturnToTown();
    expect(game.gold).toBe(20);            // floor(41/2)
    expect(dest.lostGold).toBe(21);        // 41 - 20
    expect(game.heroHp).toBe(maxHp());     // 全回復
    expect(game.freeWill).toBe(game.freeWillMax);
    expect(dest.mapId).toBe('underville'); // 直近の街
    expect(game.stones.length).toBe(1);    // 魔石は保持
  });

  it('街を訪れていなければ既定＝霧の里へ戻る。街以外の setLastTown は無視', () => {
    setLastTown('world');                  // 街ではない＝無視
    expect(game.lastTownMapId).toBe('village');
    const dest = faintReturnToTown();
    expect(dest.mapId).toBe('village');
  });
});

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
