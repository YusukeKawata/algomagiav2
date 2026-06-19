// 物理戦（覚醒前）。[Z]なぐる だけ。スキル不可・雑魚は魔石をdrop（使い道はまだ無い＝伏線・§8.7）。
// 数値は手書き暫定（調整可）。決定論＝乱数なし。hero HP は最低1でクランプ（スライスは必ず進める）。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { currentBeat, advance } from '@game/flow';
import { game } from '@game/state';
import { PHYS_ENEMIES, type PhysEnemy } from '@game/data/enemies';

const PHYS_DMG = 6;

export class PhysBattleScene extends Phaser.Scene {
  private enemy!: PhysEnemy;
  private ehp = 0;
  private intro = '';
  private log = '';
  private won = false;
  private g!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;

  constructor() { super('Phys'); }

  create(): void {
    const beat = currentBeat();
    const id = beat?.kind === 'battle' ? beat.enemyId : 'mob1';
    this.intro = beat?.kind === 'battle' ? beat.intro : '';
    this.enemy = PHYS_ENEMIES[id] ?? PHYS_ENEMIES['mob1']!;
    this.ehp = this.enemy.hp;
    this.log = this.intro;
    this.won = false;

    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x120a12).setOrigin(0);
    this.g = this.add.graphics();
    this.text = this.add.text(80, 96, '', { fontFamily: 'monospace', fontSize: '20px', color: COLORS.text, lineSpacing: 8 });

    this.input.keyboard?.on('keydown-Z', () => this.act());
    this.input.keyboard?.on('keydown-ENTER', () => this.act());
    this.render();
  }

  private act(): void {
    if (this.won) { advance(this); return; }
    this.ehp = Math.max(0, this.ehp - PHYS_DMG);
    if (this.ehp <= 0) {
      game.stones += this.enemy.drop;
      this.won = true;
      this.log = `なぐる！ ${PHYS_DMG}ダメージ。${this.enemy.name}を倒した。魔石を${this.enemy.drop}つ拾った（所持:${game.stones}）。[Z]で進む`;
      this.render();
      return;
    }
    game.heroHp = Math.max(1, game.heroHp - this.enemy.atk);
    this.log = `なぐる！ ${PHYS_DMG}ダメージ。${this.enemy.name}の反撃 ${this.enemy.atk}（HP-${this.enemy.atk}）`;
    this.render();
  }

  private render(): void {
    const g = this.g;
    g.clear();
    // 敵
    g.fillStyle(0x2a1620, 1).fillRect(360, 200, 360, 18);
    g.fillStyle(0xff5a6e, 1).fillRect(360, 200, 360 * (this.ehp / this.enemy.hp), 18);
    // 自分
    g.fillStyle(0x16243a, 1).fillRect(360, 470, 360, 18);
    g.fillStyle(0x7be0a0, 1).fillRect(360, 470, 360 * (game.heroHp / game.heroHpMax), 18);

    this.text.setText([
      `《戦闘》${this.intro}`,
      '',
      `敵  ${this.enemy.name}    HP ${this.ehp}/${this.enemy.hp}`,
      '',
      `${game.heroName}（あなた）  HP ${game.heroHp}/${game.heroHpMax}`,
      '',
      `[Z]なぐる    ${this.log}`,
    ]);
  }
}
