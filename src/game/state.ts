// ゲーム全体の状態（シングルトン）。シーン間で共有する。決定論ロジックは src/core。
// 二軸＝自由意志(燃料)／魔石盤(装備)。加えて従来RPGの層＝ゴールド・道具・武器/防具装備。
import { NAMES } from '@game/data/names';
import { statsForLevel, gainXp, type XpResult } from '@core/progress';
import { emptyBoard, circuits, place, type Board, type Stone, type Circuit, type Attr } from '@core/board';
import { WEAPONS, ARMORS } from '@game/data/equipment';
import { stoneSellValue } from '@game/data/stones';
import type { Resist } from '@core/combat';

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
  boardCap: number;       // 盤の各辺の上限（覚醒直後=1／心域解禁で4へ）
  board: Board;           // 装備中の魔石盤（駒配置を保持＝戦闘外で編集し戦闘で使う）
  skillUnlocked: boolean; // 据炉での覚醒で true（盤＝スキルが使える＝自由意志ゲート）
  // ゲージ解禁（world-bible 解禁順）：自由意志(覚醒)→心域(第二の里・横拡張)→霊脈→演算(並列の町・縦拡張)。
  // 解禁前のゲージ方向には盤が伸びない＝覚醒直後は 1×1、心域解禁で横へ、演算解禁で縦へ。
  mindUnlocked: boolean;    // 心域＝横拡張の解禁（第二の里の工房）
  computeUnlocked: boolean; // 演算＝縦拡張＝並列度の解禁（並列の町・第2幕後半）
  lastTownMapId: string;  // 直近に訪れた街（敗北時の帰還先＝'village'|'underville'）
  codex: CodexEntry[];    // 記録帳＝調べた事・訪れた土地の記憶（読み返せる＝“読むRPG”の収集要素）
  flags: Record<string, boolean>;
}

// 記録帳の1項目（調べた物・土地の記憶）。discovery 順に並ぶ。
export interface CodexEntry { id: string; title: string; lines: string[] }

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
    boardCap: 1,            // 覚醒直後は 1×1 のまま（心域解禁で 4 へ・演算は並列の町まで縦ロック）
    board: emptyBoard(1, 1),
    skillUnlocked: false,
    mindUnlocked: false,
    computeUnlocked: false,
    lastTownMapId: 'village',
    codex: [],
    flags: {},
  };
}

/** 記録帳に1項目を加える（同じ id は一度だけ）。新規追加なら true（「記録した」演出用）。 */
export function recordLore(id: string, title: string, lines: string[]): boolean {
  if (game.codex.some((e) => e.id === id)) return false;
  game.codex.push({ id, title, lines });
  return true;
}

// ——— 敗北時の街への帰還（ponti 指示：死んだら直近の街へ・ゴールド半分・全回復） ———

/** 街マップの帰還スポーン座標（床であること＝maps.test が exits で担保している床に合わせる）。 */
export const TOWN_SPAWN: Record<string, { sx: number; sy: number }> = {
  village: { sx: 18, sy: 17 },   // 村の中央（開始位置P付近）
  underville: { sx: 2, sy: 7 },  // 坑道からの入口（床）
};

/** 街フィールドに入ったら帰還先を記録（FieldScene が呼ぶ）。 */
export function setLastTown(mapId: string): void {
  if (mapId === 'village' || mapId === 'underville') game.lastTownMapId = mapId;
}

/**
 * 敗北＝気を失って直近の街で目覚める。ゴールド半分（DQ風ペナルティ）・HP/自由意志は全回復。
 * 経験値/魔石/装備は保持＝街に戻れば必ず立て直せる（詰み防止の不変条件は維持）。帰還先を返す。
 */
export function faintReturnToTown(): { mapId: string; sx: number; sy: number; lostGold: number } {
  const lostGold = game.gold - Math.floor(game.gold / 2);
  game.gold = Math.floor(game.gold / 2);
  restFull();
  const mapId = (game.lastTownMapId === 'underville' || game.lastTownMapId === 'village') ? game.lastTownMapId : 'village';
  const sp = TOWN_SPAWN[mapId] ?? TOWN_SPAWN['village']!;
  return { mapId, sx: sp.sx, sy: sp.sy, lostGold };
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
/** 装備中の防具の属性耐性/弱点（敵の属性攻撃の受けに効く）。 */
export function heroResist(): Resist { return ARMORS[game.armorId]?.resist ?? {}; }

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

/**
 * レベルアップで盤を1段広げる次寸法。純関数＝テスト可。
 * **解禁ゲート**（world-bible 解禁順）：横(心域)は mind 解禁後のみ・縦(演算)は compute 解禁後のみ伸びる。
 *   両方ロック（覚醒直後）＝1×1のまま。心域だけ解禁＝横へ（最大 cap×1＝並列度1）。演算も解禁＝心域優先で縦も。
 */
export function nextBoardDims(
  mind: number, compute: number, cap = 3,
  unlock: { mind: boolean; compute: boolean } = { mind: true, compute: true },
): { mind: number; compute: number } {
  const canW = unlock.mind && mind < cap;
  const canH = unlock.compute && compute < cap;
  if (canW && (mind <= compute || !canH)) return { mind: mind + 1, compute };
  if (canH) return { mind, compute: compute + 1 };
  return { mind, compute };
}

/** 現在の解禁状態（grantXp/解禁関数が nextBoardDims に渡す）。 */
function unlockFlags(): { mind: boolean; compute: boolean } {
  return { mind: game.mindUnlocked, compute: game.computeUnlocked };
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

/** 解禁済みゲージに沿って、現在レベルぶん盤を 1×1 から広げ直す（解禁時の“追いつき”）。 */
function catchUpBoard(): void {
  setBoardSize(1, 1);
  for (let l = 1; l < game.level; l++) {
    const d = nextBoardDims(game.mind, game.compute, game.boardCap, unlockFlags());
    setBoardSize(d.mind, d.compute);
  }
}

/**
 * 心域＝横拡張を解禁（第2幕・地中の里の工房）。上限を cap へ上げ、到達レベルぶん横へ追いつかせる
 * ＝解禁した瞬間に複数の横スロットを使える（「2つ目の町で心域がスロットに反映される」）。既に解禁済みなら false。
 */
export function unlockMind(cap = 4): boolean {
  if (game.mindUnlocked) return false;
  game.mindUnlocked = true;
  game.boardCap = Math.max(game.boardCap, cap);
  catchUpBoard();
  return true;
}

/** 演算＝縦拡張＝並列度を解禁（第2幕後半・並列の町）。横と同様に到達レベルぶん追いつかせる。既に解禁済みなら false。 */
export function unlockCompute(cap = 4): boolean {
  if (game.computeUnlocked) return false;
  game.computeUnlocked = true;
  game.boardCap = Math.max(game.boardCap, cap);
  catchUpBoard();
  return true;
}

// ——— 魔石工房（集積）。第2幕・地中の里で解禁。文様(edges)は不変、value/属性のみ変える ———

/** インベントリ＋盤から魔石を完全に取り除く（素材消費）。 */
function removeStone(id: string): void {
  game.board = clearStoneFromBoard(game.board, id);
  const i = game.stones.findIndex((s) => s.id === id);
  if (i >= 0) game.stones.splice(i, 1);
}

/** 集積（強化）：素材魔石を1つ捧げて対象の魔素量(value)を+1。素材は消える。成功で true。 */
export function fuseValue(targetId: string, materialId: string): boolean {
  if (targetId === materialId) return false;
  const t = game.stones.find((s) => s.id === targetId);
  if (!t || !game.stones.some((s) => s.id === materialId)) return false;
  t.value += 1;
  removeStone(materialId);
  return true;
}

/** 集積（属性付け替え）：素材魔石を1つ捧げて対象の属性を指定属性へ。素材は消える。成功で true。 */
export function fuseAttr(targetId: string, materialId: string, attr: Attr): boolean {
  if (targetId === materialId) return false;
  const t = game.stones.find((s) => s.id === targetId);
  if (!t || !game.stones.some((s) => s.id === materialId)) return false;
  t.attr = attr;
  removeStone(materialId);
  return true;
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
 * レベルアップで hpMax/freeWillMax は伸びる（増えた上限ぶんだけ現在値も底上げ）が、
 * 全回復はしない＝HP/自由意志は戦闘間で“消耗”として持ち越す（回復は宿/道具/いやし）。ponti 指示。
 */
export function grantXp(amount: number): XpResult {
  const r = gainXp({ level: game.level, xp: game.xp }, amount);
  game.level = r.progress.level;
  game.xp = r.progress.xp;
  const prevHpMax = game.heroHpMax;
  const prevFwMax = game.freeWillMax;
  const s = statsForLevel(game.level);
  game.heroHpMax = s.hpMax;
  game.freeWillMax = s.freeWillMax;
  if (r.leveledUp) {
    // 全快ではなく、上限の増加ぶんだけ現在値を加える（成長の手応えは出すが回復ではない）。
    game.heroHp = Math.min(maxHp(), game.heroHp + Math.max(0, game.heroHpMax - prevHpMax));
    game.freeWill = Math.min(game.freeWillMax, game.freeWill + Math.max(0, game.freeWillMax - prevFwMax));
    // 覚醒後は、強くなる（レベルアップ）たびに盤が1段広がる——ただし解禁済みゲージの方向だけ。
    //   覚醒直後（心域ロック）は伸びない＝1×1のまま。心域解禁後は横へ、演算解禁後は縦へ。
    if (game.skillUnlocked && (game.mindUnlocked || game.computeUnlocked)) {
      const d = nextBoardDims(game.mind, game.compute, game.boardCap, unlockFlags());
      setBoardSize(d.mind, d.compute);
    }
  }
  // 上限が下がることはないが、念のため現在値を上限内にクランプ（装備変更などとの整合）。
  game.heroHp = Math.min(game.heroHp, maxHp());
  game.freeWill = Math.min(game.freeWill, game.freeWillMax);
  return r;
}

/** 休息（宿/ベッド）：HPと自由意志を全回復。フィールドの宿屋・据炉覚醒後などで使う。 */
export function restFull(): void {
  game.heroHp = maxHp();
  game.freeWill = game.freeWillMax;
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
