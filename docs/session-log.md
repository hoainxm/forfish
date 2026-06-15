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
- **Commit P1+A1 ✅**: `e39cb2b` trên `main` (pre-commit hook active từ P0, PASS).
- **A2 ✅ — Máy tính chuyến biển** (backlog đợt A):
  - Logic thuần + test: `estimateTrip` trong `lib/trip-estimate.ts` (3 test: làm sạch âm/NaN, hoà vốn ceil) → 240/240 pass.
  - Component `trip-estimator.tsx`: nhập ngày + dầu/ngày + giá dầu + chi khác + giá cá → tổn dự kiến + %dầu + sản lượng hoà vốn (kg). Tính live, prefill giá DO LIVE (`fetchFuelPrice`), sửa tay được.
  - Wire `money-insights.tsx`: tab Hiệu quả thành 4 chip (… · **Tính chuyến** · …).
  - Doc sync: 02 (§2 /tien + §3 component), 07 (§3 object model), 06 (module-map nhóm A+C).
  - Verify: tsc + eslint clean, npm test 240/240.
- **File**: `docs/app-map/02-architecture.md` (P1+A2), `src/lib/trip-estimate.ts`, `src/lib/__tests__/trip-estimate.test.ts`, `src/components/trip-estimator.tsx`, `src/components/money-insights.tsx`, `docs/app-map/06-jtbd-quan-ly-tau.md`, `docs/app-map/07-design-spec.md`, `docs/session-log.md`.
- **Còn nợ**: backlog đợt A còn **A3** (sổ công nợ đa đối tượng).

### #6 — A3 sổ công nợ, tiếp tục tự động (không tự dừng hỏi)
- **Loại**: REQUEST. User: "chỉ dừng khi được yêu cầu, không tự dừng rồi hỏi" → ghi memory [[autonomous-build-flow]].
- **A3 ✅ — Sổ công nợ đa đối tượng** (backlog đợt A, khoảng trống vàng nhóm C):
  - Logic thuần + test: `balanceOf`/`totalOutstanding`/`totalPaid`/`demoDebts` trong `lib/debts.ts` (6 test) → 246/246 pass.
  - Component `debt-ledger.tsx`: chủ nợ (đại lý dầu/nậu/ngân hàng/khác) + dư nợ + sổ vay/trả (sheet), CRUD localStorage `forfish.debts.v1`, sổ mẫu tự xưng (theo crew-list pattern).
  - Wire `tien/page.tsx`: thêm tab thứ 3 **Công nợ** (deep-link `?tab=`).
  - Doc sync: 02 (§2 /tien 3 tab + §3 component), 07 (§3 object model 8 object + §4 nav 3 tab), 06 (module-map nhóm C phủ xong).
  - Verify: tsc + eslint clean, npm test 246/246.
- **File**: `src/lib/debts.ts`, `src/lib/__tests__/debts.test.ts`, `src/components/debt-ledger.tsx`, `src/app/tien/page.tsx`, `docs/app-map/{02,06,07}*.md`, `docs/session-log.md`.
- **Tiếp**: backlog đợt A xong (A1/A2/A3). Sang đợt B — **B1 checklist xuất bến theo Lmax**.

---

**Quy ước**: việc xong = ✅ · hủy = ✋ · treo = ⏸. Mỗi message mới thêm `### #n` dưới ngày tương ứng.
