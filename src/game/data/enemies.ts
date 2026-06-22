// 敵データ（第1幕スライス）。ターン制戦闘（core/combat）で使う統一モデル。
// ⚠ 名前はモンスターらしく（敵＝exSQ排斥プログラムという正体は物語で明かす伏せ事実）。
//   ドロップ品が「魔石」なので、敵名に「石」は付けない。
import type { Attr } from '@core/board';
import { NAMES } from '@game/data/names';

// hp/atk＝戦闘の体力と攻撃。weakness＝弱点属性（その元素スキルで2倍）。
// gold＝撃破で得る通貨。pool＝魔石ドロップ抽選（stones.ts STONE_POOLS）。color＝トークン色。
// bigEvery>0＝強敵の「ためる→大攻撃」周期（看破=みやぶる で受け流せる予測防御の見せ場）。
// atkAttr＝通常攻撃の属性（防具の属性耐性が効く）／bigAttr＝大攻撃の属性（既定=atkAttr）／multi＝連撃数（群れ/速い敵）。
export interface Enemy {
  id: string; name: string; hp: number; atk: number; weakness: Attr; gold: number; pool: string; xp: number;
  color?: number; bigEvery?: number; atkAttr?: Attr; bigAttr?: Attr; multi?: number;
}

// 旧シーン/テスト互換のエイリアス（統一後も型名を温存）。
export type PhysEnemy = Enemy;
export type BoardEnemy = Enemy;

// レベル1基準火力（バランス不変条件 core/phys.test.ts 用）。実戦は state.heroAtk()。
export const PHYS_POWER = 6;

// 中間難易度: 各戦闘は開始時に全回復。奥へ進むほど手強い。color は人物アートが無い間のトークン色。
export const ENEMIES: Record<string, Enemy> = {
  // 道中/遺構の魔物（覚醒前は素手＝物理で戦う。覚醒前は防具に属性耐性が無いので属性は演出寄り）。
  mob1:     { id: 'mob1',     name: '霧狼',     hp: 10, atk: 3, weakness: 'fire',    gold: 3,  pool: 'weak',   xp: 3,  color: 0x8a7d5a },
  mob2:     { id: 'mob2',     name: '群れ狼',   hp: 14, atk: 3, weakness: 'fire',    gold: 4,  pool: 'weak',   xp: 4,  color: 0x9a6a4a, multi: 2 }, // 群れ＝二連撃
  gnawer:   { id: 'gnawer',   name: '岩噛み',   hp: 18, atk: 4, weakness: 'thunder', gold: 6,  pool: 'mid',    xp: 6,  color: 0x6a8a5a },
  shade:    { id: 'shade',    name: '淀みの影', hp: 16, atk: 6, weakness: 'fire',    gold: 7,  pool: 'mid',    xp: 7,  color: 0x4a4a6a, atkAttr: 'ice' },
  sentinel: { id: 'sentinel', name: '双角獣',   hp: 24, atk: 5, weakness: 'ice',     gold: 10, pool: 'mid',    xp: 9,  color: 0x7a5a8a, bigEvery: 4 },
  // 番獣（初ボス）。無対策（L1素手）だと負ける＝中の上。到達Lv(L2でギリ／L3で安定)＋リトライ全回復で勝てる（autoWinnable）。
  // 高い atk と「ためる→大攻撃(×2)」が脅威＝みやぶる/装備/レベルで備える設計。HP消耗で突入するとまず負ける。
  boss:     { id: 'boss',     name: NAMES.boss, hp: 40, atk: 8, weakness: 'ice',     gold: 36, pool: 'strong', xp: 16, color: 0xb0405a, bigEvery: 3 },
  // 覚醒後の盤戦で出る、弱点ちがいの魔物（入門=炎弱点）。属性攻撃＝防具の属性耐性で受けを変えられる。
  awakened: { id: 'awakened', name: '霧狼',     hp: 24, atk: 4, weakness: 'fire',    gold: 8,  pool: 'mid',    xp: 8,  color: 0xff7043, atkAttr: 'fire' },
  frost:    { id: 'frost',    name: '氷狼',     hp: 30, atk: 5, weakness: 'fire',    gold: 12, pool: 'strong', xp: 11, color: 0x4fc3f7, bigEvery: 4, atkAttr: 'ice', bigAttr: 'ice' },
  spark:    { id: 'spark',    name: '雷甲虫',   hp: 28, atk: 4, weakness: 'wind',    gold: 12, pool: 'mid',    xp: 11, color: 0xffd54f, atkAttr: 'thunder', multi: 2 }, // 帯電の二連撃
  gale:     { id: 'gale',     name: '疾風鳥',   hp: 32, atk: 6, weakness: 'thunder', gold: 14, pool: 'strong', xp: 12, color: 0x81c784, bigEvery: 3, atkAttr: 'wind', bigAttr: 'wind' },
  // 第2幕・地中の里 周辺の魔物（やや手強い・属性持ち）。
  burrower: { id: 'burrower', name: '地這い',   hp: 30, atk: 6, weakness: 'thunder', gold: 16, pool: 'strong', xp: 13, color: 0x8d6e63, atkAttr: 'physical' },
  drifter:  { id: 'drifter',  name: '燐光虫',   hp: 34, atk: 5, weakness: 'ice',     gold: 18, pool: 'strong', xp: 15, color: 0x7e57c2, bigEvery: 4, atkAttr: 'fire', bigAttr: 'fire' },
  // —— 旅の地表（覚醒後）。地方ごとに固有・強さ固定（レベルスケールはしない＝同名の敵が強くなるバグを撤廃）。 ——
  // 草原（里のすぐ外・軽め）。
  grazer:    { id: 'grazer',    name: '草喰み',   hp: 22, atk: 4, weakness: 'ice',     gold: 9,  pool: 'mid',    xp: 9,  color: 0x9ab36a, atkAttr: 'physical' },
  razorbeak: { id: 'razorbeak', name: '裂き鳥',   hp: 26, atk: 5, weakness: 'thunder', gold: 12, pool: 'mid',    xp: 11, color: 0xb0a0c8, atkAttr: 'wind' },
  // 丘陵（中くらい）。
  gorehoof:  { id: 'gorehoof',  name: '角猪',     hp: 28, atk: 6, weakness: 'thunder', gold: 13, pool: 'mid',    xp: 12, color: 0x9a7048, atkAttr: 'physical' },
  emberhound:{ id: 'emberhound',name: '熾火犬',   hp: 30, atk: 5, weakness: 'ice',     gold: 14, pool: 'strong', xp: 12, color: 0xe06a3a, bigEvery: 4, atkAttr: 'fire', bigAttr: 'fire' },
  // 涸れ谷／荒野（手強い）。
  dunecrawler:{id: 'dunecrawler',name:'砂潜り',   hp: 32, atk: 5, weakness: 'thunder', gold: 15, pool: 'strong', xp: 13, color: 0xc8a86a, atkAttr: 'physical', multi: 2 },
  mirage:    { id: 'mirage',    name: '陽炎',     hp: 28, atk: 6, weakness: 'fire',    gold: 16, pool: 'strong', xp: 14, color: 0x6ac0c8, bigEvery: 4, atkAttr: 'ice', bigAttr: 'ice' },
  // 山道の関（旅の最難所・さらに手強い）。
  cragmaw:   { id: 'cragmaw',   name: '岩牙',     hp: 40, atk: 7, weakness: 'ice',     gold: 20, pool: 'strong', xp: 17, color: 0x8a8a96, bigEvery: 3, atkAttr: 'physical', bigAttr: 'physical' },
  galeling:  { id: 'galeling',  name: '風鳴き',   hp: 36, atk: 6, weakness: 'thunder', gold: 19, pool: 'strong', xp: 16, color: 0x7ec890, bigEvery: 4, atkAttr: 'wind', bigAttr: 'wind' },
  // —— 任意の隠しダンジョン「忘れられた狩り場」。徘徊する手強い魔物＋最奥の任意ボス。 ——
  stalker:   { id: 'stalker',   name: '影狩り',   hp: 34, atk: 6, weakness: 'fire',    gold: 18, pool: 'strong', xp: 15, color: 0x52506a, atkAttr: 'physical', multi: 2 },
  hexbeetle: { id: 'hexbeetle', name: '呪甲虫',   hp: 38, atk: 6, weakness: 'wind',    gold: 20, pool: 'strong', xp: 16, color: 0x7acf5a, bigEvery: 4, atkAttr: 'thunder', bigAttr: 'thunder' },
  // 任意ボス（強いが任意＝倒さなくても進める）。倒すと大きな報酬＋良い魔石。早すぎると勝てず、育てば(L7+)倒せる。
  ravager:   { id: 'ravager',   name: '狩り場の主', hp: 72, atk: 10, weakness: 'ice',   gold: 90, pool: 'strong', xp: 36, color: 0x9a3050, bigEvery: 3, atkAttr: 'physical', bigAttr: 'physical' },
};

// 旧名アクセスの互換エイリアス（同一データ）。
export const PHYS_ENEMIES = ENEMIES;
export const BOARD_ENEMIES = ENEMIES;

// 遺構の遭遇テーブル（弱い順）。奥へ進むほど後ろの敵が出る（FieldScene が深さで選ぶ）。
export const RUIN_ENCOUNTERS: string[] = ['mob1', 'mob2', 'gnawer', 'shade', 'sentinel'];

// 森の小道の遭遇（里→遺構の道中・軽め）。
export const PATH_ENCOUNTERS: string[] = ['mob1', 'mob1', 'mob2'];

// 地中の里 周辺の遭遇（第2幕・属性持ちでやや手強い）。
export const UNDER_ENCOUNTERS: string[] = ['burrower', 'drifter'];

// 旅の地表＝地方ごとの遭遇テーブル（強さは地方で固定＝レベルスケールしない）。手前ほど弱い順に並べ、
// 遭遇回数の深さで後ろの個体も出る（同じ地方の中での軽い変化）。
export const WORLD_ENCOUNTERS: string[]   = ['grazer', 'razorbeak'];                // 草原（軽い）
export const HILLS_ENCOUNTERS: string[]   = ['razorbeak', 'gorehoof', 'emberhound']; // 丘陵（中）
export const BARRENS_ENCOUNTERS: string[] = ['dunecrawler', 'mirage', 'emberhound']; // 荒野（強い）
export const PASS_ENCOUNTERS: string[]    = ['galeling', 'cragmaw'];                 // 山道の関（最難所）

// 任意の隠しダンジョン「忘れられた狩り場」の遭遇（手強い）。
export const WILDS_ENCOUNTERS: string[] = ['stalker', 'hexbeetle', 'emberhound'];

// マップID→遭遇テーブル。歩いて遭遇する“危険な”フィールドだけ登録する。
// ※ 地中の里(underville)は安全な拠点＝遭遇させない。魔物が徘徊するのは坑道(tunnels)。
export const ENCOUNTER_POOLS: Record<string, string[]> = {
  path: PATH_ENCOUNTERS,
  ruin: RUIN_ENCOUNTERS,
  tunnels: UNDER_ENCOUNTERS,
  world: WORLD_ENCOUNTERS,
  hills: HILLS_ENCOUNTERS,
  barrens: BARRENS_ENCOUNTERS,
  pass: PASS_ENCOUNTERS,
  wilds: WILDS_ENCOUNTERS,
};
