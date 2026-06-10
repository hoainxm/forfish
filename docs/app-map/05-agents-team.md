# 05 — Agents team: kiến trúc team-agent xây ForFish

> **Mục đích / Purpose**: Mô tả cách dự án được xây bằng một team AI agents song song — vai trò, quy tắc chia file (partition rule), và cơ chế route context.

**Load khi / Load when**: phối hợp nhiều agent, thêm teammate mới, phân chia việc, hoặc sửa `.claude/agents/` / `.claude/commands/`.

---

## 1. Mô hình / The model

```
                ┌──────────────────────┐
                │  LEAD AGENT          │
                │  design + integration │
                │  (giữ bức tranh chung,│
                │   merge, review)     │
                └──────────┬───────────┘
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ docs-agent    │  │ data-agent    │  │ review-agent  │
│ hồ sơ app-map │  │ (future)      │  │ (future)      │
│ CLAUDE/AGENTS │  │ Supabase      │  │ QA, test,     │
│ .claude/*     │  │ wiring, auth  │  │ a11y audit    │
└───────────────┘  └───────────────┘  └───────────────┘
```

- **Lead agent** — thiết kế tổng thể + tích hợp: quyết scope, giao việc, review output của teammates, là người duy nhất merge các mảng lại.
- **docs-agent** (teammate hiện tại) — sở hữu lớp hồ sơ: `CLAUDE.md`, `AGENTS.md`, `docs/app-map/*`, `.claude/agents/*`, `.claude/commands/*`.
- **data-agent** (future) — wiring Supabase: auth OTP, chuyển vault localStorage → Postgres, migrations.
- **review-agent** (future) — QA: test, accessibility audit theo [03-design-system.md](03-design-system.md), regression.

## 2. Partition rule — quy tắc chia file (invariant)

> **Mỗi teammate sở hữu một tập file RỜI NHAU (disjoint file sets). Không ai sửa file của người khác.**

| Agent | Own (được sửa) | Read-only |
|---|---|---|
| Lead | mọi thứ (integration) — nhưng tránh sửa khi teammate đang chạy | — |
| docs-agent | `CLAUDE.md`, `AGENTS.md`, `docs/**`, `.claude/agents/**`, `.claude/commands/**` | `src/**`, `supabase/**`, configs |
| data-agent | `src/lib/supabase/**`, `supabase/migrations/**`, phần data của vault | docs (đề xuất sửa qua lead) |
| review-agent | `tests/**` (khi có) | mọi thứ khác |

Vì sao: agents chạy **song song** — file set giao nhau = merge conflict + ghi đè lẫn nhau. Nếu việc đòi sửa file ngoài quyền sở hữu → trả về lead, không tự sửa.

## 3. Context routing — `/fl` + `context-router`

- Slash command: [`.claude/commands/fl.md`](../../.claude/commands/fl.md) — gọi `/fl <mô tả task>` trước khi code
- Sub-agent: [`.claude/agents/context-router.md`](../../.claude/agents/context-router.md) — nhận task, trả về:
  1. Classification (domain + LOGIC/REQUEST)
  2. Danh sách `.md` cần đọc theo thứ tự (3–7 file, không phải tất cả)
  3. Pre-flight flags (DB/auth/migration/cross-trục)
  4. Câu confirm để lock scope với user

Mục đích: session mới (hoặc teammate mới) nắm đúng context tối thiểu, không load cả hồ sơ, không miss invariant.

## 4. Quy trình giao việc chuẩn / Standard hand-off

1. Lead viết brief: mục tiêu + **danh sách file được phép đụng** + facts canonical
2. Teammate chạy `/fl` (hoặc đọc README app-map) → đọc đúng docs cần
3. Teammate làm trong file set của mình, update doc cùng commit (invariant root [CLAUDE.md](../../CLAUDE.md))
4. Teammate báo cáo: file đã tạo/sửa + điểm cần lead review
5. Lead review + integrate

## 5. Cross-references

- Invariants chung: root [CLAUDE.md](../../CLAUDE.md)
- Index hồ sơ: [README.md](README.md)

---

**Last updated**: 2026-06-10
