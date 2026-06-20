// ターン制戦闘シーン（ドラクエ風コマンド）。物理戦・盤戦を統一。判定は core/combat（決定論）。
// コマンド: こうげき(武器)/スキル(魔石盤の回路・覚醒後)/どうぐ(回復)/みやぶる(看破=予測防御)。
// モード: flow=台本の戦闘(勝利で advance) / encounter=フィールドの遭遇(勝利でフィールド復帰)。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { currentBeat, advance } from '@game/flow';
import { game, grantXp, addStone, maxHp, heroAtk, heroDef, boardCircuits, consumeItem, itemCount } from '@game/state';
import { ENEMIES } from '@game/data/enemies';
import { ITEMS } from '@game/data/items';
import { rollStone, stoneLabel } from '@game/data/stones';
import { makeRng } from '@core/rng';
import type { Circuit } from '@core/board';
import { ATTR_LABEL } from '@core/board';
import {
  startCombat, heroAttack, heroSkill, heroGuard, heroHealHp, heroHealFw, enemyTurn, circuitCost,
  type CombatState,
} from '@core/combat';
import { fadeInOnCreate, addMuteToggle, transitionTo, popupNumber, flash, shake } from '@app/ui/fx';
import { playSfx } from '@app/ui/sfx';
import { paintScene } from '@app/ui/bg';
import { ATTR_COLOR } from '@app/ui/attrs';

const EX = CANVAS_W / 2, EY = 220;   // 敵トークン
type Phase = 'root' | 'skill' | 'item' | 'win' | 'lose';
interface Cmd { key: 'attack' | 'skill' | 'item' | 'guard'; label: string }
const ROOT: Cmd[] = [
  { key: 'attack', label: 'こうげき' },
  { key: 'skill', label: 'スキル' },
  { key: 'item', label: 'どうぐ' },
  { key: 'guard', label: 'みやぶる' },
];

export class BattleScene extends Phaser.Scene {
  private mode: 'flow' | 'encounter' = 'flow';
  private enemyId = 'mob1';
  private color = 0xb0405a;
  private cs!: CombatState;
  private intro = '';
  private log = '';
  private phase: Phase = 'root';
  private rootIdx = 0;
  private subIdx = 0;
  private g!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private menu!: Phaser.GameObjects.Text;
  private rewarded = false;

  constructor() { super('Battle'); }

  create(data?: { mode?: string; enemyId?: string }): void {
    fadeInOnCreate(this);
    if (data?.mode === 'encounter') {
      this.mode = 'encounter';
      this.enemyId = data.enemyId ?? 'mob1';
      this.intro = `${ENEMIES[this.enemyId]?.name ?? '魔物'}が現れた！`;
    } else {
      this.mode = 'flow';
      const beat = currentBeat();
      this.enemyId = beat?.kind === 'battle' ? beat.enemyId : 'mob1';
      this.intro = beat?.kind === 'battle' ? beat.intro : '';
    }
    const e = ENEMIES[this.enemyId] ?? ENEMIES['mob1']!;
    this.color = e.color ?? 0xb0405a;
    this.cs = this.fresh();
    this.log = this.intro;
    this.phase = 'root';
    this.rootIdx = 0;
    this.rewarded = false;

    paintScene(this, game.skillUnlocked ? 'board' : 'phys');
    this.g = this.add.graphics();
    this.text = this.add.text(72, 92, '', { fontFamily: 'monospace', fontSize: '19px', color: COLORS.text, lineSpacing: 7 });
    this.menu = this.add.text(72, CANVAS_H - 196, '', { fontFamily: 'monospace', fontSize: '21px', color: COLORS.text, lineSpacing: 8 });

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => this.onKey(ev.key));
    addMuteToggle(this);
    this.render();
  }

  private fresh(): CombatState {
    const e = ENEMIES[this.enemyId] ?? ENEMIES['mob1']!;
    return startCombat(
      { hpMax: maxHp(), freeWillMax: game.freeWillMax, atk: heroAtk(), def: heroDef() },
      { name: e.name, hp: e.hp, atk: e.atk, weakness: e.weakness, bigEvery: e.bigEvery },
    );
  }

  private circuits(): Circuit[] { return boardCircuits(); }
  private ownedItems(): { id: string; name: string; count: number }[] {
    return Object.keys(ITEMS).filter((id) => itemCount(id) > 0).map((id) => ({ id, name: ITEMS[id]!.name, count: itemCount(id) }));
  }

  private onKey(key: string): void {
    const k = key.toLowerCase();
    if (this.phase === 'win') { if (k === 'z' || k === 'enter') this.finishWin(); return; }
    if (this.phase === 'lose') { if (k === 'z' || k === 'enter') this.retry(); return; }

    if (key === 'ArrowUp') { this.moveSel(-1); return; }
    if (key === 'ArrowDown') { this.moveSel(1); return; }
    if (k === 'x' || key === 'Escape' || key === 'Backspace') { if (this.phase !== 'root') { this.phase = 'root'; this.subIdx = 0; playSfx('cancel'); this.render(); } return; }
    if (k === 'z' || k === 'enter') { this.confirm(); return; }
  }

  private moveSel(d: number): void {
    if (this.phase === 'root') this.rootIdx = (this.rootIdx + d + ROOT.length) % ROOT.length;
    else {
      const len = this.phase === 'skill' ? this.circuits().length : this.ownedItems().length;
      if (len > 0) this.subIdx = (this.subIdx + d + len) % len;
    }
    playSfx('move');
    this.render();
  }

  private confirm(): void {
    if (this.phase === 'root') {
      const cmd = ROOT[this.rootIdx]!;
      if (cmd.key === 'attack') { this.doAttack(); return; }
      if (cmd.key === 'guard') { this.doGuard(); return; }
      if (cmd.key === 'skill') {
        if (!game.skillUnlocked) { this.log = 'まだスキルは使えない（覚醒前）。'; playSfx('cancel'); this.render(); return; }
        if (this.circuits().length === 0) { this.log = '撃てる回路がない。魔石盤に魔石を嵌めよう。'; playSfx('cancel'); this.render(); return; }
        this.phase = 'skill'; this.subIdx = 0; playSfx('confirm'); this.render(); return;
      }
      if (cmd.key === 'item') {
        if (this.ownedItems().length === 0) { this.log = '道具を持っていない。'; playSfx('cancel'); this.render(); return; }
        this.phase = 'item'; this.subIdx = 0; playSfx('confirm'); this.render(); return;
      }
      return;
    }
    if (this.phase === 'skill') { this.doSkill(); return; }
    if (this.phase === 'item') { this.doItem(); return; }
  }

  // ——— 行動 ———
  private doAttack(): void {
    const r = heroAttack(this.cs);
    this.cs = r.state;
    playSfx('hit');
    popupNumber(this, EX, EY - 30, `${r.dealt}`, { color: '#ffd27a' });
    this.afterHero(`こうげき！ ${r.dealt}ダメージ。`);
  }

  private doGuard(): void {
    const r = heroGuard(this.cs);
    this.cs = r.state;
    playSfx('confirm');
    this.afterHero('みやぶる。…敵の動きを読む（次の攻撃を大きく軽減）。');
  }

  private doSkill(): void {
    const cs = this.circuits();
    const c = cs[Math.min(this.subIdx, cs.length - 1)];
    if (!c) { this.phase = 'root'; this.render(); return; }
    if (circuitCost(c) > this.cs.hero.freeWill) { this.log = `自由意志が足りない（必要${circuitCost(c)}）。`; playSfx('cancel'); this.render(); return; }
    const r = heroSkill(this.cs, c);
    this.cs = r.state;
    playSfx(r.weak ? 'weak' : 'fire');
    popupNumber(this, EX, EY - 30, `${r.dealt}`, { color: r.weak ? '#ffe06a' : '#ffd27a', big: r.weak });
    if (r.weak) flash(this, ATTR_COLOR[c.element], 150);
    this.phase = 'root';
    this.afterHero(`${ATTR_LABEL[c.element]}スキル！ ${r.dealt}ダメージ${r.weak ? '（弱点！）' : ''}（自由意志-${r.cost}）。`);
  }

  private doItem(): void {
    const items = this.ownedItems();
    const it = items[Math.min(this.subIdx, items.length - 1)];
    if (!it) { this.phase = 'root'; this.render(); return; }
    const item = ITEMS[it.id]!;
    consumeItem(it.id);
    const r = item.kind === 'healHp' ? heroHealHp(this.cs, item.power) : heroHealFw(this.cs, item.power);
    this.cs = r.state;
    playSfx('confirm');
    const label = item.kind === 'healHp' ? 'HP' : '自由意志';
    popupNumber(this, CANVAS_W / 2, CANVAS_H - 240, `${label}+${item.power}`, { color: '#9ef0a8' });
    this.phase = 'root';
    this.afterHero(`${item.name}を使った。${label}が回復した。`);
  }

  /** ヒーロー行動の後処理＝勝利判定→敵の手番→敗北判定。 */
  private afterHero(actionLog: string): void {
    if (this.cs.outcome === 'win') { this.onWin(actionLog); return; }
    const e = enemyTurn(this.cs);
    this.cs = e.state;
    const name = this.cs.enemy.name;

    if (e.dealt > 0) {
      shake(this, e.big ? 0.013 : 0.006, e.big ? 200 : 140);
      flash(this, 0xff5a6e, e.big ? 170 : 110);
      popupNumber(this, CANVAS_W / 2, CANVAS_H - 150, `${e.dealt}`, { color: e.big ? '#ff5a6e' : '#ff8a9a', big: e.big });
    }
    game.heroHp = this.cs.hero.hp;
    game.freeWill = this.cs.hero.freeWill;

    let react: string;
    if (e.telegraph) { react = `${name}は力をためている…！ 次は大攻撃だ——[みやぶる]で受け流せ。`; playSfx('confirm'); }
    else if (e.big) { react = e.guarded ? `${name}の大攻撃を看破！ 受け流した（${e.dealt}）。` : `${name}の大攻撃！ ${e.dealt}ダメージ。`; playSfx(e.guarded ? 'weak' : 'hurt'); }
    else { react = `${name}の攻撃 ${e.guarded ? `${e.dealt}（看破！）` : e.dealt}`; playSfx('hurt'); }

    if (this.cs.outcome === 'lose') {
      playSfx('lose');
      this.phase = 'lose';
      this.log = `${actionLog}…${name}に倒された。[Z]でやり直す`;
    } else {
      this.log = `${actionLog}／${react}`;
    }
    this.render();
  }

  private onWin(actionLog: string): void {
    if (this.rewarded) return;
    this.rewarded = true;
    playSfx('win');
    const e = ENEMIES[this.enemyId]!;
    game.gold += e.gold;
    const stone = rollStone(makeRng(game.xp * 131 + e.hp + game.gold + this.cs.turn), e.pool);
    addStone(stone);
    game.heroHp = this.cs.hero.hp;
    game.freeWill = this.cs.hero.freeWill;
    const xr = grantXp(e.xp);
    this.phase = 'win';
    let line = `${actionLog} ${e.name}を倒した！ G+${e.gold}・魔石「${stoneLabel(stone)}」・経験+${e.xp}。`;
    if (xr.leveledUp) {
      popupNumber(this, CANVAS_W / 2, EY + 80, `LEVEL UP! Lv.${xr.to}`, { color: '#ffe27a', big: true });
      line += `★レベルアップ Lv.${xr.from}→${xr.to}！`;
    }
    line += this.mode === 'encounter' ? '［Z］で戻る' : '［Z］で進む';
    this.log = line;
    this.render();
  }

  private finishWin(): void {
    playSfx('confirm');
    if (this.mode === 'encounter') transitionTo(this, 'Field', { resume: true });
    else advance(this);
  }

  private retry(): void {
    this.cs = this.fresh();
    game.heroHp = this.cs.hero.hp;
    game.freeWill = this.cs.hero.freeWill;
    this.phase = 'root'; this.rootIdx = 0;
    playSfx('confirm');
    this.log = `${this.intro}（やり直し）`;
    this.render();
  }

  // ——— 描画 ———
  private render(): void {
    const g = this.g;
    g.clear();
    const c = this.cs;

    // 敵トークン＋HPバー。
    const ehp = c.enemy.hp / c.enemy.maxHp;
    if (c.enemy.charging) { // ためている予兆＝黄色い警告リング
      g.lineStyle(4, 0xffd54f, 0.9).strokeCircle(EX, EY, 62);
      g.lineStyle(2, 0xffd54f, 0.5).strokeCircle(EX, EY, 72);
    }
    g.fillStyle(this.color, 1).fillCircle(EX, EY, 48);
    g.lineStyle(3, 0xff5a6e, 0.9).strokeCircle(EX, EY, 48);
    g.fillStyle(0x2a1620, 1).fillRect(EX - 180, EY + 68, 360, 16);
    g.fillStyle(0xff5a6e, 1).fillRect(EX - 180, EY + 68, 360 * ehp, 16);

    this.text.setText([
      `《戦闘》${this.intro}`,
      '',
      `敵  ${c.enemy.name}   HP ${c.enemy.hp}/${c.enemy.maxHp}   弱点:${ATTR_LABEL[c.enemy.weakness]}${c.enemy.charging ? '   ⚠ ためている！' : ''}`,
      '',
      `${game.heroName} Lv.${game.level}   HP ${Math.max(0, c.hero.hp)}/${c.hero.hpMax}   自由意志 ${c.hero.freeWill}/${c.hero.freeWillMax}`,
      `攻撃 ${c.hero.atk}  防御 ${c.hero.def}`,
    ]);

    this.menu.setText(this.menuLines());
  }

  private menuLines(): string[] {
    if (this.phase === 'win' || this.phase === 'lose') return ['', this.log];
    const out: string[] = [];
    if (this.phase === 'root') {
      const row = ROOT.map((cmd, i) => {
        const dim = (cmd.key === 'skill' && (!game.skillUnlocked || this.circuits().length === 0))
          || (cmd.key === 'item' && this.ownedItems().length === 0);
        const mark = i === this.rootIdx ? '▶' : ' ';
        return `${mark}${cmd.label}${dim ? '×' : ''}`;
      }).join('   ');
      out.push(row);
      out.push('[↑↓]選択 [Z]決定');
    } else if (this.phase === 'skill') {
      out.push('スキル（魔石盤の回路）  [X]戻る');
      const cs = this.circuits();
      if (cs.length === 0) out.push('  撃てる回路がない');
      cs.forEach((cir, i) => {
        const cost = circuitCost(cir);
        const aff = cost <= this.cs.hero.freeWill;
        out.push(`${i === this.subIdx ? '▶' : ' '}${ATTR_LABEL[cir.element]} 強さ${cir.strength} 費${cost}${aff ? '' : '×'}`);
      });
    } else if (this.phase === 'item') {
      out.push('どうぐ  [X]戻る');
      const items = this.ownedItems();
      items.forEach((it, i) => out.push(`${i === this.subIdx ? '▶' : ' '}${it.name} ×${it.count}  （${ITEMS[it.id]!.desc}）`));
    }
    out.push('');
    out.push(this.log);
    return out;
  }
}
