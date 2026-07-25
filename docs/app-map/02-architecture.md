# 02 — Kiến trúc / Architecture: routes, components, demo mode

> **Mục đích / Purpose**: Bản đồ code thực tế — routes, folder layout, component map, và cơ chế demo mode fallback khi chưa có Supabase.

**Load khi / Load when**: thêm/sửa page, route, navigation, component; cần hiểu app chạy thế nào khi env trống.

covers: src/app
last_verified: 2026-07-25
<!-- re-verified: 2026-07-25n — GỌN MÀN HÌNH (quyết định sản phẩm): XOÁ lib/fish-age.ts + test (tuổi lớp cá không hiện ở đâu nữa — badge map, panel Ngư trường, thẻ cá trong sheet đều gỡ; /api/fish-forecast vẫn trả generatedAt nhưng không hiển thị). BỎ thẻ "Chuẩn bị đi biển" trong ra-khoi-controls → component mới pretrip-auto-notify.tsx (tự tải + 1 dòng tự ẩn 5s) + lib mới pretrip-auto.ts (cửa chặn 6h, key forfish.pretrip.lastRunAt.v1); pretrip.ts giữ phần tải, bỏ savedLine/doneLine -->
<!-- re-verified: 2026-07-25l — BỊT LỖ "mất sóng = bản đồ trắng": (a) glyph tự host public/fonts (Noto Sans Regular+Bold, OFL) thay CDN openmaptiles đã chết → chữ/số trên bản đồ mới thật sự hiện; (b) layer nền nước sea-bg + nền tối giản public/data/vn-coast.v1.json (lib/offline-basemap.ts, scripts/generate-coastline.mjs); (c) route mới /api/tiles/[src] + lib/tile-proxy.ts đưa hải đồ EMODnet + phao OpenSeaMap về same-origin; (d) sw.js v4: SHELL thêm coast/isobaths/depth-grid/font, install allSettled, kho ô riêng có trần 600 -->
<!-- re-verified: 2026-07-25 — offline chuẩn bị đi biển: sw.js SHELL thêm /ngu-truong (SDFISH_CACHE_V v3); lib mới pretrip.ts (tải sẵn trước khi rời bờ) + fish-age.ts (tuổi bản đồ cá); forecast-cache saveForecast trả boolean + dọn trước khi ghi + loadAll, bỏ loadLatest; forecast-grid chỉ lùi về đúng khung ngày + savedGridDays; /api/fish-forecast trả thêm generatedAt -->
<!-- re-verified: 2026-06-16 — §5 bổ sung ERDDAP/HYCOM vào timeout invariant (fix dự báo cá treo); fish-forecast route + hycom + client đã có AbortSignal.timeout -->
<!-- re-verified: 2026-06-15 — §5 isDemo invariant áp đủ doc-vault/maint/products/crew (seed-mẫu không ghi localStorage) -->
ttl_days: 90
gate: warn

---

## 1. Stack

- **Next.js 16** App Router + TypeScript (lưu ý: Next 16 có breaking changes — đọc `node_modules/next/dist/docs/` khi không chắc API)
- **Tailwind CSS v4** — design tokens khai báo trong `src/app/globals.css` qua `@theme` (xem [03-design-system.md](03-design-system.md))
- **Supabase** qua `@supabase/ssr` (browser + server client)
- **MapLibre GL** (`maplibre-gl` + `react-map-gl`) — bản đồ ngư trường Trục 1; NẶNG nên bắt buộc lazy-load qua `next/dynamic` `ssr:false` (`fishing-map.tsx`), không để lọt vào bundle các trục khác
- **Vitest** — test runner cho logic thuần trong `src/lib/` (`npm test`, config `vitest.config.ts`, test đặt tại `src/lib/__tests__/`)
- Deploy: **Vercel** (web) · Repo: github.com/Long-Forfun/ForFish (giữ tên repo cũ — infra)
- **PWA cài được** (2026-06-16): `app/manifest.ts` (→ `/manifest.webmanifest`), `public/sw.js` (service worker offline shell, network-first cho navigation + `/api/*`, cache-first asset; SHELL pre-cache `/` **+ `/ngu-truong`** — màn bà con mở giữa biển, **+ `/data/vn-coast.v1.json` + `/data/isobaths.v1.json` + `/data/depth-grid.v1.bin` + `/fonts/Noto%20Sans%20Regular/0-255.pbf`** = đủ vẽ bản đồ lúc mất sóng; install dùng `Promise.allSettled` từng file — một file hỏng KHÔNG làm trống cả vỏ như `addAll` cũ; ô bản đồ `/api/tiles/*` để RIÊNG kho `sdfish-tiles-v1` **trần 600 ô (~12 MB), quá thì bỏ ô cũ nhất** — không để xem bản đồ lâu là đầy máy; bump `SDFISH_CACHE_V` mỗi lần đổi shell, hiện `sdfish-v4`), `sw-register.tsx` (đăng ký prod-only), icon `image/logo sdfish.png` (bộ logo gốc) → `public/icons/*` (`npm run icons`, devDep `sharp`, auto crop mark + pad nền trắng bo). **Edge-to-edge native** (2026-06-16): `viewport.viewportFit:"cover"` + `.safe-pt/.safe-pb` + motion điềm đạm CSS (xem [03-design-system.md](03-design-system.md)). **Native-ready**: mọi fetch `/api/*` qua `lib/api-base.ts` (`apiUrl()` — web tương đối, native tuyệt đối qua `NEXT_PUBLIC_API_BASE`); `capacitor.config.ts` (appId `vn.sdvico.sdfish`). Chi tiết: [ops/native-deploy.md](ops/native-deploy.md)

## 2. Routes — mỗi trục một route

| Route | Trục | File | Trạng thái |
|---|---|---|---|
| `/` | — | `src/app/page.tsx` | Trang chủ / Home: các trục + nhắc việc gấp (`urgent-strip.tsx`) |
| `/ngu-truong` | 1 — Đánh bắt tốt hơn | `src/app/ngu-truong/page.tsx` | **MVP — MÀN HÌNH MAP-FIRST kiểu Google Maps** (2026-06-10: page = map full-screen `fixed`, KHÔNG cuộn dọc; mọi thứ là lớp nổi/sheet trên map — `fishing-map.tsx` → `fishing-map-view.tsx`): **(a)** lớp nổi: chip/banner tin bão trên cùng (`storm-banner.tsx` variant `overlay` + `src/lib/storms.ts` ← `/api/storms`), badge lớp+ngày ảnh (bấm = mở chọn lớp), FAB "Lớp"/"Tàu tôi" cột phải; **(b)** chọn lớp qua `layer-sheet.tsx` (radio: **HẢI ĐỒ độ sâu EMODnet — MẶC ĐỊNH khi mở, chuẩn app hàng hải, nhớ lựa chọn `forfish.maplayer.v1`** / SST anomaly / phù du / ảnh mây qua `src/lib/ocean-map.ts` + legend + toggle phao đèn OpenSeaMap; ranh giới + bão + nhãn chủ quyền LUÔN bật — xem docs/research/09); **(c)** sheet đáy 3 nấc `ui/snap-sheet.tsx` — sau audit 2026-06-10 chỉ còn MỘT chế độ "gió sóng chỗ đang xem": mở app = điểm đặt sẵn tại CẢNG NHÀ (`forfish.port.v1`, 10 cảng `src/data/ports.ts`, đổi qua select "Cảng nhà của tôi" cuối sheet), chạm biển = chỗ chạm (nút "Về cảng" hiện ở mọi nấc); nội dung: chip chọn ngày 1–10 + thẻ điểm (`marine-weather.ts` + thang `sea.ts`) + cảnh báo nước cạn tại điểm (`depth-grid.ts` hạng 1–2) + **dẫn đường tiết kiệm dầu** (`route-planner.tsx` ← `route-plan.ts`/`route-weather.ts`, thông số tàu `forfish.boat.v1`; có tuyến → sheet GIỮ NGUYÊN, fitBounds chừa đáy) + gió/sóng + mưa/dông + độ tin `forecastConfidence` + cảnh báo ranh giới `geofence.ts` (chỉ khi gần); vị trí nói kiểu "Cách cảng X ~Y hải lý hướng Z", toạ độ số ở cuối sheet |
| `/api/storms` | 1 (API) | `src/app/api/storms/route.ts` | Proxy nguồn tin bão quốc tế (GDACS), cache 30 phút, lọc vùng Biển Đông qua `parseStorms`. Fail → `{ok:false}`, client im lặng — KHÔNG bao giờ nói "không có bão" khi không kiểm tra được |
| `/api/fish-forecast` | 1 (API) | `src/app/api/fish-forecast/route.ts` | **DỰ BÁO CÁ (PFZ)**: kéo lưới SST + phù du (bắt buộc) + SSHA / dị thường nhiệt / dòng chảy u,v (tuỳ chọn) từ NOAA ERDDAP, chấm điểm loài qua `lib/fish-predict.ts`, cache 6h. Fail → `{ok:false}`, client lùi về mùa vụ. Payload kèm `generatedAt` (ISO lúc TÍNH — khác `date` = ngày ẢNH). **KHÔNG hiển thị ra UI** (quyết định sản phẩm 2026-07-25: bỏ hẳn tuổi lớp cá cho gọn màn hình) — giữ trong payload để đối chiếu/kiểm tra |
| `/api/sea-scalar` | 1 (API) | `src/app/api/sea-scalar/route.ts` | Lớp số liệu biển (`?kind=ssha` nước dâng/xoáy; `sss` độ mặn đang rút khỏi UI) — ERDDAP, cache 6h, lùi ngày khi nguồn quét theo vệt trống vùng |
| `/api/tiles/[src]/[z]/[x]/[y]` | 1 (API) | `src/app/api/tiles/[src]/[z]/[x]/[y]/route.ts` | **CẦU TILE SAME-ORIGIN** cho hải đồ (`chart` ← EMODnet) + phao đèn (`seamark` ← OpenSeaMap): service worker chỉ giữ được thứ cùng origin, đi thẳng host ngoài là mất sóng mất sạch. Danh sách TRẮNG + chặn z/x/y vô lý (`lib/tile-proxy.ts`) — KHÔNG nhận URL tuỳ ý. Upstream lỗi/timeout 12s → **204** (ô trống, MapLibre không báo lỗi đỏ). `Cache-Control` s-maxage 30 ngày (chart) / 7 ngày (seamark) |
| `/api/port-prices` | 2 (API) | `src/app/api/port-prices/route.ts` | **Giá cá LIVE**: scrape bản tin giá nguyên liệu TUẦN của VASEP (Khánh Hòa) qua `lib/port-price-source.ts`, map keyword → 13 loài, cache 24h. Parse vỡ/fail → `{ok:false}`, client lùi bảng tĩnh `data/port-prices.ts`. Loại hàng khô/giống |
| `/api/fuel-price` | 2 (API) | `src/app/api/fuel-price/route.ts` | **Giá dầu DO LIVE**: giaxanghomnay.com (Petrolimex) → DO 0,05S vùng 1/2 qua `lib/fuel-price.ts`, cache 6h. Fail → `{ok:false}`, UI ẩn |
| `/api/me/sdvico` | TÀU (API) | `src/app/api/me/sdvico/route.ts` | Thiết bị/bảo hành/hỗ trợ của khách đăng nhập. **Đợt 1 (2026-06-16): đọc BẢNG SDFish riêng** (`devices/customers/support_requests`, RLS theo `current_phone()`) thay đọc-live CRM; chưa đăng nhập/bảng chưa có → `{ok:false}`, UI local. Shape `{ok,assets}` giữ. Xem [04 §5b](04-data-model.md) |
| `/api/sdvico/catalog` | TÀU (API) | `src/app/api/sdvico/catalog/route.ts` | Danh mục SDVICO theo nhóm (dữ liệu chung, cache 1h) — nhóm theo tiền tố SKU qua `lib/sdvico-catalog.ts` |
| `/api/sdvico/request` | TÀU (API) | `src/app/api/sdvico/request/route.ts` | Khách gửi yêu cầu (hỏi mua/sửa chữa/bảo dưỡng/cước) → INSERT `consultation_requests` bên CRM (`source_page='forfish'`); dùng được cả khi CHƯA đăng nhập, bắt buộc SĐT VN hợp lệ. Xem [04-data-model.md](04-data-model.md) §6 |
| `/api/sdwork/webhook` | INGEST (API) — **Đợt 1, 2026-06-16** | `src/app/api/sdwork/webhook/route.ts` | SDWork đẩy KH/thiết bị/vật tư → verify HMAC (`x-sdwork-signature` + `SDWORK_WEBHOOK_SECRET`) trên raw body → upsert bảng SDFish (admin/service-role) + **provision tài khoản** (customer kèm `password` → tạo auth user SĐT+mk, `must_change_password`). Map thuần `lib/sdwork-webhook.ts` (idempotent `sdwork_ref`) có test. Xem [04 §5b](04-data-model.md) |
| `/login` | AUTH — **SĐT + mật khẩu (Đợt 1)** | `src/app/login/page.tsx` | `signInWithPassword` ({SĐT}@sdvico.local). KHÔNG email/OTP. Lần đầu `must_change_password` → `/doi-mat-khau` |
| `/api/auth/sso` + `/api/auth/signup` | AUTH (API) — ⚠️ LEGACY chuyển tiếp (login không còn gọi; retire Đợt 2) | `src/app/api/auth/{sso,signup}/route.ts` | Route MỎNG → Edge Function `auth-gateway` trong project ForFish (qua `lib/auth-gateway.ts`). **sso**: verify SĐT+mk với CRM SDViCo → đồng bộ mk vào tài khoản ForFish → client `signInWithPassword` chuẩn (đã bỏ magic-link, không cần `SUPABASE_SERVICE_ROLE_KEY`). **signup**: tạo user email-ảo `{SĐT}@sdvico.local` ĐÃ confirm (email ảo không có hòm thư để bấm link). Env cần: chỉ `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` (đã set local + Vercel production 2026-06-10) |
| `/tau` | TÀU — tài sản / boat asset | `src/app/tau/page.tsx` | **MVP + kênh CSKH SDVICO**: tách tab (`ui/tabs.tsx`): Giấy tờ (**checklist xuất bến** `departure-checklist.tsx` ← `lib/departure-check` đèn xanh-đỏ theo Lmax + tủ giấy tờ `document-vault.tsx`) · **Dịch vụ** (`boat-services.tsx` — dịch vụ/cước đồng bộ + nút Gọi SDVICO + sổ nhắc tự ghi `maintenance-reminders.tsx`) · Sản phẩm (`boat-products.tsx` — đồ đã mua + bảo hành, gợi ý nhóm `sdvico-catalog.tsx`) · Mức phạt (`fines-lookup.tsx` ← `src/data/fines.ts`) |
| `/nguoi` | NGƯỜI — lao động / crew (xem [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md)) | `src/app/nguoi/page.tsx` | **MVP**: Bạn thuyền — sổ thuyền viên (`crew-list.tsx`, localStorage `forfish.crew.v1` — hồ sơ + bảo hiểm/chứng chỉ hạn + sổ ứng tiền). Chia tiền đã dời sang `/tien` |
| `/tien` | TIỀN — tài chính / money | `src/app/tien/page.tsx` | **3 tab (deep-link `?tab=`)**: **Giao dịch** (`trade-hub.tsx`: Giá cá `price-board.tsx` · **Ai cần mua** `buy-board.tsx` ← `data/buy-requests.ts` TIN MẪU chờ app thu mua · Bán ở đâu `sell-guide.tsx`) · **Hiệu quả** (`money-insights.tsx`: thẻ nhìn nhanh ← `lib/trip-insights.ts` có test · 4 section chip: Sổ lãi/lỗ `trip-log.tsx` (mỗi chuyến có nút **Lặp lại chuyến** = chép số tổn cũ làm nền chuyến mới + **Hồ sơ chuyến PDF** → `trip-dossier.tsx` bản in được) · **Báo cáo năm** `trip-report.tsx` (tổng lãi/lỗ cả năm + tách theo tháng, `yearlyReport`/`listYears` có test) · **Tính chuyến** `trip-estimator.tsx` (máy tính tổn dự kiến + sản lượng hoà vốn, prefill giá dầu DO LIVE, `lib/trip-estimate` có test) · Chia tiền `trip-split.tsx`) · **Công nợ** (`debt-ledger.tsx`: sổ công nợ đa đối tượng — đại lý dầu/nậu/ngân hàng, mỗi chủ nợ một dư nợ + lịch sử vay/trả, `lib/debts.ts` có test, demo mode + sổ mẫu tự xưng) |
| `/cang` | 1 — Ra khơi (sub) | `src/app/cang/page.tsx` | **MVP**: danh bạ 173 cảng cá chỉ định (`port-directory.tsx` ← `data/fishing-ports.ts`), lọc theo vùng/tỉnh tàu (`lib/region.ts`); vào từ nút nổi trên bản đồ `/ngu-truong`, KHÔNG nằm trên dock |
| `/gia-ca` `/van-hanh` `/giay-to` `/thuyen-vien` | — (REDIRECT stub) | `src/app/{gia-ca,van-hanh,giay-to,thuyen-vien}/page.tsx` | **Redirect stub** giữ link cũ: `/gia-ca`→`/tien`, `/van-hanh`→`/tau`, `/giay-to`→`/tau`, `/thuyen-vien`→`/nguoi` (taxonomy mới: Ra khơi / Tàu / Người / Tiền) |

Quy ước: route slug là tiếng Việt không dấu, khớp ngôn ngữ người dùng. Thêm route mới → update bảng này cùng commit. Đổi/gộp route → để lại redirect stub cho slug cũ.

## 3. Folder layout

```
src/
  app/
    layout.tsx          # Root layout (fonts, bottom nav, PWA metadata: manifest/icons/appleWebApp, mount SwRegister)
    manifest.ts         # Web App Manifest (→ /manifest.webmanifest) — cài PWA iOS/Android
    globals.css         # Tailwind v4 @theme tokens — single source màu/typography
    page.tsx            # Trang chủ
    ngu-truong/  tau/  nguoi/  tien/            # 4 trục hiện hành (Ra khơi / Tàu / Người / Tiền)
    cang/                                       # Ra khơi (sub): danh bạ cảng cá, vào từ nút nổi trên map
    gia-ca/  van-hanh/  giay-to/  thuyen-vien/  # REDIRECT stub slug cũ → trục mới (xem bảng §2)
  components/
    bottom-nav.tsx      # Điều hướng dưới cùng (mobile-first, các trục + home)
    page-header.tsx     # Header sóng dùng chung
    icons.tsx           # Bộ icon stroke SVG — NGUỒN ICON DUY NHẤT, cấm emoji
    urgent-strip.tsx    # Trang chủ: dải nhắc việc gấp (giấy tờ/bảo hiểm sắp hết hạn…)
    sw-register.tsx     # Đăng ký service worker public/sw.js (prod-only) cho PWA — mount trong layout, không render gì
    ui/                 # Primitives dùng chung (xem khối ui/ bên dưới)
    document-vault.tsx  # Trục TÀU: vault UI — pattern chuẩn cho mọi CRUD localStorage
    fines-lookup.tsx    # Trục TÀU: tra mức phạt (NĐ 38/2024)
    departure-checklist.tsx # Trục TÀU: CHECKLIST XUẤT BẾN — đèn xanh-đỏ "đủ điều kiện ra khơi" tự sinh theo Lmax (← lib/departure-check) + NHẮC mốc khai báo eCDT/NKKT theo cỡ tàu (← lib/compliance, app chỉ nhắc không khai hộ); đọc CHUNG tủ giấy tờ (document-vault loadDocs) + sổ thuyền viên (useCrew) + cỡ tàu (useBoats); nằm trên đầu tab Giấy tờ /tau
    sell-guide.tsx      # Trục TIỀN: "Bán ở đâu" — kênh bán + vựa + người mua theo loài/vùng (← market-channels + seafood-buyers + wholesalers/*, lọc bằng lib/region.ts)
    sea-forecast.tsx    # Trục 1: LEGACY — không còn page nào dùng (logic đã gộp vào mode cảng của fishing-map-view); cân nhắc xoá khi ổn định
    storm-banner.tsx    # Trục 1: banner tin bão (3 trạng thái: bão / yên / im lặng khi nguồn fail) — variant "page" + "overlay" (nổi trên map)
    fishing-map.tsx     # Trục 1: vỏ lazy-load bản đồ (next/dynamic ssr:false), loading full-height
    fishing-map-view.tsx # Trục 1: MÀN HÌNH map-first — map full-screen + RaKhoiControls (rail phải) + SnapSheet đáy (vuốt 3 nấc); nhãn chủ quyền + ranh giới + bão; công cụ đo khoảng cách 2 điểm; toạ độ/khoảng cách theo lib/map-prefs. Dựng danh sách chỗ tải sẵn (pretripPoints) cho PretripAutoNotify + chọn khung ngày lưới nói thật khi máy chưa lưu khung đó (savedGridDays). KHÔNG còn badge tuổi lớp cá (bỏ 2026-07-25 — màn hình rối)
    ra-khoi-controls.tsx # Trục 1: RAIL PHẢI 6 nút (Hải đồ/Ngư trường/Thời tiết/Điểm đã lưu/Công cụ/Cài đặt) — mỗi nút mở 1 panel; nơi DUY NHẤT bật/tắt-chọn lớp hiện trên map (Phương án A). Chọn loài + quản lý điểm = drill-down/nhúng trong panel (không bottom-sheet). KHÔNG còn thẻ "Chuẩn bị đi biển" và không nói tuổi lớp cá (bỏ 2026-07-25)
    pretrip-auto-notify.tsx # Trục 1: TỰ TẢI SẴN DỰ BÁO khi vào Ra khơi (thay nút cũ) — chạy lib/pretrip khi cửa chặn lib/pretrip-auto cho phép, hiện MỘT dòng bo tròn nổi dưới banner bão ("Đang tải dự báo…" → "Đã lưu dự báo tới ngày D/M." / "Chưa tải được dự báo — chưa có sóng.") rồi TỰ ẨN sau 5s; kiểu hiển thị mượn storm-banner. Bản còn mới / mất sóng → im lặng hoàn toàn
    fish-species-sheet.tsx # Trục 1: FishSpeciesContent (thân, nhúng panel Ngư trường) + FishSpeciesSheet (wrapper bottom-sheet legacy)
    my-places-sheet.tsx # Trục 1: MyPlacesContent (thân, nhúng panel Điểm đã lưu — thêm theo toạ độ, đổi tên/xoá/đặt cảng nhà, tìm trong 173 cảng) + MyPlacesSheet (wrapper legacy). KHÔNG còn GPS
    port-directory.tsx  # Trục 1 (sub /cang): danh bạ 173 cảng cá chỉ định (← data/fishing-ports.ts), lọc theo vùng/tỉnh tàu (lib/region.ts)
    ui/                 # Primitives dùng chung (UI nền):
      primitives.tsx    #   nút/thẻ/field cơ bản theo design-system (font ≥18px, tap ≥56px)
      tabs.tsx          #   Tabs trong trang — dùng cho /tau và /tien thay vì cuộn dọc dài
      bottom-sheet.tsx  #   BottomSheet MODAL (có scrim) — form thêm/sửa CRUD
      confirm-dialog.tsx#   Hộp xác nhận xóa dùng chung
      status-banner.tsx #   Banner trạng thái chung (thông tin/cảnh báo)
      region-filter.tsx #   Bộ lọc Bắc/Trung/Nam (← lib/region.ts) cho danh sách theo vùng
    ui/snap-sheet.tsx   # SnapSheet dùng chung: sheet đáy THƯỜNG TRỰC 3 nấc peek/half/full, không scrim, điều khiển bằng nút to (khác BottomSheet là modal)
    route-planner.tsx   # Trục 1: dẫn đường tiết kiệm dầu — form xuất phát/thông số tàu + thẻ kết quả + lớp vẽ tuyến (RouteMapLayers, đặt trong MapGL)
    price-board.tsx     # Trục 2: bảng giá — LIVE giá tuần VASEP (lib/port-price-source) + giá dầu DO (lib/fuel-price), fallback bảng tĩnh
    trip-log.tsx        # Trục 2/TIỀN: sổ lãi lỗ chuyến biển (controlled, chủ sổ = money-insights)
    trip-report.tsx     # Trục TIỀN: BÁO CÁO LỜI/LỖ NĂM — tổng cả năm + tách theo tháng từ sổ trips (← lib/trip-insights yearlyReport/listYears), section "Báo cáo năm" trong tab Hiệu quả
    trip-dossier.tsx    # Trục TIỀN: HỒ SƠ CHUYẾN BIỂN — gói 1 chuyến (tàu + thu/tổn/lãi + thuyền viên + giấy tờ còn hạn) thành bản IN ĐƯỢC (window.print → Lưu PDF, @media print .print-area trong globals.css); đọc chung useBoats/useCrew/loadDocs. QR truy xuất để sau (cần backend)
    trip-estimator.tsx  # Trục TIỀN: MÁY TÍNH CHUYẾN BIỂN — ước tổn dự kiến + sản lượng hoà vốn TRƯỚC khi đổ dầu (← lib/trip-estimate), giá dầu prefill từ DO LIVE (lib/fuel-price), tính live; section "Tính chuyến" tab Hiệu quả
    debt-ledger.tsx     # Trục TIỀN: SỔ CÔNG NỢ ĐA ĐỐI TƯỢNG — chủ nợ (đại lý dầu/nậu/ngân hàng) + lịch sử vay/trả + dư nợ (← lib/debts), CRUD localStorage forfish.debts.v1 + sổ mẫu tự xưng; tab Công nợ /tien
    supply-catalog.tsx  # Trục 3: danh mục vật tư
    maintenance-reminders.tsx  # Trục TÀU: sổ nhắc bảo dưỡng TỰ GHI — nhúng trong boat-services (tab Dịch vụ)
    boat-services.tsx   # Trục TÀU: tab DỊCH VỤ — dịch vụ đồng bộ + cước chờ đóng + nút Gọi SDVICO + sổ nhắc tự ghi
    sdvico-catalog.tsx  # Trục TÀU: "SDVICO có gì cho tàu mình" — nhóm gợi ý (← /api/sdvico/catalog), nhãn "đang dùng" theo đồ đã mua
    sdvico-request.tsx  # Trục TÀU: nút + form "Gọi SDVICO" (hỏi mua/sửa chữa/bảo dưỡng/cước) → /api/sdvico/request
  data/
    ports.ts            # 10 cảng + tọa độ đã kiểm chứng Open-Meteo
    vn-maritime-border.ts # Ranh giới biển VN — 75 điểm CHUẨN (user cấp 2026-06-10, "borderpoints.json"), Campuchia → Trường Sa → Hoàng Sa → Vịnh Bắc Bộ → Móng Cái; nguồn cho geofence cảnh báo IUU
    vn-fishing-zones.ts # Ranh giới VÙNG LỘNG (NĐ 26/2019, tàu 12–<15m) — polygon 36 đỉnh do SDVico cấp (data.json cat map/VungLong, 2026-07-25); vungLongGeoJSON → lớp map nét đứt teal (toggle panel Cài đặt → Lớp bản đồ). THAM KHẢO, không phải căn cứ pháp lý
    fish-seasons.ts     # Cá mùa này — 7 vùng biển (polygon + labelAt) × 40 loài × tháng, nguồn RIMF/báo ngành THAM KHẢO; regionAt (chứa)/nearestRegionWithin (vùng gần nhất ≤2° — PHỦ KÍN toàn EEZ, không lỗ hổng)/fishInRegion (có test)
    port-prices.ts      # Giá cá tĩnh = FALLBACK cho /api/port-prices (khi VASEP fail/parse vỡ); nguồn báo công khai, có ngày tổng hợp
    supplies.ts         # Danh mục vật tư THAM KHẢO
    fines.ts            # Mức phạt NĐ 38/2024 (cá nhân) THAM KHẢO
    market-channels.ts  # Trục TIỀN: kênh bán cá (chợ đầu mối/vựa/online…) THAM KHẢO — nguồn cho sell-guide
    seafood-buyers.ts   # Trục TIỀN: doanh nghiệp thu mua thủy sản theo tỉnh/loài THAM KHẢO (province đã chuẩn hóa tên hiển thị sau 2025)
    wholesalers/        # Trục TIỀN: vựa/đầu mối theo vùng — bac/trung/nam + bs-* (province đã chuẩn hóa); gộp qua index.ts, types.ts
    fishing-ports.ts    # 173 cảng cá toàn quốc (province + tọa độ, tên tỉnh chuẩn sau 2025) — wire vào port-directory.tsx (/cang) + my-places-sheet.tsx (tìm cảng nhà) + lib/boats.ts (homePortId)
  lib/
    documents.ts        # Domain logic Trục TÀU (kinds, expiry status) — xem 04-data-model.md
    format.ts           # Helper định dạng dùng chung (số tiền/ngày…)
    api-base.ts         # apiUrl() — base URL API cho web (tương đối) vs native Capacitor (tuyệt đối qua NEXT_PUBLIC_API_BASE); có test. MỌI fetch /api/* đi qua đây
    use-exit-transition.ts # Hook đóng-có-animation cho sheet/dialog (chạy animation thoát rồi mới gọi onClose) — BottomSheet/ConfirmDialog dùng chung, API ngoài không đổi
    haptics.ts          # tapFeedback() rung nhẹ (navigator.vibrate có guard) — Android PWA; iOS no-op; Capacitor-ready. Dùng tiết chế ở ConfirmDialog confirm
    region.ts           # Phân vùng Bắc/Trung/Nam: Region, COASTAL_PROVINCES, provinceKey/regionOf — nền cho lọc theo tỉnh ⇒ ĐÒI HỎI tên tỉnh thống nhất giữa các dataset
    geofence.ts         # Trục 1: cảnh báo vượt ranh giới biển (← vn-maritime-border.ts)
    crew.ts             # Trục NGƯỜI/TIỀN: logic chia tiền chuyến (có test)
    sea.ts              # Trục 1: fetch Open-Meteo 1–16 ngày (gió best-match + SÓNG ncep_gfswave025 phủ đủ 16) + công thức điểm đi biển (scoreDay/levelOf — THANG ĐIỂM DUY NHẤT của trục) + estimateWaveFromWind (ngày sóng thủng). FORECAST_DAYS=16, cache v3
    ocean-map.ts        # Trục 1: adapter lớp bản đồ (vệ tinh NASA GIBS trễ 2 ngày; độ sâu EMODnet/GEBCO tĩnh + ĐƯỜNG ĐẲNG SÂU số mét từ public/data/isobaths.v1.json — sinh bởi scripts/generate-isobaths.mjs vì EMODnet WMS chỉ phủ châu Âu; phao đèn OpenSeaMap zoom ≥8) + style + nhãn chủ quyền VN. 2026-07-25: layer ĐẦU TIÊN là `sea-bg` (background màu nước) — mất sóng KHÔNG được ra màn hình trắng; `glyphs` TỰ HOST `/fonts/{fontstack}/{range}.pbf` (CDN openmaptiles cũ nay trả HTML → nhãn số mét chưa từng hiện); hải đồ + phao đèn lấy URL từ `tile-proxy.ts` (same-origin)
    tile-proxy.ts       # Trục 1: CẦU TILE SAME-ORIGIN — danh sách TRẮNG nguồn mở cho phép cache (chart = EMODnet bathymetry, seamark = OpenSeaMap) + upstreamTileUrl (chặn tên nguồn lạ / z-x-y vô lý → KHÔNG thành proxy mở) + proxyTileTemplate (qua apiUrl cho bản native). Lý do tồn tại: sw.js chỉ giữ được thứ CÙNG ORIGIN. Nền CARTO CỐ Ý không đi qua đây (ToS không cho cache lại). Thuần, có test
    offline-basemap.ts  # Trục 1: NỀN TỐI GIẢN KHI MẤT SÓNG — COAST_DATA_URL (public/data/vn-coast.v1.json, sinh bởi scripts/generate-coastline.mjs từ Natural Earth public-domain) + màu đất/bờ + shouldUseOfflineBasemap({online,fails}) (mất mạng → bật ngay; máy báo có mạng mà ô nền cứ trượt ≥ BASEMAP_FAIL_LIMIT=3 → cũng bật) + nextFailCount + offlineBasemapNote (câu nhắc KHÔNG jargon). CÓ MẠNG THÌ KHÔNG VẼ. Thuần, có test
    marine-weather.ts   # Trục 1: gió/sóng tại 1 điểm chạm (Open-Meteo, 1–16 ngày, WAVE_MODEL ncep_gfswave025) — tái dùng scoreDay/levelOf từ sea.ts; FORECAST_MAX_DAYS=16 + forecastConfidence(daysAhead, dataConf?) mở tới 16 ngày, nhận độ tin đo được
    forecast-ensemble.ts # Trục 1: ĐỘ BẤT ĐỊNH — Open-Meteo Ensemble (GFS-EPS 31 thành viên), spread gió theo ngày → confidence 0–1 (stdDev/spreadToConfidence/aggregateDailySpread thuần có test); fetchEnsembleUncertainty degrade null
    forecast-quality.ts # Trục 1: LỚP ĐỘ TIN — gộp horizon + ensemble spread + bảng skill backtest → assessForecast (nhãn/độ tin từng ngày) + applyBiasCorrection (nắn bias điểm số theo forecast-skill.json). Thuần, có test; degrade khi thiếu ensemble/skill
    forecast-grid.ts    # Trục 1: lưới dự báo vẽ động kiểu Windy — 80 điểm, KHUNG NGÀY chọn 3/5/7/10/16 (GRID_DAY_OPTIONS), bước tăng dần 3/6/12h (stepHourIndices) chặn số khung, sóng model ncep_gfswave025 (phủ 16 ngày). arrowFeatures GeoJSON mũi tên + thang màu + timeLabelVN (thuần, có test). OFFLINE: lưu theo KHUNG (`gridCacheId` d3/d7/d16…), mất sóng CHỈ lùi về ĐÚNG khung đã xin (2026-07-25 bỏ fallback loadLatest — xin 16 ngày mà đưa lưới 3 ngày trong khi chip vẫn "16 ngày"); `savedGridDays()` cho UI nói đúng khung nào đang có
    forecast-cache.ts   # Trục 1: LƯU DỰ BÁO XEM OFFLINE (localStorage forfish.fc.<ns>.<id>) — saveForecast/loadForecast/loadAll/coordId/savedAgoLabel/lastStorageFullAt (thuần, có test). saveForecast TRẢ BOOLEAN: dọn (trim) TRƯỚC khi ghi, hết chỗ thì bỏ bản cũ nhất mọi ns rồi ghi lại, chịu thua mới trả false + ghi mốc để UI báo "máy hết chỗ" (lỗi cũ: trim nằm SAU setItem → QuotaExceeded làm trim không bao giờ chạy = kẹt vĩnh viễn). KHÔNG còn loadLatest (gốc lỗi "bản chỗ khác/khung khác đội lốt")
    pretrip.ts          # Trục 1: TẢI SẴN trước khi rời bờ, KHÔNG nguồn mới: gọi lại fetchSeaPoint (mỗi chỗ ghim + chỗ đang xem, dedupe ô 0,25°) + fetchFishForecast + fetchForecastGrid các khung PRETRIP_GRID_DAYS [3,7,16], chạy TUẦN TỰ có tiến trình. dedupePoints/pretripSteps/savedSummary/runPretrip (thuần, có test). Từ 2026-07-25 KÍCH HOẠT tự động (không còn nút) — câu chữ màn hình chuyển sang pretrip-auto.ts
    pretrip-auto.ts     # Trục 1: CỬA CHẶN TỰ TẢI + câu chữ notify — shouldAutoPretrip({lastRunAt, nowMs, online}) thuần có test: chỉ chạy khi chưa có bản nào hoặc bản cũ hơn PRETRIP_MIN_INTERVAL_MS=6h (khớp ISR 6h của nguồn); còn mới hoặc navigator.onLine=false → KHÔNG chạy, im lặng. TIẾT CHẾ DATA: mỗi lượt ~2,5–3 MB, bà con trả tiền theo dung lượng. Mốc ở localStorage forfish.pretrip.lastRunAt.v1 (lastAutoPretripAt/markAutoPretripRun). autoPretripLine(r) → dòng báo tự tắt
    places.ts           # Trục 1: "Điểm của tôi" — ghim chủ tàu + cảng nhà (localStorage forfish.places.v1); upsert/remove/rename/makeHome/placeAt (thuần, có test). THAY việc chọn cảng trong danh sách
    map-prefs.ts        # Trục 1: tuỳ chọn bản đồ — đơn vị khoảng cách (nm/km) + hệ toạ độ (dd/dms); store dùng chung (localStorage forfish.mapPrefs.v1, useSyncExternalStore) + formatters fmtDist/fmtCoordPair/kmToUnit (thuần, có test). Panel Cài đặt đổi → mọi chỗ đổi theo
    weather-codes.ts    # Trục 1: mã WMO → nhãn tiếng Việt (dông/mưa) + cờ danger
    fish-predict.ts     # Trục 1: DỰ BÁO CÁ (PFZ) — khẩu vị 40 loài 6 nhóm (SpeciesCategory pelagic-large/small, cephalopod, demersal, reef, crustacean) × (trapezoid SST + dải chl + trọng số 6 yếu tố) × habitat{mồi, front nhiệt, front mồi, rìa xoáy SSHA, nước trồi anomaly, hội tụ dòng u,v} × mùa vụ/vùng. SurfaceSignal high/medium/low + SURFACE_CONF: loài đáy (low) kéo habitat về trung tính → KHÔNG vẽ điểm nóng giả, "Mọi loài" chỉ tính loài định-vị-được. Mỗi loài có color + SPECIES_META (UI) + CATEGORY_LABEL. gradientStrength/convergenceStrength/buildFishForecast(sst,chl,sla,month,{anom,cur,thermo,depth,bottomTemp,deepTemp}) thuần có test; mọi trường ngoài SST+chl TUỲ CHỌN; cell mang t (°C)+c (chl) cho UI; client /api/fish-forecast. **CỔNG NHIỆT THEO TẦNG (VIỆC 4, 2026-07-25)**: SpeciesProfile.tempSource "surface"(mặc định)/"bottom"/"deep" chọn lưới nhiệt cho `tFit` — **11 loài ĐÁY MỀM thềm/cửa sông** (7 cá đáy mềm mối/đổng/phèn/khoai/bơn/đù/chim + 4 giáp xác tôm bạc/sú/ghẹ/cua) chấm bằng **nhiệt ĐÁY** (bottomTemp) thay vì SST mặt → hết mảng tô đều ở nước sâu (nước đáy lạnh → loại đúng loài đáy khỏi ô abyssal). **CÁ RẠN (hồng/mú/kẽm) GIỮ nhiệt MẶT** (không "bottom"): rạn sống NÔNG 2–50m mà cube HYCOM thô ~53km ở rìa thềm dễ lấy nhầm nhiệt nước sâu lạnh → co footprint 80–96% = ARTIFACT + độ-chính-xác-giả (rạn là `low`, HYCOM/vệ tinh không định vị được rạn) → để mặt (mờ, thành thật "chưa định vị"). FALLBACK: thiếu lưới/ô NaN → dùng SST mặt (`sstFallback ?? sst`) → HYCOM fail = hành vi cũ, loài KHÔNG biến mất. "deep"/deepTemp là hạ tầng GIỮ SẴN nhưng CHƯA gán loài nào — validate thấy nhiệt 250m gần đồng nhất (~13°C) → cổng nhiệt-sâu vô ích + phình điểm nóng (xem 01-product). **CỔNG ĐỘ SÂU (2026-07-25)**: SpeciesProfile.offshore=[a,b] + deepWaterFit + lưới độ sâu ETOPO (bathyGridUrl/parseBathyGrid) → loài xa bờ (cá ngừ/cờ/nục heo/mực xà) KHÔNG hiện ở ô nước cạn sát bờ (điểm ×0 khi <a m); depthBand giờ có "răng" thật, không chỉ chữ
    moon.ts             # tuần trăng tính offline (chu kỳ giao hội 29,53 ngày) + lời nghề đèn (mực/cá cơm) — hiện trong sheet bản đồ Trục 1; có test
    hycom.ts            # Trục 1: TẦNG NHIỆT + NHIỆT ĐÁY — kéo nhiệt-theo-tầng HYCOM ESPC-D-V02 (OPeNDAP ascii, decode Int16*0.001+20). **1 fetch cube → NHIỀU lưới (VIỆC 4, 2026-07-25)**: `fetchHycomGrids()` trả `{d20, bottom, deep250}` dùng CHUNG cube (KHÔNG fetch thêm, giữ DEPTH_RANGE 20–300m để không phình route 60s): `iso20Grid` (D20 tầng cá ngừ) · `bottomTempGrid` (nhiệt TẦNG SÂU NHẤT còn hữu hạn mỗi cột = nhiệt ĐÁY, cho cổng nhiệt loài đáy) · `tempAtDepthGrid(cube,250)` (nhiệt ~250m). (Wrapper `fetchThermoclineGrid` cũ đã XOÁ 2026-07-25 — không còn nơi gọi; dùng thẳng `fetchHycomGrids().d20`.) parse/iso20Depth/bottomTempGrid/tempAtDepthGrid/thermoGridUrl thuần có test. URL BẮT BUỘC dạng .ascii?water_temp[...] (thiếu ?water_temp → 400)
    sea-scalars.ts      # Trục 1: lớp số liệu biển — SSHA "Nước dâng, xoáy" (sống); sss độ mặn TẠM RÚT khỏi UI (SMOS nhiễu RFI Biển Đông, SMAP chết) — client gọi /api/sea-scalar?kind=
    storms.ts           # Trục 1: adapter tin bão (parse/lọc vùng Biển Đông, types) — client gọi /api/storms
    route-plan.ts       # Trục 1: THUẦN LOGIC dẫn đường kiểu VISIR (docs/research/06 + audit §3b) — lưới phủ vùng + Dijkstra, Kwon 4 bậc hướng sóng, thang an toàn KTTV (cấp 6 phạt 1,15 / cấp 7 phạt 1,5 + đỏ / cấp 8 chặn), TRẦN VÒNG 1,3× direct, fuelDeltaL có dấu, độ sâu mẫu ≤5 km/cạnh
    route-weather.ts    # Trục 1: adapter Open-Meteo — LƯỚI thời tiết thô ≤120 điểm/lượt theo GIỜ (72h: sóng+hướng, gió+hướng, DÒNG CHẢY SMOC gồm triều), nội suy song tuyến xuống lưới tìm đường
    depth-grid.ts       # Trục 1: lưới độ sâu tĩnh ETOPO 2022 (public/data/depth-grid.v1.bin ~30 KB, sinh bởi scripts/generate-depth-grid.mjs) — chặn đất + <4 m, cảnh báo 4–12 m, vùng rạn HS/TS quét min-pool 15″
    owned-assets.ts     # Trục TÀU: types TRUNG LẬP VENDOR cho đồ khách mua (sản phẩm/bảo hành, dịch vụ/kỳ cước, khoản chờ đóng) + getServiceDueStatus (thuần, có test)
    sdvico-catalog.ts   # Trục TÀU: nhóm catalog theo tiền tố SKU + chủ đề yêu cầu CSKH (thuần, có test)
    sdwork-assets.ts    # Trục TÀU: ADAPTER SDWork CRM → OwnedAssets (server-only) — gọi Edge Function `forfish-gateway` BÊN TRONG project CRM bằng anon key sẵn có (không cần service key trong env); mapCrmAssets thuần có test; xem 04-data-model §6
    phone.ts            # AUTH: helper SĐT VN THUẦN (normalizeVnPhone/phoneToEmail/isValidVnPhone) — dùng cả server (route webhook); auth-form.tsx re-export
    sdwork-webhook.ts   # INGEST Đợt 1: verify HMAC + map payload SDWork→bảng SDFish (thuần, có test)
    supabase/admin.ts   # SERVICE-ROLE client (server-only, bypass RLS) — chỉ webhook (upsert + provision auth user); null khi chưa cấu hình
    auth-gateway.ts     # AUTH: gọi Edge Function `auth-gateway` BÊN TRONG project ForFish (service key tự cấp) — signup tạo user email-ảo ĐÃ confirm; sso verify CRM rồi ĐỒNG BỘ mật khẩu vào ForFish (bỏ magic-link, không cần SUPABASE_SERVICE_ROLE_KEY trong env)
    __tests__/          # Vitest cho logic thuần (ocean-map, marine-weather, sea, weather-codes, storms, route-plan, owned-assets…)
    supabase/
      client.ts         # Browser client — trả về null khi env trống
      server.ts         # Server client (cookies) — trả về null khi env trống
supabase/
  migrations/0001_init.sql   # boats + documents + RLS
```

Quy ước `src/data/`: dữ liệu tĩnh tổng hợp từ nguồn công khai PHẢI ghi rõ ngày + nguồn trong comment, UI hiển thị phải gắn nhãn "tham khảo". Không bịa số liệu.

## 4. Demo mode — invariant quan trọng

Khi `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` chưa set:

1. `src/lib/supabase/client.ts` và `server.ts` đều **trả về `null`** (không throw)
2. App fallback về **demo mode**: `document-vault.tsx` lưu dữ liệu vào localStorage key **`forfish.documents.v1`**, seed bằng `demoDocuments()` để app không bao giờ trống
3. Vault **hydrate từ localStorage trong `useEffect` sau mount** — tránh SSR/CSR mismatch. KHÔNG đọc localStorage lúc render đầu. Rule `react-hooks/set-state-in-effect` flag pattern này nên đã tắt trong `eslint.config.mjs` kèm comment (2026-06-11) — pattern là cố ý, giữ nguyên.

→ Mọi feature mới đụng dữ liệu phải giữ pattern này: chạy được không cần Supabase, degrade gracefully.

**Seed mẫu phải tự xưng là mẫu (hội đồng UX 2026-06-11)**: dữ liệu demo chỉ sống trong bộ nhớ — KHÔNG ghi xuống localStorage, KHÔNG được lọt vào dải nhắc "việc cần làm ngay" (`urgent-strip.tsx` load với seed rỗng). `crew-list.tsx` là mẫu chuẩn: `loadCrew()` trả `{crew, isDemo}`, banner neutral "Đây là sổ mẫu…" + nút "Xóa sổ mẫu, ghi sổ của tôi", thêm người thật đầu tiên là seed tự thay; `trip-split.tsx` coi sổ mẫu là rỗng.

## 5. Quy ước component

- Client component chỉ khi cần (`"use client"` khi có state/localStorage/fetch)
- CRUD cục bộ theo pattern `document-vault.tsx`: hydrate sau mount, bottom-sheet form, confirm xóa, **+ quy tắc seed-mẫu: cờ `isDemo`, save gated `!isDemo`, thật đầu tiên thì demo nhường chỗ** — áp cho doc-vault / maintenance / boat-products / crew (triage 2026-06-15)
- **`<html>` có `suppressHydrationWarning`** (`layout.tsx`): script đầu `<body>` đặt `data-mode` (cỡ chữ) từ localStorage TRƯỚC hydrate để chống nháy → server không có attr, client có. Cố ý → tắt cảnh báo hydrate trên ĐÚNG thẻ `<html>` (không lan xuống cây con).
- UI tuân thủ [03-design-system.md](03-design-system.md) (font ≥18px, tap ≥56px)
- **Mọi fetch nguồn ngoài phải có `AbortSignal.timeout(15000)`** (2026-06-10): mạng ngoài khơi chập chờn — thà báo lỗi rõ còn hơn treo UI chờ browser timeout. Áp dụng: Open-Meteo (sea/marine-weather/route-weather/forecast-grid), GDACS (`/api/storms`, server 15s + client 20s), Overpass (25s vì nguồn chậm), **NOAA ERDDAP + HYCOM** (dự báo cá — server 20s/lưới vì lưới vài MB, client `fetchFishForecast` 25s; sửa 2026-06-16 — trước thiếu, nguồn treo làm route treo). Lỗi tải phải có đường THỬ LẠI (vd lưới dự báo: nút "Thử lại" + bật lại lớp tự thử lại) — không có thất bại câm, không có "Đang tải" treo vô hạn.
- **Công sức người dùng là dữ liệu quý — không tự vứt** (hội đồng UX 2026-06-11): kết quả tốn công tạo (tuyến dẫn đường ~10s tính) KHÔNG bị xóa ngầm vì một cú chạm; đổi đích thì `route-planner.tsx` giữ tuyến cũ trên bản đồ + dải nhắc "tuyến đang tới chỗ chạm trước" với nút Xóa tuyến (KHÔNG key-remount panel — chỉ dọn kết quả của đích cũ qua `useEffect`). Cùng tinh thần: sổ lãi/lỗ — state `trips` sống ở `money-insights.tsx` (một nguồn sự thật), `trip-log.tsx` là controlled component, thẻ "Nhìn nhanh" cập nhật tức thì; nút "Chia tiền" trên thẻ chuyến + tab Chia tiền tự đổ số từ chuyến mới nhất (`trip-split.tsx` prop `prefill`).
- **Đồng bộ SDVICO = MỘT hook 4 nấc** (roadmap 2026-06-11): `lib/use-sdvico-assets.ts` (`useSdvicoAssets`) — cache module-level dùng chung cho cả /tau (`tau-tabs.tsx` banner nợ + badge tab, `boat-products.tsx`, `boat-services.tsx`), phân biệt `loading / guest / unlinked / error / ok` (classify thuần có test). Lỗi mạng KHÔNG được hiện thành "Đăng nhập để thấy đồ" — nấc error có nút Thử lại. Gửi yêu cầu CSKH xong gọi `addOptimisticRequest()` để "Yêu cầu đã gửi" hiện ngay. KHÔNG fetch `/api/me/sdvico` tay trong component nữa.
- **Đa tàu = store dùng chung** (ba-spec [08](08-ba-spec-da-tau.md), 2026-06-15): `lib/boat-store.ts` (`useBoats`) — module-level store + `useSyncExternalStore`, KHÔNG còn hook per-component. Đổi tàu (`setCurrent`) → MỌI màn dùng `useBoats` re-render ngay, không cần reload (đóng bug live-sync triage). `boat-switcher.tsx` re-export `useBoats` cho import cũ. Actions: `setCurrent/addBoat/updateBoat/removeBoat` (removeBoat guard ≥1 tàu + nhận callback cascade). **Scope hồ sơ** (08 R1/R2): cố-định-theo-tàu (giấy tờ, bảo dưỡng, **chuyến biển** `boatId`) lọc theo tàu đang chọn; động-theo-chủ (**thuyền viên** — `crew-list` bỏ lọc boatId, hàng SDVICO) hiện như nhau mọi tàu. `BoatSwitcher` giờ có cả trên `/tien` (lãi-lỗ theo tàu).
- **Tabs nhận deep-link**: `ui/tabs.tsx` prop `paramKey` (vd `/tau?tab=dich-vu`), đọc `window.location.search` sau mount (không cần Suspense, trang vẫn prerender tĩnh); hỗ trợ controlled (`value`/`onChange`) + `badge` chấm đỏ. Nhắc việc ở `urgent-strip.tsx` trỏ href kèm `?tab=`.
- **SnapSheet**: prop `above` (nội dung nổi `bottom-full` ngay trên mép sheet — thanh giờ gió/sóng nằm đây, theo sheet khi nở/thu), `closeIcon`; thanh kéo + vùng peek chạm là nở (không còn đồ giả). Login `/login` thử `signInWithPassword` TRƯỚC, SSO gateway chỉ khi sai (timeout 8s).

## 6. Cross-references

- Vì sao route chia theo trục: [01-product.md](01-product.md)
- Tokens/màu trong `globals.css`: [03-design-system.md](03-design-system.md)
- Schema + expiry logic: [04-data-model.md](04-data-model.md)

---

**Last updated**: 2026-06-10

<!-- re-verified: 2026-07-25k — XOÁ route /api/tiles/contour + các export trỏ nó trong nautical-layers.ts (openseamapContourTileUrl/Source/Layer, withContourLayer). LÝ DO SỰ CỐ: thư mục TĨNH `contour` đứng cạnh route ĐỘNG `/api/tiles/[src]` làm Next 16 (Turbopack) DROP TOÀN BỘ /api/* → mọi route 404 lúc chạy (build vẫn pass, unit test vẫn xanh); /api/storms 404 nên app KHÔNG lấy được tin bão dù GDACS đang có bão NOUL trong Biển Đông. Route contour vốn là code chết (0 nơi gọi). Hải đồ + phao đèn vẫn qua proxy /api/tiles/[src]. Chặn hồi quy: src/lib/__tests__/api-routes-structure.test.ts cấm thư mục api vừa có con động vừa có con tĩnh. -->
