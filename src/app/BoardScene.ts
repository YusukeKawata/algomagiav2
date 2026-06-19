// 魔石盤シーン（回路パズルの可視化・操作）。決定論ロジックは src/core/board.ts を呼ぶだけ。
// 動的に毎回再描画する即時モード（ADR-0006 ハイブリッドの「動的=即時描画」方針）。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { emptyBoard, place, circuits, type Board, type Edge, type Attr, type Stone } from '@core/board';

// 駒の形（文様）。値は強さ寄与。属性は配置時に別途選ぶ（形と属性は独立）。
interface Shape { key: string; edges: Edge[]; value: number }
const SHAPES: Shape[] = [
  { key: '─', edges: ['L', 'R'], value: 1 },
  { key: '│', edges: ['U', 'D'], value: 1 },
  { key: '┌', edges: ['D', 'R'], value: 1 },
  { key: '┐', edges: ['L', 'D'], value: 1 },
  { key: '└', edges: ['U', 'R'], value: 1 },
  { key: '┘', edges: ['L', 'U'], value: 1 },
  { key: '├', edges: ['U', 'D', 'R'], value: 2 },
  { key: '┼', edges: ['L', 'R', 'U', 'D'], value: 3 },
];

// 属性の表示（色・名前・選択キー）。
const ATTR_INFO: Record<Attr, { color: number; label: string; key: string }> = {
  fire: { color: 0xff7043, label: '炎', key: 'q' },
  ice: { color: 0x4fc3f7, label: '氷', key: 'w' },
  thunder: { color: 0xffd54f, label: '雷', key: 'e' },
  wind: { color: 0x81c784, label: '風', key: 'r' },
};
const ATTR_KEYS: Attr[] = ['fire', 'ice', 'thunder', 'wind'];

const CELL = 120;
const COLS = 5;
const ROWS = 4;

export class BoardScene extends Phaser.Scene {
  private board!: Board;
  private shapeIdx = 0;
  private attr: Attr = 'fire';
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
    this.originY = (CANVAS_H - ROWS * CELL) / 2 + 44;

    this.g = this.add.graphics();
    this.labels = this.add.container(0, 0);
    this.hud = this.add.text(this.originX, 22, '', {
      fontFamily: 'monospace', fontSize: '20px', color: COLORS.text, lineSpacing: 5,
    });

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e.key));

    // デモ初期配置（炎の一本道：左→右→下→右で出口）。
    const place6: [number, number, number][] = [
      [0, 1, 0], [1, 1, 0], [2, 1, 3], [2, 2, 4], [3, 2, 0], [4, 2, 0],
    ];
    for (const [x, y, si] of place6) this.board = place(this.board, x, y, this.mk(si, 'fire'));

    this.render();
  }

  private mk(shapeIdx: number, attr: Attr): Stone {
    const s = SHAPES[shapeIdx]!;
    return { id: `s${this.counter++}`, edges: [...s.edges], value: s.value, attr };
  }

  private onKey(key: string): void {
    const n = parseInt(key, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= SHAPES.length) { this.shapeIdx = n - 1; this.render(); return; }
    const hit = ATTR_KEYS.find((a) => ATTR_INFO[a].key === key.toLowerCase());
    if (hit) { this.attr = hit; this.render(); }
  }

  private onClick(p: Phaser.Input.Pointer): void {
    const x = Math.floor((p.x - this.originX) / CELL);
    const y = Math.floor((p.y - this.originY) / CELL);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    this.board = p.rightButtonDown()
      ? place(this.board, x, y, null)
      : place(this.board, x, y, this.mk(this.shapeIdx, this.attr));
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
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        g.strokeRect(this.originX + x * CELL, this.originY + y * CELL, CELL, CELL);

    // 駒と文様。
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const s = this.board.cells[y]![x];
        if (!s) continue;
        const { cx, cy } = this.cellCenter(x, y);
        const lit = litIds.has(s.id);
        const ac = ATTR_INFO[s.attr].color;
        const wire = lit ? ac : 0x55607a;
        const fill = lit ? 0x101a2c : 0x0e1422;

        g.fillStyle(fill, 1).fillRoundedRect(
          this.originX + x * CELL + 10, this.originY + y * CELL + 10, CELL - 20, CELL - 20, 10,
        );
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

        const t = this.add.text(cx + 18, cy + 16, `${ATTR_INFO[s.attr].label}${s.value}`, {
          fontFamily: 'monospace', fontSize: '15px',
          color: lit ? Phaser.Display.Color.IntegerToColor(ac).rgba : COLORS.dim,
        }).setOrigin(0.5);
        this.labels.add(t);
      }
    }

    // 各回路の 元素＋強さ を出口側に。
    cs.forEach((c, i) => {
      const info = ATTR_INFO[c.element];
      const t = this.add.text(this.originX + COLS * CELL + 24, top + 10 + i * 28, `⚡${c.strength} ${info.label}`, {
        fontFamily: 'monospace', fontSize: '20px', color: Phaser.Display.Color.IntegerToColor(info.color).rgba,
      });
      this.labels.add(t);
    });

    const shape = SHAPES[this.shapeIdx]!;
    const ai = ATTR_INFO[this.attr];
    const shapeStr = SHAPES.map((s, i) => (i === this.shapeIdx ? `[${i + 1}:${s.key}]` : `${i + 1}:${s.key}`)).join(' ');
    const attrStr = ATTR_KEYS.map((a) => (a === this.attr ? `[${ATTR_INFO[a].key}:${ATTR_INFO[a].label}]` : `${ATTR_INFO[a].key}:${ATTR_INFO[a].label}`)).join(' ');
    this.hud.setText([
      `魔石盤  撃てるスキル: ${cs.length}   選択中: ${shape.key}/${ai.label}(値${shape.value})`,
      `形 ${shapeStr}    属性 ${attrStr}`,
      `数字=形 / qwer=属性 / 左クリック=置く / 右クリック=消す`,
    ]);
  }
}
