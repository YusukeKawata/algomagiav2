// 物理戦（覚醒前）。[Z]なぐる だけ。スキル不可・雑魚は魔石をdrop（使い道はまだ無い＝伏線・§8.7）。
// 2モード: flow=台本の戦闘(勝利で次へ) / encounter=フィールドの遭遇(勝利でフィールドへ復帰)。
// 判定は core/phys.ts（決定論・テスト済）に委譲。難易度=中間: 各戦闘は開始時に全回復・負けたらリトライ。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { currentBeat, advance } from '@game/flow';
import { game } from '@game/state';
import { PHYS_ENEMIES, PHYS_POWER, type PhysEnemy } from '@game/data/enemies';
import { startPhys, strike, type PhysState } from '@core/phys';
import { fadeInOnCreate, addMuteToggle, transitionTo, popupNumber, flash, shake } from '@app/ui/fx';
import { playSfx } from '@app/ui/sfx';

const EX = CANVAS_W / 2, EY = 250; // 敵トークン
const HX = CANVAS_W / 2, HY = 470; // 主人公トークン

export class PhysBattleScene extends Phaser.Scene {
  private mode: 'flow' | 'encounter' = 'flow';
  private enemy!: PhysEnemy;
  private s!: PhysState;
  private intro = '';
  private log = '';
  private g!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;

  constructor() { super('Phys'); }

  create(data?: { mode?: string; enemyId?: string }): void {
    fadeInOnCreate(this);
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
    this.s = startPhys(game.heroHpMax, this.enemy); // 開始時に全回復
    this.log = this.intro;

    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x120a12).setOrigin(0);
    this.g = this.add.graphics();
    this.text = this.add.text(80, 96, '', { fontFamily: 'monospace', fontSize: '20px', color: COLORS.text, lineSpacing: 8 });

    this.input.keyboard?.on('keydown-Z', () => this.act());
    this.input.keyboard?.on('keydown-ENTER', () => this.act());
    addMuteToggle(this);
    this.render();
  }

  private act(): void {
    if (this.s.outcome === 'win') { this.finish(); return; }
    if (this.s.outcome === 'lose') { this.retry(); return; }

    const r = strike(this.s, PHYS_POWER);
    this.s = r.state;
    playSfx('hit');
    popupNumber(this, EX, EY - 30, `${r.dealt}`, { color: '#ffd27a' });

    if (this.s.outcome === 'win') {
      game.stones += this.enemy.drop;
      game.heroHp = this.s.hero.hp;
      playSfx('win');
      const cont = this.mode === 'encounter' ? '[Z]で戻る' : '[Z]で進む';
      this.log = `なぐる！ ${r.dealt}ダメージ。${this.enemy.name}を倒した。魔石+${this.enemy.drop}（所持:${game.stones}）。${cont}`;
      this.render();
      return;
    }

    // 敵の反撃を受けた。
    game.heroHp = this.s.hero.hp;
    shake(this);
    flash(this, 0xff5a6e, 130);
    popupNumber(this, HX, HY - 30, `${r.countered}`, { color: '#ff8a9a' });
    if (this.s.outcome === 'lose') {
      playSfx('lose');
      this.log = `なぐる！ ${r.dealt}ダメージ。…だが${this.enemy.name}の反撃で倒れた。[Z]でやり直す`;
    } else {
      playSfx('hurt');
      this.log = `なぐる！ ${r.dealt}ダメージ。${this.enemy.name}の反撃 ${r.countered}`;
    }
    this.render();
  }

  private retry(): void {
    this.s = startPhys(game.heroHpMax, this.enemy);
    game.heroHp = this.s.hero.hp;
    playSfx('confirm');
    this.log = `${this.intro}（やり直し）`;
    this.render();
  }

  private finish(): void {
    playSfx('confirm');
    if (this.mode === 'encounter') transitionTo(this, 'Field', { resume: true });
    else advance(this);
  }

  private render(): void {
    const g = this.g;
    g.clear();

    // トークン（〔アート未〕差し替え枠）。
    const ehpRatio = this.s.enemy.hp / this.s.enemy.max;
    const hhpRatio = Math.max(0, this.s.hero.hp) / this.s.hero.max;
    g.fillStyle(0x3a1622, 1).fillCircle(EX, EY, 46);
    g.lineStyle(3, 0xff5a6e, 0.9).strokeCircle(EX, EY, 46);
    g.fillStyle(0x16324a, 1).fillCircle(HX, HY, 36);
    g.lineStyle(3, 0x7be0a0, 0.9).strokeCircle(HX, HY, 36);

    // HPバー。
    g.fillStyle(0x2a1620, 1).fillRect(EX - 180, EY + 64, 360, 18);
    g.fillStyle(0xff5a6e, 1).fillRect(EX - 180, EY + 64, 360 * ehpRatio, 18);
    g.fillStyle(0x16243a, 1).fillRect(HX - 180, HY + 56, 360, 18);
    g.fillStyle(0x7be0a0, 1).fillRect(HX - 180, HY + 56, 360 * hhpRatio, 18);

    this.text.setText([
      `《戦闘》${this.intro}`,
      '',
      `敵  ${this.enemy.name}    HP ${this.s.enemy.hp}/${this.s.enemy.max}`,
      '',
      `${game.heroName}（あなた）  HP ${Math.max(0, this.s.hero.hp)}/${this.s.hero.max}`,
      '',
      `[Z]なぐる    ${this.log}`,
    ]);
  }
}
