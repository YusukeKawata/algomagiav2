// 魔石盤シーン（回路パズルの可視化・操作）。決定論ロジックは src/core/board.ts を呼ぶだけ。
// 動的に毎回再描画する即時モード（ADR-0006 ハイブリッドの「動的=即時描画」方針）。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { emptyBoard, place, circuits, type Board, type Edge, type Stone } from '@core/board';

interface PaletteEntry {
  key: string; // 表示記号
  edges: Edge[];
  value: number;
}

// 駒パレット（文様の種類）。値は強さ寄与（合計＝回路の強さ）。
const PALETTE: PaletteEntry[] = [
  { key: '─', edges: ['L', 'R'], value: 1 },
  { key: '│', edges: ['U', 'D'], value: 1 },
  { key: '┌', edges: ['D', 'R'], value: 1 },
  { key: '┐', edges: ['L', 'D'], value: 1 },
  { key: '└', edges: ['U', 'R'], value: 1 },
  { key: '┘', edges: ['L', 'U'], value: 1 },
  { key: '├', edges: ['U', 'D', 'R'], value: 2 },
  { key: '┼', edges: ['L', 'R', 'U', 'D'], value: 3 },
];

const CELL = 120;
const COLS = 5;
const ROWS = 4;

export class BoardScene extends Phaser.Scene {
  private board!: Board;
  private selected = 0;
  private counter = 0;
  private g!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private originX = 0;
  private originY = 0;

  constructor() {
    super('Board');
  }

  create(): void {
    this.board = emptyBoard(COLS, ROWS);
    this.originX = (CANVAS_W - COLS * CELL) / 2;
    this.originY = (CANVAS_H - ROWS * CELL) / 2 + 36;

    this.g = this.add.graphics();
    this.labels = this.add.container(0, 0);
    this.hud = this.add.text(this.originX, 24, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: COLORS.text,
      lineSpacing: 4,
    });

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= PALETTE.length) {
        this.selected = n - 1;
        this.render();
      }
    });

    // デモの初期配置（業火っぽい一本道）。
    this.board = place(this.board, 0, 1, this.mk(PALETTE[0]!));
    this.board = place(this.board, 1, 1, this.mk(PALETTE[0]!));
    this.board = place(this.board, 2, 1, this.mk(PALETTE[3]!)); // ┐ 左から下へ
    this.board = place(this.board, 2, 2, this.mk(PALETTE[4]!)); // └ 上から右へ
    this.board = place(this.board, 3, 2, this.mk(PALETTE[0]!));
    this.board = place(this.board, 4, 2, this.mk(PALETTE[0]!));

    this.render();
  }

  private mk(p: PaletteEntry): Stone {
    return { id: `s${this.counter++}`, edges: [...p.edges], value: p.value };
  }

  private onClick(p: Phaser.Input.Pointer): void {
    const x = Math.floor((p.x - this.originX) / CELL);
    const y = Math.floor((p.y - this.originY) / CELL);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    if (p.rightButtonDown()) {
      this.board = place(this.board, x, y, null);
    } else {
      this.board = place(this.board, x, y, this.mk(PALETTE[this.selected]!));
    }
    this.render();
  }

  private cellCenter(x: number, y: number): { cx: number; cy: number } {
    return { cx: this.originX + x * CELL + CELL / 2, cy: this.originY + y * CELL + CELL / 2 };
  }

  private render(): void {
    const g = this.g;
    g.clear();
    this.labels.removeAll(true);

    const cs = circuits(this.board);
    const litIds = new Set<string>();
    for (const c of cs) for (const s of c.stones) litIds.add(s.id);

    // 入口レール（左・緑）/ 出口レール（右・橙）。
    const top = this.originY;
    const bot = this.originY + ROWS * CELL;
    g.lineStyle(6, 0x57d977, 0.9).beginPath();
    g.moveTo(this.originX - 10, top); g.lineTo(this.originX - 10, bot); g.strokePath();
    g.lineStyle(6, 0xffb056, 0.9).beginPath();
    g.moveTo(this.originX + COLS * CELL + 10, top); g.lineTo(this.originX + COLS * CELL + 10, bot); g.strokePath();

    // セル枠。
    g.lineStyle(1, 0x2a3350, 1);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        g.strokeRect(this.originX + x * CELL, this.originY + y * CELL, CELL, CELL);
      }
    }

    // 駒と文様。
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const s = this.board.cells[y]![x];
        if (!s) continue;
        const { cx, cy } = this.cellCenter(x, y);
        const lit = litIds.has(s.id);
        const wire = lit ? 0x8fdcff : 0x55607a;
        const fill = lit ? 0x14304a : 0x0e1422;

        g.fillStyle(fill, 1).fillRoundedRect(
          this.originX + x * CELL + 10, this.originY + y * CELL + 10, CELL - 20, CELL - 20, 10,
        );
        // 文様（中心→各導通辺）。
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

        const t = this.add.text(cx + 16, cy + 14, String(s.value), {
          fontFamily: 'monospace', fontSize: '16px', color: lit ? '#cde9ff' : COLORS.dim,
        }).setOrigin(0.5);
        this.labels.add(t);
      }
    }

    // 各回路の強さを出口側に。
    cs.forEach((c, i) => {
      const t = this.add.text(this.originX + COLS * CELL + 24, top + 12 + i * 26, `⚡${c.strength}`, {
        fontFamily: 'monospace', fontSize: '20px', color: '#ffd089',
      });
      this.labels.add(t);
    });

    const sel = PALETTE[this.selected]!;
    const paletteStr = PALETTE.map((p, i) => (i === this.selected ? `[${i + 1}:${p.key}]` : `${i + 1}:${p.key}`)).join(' ');
    this.hud.setText([
      `魔石盤  撃てるスキル: ${cs.length}   選択中: ${sel.key}(値${sel.value})`,
      `駒: ${paletteStr}`,
      `数字1-${PALETTE.length}=駒選択 / 左クリック=置く / 右クリック=消す`,
    ]);
  }
}
