// ターン制戦闘コア（ドラクエ風・決定論・UI非依存）。物理戦と盤戦を統一する。
// ヒーローは HP（耐久）と自由意志（スキルの燃料）を持つ。1ターン＝ヒーロー1行動→（敵が生存なら）敵の手番。
//   攻撃＝武器・物理（atk）／スキル＝魔石盤の回路（自由意志を消費・弱点で2倍）／道具＝回復／看破＝予測防御。
// HP0で敗北。数値は手書き調整可（ADR-0001 D3＝実opsは数えない）。不変条件は combat.test.ts で固定。
import type { Attr, Circuit } from '@core/board';

export type Outcome = 'none' | 'win' | 'lose';

/** 属性別の被ダメ係数（正=耐性で軽減・負=弱点で増加。防具が持つ）。例 { fire: 0.4, ice: -0.4 }。 */
export type Resist = Partial<Record<Attr, number>>;

export interface CombatHero {
  hp: number; hpMax: number;
  freeWill: number; freeWillMax: number;
  atk: number; def: number;
  resist: Resist;    // 防具由来の属性耐性/弱点（敵の属性攻撃に効く）
  guarding: boolean; // 看破中＝次の敵攻撃を読んで大幅軽減
}
// bigEvery>0 の敵は、bigEvery 回ふつうに攻撃するごとに「ためる」（その手番はダメージ0＝予兆）。
//   次の手番で 2倍の大攻撃を放つ。決定論なので、看破(guarding)で読んで受け流せる＝予測防御の手応え。
// atkAttr＝通常攻撃の属性／bigAttr＝大攻撃の属性（既定は atkAttr）／multi＝1手番の連撃数（群れ・速い敵）。
export interface CombatEnemy {
  name: string; hp: number; maxHp: number; atk: number; weakness: Attr;
  bigEvery: number; sinceBig: number; charging: boolean;
  atkAttr: Attr; bigAttr: Attr; multi: number;
}

export interface CombatState {
  hero: CombatHero;
  enemy: CombatEnemy;
  outcome: Outcome;
  turn: number;
}

// hp/freeWill を省くと満タンで開始（テスト・autoWinnable＝リトライの全回復モデル）。
// 指定すると現在値で開始＝戦闘間で消耗を持ち越す（フィールドの遭遇・連戦）。
export interface HeroSetup { hpMax: number; freeWillMax: number; atk: number; def: number; resist?: Resist; hp?: number; freeWill?: number }
export interface EnemySetup { name: string; hp: number; atk: number; weakness: Attr; bigEvery?: number; atkAttr?: Attr; bigAttr?: Attr; multi?: number }

/** 戦闘開始。HP/自由意志は既定で満タン（hp/freeWill 指定時はその現在値＝消耗を持ち越す）。 */
export function startCombat(hero: HeroSetup, enemy: EnemySetup): CombatState {
  const atkAttr = enemy.atkAttr ?? 'physical';
  const hp = Math.max(0, Math.min(hero.hpMax, hero.hp ?? hero.hpMax));
  const freeWill = Math.max(0, Math.min(hero.freeWillMax, hero.freeWill ?? hero.freeWillMax));
  return {
    hero: { hp, hpMax: hero.hpMax, freeWill, freeWillMax: hero.freeWillMax, atk: hero.atk, def: hero.def, resist: hero.resist ?? {}, guarding: false },
    enemy: {
      name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, atk: enemy.atk, weakness: enemy.weakness,
      bigEvery: enemy.bigEvery ?? 0, sinceBig: 0, charging: false,
      atkAttr, bigAttr: enemy.bigAttr ?? atkAttr, multi: Math.max(1, enemy.multi ?? 1),
    },
    outcome: 'none', turn: 0,
  };
}

/** 被ダメに防御・属性耐性・看破を適用した1撃ぶんのダメージ（最低0）。 */
export function strikeDamage(rawAtk: number, def: number, attr: Attr, resist: Resist, guarding: boolean): number {
  let dmg = Math.max(1, rawAtk - def);
  const mult = Math.min(1.75, Math.max(0.25, 1 - (resist[attr] ?? 0)));
  dmg = Math.round(dmg * mult);
  if (guarding && dmg > 0) dmg = Math.max(0, Math.floor(dmg * 0.25));
  return Math.max(0, dmg);
}

export interface ActionResult { state: CombatState; dealt: number; weak: boolean; cost: number; ok: boolean; note?: string; healed?: number }

/** 回路1本を撃つコスト（手書き＝経路の魔石数。最低1）。 */
export function circuitCost(c: Pick<Circuit, 'stones'>): number { return Math.max(1, c.stones.length); }

/**
 * スキルの基礎ダメージ（弱点倍率の前）。＝強さ合計 ＋ 長回路ボーナス（超線形）。
 * 回路＝計算：深い（長い）ほど効率がよくなる＝石1個を超えるごとに強さの+25%/石を上乗せ。
 *   1石: strength（攻撃に劣る）／3石: ×1.5／5石: ×2。コストは石数（線形）なので「長い回路を組む」が報われる。
 *   弱点ヒットでさらに2倍＝育った盤の長い弱点回路は「こうげき」を明確に上回る（softlockは攻撃のみで担保＝不変）。
 */
export function skillBaseDamage(c: Pick<Circuit, 'stones' | 'strength'>): number {
  const len = c.stones.length;
  const bonus = Math.floor(c.strength * Math.max(0, len - 1) * 0.25);
  return c.strength + bonus;
}

/**
 * 物理スキルのダメージ＝「こうげき(atk)」に回路の強さを“上乗せ”する（ponti 指示）。
 *   素の物理こうげき(atk)が基礎で、物理属性スキルはそれに skillBaseDamage ぶん追加するブースト。
 *   ＝単純なこうげきより弱い物理スキルにはせず、自由意志コストに見合う「攻撃＋α」にする。
 *   物理は属性弱点を突けない（×2なし）＝弱点を突く元素スキルの活躍余地も残す。
 */
export function physicalSkillDamage(atk: number, c: Pick<Circuit, 'stones' | 'strength'>): number {
  return Math.max(1, atk) + skillBaseDamage(c);
}

/** 攻撃（武器・物理）。ダメージ＝atk（最低1）。自由意志は使わない。 */
export function heroAttack(s: CombatState): ActionResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, weak: false, cost: 0, ok: false };
  const dealt = Math.max(1, s.hero.atk);
  const hp = Math.max(0, s.enemy.hp - dealt);
  const outcome: Outcome = hp <= 0 ? 'win' : 'none';
  return { state: { ...s, enemy: { ...s.enemy, hp }, outcome }, dealt, weak: false, cost: 0, ok: true };
}

/**
 * スキル（魔石盤の回路）。コスト＝石数を自由意志から。不足なら ok=false で不変。
 *   回復(heal)属性＝心域から状態を読み戻して**HP回復**（敵には当たらない・§8.9）。回復量＝skillBaseDamage（長回路ほど大きく戻せる）。
 *   物理属性＝こうげき(atk)に強さを上乗せ（physicalSkillDamage・弱点×2なし）。
 *   元素属性＝強さ＋長回路ボーナス、弱点なら2倍（育った長回路がこうげきを上回る）。
 */
export function heroSkill(s: CombatState, c: Pick<Circuit, 'stones' | 'strength' | 'element'>): ActionResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, weak: false, cost: 0, ok: false };
  const cost = circuitCost(c);
  if (s.hero.freeWill < cost) return { state: s, dealt: 0, weak: false, cost, ok: false, note: 'not-enough' };
  const freeWill = s.hero.freeWill - cost;
  // 回復属性の回路＝損傷前の状態を心域から読み戻す＝HP回復（敵HPは触らない）。
  if (c.element === 'heal') {
    const healed = skillBaseDamage(c);
    const hp = Math.min(s.hero.hpMax, s.hero.hp + healed);
    return { state: { ...s, hero: { ...s.hero, hp, freeWill } }, dealt: 0, weak: false, cost, ok: true, note: 'heal', healed };
  }
  const physical = c.element === 'physical';
  const weak = !physical && c.element === s.enemy.weakness;
  const dealt = physical ? physicalSkillDamage(s.hero.atk, c) : (weak ? skillBaseDamage(c) * 2 : skillBaseDamage(c));
  const hp = Math.max(0, s.enemy.hp - dealt);
  const outcome: Outcome = hp <= 0 ? 'win' : 'none';
  return { state: { ...s, hero: { ...s.hero, freeWill }, enemy: { ...s.enemy, hp }, outcome }, dealt, weak, cost, ok: true };
}

/** 看破＝予測防御。次の敵攻撃を読む（guarding）。読みに集中し、自由意志を少し取り戻す。 */
export function heroGuard(s: CombatState): ActionResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, weak: false, cost: 0, ok: false };
  const freeWill = Math.min(s.hero.freeWillMax, s.hero.freeWill + 3);
  return { state: { ...s, hero: { ...s.hero, freeWill, guarding: true } }, dealt: 0, weak: false, cost: 0, ok: true, note: 'guard' };
}

/** 道具：HP回復。 */
export function heroHealHp(s: CombatState, amount: number): ActionResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, weak: false, cost: 0, ok: false };
  const hp = Math.min(s.hero.hpMax, s.hero.hp + amount);
  return { state: { ...s, hero: { ...s.hero, hp } }, dealt: 0, weak: false, cost: 0, ok: true, note: 'heal-hp' };
}

/** 道具：自由意志回復。 */
export function heroHealFw(s: CombatState, amount: number): ActionResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, weak: false, cost: 0, ok: false };
  const freeWill = Math.min(s.hero.freeWillMax, s.hero.freeWill + amount);
  return { state: { ...s, hero: { ...s.hero, freeWill } }, dealt: 0, weak: false, cost: 0, ok: true, note: 'heal-fw' };
}

export interface EnemyResult { state: CombatState; dealt: number; guarded: boolean; big: boolean; telegraph: boolean; attr: Attr; hits: number }

/**
 * 敵の手番。通常は atk−def を multi 回（連撃）。bigEvery 回ごとに「ためる」(telegraph＝0・予兆)→次手番で2倍の大攻撃(big)。
 * 属性攻撃は防具の耐性/弱点(resist)で増減し、看破中(guarding)なら大幅軽減（大攻撃も読み切れる＝予測防御の payoff）。HP0で敗北。
 */
export function enemyTurn(s: CombatState): EnemyResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, guarded: false, big: false, telegraph: false, attr: s.enemy.atkAttr, hits: 0 };
  const guarded = s.hero.guarding;
  const e = s.enemy;
  let dmg: number;
  let big = false;
  let telegraph = false;
  let attr = e.atkAttr;
  let hits = 1;
  let charging = e.charging;
  let sinceBig = e.sinceBig;

  if (e.charging) {
    // 予兆の次手番＝大攻撃（1撃・bigAttr 属性）。
    big = true; charging = false; sinceBig = 0; attr = e.bigAttr;
    dmg = strikeDamage(e.atk * 2, s.hero.def, attr, s.hero.resist, guarded);
  } else if (e.bigEvery > 0 && sinceBig + 1 >= e.bigEvery) {
    // ためる手番＝ダメージ0で予兆。
    telegraph = true; charging = true; sinceBig = 0;
    dmg = 0; hits = 0;
  } else {
    sinceBig = sinceBig + 1;
    hits = e.multi;
    dmg = 0;
    for (let i = 0; i < e.multi; i++) dmg += strikeDamage(e.atk, s.hero.def, attr, s.hero.resist, guarded);
  }

  const hp = Math.max(0, s.hero.hp - dmg);
  const outcome: Outcome = hp <= 0 ? 'lose' : 'none';
  return {
    state: { ...s, hero: { ...s.hero, hp, guarding: false }, enemy: { ...e, charging, sinceBig }, outcome, turn: s.turn + 1 },
    dealt: dmg, guarded, big, telegraph, attr, hits,
  };
}

/**
 * 「ふつうに戦えば勝てるか」を決定論シミュレーション（バランス不変条件の担保用）。
 * 戦略＝予兆(charging)が見えたら看破(guard)、そうでなければ攻撃。retry は全回復・決定論なので
 * これが true なら無限ループにならない（＝到達レベルで詰まない）。
 */
export function autoWinnable(hero: HeroSetup, enemy: EnemySetup): boolean {
  let s = startCombat(hero, enemy);
  let guard = 0;
  while (s.outcome === 'none' && guard++ < 4000) {
    s = s.enemy.charging ? heroGuard(s).state : heroAttack(s).state;
    if (s.outcome === 'none') s = enemyTurn(s).state;
  }
  return s.outcome === 'win';
}
