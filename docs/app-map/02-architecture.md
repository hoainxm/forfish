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
| `/ngu-truong` | 1 — Đánh bắt tốt hơn | `src/app/ngu-truong/page.tsx` | **MVP — MÀN HÌNH MAP-FIRST kiểu Google Maps** (2026-06-10: page = map full-screen `fixed`, KHÔNG cuộn dọc; mọi thứ là lớp nổi/sheet trên map — `fishing-map.tsx` → `fishing-map-view.tsx`): **(a)** lớp nổi: chip/banner tin bão trên cùng (`storm-banner.tsx` variant `overlay` + `src/lib/storms.ts` ← `/api/storms`), badge lớp+ngày ảnh (bấm = mở chọn lớp), FAB "Lớp"/"Tàu tôi" cột phải; **(b)** chọn lớp qua `layer-sheet.tsx` (radio: **HẢI ĐỒ độ sâu EMODnet — MẶC ĐỊNH khi mở, chuẩn app hàng hải, nhớ lựa chọn `forfish.maplayer.v1`** / SST anomaly / phù du / ảnh mây qua `src/lib/ocean-map.ts` + legend + toggle phao đèn OpenSeaMap; ranh giới + bão + nhãn chủ quyền LUÔN bật — xem docs/research/09); **(c)** sheet đáy 3 nấc `ui/snap-sheet.tsx`: mode CẢNG mặc định (điểm đi biển 1–100 `src/lib/sea.ts`, cache `forfish.sea.{port}.v2`, cảng nhớ `forfish.port.v1`, 10 cảng `src/data/ports.ts`) ⟷ mode ĐIỂM CHẠM (gió sóng `src/lib/marine-weather.ts`, chip chọn ngày 1–10 + độ tin `forecastConfidence`, mưa/dông `weather-codes.ts`, cảnh báo ranh giới `geofence.ts`, **dẫn đường tiết kiệm dầu** `route-planner.tsx` ← `route-plan.ts`/`route-weather.ts`/`depth-grid.ts`, thông số tàu `forfish.boat.v1`; có tuyến → sheet tự thu về peek) |
| `/api/storms` | 1 (API) | `src/app/api/storms/route.ts` | Proxy nguồn tin bão quốc tế (GDACS), cache 30 phút, lọc vùng Biển Đông qua `parseStorms`. Fail → `{ok:false}`, client im lặng — KHÔNG bao giờ nói "không có bão" khi không kiểm tra được |
| `/tau` | TÀU — tài sản / boat asset | `src/app/tau/page.tsx` | **MVP**: gộp giấy tờ + vận hành vào một trang, tách tab (`ui/tabs.tsx`): Giấy tờ (`document-vault.tsx`) · Bảo dưỡng (`maintenance-reminders.tsx` ← `src/data/supplies.ts`) · Vật tư (`supply-catalog.tsx`) · Mức phạt (`fines-lookup.tsx` ← `src/data/fines.ts`) |
| `/nguoi` | NGƯỜI — lao động / crew (xem [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md)) | `src/app/nguoi/page.tsx` | **MVP**: Bạn thuyền — sổ thuyền viên (`crew-list.tsx`, localStorage `forfish.crew.v1` — hồ sơ + bảo hiểm/chứng chỉ hạn + sổ ứng tiền). Chia tiền đã dời sang `/tien` |
| `/tien` | TIỀN — tài chính / money | `src/app/tien/page.tsx` | **MVP**: gộp giá bán + tài chính, tách tab (`ui/tabs.tsx`): Giá cá (`price-board.tsx` ← `src/data/port-prices.ts`) · Bán ở đâu (`sell-guide.tsx` ← `src/data/market-channels.ts` + `seafood-buyers.ts` + `wholesalers/*`) · Lãi/lỗ (`trip-log.tsx`, localStorage `forfish.trips.v1`) · Chia tiền (`trip-split.tsx` ← `src/lib/crew.ts`, có test) |
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
    layer-sheet.tsx     # Trục 1: sheet chọn lớp kiểu Google Maps (radio 4 lớp + legend + toggle phao đèn; lớp an toàn không có công tắc)
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
    maintenance-reminders.tsx  # Trục 3: nhắc bảo dưỡng
  data/
    ports.ts            # 10 cảng + tọa độ đã kiểm chứng Open-Meteo
    vn-maritime-border.ts # Ranh giới biển VN — 75 điểm CHUẨN (user cấp 2026-06-10, "borderpoints.json"), Campuchia → Trường Sa → Hoàng Sa → Vịnh Bắc Bộ → Móng Cái; nguồn cho geofence cảnh báo IUU
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
    ocean-map.ts        # Trục 1: adapter lớp bản đồ (vệ tinh NASA GIBS trễ 2 ngày; độ sâu EMODnet/GEBCO tĩnh; phao đèn OpenSeaMap zoom ≥9) + style + nhãn chủ quyền VN
    marine-weather.ts   # Trục 1: gió/sóng tại 1 điểm chạm (Open-Meteo) — tái dùng scoreDay/levelOf từ sea.ts
    weather-codes.ts    # Trục 1: mã WMO → nhãn tiếng Việt (dông/mưa) + cờ danger
    storms.ts           # Trục 1: adapter tin bão (parse/lọc vùng Biển Đông, types) — client gọi /api/storms
    route-plan.ts       # Trục 1: THUẦN LOGIC dẫn đường kiểu VISIR (docs/research/06) — lưới phủ vùng + Dijkstra time-dependent, giảm tốc theo hướng sóng (Kwon-lite), chặn sóng ≥4 m, sóng đuôi ≥2 m (IMO 1228-lite), ràng buộc độ sâu; mô hình dầu THAM KHẢO
    route-weather.ts    # Trục 1: adapter Open-Meteo — LƯỚI thời tiết thô ≤120 điểm/lượt theo GIỜ (72h: sóng+hướng, gió+hướng, DÒNG CHẢY SMOC gồm triều), nội suy song tuyến xuống lưới tìm đường
    depth-grid.ts       # Trục 1: lưới độ sâu tĩnh ETOPO 2022 (public/data/depth-grid.v1.bin ~30 KB, sinh bởi scripts/generate-depth-grid.mjs) — chặn đất + <4 m, cảnh báo 4–12 m, vùng rạn HS/TS quét min-pool 15″
    __tests__/          # Vitest cho logic thuần (ocean-map, marine-weather, sea, weather-codes, storms, route-plan)
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

## 6. Cross-references

- Vì sao route chia theo trục: [01-product.md](01-product.md)
- Tokens/màu trong `globals.css`: [03-design-system.md](03-design-system.md)
- Schema + expiry logic: [04-data-model.md](04-data-model.md)

---

**Last updated**: 2026-06-10
