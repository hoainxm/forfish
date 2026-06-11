# 02 — Kiến trúc / Architecture: routes, components, demo mode

> **Mục đích / Purpose**: Bản đồ code thực tế — routes, folder layout, component map, và cơ chế demo mode fallback khi chưa có Supabase.

**Load khi / Load when**: thêm/sửa page, route, navigation, component; cần hiểu app chạy thế nào khi env trống.

---

## 1. Stack

- **Next.js 16** App Router + TypeScript (lưu ý: Next 16 có breaking changes — đọc `node_modules/next/dist/docs/` khi không chắc API)
- **Tailwind CSS v4** — design tokens khai báo trong `src/app/globals.css` qua `@theme` (xem [03-design-system.md](03-design-system.md))
- **Supabase** qua `@supabase/ssr` (browser + server client)
- **MapLibre GL** (`maplibre-gl` + `react-map-gl`) — bản đồ ngư trường Trục 1; NẶNG nên bắt buộc lazy-load qua `next/dynamic` `ssr:false` (`fishing-map.tsx`), không để lọt vào bundle các trục khác
- **Vitest** — test runner cho logic thuần trong `src/lib/` (`npm test`, config `vitest.config.ts`, test đặt tại `src/lib/__tests__/`)
- Deploy: **Vercel** · Repo: github.com/Long-Forfun/ForFish

## 2. Routes — mỗi trục một route

| Route | Trục | File | Trạng thái |
|---|---|---|---|
| `/` | — | `src/app/page.tsx` | Trang chủ / Home: các trục + nhắc việc gấp (`urgent-strip.tsx`) |
| `/ngu-truong` | 1 — Đánh bắt tốt hơn | `src/app/ngu-truong/page.tsx` | **MVP — MÀN HÌNH MAP-FIRST kiểu Google Maps** (2026-06-10: page = map full-screen `fixed`, KHÔNG cuộn dọc; mọi thứ là lớp nổi/sheet trên map — `fishing-map.tsx` → `fishing-map-view.tsx`): **(a)** lớp nổi: chip/banner tin bão trên cùng (`storm-banner.tsx` variant `overlay` + `src/lib/storms.ts` ← `/api/storms`), badge lớp+ngày ảnh (bấm = mở chọn lớp), FAB "Lớp"/"Tàu tôi" cột phải; **(b)** chọn lớp qua `layer-sheet.tsx` (radio: **HẢI ĐỒ độ sâu EMODnet — MẶC ĐỊNH khi mở, chuẩn app hàng hải, nhớ lựa chọn `forfish.maplayer.v1`** / SST anomaly / phù du / ảnh mây qua `src/lib/ocean-map.ts` + legend + toggle phao đèn OpenSeaMap; ranh giới + bão + nhãn chủ quyền LUÔN bật — xem docs/research/09); **(c)** sheet đáy 3 nấc `ui/snap-sheet.tsx` — sau audit 2026-06-10 chỉ còn MỘT chế độ "gió sóng chỗ đang xem": mở app = điểm đặt sẵn tại CẢNG NHÀ (`forfish.port.v1`, 10 cảng `src/data/ports.ts`, đổi qua select "Cảng nhà của tôi" cuối sheet), chạm biển = chỗ chạm (nút "Về cảng" hiện ở mọi nấc); nội dung: chip chọn ngày 1–10 + thẻ điểm (`marine-weather.ts` + thang `sea.ts`) + cảnh báo nước cạn tại điểm (`depth-grid.ts` hạng 1–2) + **dẫn đường tiết kiệm dầu** (`route-planner.tsx` ← `route-plan.ts`/`route-weather.ts`, thông số tàu `forfish.boat.v1`; có tuyến → sheet GIỮ NGUYÊN, fitBounds chừa đáy) + gió/sóng + mưa/dông + độ tin `forecastConfidence` + cảnh báo ranh giới `geofence.ts` (chỉ khi gần); vị trí nói kiểu "Cách cảng X ~Y hải lý hướng Z", toạ độ số ở cuối sheet |
| `/api/storms` | 1 (API) | `src/app/api/storms/route.ts` | Proxy nguồn tin bão quốc tế (GDACS), cache 30 phút, lọc vùng Biển Đông qua `parseStorms`. Fail → `{ok:false}`, client im lặng — KHÔNG bao giờ nói "không có bão" khi không kiểm tra được |
| `/api/fish-forecast` | 1 (API) | `src/app/api/fish-forecast/route.ts` | **DỰ BÁO CÁ (PFZ)**: kéo lưới SST + phù du (bắt buộc) + SSHA / dị thường nhiệt / dòng chảy u,v (tuỳ chọn) từ NOAA ERDDAP, chấm điểm loài qua `lib/fish-predict.ts`, cache 6h. Fail → `{ok:false}`, client lùi về mùa vụ |
| `/api/sea-scalar` | 1 (API) | `src/app/api/sea-scalar/route.ts` | Lớp số liệu biển (`?kind=ssha` nước dâng/xoáy; `sss` độ mặn đang rút khỏi UI) — ERDDAP, cache 6h, lùi ngày khi nguồn quét theo vệt trống vùng |
| `/api/me/sdvico` | TÀU (API) | `src/app/api/me/sdvico/route.ts` | Đồ SDVICO của khách đang đăng nhập (sản phẩm/bảo hành, dịch vụ/kỳ cước, khoản chờ đóng) — account CRM suy từ SESSION, không nhận id từ client; chưa đăng nhập/chưa cấu hình → `{ok:false}`, UI dùng dữ liệu local. Chuỗi nối: [04-data-model.md](04-data-model.md) §6 |
| `/api/sdvico/catalog` | TÀU (API) | `src/app/api/sdvico/catalog/route.ts` | Danh mục SDVICO theo nhóm (dữ liệu chung, cache 1h) — nhóm theo tiền tố SKU qua `lib/sdvico-catalog.ts` |
| `/api/sdvico/request` | TÀU (API) | `src/app/api/sdvico/request/route.ts` | Khách gửi yêu cầu (hỏi mua/sửa chữa/bảo dưỡng/cước) → INSERT `consultation_requests` bên CRM (`source_page='forfish'`); dùng được cả khi CHƯA đăng nhập, bắt buộc SĐT VN hợp lệ. Xem [04-data-model.md](04-data-model.md) §6 |
| `/api/auth/sso` + `/api/auth/signup` | AUTH (API) | `src/app/api/auth/{sso,signup}/route.ts` | Route MỎNG → Edge Function `auth-gateway` trong project ForFish (qua `lib/auth-gateway.ts`). **sso**: verify SĐT+mk với CRM SDViCo → đồng bộ mk vào tài khoản ForFish → client `signInWithPassword` chuẩn (đã bỏ magic-link, không cần `SUPABASE_SERVICE_ROLE_KEY`). **signup**: tạo user email-ảo `{SĐT}@sdvico.local` ĐÃ confirm (email ảo không có hòm thư để bấm link). Env cần: chỉ `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` (đã set local + Vercel production 2026-06-10) |
| `/tau` | TÀU — tài sản / boat asset | `src/app/tau/page.tsx` | **MVP + kênh CSKH SDVICO**: tách tab (`ui/tabs.tsx`): Giấy tờ (`document-vault.tsx`) · **Dịch vụ** (`boat-services.tsx` — dịch vụ/cước đồng bộ + nút Gọi SDVICO + sổ nhắc tự ghi `maintenance-reminders.tsx`) · Sản phẩm (`boat-products.tsx` — đồ đã mua + bảo hành, gợi ý nhóm `sdvico-catalog.tsx`) · Mức phạt (`fines-lookup.tsx` ← `src/data/fines.ts`) |
| `/nguoi` | NGƯỜI — lao động / crew (xem [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md)) | `src/app/nguoi/page.tsx` | **MVP**: Bạn thuyền — sổ thuyền viên (`crew-list.tsx`, localStorage `forfish.crew.v1` — hồ sơ + bảo hiểm/chứng chỉ hạn + sổ ứng tiền). Chia tiền đã dời sang `/tien` |
| `/tien` | TIỀN — tài chính / money | `src/app/tien/page.tsx` | **TÁCH ĐÔI (2026-06-10)**: 2 tab — **Giao dịch** (`trade-hub.tsx`: Giá cá `price-board.tsx` · **Ai cần mua** `buy-board.tsx` ← `data/buy-requests.ts` TIN MẪU chờ app thu mua · Bán ở đâu `sell-guide.tsx`) · **Hiệu quả** (`money-insights.tsx`: thẻ nhìn nhanh ← `lib/trip-insights.ts` có test · Sổ lãi/lỗ `trip-log.tsx` · Chia tiền `trip-split.tsx`) |
| `/gia-ca` `/van-hanh` `/giay-to` `/thuyen-vien` | — (REDIRECT stub) | `src/app/{gia-ca,van-hanh,giay-to,thuyen-vien}/page.tsx` | **Redirect stub** giữ link cũ: `/gia-ca`→`/tien`, `/van-hanh`→`/tau`, `/giay-to`→`/tau`, `/thuyen-vien`→`/nguoi` (taxonomy mới: Ra khơi / Tàu / Người / Tiền) |

Quy ước: route slug là tiếng Việt không dấu, khớp ngôn ngữ người dùng. Thêm route mới → update bảng này cùng commit. Đổi/gộp route → để lại redirect stub cho slug cũ.

## 3. Folder layout

```
src/
  app/
    layout.tsx          # Root layout (fonts, bottom nav)
    globals.css         # Tailwind v4 @theme tokens — single source màu/typography
    page.tsx            # Trang chủ
    ngu-truong/  tau/  nguoi/  tien/            # 4 trục hiện hành (Ra khơi / Tàu / Người / Tiền)
    gia-ca/  van-hanh/  giay-to/  thuyen-vien/  # REDIRECT stub slug cũ → trục mới (xem bảng §2)
  components/
    bottom-nav.tsx      # Điều hướng dưới cùng (mobile-first, các trục + home)
    page-header.tsx     # Header sóng dùng chung
    icons.tsx           # Bộ icon stroke SVG — NGUỒN ICON DUY NHẤT, cấm emoji
    urgent-strip.tsx    # Trang chủ: dải nhắc việc gấp (giấy tờ/bảo hiểm sắp hết hạn…)
    ui/                 # Primitives dùng chung (xem khối ui/ bên dưới)
    document-vault.tsx  # Trục TÀU: vault UI — pattern chuẩn cho mọi CRUD localStorage
    fines-lookup.tsx    # Trục TÀU: tra mức phạt (NĐ 38/2024)
    sell-guide.tsx      # Trục TIỀN: "Bán ở đâu" — kênh bán + vựa + người mua theo loài/vùng (← market-channels + seafood-buyers + wholesalers/*, lọc bằng lib/region.ts)
    sea-forecast.tsx    # Trục 1: LEGACY — không còn page nào dùng (logic đã gộp vào mode cảng của fishing-map-view); cân nhắc xoá khi ổn định
    storm-banner.tsx    # Trục 1: banner tin bão (3 trạng thái: bão / yên / im lặng khi nguồn fail) — variant "page" + "overlay" (nổi trên map)
    fishing-map.tsx     # Trục 1: vỏ lazy-load bản đồ (next/dynamic ssr:false), loading full-height
    fishing-map-view.tsx # Trục 1: MÀN HÌNH map-first — map full-screen + lớp nổi + SnapSheet đáy 2 mode (cảng/điểm chạm); nhãn chủ quyền + ranh giới + bão luôn render
    layer-sheet.tsx     # Trục 1: sheet chọn lớp kiểu Google Maps (radio 4 nền + dự báo Gió/Sóng + toggle Cá mùa này/Phao đèn; lớp an toàn không có công tắc)
    my-places-sheet.tsx # Trục 1: sheet "Điểm của tôi" — GPS + ghim chủ tàu (đổi tên/xoá/đặt cảng nhà) + tìm cảng nhà trong 173 cảng (gõ lọc, không đổ list)
    ui/                 # Primitives dùng chung (UI nền):
      primitives.tsx    #   nút/thẻ/field cơ bản theo design-system (font ≥18px, tap ≥56px)
      tabs.tsx          #   Tabs trong trang — dùng cho /tau và /tien thay vì cuộn dọc dài
      bottom-sheet.tsx  #   BottomSheet MODAL (có scrim) — form thêm/sửa CRUD
      confirm-dialog.tsx#   Hộp xác nhận xóa dùng chung
      status-banner.tsx #   Banner trạng thái chung (thông tin/cảnh báo)
      region-filter.tsx #   Bộ lọc Bắc/Trung/Nam (← lib/region.ts) cho danh sách theo vùng
    ui/snap-sheet.tsx   # SnapSheet dùng chung: sheet đáy THƯỜNG TRỰC 3 nấc peek/half/full, không scrim, điều khiển bằng nút to (khác BottomSheet là modal)
    route-planner.tsx   # Trục 1: dẫn đường tiết kiệm dầu — form xuất phát/thông số tàu + thẻ kết quả + lớp vẽ tuyến (RouteMapLayers, đặt trong MapGL)
    price-board.tsx     # Trục 2: bảng giá tham khảo
    trip-log.tsx        # Trục 2: sổ lãi lỗ chuyến biển
    supply-catalog.tsx  # Trục 3: danh mục vật tư
    maintenance-reminders.tsx  # Trục TÀU: sổ nhắc bảo dưỡng TỰ GHI — nhúng trong boat-services (tab Dịch vụ)
    boat-services.tsx   # Trục TÀU: tab DỊCH VỤ — dịch vụ đồng bộ + cước chờ đóng + nút Gọi SDVICO + sổ nhắc tự ghi
    sdvico-catalog.tsx  # Trục TÀU: "SDVICO có gì cho tàu mình" — nhóm gợi ý (← /api/sdvico/catalog), nhãn "đang dùng" theo đồ đã mua
    sdvico-request.tsx  # Trục TÀU: nút + form "Gọi SDVICO" (hỏi mua/sửa chữa/bảo dưỡng/cước) → /api/sdvico/request
  data/
    ports.ts            # 10 cảng + tọa độ đã kiểm chứng Open-Meteo
    vn-maritime-border.ts # Ranh giới biển VN — 75 điểm CHUẨN (user cấp 2026-06-10, "borderpoints.json"), Campuchia → Trường Sa → Hoàng Sa → Vịnh Bắc Bộ → Móng Cái; nguồn cho geofence cảnh báo IUU
    fish-seasons.ts     # Cá mùa này — 7 vùng biển (polygon + labelAt) × 11 loài × tháng, nguồn RIMF/báo ngành THAM KHẢO; regionAt/fishInRegion (có test)
    port-prices.ts      # Giá cá THAM KHẢO (nguồn báo công khai, có ngày tổng hợp)
    supplies.ts         # Danh mục vật tư THAM KHẢO
    fines.ts            # Mức phạt NĐ 38/2024 (cá nhân) THAM KHẢO
    market-channels.ts  # Trục TIỀN: kênh bán cá (chợ đầu mối/vựa/online…) THAM KHẢO — nguồn cho sell-guide
    seafood-buyers.ts   # Trục TIỀN: doanh nghiệp thu mua thủy sản theo tỉnh/loài THAM KHẢO (province đã chuẩn hóa tên hiển thị sau 2025)
    wholesalers/        # Trục TIỀN: vựa/đầu mối theo vùng — bac/trung/nam + bs-* (province đã chuẩn hóa); gộp qua index.ts, types.ts
    fishing-ports.ts    # 173 cảng cá toàn quốc (province + tọa độ, tên tỉnh chuẩn sau 2025) — DỮ LIỆU CÓ SẴN, CHƯA WIRE vào UI nào
  lib/
    documents.ts        # Domain logic Trục TÀU (kinds, expiry status) — xem 04-data-model.md
    format.ts           # Helper định dạng dùng chung (số tiền/ngày…)
    region.ts           # Phân vùng Bắc/Trung/Nam: Region, COASTAL_PROVINCES, provinceKey/regionOf — nền cho lọc theo tỉnh ⇒ ĐÒI HỎI tên tỉnh thống nhất giữa các dataset
    geofence.ts         # Trục 1: cảnh báo vượt ranh giới biển (← vn-maritime-border.ts)
    crew.ts             # Trục NGƯỜI/TIỀN: logic chia tiền chuyến (có test)
    sea.ts              # Trục 1: fetch Open-Meteo + công thức điểm đi biển (scoreDay/levelOf — THANG ĐIỂM DUY NHẤT của trục)
    ocean-map.ts        # Trục 1: adapter lớp bản đồ (vệ tinh NASA GIBS trễ 2 ngày; độ sâu EMODnet/GEBCO tĩnh + ĐƯỜNG ĐẲNG SÂU số mét từ public/data/isobaths.v1.json — sinh bởi scripts/generate-isobaths.mjs vì EMODnet WMS chỉ phủ châu Âu; phao đèn OpenSeaMap zoom ≥8) + style (có glyphs cho nhãn) + nhãn chủ quyền VN
    marine-weather.ts   # Trục 1: gió/sóng tại 1 điểm chạm (Open-Meteo) — tái dùng scoreDay/levelOf từ sea.ts
    forecast-grid.ts    # Trục 1: lưới dự báo vẽ động kiểu Windy — 80 điểm × 72h (bước 3h), arrowFeatures GeoJSON mũi tên + thang màu + timeLabelVN (thuần, có test)
    places.ts           # Trục 1: "Điểm của tôi" — ghim chủ tàu + cảng nhà (localStorage forfish.places.v1); upsert/remove/rename/makeHome/placeAt (thuần, có test). THAY việc chọn cảng trong danh sách
    weather-codes.ts    # Trục 1: mã WMO → nhãn tiếng Việt (dông/mưa) + cờ danger
    fish-predict.ts     # Trục 1: DỰ BÁO CÁ (PFZ) — khẩu vị 39 loài 6 nhóm (SpeciesCategory pelagic-large/small, cephalopod, demersal, reef, crustacean) × (trapezoid SST + dải chl + trọng số 6 yếu tố) × habitat{mồi, front nhiệt, front mồi, rìa xoáy SSHA, nước trồi anomaly, hội tụ dòng u,v} × mùa vụ/vùng. SurfaceSignal high/medium/low + SURFACE_CONF: loài đáy (low) kéo habitat về trung tính → KHÔNG vẽ điểm nóng giả, "Mọi loài" chỉ tính loài định-vị-được. Mỗi loài có color + SPECIES_META (UI) + CATEGORY_LABEL. gradientStrength/convergenceStrength/buildFishForecast(sst,chl,sla,month,{anom,cur}) thuần có test; mọi trường ngoài SST+chl TUỲ CHỌN; cell mang t (°C)+c (chl) cho UI; client /api/fish-forecast
    moon.ts             # tuần trăng tính offline (chu kỳ giao hội 29,53 ngày) + lời nghề đèn (mực/cá cơm) — hiện trong sheet bản đồ Trục 1; có test
    sea-scalars.ts      # Trục 1: lớp số liệu biển — SSHA "Nước dâng, xoáy" (sống); sss độ mặn TẠM RÚT khỏi UI (SMOS nhiễu RFI Biển Đông, SMAP chết) — client gọi /api/sea-scalar?kind=
    storms.ts           # Trục 1: adapter tin bão (parse/lọc vùng Biển Đông, types) — client gọi /api/storms
    route-plan.ts       # Trục 1: THUẦN LOGIC dẫn đường kiểu VISIR (docs/research/06 + audit §3b) — lưới phủ vùng + Dijkstra, Kwon 4 bậc hướng sóng, thang an toàn KTTV (cấp 6 phạt 1,15 / cấp 7 phạt 1,5 + đỏ / cấp 8 chặn), TRẦN VÒNG 1,3× direct, fuelDeltaL có dấu, độ sâu mẫu ≤5 km/cạnh
    route-weather.ts    # Trục 1: adapter Open-Meteo — LƯỚI thời tiết thô ≤120 điểm/lượt theo GIỜ (72h: sóng+hướng, gió+hướng, DÒNG CHẢY SMOC gồm triều), nội suy song tuyến xuống lưới tìm đường
    depth-grid.ts       # Trục 1: lưới độ sâu tĩnh ETOPO 2022 (public/data/depth-grid.v1.bin ~30 KB, sinh bởi scripts/generate-depth-grid.mjs) — chặn đất + <4 m, cảnh báo 4–12 m, vùng rạn HS/TS quét min-pool 15″
    owned-assets.ts     # Trục TÀU: types TRUNG LẬP VENDOR cho đồ khách mua (sản phẩm/bảo hành, dịch vụ/kỳ cước, khoản chờ đóng) + getServiceDueStatus (thuần, có test)
    sdvico-catalog.ts   # Trục TÀU: nhóm catalog theo tiền tố SKU + chủ đề yêu cầu CSKH (thuần, có test)
    sdwork-assets.ts    # Trục TÀU: ADAPTER SDWork CRM → OwnedAssets (server-only) — gọi Edge Function `forfish-gateway` BÊN TRONG project CRM bằng anon key sẵn có (không cần service key trong env); mapCrmAssets thuần có test; xem 04-data-model §6
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
3. Vault **hydrate từ localStorage trong `useEffect` sau mount** — tránh SSR/CSR mismatch. KHÔNG đọc localStorage lúc render đầu.

→ Mọi feature mới đụng dữ liệu phải giữ pattern này: chạy được không cần Supabase, degrade gracefully.

## 5. Quy ước component

- Client component chỉ khi cần (`"use client"` khi có state/localStorage/fetch)
- CRUD cục bộ theo pattern `document-vault.tsx`: hydrate sau mount, bottom-sheet form, confirm xóa
- UI tuân thủ [03-design-system.md](03-design-system.md) (font ≥18px, tap ≥56px)
- **Mọi fetch nguồn ngoài phải có `AbortSignal.timeout(15000)`** (2026-06-10): mạng ngoài khơi chập chờn — thà báo lỗi rõ còn hơn treo UI chờ browser timeout. Áp dụng: Open-Meteo (sea/marine-weather/route-weather/forecast-grid), GDACS (`/api/storms`, server 15s + client 20s), Overpass (25s vì nguồn chậm). Lỗi tải phải có đường THỬ LẠI (vd lưới dự báo: nút "Thử lại" + bật lại lớp tự thử lại) — không có thất bại câm, không có "Đang tải" treo vô hạn.

## 6. Cross-references

- Vì sao route chia theo trục: [01-product.md](01-product.md)
- Tokens/màu trong `globals.css`: [03-design-system.md](03-design-system.md)
- Schema + expiry logic: [04-data-model.md](04-data-model.md)

---

**Last updated**: 2026-06-10
