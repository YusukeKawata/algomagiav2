// フィールド（歩けるマップ）。矢印=移動 / Z=調べる・会話送り。決定論ロジックは無し（演出層）。
// 里＝NPC会話＋遺構への出口、遺構＝歩くと徘徊石に遭遇(戦闘→復帰)・奥の番獣でフロー進行。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { currentBeat, advance } from '@game/flow';
import { fieldResume } from '@game/state';
import { MAPS, tileAt, isWall, findChar, MAP_W, MAP_H, type FieldMap } from '@game/data/maps';
import { NAMES as N } from '@game/data/names';
import { DialogBox } from '@app/ui/dialogbox';
import { fadeInOnCreate, addMuteToggle, transitionTo, flash } from '@app/ui/fx';
import { playSfx } from '@app/ui/sfx';

const TILE = 72;
const ENC_STEPS = 6;   // 何歩ごとに遭遇判定
const ENC_MAX = 2;     // 遺構の遭遇回数

interface Talk { lines: string[]; who: string; i: number; onEnd?: () => void }

export class FieldScene extends Phaser.Scene {
  private map!: FieldMap;
  private px = 1;
  private py = 1;
  private step = 0;
  private questGiven = false;
  private encounters = 0;
  private talk: Talk | null = null;
  private ox = 0;
  private oy = 0;
  private g!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private box!: DialogBox;

  constructor() { super('Field'); }

  create(data?: { resume?: boolean }): void {
    fadeInOnCreate(this);
    const beat = currentBeat();
    const mapId = beat?.kind === 'field' ? beat.mapId : 'village';
    this.map = MAPS[mapId]!;

    if (data?.resume && fieldResume.active && fieldResume.mapId === mapId) {
      this.px = fieldResume.x; this.py = fieldResume.y; this.step = 0;
      this.questGiven = fieldResume.questGiven; this.encounters = fieldResume.encounters;
      fieldResume.active = false;
    } else {
      const s = findChar(this.map, 'P') ?? { x: 1, y: 1 };
      this.px = s.x; this.py = s.y; this.step = 0; this.questGiven = false; this.encounters = 0;
    }

    this.ox = (CANVAS_W - MAP_W * TILE) / 2;
    this.oy = (CANVAS_H - MAP_H * TILE) / 2 + 8;

    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x070a12).setOrigin(0);
    this.g = this.add.graphics();
    this.labels = this.add.container(0, 0);
    this.hud = this.add.text(this.ox, 18, '', { fontFamily: 'sans-serif', fontSize: '20px', color: COLORS.text });
    this.box = new DialogBox(this);

    this.input.keyboard?.on('keydown-UP', () => this.move(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(0, 1));
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1, 0));
    this.input.keyboard?.on('keydown-Z', () => this.interact());
    this.input.keyboard?.on('keydown-ENTER', () => this.interact());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.box.stop());

    addMuteToggle(this);
    this.render();
  }

  private blocked(x: number, y: number): boolean {
    const t = tileAt(this.map, x, y);
    return isWall(this.map, x, y) || t === 'G' || t === 'N';
  }

  private move(dx: number, dy: number): void {
    if (this.talk) return;
    const nx = this.px + dx, ny = this.py + dy;
    if (this.blocked(nx, ny)) return;
    this.px = nx; this.py = ny;
    this.step++;
    playSfx('move');

    const t = tileAt(this.map, nx, ny);
    if (t === 'E') { this.tryExit(); return; }
    if (t === 'B') { advance(this); return; } // 番獣戦へ

    if (this.map.id === 'ruin' && this.encounters < ENC_MAX && this.step >= ENC_STEPS) {
      this.triggerEncounter();
      return;
    }
    this.render();
  }

  private tryExit(): void {
    if (this.map.id === 'village' && !this.questGiven) {
      this.openTalk('', [`（まず${N.elder}に話を聞こう。）`]);
      return;
    }
    advance(this); // 遺構フィールドへ
  }

  private triggerEncounter(): void {
    this.encounters++;
    fieldResume.active = true;
    fieldResume.mapId = this.map.id;
    fieldResume.x = this.px; fieldResume.y = this.py;
    fieldResume.questGiven = this.questGiven; fieldResume.encounters = this.encounters;
    const enemyId = this.encounters === 1 ? 'mob1' : 'mob2';
    flash(this, 0xff5a6e, 200);
    playSfx('hit');
    transitionTo(this, 'Phys', { mode: 'encounter', enemyId });
  }

  private interact(): void {
    if (this.talk) { this.advanceTalk(); return; }
    // 隣接NPCを探す
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const t = tileAt(this.map, this.px + dx, this.py + dy);
      if (t === 'G') { this.talkElder(); return; }
      if (t === 'N') { this.openTalk(N.friend, ['無茶しないでよ。…あたしは里に残って、守りを見てる。']); return; }
    }
  }

  private talkElder(): void {
    this.openTalk(N.elder, [
      `${N.heroDefault}。${N.wardStone}が、もう保たん。`,
      `古い歌に言う——強い魔物の体内には、大きな魔石がある。${N.ruin}の奥に、ひときわ強いのが棲むそうだ。`,
      'そいつを狩って、大きな魔石を持ち帰れ。南の出口から遺構へ向かうといい。',
    ], () => { this.questGiven = true; });
  }

  private openTalk(who: string, lines: string[], onEnd?: () => void): void {
    this.talk = { who, lines, i: 0, onEnd };
    playSfx('confirm');
    this.box.show(who, lines[0] ?? '');
    this.render();
  }

  private advanceTalk(): void {
    if (!this.talk) return;
    if (this.box.press() === 'skipped') return; // 表示途中は全表示のみ（1入力=1アクション）
    this.talk.i++;
    if (this.talk.i >= this.talk.lines.length) {
      const end = this.talk.onEnd;
      this.talk = null;
      this.box.setVisible(false);
      end?.();
      this.render();
      return;
    }
    this.box.show(this.talk.who, this.talk.lines[this.talk.i] ?? '');
  }

  private objective(): string {
    if (this.map.id === 'village') return this.questGiven ? '▶ 南の出口[E]から遺構へ' : `▶ ${N.elder}に話しかけよう（隣でZ）`;
    return '▶ 遺構の奥、番獣[B]を目指せ';
  }

  private render(): void {
    const g = this.g;
    g.clear();
    this.labels.removeAll(true);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = tileAt(this.map, x, y);
        const wall = t === '#';
        g.fillStyle(wall ? 0x1b2236 : 0x0d1322, 1).fillRect(this.ox + x * TILE, this.oy + y * TILE, TILE - 2, TILE - 2);
        if (t === 'E') { g.fillStyle(0x57d977, 0.85).fillRect(this.ox + x * TILE + 18, this.oy + y * TILE + 18, TILE - 38, TILE - 38); }
        if (t === 'B') { g.fillStyle(0xff5a6e, 0.9).fillCircle(this.ox + x * TILE + TILE / 2, this.oy + y * TILE + TILE / 2, 22); }
        if (t === 'G' || t === 'N') {
          g.fillStyle(t === 'G' ? 0xffd089 : 0x9ec5ff, 1).fillCircle(this.ox + x * TILE + TILE / 2, this.oy + y * TILE + TILE / 2, 20);
          this.labels.add(this.add.text(this.ox + x * TILE + TILE / 2, this.oy + y * TILE - 6, t === 'G' ? N.elder : N.friend, {
            fontFamily: 'sans-serif', fontSize: '13px', color: COLORS.dim,
          }).setOrigin(0.5));
        }
      }
    }
    // プレイヤー
    g.fillStyle(0x6fe3ff, 1).fillCircle(this.ox + this.px * TILE + TILE / 2, this.oy + this.py * TILE + TILE / 2, 22);
    g.lineStyle(3, 0xffffff, 0.8).strokeCircle(this.ox + this.px * TILE + TILE / 2, this.oy + this.py * TILE + TILE / 2, 22);

    this.hud.setText(`${this.map.id === 'village' ? N.village : N.ruin}    ${this.objective()}    [矢印]移動 [Z]調べる`);
  }
}
