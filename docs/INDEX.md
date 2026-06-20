# ドキュメント地図（INDEX・v2）

「**目的→どれを読むか**」の索引。再開なら最初は [HANDOVER.md](../HANDOVER.md)、次の作業は [WORKPLAN.md](../WORKPLAN.md)。

## 目的別
| やりたいこと | 読むドキュメント |
|---|---|
| 作業を再開する（現状・次の一手） | [HANDOVER.md](../HANDOVER.md) → [WORKPLAN.md](../WORKPLAN.md) |
| **基盤決定（なぜ作り直し・技術・テーマ・二軸）** | [adr/0001-v2-foundation.md](adr/0001-v2-foundation.md) |
| **シーン/演出のテンプレ（第2幕はこれに乗る）** | [design/scene-template.md](design/scene-template.md) |
| 世界観（正典・決定論SQ vs 自由意志exSQ） | [design/world-bible.md](design/world-bible.md) |
| 中核思想（何を作っているか） | [design/game-design-philosophy.md](design/game-design-philosophy.md) |
| スキル=関数・防御=予測（看破の根） | [design/skill-concept.md](design/skill-concept.md) |
| 工房（最適化）のUX | [design/ux-node-editor.md](design/ux-node-editor.md) |
| v1 の魔素=実計算量の旧定義（**LEGACY・参考**） | [adr/0002-determinism-and-mana-LEGACY.md](adr/0002-determinism-and-mana-LEGACY.md) |

## フォルダの役割
| フォルダ | 役割 |
|---|---|
| `adr/` | 意思決定（番号付き・なぜそうするか） |
| `design/` | 安定設計（世界観・恒久的な設計思想） |
| `plans/` | 実装待ちの仕様（実装したら design へ還元しここから消す） |
| `process/` | 開発運用 |

> 注: `design/` のドキュメントの一部は v1 から持ち込んだ参考資料。v2 の正典は **world-bible.md** と **ADR-0001**。
> v1 由来の記述（魔素=実計算量カウント等）は ADR-0001 D3 で**撤廃**されている点に注意。
