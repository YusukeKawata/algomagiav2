// メニュー（フィールドから [C] で開くポーズ・オーバーレイ）。タブ＝ステータス/そうび/魔石盤/どうぐ。
// 戦闘とは独立＝「魔石をはめる画面に戦闘は不要」を満たす。決定論ロジックは src/core / state に委譲。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import {
  game, maxHp, heroAtk, heroDef, physPower, boardCircuits, freeStones,
  placeStone, clearCell, equipWeapon, equipArmor, consumeItem, itemCount,
} from '@game/state';
import { WEAPONS, ARMORS } from '@game/data/equipment';
import { ITEMS } from '@game/data/items';
import { stoneLabel } from '@game/data/stones';
import { circuitCost } from '@core/combat';
import { ATTR_LABEL, type Stone } from '@core/board';
import { ATTR_COLOR } from '@app/ui/attrs';
import { levelProgress } from '@core/progress';
import { playSfx } from '@app/ui/sfx';

const TABS = ['ステータス', 'そうび', '魔石盤', 'どうぐ', '記録'] as const;

export class MenuScene extends Phaser.Scene {
  private tab = 0;
  private idx = 0;          // 汎用カーソル（そうび/どうぐ/記録）
  private cx = 0; private cy = 0; // 盤カーソル
  private picking = false; private pickIdx = 0; // 盤：置く魔石を選ぶサブモード
  private reading = false;  // 記録帳：項目を開いて全文を読むサブモード
  private tutorial = false; // 魔石盤を初めて開いた時のチュートリアル・オーバーレイ（一度きり）
  private g!: Phaser.GameObjects.Graphics;
  private head!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private boardLabels!: Phaser.GameObjects.Container;
  private msg = '';

  constructor() { super('Menu'); }

  create(): void {
    this.tab = 0; this.idx = 0; this.cx = 0; this.cy = 0; this.picking = false; this.msg = ''; this.tutorial = false;
    // 不透明パネル＝背後のフィールド（＝モンスターが出る場所）が透けないようにする。
    // 「魔石盤を編集する画面」と「戦闘する場所」を視覚的にはっきり分ける。
    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x070a14, 1).setOrigin(0).setDepth(0);
    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x0d1830, 0.5).setOrigin(0).setDepth(0);
    this.g = this.add.graphics().setDepth(1);
    this.head = this.add.text(60, 36, '', { fontFamily: 'monospace', fontSize: '20px', color: COLORS.text, wordWrap: { width: CANVAS_W - 110 } }).setDepth(2);
    this.body = this.add.text(60, 96, '', { fontFamily: 'monospace', fontSize: '19px', color: COLORS.text, lineSpacing: 8, wordWrap: { width: CANVAS_W - 120 } }).setDepth(2);
    this.boardLabels = this.add.container(0, 0).setDepth(3);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e.key));
    this.render();
  }

  private close(): void { playSfx('cancel'); this.scene.stop(); this.scene.resume('Field'); }

  /** 長いリストを「カーソルが必ず見える窓」に切り出す（画面外へ流れて固まって見えるのを防ぐ）。 */
  private windowRange(len: number, idx: number, max: number): { from: number; to: number } {
    if (len <= max) return { from: 0, to: len };
    let from = idx - Math.floor(max / 2);
    from = Math.max(0, Math.min(from, len - max));
    return { from, to: from + max };
  }

  private onKey(key: string): void {
    const k = key.toLowerCase();
    // チュートリアル表示中は、どのキーでも閉じる（一度きり・[C/X/Z/Enter]）。
    if (this.tutorial) { this.tutorial = false; game.flags['boardTutorialSeen'] = true; playSfx('confirm'); this.render(); return; }
    if (this.picking) { this.pickKey(key, k); return; }
    if (k === 'c' || k === 'x' || key === 'Escape') { this.close(); return; }
    // タブ切替は [Q/E]（[←→] は魔石盤のカーソル＝スロットを自由に選ぶために空ける。以前は←→がタブを奪っていた）。
    if (k === 'q' || k === 'e') {
      this.tab = (this.tab + (k === 'e' ? 1 : TABS.length - 1)) % TABS.length;
      this.idx = 0; this.cx = 0; this.cy = 0; this.msg = ''; this.reading = false;
      this.maybeBoardTutorial();
      playSfx('move'); this.render(); return;
    }

    if (this.tab === 1) this.equipKey(key);
    else if (this.tab === 2) this.boardKey(key);   // ←→↑↓ すべて盤カーソルに使える
    else if (this.tab === 3) this.itemKey(key, k);
    else if (this.tab === 4) this.codexKey(key, k);
    else if (key === 'ArrowUp' || key === 'ArrowDown') { playSfx('move'); this.render(); }
  }

  // ——— そうび ———
  private equipEntries(): { kind: 'w' | 'a'; id: string }[] {
    return [
      ...game.ownedWeapons.map((id) => ({ kind: 'w' as const, id })),
      ...game.ownedArmors.map((id) => ({ kind: 'a' as const, id })),
    ];
  }
  private equipKey(key: string): void {
    const list = this.equipEntries();
    if (key === 'ArrowUp') { this.idx = (this.idx + list.length - 1) % list.length; playSfx('move'); this.render(); }
    else if (key === 'ArrowDown') { this.idx = (this.idx + 1) % list.length; playSfx('move'); this.render(); }
    else if (key === 'z' || key === 'Z' || key === 'Enter') {
      const e = list[this.idx]; if (!e) return;
      if (e.kind === 'w') equipWeapon(e.id); else equipArmor(e.id);
      playSfx('confirm'); this.msg = `${e.kind === 'w' ? WEAPONS[e.id]!.name : ARMORS[e.id]!.name} を装備した。`; this.render();
    }
  }

  // ——— 魔石盤 ———
  private boardKey(key: string): void {
    const b = game.board;
    if (key === 'ArrowLeft') this.cx = (this.cx + b.width - 1) % b.width;
    else if (key === 'ArrowRight') this.cx = (this.cx + 1) % b.width;
    else if (key === 'ArrowUp') this.cy = (this.cy + b.height - 1) % b.height;
    else if (key === 'ArrowDown') this.cy = (this.cy + 1) % b.height;
    else if (key === 'z' || key === 'Z' || key === 'Enter') {
      const cell = b.cells[this.cy]![this.cx];
      if (cell) { clearCell(this.cx, this.cy); playSfx('cancel'); this.msg = '魔石を外した。'; this.render(); return; }
      const free = freeStones();
      if (free.length === 0) { this.msg = '嵌められる魔石がない（手持ちが空）。'; playSfx('cancel'); this.render(); return; }
      this.picking = true; this.pickIdx = 0; playSfx('confirm'); this.render(); return;
    } else { return; }
    playSfx('move'); this.render();
  }
  private pickKey(key: string, k: string): void {
    const free = freeStones();
    if (k === 'x' || key === 'Escape') { this.picking = false; playSfx('cancel'); this.render(); return; }
    if (key === 'ArrowUp') { this.pickIdx = (this.pickIdx + free.length - 1) % free.length; playSfx('move'); this.render(); return; }
    if (key === 'ArrowDown') { this.pickIdx = (this.pickIdx + 1) % free.length; playSfx('move'); this.render(); return; }
    if (k === 'z' || key === 'Enter') {
      const s = free[this.pickIdx]; if (!s) { this.picking = false; this.render(); return; }
      placeStone(this.cx, this.cy, s);
      this.picking = false; playSfx('circuit'); this.msg = `魔石「${stoneLabel(s)}」を嵌めた。`; this.render();
    }
  }

  // ——— どうぐ ———
  private itemList(): string[] { return Object.keys(ITEMS).filter((id) => itemCount(id) > 0); }
  private itemKey(key: string, k: string): void {
    const list = this.itemList();
    if (key === 'ArrowUp') { this.idx = (this.idx + Math.max(1, list.length) - 1) % Math.max(1, list.length); playSfx('move'); this.render(); }
    else if (key === 'ArrowDown') { this.idx = (this.idx + 1) % Math.max(1, list.length); playSfx('move'); this.render(); }
    else if (k === 'z' || key === 'Enter') {
      const id = list[this.idx]; if (!id) return;
      const item = ITEMS[id]!;
      if (item.kind === 'healHp') {
        if (game.heroHp >= maxHp()) { this.msg = 'HPは満タンだ。'; playSfx('cancel'); this.render(); return; }
        consumeItem(id); game.heroHp = Math.min(maxHp(), game.heroHp + item.power);
      } else {
        if (game.freeWill >= game.freeWillMax) { this.msg = '自由意志は満タンだ。'; playSfx('cancel'); this.render(); return; }
        consumeItem(id); game.freeWill = Math.min(game.freeWillMax, game.freeWill + item.power);
      }
      playSfx('confirm'); this.msg = `${item.name}を使った。`;
      if (this.idx >= this.itemList().length) this.idx = Math.max(0, this.itemList().length - 1);
      this.render();
    }
  }

  // ——— 記録帳（調べた事・訪れた土地を読み返す） ———
  private codexKey(key: string, k: string): void {
    const list = game.codex;
    if (this.reading) { // 全文を読んでいる＝戻るだけ
      if (k === 'z' || k === 'x' || key === 'Enter' || key === 'Escape' || key === 'Backspace') { this.reading = false; playSfx('cancel'); this.render(); }
      return;
    }
    if (list.length === 0) return;
    if (key === 'ArrowUp') { this.idx = (this.idx + list.length - 1) % list.length; playSfx('move'); this.render(); }
    else if (key === 'ArrowDown') { this.idx = (this.idx + 1) % list.length; playSfx('move'); this.render(); }
    else if (k === 'z' || key === 'Enter') { this.reading = true; playSfx('confirm'); this.render(); }
  }

  private renderCodex(): void {
    const list = game.codex;
    if (list.length === 0) { this.body.setText(['記録帳', '', '  まだ何も記録されていない。', '  フィールドで [Z] 調べる／新しい土地に着くと、ここに残っていく。']); return; }
    if (this.reading) {
      const e = list[Math.min(this.idx, list.length - 1)]!;
      this.body.setText([`【記録帳】${e.title}`, '', ...e.lines, '', '[Z/X] 一覧へ戻る']);
      return;
    }
    const lines = [`記録帳  [↑↓]選んで [Z]読む （調べた事・訪れた土地 ${list.length}件）`, ''];
    const { from, to } = this.windowRange(list.length, this.idx, 18);
    if (from > 0) lines.push('  ▲ （上に続く）');
    list.slice(from, to).forEach((e, j) => lines.push(`${from + j === this.idx ? '▶' : ' '}${e.title}`));
    if (to < list.length) lines.push('  ▼ （下に続く）');
    this.body.setText(lines);
  }

  /** 魔石盤を初めて開いた時だけチュートリアルを出す（ストーリーから分離＝文脈で学ぶ）。 */
  private maybeBoardTutorial(): void {
    if (this.tab === 2 && !game.flags['boardTutorialSeen']) this.tutorial = true;
  }

  /** チュートリアル本文（旧・覚醒直後の台本から移設＝盤の操作を、初めて盤を開いた“その場”で読む）。 */
  private tutorialLines(): string[] {
    return [
      '——「魔石盤」。ここは、スキルを組む“編集”の画面だ（戦闘ではない）。',
      '',
      '・[←→↑↓] でマスを選び、[Z] で魔石を嵌める／外す。',
      '・左端から右端へ、文様(かたち)が一本につながった経路＝撃てる「スキル」が1本になる。',
      '・スキルの強さ＝その経路の魔石の「魔素量」の合計。長い回路ほど強い。',
      '・属性は経路の組成で決まる（弱点を突くと2倍）。回復属性をつなげば「回復スキル」になる。',
      '・文様(かたち)は変えられない。ドロップした魔石をやりくりして組むのが、盤の戦い方だ。',
      '',
      `・いまの盤は ${game.mind}×${game.compute}（心域×演算）。覚醒したばかりは横一列——スキルは1本ずつ。`,
      '・強くなり、やがて「心域」が開けば盤は横に広がる。さらに先で「演算」が開けば、複数のスキルを同時に持てる。',
      '',
      '　［なにかキーを押して、盤を編集する］',
    ];
  }

  // ——— 描画 ———
  private render(): void {
    this.g.clear();
    this.boardLabels.removeAll(true);
    if (this.tutorial) {
      this.head.setText('魔石盤 — はじめての手ほどき');
      this.body.setText(this.tutorialLines());
      return;
    }
    this.head.setText(TABS.map((t, i) => (i === this.tab ? `【${t}】` : ` ${t} `)).join('  ') + '    [Q/E]タブ切替 [←→↑↓]カーソル [C/X]閉じる');
    if (this.tab === 0) this.renderStatus();
    else if (this.tab === 1) this.renderEquip();
    else if (this.tab === 2) this.renderBoard();
    else if (this.tab === 3) this.renderItems();
    else this.renderCodex();
  }

  private renderStatus(): void {
    const lp = levelProgress({ level: game.level, xp: game.xp });
    const w = WEAPONS[game.weaponId]!, a = ARMORS[game.armorId]!;
    this.body.setText([
      `${game.heroName}    Lv.${game.level}   次のLvまで ${Math.max(0, lp.need - lp.inLevel)}`,
      '',
      `HP        ${game.heroHp} / ${maxHp()}`,
      `自由意志  ${game.freeWill} / ${game.freeWillMax}`,
      '',
      `こうげき  ${heroAtk()}   （素手火力 ${physPower()} ＋ 武器 ${w.atk}）`,
      `ぼうぎょ  ${heroDef()}   （防具 ${a.def}）`,
      '',
      `武器  ${w.name}    防具  ${a.name}`,
      `ゴールド  ${game.gold} G    魔石  ${game.stones.length} 個`,
      '',
      `撃てるスキル（魔石盤の回路）: ${boardCircuits().length} 本`,
      game.skillUnlocked ? '' : '※ まだ覚醒前。スキルは使えない。',
    ]);
  }

  private renderEquip(): void {
    const list = this.equipEntries();
    const lines = ['武器・防具を選んで [Z] で装備。', ''];
    const { from, to } = this.windowRange(list.length, this.idx, 16);
    if (from > 0) lines.push('  ▲ （上に続く）');
    list.slice(from, to).forEach((e, j) => {
      const i = from + j;
      const sel = i === this.idx ? '▶' : ' ';
      if (e.kind === 'w') {
        const w = WEAPONS[e.id]!;
        lines.push(`${sel}[武器] ${w.name.padEnd(8, '　')} 攻+${w.atk}${game.weaponId === e.id ? ' (装備中)' : ''}`);
      } else {
        const a = ARMORS[e.id]!;
        lines.push(`${sel}[防具] ${a.name.padEnd(8, '　')} 防+${a.def} HP+${a.hpBonus}${game.armorId === e.id ? ' (装備中)' : ''}`);
      }
    });
    if (to < list.length) lines.push('  ▼ （下に続く）');
    lines.push('', this.msg);
    this.body.setText(lines);
  }

  private renderBoard(): void {
    const b = game.board;
    const T = 64;
    const sideW = 300;                          // 右の一覧ぶん
    const boardW = b.width * T;
    const ox = Math.max(70, Math.floor((CANVAS_W - (boardW + sideW)) / 2));
    const oy = 252; // ヘッダー文と重ならない位置
    const g = this.g;
    // 盤を囲う枠（編集領域をはっきり見せる）。
    g.fillStyle(0x0a1426, 1).fillRoundedRect(ox - 34, oy - 28, boardW + 68, b.height * T + 56, 12);
    g.lineStyle(2, 0x2a3a5c, 1).strokeRoundedRect(ox - 34, oy - 28, boardW + 68, b.height * T + 56, 12);
    // レール（入口=緑/出口=橙）。
    g.lineStyle(5, 0x57d977, 0.9).beginPath(); g.moveTo(ox - 8, oy); g.lineTo(ox - 8, oy + b.height * T); g.strokePath();
    g.lineStyle(5, 0xffb056, 0.9).beginPath(); g.moveTo(ox + b.width * T + 8, oy); g.lineTo(ox + b.width * T + 8, oy + b.height * T); g.strokePath();
    this.boardLabels.add(this.add.text(ox - 8, oy - 22, '入口▶', { fontFamily: 'monospace', fontSize: '14px', color: '#57d977' }).setOrigin(0.5, 1).setDepth(3));
    this.boardLabels.add(this.add.text(ox + boardW + 8, oy - 22, '▶出口', { fontFamily: 'monospace', fontSize: '14px', color: '#ffb056' }).setOrigin(0.5, 1).setDepth(3));
    const litIds = new Set<string>();
    for (const c of boardCircuits()) for (const s of c.stones) litIds.add(s.id);
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const px = ox + x * T, py = oy + y * T;
        const cur = !this.picking && x === this.cx && y === this.cy;
        g.lineStyle(cur ? 3 : 1, cur ? 0xffffff : 0x2a3350, 1).strokeRect(px, py, T, T);
        const s = b.cells[y]![x];
        if (s) this.drawStone(g, px, py, T, s, litIds.has(s.id));
      }
    }
    // 右に手持ち or 回路一覧。
    const rx = ox + b.width * T + 40;
    let ry = oy - 4;
    const addL = (t: string, color: string = COLORS.text): void => { this.boardLabels.add(this.add.text(rx, ry, t, { fontFamily: 'monospace', fontSize: '17px', color }).setDepth(3)); ry += 24; };
    if (this.picking) {
      const free = freeStones();
      addL(`嵌める魔石を選ぶ [Z]決定 [X]戻る  （${free.length}個）`, '#ffe27a');
      const { from, to } = this.windowRange(free.length, this.pickIdx, 14); // カーソルが必ず見える窓に切る
      if (from > 0) addL('  ▲ （上に続く）', COLORS.dim);
      free.slice(from, to).forEach((s, j) => { const i = from + j; addL(`${i === this.pickIdx ? '▶' : ' '}${stoneLabel(s)}`, i === this.pickIdx ? '#ffffff' : COLORS.dim); });
      if (to < free.length) addL('  ▼ （下に続く）', COLORS.dim);
    } else {
      addL(`心域 ${b.width} × 演算 ${b.height}`);
      addL(`撃てるスキル: ${boardCircuits().length} 本`);
      boardCircuits().forEach((c) => addL(`・${ATTR_LABEL[c.element]} 強さ${c.strength} 費${circuitCost(c)}`, '#bfe6ff'));
      ry += 6;
      addL(`手持ち（未配置）: ${freeStones().length} 個`, COLORS.dim);
      freeStones().slice(0, 6).forEach((s) => addL(`  ${stoneLabel(s)}`, COLORS.dim));
    }
    this.body.setText([
      '◆ ここは「スキルを組む」編集画面です（戦闘ではありません）。組んだ回路を、戦闘で[スキル]として撃ちます。',
      '盤の上で [矢印]カーソル ／ [Z] 空マス＝魔石を嵌める・駒＝外す。入口(左)→出口(右)が一本つながると1スキル。',
      `心域＝横 ${b.width} / 演算＝縦 ${b.height}（レベルや工房で広がる）。文様は変更不可＝拾った魔石をやりくり。`,
      this.msg,
    ]);
  }

  private drawStone(g: Phaser.GameObjects.Graphics, px: number, py: number, T: number, s: Stone, lit: boolean): void {
    const cx = px + T / 2, cy = py + T / 2, h = T / 2;
    const ac = ATTR_COLOR[s.attr];
    const wire = lit ? ac : 0x55607a;
    g.fillStyle(lit ? 0x101a2c : 0x0e1422, 1).fillRoundedRect(px + 5, py + 5, T - 10, T - 10, 7);
    g.lineStyle(5, wire, 1);
    for (const e of s.edges) {
      g.beginPath(); g.moveTo(cx, cy);
      if (e === 'L') g.lineTo(cx - h, cy); else if (e === 'R') g.lineTo(cx + h, cy);
      else if (e === 'U') g.lineTo(cx, cy - h); else g.lineTo(cx, cy + h);
      g.strokePath();
    }
    g.fillStyle(wire, 1).fillCircle(cx, cy, 5);
    this.boardLabels.add(this.add.text(cx + 12, cy + 10, `${ATTR_LABEL[s.attr]}${s.value}`, { fontFamily: 'monospace', fontSize: '12px', color: lit ? '#dfe' : COLORS.dim }).setOrigin(0.5).setDepth(3));
  }

  private renderItems(): void {
    const list = this.itemList();
    const lines = ['道具を選んで [Z] で使う（HP/自由意志の回復）。', ''];
    if (list.length === 0) lines.push('  道具を持っていない。');
    list.forEach((id, i) => {
      const it = ITEMS[id]!;
      lines.push(`${i === this.idx ? '▶' : ' '}${it.name} ×${itemCount(id)}  （${it.desc}）`);
    });
    lines.push('', this.msg);
    this.body.setText(lines);
  }
}
