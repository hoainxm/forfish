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
| `/` | — | `src/app/page.tsx` | Trang chủ: bốn trục + nhắc việc gấp |
| `/giay-to` | 4 — Tuân thủ dễ hơn | `src/app/giay-to/page.tsx` | **MVP**: Tủ giấy tờ (`document-vault.tsx`) + tra mức phạt (`fines-lookup.tsx` ← `src/data/fines.ts`) |
| `/ngu-truong` | 1 — Đánh bắt tốt hơn | `src/app/ngu-truong/page.tsx` | **MVP**: điểm đi biển 1–100 (`sea-forecast.tsx` + `src/lib/sea.ts` — Open-Meteo marine+weather, client-side, cache localStorage 1h — **key `forfish.sea.{port}.v2`**; 10 cảng đã kiểm chứng: `src/data/ports.ts`) + bản đồ ngư trường (`fishing-map.tsx` → `fishing-map-view.tsx` — lớp vệ tinh SST/phù du/ảnh mây + hải đồ độ sâu EMODnet/GEBCO (tĩnh) + phao/đèn biển OpenSeaMap (overlay tự hiện khi zoom ≥9) qua `src/lib/ocean-map.ts`, nhãn chủ quyền Biển Đông/Hoàng Sa/Trường Sa, chạm xem gió sóng từng điểm qua `src/lib/marine-weather.ts`) + mưa/dông trong mọi dự báo (`src/lib/weather-codes.ts`, dông trừ 30 điểm trong `scoreDay`) + banner & marker tin bão Biển Đông (`storm-banner.tsx` + `src/lib/storms.ts` ← route `/api/storms`) + **dẫn đường tiết kiệm dầu** (`route-planner.tsx` — chọn cảng/GPS xuất phát, tuyến vẽ lên bản đồ; thuật toán thuần `src/lib/route-plan.ts`, dự báo theo giờ nhiều điểm qua adapter `src/lib/route-weather.ts`; thông số tàu localStorage **`forfish.boat.v1`**) |
| `/api/storms` | 1 (API) | `src/app/api/storms/route.ts` | Proxy nguồn tin bão quốc tế (GDACS), cache 30 phút, lọc vùng Biển Đông qua `parseStorms`. Fail → `{ok:false}`, client im lặng — KHÔNG bao giờ nói "không có bão" khi không kiểm tra được |
| `/gia-ca` | 2 — Bán được đắt hơn | `src/app/gia-ca/page.tsx` | **MVP**: bảng giá tham khảo (`price-board.tsx` ← `src/data/port-prices.ts`) + sổ lãi lỗ (`trip-log.tsx`, localStorage `forfish.trips.v1`) |
| `/van-hanh` | 3 — Vận hành rẻ hơn | `src/app/van-hanh/page.tsx` | **MVP**: nhắc bảo dưỡng (`maintenance-reminders.tsx`, localStorage `forfish.maintenance.v1`) + danh mục vật tư (`supply-catalog.tsx` ← `src/data/supplies.ts`) |
| `/thuyen-vien` | Quản lý tàu (xem [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md)) | `src/app/thuyen-vien/page.tsx` | **MVP**: sổ thuyền viên (`crew-list.tsx`, localStorage `forfish.crew.v1` — hồ sơ + bảo hiểm/chứng chỉ hạn + sổ ứng tiền) + máy tính chia tiền chuyến (`trip-split.tsx` ← logic `src/lib/crew.ts`, có test). Vào từ thẻ trang chủ, chưa có tab nav |

Quy ước: route slug là tiếng Việt không dấu, khớp ngôn ngữ người dùng. Thêm route mới → update bảng này cùng commit.

## 3. Folder layout

```
src/
  app/
    layout.tsx          # Root layout (fonts, bottom nav)
    globals.css         # Tailwind v4 @theme tokens — single source màu/typography
    page.tsx            # Trang chủ
    giay-to/  ngu-truong/  gia-ca/  van-hanh/   # 1 folder / trục
  components/
    bottom-nav.tsx      # Điều hướng dưới cùng (mobile-first, 4 trục + home)
    page-header.tsx     # Header sóng dùng chung
    icons.tsx           # Bộ icon stroke SVG — NGUỒN ICON DUY NHẤT, cấm emoji
    document-vault.tsx  # Trục 4: vault UI — pattern chuẩn cho mọi CRUD localStorage
    fines-lookup.tsx    # Trục 4: tra mức phạt (NĐ 38/2024)
    sea-forecast.tsx    # Trục 1: điểm đi biển + dự báo 10 ngày (kèm nhãn mưa/dông)
    storm-banner.tsx    # Trục 1: banner tin bão/áp thấp Biển Đông (3 trạng thái: bão / yên / im lặng khi nguồn fail)
    fishing-map.tsx     # Trục 1: vỏ lazy-load bản đồ (next/dynamic ssr:false)
    fishing-map-view.tsx # Trục 1: bản đồ MapLibre — lớp vệ tinh + nhãn chủ quyền + gió sóng theo điểm chạm
    route-planner.tsx   # Trục 1: dẫn đường tiết kiệm dầu — form xuất phát/thông số tàu + thẻ kết quả + lớp vẽ tuyến (RouteMapLayers, đặt trong MapGL)
    price-board.tsx     # Trục 2: bảng giá tham khảo
    trip-log.tsx        # Trục 2: sổ lãi lỗ chuyến biển
    supply-catalog.tsx  # Trục 3: danh mục vật tư
    maintenance-reminders.tsx  # Trục 3: nhắc bảo dưỡng
  data/
    ports.ts            # 10 cảng + tọa độ đã kiểm chứng Open-Meteo
    port-prices.ts      # Giá cá THAM KHẢO (nguồn báo công khai, có ngày tổng hợp)
    supplies.ts         # Danh mục vật tư THAM KHẢO
    fines.ts            # Mức phạt NĐ 38/2024 (cá nhân) THAM KHẢO
  lib/
    documents.ts        # Domain logic Trục 4 (kinds, expiry status) — xem 04-data-model.md
    sea.ts              # Trục 1: fetch Open-Meteo + công thức điểm đi biển (scoreDay/levelOf — THANG ĐIỂM DUY NHẤT của trục)
    ocean-map.ts        # Trục 1: adapter lớp bản đồ (vệ tinh NASA GIBS trễ 2 ngày; độ sâu EMODnet/GEBCO tĩnh; phao đèn OpenSeaMap zoom ≥9) + style + nhãn chủ quyền VN
    marine-weather.ts   # Trục 1: gió/sóng tại 1 điểm chạm (Open-Meteo) — tái dùng scoreDay/levelOf từ sea.ts
    weather-codes.ts    # Trục 1: mã WMO → nhãn tiếng Việt (dông/mưa) + cờ danger
    storms.ts           # Trục 1: adapter tin bão (parse/lọc vùng Biển Đông, types) — client gọi /api/storms
    route-plan.ts       # Trục 1: THUẦN LOGIC dẫn đường — hành lang lưới + DP né sóng/gió, mô hình dầu THAM KHẢO (sóng làm chậm, ngược gió ăn dầu), so với đường thẳng
    route-weather.ts    # Trục 1: adapter Open-Meteo theo GIỜ cho NHIỀU điểm/1 lượt gọi (gió+sóng 48h) — sóng null = đất liền, thuật toán né
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
