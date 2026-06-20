// フィールド（歩けるマップ）。矢印=移動 / Z=調べる・会話送り。決定論ロジックは無し（演出層）。
// 里＝NPC会話＋遺構への出口、遺構＝歩くと徘徊石に遭遇(戦闘→復帰)・奥の番獣でフロー進行。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { currentBeat, advance } from '@game/flow';
import { fieldResume, game, grantXp, addStone, maxHp } from '@game/state';
import { MAPS, tileAt, isWall, findChar, mapCols, mapRows, type FieldMap, type MapExit } from '@game/data/maps';
import { NAMES as N } from '@game/data/names';
import { ENCOUNTER_POOLS } from '@game/data/enemies';
import { makeRng, pick } from '@core/rng';
import { rollStone, makeStone, stoneLabel, GARO_STONE } from '@game/data/stones';
import { DialogBox } from '@app/ui/dialogbox';
import { fadeInOnCreate, addMuteToggle, transitionTo, flash } from '@app/ui/fx';
import { playSfx } from '@app/ui/sfx';
import { paintScene } from '@app/ui/bg';
import { TILE as RLT, addTile } from '@app/ui/tiles';

const MAX_TILE = 72;   // 1マスの最大px（マップが大きい時は自動で縮める）
const ENC_STEPS = 5;   // 何歩ごとに遭遇判定
const ENC_MAX = 4;     // 遺構の遭遇回数（奥ほど手強い敵）

// 「調べる」点（プロップの位置に重ねる）。隣接 or 同マスで [Z]。give があれば一度だけ入手（flag で重複防止）。
interface Examine { x: number; y: number; who: string; lines: string[]; give?: { gold?: number; pool?: string; xp: number; flag: string } }
const EXAMINES: Record<string, Examine[]> = {
  village: [
    { x: 6, y: 2, who: N.wardStone, lines: ['里を守る古い魔石。…近くで見ると、光の脈がひどく細い。', `祖父いわく、これは「${N.device}」と対で里に遺されたものだという。`] },
    { x: 3, y: 6, who: '', lines: ['収穫した薬草の木箱。乾いた草と土の匂い。…守りたい暮らしが、ここにある。'] },
    { x: 9, y: 4, who: '', lines: ['古びた木箱。底に、子どもの落書きのような印。たぶんニナの仕業だ。'] },
  ],
  path: [
    { x: 7, y: 3, who: '', lines: ['道端に咲く花。霧が薄れたせいか、近ごろよく見かける。'] },
    { x: 11, y: 5, who: '', lines: ['打ち捨てられた荷車の残骸。誰かが急いで里へ逃げ帰った跡だろうか。'] },
  ],
  ruin: [
    { x: 3, y: 7, who: '', lines: ['ひび割れた頭蓋骨。…遺構に挑んで還らなかった者だろうか。'] },
    { x: 13, y: 3, who: '', lines: ['名も知れぬ墓標。歌の遺構は、いにしえの墓所でもあったらしい。'] },
    { x: 5, y: 3, who: '', lines: ['枯れ果てた樹。魔素ならぬ“何か”に、生気を吸い取られたように見える。'] },
    { x: 9, y: 1, who: '', lines: ['崩れた祭壇のくぼみに、小さな魔石が落ちている。…拾っておこう。'], give: { gold: 5, pool: 'mid', xp: 6, flag: 'ruin-cache' } },
  ],
};

interface Talk { lines: string[]; who: string; i: number; onEnd?: () => void }

export class FieldScene extends Phaser.Scene {
  private map!: FieldMap;
  private px = 1;
  private py = 1;
  private step = 0;
  private encounters = 0;
  private talk: Talk | null = null;
  private ox = 0;
  private oy = 0;
  private cols = 0;
  private rows = 0;
  private tile = MAX_TILE;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private box!: DialogBox;

  constructor() { super('Field'); }

  create(data?: { resume?: boolean; mapId?: string; sx?: number; sy?: number }): void {
    fadeInOnCreate(this);
    let mapId: string;
    if (data?.resume && fieldResume.active) mapId = fieldResume.mapId;
    else if (data?.mapId) mapId = data.mapId;
    else { const beat = currentBeat(); mapId = beat?.kind === 'field' ? beat.mapId : 'village'; }
    this.map = MAPS[mapId] ?? MAPS['village']!;

    this.step = 0;
    if (data?.resume && fieldResume.active) {
      this.px = fieldResume.x; this.py = fieldResume.y; this.encounters = fieldResume.encounters;
      fieldResume.active = false;
    } else if (data?.mapId && data.sx != null && data.sy != null) {
      this.px = data.sx; this.py = data.sy; this.encounters = 0;
    } else {
      const s = findChar(this.map, 'P') ?? { x: 1, y: 1 };
      this.px = s.x; this.py = s.y; this.encounters = 0;
    }

    this.cols = mapCols(this.map);
    this.rows = mapRows(this.map);
    this.tile = Math.floor(Math.min(MAX_TILE, (CANVAS_W - 40) / this.cols, (CANVAS_H - 96) / this.rows));
    this.ox = (CANVAS_W - this.cols * this.tile) / 2;
    this.oy = (CANVAS_H - this.rows * this.tile) / 2 + 8;

    paintScene(this, this.map.id === 'ruin' ? 'ruin' : 'village');
    this.buildStatic();
    this.g = this.add.graphics().setDepth(10); // プレイヤー/NPCトークンはタイルの上
    this.hud = this.add.text(this.ox, 18, '', { fontFamily: 'sans-serif', fontSize: '20px', color: COLORS.text }).setDepth(20);
    this.box = new DialogBox(this);

    this.input.keyboard?.on('keydown-UP', () => this.move(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(0, 1));
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1, 0));
    this.input.keyboard?.on('keydown-Z', () => this.interact());
    this.input.keyboard?.on('keydown-ENTER', () => this.interact());
    this.input.keyboard?.on('keydown-C', () => this.openMenu());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.box.stop());
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.updateHud()); // メニュー/店から戻ったら反映

    addMuteToggle(this);
    this.updatePlayer(); this.updateHud();
  }

  private blocked(x: number, y: number): boolean {
    const t = tileAt(this.map, x, y);
    return isWall(this.map, x, y) || t === 'G' || t === 'N' || t === 'I' || t === 'W' || t === 'A';
  }

  private openMenu(): void {
    if (this.talk) return;
    playSfx('confirm');
    this.scene.launch('Menu');
    this.scene.pause();
  }

  private openShop(shopId: string): void {
    if (this.talk) return;
    playSfx('confirm');
    this.scene.launch('Shop', { shopId });
    this.scene.pause();
  }

  private move(dx: number, dy: number): void {
    if (this.talk) return;
    const nx = this.px + dx, ny = this.py + dy;
    if (this.blocked(nx, ny)) return;
    this.px = nx; this.py = ny;
    this.step++;
    playSfx('move');

    const t = tileAt(this.map, nx, ny);
    const link = this.map.exits[t];
    if (link) { this.useExit(t, link); return; }
    if (t === 'B') { advance(this); return; } // 番獣戦へ（フロー進行）

    if (ENCOUNTER_POOLS[this.map.id] && this.encounters < ENC_MAX && this.step >= ENC_STEPS) {
      this.triggerEncounter();
      return;
    }
    this.updatePlayer(); this.updateHud();
  }

  /** 出口タイル＝マップ間移動。里の南口[E]はストーリー分岐（覚醒前=クエスト確認 / 覚醒後=番獣戦の引き金）。 */
  private useExit(tile: string, link: MapExit): void {
    if (this.map.id === 'village' && tile === 'E') {
      if (game.skillUnlocked) { advance(this); return; }          // 覚醒後＝盤戦へ（フロー進行）
      if (!game.flags['quest']) { this.openTalk('', [`（まず${N.elder}に話を聞こう。）`]); return; }
    }
    fieldResume.active = false;
    transitionTo(this, 'Field', { mapId: link.to, sx: link.sx, sy: link.sy });
  }

  private triggerEncounter(): void {
    this.encounters++;
    fieldResume.active = true;
    fieldResume.mapId = this.map.id;
    fieldResume.x = this.px; fieldResume.y = this.py;
    fieldResume.encounters = this.encounters;
    // 奥へ進む（遭遇回数が増える）ほど強い敵まで出る。種は決定論（リトライで同じ）。
    const table = ENCOUNTER_POOLS[this.map.id] ?? ['mob1'];
    const depth = Math.min(this.encounters, table.length);
    const pool = table.slice(0, depth);
    const r = makeRng(this.encounters * 1009 + 17);
    const enemyId = pick(r, pool) ?? 'mob1';
    flash(this, 0xff5a6e, 200);
    playSfx('hit');
    transitionTo(this, 'Battle', { mode: 'encounter', enemyId });
  }

  private interact(): void {
    if (this.talk) { this.advanceTalk(); return; }
    // 隣接NPC/店を探す
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const t = tileAt(this.map, this.px + dx, this.py + dy);
      if (t === 'I') { this.openShop('item'); return; }
      if (t === 'W') { this.openShop('weapon'); return; }
      if (t === 'A') { this.openShop('armor'); return; }
      if (t === 'G') { this.talkElder(); return; }
      if (t === 'N') {
        this.openTalk(N.friend, game.flags['quest']
          ? ['南の出口[E]から、森の小道→歌の遺構へ行けるよ。途中で[w]/[e]の通路を抜けて行き来できる。…無茶はしないで。', 'あたしは里に残って、守りを見てる。あんたが帰る場所は、ちゃんと守るから。']
          : ['守り石の光、昔はもっと暖かかったんだけどね。', 'おじいさんが待ってる。…早く行ってあげて。']);
        return;
      }
    }
    // NPCが居なければ「調べる」点（同マス/隣接）
    const ex = this.examineAt();
    if (ex) {
      if (ex.give && !game.flags[ex.give.flag]) {
        const g = ex.give;
        this.openTalk(ex.who, ex.lines, () => {
          game.flags[g.flag] = true;
          if (g.gold) game.gold += g.gold;
          let got = '';
          if (g.pool) {
            const stone = rollStone(makeRng(this.px * 73 + this.py * 31 + 7), g.pool);
            addStone(stone);
            got = `魔石「${stoneLabel(stone)}」・`;
          }
          const goldStr = g.gold ? `G+${g.gold}・` : '';
          const xr = grantXp(g.xp);
          this.updateHud();
          this.openTalk('', [`${goldStr}${got}経験+${g.xp}${xr.leveledUp ? `。★レベルアップ Lv.${xr.to}！` : '。'}`]);
        });
      } else if (ex.give) {
        this.openTalk('', ['…もう何も残っていない。']);
      } else {
        this.openTalk(ex.who, ex.lines);
      }
    }
  }

  /** 同マス/隣接の「調べる」点を返す。 */
  private examineAt(): Examine | null {
    const pts = EXAMINES[this.map.id] ?? [];
    for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const p = pts.find((e) => e.x === this.px + dx && e.y === this.py + dy);
      if (p) return p;
    }
    return null;
  }

  private talkElder(): void {
    if (game.flags['quest']) {
      this.openTalk(N.elder, [
        `気をつけてな。遺構の魔物は、奥へ行くほど手強くなる。`,
        `だが恐れるな。戦うたび、お前の意志は太くなる。倒れても立ち上がればいい。`,
      ]);
      return;
    }
    this.openTalk(N.elder, [
      `${N.heroDefault}、よく来た。…見ての通り、${N.wardStone}が、もう保たん。`,
      `この石は遠い昔、旅の者が「${N.device}」とともに里へ遺したものだ。仕組みは誰も知らん。ただ光が、魔物を退けてきた。`,
      `古い歌に言う——強い魔物の体内には、大きな魔石が宿ると。${N.ruin}の最奥に、ひときわ強いのが棲むそうだ。`,
      `そいつを狩り、大きな魔石を持ち帰れ。据炉にくべれば、守り石はまた灯るはず。南の出口から遺構へ。`,
      `…持っていけ。わしの形見の小さな魔石だ。一本線の、ただの物理石だがな。…お守りにはなる。`,
      `…無理はするな。お前にもしものことがあれば、わしはニナに合わせる顔がない。`,
    ], () => {
      game.flags['quest'] = true;
      if (!game.flags['garo-stone']) {
        game.flags['garo-stone'] = true;
        addStone(makeStone(GARO_STONE));
        this.updateHud();
      }
    });
  }

  private openTalk(who: string, lines: string[], onEnd?: () => void): void {
    this.talk = { who, lines, i: 0, onEnd };
    playSfx('confirm');
    this.box.show(who, lines[0] ?? '');
    this.updatePlayer(); this.updateHud();
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
      this.updatePlayer(); this.updateHud();
      return;
    }
    this.box.show(this.talk.who, this.talk.lines[this.talk.i] ?? '');
  }

  private mapName(): string {
    return this.map.id === 'village' ? N.village : this.map.id === 'path' ? '森の小道' : N.ruin;
  }

  private objective(): string {
    if (this.map.id === 'village') {
      if (game.skillUnlocked) return '▶ 準備ができたら南口[E]へ（魔物が出る）。[C]で魔石盤・店で装備';
      return game.flags['quest'] ? '▶ 南口[E]→森の小道→歌の遺構へ' : `▶ ${N.elder}に話しかけよう（隣でZ）`;
    }
    if (this.map.id === 'path') return '▶ 東口[e]→遺構 / 西口[w]→里（[Z]で調べる）';
    return '▶ 遺構の奥、番獣[B]を目指せ（西口[w]→小道）';
  }

  private cx(x: number): number { return this.ox + x * this.tile + this.tile / 2; }
  private cy(y: number): number { return this.oy + y * this.tile + this.tile / 2; }

  /** タイル地形＋NPC＋小物を一度だけ敷く（静的）。プレイヤーだけ毎手番動かす。 */
  private buildStatic(): void {
    const outdoors = this.map.id !== 'ruin';   // 里・森は草地＋木の囲い、遺構は石畳＋墓石
    const floorFrame = outdoors ? RLT.grass : RLT.stone;
    const T = this.tile;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = tileAt(this.map, x, y);
        addTile(this, this.cx(x), this.cy(y), floorFrame, T);             // 床は全マスに敷く
        if (t === '#') {
          // 壁＝里は森（木）、遺構は石畳の上に墓石/枯れ木
          addTile(this, this.cx(x), this.cy(y), outdoors ? RLT.tree : RLT.grave, T);
        } else if (t === 'E' || t === 'w' || t === 'e') {
          addTile(this, this.cx(x), this.cy(y), RLT.dirt, T);
          addTile(this, this.cx(x), this.cy(y - 0.02), RLT.sign, T * 0.9);
        } else if (t === 'B') {
          addTile(this, this.cx(x), this.cy(y), RLT.statue, T);           // 番獣の座＝石像/祭壇
        } else if (t === 'G' || t === 'N') {
          this.add.text(this.cx(x), this.cy(y) - T * 0.42, t === 'G' ? N.elder : N.friend, {
            fontFamily: 'sans-serif', fontSize: '13px', color: COLORS.dim,
          }).setOrigin(0.5).setDepth(5);
        } else if (t === 'I' || t === 'W' || t === 'A') {
          addTile(this, this.cx(x), this.cy(y), RLT.crate, T);                 // 店＝行商人の露店
          const name = t === 'I' ? '道具屋' : t === 'W' ? '武器屋' : '防具屋';
          this.add.text(this.cx(x), this.cy(y) - T * 0.46, name, {
            fontFamily: 'sans-serif', fontSize: '13px', color: '#ffe0a0',
          }).setOrigin(0.5).setDepth(5);
        }
      }
    }

    // 雰囲気の小物（固定配置・歩行に影響しない装飾）。
    if (this.map.id === 'village') {
      addTile(this, this.cx(6), this.cy(2), RLT.crystal, T * 0.8);        // 守り石（弱まりつつある）
      addTile(this, this.cx(2), this.cy(4), RLT.flowers, T);
      addTile(this, this.cx(10), this.cy(5), RLT.flowers, T);
      addTile(this, this.cx(3), this.cy(6), RLT.crate, T * 0.85);
      addTile(this, this.cx(9), this.cy(4), RLT.crate, T * 0.85);
    } else if (this.map.id === 'path') {
      addTile(this, this.cx(7), this.cy(3), RLT.flowers, T);
      addTile(this, this.cx(3), this.cy(6), RLT.flowers, T);
      addTile(this, this.cx(11), this.cy(6), RLT.crate, T * 0.8);
    } else {
      addTile(this, this.cx(5), this.cy(3), RLT.deadTree, T);
      addTile(this, this.cx(11), this.cy(5), RLT.deadTree, T);
      addTile(this, this.cx(7), this.cy(7), RLT.deadTree, T);
      addTile(this, this.cx(3), this.cy(7), RLT.skull, T * 0.7);
      addTile(this, this.cx(13), this.cy(3), RLT.grave, T * 0.8);
      addTile(this, this.cx(9), this.cy(1), RLT.skull, T * 0.7);
    }
  }

  /** NPC/プレイヤーのトークン（人物アートは無いので記号トークンで表現）。 */
  private updatePlayer(): void {
    const g = this.g;
    g.clear();
    const rad = this.tile * 0.28;
    // NPC は静的だがトークンは g に毎回描く（軽量）。
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = tileAt(this.map, x, y);
        if (t === 'G' || t === 'N') {
          g.fillStyle(t === 'G' ? 0xffd089 : 0x9ec5ff, 1).fillCircle(this.cx(x), this.cy(y), rad);
          g.lineStyle(2, 0x000000, 0.4).strokeCircle(this.cx(x), this.cy(y), rad);
        }
      }
    }
    g.fillStyle(0x6fe3ff, 1).fillCircle(this.cx(this.px), this.cy(this.py), rad + 2);
    g.lineStyle(3, 0xffffff, 0.85).strokeCircle(this.cx(this.px), this.cy(this.py), rad + 2);
  }

  private updateHud(): void {
    this.hud.setText(`${this.mapName()}  Lv.${game.level} HP${maxHp()} G${game.gold} 魔石${game.stones.length}   ${this.objective()}   [矢印]移動 [Z]調べる/話す [C]メニュー`);
  }
}
