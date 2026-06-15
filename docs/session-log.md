# Session log — ForFish

> Nhật ký thay đổi theo từng message để **kiểm soát + tóm gọn**. Mỗi mục = 1 yêu cầu của user: ý định, loại (LOGIC/REQUEST), việc đã làm, file đụng, trạng thái. KHÔNG phải app-map (xem `docs/app-map/`), KHÔNG phải audit log (xem `docs/audit-history.md`). Append-only theo thời gian.

---

## 2026-06-15

### #1 — Phân tích codebase, chức năng thiếu, tổ chức UI
- **Loại**: LOGIC (phân tích, không sửa code)
- **Làm**: map kiến trúc (14 route + 11 API + ~45 component + ~30 lib), tổ chức UI (dock 5 mục, taxonomy theo con tàu), liệt kê chức năng đã có/thiếu theo 4 trục + roadmap.
- **Phát hiện**: gap lớn = sổ tiền/công nợ đầy đủ · offline-first · voice/ảnh + vai trò người-nhà. Dead code `sea-forecast.tsx`. Doc 02 lệch (fishing-ports "chưa wire").
- **File**: — (không sửa)

### #2 — Audit + backlog ưu tiên
- **Loại**: REQUEST (chạy `/audit`)
- **Làm**: chấm 12 nguyên tắc → **88/110** (NG07 memory N/A). Vẽ backlog chức năng thiếu (đợt A/B/C + cross-cutting).
- **Top issue**: 🔴 `core.hooksPath` chưa set → enforcement hook DEAD dù self-test PASS.
- **File**: `docs/audit-history.md` (append 1 dòng audit).

### #3 — Áp P0 + P1 + P2
- **Loại**: REQUEST
- **P0 ✅**: `git config core.hooksPath .githooks` → hook enforcement đã sống lại.
- **P1 ✅** (làm ở #5): sửa doc 02 — thêm route `/cang` + component `port-directory.tsx`, sửa `fishing-ports` "đã wire 3 nơi".
- **P2 ✋ HỦY**: định xoá dead code `sea-forecast.tsx` → **user giữ lại** (có thể cần sau). Không xoá.
- **File**: git config (P0). Không sửa file nguồn.

### #4 — Giữ dead code, xây chức năng thiếu + lập session-log
- **Loại**: REQUEST
- **Làm — A1 Báo cáo lời/lỗ năm** (backlog đợt A, ROI cao nhất):
  - Logic thuần + test: `listYears` / `yearOf` / `monthOf` / `yearlyReport` trong `lib/trip-insights.ts` (8 test mới, 237/237 pass).
  - Component mới `trip-report.tsx`: tổng lãi/lỗ cả năm + tách theo tháng, chọn năm bằng chip. Đọc từ sổ `forfish.trips.v1` sẵn có, KHÔNG thêm dữ liệu.
  - Wire `money-insights.tsx`: tab Hiệu quả thành 3 section chip (Sổ lãi/lỗ · **Báo cáo năm** · Chia tiền).
  - Doc sync cùng commit: `02-architecture.md` (§2 /tien + §3 component), `07-design-spec.md` (§3 object model).
  - Verify: `tsc` clean · `eslint` clean · `npm test` 237/237.
- **Làm — control doc**: tạo file này (`docs/session-log.md`).
- **File**: `src/lib/trip-insights.ts`, `src/lib/__tests__/trip-insights.test.ts`, `src/components/trip-report.tsx`, `src/components/money-insights.tsx`, `docs/app-map/02-architecture.md`, `docs/app-map/07-design-spec.md`, `docs/session-log.md`.
- **Còn nợ**: P1 doc-02 fix (pending) · backlog đợt A còn A2 (máy tính chuyến biển), A3 (sổ công nợ).

### #5 — Dọn P1, commit, tiếp A2
- **Loại**: REQUEST
- **P1 ✅**: `02-architecture.md` — §2 thêm row `/cang`; §3 app tree thêm `cang/`, thêm component `port-directory.tsx`, sửa dòng `fishing-ports.ts` từ "CHƯA WIRE" → "wire 3 nơi".
- **Commit**: gộp A1 (#4) + P1 vào commit trên `main` (pre-commit hook đã active từ P0).
- **A2**: (đang làm — máy tính chuyến biển).
- **File**: `docs/app-map/02-architecture.md`, `docs/session-log.md` + (A2 bổ sung sau).

---

**Quy ước**: việc xong = ✅ · hủy = ✋ · treo = ⏸. Mỗi message mới thêm `### #n` dưới ngày tương ứng.
