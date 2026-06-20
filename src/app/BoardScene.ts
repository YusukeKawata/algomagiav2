// 魔石盤シーン（回路パズル＋最小戦闘）。決定論ロジックは src/core を呼ぶだけ。
// 動的に毎回再描画する即時モード（ADR-0006 ハイブリッドの「動的=即時描画」方針）。
// 撃つ操作＝成立した回路から1本を選んで発射（↑↓で選択・[F]で撃つ）。盤の編集で選択は最強回路に戻る。
import Phaser from 'phaser';
import { CANVAS_W, COLORS } from '@app/theme';
import { emptyBoard, place, circuits, type Board, type Attr, type Stone, type Circuit } from '@core/board';
import { castCircuit, enemyTurn, circuitCost, type BattleState } from '@core/battle';
import { currentBeat, advance } from '@game/flow';
import { BOARD_ENEMIES } from '@game/data/enemies';
import { SHAPES, AWAKENED_START, buildBoard } from '@game/data/boards';
import { game } from '@game/state';
import { fadeInOnCreate, addMuteToggle, popupNumber, flash, shake } from '@app/ui/fx';
import { playSfx } from '@app/ui/sfx';

const ATTR_INFO: Record<Attr, { color: number; label: string; key: string }> = {
  fire: { color: 0xff7043, label: '炎', key: 'q' },
  ice: { color: 0x4fc3f7, label: '氷', key: 'w' },
  thunder: { color: 0xffd54f, label: '雷', key: 'e' },
  wind: { color: 0x81c784, label: '風', key: 'r' },
};
const ATTR_KEYS: Attr[] = ['fire', 'ice', 'thunder', 'wind'];

const CELL = 116;
const COLS = 5;
const ROWS = 4;

function rgba(color: number): string {
  return Phaser.Display.Color.IntegerToColor(color).rgba;
}

export class BoardScene extends Phaser.Scene {
  private board!: Board;
  private battle!: BattleState;
  private flowMode = false;
  private log = '盤に回路を組み、↑↓で選んで [F] で撃つ';
  private shapeIdx = 0;
  private attr: Attr = 'fire';
  private counter = 0;
  private selIdx = 0;        // 選択中の回路
  private userPicked = false; // ↑↓で手動選択したか（盤編集でリセット＝最強に戻す）
  private prevCircuitCount = 0;
  private selCenters: { cx: number; cy: number }[] = []; // パルス用に選択回路の駒中心を保持
  private g!: Phaser.GameObjects.Graphics;
  private pulseG!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private originX = 0;
  private originY = 0;

  constructor() { super('Board'); }

  create(): void {
    fadeInOnCreate(this);
    const beat = currentBeat();
    this.flowMode = beat?.kind === 'battle' && beat.mode === 'board';
    this.board = this.flowMode ? buildBoard(AWAKENED_START) : emptyBoard(COLS, ROWS);
    this.battle = this.freshBattle();
    if (this.flowMode && beat?.kind === 'battle') this.log = beat.intro;
    this.originX = (CANVAS_W - COLS * CELL) / 2;
    this.originY = 112;
    this.selIdx = 0; this.userPicked = false;

    this.g = this.add.graphics();
    this.pulseG = this.add.graphics().setDepth(50);
    this.labels = this.add.container(0, 0);
    this.hud = this.add.text(this.originX, 18, '', {
      fontFamily: 'monospace', fontSize: '19px', color: COLORS.text, lineSpacing: 5,
    });

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e.key));

    this.prevCircuitCount = circuits(this.board).length;
    addMuteToggle(this);
    this.render();
  }

  private freshBattle(): BattleState {
    const beat = currentBeat();
    if (beat?.kind === 'battle' && beat.mode === 'board') {
      const e = BOARD_ENEMIES[beat.enemyId];
      if (e) return { freeWill: { max: game.freeWillMax, cur: game.freeWillMax }, enemy: { name: e.name, hp: e.hp, maxHp: e.hp, weakness: e.weakness }, outcome: 'none' };
    }
    return { freeWill: { max: 24, cur: 24 }, enemy: { name: '石像兵', hp: 30, maxHp: 30, weakness: 'fire' }, outcome: 'none' };
  }

  private mk(shapeIdx: number, attr: Attr): Stone {
    const s = SHAPES[shapeIdx]!;
    return { id: `s${this.counter++}`, edges: [...s.edges], value: s.value, attr };
  }

  private onKey(key: string): void {
    const n = parseInt(key, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= SHAPES.length) { this.shapeIdx = n - 1; this.render(); return; }
    const k = key.toLowerCase();
    if (this.flowMode && this.battle.outcome === 'win' && (k === 'z' || k === 'enter')) { advance(this); return; }
    if (this.flowMode && this.battle.outcome === 'lose' && (k === 'z' || k === 'enter')) { this.battle = this.freshBattle(); this.log = '無気力から立ち直った。もう一度——'; playSfx('confirm'); this.render(); return; }
    if (key === 'ArrowUp') { this.moveSel(-1); return; }
    if (key === 'ArrowDown') { this.moveSel(1); return; }
    const hit = ATTR_KEYS.find((a) => ATTR_INFO[a].key === k);
    if (hit) { this.attr = hit; this.render(); return; }
    if (k === 'f') { this.fire(); return; }
    if (k === 'n' && !this.flowMode) { this.battle = this.freshBattle(); this.log = '新しい敵が現れた'; playSfx('confirm'); this.render(); return; }
  }

  private moveSel(d: number): void {
    const len = circuits(this.board).length;
    if (len === 0) return;
    this.userPicked = true;
    this.selIdx = (this.selIdx + d + len) % len;
    playSfx('move');
    this.render();
  }

  /** 撃つ回路の既定＝撃てる中で最強（無ければ最強）。盤編集後はこれに戻す。 */
  private defaultSel(cs: Circuit[]): number {
    if (cs.length === 0) return 0;
    const affordable = cs.map((c, i) => ({ i, c })).filter((x) => circuitCost(x.c) <= this.battle.freeWill.cur);
    const pool = affordable.length > 0 ? affordable : cs.map((c, i) => ({ i, c }));
    return pool.reduce((a, b) => (b.c.strength > a.c.strength ? b : a)).i;
  }

  private fire(): void {
    if (this.battle.outcome !== 'none') { this.log = '戦闘終了。[N]で新しい敵'; this.render(); return; }
    const cs = circuits(this.board);
    if (cs.length === 0) { this.log = '回路が未接続（左端Lから右端Rまで一本に）'; playSfx('cancel'); this.render(); return; }
    const chosen = cs[Math.min(this.selIdx, cs.length - 1)]!;
    if (circuitCost(chosen) > this.battle.freeWill.cur) { this.log = `自由意志が足りない（必要${circuitCost(chosen)} / 残${this.battle.freeWill.cur}）`; playSfx('cancel'); this.render(); return; }

    const r = castCircuit(this.battle, chosen);
    this.battle = r.state;
    playSfx(r.weak ? 'weak' : 'fire');
    const bot = this.originY + ROWS * CELL;
    popupNumber(this, this.originX + COLS * CELL / 2, bot - 24, `${r.damage}`, { color: r.weak ? '#ffe06a' : '#ffd27a', big: r.weak });
    if (r.weak) flash(this, ATTR_INFO[chosen.element].color, 150);
    this.log = `${ATTR_INFO[chosen.element].label}スキル！ ${r.damage}ダメージ${r.weak ? '（弱点！）' : ''}（自由意志-${r.cost}）`;

    if (this.battle.outcome === 'none') {
      const e = enemyTurn(this.battle, 2);
      this.battle = e.state;
      shake(this, 0.006, 140);
      this.log += `／敵の干渉 自由意志-${e.drain}`;
    }
    if (this.battle.outcome === 'win') { playSfx('win'); this.log = `${this.battle.enemy.name}を倒した！ ${this.flowMode ? '[Z]で進む' : '[N]で次へ'}`; }
    if (this.battle.outcome === 'lose') { playSfx('lose'); this.log = `無気力に陥った…（自由意志0）${this.flowMode ? '[Z]でやり直す' : '[N]で再戦'}`; }
    this.render();
  }

  private onClick(p: Phaser.Input.Pointer): void {
    const x = Math.floor((p.x - this.originX) / CELL);
    const y = Math.floor((p.y - this.originY) / CELL);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    if (p.rightButtonDown()) {
      this.board = place(this.board, x, y, null);
      playSfx('cancel');
    } else {
      this.board = place(this.board, x, y, this.mk(this.shapeIdx, this.attr));
      playSfx('move');
    }
    this.userPicked = false; // 盤が変わったら選択は既定（最強）に戻す
    this.render();
  }

  private cellCenter(x: number, y: number): { cx: number; cy: number } {
    return { cx: this.originX + x * CELL + CELL / 2, cy: this.originY + y * CELL + CELL / 2 };
  }

  // 選択回路をパルスで強調（テキストを作り直さない軽量オーバーレイ）。
  update(_time: number): void {
    this.pulseG.clear();
    if (this.selCenters.length === 0) return;
    const a = 0.35 + 0.3 * Math.sin(this.time.now / 180);
    this.pulseG.fillStyle(0xffffff, a);
    for (const { cx, cy } of this.selCenters) this.pulseG.fillCircle(cx, cy, 12);
  }

  private render(): void {
    const g = this.g;
    g.clear();
    this.labels.removeAll(true);

    const cs = circuits(this.board);

    // 回路成立の瞬間フィードバック（本数が増えたら）。
    if (cs.length > this.prevCircuitCount) { playSfx('circuit'); flash(this, 0x9fd6ff, 110); }
    this.prevCircuitCount = cs.length;

    // 選択 index を確定（編集後は既定＝最強／手動選択は尊重）。常にクランプ。
    if (!this.userPicked) this.selIdx = this.defaultSel(cs);
    if (cs.length > 0) this.selIdx = Math.min(this.selIdx, cs.length - 1); else this.selIdx = 0;
    const selected = cs[this.selIdx];

    const litIds = new Set<string>();
    for (const c of cs) for (const s of c.stones) litIds.add(s.id);
    const selIds = new Set<string>(selected ? selected.stones.map((s) => s.id) : []);

    const top = this.originY;
    const bot = this.originY + ROWS * CELL;

    // 入口/出口レール。
    g.lineStyle(6, 0x57d977, 0.9).beginPath();
    g.moveTo(this.originX - 10, top); g.lineTo(this.originX - 10, bot); g.strokePath();
    g.lineStyle(6, 0xffb056, 0.9).beginPath();
    g.moveTo(this.originX + COLS * CELL + 10, top); g.lineTo(this.originX + COLS * CELL + 10, bot); g.strokePath();

    // セル枠。
    g.lineStyle(1, 0x2a3350, 1);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        g.strokeRect(this.originX + x * CELL, this.originY + y * CELL, CELL, CELL);

    // 駒と文様。
    this.selCenters = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const s = this.board.cells[y]![x];
        if (!s) continue;
        const { cx, cy } = this.cellCenter(x, y);
        const lit = litIds.has(s.id);
        const sel = selIds.has(s.id);
        const ac = ATTR_INFO[s.attr].color;
        const wire = lit ? ac : 0x55607a;
        if (sel) this.selCenters.push({ cx, cy });

        g.fillStyle(sel ? 0x1a2a44 : (lit ? 0x101a2c : 0x0e1422), 1).fillRoundedRect(
          this.originX + x * CELL + 9, this.originY + y * CELL + 9, CELL - 18, CELL - 18, 10,
        );
        if (sel) g.lineStyle(3, 0xffffff, 0.85).strokeRoundedRect(this.originX + x * CELL + 9, this.originY + y * CELL + 9, CELL - 18, CELL - 18, 10);
        g.lineStyle(7, wire, 1);
        const h = CELL / 2;
        for (const e of s.edges) {
          g.beginPath(); g.moveTo(cx, cy);
          if (e === 'L') g.lineTo(cx - h, cy);
          else if (e === 'R') g.lineTo(cx + h, cy);
          else if (e === 'U') g.lineTo(cx, cy - h);
          else g.lineTo(cx, cy + h);
          g.strokePath();
        }
        g.fillStyle(wire, 1).fillCircle(cx, cy, 8);

        this.labels.add(this.add.text(cx + 17, cy + 15, `${ATTR_INFO[s.attr].label}${s.value}`, {
          fontFamily: 'monospace', fontSize: '14px', color: lit ? rgba(ac) : COLORS.dim,
        }).setOrigin(0.5));
      }
    }

    // 各回路を出口側に一覧（選択にカーソル▶・撃てない回路は淡色）。
    cs.forEach((c, i) => {
      const info = ATTR_INFO[c.element];
      const cost = circuitCost(c);
      const affordable = cost <= this.battle.freeWill.cur;
      const cur = i === this.selIdx;
      const txt = `${cur ? '▶' : ' '}⚡${c.strength} ${info.label} 費${cost}${affordable ? '' : '×'}`;
      this.labels.add(this.add.text(this.originX + COLS * CELL + 22, top + 6 + i * 26, txt, {
        fontFamily: 'monospace', fontSize: '18px', color: affordable ? rgba(info.color) : '#6b7488',
      }));
    });

    this.drawBattle(g, bot);

    const shape = SHAPES[this.shapeIdx]!;
    const ai = ATTR_INFO[this.attr];
    const shapeStr = SHAPES.map((s, i) => (i === this.shapeIdx ? `[${i + 1}:${s.key}]` : `${i + 1}:${s.key}`)).join(' ');
    const attrStr = ATTR_KEYS.map((a) => (a === this.attr ? `[${ATTR_INFO[a].key}:${ATTR_INFO[a].label}]` : `${ATTR_INFO[a].key}:${ATTR_INFO[a].label}`)).join(' ');
    this.hud.setText([
      `魔石盤  撃てるスキル: ${cs.length}   選択中の駒: ${shape.key}/${ai.label}(値${shape.value})`,
      `形 ${shapeStr}    属性 ${attrStr}`,
      `数字=形 qwer=属性 左ｸﾘｯｸ=置く 右ｸﾘｯｸ=消す  ↑↓=撃つ回路を選ぶ [F]=撃つ`,
    ]);
  }

  private drawBattle(g: Phaser.GameObjects.Graphics, bot: number): void {
    const b = this.battle;
    const bx = this.originX;
    const barW = COLS * CELL;
    const ey = bot + 16;
    const fy = bot + 44;
    const innerX = bx + 96;
    const innerW = barW - 96;

    g.fillStyle(0x2a1620, 1).fillRect(innerX, ey, innerW, 16);
    g.fillStyle(0xff5a6e, 1).fillRect(innerX, ey, innerW * (b.enemy.hp / b.enemy.maxHp), 16);
    g.fillStyle(0x16243a, 1).fillRect(innerX, fy, innerW, 16);
    g.fillStyle(0x6fd3ff, 1).fillRect(innerX, fy, innerW * (b.freeWill.cur / b.freeWill.max), 16);

    const L = this.labels;
    L.add(this.add.text(bx, ey - 2, `敵 ${b.enemy.name}`, { fontFamily: 'monospace', fontSize: '15px', color: '#ffb3bd' }));
    L.add(this.add.text(innerX + innerW + 12, ey - 2, `${b.enemy.hp}/${b.enemy.maxHp}  弱点:${ATTR_INFO[b.enemy.weakness].label}`, { fontFamily: 'monospace', fontSize: '15px', color: '#ffb3bd' }));
    L.add(this.add.text(bx, fy - 2, '自由意志', { fontFamily: 'monospace', fontSize: '15px', color: '#bfe6ff' }));
    L.add(this.add.text(innerX + innerW + 12, fy - 2, `${b.freeWill.cur}/${b.freeWill.max}`, { fontFamily: 'monospace', fontSize: '15px', color: '#bfe6ff' }));
    L.add(this.add.text(bx, fy + 26, `${this.log}`, { fontFamily: 'monospace', fontSize: '15px', color: COLORS.text }));
  }
}
