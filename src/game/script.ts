// 第1幕の台本（縦スライス）。タイトル→霧の里→歌の遺構→番獣→据炉で覚醒→盤戦→第2幕入口。
// プレイヤーには純ファンタジーとして提示（§8.7）。SF的真実（Q/exSQ/観測）は伏せ、据炉の冷たい声だけが裂け目。
import { NAMES } from '@game/data/names';

export interface Line { who: string; text: string }
export type Beat =
  | { kind: 'dialog'; lines: Line[] }
  | { kind: 'awaken' } // 据炉の覚醒（冷たいアナウンス＋初の代償）
  | { kind: 'battle'; mode: 'phys' | 'board'; enemyId: string; intro: string }
  | { kind: 'end' };

const N = NAMES;

export const ACT1: Beat[] = [
  {
    kind: 'dialog',
    lines: [
      { who: '', text: `深い霧と窪地が、${N.village}を魔物の目から遠ざけている。畑と狩りの、閉じているが温かい暮らし。` },
      { who: '', text: `だが里を守る「${N.wardStone}」の光が、近ごろ弱まっている。` },
      { who: N.elder, text: `…${N.heroDefault}。お前に頼みがある。${N.wardStone}が、もう保たん。` },
      { who: N.elder, text: `古い歌に言う——「強い魔物の体内には、大きな魔石がある」。${N.ruin}の奥に、ひときわ強いのが棲むそうだ。` },
      { who: N.elder, text: `そいつを狩り、大きな魔石を持ち帰れ。新しい${N.wardStone}にする。…お前なら動けるし、何より、決まりごとに収まらん奴だからな。` },
      { who: N.friend, text: `また無茶を…。気をつけてよ、${N.heroDefault}。あたしは里に残って、守りを見てる。` },
      { who: '', text: `（${N.ruin}へ向かった。）` },
    ],
  },
  { kind: 'battle', mode: 'phys', enemyId: 'mob1', intro: `${N.ruin}の入口。${N.mob}が道を塞ぐ。` },
  {
    kind: 'dialog',
    lines: [
      { who: '', text: `倒した魔物の体から、小さな魔石がこぼれ落ちた。` },
      { who: N.heroDefault, text: `（使い道はわからない。…でも、なぜか拾ってしまう。）` },
    ],
  },
  { kind: 'battle', mode: 'phys', enemyId: 'mob2', intro: `奥へ進む。古い紋様の走る${N.mob}がもう一体。` },
  {
    kind: 'dialog',
    lines: [
      { who: '', text: `遺構の最奥。淀んだ空気の中、巨大な影が身を起こす。` },
      { who: '', text: `${N.boss}——歌に伝わる、遺構の主。` },
    ],
  },
  { kind: 'battle', mode: 'phys', enemyId: 'boss', intro: `${N.boss}が立ちはだかる！` },
  {
    kind: 'dialog',
    lines: [
      { who: '', text: `番獣の核から、これまでで一番大きな魔石が現れた。両手にずしりと重い。` },
      { who: '', text: `里へ持ち帰り、${N.device}に据える。これを動かせば、新しい${N.wardStone}になるはず——。` },
      { who: N.heroDefault, text: `（${N.device}に触れる。冷たい。…石とは思えないほど。）` },
    ],
  },
  { kind: 'awaken' },
  {
    kind: 'dialog',
    lines: [
      { who: '', text: `——目を覚ますと、数日が経っていた。` },
      { who: N.friend, text: `よかった…！ ずっと、抜け殻みたいに寝込んでたのよ。${N.device}に触った途端に倒れて。` },
      { who: N.heroDefault, text: `（あの声。「Q」。「自由意志」。…何も分からない。でも、確かに“何か”が変わった。）` },
      { who: '', text: `不思議と、集めた魔石が手に馴染む。文様に意志を流せば——光が、つながる気がする。` },
    ],
  },
  { kind: 'battle', mode: 'board', enemyId: 'awakened', intro: `里の外れに${N.mob}が一体。今の自分なら——魔石盤で、撃てる。` },
  {
    kind: 'dialog',
    lines: [
      { who: '', text: `${N.wardStone}は新しい魔石で息を吹き返し、里はまた霧に沈んだ。` },
      { who: N.heroDefault, text: `（でも——${N.device}は他にも“座標”を記録していた。よその、隠れた里。…「Q」って、なんだ？）` },
      { who: N.friend, text: `行くんだね。…うん、あんたはそういう奴だ。里は守る。だから、ちゃんと帰ってきて。` },
      { who: '', text: `問い癖に引かれ、${N.heroDefault}は単身、谷を出た。——第2幕へ つづく。` },
    ],
  },
  { kind: 'end' },
];
