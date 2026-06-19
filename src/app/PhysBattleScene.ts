// 物理戦（覚醒前）。[Z]なぐる だけ。スキル不可・雑魚は魔石をdrop（使い道はまだ無い＝伏線・§8.7）。
// 2モード: flow=台本の戦闘(勝利で次へ) / encounter=フィールドの遭遇(勝利でフィールドへ復帰)。
// 難易度=中間: 負けたら同じ戦闘をリトライ（行き止まりにしない）。数値は手書き暫定。決定論＝乱数なし。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { currentBeat, advance } from '@game/flow';
import { game } from '@game/state';
import { PHYS_ENEMIES, type PhysEnemy } from '@game/data/enemies';

const PHYS_DMG = 6;

export class PhysBattleScene extends Phaser.Scene {
  private mode: 'flow' | 'encounter' = 'flow';
  private enemy!: PhysEnemy;
  private ehp = 0;
  private intro = '';
  private log = '';
  private won = false;
  private lost = false;
  private g!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;

  constructor() { super('Phys'); }

  create(data?: { mode?: string; enemyId?: string }): void {
    let id = 'mob1';
    if (data?.mode === 'encounter') {
      this.mode = 'encounter';
      id = data.enemyId ?? 'mob1';
      this.intro = `${PHYS_ENEMIES[id]?.name ?? '魔物'}が現れた！`;
    } else {
      this.mode = 'flow';
      const beat = currentBeat();
      id = beat?.kind === 'battle' ? beat.enemyId : 'mob1';
      this.intro = beat?.kind === 'battle' ? beat.intro : '';
    }
    this.enemy = PHYS_ENEMIES[id] ?? PHYS_ENEMIES['mob1']!;
    this.ehp = this.enemy.hp;
    this.log = this.intro;
    this.won = false;
    this.lost = false;

    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x120a12).setOrigin(0);
    this.g = this.add.graphics();
    this.text = this.add.text(80, 96, '', { fontFamily: 'monospace', fontSize: '20px', color: COLORS.text, lineSpacing: 8 });

    this.input.keyboard?.on('keydown-Z', () => this.act());
    this.input.keyboard?.on('keydown-ENTER', () => this.act());
    this.render();
  }

  private act(): void {
    if (this.won) { this.finish(); return; }
    if (this.lost) { this.retry(); return; }

    this.ehp = Math.max(0, this.ehp - PHYS_DMG);
    if (this.ehp <= 0) {
      game.stones += this.enemy.drop;
      this.won = true;
      const cont = this.mode === 'encounter' ? '[Z]で戻る' : '[Z]で進む';
      this.log = `なぐる！ ${PHYS_DMG}ダメージ。${this.enemy.name}を倒した。魔石+${this.enemy.drop}（所持:${game.stones}）。${cont}`;
      this.render();
      return;
    }
    game.heroHp = Math.max(0, game.heroHp - this.enemy.atk);
    if (game.heroHp <= 0) {
      this.lost = true;
      this.log = `なぐる！ ${PHYS_DMG}ダメージ。…だが${this.enemy.name}の反撃で倒れた。[Z]でやり直す`;
      this.render();
      return;
    }
    this.log = `なぐる！ ${PHYS_DMG}ダメージ。${this.enemy.name}の反撃 ${this.enemy.atk}（HP-${this.enemy.atk}）`;
    this.render();
  }

  private retry(): void {
    game.heroHp = game.heroHpMax;
    this.ehp = this.enemy.hp;
    this.lost = false;
    this.log = `${this.intro}（やり直し）`;
    this.render();
  }

  private finish(): void {
    if (this.mode === 'encounter') this.scene.start('Field', { resume: true });
    else advance(this);
  }

  private render(): void {
    const g = this.g;
    g.clear();
    g.fillStyle(0x2a1620, 1).fillRect(360, 200, 360, 18);
    g.fillStyle(0xff5a6e, 1).fillRect(360, 200, 360 * (this.ehp / this.enemy.hp), 18);
    g.fillStyle(0x16243a, 1).fillRect(360, 470, 360, 18);
    g.fillStyle(0x7be0a0, 1).fillRect(360, 470, 360 * Math.max(0, game.heroHp) / game.heroHpMax, 18);

    this.text.setText([
      `《戦闘》${this.intro}`,
      '',
      `敵  ${this.enemy.name}    HP ${this.ehp}/${this.enemy.hp}`,
      '',
      `${game.heroName}（あなた）  HP ${Math.max(0, game.heroHp)}/${game.heroHpMax}`,
      '',
      `[Z]なぐる    ${this.log}`,
    ]);
  }
}
