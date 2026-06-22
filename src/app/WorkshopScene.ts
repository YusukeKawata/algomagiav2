// 魔石工房（集積）。地中の里の石工リーゼに [Z] で開くポーズ・オーバーレイ（第2幕で解禁）。
// 文様(edges)は不変のまま、素材魔石を1つ捧げて対象を鍛える＝集積（§8.6 / magic-stone-workshop.md）。
//   強化：素材を捧げて対象の魔素量(value)を +1。
//   属性：素材を捧げて対象の属性を、その素材の属性へ移す（弱点を意図的に狙える）。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { game, fuseValue, fuseAttr } from '@game/state';
import { stoneLabel } from '@game/data/stones';
import { ATTR_LABEL } from '@core/board';
import { NAMES as N } from '@game/data/names';
import { playSfx } from '@app/ui/sfx';

type Mode = 'value' | 'attr';

export class WorkshopScene extends Phaser.Scene {
  private mode: Mode = 'value';
  private targetIdx = 0;
  private picking = false;   // 素材を選ぶサブモード
  private matIdx = 0;
  private head!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private msg = '';

  constructor() { super('Workshop'); }

  create(): void {
    this.mode = 'value'; this.targetIdx = 0; this.picking = false; this.matIdx = 0;
    this.msg = `「集積」だ。素材の魔石を捧げて、一枚を鍛える。文様は変えられないよ。`;
    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x05060d, 0.85).setOrigin(0);
    this.head = this.add.text(60, 40, '', { fontFamily: 'monospace', fontSize: '22px', color: COLORS.text });
    this.body = this.add.text(60, 110, '', { fontFamily: 'monospace', fontSize: '19px', color: COLORS.text, lineSpacing: 9, wordWrap: { width: CANVAS_W - 120 } });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e.key));
    this.render();
  }

  private close(): void { playSfx('cancel'); this.scene.stop(); this.scene.resume('Field'); }

  /** カーソルが必ず見える窓のインデックス配列（魔石が多くても画面外へ流れない）。 */
  private windowed(len: number, idx: number, max = 16): number[] {
    let from = 0;
    if (len > max) from = Math.max(0, Math.min(idx - Math.floor(max / 2), len - max));
    const out: number[] = [];
    for (let i = from; i < Math.min(len, from + max); i++) out.push(i);
    return out;
  }

  private stones() { return game.stones; }
  /** 対象を除いた素材候補。 */
  private materials() { const t = this.stones()[this.targetIdx]; return this.stones().filter((s) => s.id !== t?.id); }

  private onKey(key: string): void {
    const k = key.toLowerCase();
    if (this.picking) { this.pickKey(key, k); return; }
    if (k === 'x' || key === 'Escape') { this.close(); return; }
    if (key === 'ArrowLeft' || key === 'ArrowRight') { this.mode = this.mode === 'value' ? 'attr' : 'value'; this.msg = ''; playSfx('move'); this.render(); return; }
    const list = this.stones();
    if (key === 'ArrowUp') { if (list.length) this.targetIdx = (this.targetIdx + list.length - 1) % list.length; playSfx('move'); this.render(); return; }
    if (key === 'ArrowDown') { if (list.length) this.targetIdx = (this.targetIdx + 1) % list.length; playSfx('move'); this.render(); return; }
    if (k === 'z' || key === 'Enter') {
      if (this.stones().length < 2) { this.msg = '素材が足りない（魔石が2つ以上いる）。'; playSfx('cancel'); this.render(); return; }
      this.picking = true; this.matIdx = 0; playSfx('confirm'); this.render();
    }
  }

  private pickKey(key: string, k: string): void {
    const mats = this.materials();
    if (k === 'x' || key === 'Escape') { this.picking = false; playSfx('cancel'); this.render(); return; }
    if (key === 'ArrowUp') { if (mats.length) this.matIdx = (this.matIdx + mats.length - 1) % mats.length; playSfx('move'); this.render(); return; }
    if (key === 'ArrowDown') { if (mats.length) this.matIdx = (this.matIdx + 1) % mats.length; playSfx('move'); this.render(); return; }
    if (k === 'z' || key === 'Enter') { this.apply(); }
  }

  private apply(): void {
    const target = this.stones()[this.targetIdx];
    const mat = this.materials()[this.matIdx];
    if (!target || !mat) { this.picking = false; this.render(); return; }
    const tBefore = stoneLabel(target);
    if (this.mode === 'value') {
      if (fuseValue(target.id, mat.id)) { playSfx('circuit'); this.msg = `${tBefore} を鍛えた → ${stoneLabel(target)}（素材「${stoneLabel(mat)}」を消費）。`; }
    } else {
      const attr = mat.attr;
      if (fuseAttr(target.id, mat.id, attr)) { playSfx('circuit'); this.msg = `${tBefore} の属性を ${ATTR_LABEL[attr]} へ移した → ${stoneLabel(target)}（素材「${stoneLabel(mat)}」を消費）。`; }
    }
    this.picking = false;
    if (this.targetIdx >= this.stones().length) this.targetIdx = Math.max(0, this.stones().length - 1);
    this.render();
  }

  private render(): void {
    const modeLabel = this.mode === 'value' ? '【強化(魔素量+1)】 属性うつし' : ' 強化(魔素量+1) 【属性うつし】';
    this.head.setText(`${N.workshop}（${N.maker}）    ［←→］${modeLabel}    ［X］出る`);
    const lines: string[] = [];
    const stones = this.stones();
    if (stones.length === 0) { lines.push('魔石を持っていない。'); this.body.setText(lines); return; }

    if (!this.picking) {
      lines.push(this.mode === 'value' ? '鍛える魔石を選んで [Z]（素材で魔素量を+1）' : '属性を移す対象を選んで [Z]（素材の属性に変わる）', '');
      this.windowed(stones.length, this.targetIdx).forEach((i) => lines.push(`${i === this.targetIdx ? '▶' : ' '}${stoneLabel(stones[i]!)}`));
      if (stones.length > 16) lines.push(`  （${stones.length}個中・[↑↓]でスクロール）`);
    } else {
      const t = stones[this.targetIdx]!;
      const mats = this.materials();
      lines.push(`対象: ${stoneLabel(t)} ← 捧げる素材を選ぶ [Z]決定 [X]戻る`, '');
      this.windowed(mats.length, this.matIdx).forEach((i) => {
        const s = mats[i]!;
        const note = this.mode === 'attr' ? `（→ ${ATTR_LABEL[s.attr]} に）` : '';
        lines.push(`${i === this.matIdx ? '▶' : ' '}${stoneLabel(s)} ${note}`);
      });
      if (mats.length > 16) lines.push(`  （${mats.length}個中・[↑↓]でスクロール）`);
    }
    lines.push('', this.msg);
    this.body.setText(lines);
  }
}
