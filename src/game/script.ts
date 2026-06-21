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
      { who: N.friend, text: `${N.heroDefault}、起きてる？ おじいさんが呼んでたよ。家で待ってる。…守り石のこと、相談したいって。` },
      { who: N.heroDefault, text: `（また石のことか。…でも、ニナがこんな顔をするのは珍しい。）` },
      { who: '', text: `（里を歩き、${N.elder}の家[g]へ。隣で[Z]＝会話/調べる・露店を開く。[C]＝メニュー。建物や門は扉で出入りできる。）` },
    ],
  },
  { kind: 'field', mapId: 'village' },
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
      { who: N.heroDefault, text: `（やった…。これを持ち帰れば、守り石はまた灯る。）` },
      { who: N.heroDefault, text: `（…まずは里へ。ガロに、無事を知らせなくては。ニナにも。）` },
    ],
  },
  // 〔Task9〕直接据炉に据えるのは不自然＝一度里へ帰り、ガロに報告→「ついてこい」で据炉へ案内される。
  { kind: 'field', mapId: 'village' },
  {
    kind: 'dialog',
    bg: 'awaken',
    lines: [
      { who: N.elder, text: `里の外れの「${N.device}」。…わしも、仕組みは知らん。だが古い言い伝えに、ここへ大きな石をくべよと。` },
      { who: N.elder, text: `お前にしか頼めん。…この石を、据炉にくべてくれ。` },
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
      { who: '', text: `手ほどき：フィールドで [C] を押すと「魔石盤」を開ける。いまの盤は 1×1 ——魔石を1つだけ嵌められる。` },
      { who: '', text: `ガロにもらった「─（物理）」の魔石を盤に置こう。左端から右端へ光がつながれば、撃てる「スキル」が1本できる。` },
      { who: '', text: `文様は変えられない。ドロップした魔石をやりくりし、敵の弱点に合う一枚を選んで嵌める——それが盤の戦い方だ。` },
      { who: '', text: `（強くなる＝レベルが上がるたび、魔石盤も1段ずつ広がる。戦って盤を育て、長い回路や複数のスキルを組めるようになる。）` },
      { who: '', text: `戦闘はコマンド制：こうげき(武器)／スキル(回路)／どうぐ／みやぶる(予測防御)。スキルは自由意志を消費する。` },
      { who: N.friend, text: `番獣の魔石で守り石は灯った。でも里の外れに、また魔物が…。準備ができたら南の出口へ。あたしは見てる。` },
      { who: '', text: `（[C]で魔石盤に魔石を嵌め、店で装備を整えてから、南の出口[E]へ。準備ができたら、だ。）` },
    ],
  },
  { kind: 'field', mapId: 'village' },
  { kind: 'battle', mode: 'board', enemyId: 'awakened', intro: `${N.mob}が一体。魔石盤で迎え撃つ。` },
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
      { who: '', text: `問い癖に引かれ、${N.heroDefault}は単身、谷を出た。${N.device}が記録していた“座標”——もう一つの隠れ里へ。` },
    ],
  },
  // —— 第2幕の入口：地中の里（§8.9） ——
  {
    kind: 'dialog',
    bg: 'under',
    lines: [
      { who: '', text: `座標は、岩山の裂け目の奥を指していた。崩れた坑道を、地の底へ下りていく。` },
      { who: '', text: `霧ではなく、土と岩が「あの目」を遮る——別のやり方で、ここも観測の死角に隠れている。` },
      { who: N.heroDefault, text: `（壁に、結晶が埋もれて燐光を放っている。…守り石と、同じ匂いだ。）` },
      { who: '', text: `坑道には魔物が徘徊している。属性の攻撃を使う個体もいる——[C]で防具を、敵に合わせて選べ。` },
      { who: '', text: `（東へ抜ければ、里があるはずだ。東口[e]を目指そう。）` },
    ],
  },
  { kind: 'field', mapId: 'tunnels' },
  {
    kind: 'dialog',
    bg: 'under',
    lines: [
      { who: '', text: `坑道を抜けると、地下の空洞に灯りが灯る集落があった——${N.underville}。自分たちだけじゃ、なかった。` },
      { who: N.underElder, text: `（里長タルゴは警戒の目を向ける。）…刺激するな。隠れて生きろ。それが我らの掟だ。` },
      { who: N.maker, text: `（石工リーゼだけは、にやりと笑った。）面白い魔石を持ってるね。…ちょっと工房を見ていきな。` },
      { who: '', text: `${N.maker}[M]で「${N.workshop}」が開ける（集積＝魔石の強化・属性うつし）。盤も広がり、回復魔法の入口も。` },
      { who: '', text: `（里を歩き、リーゼ[M]・タルゴ[J]と話そう。支度ができたら、この先へ[O]。——第2幕へ つづく。）` },
    ],
  },
  { kind: 'end' },
];
