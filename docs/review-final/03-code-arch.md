# 03 — Review cuối: Chất lượng code & Kiến trúc

> Đánh giá read-only (không sửa `src/`). Ngày: 2026-06-10. Phạm vi: ForFish — Next.js 16 App Router + TS + Tailwind v4.

---

## 0. Tóm tắt sức khỏe build/test

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| `npx tsc --noEmit` | ✅ PASS | Sạch khi chạy độc lập. **Lưu ý**: lần chạy đầu có lỗi giả TS2322 ở `route-plan.test.ts` do `tsconfig.tsbuildinfo` (incremental cache) cũ — chạy lại / `--incremental false` thì sạch. |
| `npm run build` | ✅ PASS | Turbopack, compile 9.3s, TypeScript 19.9s, 13/13 trang static OK. 11 route (1 dynamic `/api/storms`, còn lại static). |
| `npx vitest run` | ✅ PASS | **76/76 test pass, 7 test file**. |

**Cảnh báo về độ ổn định (flaky):** Khi chạy `tsc`, `vitest`, `build` **đồng thời** ở background, vitest từng báo 1–2 test fail ở `route-plan.test.ts` (`currentKmh` nội suy dòng chảy, tuyến bẻ theo dòng) và `tsc` báo lỗi type. Chạy lại **từng cái độc lập** thì tất cả sạch (route-plan: 29/29). Nguyên nhân: tranh chấp cache dùng chung (`.tsbuildinfo`, Vite transform cache) khi chạy song song — **không phải lỗi code**. → Khuyến nghị CI: chạy tuần tự, hoặc xóa `tsconfig.tsbuildinfo` trước `tsc` để tránh báo động giả.

**Test count + coverage `lib/`:**
- Có test (7 module): `crew`, `geofence`, `marine-weather`, `ocean-map`, `route-plan`, `storms`, `weather-codes`.
- **CHƯA có test (5 module)**: `sea` (công thức điểm đi biển — THANG ĐIỂM cốt lõi của Trục 1), `route-weather` (adapter Open-Meteo + nội suy song tuyến), `depth-grid` (giải mã 2-bit), `documents` (expiry status — logic ngày tháng dễ sai), `format` (xem mục dead code).

---

## 1. Phát hiện theo mức độ nghiêm trọng

### 🟠 CAO — Trùng lặp định dạng + dead code (vi phạm chính `lib/format.ts`)

**`src/lib/format.ts` là dead code 100%.** Không file nào `import` từ `@/lib/format` (kiểm chứng: `grep -rn "@/lib/format" src` → KHÔNG có kết quả). File này được tạo ra với comment ghi rõ mục đích "gộp các bản copy-paste rải rác (formatVnDate ×6, tiền VND nhiều nơi)" — **nhưng chưa bao giờ được dùng**, trong khi các bản copy-paste vẫn còn nguyên:

- `formatVnDate` được **định nghĩa lại cục bộ ở 6 component**:
  - `src/components/trip-log.tsx:62`
  - `src/components/document-vault.tsx:385`
  - `src/components/crew-list.tsx:626`
  - `src/components/price-board.tsx:36`
  - `src/components/supply-catalog.tsx:22`
  - `src/components/maintenance-reminders.tsx:518`
- Định dạng tiền VND (`toLocaleString("vi-VN") + " đ"`) lặp lại rải rác:
  - `src/components/trip-log.tsx:53-59` (`formatVnd` cục bộ)
  - `src/components/trip-split.tsx:158,164` (`parseVnd` + format cục bộ)
  - `src/components/crew-list.tsx:225,558,636`
  - `src/components/price-board.tsx:27`
  - `src/components/supply-catalog.tsx:91`
- `formatVndShort` trong `format.ts:18` **không được dùng ở đâu cả** (`grep formatVndShort src` chỉ ra chính dòng định nghĩa).

→ **Hành động**: thay 6 bản `formatVnDate` cục bộ + các bản format/parse VND bằng import từ `@/lib/format`; xóa `formatVndShort` nếu vẫn không dùng; thêm test cho `format.ts`. Đây đúng là loại trùng lặp mà file format.ts định ra để diệt.

### 🟠 CAO — Tài liệu kiến trúc lệch thực tế (route + component)

`docs/app-map/02-architecture.md` mô tả **cấu trúc route CŨ** (4 trục: `/giay-to`, `/gia-ca`, `/van-hanh`, `/thuyen-vien`). Thực tế app đã **tái cấu trúc taxonomy** theo đối tượng (`docs/design-review/00-plan §A`):

- Nav + trang chủ giờ là **5 mục**: `/` · `/ngu-truong` (Ra khơi) · `/tau` (Tàu) · `/nguoi` (Bạn thuyền) · `/tien` (Tiền) — xem `src/components/bottom-nav.tsx:18-24` và `src/app/page.tsx:20-49`.
- 4 route cũ giờ là **redirect stub** sang route mới (`src/app/giay-to/page.tsx` → `/tau`, `gia-ca` → `/tien`, `van-hanh` → `/tau`, `thuyen-vien` → `/nguoi`). Đây là cách xử lý SẠCH (không phải dead route), nhưng **doc không hề nhắc**.
- Doc **không liệt kê** các component/route mới: `/tau`, `/nguoi`, `/tien` (gom tab), `sell-guide.tsx`, `layer-sheet.tsx`, các UI primitive `ui/snap-sheet.tsx`, `ui/tabs.tsx`, `ui/status-banner.tsx`, `ui/primitives.tsx`, và `src/data/wholesalers/*`, `src/data/seafood-buyers.ts`, `src/data/market-channels.ts`, `src/data/fishing-ports.ts`, `src/data/fines.ts`.
- Doc nhắc `lib/route-plan.ts` "giảm tốc theo hướng sóng (Kwon-lite)" nhưng **không nhắc tính năng dòng chảy đại dương** (`currentKmh`/`currentToDeg`, `ocean_current_velocity` từ Open-Meteo Marine) đã được thêm vào `route-plan.ts` + `route-weather.ts`.

→ **Hành động**: cập nhật `02-architecture.md` (bảng route, folder layout, mục §5 component) cho khớp taxonomy 5-mục hiện tại. Đây là tài liệu "single source" mà AGENTS.md/CLAUDE.md trỏ tới — lệch thì agent đời sau sẽ code sai.

### 🟡 TRUNG BÌNH — Trùng lặp sheet/dialog: primitive dùng chung chỉ áp một nửa

Đã có primitive dùng chung tốt, **a11y đầy đủ**: `ui/bottom-sheet.tsx` (modal focus-trap, comment ghi "thay 5 bản copy-paste"), `ui/confirm-dialog.tsx` ("thay 4 bản copy-paste"), `ui/snap-sheet.tsx` (sheet bản đồ 3 nấc).

Nhưng adoption **không đồng đều**:
- ✅ Dùng primitive: `sell-guide.tsx` (BottomSheet + ConfirmDialog), `layer-sheet.tsx` (BottomSheet), `fishing-map-view.tsx` (SnapSheet).
- ❌ **VẪN dùng markup sheet/dialog inline** (không dùng primitive): `document-vault.tsx` (sheet ở `:281`, dialog ở `:207`), `crew-list.tsx`, `trip-log.tsx`, `maintenance-reminders.tsx`. Kiểm chứng: `grep "BottomSheet|ConfirmDialog|aria-modal|role=\"dialog\"" trên 4 file này → KHÔNG có kết quả`.

→ Hệ quả: 4 component cũ nhất **bỏ lỡ a11y** mà primitive đã làm sẵn (focus-trap, Escape đóng, trả focus, khóa cuộn nền). → **Hành động**: refactor 4 component này dùng `BottomSheet`/`ConfirmDialog`.

### 🟢 THẤP — Coverage test thiếu ở module logic cốt lõi

`lib/sea.ts` (`scoreDay`/`levelOf` — thang điểm đi biển 1–100, logic quan trọng nhất Trục 1), `lib/documents.ts` (expiry status — logic ngày dễ lệch biên), `lib/route-weather.ts` (nội suy song tuyến), `lib/depth-grid.ts` (giải mã bit) đều **chưa có test riêng** (depth-grid/route-weather có test gián tiếp qua `route-plan.test.ts`). → Thêm unit test cho `sea.ts` và `documents.ts` (logic thuần, dễ test, rủi ro hồi quy cao).

---

## 2. Các invariant quan trọng — ĐỀU CÒN NGUYÊN ✅

### localStorage keys (`forfish.*`) — naming nhất quán, hydrate-after-mount đầy đủ

| Key | File | Ghi chú |
|---|---|---|
| `forfish.documents.v1` | `document-vault.tsx:31` | |
| `forfish.trips.v1` | `trip-log.tsx:18` | |
| `forfish.crew.v1` | `crew-list.tsx:30` | |
| `forfish.maintenance.v1` | `maintenance-reminders.tsx:22` | |
| `forfish.buyers.v1` | `sell-guide.tsx:331` | |
| `forfish.boat.v1` | `route-planner.tsx:49` | thông số tàu cho dẫn đường |
| `forfish.port.v1` | `sea-forecast.tsx:21` **và** `fishing-map-view.tsx:117` | key **dùng chung** giữa 2 component (cảng đã chọn) — đồng nhất, OK |
| `forfish.sea.{portId}.v2` | `sea.ts:96` | cache dự báo theo cảng, có version v2 |

- Naming **nhất quán**: prefix `forfish.`, có version suffix (`.v1`/`.v2`), bump version khi đổi shape (đúng quy ước doc 04 §72).
- **Hydrate-after-mount ở MỌI component**: pattern `useState(rỗng)` → `useEffect` hydrate → gate bằng `ready`/`mounted` (vd `crew-list.tsx:53-61`, `document-vault.tsx:60-66`, `sell-guide.tsx:356-366`). **Không đọc localStorage lúc render đầu** → không có rủi ro SSR/CSR mismatch.

### Demo mode / Supabase — fallback `null` còn nguyên ✅

- `src/lib/supabase/client.ts:11` và `server.ts:11`: cả hai **`return null` khi env trống** (không throw), đúng invariant doc 02 §4.
- App chạy hoàn toàn bằng localStorage + dữ liệu tĩnh khi chưa cấu hình Supabase. `document-vault.tsx` seed `demoDocuments()` để không bao giờ trống.
- **Không có feature nào hard-crash khi thiếu env**: build static 13/13 trang OK với `.env.local` chỉ có URL+anon key (Supabase chưa thực sự dùng trong UI runtime — vẫn là demo mode).

### Rủi ro hotspot — kiểm soát tốt ✅

- **Map lazy-load CÒN NGUYÊN**: `fishing-map.tsx:9` dùng `next/dynamic` với `ssr:false` + loading fallback; thư viện MapLibre (nặng) không lọt vào bundle các trục khác. Build xác nhận `/ngu-truong` không kéo map vào trang khác.
- **Fetch có error state đầy đủ**:
  - `sea-forecast.tsx:32,44,47,91` — `setError` + `.catch` + UI báo lỗi.
  - `route-planner.tsx:168,187,231,242,341` — nhiều state lỗi cụ thể bằng tiếng Việt thân thiện ("mạng có thể đang yếu, thử lại giúp").
  - `storm-banner.tsx:31` — fail thì **render null** (KHÔNG nói bừa "không có bão"), đúng invariant.
- **Không route nào có nguy cơ 500**: `/api/storms/route.ts` fail → trả `{ok:false}`, client im lặng. Các page còn lại là Server Component thuần dữ liệu tĩnh, không fetch lúc render.
- **Adapter discipline TỐT**: tên vendor (GDACS, Open-Meteo, NASA GIBS, EMODnet/GEBCO, OpenSeaMap, CMEMS) chỉ xuất hiện trong **comment + URL fetch ở lib adapter** (`storms.ts:3`, `route-weather.ts:123`, `ocean-map.ts`...) — **KHÔNG rò vào domain types**. `src/data/**` không hề chứa tên vendor (`grep` data folder → 0 kết quả). Domain type sạch (vd `Wholesaler`, `FishingPort`, `StormCheck`).

### Trích dẫn dữ liệu `src/data/` — kỷ luật mẫu mực ✅

Mọi file dữ liệu tĩnh đều ghi rõ **ngày tổng hợp + URL nguồn + nhãn "THAM KHẢO"**:
- `port-prices.ts`, `supplies.ts`, `fines.ts` (NĐ 38/2024 + 301/2025, kèm disclaimer "KHÔNG phải tư vấn pháp lý"), `ports.ts` (tọa độ "đã kiểm chứng Open-Meteo 2026-06-10"), `wholesalers/types.ts` ("tên/SĐT THẬT từ nguồn công khai, KHÔNG bịa, gọi xác minh trước"). Type đều có field `source?: string`.

### Dead/leftover code

- Không còn `coming-soon`/`ComingSoon` trong `src/` (chỉ còn nhắc trong `README.md` + `.claude/agents/context-router.md` — không phải code chạy).
- Route cũ là redirect stub có chủ đích (không phải dead).
- **Dead code thật sự duy nhất: `src/lib/format.ts`** (xem mục 1).

---

## 3. Punch list dọn dẹp (ưu tiên giảm dần)

1. **[CAO] Áp dụng `lib/format.ts`**: thay 6 bản `formatVnDate` cục bộ + các bản format/parse VND ở `trip-log`, `trip-split`, `crew-list`, `price-board`, `supply-catalog`, `maintenance-reminders`, `document-vault` bằng import từ `@/lib/format`. Xóa `formatVndShort` nếu không dùng. Thêm test cho `format.ts`.
2. **[CAO] Đồng bộ `docs/app-map/02-architecture.md`** với taxonomy 5-mục thực tế: cập nhật bảng route (kèm các redirect stub), folder layout (thêm `sell-guide`, `layer-sheet`, `ui/snap-sheet|tabs|status-banner|primitives`, `data/wholesalers`, `data/seafood-buyers`...), và tính năng dòng chảy trong `route-plan.ts`.
3. **[TRUNG] Refactor 4 component CRUD cũ** (`document-vault`, `crew-list`, `trip-log`, `maintenance-reminders`) dùng `ui/bottom-sheet` + `ui/confirm-dialog` để được a11y miễn phí + xóa markup inline trùng lặp.
4. **[THẤP] Thêm unit test** cho `lib/sea.ts` (scoreDay/levelOf) và `lib/documents.ts` (expiry status).
5. **[THẤP] CI ổn định**: chạy `tsc`/`vitest`/`build` tuần tự (hoặc xóa `tsconfig.tsbuildinfo` trước `tsc`) để tránh báo động giả do tranh chấp cache.
6. **[THẔP] Để ý** `formatVndShort` đã định nghĩa sẵn — nếu các ô thống kê (trip-log/trip-split) muốn hiển thị gọn "12,5 tr" thì dùng luôn, khỏi viết lại.

---

## 4. Kết luận (verdict)

**Sức khỏe: TỐT — sẵn sàng tiếp tục phát triển.** Build sạch, type sạch, 76/76 test pass (khi chạy độc lập). Các invariant kiến trúc cốt lõi — demo mode fallback `null`, hydrate-after-mount, map lazy-load, fetch error state, storm fail-silent, adapter discipline, trích dẫn dữ liệu — **đều còn nguyên và làm tốt**. Không có route nào nguy cơ 500, không feature nào crash khi thiếu env.

**Nợ kỹ thuật chính là kỷ luật DRY + đồng bộ tài liệu, KHÔNG phải lỗi chức năng:** (a) `lib/format.ts` viết ra để diệt trùng lặp nhưng chưa được áp — trùng lặp `formatVnDate` ×6 vẫn còn; (b) doc kiến trúc lệch một thế hệ route; (c) primitive sheet/dialog mới chỉ áp một nửa. Đây là dọn dẹp cơ học, rủi ro thấp, nên làm sớm trước khi codebase lớn thêm và các bản copy-paste sinh sôi.

---

**Last updated**: 2026-06-10
