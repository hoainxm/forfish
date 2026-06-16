# Session log — SDFish

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

### #7 — B1 checklist xuất bến (tiếp tục đợt B)
- **Loại**: REQUEST (tiếp tục tự động).
- **B1 ✅ — Checklist xuất bến theo Lmax + đèn xanh-đỏ** (đợt B, nhóm E):
  - Logic thuần + test: `boatZone`/`departureCheck` trong `lib/departure-check.ts` (7 test) → 253/253 pass. Bộ giấy bắt buộc theo chiều dài (NĐ 26/2019 tham khảo): giấy phép ≥6m · đăng kiểm/chứng chỉ/sổ danh bạ ≥12m · ATTP/VMS ≥15m + bảo hiểm thuyền viên.
  - Component `departure-checklist.tsx`: đèn xanh/vàng/đỏ — app tự gật phần ĐỌC ĐƯỢC (hạn giấy tờ + bảo hiểm thuyền viên), VMS/sổ danh bạ chỉ NHẮC tự kiểm. Đọc chung tủ giấy tờ (`loadDocs` export) + `useCrew` + `useBoats`; chưa biết Lmax → mời nhập. Banner "dữ liệu mẫu" khi seed.
  - Wire `tau-tabs.tsx`: checklist nằm trên đầu tab Giấy tờ (giữ 4 tab).
  - Export thêm `loadDocs`/`DOCS_STORAGE_KEY` từ `document-vault.tsx` (đọc chung 1 nguồn).
  - Doc sync: 02 (§2 /tau + §3 component), 06 (module-map nhóm E).
  - Verify: tsc + eslint clean, npm test 253/253.
- **File**: `src/lib/departure-check.ts`, `src/lib/__tests__/departure-check.test.ts`, `src/components/departure-checklist.tsx`, `src/components/tau-tabs.tsx`, `src/components/document-vault.tsx`, `docs/app-map/{02,06}*.md`, `docs/session-log.md`.
- **Tiếp**: **B2 — NHẮC mốc eCDT/NKKT theo cỡ tàu** (effort thấp, gắn urgent-strip).

### #8 — B2 nhắc mốc eCDT/NKKT
- **Loại**: REQUEST (tiếp tục tự động).
- **B2 ✅ — Nhắc mốc khai báo theo cỡ tàu**:
  - Logic thuần + test: `complianceMilestones` trong `lib/compliance.ts` (4 test) → 257/257. eCDT 01/3/2026 (mọi tàu) + NKKT theo Lmax (≥24m: 1/7/2026 · 15–24m: 1/9/2026 · 12–15m: 1/1/2027 · <12m: chưa bắt buộc) — nguồn TT 81/2025.
  - UI: thêm card "Mốc khai báo phải nhớ" trong `departure-checklist.tsx` — badge Đã bắt buộc / Còn N ngày + disclaimer "app chỉ NHẮC, khai trên hệ thống nhà nước".
  - Doc sync: 02 (§3 component), 06 (nhóm E), 07 (§5 screen map /tau — covers gate).
  - Verify: tsc + eslint clean, npm test 257/257.
- **File**: `src/lib/compliance.ts`, `src/lib/__tests__/compliance.test.ts`, `src/components/departure-checklist.tsx`, `docs/app-map/{02,06,07}*.md`, `docs/session-log.md`.
- **Tiếp**: đợt B còn **B3 cảnh báo VMS** (cần nguồn dữ liệu VMS — 🟡 hỏi user trước) + **B4 điểm rủi ro IUU**. Cân nhắc làm C1 (hồ sơ chuyến PDF/QR) trước vì B3 chặn bởi nguồn ngoài.

### #9 — B3/B4 chặn nguồn ngoài; làm C1 hồ sơ chuyến
- **Loại**: REQUEST (tiếp tục tự động).
- **B3 cảnh báo VMS ⏸ / B4 điểm rủi ro IUU ⏸**: chặn bởi nguồn dữ liệu ngoài (feed VMS · dữ liệu IUU tỉnh) — cờ 🟡 data vendor, cần user quyết nguồn, KHÔNG bịa. Flag chờ.
- **C1 ✅ — Hồ sơ chuyến biển (PDF in được)** (đợt C, nhóm B):
  - Component `trip-dossier.tsx`: gói 1 chuyến (tàu + thu/tổn/lãi + thuyền viên + giấy tờ còn hạn) thành bản in được; nút In/Lưu PDF (`window.print`). Đọc chung useBoats/useCrew/loadDocs. Tái dùng logic đã test (`profitOf`, `getExpiryStatus`) → không thêm test (UI composition).
  - `globals.css`: `@media print` `.print-area`/`.no-print` cô lập vùng in.
  - Wire `trip-log.tsx` (nút "Hồ sơ chuyến (PDF)" mỗi chuyến) + `money-insights.tsx` (overlay TripDossier).
  - QR truy xuất xác minh: ⏸ để sau (cần backend cấp URL).
  - Doc sync: 02 (§2 /tien + §3 component), 06 (nhóm B), 07 (§7 action→expectation).
  - Verify: tsc + eslint clean, npm test 257/257.
- **File**: `src/components/trip-dossier.tsx`, `src/components/trip-log.tsx`, `src/components/money-insights.tsx`, `src/app/globals.css`, `docs/app-map/{02,06,07}*.md`, `docs/session-log.md`.
- **Tiếp**: C3 chào bán Zalo 1 chạm (low, no dep) hoặc nhóm F "sao chép chuyến cũ". B3/B4 + cross-cutting (offline X1, voice X2, người-nhà X3) chờ user quyết hướng.

### #10 — F1 lặp lại chuyến
- **Loại**: REQUEST (tiếp tục tự động).
- **F1 ✅ — "Lặp lại chuyến"** (nhóm F, chuẩn bị chuyến nhanh): nút trên thẻ chuyến `trip-log.tsx` → mở form chuyến MỚI (id mới + ngày hôm nay) prefill số tổn chuyến cũ, không đè chuyến cũ. UI thuần, no dep, no new test. Date.now() đặt trong onClick handler (tránh react-hooks/purity).
  - Doc sync: 02 (§2 /tien), 06 (nhóm F), 07 (§7 action→expectation).
  - Verify: tsc + eslint clean, npm test 257/257.
- **File**: `src/components/trip-log.tsx`, `docs/app-map/{02,06,07}*.md`, `docs/session-log.md`.

---

## Tồn đọng cần USER quyết hướng (không tự làm — chặn bởi nguồn ngoài / hạ tầng lớn)

| Việc | Vì sao chờ |
|---|---|
| B3 cảnh báo VMS | Cần feed dữ liệu VMS (🟡 data vendor) — chưa có nguồn truy cập |
| B4 điểm rủi ro IUU | Cần dữ liệu tỉnh công bố — chưa có nguồn |
| C1-QR truy xuất | Cần backend public cấp URL xác minh (PDF đã xong) |
| C3 chào bán Zalo | Cần CRUD "người mua đã lưu" để có giá trị thật (share trần thì thấp) |
| X1 offline-first | Hạ tầng lớn (service worker + sync) — quyết kiến trúc |
| X2 voice + ảnh | Quyết phạm vi từng màn + nguồn STT |
| X3 vai trò người-nhà | Cần multi-role + auth model (hiện B2C 1 vai) |

→ Backlog buildable-không-cần-quyết đã cạn (A1–A3, B1, B2, C1, F1 xong). Các mục trên cần user chọn nguồn dữ liệu / hướng kiến trúc trước.

---

**Quy ước**: việc xong = ✅ · hủy = ✋ · treo = ⏸. Mỗi message mới thêm `### #n` dưới ngày tương ứng.

---

## 2026-06-16

### #11 — Đổi tên SDFish + nền deploy iOS/Android (PWA + Capacitor-ready)
- **Loại**: REQUEST (plan-approved). Quyết định user: PWA+plumbing · giữ `forfish.*` keys · rename chỉ brand/package/docs (giữ infra IDs).
- **A — Rebrand ✅**: ForFish→SDFish ở string hiển thị (metadata `layout.tsx`, 5 page title, PageHeader kicker `page.tsx`, `trip-dossier` 2 chỗ, user-agent 2 API route, "Khách SDFish") + `package.json` name + titles README/CLAUDE/audit-history/session-log. GIỮ: 16 `forfish.*` key, `forfish-gateway`, `source_page='forfish'`, `[ForFish]` prefix CRM, repo, Supabase ref, `@sdvico.local`.
- **B — PWA ✅**: `app/manifest.ts` (→ /manifest.webmanifest), `public/sw.js` (offline shell, network-first nav+/api, cache-first asset), `sw-register.tsx` (prod-only), `public/icon.svg` + `scripts/generate-icons.mjs` (sharp) → `public/icons/*`. `layout.tsx` thêm manifest/icons/appleWebApp.
- **C — Capacitor-ready ✅**: `lib/api-base.ts` (`apiUrl()`, +5 test) thay 14 chỗ tham chiếu `/api/*` (12 fetch + sea-scalar + contour tile URL). `.env.local.example` thêm `NEXT_PUBLIC_API_BASE`. `capacitor.config.ts` (appId `vn.sdvico.sdfish`) + scripts. Cài devDep: sharp, @capacitor/core, @capacitor/cli. CHƯA `cap add` (cần Mac/SDK).
- **D — Docs ✅**: `ops/native-deploy.md` (mới) + index README; 02 (§1 stack + §3 folder); 07 re-verify; CLAUDE/README rename.
- **Verify**: tsc + eslint clean · npm test **262/262** (+5 api-base) · `npm run build` OK (`/manifest.webmanifest` prerendered) · `npm run icons` sinh đủ PNG.
- **Ngoài phạm vi** (cần môi trường sau): build binary iOS (Mac/Xcode) + Android (Studio/SDK), tài khoản Apple/Google, chốt hosting URL cho `NEXT_PUBLIC_API_BASE`, rename infra IDs (phối hợp ngoài).
- **File**: `src/lib/api-base.ts`(+test), 14 fetch-site files, `src/app/{layout,manifest,page,*/page}.tsx`, `src/components/{sw-register,trip-dossier,urgent-strip,sdvico-*}.tsx`, `src/app/api/{port-prices,fuel-price,sdvico/request}/route.ts`, `public/{icon.svg,sw.js,icons/*}`, `scripts/generate-icons.mjs`, `capacitor.config.ts`, `.env.local.example`, `package.json`, `docs/app-map/{02,07,README,ops/native-deploy}*.md`, `CLAUDE.md`, `README.md`, `docs/{audit-history,session-log}.md`.
