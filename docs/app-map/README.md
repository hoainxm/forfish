# App Map — ForFish

> **Single source of truth** cho mọi domain của ForFish. Mỗi file 1 chủ đề canonical, đánh số tăng dần. Hồ sơ này dành cho AI agents và team đọc trước khi đụng code.

---

## Load strategy

### Khi nào load tất cả
- KHÔNG BAO GIỜ — tốn token
- Route qua `/fl <task>` (agent `context-router`) để biết file nào cần

### Khi nào load file nào

| Task | Files cần |
|---|---|
| Hỏi tổng quan project | Root `CLAUDE.md` only |
| Vì sao có trục X / scope một lời hứa / data vendor | Root + [01-product.md](01-product.md) |
| Thêm page / route / component, sửa nav | Root + [02-architecture.md](02-architecture.md) |
| Sửa UI, màu, font, copy cho ngư dân | Root + [03-design-system.md](03-design-system.md) |
| Đụng DB, migration, RLS, logic giấy tờ / hạn | Root + [04-data-model.md](04-data-model.md) |
| Phối hợp nhiều agent / chia việc | Root + [05-agents-team.md](05-agents-team.md) |

---

## Index

| # | File | Mục đích |
|---|---|---|
| 01 | [01-product.md](01-product.md) | Bốn lời hứa, thứ tự build, data sources & adapter rule, vòng lặp cross-trục |
| 02 | [02-architecture.md](02-architecture.md) | Routes, folder layout, component map, demo mode fallback |
| 03 | [03-design-system.md](03-design-system.md) | Audience-first design: tokens, màu trục, typography, accessibility cho ngư dân |
| 04 | [04-data-model.md](04-data-model.md) | Tables, RLS, migration, domain logic giấy tờ (expiry status) |
| 05 | [05-agents-team.md](05-agents-team.md) | Team-agent architecture: lead + teammates, partition rule, context routing |
| 06 | [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md) | JTBD hợp nhất từ nghiên cứu, chân dung người dùng, mốc pháp lý eCDT, map nhóm việc → module |

---

## Invariants (áp dụng cho mọi file)

1. **Mỗi file 1 chủ đề canonical** — không trộn
2. **Bắt đầu bằng "Load khi"** — 1 dòng nói khi nào AI nên load
3. **Cross-ref dùng relative path** — vd `[04-data-model](04-data-model.md)`
4. **Last-updated date** ở cuối file
5. **Major change**: bump version + append History section, không silent overwrite
6. **Doc + code cùng commit** — xem invariant trong root [CLAUDE.md](../../CLAUDE.md)

---

## Lifecycle

```
Feature mới → ghi vào file app-map liên quan (section "Implementation status")
        ↓ ổn định, phình to
Tách → file riêng NN-feature-name.md, thêm vào Index trên
        ↓ bị thay thế
Deprecate → đánh dấu "DEPRECATED YYYY-MM-DD — replaced by NN-other.md", giữ file
```

---

**Last updated**: 2026-06-10
