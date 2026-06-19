# HANDOVER — 作業再開の入口（v2）

> 最初に読むのはこのファイル。**いまの状態**と**次の一手**だけ把握できればよい。
> いま何を実装するかは [WORKPLAN.md](WORKPLAN.md)、基盤決定は [docs/adr/0001-v2-foundation.md](docs/adr/0001-v2-foundation.md)、世界観は [docs/design/world-bible.md](docs/design/world-bible.md)。

## このプロジェクトは何か（2026-06-19 新設）

旧プロジェクト `../20260608_algomagia`（v1・完成済みJRPG）から、共同設計してきた**世界観 v2**を**新規に作り直す**もの。
v2 がv1実装からズレすぎたため、混乱を避けて**殻（UI/物語/コンテンツ）をゼロから**作る。旧は**遊べるアーカイブとして温存**（参照可・改変しない）。

## いまの状態（結論）

**土台のみ完成。** Phaser 4 が起動する最小骨組み（`BootScene` がタイトル文字を描画）＋設定/hooks/テスト基盤を整備。
`npm run typecheck` / `npm run test`（smoke 1件）/ `npm run build` すべて緑。**本実装（タイトル/フィールド/戦闘/会話/工房…）はこれから。**

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

## 次にやること（WORKPLAN 参照）
設計の続き（魔石工房の詳細＝解析/集積/最適化、第3幕、命名、通し見直し）と、実装の最初の一歩（二軸ステータスの core 型＋最小戦闘 or タイトル/会話の殻）。
**着手前に詰める未決**: アート供給（立ち絵/背景）・規模/尺・解像度/ピクセル戦略。設計は方式A（小さい複数案→ponti が選ぶ）。

## 再開のしかた
```
npm install        # 初回のみ（phaser / phaser4-rex-plugins 含む）
npm run test       # smoke 1件。緑を確認
npm run typecheck
npm run build
npm run dev        # ブラウザで BootScene を確認
```

## 壊すと事故るもの（約束ごと）
- **ADR-0001 v2 が基盤**。二軸（自由意志/魔石）・テーマ＝設計契約（実ops縛りは無し）・乱数はシード付き。
- core は UI 非依存・テストで固める（v1 の良い規律は継承）。TS編集後は hooks が自動 typecheck。
- 旧プロジェクト `../20260608_algomagia` は改変しない（アーカイブ）。
