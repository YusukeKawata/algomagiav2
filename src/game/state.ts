// ゲーム全体の状態（シングルトン）。シーン間で共有する。決定論ロジックは src/core。
// 二軸＝自由意志(燃料)／魔石盤(装備)。加えて従来RPGの層＝ゴールド・道具・武器/防具装備。
import { NAMES } from '@game/data/names';
import { statsForLevel, gainXp, type XpResult } from '@core/progress';
import { emptyBoard, circuits, place, type Board, type Stone, type Circuit } from '@core/board';
import { WEAPONS, ARMORS } from '@game/data/equipment';
import { stoneSellValue } from '@game/data/stones';

export interface GameState {
  heroName: string;
  level: number;          // 成長（敵撃破で上がる）
  xp: number;             // 累計XP（progress.levelForXp で導ける）
  heroHpMax: number;      // 基礎HP上限（= statsForLevel(level).hpMax。防具ボーナスは maxHp() で加算）
  heroHp: number;         // 現在HP（戦闘開始時に maxHp() へ全回復）
  freeWillMax: number;    // 基礎・自由意志上限（= statsForLevel(level).freeWillMax）
  freeWill: number;       // 現在・自由意志（スキルの燃料）
  gold: number;           // 通貨（魔石を売って得る／戦闘で得る）
  stones: Stone[];        // 魔石インベントリ（ドロップ品をやりくりして盤に嵌める）
  items: Record<string, number>; // 道具の所持数（ITEMS の id → 個数）
  ownedWeapons: string[]; // 所持している武器 id（既定で素手）
  ownedArmors: string[];  // 所持している防具 id（既定で布の服）
  weaponId: string;       // 装備中の武器（WEAPONS の id・既定 'fist'）
  armorId: string;        // 装備中の防具（ARMORS の id・既定 'cloth'）
  mind: number;           // 心域＝魔石盤の横マス数
  compute: number;        // 演算＝魔石盤の縦マス数
  board: Board;           // 装備中の魔石盤（駒配置を保持＝戦闘外で編集し戦闘で使う）
  skillUnlocked: boolean; // 据炉での覚醒で true（盤＝スキルが使える）
  flags: Record<string, boolean>;
}

export const game: GameState = makeFresh();

function makeFresh(): GameState {
  const s = statsForLevel(1);
  return {
    heroName: NAMES.heroDefault,
    level: 1,
    xp: 0,
    heroHpMax: s.hpMax,
    heroHp: s.hpMax,
    freeWillMax: s.freeWillMax,
    freeWill: s.freeWillMax,
    gold: 15,               // 行商人で やくそう が1個買える程度の所持金
    stones: [],
    items: {},
    ownedWeapons: ['fist'],
    ownedArmors: ['cloth'],
    weaponId: 'fist',
    armorId: 'cloth',
    mind: 1,                // 覚醒直後の盤は 1×1（magic-stone-workshop.md §9）
    compute: 1,
    board: emptyBoard(1, 1),
    skillUnlocked: false,
    flags: {},
  };
}

// ——— 派生ステータス（装備込み）。戦闘・ステータス画面が使う単一窓口 ———

/** 物理火力の基礎（レベル由来）。 */
export function physPower(): number { return statsForLevel(game.level).power; }
/** 攻撃力＝物理火力＋武器 atk（「攻撃」コマンドのダメージ基礎）。 */
export function heroAtk(): number { return physPower() + (WEAPONS[game.weaponId]?.atk ?? 0); }
/** 防御力＝防具 def（被ダメージ軽減）。 */
export function heroDef(): number { return ARMORS[game.armorId]?.def ?? 0; }
/** HP上限＝基礎＋防具ボーナス。 */
export function maxHp(): number { return game.heroHpMax + (ARMORS[game.armorId]?.hpBonus ?? 0); }

/** 装備中の魔石盤で成立している回路（＝撃てるスキル一覧）。 */
export function boardCircuits(): Circuit[] { return circuits(game.board); }

// ——— インベントリ操作 ———

export function addStone(s: Stone): void { game.stones.push(s); }

/** 盤から外している（未配置の）魔石を、配置済み id 集合から判定して返す。 */
export function placedStoneIds(): Set<string> {
  const ids = new Set<string>();
  for (const row of game.board.cells) for (const c of row) if (c) ids.add(c.id);
  return ids;
}

/** 未配置の魔石（インベントリで盤に置けるもの）。 */
export function freeStones(): Stone[] {
  const placed = placedStoneIds();
  return game.stones.filter((s) => !placed.has(s.id));
}

/** 魔石を売ってゴールドに。配置中の魔石は盤からも外す。成功なら得たゴールドを返す。 */
export function sellStone(id: string): number {
  const idx = game.stones.findIndex((s) => s.id === id);
  if (idx < 0) return 0;
  const s = game.stones[idx]!;
  // 盤に置いてあれば外す。
  game.board = clearStoneFromBoard(game.board, id);
  game.stones.splice(idx, 1);
  const v = stoneSellValue(s);
  game.gold += v;
  return v;
}

function clearStoneFromBoard(board: Board, id: string): Board {
  let b = board;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++)
      if (b.cells[y]![x]?.id === id) b = place(b, x, y, null);
  return b;
}

/** 盤の (x,y) に魔石を置く（同じ魔石は他セルから外してから置く＝重複配置を防ぐ）。 */
export function placeStone(x: number, y: number, stone: Stone): void {
  game.board = place(clearStoneFromBoard(game.board, stone.id), x, y, stone);
}

/** 盤の (x,y) を空にする。 */
export function clearCell(x: number, y: number): void {
  game.board = place(game.board, x, y, null);
}

// ——— 盤の成長（心域/演算）。配置済みの駒は範囲内なら保持 ———

/** 覚醒後のレベルアップで盤を1段広げる次寸法（心域=横を優先→演算=縦、第1幕は上限3×3）。純関数＝テスト可。 */
export function nextBoardDims(mind: number, compute: number): { mind: number; compute: number } {
  if (mind < 3 && mind <= compute) return { mind: mind + 1, compute };
  if (compute < 3) return { mind, compute: compute + 1 };
  if (mind < 3) return { mind: mind + 1, compute };
  return { mind, compute };
}

export function setBoardSize(mind: number, compute: number): void {
  game.mind = Math.max(1, mind);
  game.compute = Math.max(1, compute);
  let b = emptyBoard(game.mind, game.compute);
  for (let y = 0; y < game.board.height && y < game.compute; y++)
    for (let x = 0; x < game.board.width && x < game.mind; x++) {
      const s = game.board.cells[y]![x];
      if (s) b = place(b, x, y, s);
    }
  game.board = b;
}

// ——— 装備 ———
export function equipWeapon(id: string): void { if (game.ownedWeapons.includes(id)) game.weaponId = id; }
export function equipArmor(id: string): void { if (game.ownedArmors.includes(id)) game.armorId = id; }

// ——— 売買（ゴールド）。成功で true ———
export function buyItem(id: string, price: number): boolean {
  if (game.gold < price) return false;
  game.gold -= price; addItem(id); return true;
}
export function buyWeapon(id: string, price: number): boolean {
  if (game.gold < price || game.ownedWeapons.includes(id)) return false;
  game.gold -= price; game.ownedWeapons.push(id); return true;
}
export function buyArmor(id: string, price: number): boolean {
  if (game.gold < price || game.ownedArmors.includes(id)) return false;
  game.gold -= price; game.ownedArmors.push(id); return true;
}

// ——— アイテム ———
export function addItem(id: string, n = 1): void { game.items[id] = (game.items[id] ?? 0) + n; }
export function itemCount(id: string): number { return game.items[id] ?? 0; }
export function consumeItem(id: string): boolean {
  if ((game.items[id] ?? 0) <= 0) return false;
  game.items[id]!--;
  if (game.items[id] === 0) delete game.items[id];
  return true;
}

// ——— 成長 ———

/**
 * XP を加算してレベル・ステータスを更新（決定論は core/progress に委譲）。
 * レベルが上がったら hpMax/freeWillMax を伸ばし、HP/自由意志を満タンに戻す（成長の報酬）。
 */
export function grantXp(amount: number): XpResult {
  const r = gainXp({ level: game.level, xp: game.xp }, amount);
  game.level = r.progress.level;
  game.xp = r.progress.xp;
  const s = statsForLevel(game.level);
  game.heroHpMax = s.hpMax;
  game.freeWillMax = s.freeWillMax;
  if (r.leveledUp) {
    game.heroHp = maxHp();
    game.freeWill = game.freeWillMax;
    // 覚醒後は、強くなる（レベルアップ）たびに魔石盤も1段広がる＝戦って盤を育てる。
    if (game.skillUnlocked) { const d = nextBoardDims(game.mind, game.compute); setBoardSize(d.mind, d.compute); }
  }
  return r;
}

export function resetGame(): void {
  Object.assign(game, makeFresh());
  Object.assign(fieldResume, { active: false, mapId: '', x: 0, y: 0, step: 0, encounters: 0 });
}

// フィールド→戦闘→フィールド の往復で、歩いていた位置/進捗を保持する。
export interface FieldResume {
  active: boolean; mapId: string; x: number; y: number; step: number; encounters: number;
}
export const fieldResume: FieldResume = { active: false, mapId: '', x: 0, y: 0, step: 0, encounters: 0 };
