# HANDOVER — 作業再開の入口（v2）

> 最初に読むのはこのファイル。**いまの状態**と**次の一手**だけ把握できればよい。
> いま何を実装するかは [WORKPLAN.md](WORKPLAN.md)、基盤決定は [docs/adr/0001-v2-foundation.md](docs/adr/0001-v2-foundation.md)、世界観は [docs/design/world-bible.md](docs/design/world-bible.md)。

## このプロジェクトは何か（2026-06-19 新設）

旧プロジェクト `../20260608_algomagia`（v1・完成済みJRPG）から、共同設計してきた**世界観 v2**を**新規に作り直す**もの。
v2 がv1実装からズレすぎたため、混乱を避けて**殻（UI/物語/コンテンツ）をゼロから**作る。旧は**遊べるアーカイブとして温存**（参照可・改変しない）。

## いまの状態（結論）

**第1幕が歩いて・戦って・覚醒して・盤戦して通しで遊べる。** `npm run dev`＝タイトル(はじめから/つづきから)→名前入力→霧の里(歩いて祖父ガロに会話→出口)→歌の遺構(歩く・徘徊石に遭遇戦→復帰・奥の番獣)→番獣戦→据炉で覚醒(Qの冷たい声・スキル解禁)→魔石盤の盤戦→旅立ち→第1幕おわり。
難易度=中間(負けたら戦闘リトライ)。**オートセーブは覚醒後(魔石装備後)のみ**＝データ奉納の伏線。playwrightで通し/フィールド/title→name を確認＝pageエラーゼロ。
- **core**: `board.ts`(回路判定＋属性組成→元素・テスト8)／`battle.ts`(自由意志コスト=石数・ダメージ=強さ・弱点×2・自由意志0で敗北・テスト6)。
- **フロー**: `game/script.ts`(ACT1台本)＋`game/flow.ts`(beatを各シーンへ)＋`game/state.ts`(game状態)＋`game/data/{names,enemies}.ts`。
- **シーン**: Title／Story(会話＋覚醒の冷たい声)／Phys(物理戦・なぐる・魔石drop)／Board(盤戦・フロー接続)／TheEnd。
- typecheck/test(15)/build 緑。**戦闘/物理の数値は手書き暫定（調整可）**。`BootScene.ts` は未使用。
- **済**: フィールド移動(FieldScene)／セーブ・ロード(save.ts・覚醒後のみ)／名前入力(NameEntryScene)。
- **まだ無い**: 盤の成長(心域/演算)・複数盤・看破・精霊魔法・並列演算／第2幕以降(第二の里・魔石工房の集積UI)／アート(差し替え枠のみ)／BGM/SE。

ロックした基盤決定（詳細 [ADR-0001](docs/adr/0001-v2-foundation.md)）:
- **ジャンル**＝ノベルRPG（RPG主体・テキスト多め）。
- **技術**＝Phaser 4 + Vite + TS + Vitest（v1 継続。Ren'Py/RPG Maker MZ は不採用）。
- **テーマ**＝中間（設計契約）。**実計算量(ops)→コストの縛りは撤廃**。最適化＝より安い手書きバリアントへの差し替え＝「出力不変・コスト減」は設計契約。
- **二軸ステータス**＝キャラ:自由意志（燃料）／魔石(装備):演算・心域・霊脈。
- **残す概念**＝習得/解析/最適化/看破。

## salvage したもの / しなかったもの
- **した（content-free）**: package.json/tsconfig/vite.config/index.html/.gitignore・`.claude/hooks/typecheck.mjs`＋settings・Phaser 起動の最小骨組み。
- **しなかった（v1コンテンツ）**: core 機構 M1〜M7・敵/マップ/戦闘経済・各シーン・scenario.test。必要時に旧リポを参照して作り直す。
- **コピーした設計ドキュメント**: world-bible.md（旧 world-bible-v2-draft）／game-design-philosophy.md／skill-concept.md／ux-node-editor.md／ADR-0002 LEGACY。

## 次にやること（次セッションの主タスク＝ponti 指定）

**第1幕のクオリティを上げ、「第2幕以降の実装が参照できるテンプレ」にする。** 第2幕の新規実装に入る前に、いま動く第1幕（タイトル→里→遺構→覚醒→盤戦→第1幕おわり）を磨いて"お手本"にするのが狙い。具体的な磨きどころ（着手時に方式A＝小さい複数案→ponti が選ぶ）:

1. **演出・手触り**：会話の文字送り（1文字ずつ表示）／戦闘のダメージ数字ポップ・弱点演出／盤の点灯アニメ／画面遷移フェード。
2. **戦闘バランス**：物理戦/盤戦の手書き数値（コスト=石数・ダメージ=強さ・弱点×2・敵atk）を実プレイで調整し、"気持ちよく勝てるが歯ごたえあり"に。
3. **盤の操作性**：駒の選択/配置UIをマウス＋キーで分かりやすく（今はクリック+数字/qwer）。回路が成立した瞬間のフィードバック。
4. **コード/構造の整理**：第2幕でそのまま増やせるよう、シーン/フロー/データ(script・enemies・maps)の規約を固める（=テンプレ化）。各シーンの責務・命名・即時描画の作法を docs/design に追記。
5. **音**：手続き合成のBGM/SE（任意・後でも可）。

着手前に読む: `WORKPLAN.md`（自走で実装済みリスト）／`docs/design/magic-stone-workshop.md`（盤の正典）／`docs/adr/0001-v2-foundation.md`（基盤）。
ブラウザ目視は `.claude/tmp/*.cjs`（chromium-1217 を executablePath・swiftshader 引数必須）。

**まだ着手しない（第1幕が磨けてから）**: 第2幕(第二の里・魔石工房の集積UI)・盤の成長(心域/演算)・看破・精霊魔法・並列演算。アートは差し替え枠のみ（素材待ち）。

## 再開のしかた
```
npm install        # 初回のみ（phaser / phaser4-rex-plugins 含む）
npm run test       # board 6件＋smoke。緑を確認
npm run typecheck
npm run build
npm run dev        # ブラウザで 魔石盤（BoardScene）を操作（数字=駒選択/左クリック=置く/右クリック=消す）
```

## ブラウザでの実機確認（UI）
Phaser は WebGL＝ヘッドレスChromeは既定で黒画面。`.claude/tmp/shot.cjs`（playwright-core を npx キャッシュから require／
`executablePath` に既存 chromium-1217／`--use-angle=swiftshader` 等）で dev サーバを撮影→Read で目視。
雛形は `.claude/tmp/`（gitignore 済）。dev は `npm run dev -- --port 5188 --strictPort` で起動。

## 壊すと事故るもの（約束ごと）
- **ADR-0001 v2 が基盤**。二軸（自由意志/魔石）・テーマ＝設計契約（実ops縛りは無し）・乱数はシード付き。
- core は UI 非依存・テストで固める（v1 の良い規律は継承）。TS編集後は hooks が自動 typecheck。
- 旧プロジェクト `../20260608_algomagia` は改変しない（アーカイブ）。
