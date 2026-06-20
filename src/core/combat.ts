// ターン制戦闘コア（ドラクエ風・決定論・UI非依存）。物理戦と盤戦を統一する。
// ヒーローは HP（耐久）と自由意志（スキルの燃料）を持つ。1ターン＝ヒーロー1行動→（敵が生存なら）敵の手番。
//   攻撃＝武器・物理（atk）／スキル＝魔石盤の回路（自由意志を消費・弱点で2倍）／道具＝回復／看破＝予測防御。
// HP0で敗北。数値は手書き調整可（ADR-0001 D3＝実opsは数えない）。不変条件は combat.test.ts で固定。
import type { Attr, Circuit } from '@core/board';

export type Outcome = 'none' | 'win' | 'lose';

export interface CombatHero {
  hp: number; hpMax: number;
  freeWill: number; freeWillMax: number;
  atk: number; def: number;
  guarding: boolean; // 看破中＝次の敵攻撃を読んで大幅軽減
}
// bigEvery>0 の敵は、bigEvery 回ふつうに攻撃するごとに「ためる」（その手番はダメージ0＝予兆）。
//   次の手番で 2倍の大攻撃を放つ。決定論なので、看破(guarding)で読んで受け流せる＝予測防御の手応え。
export interface CombatEnemy {
  name: string; hp: number; maxHp: number; atk: number; weakness: Attr;
  bigEvery: number; sinceBig: number; charging: boolean;
}

export interface CombatState {
  hero: CombatHero;
  enemy: CombatEnemy;
  outcome: Outcome;
  turn: number;
}

export interface HeroSetup { hpMax: number; freeWillMax: number; atk: number; def: number }
export interface EnemySetup { name: string; hp: number; atk: number; weakness: Attr; bigEvery?: number }

/** 戦闘開始（HP/自由意志は満タン＝戦闘開始＝全回復ポリシー）。 */
export function startCombat(hero: HeroSetup, enemy: EnemySetup): CombatState {
  return {
    hero: { hp: hero.hpMax, hpMax: hero.hpMax, freeWill: hero.freeWillMax, freeWillMax: hero.freeWillMax, atk: hero.atk, def: hero.def, guarding: false },
    enemy: { name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, atk: enemy.atk, weakness: enemy.weakness, bigEvery: enemy.bigEvery ?? 0, sinceBig: 0, charging: false },
    outcome: 'none', turn: 0,
  };
}

export interface ActionResult { state: CombatState; dealt: number; weak: boolean; cost: number; ok: boolean; note?: string }

/** 回路1本を撃つコスト（手書き＝経路の魔石数。最低1）。 */
export function circuitCost(c: Pick<Circuit, 'stones'>): number { return Math.max(1, c.stones.length); }

/** 攻撃（武器・物理）。ダメージ＝atk（最低1）。自由意志は使わない。 */
export function heroAttack(s: CombatState): ActionResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, weak: false, cost: 0, ok: false };
  const dealt = Math.max(1, s.hero.atk);
  const hp = Math.max(0, s.enemy.hp - dealt);
  const outcome: Outcome = hp <= 0 ? 'win' : 'none';
  return { state: { ...s, enemy: { ...s.enemy, hp }, outcome }, dealt, weak: false, cost: 0, ok: true };
}

/** スキル（魔石盤の回路）。コスト＝石数を自由意志から。弱点なら2倍。不足なら ok=false で不変。 */
export function heroSkill(s: CombatState, c: Pick<Circuit, 'stones' | 'strength' | 'element'>): ActionResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, weak: false, cost: 0, ok: false };
  const cost = circuitCost(c);
  if (s.hero.freeWill < cost) return { state: s, dealt: 0, weak: false, cost, ok: false, note: 'not-enough' };
  const weak = c.element === s.enemy.weakness;
  const dealt = weak ? c.strength * 2 : c.strength;
  const hp = Math.max(0, s.enemy.hp - dealt);
  const freeWill = s.hero.freeWill - cost;
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

export interface EnemyResult { state: CombatState; dealt: number; guarded: boolean; big: boolean; telegraph: boolean }

/**
 * 敵の手番。通常は atk−def。bigEvery 回ごとに「ためる」(telegraph＝ダメージ0・予兆)→次手番で2倍の大攻撃(big)。
 * 看破中(guarding)なら受けるダメージを大幅軽減（大攻撃も読み切れる＝予測防御の payoff）。HP0で敗北。
 */
export function enemyTurn(s: CombatState): EnemyResult {
  if (s.outcome !== 'none') return { state: s, dealt: 0, guarded: false, big: false, telegraph: false };
  const guarded = s.hero.guarding;
  const e = s.enemy;
  let dmg: number;
  let big = false;
  let telegraph = false;
  let charging = e.charging;
  let sinceBig = e.sinceBig;

  if (e.charging) {
    // 予兆の次手番＝大攻撃。
    big = true; charging = false; sinceBig = 0;
    dmg = Math.max(1, e.atk * 2 - s.hero.def);
  } else if (e.bigEvery > 0 && sinceBig + 1 >= e.bigEvery) {
    // ためる手番＝ダメージ0で予兆。
    telegraph = true; charging = true; sinceBig = 0;
    dmg = 0;
  } else {
    sinceBig = sinceBig + 1;
    dmg = Math.max(1, e.atk - s.hero.def);
  }
  if (guarded && dmg > 0) dmg = Math.max(0, Math.floor(dmg * 0.25));

  const hp = Math.max(0, s.hero.hp - dmg);
  const outcome: Outcome = hp <= 0 ? 'lose' : 'none';
  return {
    state: { ...s, hero: { ...s.hero, hp, guarding: false }, enemy: { ...e, charging, sinceBig }, outcome, turn: s.turn + 1 },
    dealt: dmg, guarded, big, telegraph,
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
