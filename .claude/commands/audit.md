---
description: Tự audit ForFish theo 12 nguyên tắc ai-simple-product-dev → điểm + backlog tối ưu (chạy mỗi quý hoặc khi nghi docs đang mục)
argument-hint: [trống = full | tên nguyên tắc, vd "06" | "ops" | "ui"]
---

Bạn là auditor READ-ONLY (không edit, không commit). Audit ForFish theo ai-simple-product-dev, scope: $ARGUMENTS (trống = full).

## Bước 1 — Chấm 12 nguyên tắc bằng SỐ ĐO

Mỗi nguyên tắc 0–10, neo vào sub-metric deterministic (ghi kèm lệnh + kết quả; không đo được → N/A, KHÔNG chấm cảm tính).

| # | Nguyên tắc | Đo bằng |
|---|---|---|
| 01 | Hierarchical context | `wc -c CLAUDE.md` vs 20000 |
| 02 | App-map | đếm file app-map (>20 → domain hóa?); thiếu "Load khi" |
| 03 | Context routing | `.claude/commands/fl.md` + `agents/context-router.md` tồn tại; keyword còn khớp |
| 04 | Doc+Test sync | `sh scripts/doc-health-report.sh` → số SUSPECT + max lag; spot-check 3 commit `re-verify(...)` có claims thật |
| 05 | LOGIC vs REQUEST | rule trong CLAUDE.md |
| 06 | Risk tiers | CLAUDE.md có pre-flight flags; còn "confirm mọi thứ" sót không |
| 07 | Memory | memory files có entry stale/sai so với code |
| 08 | Enforcement | `git config core.hooksPath` = .githooks; `sh .githooks/pre-commit --self-test` PASS? |
| 09 | Generated docs | `docs/app-map/_generated/` tồn tại; cũ hơn migrations? |
| 10 | Contracts | `docs/contracts/sdwork-assets.contract.md` — consumers list còn đúng? version khớp gateway? |
| 11 | Ops | `docs/app-map/ops/external-services.md` — mọi nguồn ngoài có cột "khi nó chết"? |
| 12 | Self-optimization | `docs/audit-history.md` có entry kỳ trước; doc-status.md fresh; doc MỒ CÔI (ORPHANED)? |

### Rubric neo điểm (điểm TÍNH từ metric, LLM chỉ ±1 kèm lý do)
| Trạng thái | Điểm |
|---|---|
| Xanh (lag 0, self-test PASS, budget <80%) | 9–10 |
| Vấn đề nhỏ trong ngưỡng (lag ≤7d, vài WARN) | 6–8 |
| Vượt ngưỡng (lag >7d, ORPHANED>0, self-test FAIL) | 3–5 |
| Cơ chế không tồn tại dù phải có | 0–2 |

## Bước 2 — Semantic verify
Chọn 3 doc theo hotspot (route-freq × code churn trong `covers`). Ưu tiên doc KHÔNG có covers (01/05/06 vision) + top hotspot. Mỗi doc: trích 5–10 khẳng định kiểm chứng được → đối chiếu code thật → ĐÚNG/SAI/KHÔNG-KIỂM-ĐƯỢC. Khẳng định SAI = phát hiện nghiêm trọng nhất.

## Bước 3 — Tín hiệu → hành động
Duyệt nguyên tắc 12: tín hiệu nào đang bắn mà chưa có hành động (ORPHANED, dead-symbol, budget gần trần, doc lạnh quá TTL).

## Bước 4 — Output (BẮT BUỘC)

```markdown
## Audit ForFish — <YYYY-MM-DD>
Điểm: NN/120 (kỳ trước: NN — trend ↑/↓)
Metric: doc-lag <n/max>, ORPHANED <n>, budget <chars>, hook self-test <pass/fail>

### Điểm theo nguyên tắc
| # | Điểm | Bằng chứng 1 dòng |

### Khẳng định SAI trong docs
- <doc>: "<khẳng định>" — thực tế: <code> → UPDATE/REBUILD?

### Backlog tối ưu (xếp theo tác động/effort)
| Ưu tiên | Việc | Loại (UPDATE/REFACTOR/REBUILD/RETIRE) | Effort |

### 1 việc đáng làm NGAY
<việc tốt nhất, kèm lệnh/file>
```

Cuối: append `<date> | <score>/120 | <top issue>` vào `docs/audit-history.md` (file DUY NHẤT audit được ghi).
