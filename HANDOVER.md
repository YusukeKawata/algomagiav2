# HANDOVER — 作業再開の入口（v2）

> 最初に読むのはこのファイル。**いまの状態**と**次の一手**だけ把握できればよい。
> いま何を実装するかは [WORKPLAN.md](WORKPLAN.md)、基盤決定は [docs/adr/0001-v2-foundation.md](docs/adr/0001-v2-foundation.md)、世界観は [docs/design/world-bible.md](docs/design/world-bible.md)。

## このプロジェクトは何か（2026-06-19 新設）

旧プロジェクト `../20260608_algomagia`（v1・完成済みJRPG）から、共同設計してきた**世界観 v2**を**新規に作り直す**もの。
v2 がv1実装からズレすぎたため、混乱を避けて**殻（UI/物語/コンテンツ）をゼロから**作る。旧は**遊べるアーカイブとして温存**（参照可・改変しない）。

## いまの状態（結論）

**第1幕が通しで遊べ、磨き込んで「第2幕の参照テンプレ」にした。** `npm run dev`＝タイトル(はじめから/つづきから)→名前入力→霧の里(歩いて祖父ガロに会話→出口)→歌の遺構(歩く・徘徊石に遭遇戦→復帰・奥の番獣)→番獣戦→据炉で覚醒(Qの冷たい声・スキル解禁)→魔石盤の盤戦→旅立ち→第1幕おわり。
難易度=中間(負けたら戦闘リトライ)。**オートセーブは覚醒後(魔石装備後)のみ**＝データ奉納の伏線。playwright(`.claude/tmp/drive.cjs`)で**通しで TheEnd まで到達・pageエラーゼロ**を確認。

### 2026-06-19 後半に磨いたこと（テンプレ化）
- **共有UI層 `src/app/ui/`**（第2幕でも使い回す）: `dialogbox.ts`(会話箱＝枠+名前+1文字送り+点滅▼)／`typewriter.ts`／`fx.ts`(フェード遷移・ダメージポップ・フラッシュ・揺れ・ミュート表示)／`sfx.ts`(手続き合成SE・[M]ミュート/localStorage保存)。**演出=中間・音=SEのみ**（ponti選択）。
- **物理戦を core 化**: `core/phys.ts`（純関数・テスト）＋ `core/phys.test.ts`/`board-fight.test.ts` で**「番獣に素手で勝てる／awakened に盤で勝てる」をテストで証明**。
- **バランスバグ修正**: 旧番獣 hp34/atk6 は主人公が必ず先に倒れ**勝てない無限ループ**だった→ 中間難易度に調整（主人公HP30・番獣hp30/atk5＝5発でぎりぎり勝てる）。各戦闘は**開始時に全回復**。
- **盤戦の操作性**: 成立回路から**↑↓で選んで[F]で撃つ**（選択回路を白枠ハイライト＋出口側に一覧＋点灯パルス＋回路成立でチャイム/フラッシュ）。盤の駒形/初期配置は `game/data/boards.ts` に集約。
- **ソフトロック修正（重要）**: 勝利後フェード中の連打で `transitionTo` がフェードを再起動し続け永久に遷移しない事故 → `fx.ts`/`flow.advance` に**退場ガード**を実装。
- **dev限定 `window.__game`**(main.ts・本番ビルドでは剥がれる)＝目視スクリプトがシーン状態を読めるように。
- 規約は [docs/design/scene-template.md](docs/design/scene-template.md) に明文化。

- **core**: `board.ts`(回路判定・テスト8)／`battle.ts`(盤戦・テスト6)／`phys.ts`(物理戦・テスト6)／`board-fight.ts`テスト2／smoke1＝**計23緑**。
- **フロー**: `game/script.ts`(ACT1台本)＋`game/flow.ts`(beatを各シーンへ・退場ガード)＋`game/state.ts`＋`game/data/{names,enemies,maps,boards}.ts`。
- **シーン**: Title／Name／Story(会話＋覚醒の冷たい声)／Field(歩ける里/遺構)／Phys(物理戦)／Board(盤戦)／TheEnd。全シーンが共有UI(フェード/SE/ミュート)に乗る。
- typecheck/test(23)/build 緑。**戦闘/物理の数値は手書き暫定（data側で調整可・不変条件はテストが守る）**。`BootScene.ts` は未使用。
- **まだ無い**: 盤の成長(心域/演算)・複数盤・看破・精霊魔法・並列演算／第2幕以降(第二の里・魔石工房の集積UI)／アート(差し替え枠のみ)／**BGM**(SEは実装済)。

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

## 次にやること（候補・方式A＝小さい複数案→ponti が選ぶ）

第1幕の磨き込み（演出・手触り／バランス／盤の操作性／構造整理＝テンプレ化）は**ひと通り完了**。次は ponti と相談して選ぶ：

- **第2幕の入口に着手**（テンプレが固まったので本命）：第二の里(地中)・魔石工房の集積UI（盤に駒を恒久配置して育てる＝成長システム）。新シーンは [docs/design/scene-template.md](docs/design/scene-template.md) に乗せて増やす。
- **第1幕の残り磨き（任意）**：BGM（手続き合成・SEは実装済）／アート差し替え（立ち絵・背景＝素材待ち）／盤の成長(心域/演算で盤が広がる)・複数盤・看破の盤表現。
- **バランスの追い込み**：data側の数値（`enemies.ts`/`boards.ts`）で。不変条件は `core/*.test.ts` が守る。

着手前に読む: `docs/design/scene-template.md`（シーン/演出の規約）／`docs/design/magic-stone-workshop.md`（盤の正典）／`docs/adr/0001-v2-foundation.md`（基盤）。
ブラウザ目視は `.claude/tmp/drive.cjs`（dev限定 `window.__game` でシーン状態を読みながら駆動／chromium-1217 を executablePath・swiftshader 引数必須）。

## 再開のしかた
```
npm install        # 初回のみ（phaser / phaser4-rex-plugins 含む）
npm run test       # core 23件（board/battle/phys/board-fight/smoke）。緑を確認
npm run typecheck
npm run build
npm run dev        # 盤戦の操作: 数字=駒の形 / qwer=属性 / 左ｸﾘｯｸ=置く / 右ｸﾘｯｸ=消す / ↑↓=撃つ回路を選ぶ / [F]=撃つ / [M]=ミュート
```

## ブラウザでの実機確認（UI）
Phaser は WebGL＝ヘッドレスChromeは既定で黒画面。`.claude/tmp/shot.cjs`（playwright-core を npx キャッシュから require／
`executablePath` に既存 chromium-1217／`--use-angle=swiftshader` 等）で dev サーバを撮影→Read で目視。
雛形は `.claude/tmp/`（gitignore 済）。dev は `npm run dev -- --port 5188 --strictPort` で起動。

## 壊すと事故るもの（約束ごと）
- **ADR-0001 v2 が基盤**。二軸（自由意志/魔石）・テーマ＝設計契約（実ops縛りは無し）・乱数はシード付き。
- core は UI 非依存・テストで固める（v1 の良い規律は継承）。TS編集後は hooks が自動 typecheck。
- 旧プロジェクト `../20260608_algomagia` は改変しない（アーカイブ）。
