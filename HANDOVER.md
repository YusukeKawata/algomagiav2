# HANDOVER — 作業再開の入口（v2）

> 最初に読むのはこのファイル。**いまの状態**と**次の一手**だけ把握できればよい。
> いま何を実装するかは [WORKPLAN.md](WORKPLAN.md)、基盤決定は [docs/adr/0001-v2-foundation.md](docs/adr/0001-v2-foundation.md)、世界観は [docs/design/world-bible.md](docs/design/world-bible.md)。

## このプロジェクトは何か（2026-06-19 新設）

旧プロジェクト `../20260608_algomagia`（v1・完成済みJRPG）から、共同設計してきた**世界観 v2**を**新規に作り直す**もの。
v2 がv1実装からズレすぎたため、混乱を避けて**殻（UI/物語/コンテンツ）をゼロから**作る。旧は**遊べるアーカイブとして温存**（参照可・改変しない）。

## いまの状態（結論）

**第1幕が通しで遊べ、第2幕の入口（地中の里）まで地続き。RPGとして肉付け済み（成長・戦闘量・物語量・探索・属性駆け引き・BGM・広い村）。**
`npm run dev`＝タイトル(はじめから/つづきから)→名前入力→**霧の里**(広いスクロール村ハブ・**ガロの家[屋内]で会話＝クエスト＆形見の魔石**・サブNPC会話・行商人の露店で装備/道具・調べる)→**南門[E]**→**森の小道**→**歌の遺構**(奥ほど強い徘徊石に**無制限ランダム遭遇**・調べる・一度きりの魔石拾得・最奥の番獣)→**番獣戦**(物理)→**里へ帰還しガロの家で報告→「ついてこい」で据炉へ案内**→据炉で**覚醒**(Qの冷たい声・スキル解禁)→魔石盤の**盤戦2連戦**(awakened→frost)→旅立ち→**坑道→地中の里**(石工リーゼの工房＝集積／盤4×4／回復魔法、不干渉派タルゴ)→この先へ[O]→第1幕おわり。
**敵を倒すとXPでレベルアップ**し HP/物理火力/自由意志が伸びる（通しで L1→L5）。難易度=中間(負けたら戦闘リトライ・各戦闘で全回復)。**オートセーブは覚醒後(魔石装備後)のみ**＝データ奉納の伏線。
**背景＝手続き生成(`bg.ts`)／フィールド＝Kenneyタイル(`tiles.ts`)＋スクロールカメラ＋データ駆動マップ(`maps.ts` の npcs/examines/decor)**。人物は色トークン（立ち絵素材は未供給）。
通しは `.claude/tmp/autoplay3.cjs`（dev限定 `window.__game`/`__state` を読み、Field=状態で目標切替＋BFS＋NPC会話、Battle=z連打）で **TheEnd到達・戦闘7回・pageエラー0**を確認。**69テスト/typecheck/build 緑**。詳細な最新変更は下の「2026-06-21（続2）」。

### 2026-06-21 RPG大改修（ターン制戦闘・ゴールド経済・店・装備・魔石盤の作り替え）〔ponti指示で実施〕
プレイ→診断→改善の自走で、第1幕を「ふつうのRPGの殻」に整えた。**core 54テスト/typecheck/build 緑、autoplay2 で TheEnd 到達・pageエラー0**（L1→L5・戦闘6・G15→74）。

- **戦闘＝ターン制（ドラクエ風）に統一**：`core/combat.ts`（+テスト）。コマンド＝**こうげき(武器)/スキル(魔石盤の回路)/どうぐ/みやぶる(看破=予測防御)**。ヒーローは HP（耐久）＋自由意志（スキル燃料）。HP0で敗北・retryは全回復。**物理戦/盤戦の2シーンを廃止し `BattleScene` 1本に統合**（`PhysBattleScene`/`BoardScene` 削除）。覚醒前はスキル不可（攻撃で勝てる＝詰まないをテストで担保）。
- **魔石＝ドロップ品をやりくり（文様は変更不可）**：`game.stones` を **Stone[] インベントリ**化。敵撃破で `STONE_POOLS` から1個ドロップ（決定論）。**ガロが最初に手渡す魔石＝「─・物理・魔素量1」**（クエスト受領時に入手）。**盤は 1×1 スタート**（`mind/compute`＝心域/演算）。
- **魔石盤の編集は戦闘外へ分離**（「はめる画面に戦闘は不要」）。メニュー[C]の「魔石盤」タブで配置/取り外し（カーソル＋picking）。属性は選べない＝拾った魔石の文様で回路を組む。
- **ゴールド経済＋店＋装備**：通貨＝ゴールドのみ。里に**道具屋/武器屋/防具屋**（行商人・`shops.ts`）。`MenuScene`（ステータス/そうび/魔石盤/どうぐ）と `ShopScene`（買う/売る・**魔石を売ってG化**）。**武器(atk)/防具(def,hpBonus)** は魔石と別系統＝`heroAtk()/heroDef()/maxHp()`。
- **マップ自由往来**：`maps.ts` に `exits`（出口タイル→行き先＋到着座標）。里[E]↔小道[w/e]↔遺構[w] を行き来。フィールドは linear flow から分離し、**里南口[E]＝覚醒前はクエスト確認/覚醒後は番獣戦の引き金**、遺構[B]＝ボス、で flow を進める。クエストは `game.flags.quest`。
- **モンスター改名**（モンスターらしく・正体は伏せる・「石」を付けない）：霧狼/群れ狼/岩噛み/淀みの影/双角獣/遺構の番獣、盤敵＝氷狼/雷甲虫/疾風鳥。
- 自動プレイ＝`.claude/tmp/autoplay2.cjs`（新フロー対応・Battleはz連打＝攻撃で勝てる）。メニュー/店の目視＝`.claude/tmp/shotmenu.cjs`（`m-*.png`）。**旧 `autoplay.cjs` は旧シーン用で動かない**。
- **戦闘の駆け引き（追加・同日）**：強敵に「**ためる→大攻撃(2倍)**」周期（`enemies.bigEvery`）。ためる手番はダメージ0＋黄色い警告リング＋⚠表示＝**予兆**。次手番の大攻撃を**みやぶる(看破)で受け流す**（決定論なので読める＝予測防御の手応え）。`core/combat.ts` に `charging/sinceBig/bigEvery`＋`enemyTurn` の big/telegraph。`autoWinnable` は「予兆を見たら看破・他は攻撃」で詰まないことを担保（boss/盤敵で緑）。core 56テスト。

### 2026-06-21（続）4本まとめ：火力カーブ／敵属性・複数行動・Lvスケール／第2幕の入口（地中の里）／BGM 〔ponti指示・loopで自走〕
ループエンジニアリング（入力を最初に一括確認→自走）で4テーマを実装。**core/state 69テスト・typecheck・build 緑、autoplay2 で TheEnd 到達・pageエラー0**（L1→L5・戦闘7・G15→90・地中の里まで通し）。確認した分岐＝「遊べる第二の里まで」「工房の集積＝value強化＋**属性付け替え解禁**（属性固定の決定を緩めた）」「敵属性攻撃＋防具に属性耐性」。

1. **スキル火力カーブ**（`core/combat.skillBaseDamage`）：スキルダメージ＝強さ合計＋**長回路ボーナス（超線形・+25%/石）**。3石で×1.5、5石で×2、さらに弱点で×2。**育った盤の長い弱点回路がこうげきを明確に上回る**（例：L5相当atk16を3石強さ9の弱点回路26が上回る）。コストは石数（線形）＝「長い回路を組む」が報われる。1×1の単石は弱点でも2＝序盤はこうげき優位＝softlock維持（`autoWinnable` は攻撃のみで判定＝スキル強化と独立）。
2. **敵の属性攻撃＋防具耐性＋複数行動＋Lvスケール**：`CombatEnemy.atkAttr/bigAttr/multi`、`CombatHero.resist`、`strikeDamage()`（防御→属性倍率→看破）。防具に `resist`（炎/氷/雷/風 耐性・裏に弱点）＝**熾火の胴着/凍霜の織衣/帯電の革鎧**（防具屋）。敵：群れ狼/雷甲虫＝二連撃、淀みの影/氷狼=氷、霧狼(覚醒)=炎、疾風鳥=風。遭遇敵は `scaleEnemy(e, level)`（hp+12%/Lv・atk+1/3Lv・報酬据え置き）で**到達Lvに軽くスケール**（作業ゲー化防止）。不変条件＝スケール敵もL1-8の素手で勝てる（テスト）。BattleSceneに「攻撃:◯」「守:◯耐/弱」「N連撃」表示＋属性色フラッシュ。
3. **第2幕の入口＝遊べる「地中の里」**（§8.9）：新マップ **坑道(tunnels)**→**地中の里(underville)**。坑道は属性持ちの魔物（地這い/燐光虫）が徘徊。里に**里長タルゴ[J]（不干渉派＝テーマの鏡）**・**石工リーゼ[M]（魔石工房）**。`WorkshopScene`＝**集積**（素材魔石を捧げて value+1／**属性うつし**＝素材の属性へ。文様は不変）。リーゼ初対面で `act2/healMagic` 解禁＋`raiseBoardCap(4)`（**盤上限 3×3→4×4**）。**回復魔法「いやし」**＝心域から状態を読み戻す戦闘コマンド（`heroMend`・自由意志-4・量=8+心域×6）。bg に `under`、`O`タイル＝この先へ（フロー進行）。
4. **BGM（手続き合成）**：`app/ui/music.ts`（sfx と AudioContext 共有・`startBgm/stopBgm`）。シーン別の静かなループ（title/village/ruin/battle/under/depart/end＝テンポ・コード進行・アルペジオ手書き）。**[M]ミュート連動**（毎ステップ `isMuted` 確認＝ミュート中は無音でスケジュールだけ進む）。各シーンの create で `startBgm`。

### 2026-06-21（続2）村の拡張・探索性・フローの自然化・UI明確化 〔ponti指示・loopで自走〕
プレイ→診断→改善の自走で、第1幕の「序盤の体験」を作り直した。**69テスト/typecheck/build 緑、autoplay3 で TheEnd 到達・pageエラー0**（L1→L5・戦闘7）。確認した分岐＝「村＝ハイブリッド（スクロール広場＋入れる建物）」「出発＝ソフト誘導」。

- **フィールドにスクロールカメラ＋タイル縮小**（`FieldScene`）：固定タイル `TILE_PX=36`（元素材を小さめに）。マップが画面より大きいと**カメラがプレイヤー追従**（`centerOn`・境界クランプ）、小さいマップは中央寄せ固定。HUD/会話箱/ミュート表示/背景は `setScrollFactor(0)` で画面固定（`fx.ts`/`dialogbox.ts`）。
- **マップをデータ駆動化**（`maps.ts`）：`FieldMap` に `npcs/examines/decor` を持てる（村・ガロの家）。`NpcKind` で種別ディスパッチ（villager/garo/nina/shop*/underElder/maker）。**旧来の文字NPC（underville の J/M 等）も併存サポート**。地形タイル追加＝`H`(建物)/`C`(守り石)/`g`,`d`(扉)。
- **村ハブを拡張＋入れる建物＋サブNPC**：霧の里を 36×22 のスクロール村に。**ガロの家（屋内マップ `garo_house`）**へ扉 `g` で出入り。サブNPC（畑のドゥエ/猟師バルク/子どものミィ/老婆セン）＋ニナ＋行商人の露店3種＋調べる点。守り石は記念碑として中央に。
- **遭遇数の上限を撤廃**（`ENC_MAX` 削除）：最低 `ENC_STEPS=4` 歩いたら以降は毎歩**一定確率(0.5)でランダムエンカウント**（シード付き）。無制限。`scaleEnemy` で到達Lvにスケール（既存）。
- **番獣撃破→村帰還→ガロが据炉へ案内**（`script.ts`/`flow.ts`/`FieldScene`/`BattleScene`）：守り石を直接据炉に持ち込まず、**撃破→`boss-cleared` フラグ→里へ帰還→ガロの家で報告→「ついてこい」で据炉へ→覚醒**。南門 `E` は報告前は通れない（ソフトに家へ誘導）。
- **初の旅立ちの重み・装備動線・ニナの別れ**：クエスト受領後ニナが**装備/道具を促す**（露店・魔石売却の案内）。番獣撃破後の帰還でニナが出迎え、サブNPCが世界観を小出し。
- **魔石盤メニューを専用パネル化**（`MenuScene`・「魔石セット画面で戦う」混乱の解消）：オーバーレイを**不透明**にし背後のフィールド（＝モンスターが出る場所）を隠す。盤を枠で囲い**入口/出口**ラベル＋「◆ここはスキルを組む編集画面（戦闘ではない）」を明記。心域=横/演算=縦の説明も。
- 自動プレイ＝`.claude/tmp/autoplay3.cjs`（**NPC会話に対応**＝目標を状態で切替・NPC隣でz・会話送り）。**ハーネスのポートは 5173 に統一**（autoplay2/3・shotmenu・shotfield）。`shotfield.cjs`＝任意マップを撮る道具。

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
- **実装済（2026-06-21続）**: 看破／盤の成長(心域/演算・上限4×4)／魔石工房の集積UI（value強化＋属性うつし）／第2幕の入口(地中の里)／回復魔法(いやし)の入口／**BGM**(手続き合成・シーン別)。
- **まだ無い**: 複数盤・精霊魔法・並列演算／第2幕本体(第三の町＝ハブ&スポーク・依頼/周回)／**人物アート(立ち絵=主人公/NPC/敵。両Kenneyパックに無く色トークンで代用中)**。背景＝手続き生成、フィールド＝Kenneyタイル。

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

- ✅ **済（続1）**：戦闘の駆け引き（スキル火力カーブ・敵属性/複数行動・防具属性耐性・遭遇Lvスケール）／盤の手応え（長回路がこうげき超え・盤4×4・回復魔法）／第2幕の入口（地中の里・工房）／BGM。`autoWinnable` 緑維持。
- ✅ **済（続2）**：フィールドのスクロールカメラ＋タイル縮小／マップのデータ駆動化／広い村ハブ＋ガロの家（屋内）＋サブNPC／遭遇上限撤廃（ランダムエンカウント）／番獣撃破→帰還→ガロが据炉へ案内／魔石盤メニューの不透明パネル化（編集と戦闘を分離）。

**次の候補（上から着手推奨）**
1. **第2幕本体**＝第三の町（壁の狩人町・ハブ&スポーク・依頼/周回・魔石経済 §8.10）。地中の里[O]の先に接続。精霊魔法(霊脈 §8.12)・並列演算(演算 §8.13)の解禁スポーク。
2. **村の建物を増やす**：いまは「ガロの家」のみ屋内化。市の屋内・宿・倉庫など `garo_house` と同じデータ駆動（`maps.ts` に `npcs/examines/decor` を足すだけ）で増やせる。
3. **盤の手応えの続き**：並列レーン＝複数スキルの活き方／複数盤／看破の盤表現／工房チュートリアル動線。
4. **店/装備/道具のバランス**：属性防具の価格・性能カーブ、状態異常薬、終盤装備、ゴールド収支。`equipment.ts`/`items.ts`/`shops.ts`/`stones.ts`。
5. **磨き**：BGMの音色/進行・戦闘トラック分化／garo_house の壁タイル（今は墓石流用）／**人物アート（立ち絵）**（色トークン代用中・供給されたら差し替え）。

着手前に読む: [docs/design/scene-template.md](docs/design/scene-template.md)（シーン/演出/アセットの規約・**bg.ts/tiles.ts/成長の入口**を明記）／[magic-stone-workshop.md](docs/design/magic-stone-workshop.md)（盤の正典）／[ADR-0001](docs/adr/0001-v2-foundation.md)（基盤）。

### 通しプレイ計測（このマシン＝user `ponti`・ポートは 5173 に統一）
**`.claude/tmp/autoplay3.cjs`（現行・NPC会話対応）**：dev限定 `window.__game`/`__state` を読み、Fieldは状態で目標を切替（扉/門/NPC隣）＋BFS＋NPC隣でz＋会話送り、戦闘はz連打で **TheEnd まで自走**＆スクショ(`c-*.png`)＆pageエラー収集。任意マップの目視は `.claude/tmp/shotfield.cjs <mapId>`（`f-*.png`）、メニュー/店は `.claude/tmp/shotmenu.cjs`（`m-*.png`）。※`autoplay2.cjs` は旧フロー用（NPCゲートを越えられない）。
- 実行：dev を 5173 で起動 → `node .claude/tmp/autoplay3.cjs`（出力 JSON＋TRAIL）。
- パス：chromium-1217 と playwright-core は **`C:/Users/ponti/...`**。
- dev サーバ停止：`Get-NetTCPConnection -LocalPort 5173 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`。
- `.claude/tmp/grid.py` は Kenneyシートをグリッド可視化してタイル番地を採取する道具。

## 再開のしかた
```
npm install        # 初回のみ（phaser / phaser4-rex-plugins 含む）
npm run test       # 69件（combat/progress/rng/board/battle/phys/board-fight/smoke/state）。緑を確認
npm run typecheck
npm run build
npm run dev -- --port 5173 --strictPort   # ポートは 5173 に統一（ハーネスも 5173）
                   # フィールド: 矢印=移動（大マップはカメラ追従スクロール） / [Z]=会話・調べる・露店/扉/工房 / [C]=メニュー
                   #   出入口: 南門[E]・通路[w/e]・建物の扉[g/d]・この先へ[O]
                   # 戦闘: ↑↓で選択・[Z]決定（こうげき/スキル/(覚醒後)いやし/どうぐ/みやぶる）・[X]戻る / [M]=ミュート(BGM/SE)
                   # メニュー: [←→]タブ（ステータス/そうび/魔石盤/どうぐ）/ 魔石盤=矢印カーソル・[Z]で嵌める/外す（不透明な編集パネル＝戦闘ではない）
```

## ブラウザでの実機確認（UI）
Phaser は WebGL＝ヘッドレスChromeは既定で黒画面。`.claude/tmp/shotfield.cjs <mapId>`／`shotmenu.cjs`／`autoplay3.cjs`
（playwright-core を npx キャッシュから require／`executablePath` に既存 chromium-1217／`--use-angle=swiftshader` 等）で
dev サーバ(**5173**)を撮影→Read で目視。雛形は `.claude/tmp/`（gitignore 済）。

## 壊すと事故るもの（約束ごと）
- **ADR-0001 v2 が基盤**。二軸（自由意志/魔石）・テーマ＝設計契約（実ops縛りは無し）・乱数はシード付き（`core/rng.ts` を使う。素の `Math.random`/`Date.now` 禁止）。
- core は UI 非依存・テストで固める（v1 の良い規律は継承）。TS編集後は hooks が自動 typecheck。新ロジックは必ずテストを添える。
- **シーン遷移は必ず `transitionTo(scene, key, data)`**。data 省略可だが内部で `data ?? {}` を必ず渡す＝**Phaserは start時にdata未指定だと前回のdataを使い回す**（この罠でボス戦が直前の遭遇mobとして起動していた。`fx.ts` のコメント参照）。直接 `scene.scene.start` しない。
- **戦闘は `core/combat.ts`（ターン制）が単一の正**。物理戦/盤戦は廃止＝`BattleScene` 1本。**不変条件＝「到達レベルで攻撃連打で勝てる」**（retryは全回復＆決定論。`autoWinnable`）。`enemies.ts` の数値を変えたら `core/combat.test.ts` を緑に保つ。※ 旧 `phys.ts/battle.ts/board-fight.test.ts` は未使用だがテスト資産として残置（混同しない）。
- **状態の単一窓口は `state.ts`**：`grantXp()`/`physPower()`/`heroAtk()`/`heroDef()`/`maxHp()`（成長は core `progress.ts`）。魔石＝`stones: Stone[]`、装備＝`weaponId/armorId`＋`ownedWeapons/ownedArmors`、盤＝`board`(`mind×compute`)。HP/火力/自由意志/盤を直接いじらず helper 経由。
- **メニュー/店はポーズ・オーバーレイ**（`scene.launch`＋`scene.pause`、閉じる時 `scene.resume('Field')`）。フィールドの[C]/店タイル[Z]から開く。
- **魔石盤は 1×1 スタート・文様(edges)は変更不可**（ドロップ品をやりくり）。編集は戦闘外（メニュー）。**覚醒後はレベルアップごとに盤が1段拡張**（`state.nextBoardDims(mind,compute,cap)`・心域優先・上限=`game.boardCap`＝第1幕3／第2幕の工房で4）。最初の装備は1×1のまま。`grantXp` が成長窓口。
- **魔石の value/属性は工房（集積）で変えられる**（2026-06-21・ponti が決定を緩和）：`fuseValue`（素材を捧げて value+1）／`fuseAttr`（素材の属性へ付け替え）。**文様(edges)だけは依然不変**。地中の里の石工リーゼ[M]＝`WorkshopScene` で操作（`act2` 解禁後）。
- **戦闘の属性**：敵 `atkAttr/bigAttr/multi`、防具 `resist`（属性別の被ダメ係数・正=耐性/負=弱点）。被ダメ＝`core/combat.strikeDamage`（防御→属性倍率→看破）。**cloth(既定)は resist 空＝既存挙動と同一**＝`autoWinnable` 不変。遭遇敵は `enemies.scaleEnemy(e, level)` で到達Lvに軽くスケール（フロー/ボスは固定）。
- **回復魔法「いやし」**＝`core/combat.heroMend`（自由意志 `MEND_COST`=4・量 `state.mendPower`=8+心域×6）。`game.flags['healMagic']` 解禁後だけ戦闘コマンドに出る（地中の里のリーゼで解禁）。
- **マップ往来は `maps.ts` の `exits`**（出口タイル→行き先＋到着座標）。フィールドの進行ゲートは「里南門[E]」「遺構[B]」「地中の里[O]」、扉 `g`/`d`（建物の出入口）。クエスト＝`game.flags.quest`、番獣撃破＝`game.flags['boss-cleared']`（→帰還してガロの家でガロに報告すると据炉=覚醒へ `advance`）。**セーブは v2**。
- **マップはデータ駆動**（`maps.ts`）：`FieldMap.npcs/examines/decor` を持つマップ（村・garo_house）はそれで描画/会話。持たないマップ（path/ruin/tunnels/underville）は旧来の文字ベース（FieldScene が両対応）。NPCはタイル文字でなく座標データ＝移動の blocked は npc 座標も見る。新NPCは `npcs[]` に足すだけ。
- **フィールドはカメラスクロール**：固定 `TILE_PX=36`。大マップは `centerOn` 追従。HUD/会話/背景/ミュートは `setScrollFactor(0)`（足し忘れるとスクロールで画面外へ流れる）。`cameras.main.fade/flash/shake` はスクロール非依存（そのまま使える）。
- **魔石盤の編集は不透明な専用パネル**（`MenuScene`）＝背後のフィールドを見せない（「セット画面で戦う」という誤解を防ぐ）。編集＝メニュー[C]、戦闘＝フィールドの遭遇、で場所を分ける。
- 旧プロジェクト `../20260608_algomagia` は改変しない（アーカイブ）。`art-src/`（Kenney生パック）は gitignore＝配信は `public/assets/` のみ。
