# シーン／演出のテンプレ（第2幕以降はこれに乗る・v2）

第1幕（タイトル→里→遺構→覚醒→盤戦→第1幕おわり）を「**お手本**」として固めた規約。
第2幕の新規シーンは、ここに書いた責務分担・共有UI・即時描画の作法をコピーして増やす。基盤は [ADR-0001](../adr/0001-v2-foundation.md)。

## レイヤの責務（壊さない）
- **`src/core/`** — 決定論ロジック。UI非依存・純関数寄り。**必ずテストを添える**。
  - `board.ts`（回路判定）／`battle.ts`（盤戦＝自由意志でスキルを撃つ）／`phys.ts`（覚醒前の物理戦）。
  - バランスの**不変条件はテストで固定**する（例: `phys.test.ts`＝番獣は素手で勝てる／`board-fight.test.ts`＝初期盤面で awakened に勝てる）。数値を変えるならテストを赤にして気づける状態を保つ。
- **`src/app/`** — Phaser 層。core を呼ぶだけ。シーン＝`src/app/*Scene.ts`、共有UI＝`src/app/ui/`、表示定数＝`theme.ts`。
- **`src/game/`** — フロー駆動とコンテンツ。`flow.ts`（beat→シーン）／`script.ts`（台本＝beat列）／`state.ts`（横断状態）／`save.ts`／`data/*`（敵・マップ・盤・名前）。

## 共有UI（`src/app/ui/`）＝第2幕でも使い回す
| ファイル | 役割 | 使い方 |
|---|---|---|
| `dialogbox.ts` | 会話箱（枠＋名前＋1文字送り＋点滅▼） | `new DialogBox(scene)` → `show(who, text, {cold})` → 入力で `press()`（`'skipped'`＝表示途中を全表示／`'advance'`＝次へ） |
| `typewriter.ts` | 1文字送り（`onChar`/`onDone`） | DialogBox 内部で使用。単独表示にも流用可 |
| `fx.ts` | フェード遷移・ダメージポップ・フラッシュ・揺れ・ミュート表示 | 下記の「シーンの作法」を参照 |
| `sfx.ts` | 手続き合成SE（WebAudio・ミュートは localStorage 保存） | `playSfx('confirm'|'hit'|'weak'|'circuit'|…)`。BGM は未実装 |
| `bg.ts` | 手続き生成の雰囲気背景（グラデ＋霧/星/シルエット/光/裂け目/ビネット） | `create()` 先頭で `paintScene(this, kind)`（`'title'|'village'|'ruin'|'phys'|'awaken'|'board'|'depart'|'end'`）。単色矩形の置き換え。配置はシード付き乱数で決定論、動きは tween。depth=-100 で最背面 |
| `tiles.ts` | Kenney Roguelike パック（CC0・16px）のタイル参照 | `addTile(scene, cx, cy, frame, size)`／`TILE.{grass,stone,tree,crystal,…}`。`Preload` で `loadTiles(scene)`（キー `'rl'`） |

演出の濃さ＝**中間**（ダメージ数字ポップ・弱点フラッシュ・軽い画面揺れ・回路点灯パルス）。音は**SEのみ**（[M]でミュート）。

## シーンの作法（毎シーン同じ形にする）
1. `create()` の**先頭で `fadeInOnCreate(this)`**（黒→画面。退場フラグも解除される）。
2. シーンの終わりに `addMuteToggle(this)`（右下に表示＋[M]切替）。
3. **シーン遷移は必ず `transitionTo(this, key, data)`**（黒へフェード→start）。直接 `this.scene.start` しない。
   - フロー駆動の遷移は `advance(this)`／`route(this)` 経由（内部で `transitionTo`）。
   - `transitionTo`・`advance` は**退場中の連打を無視**する（フェード中の多重遷移＝ビート飛ばし／ソフトロックを防ぐ）。新しい遷移ヘルパもこのガードに必ず乗せる。
4. **即時描画（immediate）**：盤・フィールドなど動的表示は `render()` で毎回 `graphics.clear()`＋`container.removeAll(true)` してから描き直す（ADR-0006 の動的=即時方針）。
   - 毎フレーム動かす演出（点灯パルス等）は `render()` でテキストを作り直さず、**専用の `graphics` を `update()` で `clear()`→描画**する（GC を避ける）。
5. **入力は「1入力＝1アクション」**：文字送り中の決定は「全表示」だけで、次へ進めない（`DialogBox.press()` の戻り値で分岐）。

## アセット（手続き生成＋Kenney CC0）
- **配信用**＝`public/assets/`（Vite が `/` 直下で配信＝ビルドで `dist/` にコピー）。タイルシートは `public/assets/tiles/`（`roguelike.png` / `medieval_rts.png`＋`.xml`）。
- **原本**＝`art-src/`（Kenney 生パック・gitignore 済。再DL可。配信用のみ git に入れる）。
- **読み込み**＝最初の `PreloadScene` で一括 `load`（テクスチャは常駐＝一度だけ）。新アセットは `tiles.ts`/`Preload` に足す。`pixelArt: true`（main.ts）で16pxを拡大してもくっきり。
- **背景**＝原則 `bg.ts` の手続き生成（素材不要・軽量）。**フィールドのタイル地形**＝roguelike パックを `addTile` で敷く（FieldScene が手本）。
- **人物アートは無い**＝主人公/NPC/敵は色トークンで表現（タイルの上に乗せる）。立ち絵が入るまでの既定。

## データの置き場所（コンテンツを増やす順）
- 台詞・進行＝`game/script.ts`（`Beat` を足す）。新しいマップ＝`game/data/maps.ts`、敵＝`enemies.ts`、盤の初期配置/駒の形＝`boards.ts`、固有名＝`names.ts`。
- 数値（火力・敵HP・コスト）は data 側に定数で持ち、**core のロジックは変えない**。バランス変更＝data の数値＋テストの更新。

## 確認の順序（変更したら必ず）
1. `npm run test`（core の決定論・勝てること）／`npm run typecheck`（hooks が自動でも回す）。
2. `npm run build`。
3. 実機目視＝`.claude/tmp/drive.cjs`（dev限定で `window.__game` を公開＝シーン状態を読みながら駆動。本番ビルドでは剥がれる）。`npm run dev -- --port 5188 --strictPort` を起動して実行→`d-*.png` を Read で目視。**pageエラー0**を確認。

> 教訓: 「pageエラー0」は遊べる証明にはならない。**勝てること・詰まないことは core のテストで証明**し、スクショは見た目の確認に使う（ソフトロックは実際にこの方法で見つけて直した）。
