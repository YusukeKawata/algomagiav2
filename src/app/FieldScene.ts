// フィールド（歩けるマップ）。矢印=移動 / Z=調べる・会話送り。決定論ロジックは無し（演出層）。
// 里＝NPC会話＋遺構への出口、遺構＝歩くと徘徊石に遭遇(戦闘→復帰)・奥の番獣でフロー進行。
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, COLORS } from '@app/theme';
import { currentBeat, advance } from '@game/flow';
import { fieldResume, game, grantXp, addStone, maxHp, raiseBoardCap } from '@game/state';
import { MAPS, tileAt, findChar, mapCols, mapRows, type FieldMap, type MapExit, type NpcDef, type DecorKey } from '@game/data/maps';
import { NAMES as N } from '@game/data/names';
import { ENCOUNTER_POOLS } from '@game/data/enemies';
import { makeRng, pick } from '@core/rng';
import { rollStone, makeStone, stoneLabel, GARO_STONE } from '@game/data/stones';
import { DialogBox } from '@app/ui/dialogbox';
import { fadeInOnCreate, addMuteToggle, transitionTo, flash } from '@app/ui/fx';
import { playSfx } from '@app/ui/sfx';
import { startBgm } from '@app/ui/music';
import { paintScene } from '@app/ui/bg';
import { TILE as RLT, addTile } from '@app/ui/tiles';

const ENC_STEPS = 4;   // 何歩ごとに遭遇判定（無制限＝ランダムエンカウント）
const TILE_PX = 36;    // 1マスの固定px（元素材を小さめに使う＝密度UP）。大きいマップはカメラがスクロール。

// 「調べる」点（プロップの位置に重ねる）。隣接 or 同マスで [Z]。give があれば一度だけ入手（flag で重複防止）。
interface Examine { x: number; y: number; who?: string; lines: string[]; give?: { gold?: number; pool?: string; xp: number; flag: string } }
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
  private tile = TILE_PX;
  private scroll = false;  // マップが画面より大きい＝カメラ追従スクロール
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private box!: DialogBox;
  private npcAt = new Map<string, NpcDef>(); // "x,y"→データNPC（村・ガロの家）

  constructor() { super('Field'); }

  /** データNPCの位置索引を作る。 */
  private buildNpcIndex(): void {
    this.npcAt.clear();
    for (const n of this.map.npcs ?? []) this.npcAt.set(`${n.x},${n.y}`, n);
  }
  private npcAtTile(x: number, y: number): NpcDef | undefined { return this.npcAt.get(`${x},${y}`); }

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

    this.buildNpcIndex();
    this.cols = mapCols(this.map);
    this.rows = mapRows(this.map);
    this.tile = TILE_PX;
    const worldW = this.cols * this.tile, worldH = this.rows * this.tile;
    this.scroll = worldW > CANVAS_W || worldH > CANVAS_H;
    if (this.scroll) {
      // 大きいマップ＝原点(0,0)から敷いてカメラを境界内でプレイヤー追従させる。
      this.ox = 0; this.oy = 0;
      this.cameras.main.setBounds(0, 0, worldW, worldH);
    } else {
      // 小さいマップ＝画面中央に寄せて固定（カメラはスクロールしない）。
      this.ox = (CANVAS_W - worldW) / 2;
      this.oy = (CANVAS_H - worldH) / 2 + 8;
      this.cameras.main.setBounds(0, 0, CANVAS_W, CANVAS_H);
    }

    paintScene(this, this.bgKind()).setScrollFactor(0); // 背景はスクロールしても画面に固定（バックドロップ）
    startBgm(this.bgKind() === 'under' ? 'under' : this.bgKind() === 'ruin' ? 'ruin' : 'village');
    this.buildStatic();
    this.g = this.add.graphics().setDepth(10); // プレイヤー/NPCトークンはタイルの上
    this.hud = this.add.text(16, 14, '', { fontFamily: 'sans-serif', fontSize: '19px', color: COLORS.text }).setDepth(20).setScrollFactor(0);
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

  /** マップ→背景アート。地中の里・坑道は地下（under）、遺構は ruin、それ以外は village。 */
  private bgKind(): 'under' | 'ruin' | 'village' {
    if (this.map.id === 'underville' || this.map.id === 'tunnels') return 'under';
    return this.map.id === 'ruin' ? 'ruin' : 'village';
  }

  /** 屋外（草地＋木の囲い）か。遺構・坑道・地中の里は地下/石床。 */
  private isOutdoors(): boolean {
    return this.map.id === 'village' || this.map.id === 'path';
  }

  private blocked(x: number, y: number): boolean {
    const t = tileAt(this.map, x, y);
    if (t === '#' || t === 'H' || t === 'C') return true;       // 壁/建物/守り石
    if (t === 'G' || t === 'N' || t === 'I' || t === 'W' || t === 'A' || t === 'J' || t === 'M') return true; // 旧式NPC/店
    if (this.npcAtTile(x, y)) return true;                       // データNPC
    return false;
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

  private openWorkshop(): void {
    if (this.talk) return;
    playSfx('confirm');
    this.scene.launch('Workshop');
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
    if (t === 'O') { advance(this); return; } // この先へ（第2幕の入口を抜ける＝フロー進行）

    // ランダムエンカウント（無制限）：最低 ENC_STEPS 歩いたら、以降は毎歩 一定確率で遭遇。
    if (ENCOUNTER_POOLS[this.map.id] && this.step >= ENC_STEPS) {
      const r = makeRng(this.step * 17 + this.px * 7 + this.py * 13 + this.encounters * 101);
      if (r() < 0.5) { this.triggerEncounter(); return; }
    }
    this.updatePlayer(); this.updateHud();
  }

  /** 出口タイル＝マップ間移動。里の南口[E]はストーリー分岐（覚醒前=クエスト確認 / 覚醒後=番獣戦の引き金）。 */
  private useExit(tile: string, link: MapExit): void {
    if (this.map.id === 'village' && tile === 'E') {
      if (game.skillUnlocked) { advance(this); return; }          // 覚醒後＝盤戦へ（フロー進行）
      if (game.flags['boss-cleared']) { this.openTalk('', [`（その前に、${N.elder}が家で待っている。報告しよう。）`]); return; }
      if (!game.flags['quest']) { this.openTalk('', [`（まず${N.elder}の家[g]へ。話を聞こう。）`]); return; }
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
    // 隣接NPC/店を探す（データNPC優先→旧式の文字NPC）。
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const npc = this.npcAtTile(this.px + dx, this.py + dy);
      if (npc) { this.talkNpc(npc); return; }
      const t = tileAt(this.map, this.px + dx, this.py + dy);
      if (t === 'I') { this.openShop('item'); return; }
      if (t === 'W') { this.openShop('weapon'); return; }
      if (t === 'A') { this.openShop('armor'); return; }
      if (t === 'J') { this.talkUnderElder(); return; }
      if (t === 'M') { this.talkMaker(); return; }
      if (t === 'G') { this.talkElder(); return; }
    }
    // NPCが居なければ「調べる」点（同マス/隣接）
    const ex = this.examineAt();
    if (ex) {
      if (ex.give && !game.flags[ex.give.flag]) {
        const g = ex.give;
        this.openTalk(ex.who ?? '', ex.lines, () => {
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
        this.openTalk(ex.who ?? '', ex.lines);
      }
    }
  }

  /** 同マス/隣接の「調べる」点を返す（マップ自身の examines 優先→旧式の EXAMINES）。 */
  private examineAt(): Examine | null {
    const pts: Examine[] = this.map.examines ?? EXAMINES[this.map.id] ?? [];
    for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const p = pts.find((e) => e.x === this.px + dx && e.y === this.py + dy);
      if (p) return p;
    }
    return null;
  }

  /** データNPCを種別ごとに処理（村・ガロの家）。 */
  private talkNpc(npc: NpcDef): void {
    switch (npc.kind) {
      case 'garo': this.talkElder(); return;
      case 'nina': this.talkNina(); return;
      case 'shopItem': this.openShop('item'); return;
      case 'shopWeapon': this.openShop('weapon'); return;
      case 'shopArmor': this.openShop('armor'); return;
      case 'underElder': this.talkUnderElder(); return;
      case 'maker': this.talkMaker(); return;
      default: this.openTalk(npc.name ?? '', npc.lines ?? ['…。']); return;
    }
  }

  /** 幼馴染ニナ（状況分岐）。出発前は装備を促し、地中へ向かう前は別れを惜しむ。 */
  private talkNina(): void {
    if (game.flags['boss-cleared'] && !game.skillUnlocked) {
      this.openTalk(N.friend, ['おかえり…！ 無事だったのね。大きな魔石を持って帰ったって、ほんと？', `おじいさんが家で待ってる。…早く、顔を見せてあげて。`]);
      return;
    }
    if (!game.flags['quest']) {
      this.openTalk(N.friend, ['守り石の光、昔はもっと暖かかったんだけどね。', `おじいさんが家で待ってる。…ガロの家[g]へ行ってあげて。`]);
      return;
    }
    // クエスト受領後＝初めて村の外へ。装備を促すソフト誘導。
    this.openTalk(N.friend, [
      'ほんとに行くんだね。…その装備で、外は少し心配。道具屋でやくそうだけでも持っていって。',
      '武器屋[W]と防具屋[A]も、露店を出してる。お金が足りなきゃ、拾った魔石を道具屋で売ればいい。',
      '南の門[E]を出れば、森の小道。そこから歌の遺構へ。…途中、魔物が出る。無理だと思ったら、すぐ戻って。',
      'あたしは里に残って、守りを見てる。あんたの帰る場所は、ちゃんと守るから。…約束だよ。',
    ]);
  }

  private talkElder(): void {
    // 番獣撃破後＝据炉へ案内（覚醒前のみ）。Garoの家で報告→ついてこい→覚醒(awaken)へフロー進行。
    if (game.flags['boss-cleared'] && !game.skillUnlocked) {
      this.openTalk(N.elder, [
        `${N.heroDefault}…！ よく無事で帰った。その魔石——これまで見たどれより、ずっと大きい。`,
        `よくやった。本当に、よくやった。…だが、ただ守り石として据えるだけでは、この大きさは扱いきれん。`,
        `里の外れに、古い「据炉」がある。あれを動かさねばならん。…見せたいものがある。ついてこい。`,
      ], () => advance(this)); // → 据炉（awaken beat）へ
      return;
    }
    if (game.flags['quest']) {
      this.openTalk(N.elder, [
        `気をつけてな。遺構の魔物は、奥へ行くほど手強くなる。…露店で装備を整えてから行け。`,
        `だが恐れるな。戦うたび、お前の意志は太くなる。倒れても立ち上がればいい。南門[E]から森へ。`,
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

  /** 地中の里・不干渉派の長タルゴ（「隠れろ、刺激するな」＝テーマの鏡）。 */
  private talkUnderElder(): void {
    this.openTalk(N.underElder, game.flags['act2']
      ? [
          `工房のリーゼには会ったか。…あれは昔から、じっとしていられん性分でな。`,
          `お前の問い癖も、あれと同じ匂いがする。…だが忘れるな。我らが生き延びたのは、隠れ、逸脱せず、刺激しなかったからだ。`,
          `この先へ行くなら止めはせん。だが——魔物を、この里へ連れてくるな。`,
        ]
      : [
          `…見ない顔だ。地の底のこの里まで、よく一人で下りてきたな。`,
          `我らは長く、ここで息を潜めて生きてきた。霧ではなく、土と岩がこの里を「あの目」から隠している。`,
          `お前のように覚醒し、騒ぐ者は…正直、迷惑だ。魔物を呼び込む気か。`,
          `（里長タルゴは警戒を解かない。…奥の工房に、若い石工がいるようだ。）`,
        ]);
  }

  /** 石工リーゼ（不干渉に疑問を持つ職人）＝魔石工房を開く。初回に集積/盤拡張/回復魔法を解禁。 */
  private talkMaker(): void {
    if (!game.flags['act2']) {
      this.openTalk(N.maker, [
        `あんたか、上の里から下りてきたっていう変わり者は。…タルゴは渋い顔してたでしょ。`,
        `あたしはリーゼ。石工——魔石をいじるのが仕事。この里じゃ「余計なこと」って煙たがられてるけどね。`,
        `見せて、その魔石。…へえ、ずいぶん雑多に集めたね。なら「${N.workshop}」の出番だ。`,
        `安い魔石を素材に捧げれば、別の一枚を鍛えられる。魔素量を盛るのも、属性を移すのもできる。文様だけは変えられないけどね。`,
        `それと——あんたの盤、まだ狭い。心域を少し開いてやる。広い盤なら、長い回路や回復の魔法も組めるようになる。`,
      ], () => {
        game.flags['act2'] = true;
        game.flags['healMagic'] = true;       // 心域＝回復魔法の入口（§8.9）
        raiseBoardCap(4);                      // 盤上限 3×3 → 4×4（即1段広がる）
        this.updateHud();
        this.openTalk(N.maker, [
          `はい、これで心域が開いた。盤がひとまわり広くなったはずだ（上限が伸びた）。`,
          `戦って強くなれば、盤はさらに育つ。…さあ、工房を使ってみな。`,
        ], () => this.openWorkshop());
      });
      return;
    }
    this.openWorkshop();
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
    switch (this.map.id) {
      case 'village': return N.village;
      case 'garo_house': return `${N.elder}の家`;
      case 'path': return '森の小道';
      case 'tunnels': return '地中への坑道';
      case 'underville': return N.underville;
      default: return N.ruin;
    }
  }

  private objective(): string {
    if (this.map.id === 'garo_house') {
      return game.flags['boss-cleared'] && !game.skillUnlocked
        ? `▶ ${N.elder}に報告しよう（隣でZ）`
        : `▶ ${N.elder}に話しかけよう（隣でZ）／扉[d]で外へ`;
    }
    if (this.map.id === 'village') {
      if (game.skillUnlocked) return '▶ 南門[E]へ（魔物が出る）。[C]で魔石盤・露店で装備';
      if (game.flags['boss-cleared']) return `▶ ${N.elder}の家[g]へ戻ろう（南西の家）`;
      return game.flags['quest'] ? '▶ 露店で装備を整え、南門[E]→森の小道→遺構へ' : `▶ ${N.elder}の家[g]へ（南西の家・扉でZ）`;
    }
    if (this.map.id === 'path') return '▶ 東口[e]→遺構 / 西口[w]→里（[Z]で調べる）';
    if (this.map.id === 'tunnels') return '▶ 東口[e]→地中の里（魔物が徘徊する。属性に合わせ防具を選べ）';
    if (this.map.id === 'underville') {
      return game.flags['act2']
        ? `▶ ${N.maker}[M]で工房（集積）・[C]で魔石盤／この先へ[O]`
        : `▶ ${N.maker}[M]に話しかけよう（魔石工房）。里長タルゴ[J]も近くに`;
    }
    return '▶ 遺構の奥、番獣[B]を目指せ（西口[w]→小道）';
  }

  private cx(x: number): number { return this.ox + x * this.tile + this.tile / 2; }
  private cy(y: number): number { return this.oy + y * this.tile + this.tile / 2; }

  private decorFrame(key: DecorKey): number {
    const map: Record<DecorKey, number> = {
      crystal: RLT.crystal, flowers: RLT.flowers, crate: RLT.crate,
      deadTree: RLT.deadTree, skull: RLT.skull, grave: RLT.grave, statue: RLT.statue, sign: RLT.sign,
    };
    return map[key];
  }

  /** タイル地形＋建物＋NPC名＋小物を一度だけ敷く（静的）。プレイヤー/NPCトークンは updatePlayer で毎手番。 */
  private buildStatic(): void {
    const outdoors = this.isOutdoors();        // 里・森は草地、屋内/地下/遺構は石畳
    const floorFrame = outdoors ? RLT.grass : RLT.stone;
    const T = this.tile;
    const label = (x: number, y: number, text: string, color: string, dy = -0.42): void => {
      this.add.text(this.cx(x), this.cy(y) + T * dy, text, { fontFamily: 'sans-serif', fontSize: '13px', color }).setOrigin(0.5).setDepth(5);
    };

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = tileAt(this.map, x, y);
        addTile(this, this.cx(x), this.cy(y), floorFrame, T);             // 床は全マスに敷く
        if (t === '#') {
          addTile(this, this.cx(x), this.cy(y), outdoors ? RLT.tree : RLT.grave, T);  // 木の囲い／石壁
        } else if (t === 'H') {
          // 建物（屋根）。茶色のブロック＝家。
          this.add.rectangle(this.cx(x), this.cy(y), T, T, 0x8a5a3a).setStrokeStyle(2, 0x5a3a26).setDepth(2);
        } else if (t === 'C') {
          this.add.rectangle(this.cx(x), this.cy(y), T * 0.8, T * 0.8, 0x3a4660).setStrokeStyle(2, 0x6f86b0).setDepth(2); // 守り石の台座
        } else if (t === 'g' || t === 'd') {
          this.add.rectangle(this.cx(x), this.cy(y), T * 0.7, T * 0.86, 0x2a1c12).setStrokeStyle(2, 0xc8a060).setDepth(3); // 扉
          label(x, y, t === 'g' ? `${N.elder}の家` : '出る', '#ffd9a0', -0.55);
        } else if (t === 'E' || t === 'w' || t === 'e') {
          addTile(this, this.cx(x), this.cy(y), RLT.dirt, T);
          addTile(this, this.cx(x), this.cy(y - 0.02), RLT.sign, T * 0.9);
        } else if (t === 'B') {
          addTile(this, this.cx(x), this.cy(y), RLT.statue, T);           // 番獣の座
        } else if (t === 'O') {
          addTile(this, this.cx(x), this.cy(y), RLT.dirt, T);
          addTile(this, this.cx(x), this.cy(y - 0.02), RLT.sign, T * 0.9);
          label(x, y, 'この先へ', '#bfe6ff', -0.5);
        } else if (t === 'G' || t === 'N' || t === 'J' || t === 'M') {     // 旧式の文字NPC（underville 等）
          const nm = t === 'G' ? N.elder : t === 'N' ? N.friend : t === 'J' ? N.underElder : N.maker;
          label(x, y, nm, t === 'M' ? '#ffe0a0' : COLORS.dim);
          if (t === 'M') addTile(this, this.cx(x), this.cy(y + 0.34), RLT.crystal, T * 0.5);
        } else if (t === 'I' || t === 'W' || t === 'A') {
          addTile(this, this.cx(x), this.cy(y), RLT.crate, T);
          label(x, y, t === 'I' ? '道具屋' : t === 'W' ? '武器屋' : '防具屋', '#ffe0a0', -0.46);
        }
      }
    }

    // データNPCの名札＋露店の木箱（村・ガロの家）。
    for (const n of this.map.npcs ?? []) {
      const shop = n.kind === 'shopItem' || n.kind === 'shopWeapon' || n.kind === 'shopArmor';
      if (shop) addTile(this, this.cx(n.x), this.cy(n.y), RLT.crate, T * 0.92);
      label(n.x, n.y, n.name ?? '', shop ? '#ffe0a0' : COLORS.dim, -0.46);
    }

    // 装飾（データ駆動 or 旧マップのハードコード）。
    if (this.map.decor) {
      for (const d of this.map.decor) addTile(this, this.cx(d.x), this.cy(d.y), this.decorFrame(d.key), T * (d.scale ?? 1));
    } else if (this.map.id === 'path') {
      addTile(this, this.cx(7), this.cy(3), RLT.flowers, T);
      addTile(this, this.cx(3), this.cy(6), RLT.flowers, T);
      addTile(this, this.cx(11), this.cy(6), RLT.crate, T * 0.8);
    } else if (this.map.id === 'tunnels') {
      addTile(this, this.cx(7), this.cy(1), RLT.crystal, T * 0.6);
      addTile(this, this.cx(12), this.cy(7), RLT.crystal, T * 0.6);
      addTile(this, this.cx(3), this.cy(7), RLT.crystal, T * 0.5);
    } else if (this.map.id === 'underville') {
      addTile(this, this.cx(1), this.cy(1), RLT.crystal, T * 0.7);
      addTile(this, this.cx(11), this.cy(1), RLT.crystal, T * 0.7);
      addTile(this, this.cx(9), this.cy(3), RLT.crate, T * 0.85);
      addTile(this, this.cx(3), this.cy(5), RLT.crate, T * 0.85);
    } else if (this.map.id === 'ruin') {
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
    const rad = this.tokenRad();
    const token = (x: number, y: number, col: number): void => {
      g.fillStyle(col, 1).fillCircle(this.cx(x), this.cy(y), rad);
      g.lineStyle(2, 0x000000, 0.4).strokeCircle(this.cx(x), this.cy(y), rad);
    };
    // データNPC（村・ガロの家）。
    for (const n of this.map.npcs ?? []) token(n.x, n.y, n.color ?? 0xcfd8e0);
    // 旧式の文字NPC（underville 等）。
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = tileAt(this.map, x, y);
        if (t === 'G' || t === 'N' || t === 'J' || t === 'M') {
          token(x, y, t === 'G' ? 0xffd089 : t === 'N' ? 0x9ec5ff : t === 'J' ? 0xb0a0c0 : 0xffcf8a);
        }
      }
    }
    g.fillStyle(0x6fe3ff, 1).fillCircle(this.cx(this.px), this.cy(this.py), rad + 2);
    g.lineStyle(3, 0xffffff, 0.85).strokeCircle(this.cx(this.px), this.cy(this.py), rad + 2);
    if (this.scroll) this.cameras.main.centerOn(this.cx(this.px), this.cy(this.py)); // 大マップはプレイヤー追従
  }

  /** トークン半径（タイルが小さくても見やすいよう最小値を保証）。 */
  private tokenRad(): number { return Math.max(9, this.tile * 0.3); }

  private updateHud(): void {
    this.hud.setText(`${this.mapName()}  Lv.${game.level} HP${maxHp()} G${game.gold} 魔石${game.stones.length}   ${this.objective()}   [矢印]移動 [Z]調べる/話す [C]メニュー`);
  }
}
