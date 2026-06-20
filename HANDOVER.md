# HANDOVER — 作業再開の入口（v2）

> 最初に読むのはこのファイル。**いまの状態**と**次の一手**だけ把握できればよい。
> いま何を実装するかは [WORKPLAN.md](WORKPLAN.md)、基盤決定は [docs/adr/0001-v2-foundation.md](docs/adr/0001-v2-foundation.md)、世界観は [docs/design/world-bible.md](docs/design/world-bible.md)。

## このプロジェクトは何か（2026-06-19 新設）

旧プロジェクト `../20260608_algomagia`（v1・完成済みJRPG）から、共同設計してきた**世界観 v2**を**新規に作り直す**もの。
v2 がv1実装からズレすぎたため、混乱を避けて**殻（UI/物語/コンテンツ）をゼロから**作る。旧は**遊べるアーカイブとして温存**（参照可・改変しない）。

## いまの状態（結論）

**第1幕が通しで遊べ、RPGとして肉付け済み（成長・戦闘量・物語量・探索）。** `npm run dev`＝タイトル(はじめから/つづきから)→名前入力→**霧の里**(歩いて祖父ガロに会話＝クエスト／NPC会話・調べる)→**森の小道**(道中・軽い遭遇)→**歌の遺構**(柱廊を歩く・奥ほど強い徘徊石に遭遇戦・調べる・一度きりの魔石拾得・最奥の番獣)→**番獣戦**(物理)→据炉で**覚醒**(Qの冷たい声・スキル解禁)→魔石盤の**盤戦2連戦**(awakened→frost)→旅立ち→第1幕おわり。
**敵を倒すとXPでレベルアップ**し HP/物理火力/自由意志が伸びる（通しで L1→L5）。難易度=中間(負けたら戦闘リトライ・各戦闘で全回復)。**オートセーブは覚醒後(魔石装備後)のみ**＝データ奉納の伏線。
**背景＝手続き生成(`bg.ts`)／フィールド＝Kenneyタイル(`tiles.ts`)**。人物は色トークン（立ち絵素材は未供給）。
通しは `.claude/tmp/autoplay.cjs`（dev限定 `window.__game`/`__state`/`__flow` を読みつつBFS+anti-stuckで自動操作）で **TheEnd到達・戦闘10回・pageエラーゼロ**を確認。core 44テスト/typecheck/build 緑。

### 2026-06-20 探索拡張（森の小道＋調べる）
- **新エリア「森の小道」**：里→遺構の道中マップ `path`（15×9・木の柵）。`script.ts` に field beat を挿入。軽い遭遇（`PATH_ENCOUNTERS`）。遭遇は `ENCOUNTER_POOLS`（mapId→敵表）で汎用化。
- **「調べる」システム**：プロップに重なる `EXAMINES`（里/小道/遺構）を [Z] で読める＝世界観の小出し。遺構に**一度きりの魔石拾得**（flagで重複防止・魔石+経験）。
- 通しは village→path(遭遇)→ruin(遭遇)→番獣→覚醒→盤2連戦→TheEnd＝**戦闘10・L1→L5**、pageエラー0（`autoplay.cjs`・anti-stuck付き）。
- core 44緑／typecheck／build 緑。

### 2026-06-20 RPG肉付け（成長・戦闘量・物語量）＋重要バグ修正
- **成長システム `src/core/progress.ts`（+テスト14）**：敵撃破でXP→レベルアップ→hpMax/物理火力/freeWillMax が単調増加（L1は従来値＝既存バランステスト維持）。GameStateに level/xp、`grantXp()`/`physPower()`。レベルアップで全回復＋ポップ演出。Phys/Board/Field HUD に Lv 表示。通しで L1→L5（HP30→62・自由意志24→36）を確認。
- **モンスター多様化＋戦闘量 `enemies.ts`**：徘徊石/群/石喰い/淀みの影/番い石＋番獣、盤敵に凍てつき/帯電/荒風端末。`RUIN_ENCOUNTERS` を奥ほど強い敵で抽選（`core/rng.ts` シード付き・+テスト5）。遺構の遭遇 ENC_MAX=4。物理戦の敵トークンは種類色。
- **物語量＋探索 `script.ts`/`FieldScene`**：導入/覚醒後の手ほどき/2戦目前/旅立ちを加筆、祖父ガロ・ニナの会話を状況分岐で拡充。盤戦を2連戦化（awakened→frost）。遺構マップを 17×11 の柱廊に拡大（タイル寸法は動的算出）。
- **重要バグ修正（全プレイヤー影響）**：`transitionTo` が data 未指定だと Phaser が前回 start の data を使い回し、**ボス戦(beat4)が直前の遭遇敵(mob)として起動**していた（番獣が出ず経験/ドロップも誤り）。`scene.start(key, data ?? {})` で根治。flow index トレースで特定。
- **dev計測補助**：`window.__state`/`window.__flow`（flowIndex）公開。通しは `.claude/tmp/autoplay.cjs`（BFSで自動操作・シーン/beat/stats をトレース、pageエラー0）。
- core テスト計44緑（progress14・rng5・board8・battle6・phys6・board-fight4・smoke1）／typecheck／build 緑。

### 2026-06-20 アセット導入（手続き背景＋Kenneyタイル）
- **手続き生成背景 `src/app/ui/bg.ts`**：全シーンの単色矩形を `paintScene(this, kind)` に置換（`title/village/ruin/phys/awaken/board/depart/end`）。グラデ＋霧/星/シルエット/光/裂け目/魔法陣/ビネット。配置はシード付き乱数で決定論、動きは tween。素材不要。
- **Kenney Roguelike/RPG パック（CC0）でフィールドをタイル化**：里＝草地＋森の囲い＋守り石(青水晶)＋花/木箱、遺構＝石畳＋墓石の壁＋枯れ木/髑髏＋番獣の座(石像)。`FieldScene` を「静的タイルを一度敷く＋プレイヤートークンだけ毎手番動かす」構造に作り替え。
- **アセット基盤**：`PreloadScene`（最初のシーンで一括ロード）＋`src/app/ui/tiles.ts`（`addTile`/`TILE.*`、シート＝16px・spacing1）＋`pixelArt:true`。配信用＝`public/assets/tiles/`、原本＝`art-src/`(gitignore)。**人物アートは両パックに無い**ため主人公/NPC/敵は色トークンのまま（タイルの上）。
- typecheck/test(23)/build 緑。playwright(`.claude/tmp/shot*.cjs`・このマシンは user=`ponti`の chromium-1217 パス)で里/遺構を目視・pageエラーゼロ。

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
- **まだ無い**: 盤の成長(心域/演算)・複数盤・看破・精霊魔法・並列演算／第2幕以降(第二の里・魔石工房の集積UI)／**人物アート(立ち絵=主人公/NPC/敵。両Kenneyパックに無く色トークンで代用中)**／**BGM**(SEは実装済)。背景＝手続き生成、フィールド＝Kenneyタイルで導入済。

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

## 次にやること（直近の作業＝ponti指示「RPGとして肉付け→loopで自走改善」の続き）

> 方針：プレイ→診断→改善→検証(typecheck/test/build＋autoplay)→次の改善、を**自走で回す**。下は優先順（上から着手推奨）。

1. **敵のレベルスケール（最優先・作業ゲー化の防止）**：成長で敵が一瞬で溶けないよう、ボス/盤敵を `game.level` で軽くスケール。**不変条件**：retryは全回復・決定論なので「到達レベルで必ず勝てる」をテストで担保（`phys.test.ts`/`board-fight.test.ts` に level別ケースを足す）。`enemies.ts` に scale 関数＋ core で winnable をテスト。
2. **盤の属性チュートリアル＋弱点ちがいの盤戦**：`enemies.ts` に未使用の `spark`(風弱点)/`gale`(雷弱点)あり。今の盤戦は全部**炎弱点**で初期炎盤のまま勝てる＝盤編集を一度も触らない。属性を足す手ほどき＋弱点ちがいの敵を1戦。**softlock厳禁**：初期盤のままでも（弱点無しでも）勝てる freeWill かをテストで担保してから出す。
3. **村のサブNPC/会話を増やす**：`maps.ts` の村に NPC タイル追加（`'G'/'N'` と同様に blocked/描画/interact を一般化すると楽）。世界観の厚み。
4. **BGM（手続き合成）**：`sfx.ts` と同じ WebAudio で。シーン別に静かなループ。[M]ミュート連動。
5. **第2幕の入口**：第二の里(地中)・魔石工房の集積UI（盤に駒を恒久配置して育てる）。新シーンは [scene-template.md](docs/design/scene-template.md) に乗せる。

着手前に読む: [docs/design/scene-template.md](docs/design/scene-template.md)（シーン/演出/アセットの規約・**bg.ts/tiles.ts/成長の入口**を明記）／[magic-stone-workshop.md](docs/design/magic-stone-workshop.md)（盤の正典）／[ADR-0001](docs/adr/0001-v2-foundation.md)（基盤）。

### 通しプレイ計測（このマシン＝user `ponti`）
`.claude/tmp/autoplay.cjs`：dev限定 `window.__game`/`__state`/`__flow(flowIndex)` を読みつつ **BFS+anti-stuck** で自動操作し、シーン/beat/level/xp/stones をトレース＆スクショ＆pageエラー収集。
- 実行：`npm run dev -- --port 5188 --strictPort` を起動 → `node .claude/tmp/autoplay.cjs`（出力 JSON＋TRAIL、`a-*.png`）。
- パス：chromium-1217 と playwright-core は **`C:/Users/ponti/...`**（旧 `drive.cjs` は別マシン `radiology` パスなので注意）。
- 終わったら dev サーバを停止（PowerShell: `Get-NetTCPConnection -LocalPort 5188 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`）。
- 静止画だけなら `.claude/tmp/shot*.cjs`。`.claude/tmp/grid.py` は Kenneyシートをグリッド可視化してタイル番地を採取する道具。

## 再開のしかた
```
npm install        # 初回のみ（phaser / phaser4-rex-plugins 含む）
npm run test       # core 44件（progress/rng/board/battle/phys/board-fight/smoke）。緑を確認
npm run typecheck
npm run build
npm run dev        # フィールド: 矢印=移動 / [Z]=会話・調べる
                   # 盤戦: 数字=駒の形 / qwer=属性 / 左ｸﾘｯｸ=置く / 右ｸﾘｯｸ=消す / ↑↓=撃つ回路を選ぶ / [F]=撃つ / [M]=ミュート
```

## ブラウザでの実機確認（UI）
Phaser は WebGL＝ヘッドレスChromeは既定で黒画面。`.claude/tmp/shot.cjs`（playwright-core を npx キャッシュから require／
`executablePath` に既存 chromium-1217／`--use-angle=swiftshader` 等）で dev サーバを撮影→Read で目視。
雛形は `.claude/tmp/`（gitignore 済）。dev は `npm run dev -- --port 5188 --strictPort` で起動。

## 壊すと事故るもの（約束ごと）
- **ADR-0001 v2 が基盤**。二軸（自由意志/魔石）・テーマ＝設計契約（実ops縛りは無し）・乱数はシード付き（`core/rng.ts` を使う。素の `Math.random`/`Date.now` 禁止）。
- core は UI 非依存・テストで固める（v1 の良い規律は継承）。TS編集後は hooks が自動 typecheck。新ロジックは必ずテストを添える。
- **シーン遷移は必ず `transitionTo(scene, key, data)`**。data 省略可だが内部で `data ?? {}` を必ず渡す＝**Phaserは start時にdata未指定だと前回のdataを使い回す**（この罠でボス戦が直前の遭遇mobとして起動していた。`fx.ts` のコメント参照）。直接 `scene.scene.start` しない。
- **戦闘の不変条件＝「到達レベルで必ず勝てる」**。retryは全回復＆決定論なので勝てない数値にすると無限ループ。`enemies.ts`/`boards.ts` の数値を変えたら `core/phys.test.ts`/`board-fight.test.ts` を必ず緑に保つ（敵を強くするなら level別 winnable テストを足す）。
- **成長の単一窓口は `state.ts` の `grantXp()`/`physPower()`**（core は `progress.ts`）。HP/火力/自由意志を直接いじらない。
- 旧プロジェクト `../20260608_algomagia` は改変しない（アーカイブ）。`art-src/`（Kenney生パック）は gitignore＝配信は `public/assets/` のみ。
