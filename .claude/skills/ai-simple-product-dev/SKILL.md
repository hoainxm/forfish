---
name: ai-simple-product-dev
description: >-
  Methodology giữ codebase thân thiện AI-agent (12 nguyên tắc: hierarchical
  context, app-map, context routing, doc+test sync, pre-flight risk, automated
  enforcement, generated-vs-authored, cross-repo contract, ops layer,
  self-optimization). Dùng khi bootstrap/retrofit doc cho repo mới, khi thấy
  triệu chứng "AI bịa file/hàm", "context quá dài", "doc lệch code", hoặc khi
  project phình (root doc >6k token, >20 file, nhiều repo). Cho ForFish: tham
  chiếu để kiểm tra mình còn theo đúng phương pháp không.
---

# ai-simple-product-dev — methodology skill

> Nguồn gốc: github.com/Long-Forfun/ai-simple--skill-product-dev.
> ForFish ĐÃ áp dụng phương pháp này (CLAUDE.md ghi "nguyên tắc 8/12"). Skill
> này = bản tham chiếu + checklist khi bootstrap repo mới hoặc audit độ trôi doc.

## Triết lý 1 câu

"AI là đồng nghiệp chỉ đọc doc của bạn. Doc tốt = đồng nghiệp tốt." Không làm AI
thông minh hơn — ép team viết doc tốt hơn, rồi **enforce bằng máy** (hook/CI),
không dựa kỷ luật tay: *invariant tự giác = invariant sẽ chết*.

## 12 nguyên tắc + ForFish ở đâu

| # | Nguyên tắc | Tóm tắt | ForFish hiện thực |
|---|---|---|---|
| 1 | Hierarchical context | Root doc < 6k token; chi tiết xuống module | `CLAUDE.md` (~1k tok) + `docs/app-map/` |
| 2 | App-map pattern | Mỗi file 1 chủ đề canonical, đánh số | `docs/app-map/01–07` + `README.md` index |
| 3 | Context routing | Slash command + sub-agent ra danh sách file cần đọc | `/fl` + agent `context-router` |
| 4 | Doc + Test sync | Code đổi → doc + test cùng commit | Bảng invariant trong `CLAUDE.md` + hook chặn |
| 5 | LOGIC vs REQUEST | Phân loại câu hỏi (đọc) vs lệnh (sửa code) | Mục trong `CLAUDE.md` |
| 6 | Pre-flight risk tiers | 🟢 reversible / 🟡 cẩn thận / 🔴 irreversible | Flags 🔴🟡 trong `CLAUDE.md` |
| 7 | Memory as feedback | Lưu sở thích user qua các phiên | `.claude/.../memory/` |
| 8 | Automated enforcement | Pre-commit hook + CI là "răng" | `.githooks/pre-commit` (covers-gate, contract, spacing, BOM) |
| 9 | Generated vs authored | Máy sinh schema/route; người viết lý do | `docs/app-map/_generated/doc-status.md` |
| 10 | Cross-repo contract | File contract versioned giữa repo | `docs/contracts/sdwork-assets.contract.md` |
| 11 | Ops layer | Registry service ngoài + runbook + state-registry | `docs/app-map/ops/*` |
| 12 | Self-optimization | covers/last_verified/ttl + WRITE/READ gate + `/audit` | `/audit` + frontmatter `covers:`/`gate:` |

## Layer nào bật khi nào

- **Foundation (1–7)**: mọi project, ngay từ commit đầu.
- **Scale (8–10)**: bật khi root doc > 6k token, > 20 file, hoặc nhiều repo.
- **Ops (11)**: bật khi có process nền / service ngoài / state file cần thủ tục.
- **Self-opt (12)**: bật khi doc bắt đầu trôi — đo bằng `/audit`.

## Khi bootstrap repo MỚI (workflow)

1. Đọc 12 nguyên tắc (bảng trên).
2. Copy template vào root: `CLAUDE.md`, `docs/app-map/README.md`, `.claude/commands/fl.md`, `.claude/agents/context-router.md`.
3. Cài hook NGAY: `mkdir .githooks` → copy `pre-commit` → `git config core.hooksPath .githooks` → verify `sh .githooks/pre-commit --self-test`.
4. Kiểm tra: phiên AI mới đọc root có đủ context không.
5. Enforce doc+test sync từ commit đầu.
6. Bật layer 8–12 khi trigger kích hoạt.

CLI thay thế bước 2–3: `npx ai-simple init` → `npx ai-simple doctor`.

## Khi AUDIT repo đang chạy (ForFish)

- Chạy `/audit` (skill) → điểm + backlog tối ưu theo 12 nguyên tắc.
- Quét doc trôi: `sh scripts/doc-health-report.sh`.
- Mỗi doc app-map có `covers:` → khi code trong vùng đó đổi mà doc không re-verify, hook cảnh báo (gate: warn) hoặc chặn (gate mặc định).
- Frontmatter chuẩn cho doc gắn code:
  ```
  covers: <path1>, <path2>
  last_verified: YYYY-MM-DD
  ttl_days: 90
  gate: warn        # bỏ dòng này = gate chặn cứng
  ```

## Liên quan

- Audit định kỳ: skill `/audit`.
- Route context theo task: skill `/fl`.
- Ops ForFish: `docs/app-map/ops/external-services.md`, `ops/runbook.md`, `ops/state-registry.md`.
