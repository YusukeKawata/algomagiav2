// 第1幕の台本（縦スライス）。タイトル→霧の里→歌の遺構→番獣→据炉で覚醒→盤戦→第2幕入口。
// プレイヤーには純ファンタジーとして提示（§8.7）。SF的真実（Q/exSQ/観測）は伏せ、据炉の冷たい声だけが裂け目。
import { NAMES } from '@game/data/names';

export interface Line { who: string; text: string }
// bg は手続き背景の種類（src/app/ui/bg.ts の SceneArt）。app へ依存しないよう string で持つ。
export type Beat =
  | { kind: 'dialog'; lines: Line[]; bg?: string }
  | { kind: 'field'; mapId: string } // 歩けるマップ（探索・会話・遭遇）
  | { kind: 'awaken' } // 据炉の覚醒（冷たいアナウンス＋初の代償）
  | { kind: 'battle'; mode: 'phys' | 'board'; enemyId: string; intro: string }
  | { kind: 'end' };

const N = NAMES;

export const ACT1: Beat[] = [
  {
    kind: 'dialog',
    bg: 'village',
    lines: [
      { who: '', text: `深い霧と窪地が、${N.village}を魔物の目から遠ざけている。畑と狩りの、閉じているが温かい暮らし。` },
      { who: '', text: `里の中心には「${N.wardStone}」。代々、魔物を退ける光を放ってきた古い石だ。` },
      { who: '', text: `——だがこのところ、その光が目に見えて弱い。霧が薄れ、魔物の影が谷のふちに増えてきた。` },
      { who: N.friend, text: `${N.heroDefault}、起きてる？ おじいさんが呼んでたよ。…守り石のこと、相談したいって。` },
      { who: N.heroDefault, text: `（また石のことか。…でも、ニナがこんな顔をするのは珍しい。）` },
      { who: '', text: `（里を歩き、${N.elder}に話を聞こう。NPCには隣で[Z]。）` },
    ],
  },
  { kind: 'field', mapId: 'village' },
  { kind: 'field', mapId: 'path' },
  { kind: 'field', mapId: 'ruin' },
  {
    kind: 'dialog',
    bg: 'phys',
    lines: [
      { who: '', text: `遺構の最奥。淀んだ空気の中、巨大な影が身を起こす。` },
      { who: '', text: `${N.boss}——歌に伝わる、遺構の主。` },
      { who: N.heroDefault, text: `（道中で拾った小さな魔石が、ポケットで重い。…使い道は、まだ分からない。）` },
    ],
  },
  { kind: 'battle', mode: 'phys', enemyId: 'boss', intro: `${N.boss}が立ちはだかる！` },
  {
    kind: 'dialog',
    bg: 'ruin',
    lines: [
      { who: '', text: `番獣の核から、これまでで一番大きな魔石が現れた。両手にずしりと重い。` },
      { who: '', text: `里へ持ち帰り、${N.device}に据える。これを動かせば、新しい${N.wardStone}になるはず——。` },
      { who: N.heroDefault, text: `（${N.device}に触れる。冷たい。…石とは思えないほど。）` },
    ],
  },
  { kind: 'awaken' },
  {
    kind: 'dialog',
    bg: 'village',
    lines: [
      { who: '', text: `——目を覚ますと、数日が経っていた。` },
      { who: N.friend, text: `よかった…！ ずっと、抜け殻みたいに寝込んでたのよ。${N.device}に触った途端に倒れて。` },
      { who: N.heroDefault, text: `（あの声。「Q」。「自由意志」。…何も分からない。でも、確かに“何か”が変わった。）` },
      { who: '', text: `不思議と、集めた魔石が手に馴染む。文様に意志を流せば——光が、つながる気がする。` },
    ],
  },
  {
    kind: 'dialog',
    bg: 'village',
    lines: [
      { who: N.heroDefault, text: `（集めた魔石に意志を流すと、文様に沿って光が走る。これが——「回路」。）` },
      { who: '', text: `魔石盤の手ほどき：駒は数字キーで形を選び、qwerで属性、左クリックで置く（右クリックで消す）。` },
      { who: '', text: `左端から右端まで光が一本につながれば、それが撃てる「スキル」。↑↓で撃つ回路を選び、[F]で放つ。` },
      { who: '', text: `自由意志を燃やして撃つ。撃つほど自由意志は減り、尽きれば無気力——だが今は、試してみるしかない。` },
      { who: N.friend, text: `里の外れに魔物。…${N.heroDefault}、新しい力、見せてよ。` },
    ],
  },
  { kind: 'battle', mode: 'board', enemyId: 'awakened', intro: `${N.mob}が一体。魔石盤で迎え撃つ——[F]で撃て。` },
  {
    kind: 'dialog',
    bg: 'board',
    lines: [
      { who: N.heroDefault, text: `（撃てた。…体の芯から何かを差し出している感覚。けれど、確かに“届く”。）` },
      { who: '', text: `戦うたび、魔石が手に馴染んでいく。意志は太く、文様は澄んでいく——これが「強くなる」ということか。` },
      { who: '', text: `霧の薄れた谷ぐちから、もう一体。さっきより硬い殻をまとっている。` },
    ],
  },
  { kind: 'battle', mode: 'board', enemyId: 'frost', intro: `凍てついた殻の端末。さっきの回路で押し切れるか——[F]。` },
  {
    kind: 'dialog',
    bg: 'depart',
    lines: [
      { who: '', text: `二体を退け、新しい魔石を${N.wardStone}に据えると、光は息を吹き返し、里はまた深い霧に沈んだ。` },
      { who: N.elder, text: `よくやった。…だがな、${N.heroDefault}。守り石が弱るのは、これが最後ではあるまい。` },
      { who: N.heroDefault, text: `（それに——${N.device}は他にも“座標”を記録していた。よその、隠れた里。…「Q」。あの声は、なんだったんだ？）` },
      { who: N.friend, text: `行くんだね。…うん、あんたはそういう奴だ。里は守る。だから、ちゃんと帰ってきて。` },
      { who: '', text: `問い癖に引かれ、${N.heroDefault}は単身、谷を出た。——第2幕へ つづく。` },
    ],
  },
  { kind: 'end' },
];
