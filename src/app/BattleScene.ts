// ターン制戦闘シーン（ドラクエ風コマンド）。物理戦・盤戦を統一。判定は core/combat（決定論）。
// コマンド: こうげき(武器)/スキル(魔石盤の回路・覚醒後)/どうぐ(回復)/みやぶる(看破=予測防御)。
// モード: flow=台本の戦闘(勝利で advance) / encounter=フィールドの遭遇(勝利でフィールド復帰)。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { currentBeat, advance, rewindToLastField } from '@game/flow';
import { game, grantXp, addStone, maxHp, heroAtk, heroDef, heroResist, mendPower, boardCircuits, consumeItem, itemCount, faintReturnToTown, fieldResume } from '@game/state';
import { ENEMIES, type Enemy } from '@game/data/enemies';
import { ITEMS } from '@game/data/items';
import { rollStone, stoneLabel } from '@game/data/stones';
import { makeRng } from '@core/rng';
import type { Circuit } from '@core/board';
import { ATTR_LABEL } from '@core/board';
import {
  startCombat, heroAttack, heroSkill, heroGuard, heroHealHp, heroHealFw, heroMend, enemyTurn, circuitCost, MEND_COST,
  type CombatState,
} from '@core/combat';
import { fadeInOnCreate, addMuteToggle, transitionTo, popupNumber, flash, shake } from '@app/ui/fx';
import { playSfx } from '@app/ui/sfx';
import { startBgm } from '@app/ui/music';
import { paintScene } from '@app/ui/bg';
import { ATTR_COLOR } from '@app/ui/attrs';
import { ensureMonster, monsterKey, monsterPalette, ensureHumanoid, humanoidKey, heroPalette, type MonsterShape } from '@app/ui/sprites';

const EX = CANVAS_W / 2, EY = 220;   // 敵トークン
// 敵ID→ドット絵シルエット（同系統は同じ形・色だけ変える）。
const MON_SHAPE: Record<string, MonsterShape> = {
  mob1: 'beast', mob2: 'beast', gnawer: 'beast', shade: 'blob', sentinel: 'beast', boss: 'beast',
  awakened: 'beast', frost: 'beast', spark: 'bug', gale: 'bird', burrower: 'bug', drifter: 'blob',
  grazer: 'beast', razorbeak: 'bird', emberhound: 'beast', dunecrawler: 'bug', mirage: 'blob',
  stalker: 'beast', hexbeetle: 'bug', ravager: 'beast',
};
const HERO_PAL = heroPalette(0x3a6ea5, { hair: 0x4a3220 });
type Phase = 'root' | 'skill' | 'item' | 'win' | 'lose';
interface Cmd { key: 'attack' | 'skill' | 'mend' | 'item' | 'guard'; label: string }
const ROOT_BASE: Cmd[] = [
  { key: 'attack', label: 'こうげき' },
  { key: 'skill', label: 'スキル' },
  { key: 'item', label: 'どうぐ' },
  { key: 'guard', label: 'みやぶる' },
];
// 回復魔法（いやし）は地中の里で解禁（flag healMagic）＝心域から状態を読み戻す。スキルの後ろに差し込む。
const MEND_CMD: Cmd = { key: 'mend', label: 'いやし' };

export class BattleScene extends Phaser.Scene {
  private mode: 'flow' | 'encounter' = 'flow';
  private enemyId = 'mob1';
  private enemyDef!: Enemy;   // 実際に戦う敵（遭遇モードは到達レベルでスケール）
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
  private winFlag?: string;   // 任意ボス等＝撃破時に立てる flag（再戦防止）
  private enemyImg!: Phaser.GameObjects.Image; // 魔物のドット絵
  private heroImg!: Phaser.GameObjects.Image;  // 主人公のドット絵（左下・右向き）
  private idleFrame = 0;

  constructor() { super('Battle'); }

  create(data?: { mode?: string; enemyId?: string; winFlag?: string; fixed?: boolean }): void {
    fadeInOnCreate(this);
    this.winFlag = data?.winFlag;
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
    // 敵は地方ごとに強さ固定（レベルスケールしない＝同名の敵が強くなるバグを撤廃・ponti指示）。
    this.enemyDef = ENEMIES[this.enemyId] ?? ENEMIES['mob1']!;
    this.color = this.enemyDef.color ?? 0xb0405a;
    this.cs = this.fresh();
    this.log = this.intro;
    this.phase = 'root';
    this.rootIdx = 0;
    this.rewarded = false;

    paintScene(this, game.skillUnlocked ? 'board' : 'phys');
    startBgm('battle');
    this.g = this.add.graphics();

    // 魔物＆主人公のドット絵（手続き生成）。魔物はシルエット別・色は敵色。
    const shape = MON_SHAPE[this.enemyId] ?? 'beast';
    ensureMonster(this, `mon_${this.enemyId}`, shape, monsterPalette(this.color));
    this.enemyImg = this.add.image(EX, EY, monsterKey(`mon_${this.enemyId}`, 0)).setDisplaySize(132, 132).setDepth(4);
    ensureHumanoid(this, 'hero', HERO_PAL);
    this.heroImg = this.add.image(150, EY + 40, humanoidKey('hero', 'right', 0)).setOrigin(0.5, 0.7).setDisplaySize(84, 84).setDepth(4);
    // ゆっくりした待機アニメ（2フレーム交互）＝生き物らしさ。
    this.time.addEvent({ delay: 360, loop: true, callback: () => {
      this.idleFrame ^= 1;
      this.enemyImg.setTexture(monsterKey(`mon_${this.enemyId}`, this.idleFrame));
      this.heroImg.setTexture(humanoidKey('hero', 'right', this.idleFrame));
    } });

    this.text = this.add.text(72, 92, '', { fontFamily: 'monospace', fontSize: '19px', color: COLORS.text, lineSpacing: 7, wordWrap: { width: CANVAS_W - 130 } });
    this.menu = this.add.text(72, CANVAS_H - 196, '', { fontFamily: 'monospace', fontSize: '21px', color: COLORS.text, lineSpacing: 8, wordWrap: { width: CANVAS_W - 130 } });

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => this.onKey(ev.key));
    addMuteToggle(this);
    this.render();
  }

  /** 戦闘開始状態。full=false は現在のHP/自由意志を持ち越す（消耗）。full=true は全回復（敗北リトライ＝詰み防止）。 */
  private fresh(full = false): CombatState {
    const e = this.enemyDef;
    return startCombat(
      {
        hpMax: maxHp(), freeWillMax: game.freeWillMax, atk: heroAtk(), def: heroDef(), resist: heroResist(),
        hp: full ? maxHp() : game.heroHp, freeWill: full ? game.freeWillMax : game.freeWill,
      },
      { name: e.name, hp: e.hp, atk: e.atk, weakness: e.weakness, bigEvery: e.bigEvery, atkAttr: e.atkAttr, bigAttr: e.bigAttr, multi: e.multi },
    );
  }

  /** 現在のルートコマンド（回復魔法 解禁後は「いやし」を差し込む）。 */
  private root(): Cmd[] {
    if (!game.flags['healMagic']) return ROOT_BASE;
    return [ROOT_BASE[0]!, ROOT_BASE[1]!, MEND_CMD, ROOT_BASE[2]!, ROOT_BASE[3]!];
  }

  private circuits(): Circuit[] { return boardCircuits(); }
  private ownedItems(): { id: string; name: string; count: number }[] {
    return Object.keys(ITEMS).filter((id) => itemCount(id) > 0).map((id) => ({ id, name: ITEMS[id]!.name, count: itemCount(id) }));
  }

  private onKey(key: string): void {
    const k = key.toLowerCase();
    if (this.phase === 'win') { if (k === 'z' || k === 'enter') this.finishWin(); return; }
    if (this.phase === 'lose') { if (k === 'z' || k === 'enter') this.faint(); return; }

    if (key === 'ArrowUp') { this.moveSel(-1); return; }
    if (key === 'ArrowDown') { this.moveSel(1); return; }
    if (k === 'x' || key === 'Escape' || key === 'Backspace') { if (this.phase !== 'root') { this.phase = 'root'; this.subIdx = 0; playSfx('cancel'); this.render(); } return; }
    if (k === 'z' || k === 'enter') { this.confirm(); return; }
  }

  private moveSel(d: number): void {
    if (this.phase === 'root') { const n = this.root().length; this.rootIdx = (this.rootIdx + d + n) % n; }
    else {
      const len = this.phase === 'skill' ? this.circuits().length : this.ownedItems().length;
      if (len > 0) this.subIdx = (this.subIdx + d + len) % len;
    }
    playSfx('move');
    this.render();
  }

  private confirm(): void {
    if (this.phase === 'root') {
      const cmd = this.root()[this.rootIdx]!;
      if (cmd.key === 'attack') { this.doAttack(); return; }
      if (cmd.key === 'guard') { this.doGuard(); return; }
      if (cmd.key === 'mend') { this.doMend(); return; }
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

  private doMend(): void {
    if (this.cs.hero.freeWill < MEND_COST) { this.log = `自由意志が足りない（必要${MEND_COST}）。`; playSfx('cancel'); this.render(); return; }
    if (this.cs.hero.hp >= this.cs.hero.hpMax) { this.log = 'HPは満タンだ。'; playSfx('cancel'); this.render(); return; }
    const amt = mendPower();
    const r = heroMend(this.cs, amt);
    if (!r.ok) { this.render(); return; }
    this.cs = r.state;
    playSfx('weak');
    flash(this, 0x9ef0a8, 120);
    popupNumber(this, CANVAS_W / 2, CANVAS_H - 240, `HP+${amt}`, { color: '#9ef0a8' });
    this.afterHero(`いやしの回路。心域から体を読み戻す。HP+${amt}（自由意志-${MEND_COST}）。`);
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

    const attrName = e.attr !== 'physical' ? `${ATTR_LABEL[e.attr]}属性の` : '';
    if (e.dealt > 0) {
      shake(this, e.big ? 0.013 : 0.006, e.big ? 200 : 140);
      flash(this, e.attr !== 'physical' ? ATTR_COLOR[e.attr] : 0xff5a6e, e.big ? 170 : 110);
      popupNumber(this, CANVAS_W / 2, CANVAS_H - 150, `${e.dealt}`, { color: e.big ? '#ff5a6e' : '#ff8a9a', big: e.big });
    }
    game.heroHp = this.cs.hero.hp;
    game.freeWill = this.cs.hero.freeWill;

    const hitsStr = e.hits > 1 ? `${e.hits}連撃 ` : '';
    let react: string;
    if (e.telegraph) { react = `${name}は力をためている…！ 次は${attrName ? attrName : ''}大攻撃だ——[みやぶる]で受け流せ。`; playSfx('confirm'); }
    else if (e.big) { react = e.guarded ? `${name}の${attrName}大攻撃を看破！ 受け流した（${e.dealt}）。` : `${name}の${attrName}大攻撃！ ${e.dealt}ダメージ。`; playSfx(e.guarded ? 'weak' : 'hurt'); }
    else { react = `${name}の${attrName}${hitsStr}攻撃 ${e.guarded ? `${e.dealt}（看破！）` : e.dealt}`; playSfx('hurt'); }

    if (this.cs.outcome === 'lose') {
      playSfx('lose');
      this.phase = 'lose';
      this.log = `${actionLog}…${name}に倒され、気を失った。［Z］——直近の街で目を覚ます（ゴールド半分）`;
    } else {
      this.log = `${actionLog}／${react}`;
    }
    this.render();
  }

  private onWin(actionLog: string): void {
    if (this.rewarded) return;
    this.rewarded = true;
    playSfx('win');
    const e = this.enemyDef;
    if (this.enemyId === 'boss') game.flags['boss-cleared'] = true; // 番獣撃破→里へ帰りガロへ報告（覚醒前フロー）
    if (this.winFlag) game.flags[this.winFlag] = true;              // 任意ボス等＝撃破フラグ（再戦防止）
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

  /** 敗北＝気を失い、直近の街で目覚める（ゴールド半分・全回復）。詰み防止＝街に戻れば必ず立て直せる。 */
  private faint(): void {
    playSfx('confirm');
    const dest = faintReturnToTown(); // ゴールド半分・HP/自由意志 全回復
    // フロー戦闘（番獣/盤戦）で倒れたら、直前の field beat（＝街）へフローを巻き戻す＝再挑戦できる。
    if (this.mode === 'flow') rewindToLastField();
    fieldResume.active = false; // 遭遇地点ではなく街から再開
    transitionTo(this, 'Field', { mapId: dest.mapId, sx: dest.sx, sy: dest.sy });
  }

  // ——— 描画 ———
  private render(): void {
    const g = this.g;
    g.clear();
    const c = this.cs;

    // 敵トークン＋HPバー。
    const ehp = c.enemy.hp / c.enemy.maxHp;
    if (c.enemy.charging) { // ためている予兆＝黄色い警告リング（魔物ドット絵を囲う）
      g.lineStyle(4, 0xffd54f, 0.9).strokeCircle(EX, EY, 80);
      g.lineStyle(2, 0xffd54f, 0.5).strokeCircle(EX, EY, 92);
    }
    // 魔物の足元の影＋HPバー（敵スプライト本体は this.enemyImg）。
    g.fillStyle(0x000000, 0.28).fillEllipse(EX, EY + 64, 96, 22);
    g.fillStyle(0x2a1620, 1).fillRect(EX - 180, EY + 78, 360, 16);
    g.fillStyle(0xff5a6e, 1).fillRect(EX - 180, EY + 78, 360 * ehp, 16);

    const atkAttrStr = c.enemy.atkAttr !== 'physical' ? ` 攻撃:${ATTR_LABEL[c.enemy.atkAttr]}` : '';
    const multiStr = c.enemy.multi > 1 ? ` ×${c.enemy.multi}連撃` : '';
    this.text.setText([
      `《戦闘》${this.intro}`,
      '',
      `敵  ${c.enemy.name}   HP ${c.enemy.hp}/${c.enemy.maxHp}   弱点:${ATTR_LABEL[c.enemy.weakness]}${atkAttrStr}${multiStr}${c.enemy.charging ? '   ⚠ ためている！' : ''}`,
      '',
      `${game.heroName} Lv.${game.level}   HP ${Math.max(0, c.hero.hp)}/${c.hero.hpMax}   自由意志 ${c.hero.freeWill}/${c.hero.freeWillMax}`,
      `攻撃 ${c.hero.atk}  防御 ${c.hero.def}${this.resistStr()}`,
    ]);

    this.menu.setText(this.menuLines());
  }

  /** 装備防具の属性耐性/弱点を短く表示（敵の属性攻撃に合わせて防具を選ぶ手がかり）。 */
  private resistStr(): string {
    const r = this.cs.hero.resist;
    const parts = (Object.keys(r) as (keyof typeof r)[])
      .filter((a) => (r[a] ?? 0) !== 0)
      .map((a) => `${ATTR_LABEL[a]}${(r[a] ?? 0) > 0 ? '耐' : '弱'}`);
    return parts.length ? `   守:${parts.join('/')}` : '';
  }

  private menuLines(): string[] {
    if (this.phase === 'win' || this.phase === 'lose') return ['', this.log];
    const out: string[] = [];
    if (this.phase === 'root') {
      const row = this.root().map((cmd, i) => {
        const dim = (cmd.key === 'skill' && (!game.skillUnlocked || this.circuits().length === 0))
          || (cmd.key === 'item' && this.ownedItems().length === 0)
          || (cmd.key === 'mend' && this.cs.hero.freeWill < MEND_COST);
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
