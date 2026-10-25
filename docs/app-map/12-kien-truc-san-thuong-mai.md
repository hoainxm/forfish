# 12 — Kiến trúc kỹ thuật: CHỢ VẬT TƯ TÀU CÁ (sàn đa người bán)

> **Load khi / Load when**: build hoặc sửa bất kỳ thứ gì trong `src/lib/market/**`, `src/app/cho/**`, `src/app/ban-hang/**`, `src/app/api/{cho,ban-hang,admin/cho,dev}/**`, `src/app/dev/**`, `src/components/market/**`, `src/components/admin/market-admin-tab.tsx`, migration `0060_marketplace.sql`; hoặc muốn biết hợp đồng `MarketStore`, máy trạng thái đơn, danh sách route/trang của sàn.

covers: src/lib/market, src/app/cho, src/app/ban-hang, src/app/api/cho, src/app/api/ban-hang, src/app/api/admin/cho, src/app/api/dev, src/app/dev, src/components/market, src/components/admin/market-admin-tab.tsx, src/components/admin/market-admin-requests.tsx, supabase/migrations/0060_marketplace.sql, supabase/migrations/0063_market_requests_eta.sql
gate: warn
last_verified: 2026-10-19
<!-- re-verified: 2026-10-25e — RÀ FB TOÀN APP lô 1 (bằng chứng + backlog: [design-review/08-ra-fb-toan-app](../design-review/08-ra-fb-toan-app.md)): hợp đồng kho/API KHÔNG đổi. Chạm presentation: `lib/market/list-state.ts` thêm `ListSnapshot.extra?` + ngăn `cho-home`, `cho-shop:<slug>`, `ban-hang/don`, `ban-hang/san-pham`; `lib/market/pricing.ts` chỉ đổi chữ `DROP_LABEL` (có số ⇒ "Gọi shop", không số ⇒ "Nhờ báo giá"); `seller-net.tsx` `useMarketList(path|null)` + restore/setItems/page, `LoadView` vẽ `NoShop` khi `code === "no_shop"`; `market-header.tsx` export `useLeaveGuard(dirty)`; `shop-settings` gửi PATCH `{paused}` riêng khi gạt công tắc (form Lưu không gửi `paused` nữa); món mới `stock` để trống bắt ghi (validate.ts giữ nguyên). -->
<!-- re-verified: 2026-10-19 — gỡ luật cỡ theo đối tượng (quyết định anh Long 2026-10-19, xem 07/03); cỡ theo thang 03 §0. -->
<!-- re-verified: 2026-10-19 — /cho gốc thành MỤC DOCK "Vật tư": đầu màn ManHeader "Vật tư" (bỏ MarketHeader + nút Quay lại về /tien), lối vào cũ ở /tien (thẻ) và /tau (tab Cửa hàng/Đơn) đã gỡ; ?tab=cua-hang|don ở /tau chuyển sang /cho, /cho/don. Luồng mua/giỏ/đơn/báo giá KHÔNG đổi. -->
<!-- re-verified: 2026-10-18 — §13 LUỒNG GIỐNG SHOPEE: hợp đồng kho thêm listOverduePending + 6 hàm yêu cầu đặt hàng (cả supabase-store lẫn file-store, test hợp đồng xanh), OrderPatch.etaFrom/etaTo, Order.etaFrom/etaTo/requestId, migration 0063 (ĐÃ apply prod 2026-10-18), route /api/cho/yeu-cau*, /api/admin/cho/yeu-cau*. -->
ttl_days: 90
<!-- DOC-STATUS: SUSPECT (2026-10-25) — code 'src/components/market' doi sau last_verified. DOI CHIEU VOI CODE truoc khi tin. May quan ly dong nay, dung sua tay. -->
<!-- re-verified: 2026-09-06 - Core pha 2a đã hiện thực đúng hợp đồng §2–§6, §8.1: 24 file lib/market, 11 shared component, migration 0060, /api/dev + /dev, 16 file test; không đổi tên/chữ ký (chỉ THÊM notice.ts, rating.ts, marketErrorStatus/isMarketError theo hình dạng, marketSend, sniffImageMime) -->

**Version**: 1.1 (hợp nhất sau phản biện) · **Ngày**: 2026-09-06 · **Tác giả**: Kiến trúc sư (Phase 1) + Reviewer hợp nhất · **Khung**: LEAD-BRIEF 2026-09-06 §4/§5 = luật cao nhất · **Vì sao**: [ADR 0013](../adr/0013-san-thuong-mai-da-nguoi-ban.md) · **Nghiệp vụ**: [11-ba-spec-san-thuong-mai.md](11-ba-spec-san-thuong-mai.md)

Tài liệu này là **hợp đồng build** cho bốn agent Phase 2 (Core trước · Buyer ∥ Seller ∥ Admin+Docs sau — §10.1). Mọi tên file, tên export, chữ ký hàm, mã lỗi, khoá localStorage dưới đây là **nguyên văn** — agent build không đổi tên; thấy sai thì ghi vào `## Assumptions` của commit và báo lead, không tự đổi.

**Bản 1.1**: mọi tên/mã/số ở đây ĐÃ khớp [11-ba-spec 1.1](11-ba-spec-san-thuong-mai.md). Chỗ 11 và 12 từng lệch: **12 là nguồn cho TÊN** (cột, type, route, mã lỗi, khoá), **11 là nguồn cho HÀNH VI** (ai làm gì, câu chữ, ma trận trạng thái). Bảng đối chiếu từng điểm: [`_generated/phan-bien-san-thuong-mai-2026-09-06.md`](_generated/phan-bien-san-thuong-mai-2026-09-06.md).

---

## 0. Nguyên tắc xuyên suốt (đọc trước khi code)

| # | Luật | Nguồn |
|---|---|---|
| 1 | Định danh = SĐT từ chuỗi cứng (`identityFromRequest`), **không** `auth.uid()`. Bảng mới RLS bật, **không policy**, `revoke all from anon, authenticated`. Route tự lọc theo SĐT đã xác thực — không nhận SĐT từ body/query | 04 §0037, LEAD-BRIEF §0 |
| 2 | Mọi giá/tổng tính lại ở **server** từ sản phẩm hiện tại (`buildMarketLines` + `computeTotals`); snapshot dòng hàng đóng băng trong `market_orders.items` | 0046 pattern |
| 3 | Logic nghiệp vụ = hàm **thuần** trong `src/lib/market/*.ts`, test ở `src/lib/__tests__/market-*.test.ts`. Adapter (`supabase-store.ts`, `file-store.ts`) **không** chứa luật — chỉ đọc/ghi | LEAD-BRIEF §2 |
| 4 | Mọi fetch: `authedFetch(path, init, timeoutMs)` (đã gắn `timeoutSignal` + `noteResponse`). Đọc 12 s · ghi 20 s · upload ảnh 60 s (11 §9). Không gọi `AbortSignal.timeout(` trần (cổng `no-bare-abort-timeout.test.ts`) | ops/external-services |
| 5 | Ghi = online-only. Mất sóng: nói thật + giữ bản đã lưu (đơn), không có dữ liệu giả | ADR 0004 |
| 6 | Mã lỗi route: `{ ok:false, code }` + HTTP status. 503 = **không tra được** (không bao giờ đội lốt 401/403) | api-identity.ts |
| 7 | Tên export mới **không trùng** tên đã có trong repo (hook 1f-b WARN `export function` trùng): `buildMarketLines` (không `buildOrderLines`), `validateMarketProductDraft`, `marketOrderClientRef` (không `orderClientRef`), `canTransitionOrder` (không `canTransition`), `loadMarketCart`/`saveMarketCart` (không `loadCart`), `MarketProductCard` (component, không trùng type `ProductCard`) | NT15 §3 |
| 8 | UI: rem không px, cỡ chữ/chạm theo thang 03 §0, token màu qua `@theme` (cấm hex), `ChipRow`/`Tabs`/`BottomSheet`/`StatusBanner`/`QtyStepper`/`SQ_BTN` có sẵn — không chép tay | 03 |
| 9 | Module `"use client"` **không** được import từ route/server (cổng `server-client-boundary.test.ts`) ⇒ `types.ts`, `categories.ts`, `errors.ts`, `dev-mode.ts`, `order-state.ts`, `pricing.ts`, `validate.ts`, `order-ref.ts`, `order-code.ts`, `text.ts` **không có** `"use client"`; `cart.ts`, `addresses.ts`, `favorites.ts`, `orders-cache.ts`, `seller-flag.ts`, `image-resize.ts`, `client.ts`, `use-online.ts` (đụng `window`) **có** `"use client"` và chỉ được import từ component | server-client-boundary |
| 10 | Khoá `forfish.*` mới (5 khoá `m*`) phải được **xếp loại** ở `NEVER_BACKUP_PREFIXES` (`lib/offline-backup.ts`) — cổng quét `offline-backup.test.ts` bắt mọi chuỗi `"forfish.…"` trong `src/` | state-registry |
| 11 | **LEAD-BRIEF §4/§5 là luật cao nhất**: `settleOverdue` khi đọc (không cron) · `needs_refund` · `shops.paused` · `product_reviews.hidden` · `results[]` từng shop · `marketOrderClientRef` · 1 cách trả tiền/lần đặt + ép COD · `tel:` không ẩn offline · `?province` + "Gần tôi" · danh mục id gạch-ngang · sheet Tài khoản 2 dạng · khách lạ xem chợ · SDVICO sentinel + admin gán · admin xử lý đơn thay shop `by=admin:<sđt>` | LEAD-BRIEF |

---

## 1. Bức tranh tổng

```
 Người mua (/cho/**)          Người bán (/ban-hang/**)        Admin (/quan-tri tab Chợ vật tư)
   │ authedFetch                 │ authedFetch                     │ tokenHeader (pattern /quan-tri)
   ▼                             ▼                                 ▼
 /api/cho/*                   /api/ban-hang/*                  /api/admin/cho/*
 identityFromRequest          identityFromRequest              requireAdmin()
   (anonymous cho GET)        + requireShopOwner()
   │                             │                                 │
   └──────────────┬──────────────┴─────────────────────────────────┘
                  ▼
        getMarketStore(): MarketStore          ← src/lib/market/store.ts (singleton, globalThis)
             │                    │
   supabase-store.ts         file-store.ts      ← chỉ khi MARKET_STORE=file && !VERCEL && NODE_ENV!=='production'
   (service-role, RPC)       (.local/market-dev.json + .local/market-uploads/)
             │
   0060: shops(+paused) · shop_products(+admin_hidden, deleted_at) · market_orders(+needs_refund, bank_snapshot) · product_reviews(+hidden)
         RPC market_place_order / market_restock_order / market_add_review / market_recount_rating / market_set_review_hidden · bucket market-media

 Luật thuần (không adapter, có test): order-state (canTransitionOrder · applyTransition · applyPaymentTransition · settleOverdue) · pricing · validate (TRẦN) · order-ref (marketOrderClientRef) · order-code · text · categories
 Route-utils (server-only): marketErrorResponse · toShopPublic · settleOverdueOrders ⏱ · readImageUpload
 Máy khách (localStorage, ngăn theo SĐT): mcart.v1 (+quote) · maddr.v1 · mfav.v1 (+snapshot) · morders.v1 · mshop.v1
```

Dev identity (chỉ file mode): `POST /api/dev/login {phone}` → chuỗi đúng khuôn `sdf_…` → client cất bằng `saveToken()` → mọi UI sẵn có coi là đã đăng nhập; `identityFromRequest`/`requireStaff` tra chuỗi ở `file-store.sessions` thay vì `device_tokens` (§6).

---

## 2. Schema — `supabase/migrations/0060_marketplace.sql` (nguyên văn, bản 1.1)

Không có hàm trigger `updated_at` dùng chung trong `supabase/migrations/` (đã grep 2026-09-06: 13 file có cột `updated_at`, 0 file có `create trigger`) ⇒ migration này tạo `market_set_updated_at()` và gắn cho 4 bảng. Tìm kiếm: cột `search_text` do **ứng dụng** ghi (`foldVn(title + " " + description)` — §4.7, không dấu, chữ thường) để **cả hai adapter** tìm cùng một cách bằng `ilike`; index trigram là tăng tốc tuỳ chọn (Supabase có sẵn `pg_trgm`, chỉ cần bật; nếu môi trường từ chối `create extension` thì bỏ 2 dòng đó, `ilike` vẫn chạy).

**Cột thêm ở bản 1.1 (LEAD-BRIEF §4)**: `shops.paused` (#8) · `shops.approved_at` · `shop_products.admin_hidden/admin_hidden_reason` (11 §3.2, admin gỡ ≠ seller ẩn) · `shop_products.deleted_at` (#12 xoá mềm) · `market_orders.needs_refund` (#7) · `market_orders.bank_snapshot` (11 R11) · `product_reviews.hidden` (#15). Danh mục dùng **id gạch-ngang** đúng #14. `sold_count` cộng lúc ĐẶT (trong RPC trừ kho) và trừ lại khi hoàn kho — không ghi sản phẩm ở bước hoàn thành, vì `settleOverdue` (#3) chạy lúc ĐỌC.

```sql
-- SDFish — CHỢ VẬT TƯ TÀU CÁ: sàn ĐA NGƯỜI BÁN (2026-09-06, ADR 0013 · bản 1.1
-- hợp nhất sau phản biện, LEAD-BRIEF §4/§5).
--
-- Bốn bảng MỚI, KHÔNG đụng product_listings (0016/0045) và catalog_orders
-- (0046/0047) — luồng NCC nội bộ cũ giữ nguyên. Người mua = chủ tàu (SĐT từ
-- chuỗi cứng, 0037); người bán = hãng/đại lý, cũng SĐT SDFish (shops.owner_phone).
-- SDVICO chỉ là MỘT shop seed sẵn — không hardcode vào logic.
--
-- items của market_orders: SNAPSHOT dòng hàng jsonb
--   [{productId, variantLabel, title, unit, priceVnd, qty, lineTotalVnd, image}]
-- — giá đóng băng lúc đặt. subtotal/shipping/total: SERVER tính (lib/market/pricing).
-- bank_snapshot: STK shop LÚC ĐẶT (chỉ khi chuyen_khoan) — shop đổi/xoá STK sau
-- đó không đổi đơn (11 R3/R11).
-- Tồn kho trừ NGUYÊN TỬ trong market_place_order (một giao dịch/một shop): một
-- dòng hết hàng hoặc lệch giá là hoàn cả đơn của shop đó, không có đơn nửa vời.
-- sold_count CỘNG lúc đặt (cùng câu UPDATE trừ kho), TRỪ LẠI khi hoàn kho.
--
-- Auth: RLS bật, KHÔNG policy, revoke anon/authenticated (khuôn 0037). Mọi
-- đọc/ghi qua route service-role: /api/cho/* (identityFromRequest), /api/ban-hang/*
-- (+ requireShopOwner), /api/admin/cho/* (requireAdmin). Client KHÔNG chạm bảng.
-- KHÔNG thanh toán trong app: COD + chuyển khoản tay (payment_status 3 nấc).
-- Online-only (SW không cache /api/cho|ban-hang|admin/cho).
--
-- Xem docs/app-map/12-kien-truc-san-thuong-mai.md §2 (thiết kế) + 04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

-- ── 0. Tiện ích dùng chung của sàn ──────────────────────────────────────────
create or replace function public.market_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Trigram cho tìm kiếm ilike '%q%' (tuỳ chọn — bỏ 2 dòng này nếu môi trường
-- không cho bật extension; ilike vẫn chạy đúng, chỉ chậm hơn khi bảng lớn).
create extension if not exists pg_trgm with schema extensions;

-- ── 1. shops — gian hàng ────────────────────────────────────────────────────
create table if not exists public.shops (
  id                 uuid primary key default gen_random_uuid(),
  owner_phone        text not null unique,          -- SĐT chủ shop (chuỗi cứng) — 1 SĐT = 1 shop. Seed SDVICO = sentinel 'sdvico:chua-gan'
  name               text not null check (char_length(name) between 3 and 60),
  slug               text not null unique,          -- lib/market/text.ts toSlug(name); TRÙNG = từ chối (tên shop duy nhất không phân biệt hoa/thường/dấu)
  description        text check (description is null or char_length(description) <= 1000),
  logo_url           text,
  phone              text,                          -- SĐT liên hệ hiện cho người mua (mặc định = owner_phone)
  province           text,
  address            text check (address is null or char_length(address) <= 200),
  bank_name          text,                          -- cho chuyển khoản tay — đủ 3 cột = "nhận chuyển khoản"
  bank_account       text,
  bank_holder        text,
  shipping_flat_vnd  integer not null default 0 check (shipping_flat_vnd between 0 and 5000000),
  free_ship_from_vnd integer check (free_ship_from_vnd is null or free_ship_from_vnd >= 0),
  status             text not null default 'cho_duyet'
                       check (status in ('cho_duyet', 'hoat_dong', 'tam_khoa', 'tu_choi')),
  status_note        text check (status_note is null or char_length(status_note) <= 300),  -- lý do từ chối / tạm khoá (admin ghi, chủ shop đọc)
  paused             boolean not null default false, -- seller tự "tạm nghỉ bán" (LEAD §4 #8): món vẫn hiện, KHÔNG đặt được
  rating_avg         numeric(3,2) not null default 0,
  rating_count       integer not null default 0,
  approved_at        timestamptz,                   -- lần đầu được duyệt
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on column public.shops.paused is
  'Chủ shop tự bật "tạm nghỉ bán". Khác tam_khoa (admin): món vẫn hiện trên chợ nhưng market_place_order từ chối (shop_paused).';
comment on column public.shops.status_note is
  'Lý do khi tu_choi/tam_khoa — bắt buộc (route kiểm), chủ shop đọc ở /ban-hang.';
create index if not exists shops_status_idx on public.shops (status, created_at desc);
drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at before update on public.shops
  for each row execute function public.market_set_updated_at();

-- ── 2. shop_products — sản phẩm của shop ───────────────────────────────────
create table if not exists public.shop_products (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references public.shops (id) on delete cascade,
  title               text not null check (char_length(title) between 3 and 120),
  description         text check (description is null or char_length(description) <= 2000),
  category            text not null check (category in (
                        'may-dong-co', 'dien-tu-hang-hai', 'ngu-cu', 'dau-nhot-nhien-lieu',
                        'da-bao-quan', 'nhu-yeu-pham', 'an-toan', 'phu-tung', 'khac')),  -- LEAD §4 #14, id gạch-ngang
  price_vnd           integer not null check (price_vnd between 1000 and 1000000000),  -- 0061 (ADR 0014) BỎ not null: null = "Liên hệ báo giá"
  compare_at_vnd      integer check (compare_at_vnd is null or compare_at_vnd > price_vnd),  -- "giá gạch"
  unit                text not null check (char_length(unit) between 1 and 20),  -- cái / kg / lít / thùng / cây…
  stock               integer not null default 0 check (stock between 0 and 99999),
  images              jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),   -- string[] URL, ≤ 6
  variants            jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'), -- [{label, priceVnd|null}] — kho CHUNG theo sản phẩm (LEAD §5 #5, nợ §12)
  status              text not null default 'dang_ban'
                        check (status in ('dang_ban', 'an', 'het_hang')),
  admin_hidden        boolean not null default false,  -- admin gỡ vì vi phạm — seller KHÔNG tự bật lại được (khác `an`)
  admin_hidden_reason text check (admin_hidden_reason is null or char_length(admin_hidden_reason) <= 300),
  deleted_at          timestamptz,                    -- xoá mềm (LEAD §4 #12) — giữ ảnh, đơn cũ vẫn có snapshot
  sold_count          integer not null default 0,
  rating_avg          numeric(3,2) not null default 0,
  rating_count        integer not null default 0,
  search_text         text not null default '',        -- ứng dụng ghi: foldVn(title + ' ' + description)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on column public.shop_products.admin_hidden is
  'SDVICO gỡ món vi phạm. Không hiện với người mua, seller thấy băng đỏ + lý do, không tự bật lại được. Khác status=an (seller tự ẩn).';
comment on column public.shop_products.deleted_at is
  'Xoá mềm. NULL = còn. Đã xoá thì không hiện với ai, không đặt được; ảnh giữ nguyên (dọn mồ côi = nợ).';
comment on column public.shop_products.variants is
  '[{label, priceVnd|null}] — biến thể chỉ mang nhãn + giá riêng; tồn kho theo sản phẩm (nợ: kho theo biến thể).';
-- Mọi truy vấn của người mua đều lọc `deleted_at is null and admin_hidden = false` ⇒ index một phần.
create index if not exists shop_products_shop_status_idx
  on public.shop_products (shop_id, status, created_at desc) where deleted_at is null;
create index if not exists shop_products_category_status_idx
  on public.shop_products (category, status, created_at desc) where deleted_at is null and admin_hidden = false;
create index if not exists shop_products_sold_idx
  on public.shop_products (status, sold_count desc) where deleted_at is null and admin_hidden = false;
-- Tuỳ chọn (cần pg_trgm ở trên):
create index if not exists shop_products_search_trgm_idx
  on public.shop_products using gin (search_text extensions.gin_trgm_ops);
drop trigger if exists shop_products_set_updated_at on public.shop_products;
create trigger shop_products_set_updated_at before update on public.shop_products
  for each row execute function public.market_set_updated_at();

-- ── 3. market_orders — đơn (MỖI ĐƠN = MỘT SHOP) ────────────────────────────
create table if not exists public.market_orders (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,             -- SD + yymmdd + 4 ký tự (lib/market/order-code.ts)
  buyer_phone     text not null,                    -- từ chuỗi cứng, đã chuẩn hoá — KHÔNG BAO GIỜ từ body
  shop_id         uuid not null references public.shops (id),
  items           jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),  -- snapshot dòng hàng (xem đầu file), ≤ 20 dòng
  subtotal_vnd    integer not null default 0 check (subtotal_vnd >= 0),
  shipping_vnd    integer not null default 0 check (shipping_vnd >= 0),
  total_vnd       integer not null default 0 check (total_vnd >= 0),
  payment_method  text not null check (payment_method in ('cod', 'chuyen_khoan')),
  payment_status  text not null default 'chua_thanh_toan'
                    check (payment_status in ('chua_thanh_toan', 'bao_da_chuyen', 'da_thanh_toan')),
  bank_snapshot   jsonb,                            -- {bankName, bankAccount, bankHolder} lúc đặt — chỉ khi chuyen_khoan
  needs_refund    boolean not null default false,   -- LEAD §4 #7: huỷ đơn CK đã bao_da_chuyen/da_thanh_toan ⇒ true; app chỉ NHẮC, không xử lý tiền
  status          text not null default 'cho_xac_nhan'
                    check (status in ('cho_xac_nhan', 'da_xac_nhan', 'dang_giao', 'da_giao', 'hoan_thanh', 'da_huy')),
  cancel_by       text check (cancel_by is null or cancel_by in ('buyer', 'seller', 'admin', 'system')),
  cancel_reason   text check (cancel_reason is null or char_length(cancel_reason) <= 200),
  address         jsonb not null,                   -- {name, phone, province, detail, isPort} snapshot
  buyer_note      text check (buyer_note is null or char_length(buyer_note) <= 300),
  seller_note     text check (seller_note is null or char_length(seller_note) <= 300),
  carrier         text check (carrier is null or char_length(carrier) <= 40),      -- "tự giao" / "xe Phương Trang" / "gửi ra cảng"…
  tracking_code   text check (tracking_code is null or char_length(tracking_code) <= 40),
  timeline        jsonb not null default '[]'::jsonb check (jsonb_typeof(timeline) = 'array'),
                    -- [{status, at, by, note}] — status ∈ trạng thái đơn HOẶC trạng thái thanh toán;
                    -- by ∈ buyer | seller | system | admin:<sđt> (admin xử lý thay shop, LEAD §4 #2)
  client_ref      text,                             -- vân tay nội dung (lib/market/order-ref.ts marketOrderClientRef)
  restocked_at    timestamptz,                      -- đã hoàn kho sau huỷ (idempotent)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  delivered_at    timestamptz,
  completed_at    timestamptz,
  check ((payment_method = 'cod') or (bank_snapshot is not null))
);
comment on column public.market_orders.needs_refund is
  'true khi đơn chuyển khoản bị huỷ sau khi người mua đã báo chuyển / shop đã nhận tiền. Hiện cả hai bên "Shop cần hoàn tiền". App không chuyển tiền.';
comment on column public.market_orders.bank_snapshot is
  'STK shop lúc đặt (chuyen_khoan). Shop đổi/xoá STK sau đó không đổi đơn.';
comment on column public.market_orders.timeline is
  '[{status, at, by, note}] — mỗi cú chuyển trạng thái đơn HOẶC thanh toán một mục; by = buyer|seller|system|admin:<sđt>.';
create unique index if not exists market_orders_client_ref_uniq
  on public.market_orders (buyer_phone, client_ref) where client_ref is not null;
create index if not exists market_orders_buyer_idx
  on public.market_orders (buyer_phone, created_at desc);
create index if not exists market_orders_shop_status_idx
  on public.market_orders (shop_id, status, created_at desc);
create index if not exists market_orders_status_idx
  on public.market_orders (status, created_at desc);          -- admin lọc toàn sàn + settleOverdue quét da_giao
drop trigger if exists market_orders_set_updated_at on public.market_orders;
create trigger market_orders_set_updated_at before update on public.market_orders
  for each row execute function public.market_set_updated_at();

-- ── 4. product_reviews — đánh giá sau khi đơn hoàn thành ───────────────────
create table if not exists public.product_reviews (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.market_orders (id) on delete cascade,
  product_id   uuid not null references public.shop_products (id) on delete cascade,
  shop_id      uuid not null references public.shops (id) on delete cascade,
  buyer_phone  text not null,
  rating       smallint not null check (rating between 1 and 5),
  comment      text check (comment is null or char_length(comment) <= 500),
  hidden       boolean not null default false,       -- admin ẩn (LEAD §4 #15) — không hiện, không tính điểm
  created_at   timestamptz not null default now(),
  unique (order_id, product_id)                     -- mỗi món trong một đơn đánh giá một lần
);
comment on column public.product_reviews.hidden is
  'Admin ẩn đánh giá vi phạm. rating_avg/rating_count của sản phẩm + shop tính lại từ đánh giá KHÔNG ẩn (market_set_review_hidden).';
create index if not exists product_reviews_product_idx
  on public.product_reviews (product_id, created_at desc) where hidden = false;

-- ── 5. RLS: KHOÁ KÍN, KHÔNG POLICY (khuôn 0037) ────────────────────────────
alter table public.shops           enable row level security;
alter table public.shop_products   enable row level security;
alter table public.market_orders   enable row level security;
alter table public.product_reviews enable row level security;
revoke all on public.shops, public.shop_products, public.market_orders, public.product_reviews
  from anon, authenticated;

-- ── 6. ĐẶT ĐƠN NGUYÊN TỬ — một giao dịch cho MỘT shop ─────────────────────
-- Vào: dòng hàng ĐÃ DỰNG ở TS (buildMarketLines: giá từ DB, không tin client),
-- tổng ĐÃ TÍNH ở TS (computeTotals) và ĐÃ đối chiếu expectedTotalVnd của client
-- (lệch ⇒ route trả price_changed, KHÔNG gọi hàm này). Hàm này KHÔNG tính lại —
-- nó chỉ bảo đảm ba việc mà TS không làm được nguyên tử: (a) giá snapshot còn
-- ĐÚNG với DB lúc ghi, (b) còn hàng và trừ kho, (c) ghi đơn — tất cả hoặc không.
-- Lỗi nghiệp vụ ném errcode P0001 với message là MÃ (adapter map sang MarketError):
--   shop_not_active · shop_paused · line_unavailable:<productId>
-- Lỗi DB 23505: constraint market_orders_code_key → adapter sinh mã mới, thử lại (≤3);
--   constraint market_orders_client_ref_uniq → đơn của chính lần bấm này đã có
--   (hai request sát nhau cùng qua bước 0) — transaction này ĐÃ rollback cả phần
--   trừ kho, adapter đọc lại theo (buyer_phone, client_ref) và trả duplicate:true.
create or replace function public.market_place_order(
  p_buyer_phone    text,
  p_shop_id        uuid,
  p_code           text,
  p_client_ref     text,
  p_items          jsonb,
  p_subtotal_vnd   integer,
  p_shipping_vnd   integer,
  p_total_vnd      integer,
  p_payment_method text,
  p_bank_snapshot  jsonb,
  p_address        jsonb,
  p_buyer_note     text
) returns public.market_orders
language plpgsql security definer set search_path = public as $$
declare
  it    jsonb;
  n     integer;
  v_qty integer;
  s     public.shops;
  o     public.market_orders;
begin
  -- 0. Chống trùng: cùng (buyer, client_ref) ⇒ trả đơn cũ, KHÔNG trừ kho lần hai.
  if p_client_ref is not null then
    select * into o from public.market_orders
     where buyer_phone = p_buyer_phone and client_ref = p_client_ref;
    if found then return o; end if;
  end if;

  -- 1. Shop phải đang hoạt động VÀ không tạm nghỉ (hai mã lỗi khác nhau — UI nói khác nhau).
  select * into s from public.shops where id = p_shop_id;
  if not found or s.status <> 'hoat_dong' then
    raise exception 'shop_not_active' using errcode = 'P0001';
  end if;
  if s.paused then
    raise exception 'shop_paused' using errcode = 'P0001';
  end if;
  if p_payment_method = 'chuyen_khoan' and (s.bank_account is null or p_bank_snapshot is null) then
    raise exception 'shop_not_active' using errcode = 'P0001';  -- shop vừa xoá STK giữa chừng: route đã ép COD, đây chỉ là lưới
  end if;

  -- 2. Từng dòng: đúng shop, đang bán, chưa xoá, không bị gỡ, giá khớp (gốc HOẶC biến thể), còn đủ hàng.
  --    sold_count cộng NGAY ở đây (một câu UPDATE); hoàn kho trừ lại (market_restock_order).
  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 999 then
      raise exception 'line_unavailable:%', it->>'productId' using errcode = 'P0001';
    end if;
    update public.shop_products
       set stock      = stock - v_qty,
           sold_count = sold_count + v_qty,
           status     = case when stock - v_qty = 0 then 'het_hang' else status end
     where id = (it->>'productId')::uuid
       and shop_id = p_shop_id
       and status = 'dang_ban'
       and deleted_at is null
       and admin_hidden = false
       and stock >= v_qty
       and (
         (it->>'variantLabel') is null and price_vnd = (it->>'priceVnd')::integer
         or exists (
           select 1 from jsonb_array_elements(variants) v
            where v->>'label' = it->>'variantLabel'
              and coalesce((v->>'priceVnd')::integer, price_vnd) = (it->>'priceVnd')::integer
         )
       );
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'line_unavailable:%', it->>'productId' using errcode = 'P0001';
    end if;
  end loop;

  -- 3. Ghi đơn.
  insert into public.market_orders (
    code, buyer_phone, shop_id, items, subtotal_vnd, shipping_vnd, total_vnd,
    payment_method, payment_status, bank_snapshot, status, address, buyer_note, client_ref, timeline
  ) values (
    p_code, p_buyer_phone, p_shop_id, p_items, p_subtotal_vnd, p_shipping_vnd, p_total_vnd,
    p_payment_method, 'chua_thanh_toan',
    case when p_payment_method = 'chuyen_khoan' then p_bank_snapshot else null end,
    'cho_xac_nhan', p_address, nullif(p_buyer_note, ''), p_client_ref,
    jsonb_build_array(jsonb_build_object('status', 'cho_xac_nhan', 'at', now(), 'by', 'buyer', 'note', null))
  ) returning * into o;
  return o;
end $$;
revoke all on function public.market_place_order(text, uuid, text, text, jsonb, integer, integer, integer, text, jsonb, jsonb, text)
  from public, anon, authenticated;

-- ── 7. HOÀN KHO SAU HUỶ — idempotent qua restocked_at ──────────────────────
-- Gọi SAU khi adapter đã đổi status sang da_huy. Trả số dòng đã hoàn (0 = đã
-- hoàn trước đó hoặc đơn không ở da_huy). Mọi đường tới da_huy đều đi từ trước
-- da_giao (TRANSITIONS) nên luôn hoàn. Hoàn KHÔNG kiểm trần (11 §4.2, có // nợ).
create or replace function public.market_restock_order(p_order_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  it      jsonb;
  v_items jsonb;   -- tên khác cột `items` để plpgsql không báo ambiguous
  v_qty   integer;
  n       integer := 0;
begin
  update public.market_orders
     set restocked_at = now()
   where id = p_order_id and status = 'da_huy' and restocked_at is null
   returning market_orders.items into v_items;
  if not found then return 0; end if;
  for it in select * from jsonb_array_elements(v_items) loop
    v_qty := (it->>'qty')::integer;
    update public.shop_products
       set stock      = stock + v_qty,
           sold_count = greatest(0, sold_count - v_qty),
           status     = case when status = 'het_hang' then 'dang_ban' else status end
     where id = (it->>'productId')::uuid;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.market_restock_order(uuid) from public, anon, authenticated;

-- ── 8. ĐÁNH GIÁ — ghi + cập nhật điểm sản phẩm/shop trong một giao dịch ────
-- Điều kiện nghiệp vụ (đơn của buyer, đã hoan_thanh, món có trong đơn) TS đã kiểm
-- (lib/market/order-state.ts canReview) để báo câu tiếng Việt; đây kiểm LẠI để
-- không lọt khi hai request chạy sát nhau. Lỗi: review_not_allowed (P0001),
-- 23505 product_reviews_order_id_product_id_key = đã đánh giá rồi.
create or replace function public.market_add_review(
  p_order_id    uuid,
  p_product_id  uuid,
  p_buyer_phone text,
  p_rating      smallint,
  p_comment     text
) returns public.product_reviews
language plpgsql security definer set search_path = public as $$
declare
  o public.market_orders;
  r public.product_reviews;
begin
  select * into o from public.market_orders
   where id = p_order_id and buyer_phone = p_buyer_phone and status = 'hoan_thanh';
  if not found then raise exception 'review_not_allowed' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from jsonb_array_elements(o.items) it where it->>'productId' = p_product_id::text
  ) then
    raise exception 'review_not_allowed' using errcode = 'P0001';
  end if;

  insert into public.product_reviews (order_id, product_id, shop_id, buyer_phone, rating, comment)
  values (p_order_id, p_product_id, o.shop_id, p_buyer_phone, p_rating, nullif(p_comment, ''))
  returning * into r;

  perform public.market_recount_rating(p_product_id, o.shop_id);
  return r;
end $$;
revoke all on function public.market_add_review(uuid, uuid, text, smallint, text)
  from public, anon, authenticated;

-- ── 9. ẨN/HIỆN ĐÁNH GIÁ (admin) + tính lại điểm từ đánh giá KHÔNG ẩn ───────
create or replace function public.market_recount_rating(p_product_id uuid, p_shop_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.shop_products p
     set rating_avg   = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews
                                   where product_id = p_product_id and hidden = false), 0),
         rating_count = (select count(*) from public.product_reviews
                          where product_id = p_product_id and hidden = false)
   where p.id = p_product_id;
  update public.shops s
     set rating_avg   = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews
                                   where shop_id = p_shop_id and hidden = false), 0),
         rating_count = (select count(*) from public.product_reviews
                          where shop_id = p_shop_id and hidden = false)
   where s.id = p_shop_id;
end $$;
revoke all on function public.market_recount_rating(uuid, uuid) from public, anon, authenticated;

create or replace function public.market_set_review_hidden(p_review_id uuid, p_hidden boolean)
returns public.product_reviews
language plpgsql security definer set search_path = public as $$
declare
  r public.product_reviews;
begin
  update public.product_reviews set hidden = p_hidden where id = p_review_id returning * into r;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform public.market_recount_rating(r.product_id, r.shop_id);
  return r;
end $$;
revoke all on function public.market_set_review_hidden(uuid, boolean) from public, anon, authenticated;

-- ── 10. Bucket ảnh sản phẩm — ĐỌC CÔNG KHAI, ghi chỉ service-role ──────────
-- Ảnh sản phẩm là nội dung sàn (ai xem cũng như nhau) ⇒ public=true, URL trực
-- tiếp /storage/v1/object/public/market-media/<shopId>/<uuid>.jpg — không cần
-- signed URL, không cần policy đọc. KHÔNG tạo policy ghi cho anon/authenticated.
-- file_size_limit 512000 = 500 KB (client nén ≤ 400 KB, §8 ImagePicker).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('market-media', 'market-media', true, 512000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ── 11. Seed shop SDVICO (chủ sàn) — LEAD §5 A2 ────────────────────────────
-- owner_phone là SENTINEL không phải SĐT thật: không hardcode số của ai vào
-- migration (repo public, và số có thể đổi). Admin gán chủ shop thật sau khi apply
-- qua /quan-tri tab Chợ vật tư → "Gán chủ shop" (PATCH /api/admin/cho/shops/[id]
-- {ownerPhone}). Trước khi gán, shop vẫn hiện và bán được (đơn về tab admin —
-- admin xử lý thay mọi shop, by = admin:<sđt>); chỉ /ban-hang của SDVICO chưa ai
-- vào được — đúng ý: chưa gán thì chưa ai là chủ. Ở file-store (dev) seed KHÁC:
-- persona SDVICO 0902000001 là chủ shop hoạt động sẵn (§5.3).
insert into public.shops (owner_phone, name, slug, description, phone, province, status, approved_at, shipping_flat_vnd, free_ship_from_vnd)
values ('sdvico:chua-gan', 'SDVICO', 'sdvico',
        'Thiết bị hàng hải, giám sát hành trình và vật tư tàu cá chính hãng.',
        null, 'Khánh Hòa', 'hoat_dong', now(), 0, null)
on conflict (slug) do nothing;
```

**Ghi chú cho agent Core**: (a) ghi `04-data-model.md` mục `0060` **cùng commit** (hook pre-commit chặn migration↔04 lệch) — bảng cột/nghĩa + trạng thái ⚠️ CHƯA APPLY; (b) cột `status` sản phẩm tự nhảy `het_hang` khi kho về 0 (trong RPC) và tự về `dang_ban` khi hoàn kho — helper thuần `normalizeProductStatus(status, stock)` (§4.3) làm y hệt ở TS cho `updateProduct` và file-store; (c) `search_text` KHÔNG phải generated column — adapter gọi `productSearchText(draft)` (§4.7) mỗi lần tạo/sửa; (d) `market_recount_rating` là nguồn DUY NHẤT tính điểm — file-store viết hàm TS cùng luật (chỉ đếm `hidden=false`); (e) người mua KHÔNG bao giờ thấy hàng có `deleted_at is not null` hoặc `admin_hidden` — mọi truy vấn buyer của adapter lọc hai cột này, không để route nhớ.

---

## 3. Hợp đồng kho — `src/lib/market/store.ts` + `types.ts` + `categories.ts`

### 3.1 `src/lib/market/types.ts` (nguyên văn — không `"use client"`, không `server-only`)

```ts
// KIỂU DOMAIN của Chợ vật tư — THUẦN, dùng chung client/route/adapter/test.
// Khớp migration 0060 (bản 1.1). Camel ở app, snake ở DB; đổi kiểu ⇒ đổi cả rowTo* trong adapter.

export type ShopStatus = "cho_duyet" | "hoat_dong" | "tam_khoa" | "tu_choi";
export type ProductStatus = "dang_ban" | "an" | "het_hang";
export type OrderStatus =
  | "cho_xac_nhan" | "da_xac_nhan" | "dang_giao" | "da_giao" | "hoan_thanh" | "da_huy";
export type PaymentMethod = "cod" | "chuyen_khoan";
export type PaymentStatus = "chua_thanh_toan" | "bao_da_chuyen" | "da_thanh_toan";
/** Ai thao tác — dùng cho máy trạng thái. */
export type Actor = "buyer" | "seller" | "admin" | "system";
/** Ai ghi vào timeline: actor thường, hoặc `admin:<sđt>` khi admin xử lý thay shop (LEAD §4 #2). */
export type TimelineBy = Actor | `admin:${string}`;
/** id gạch-ngang — LEAD §4 #14, khớp check constraint 0060. */
export type ProductCategory =
  | "may-dong-co" | "dien-tu-hang-hai" | "ngu-cu" | "dau-nhot-nhien-lieu"
  | "da-bao-quan" | "nhu-yeu-pham" | "an-toan" | "phu-tung" | "khac";

export interface BankInfo { bankName: string; bankAccount: string; bankHolder: string }

export interface Shop {
  id: string;
  ownerPhone: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  phone?: string;
  province?: string;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  shippingFlatVnd: number;
  freeShipFromVnd?: number;
  status: ShopStatus;
  statusNote?: string;
  /** seller tự "tạm nghỉ bán" — món vẫn hiện, không đặt được (LEAD §4 #8) */
  paused: boolean;
  ratingAvg: number;
  ratingCount: number;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Phần người mua được thấy về shop. KHÔNG có ownerPhone/STK/lý do khoá; có cờ "nhận chuyển khoản" để màn Đặt hàng ép COD (LEAD §4 #9). */
export type ShopPublic = Omit<Shop, "ownerPhone" | "bankName" | "bankAccount" | "bankHolder" | "statusNote">
  & { acceptsBankTransfer: boolean };

export interface Variant {
  label: string;
  /** null/undefined = giá gốc của sản phẩm. Kho CHUNG theo sản phẩm (LEAD §5 #5). */
  priceVnd?: number;
}

export interface Product {
  id: string;
  shopId: string;
  title: string;
  description?: string;
  category: ProductCategory;
  priceVnd: number | null;   // null = LIÊN HỆ BÁO GIÁ (ADR 0014) — không vào giỏ, không lên đơn
  compareAtVnd?: number;
  unit: string;
  stock: number;
  images: string[];
  variants: Variant[];
  status: ProductStatus;
  /** admin gỡ — seller không tự bật lại (11 §3.2) */
  adminHidden: boolean;
  adminHiddenReason?: string;
  /** xoá mềm (LEAD §4 #12) — adapter không bao giờ trả món đã xoá cho buyer */
  deletedAt?: string;
  soldCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Sản phẩm kèm tên/tỉnh/slug/paused của shop cho thẻ ở danh sách (một lượt đọc, không N+1). */
export interface ProductCard extends Product {
  shopName: string;
  shopSlug: string;
  shopProvince?: string;
  shopPaused: boolean;
}

/** Địa chỉ nhận — snapshot vào đơn. isPort=true: detail = tên cảng/cầu cảng (2–80 chữ); false: địa chỉ 5–200 chữ. */
export interface Address {
  name: string;
  phone: string;
  province: string;
  detail: string;
  isPort: boolean;
}

/** Một dòng hàng ĐÃ ĐÓNG BĂNG trong đơn. */
export interface OrderLine {
  productId: string;
  variantLabel?: string;
  title: string;
  unit: string;
  priceVnd: number;
  qty: number;
  lineTotalVnd: number;
  image?: string;
}

/** Một mục timeline — chuyển trạng thái ĐƠN hoặc THANH TOÁN (hai tập giá trị không trùng nhau). */
export interface TimelineEntry {
  status: OrderStatus | PaymentStatus;
  at: string;
  by: TimelineBy;
  note?: string;
}

export interface Order {
  id: string;
  code: string;
  buyerPhone: string;
  shopId: string;
  /** đính kèm khi đọc (join shops) — tên/SĐT/slug HIỆN TẠI của shop, để màn đơn có nút Gọi shop */
  shopName?: string;
  shopPhone?: string;
  shopSlug?: string;
  items: OrderLine[];
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** STK shop LÚC ĐẶT (chỉ chuyen_khoan) — nội dung CK = code */
  bankSnapshot?: BankInfo;
  needsRefund: boolean;
  status: OrderStatus;
  cancelBy?: Actor;
  cancelReason?: string;
  address: Address;
  buyerNote?: string;
  sellerNote?: string;
  carrier?: string;
  trackingCode?: string;
  timeline: TimelineEntry[];
  clientRef?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  completedAt?: string;
}

export interface Review {
  id: string;
  orderId: string;
  productId: string;
  shopId: string;
  /** che 4 số giữa khi trả ra ngoài — adapter làm, không phải UI */
  buyerPhoneMasked: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  /** admin ẩn (LEAD §4 #15) — buyer không thấy; admin thấy kèm cờ */
  hidden: boolean;
  createdAt: string;
}

// ── Draft (phần client gửi) ───────────────────────────────────────────────
export interface ShopDraft {
  name: string;
  description?: string;
  logoUrl?: string;
  phone?: string;
  province: string;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  shippingFlatVnd: number;
  freeShipFromVnd?: number;
}
/** Vá shop — chỉ chủ shop; `paused` tách khỏi draft đăng ký. */
export type ShopPatch = Partial<ShopDraft> & { paused?: boolean };

export interface ProductDraftM {
  title: string;
  description?: string;
  category: ProductCategory;
  priceVnd: number | null;   // null = LIÊN HỆ BÁO GIÁ (ADR 0014) — không vào giỏ, không lên đơn
  compareAtVnd?: number;
  unit: string;
  stock: number;
  images: string[];
  variants: Variant[];
  status: ProductStatus;
}

/** Dòng giỏ — chỉ id + biến thể + số lượng; giá tra lúc hiện/đặt. */
export interface MarketCartLine {
  productId: string;
  variantLabel?: string;
  qty: number;
}

/** Kết quả tra giỏ (`POST /api/cho/gio/tinh`) — cũng là bản lưu trong `forfish.mcart.v1.quote` để mất sóng còn hiện "giá lúc HH:MM". */
export interface CartQuoteGroup {
  shop: ShopPublic;
  lines: OrderLine[];
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
}
export interface CartQuote {
  at: string;
  groups: CartQuoteGroup[];
  dropped: import("./pricing").DroppedLine[];
  summary: { subtotalVnd: number; shippingVnd: number; totalVnd: number; shopCount: number };
}

/** Phần đặt hàng cho MỘT shop (một lần đặt = N draft, mỗi draft một đơn). */
export interface ShopCheckoutDraft {
  shopId: string;
  items: MarketCartLine[];
  /** vân tay nội dung — lib/market/order-ref.ts marketOrderClientRef */
  clientRef: string;
  /** tổng client vừa thấy — server tính lại, lệch ⇒ price_changed (11 R5) */
  expectedTotalVnd: number;
  /** ghi chú RIÊNG cho shop này (11 §5.6, 2026-09-06); thiếu ⇒ dùng buyerNote chung */
  buyerNote?: string;
}

export interface CheckoutDraft {
  shops: ShopCheckoutDraft[];
  address: Address;
  /** MỘT cách trả tiền cho cả lần đặt (LEAD §4 #9) */
  paymentMethod: PaymentMethod;
  /** ghi chú CHUNG — chỉ dùng cho shop nào không có shops[].buyerNote */
  buyerNote?: string;
}

// ── Kết quả ───────────────────────────────────────────────────────────────
export type PlaceOrderFailCode =
  | "shop_not_active" | "shop_paused" | "line_unavailable" | "price_changed" | "insert_failed";
export type PlaceOrderResult =
  | { shopId: string; ok: true; order: Order; duplicate: boolean }
  | {
      shopId: string; ok: false; code: PlaceOrderFailCode;
      /** line_unavailable: đúng id thiếu, kèm số còn lại nếu biết */
      productIds: string[]; available?: Record<string, number>;
      /** price_changed: tổng mới để client hiện "tổng mới …đ, bấm Đặt hàng lần nữa" */
      quote?: { subtotalVnd: number; shippingVnd: number; totalVnd: number };
    };

export interface ProductQuery {
  q?: string;
  category?: ProductCategory;
  /** LỌC theo tỉnh của shop (chip "Gần tôi" / khối "Gần bà con" ở /cho — LEAD §4 #11) */
  province?: string;
  shopId?: string;
  /** moi (mặc định) · ban_chay · gia_tang · gia_giam */
  sort?: "moi" | "ban_chay" | "gia_tang" | "gia_giam";
  page?: number;      // từ 1
  pageSize?: number;  // mặc định 20, trần 50
  /** false (buyer): status ∈ dang_ban|het_hang, KHÔNG adminHidden, KHÔNG deleted, shop hoat_dong.
   *  true (seller/admin): mọi status + adminHidden, vẫn KHÔNG deleted. */
  includeHidden?: boolean;
  /** CHỈ `listShopProducts` (seller/admin) đọc — `listProducts` (chợ) BỎ QUA.
   *  dang_ban|an|het_hang = đúng status VÀ không bị gỡ · bi_go = bị admin gỡ (mọi status)
   *  · all / bỏ trống = không lọc. Route `?status` (§7.2) truyền THẲNG xuống kho. */
  status?: ProductStatusFilter;   // = ProductStatus | "bi_go" | "all"
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type StatsRange = "today" | "7d" | "30d";
export interface ShopStats {
  range: StatsRange;
  orders: number;             // đơn TẠO trong kỳ
  completed: number;          // đơn hoan_thanh có completedAt trong kỳ
  revenueVnd: number;         // tổng total_vnd (hàng + ship) của đơn hoan_thanh theo completedAt trong kỳ — 11 §6.3
  /** ba ô "cần làm ngay" — hiện tại, không theo kỳ */
  pendingOrders: number;      // cho_xac_nhan
  shippingOrders: number;     // dang_giao
  awaitingPaymentConfirm: number;  // paymentStatus = bao_da_chuyen, đơn chưa kết thúc
  topProducts: { productId: string; title: string; qty: number }[];  // ≤ 5, theo qty trong đơn hoan_thanh của kỳ
  lowStock: { productId: string; title: string; stock: number }[];   // stock ≤ 3, ≤ 10 dòng
  byStatus: Record<OrderStatus, number>;
}

/** KPI sàn cho tab admin (11 §7). */
export interface AdminOverview {
  shops: Record<ShopStatus, number>;
  productsOnSale: number;
  orders: Record<"today" | "d7" | "d30", Record<OrderStatus, number>>;
  gmvVnd: Record<"today" | "d7" | "d30", number>;     // đơn hoan_thanh theo completedAt
  cancelRate30d: number;                               // huỷ / (huỷ + hoàn thành), 0..1
}

/** Persona dev (chỉ file mode). */
export interface DevPersona {
  phone: string;
  name: string;
  role: "buyer" | "seller" | "admin";
  tier: "basic" | "premium";
}
```

### 3.2 `src/lib/market/categories.ts` (nguyên văn — id/nhãn/thứ tự ĐÚNG LEAD §4 #14)

```ts
// DANH MỤC VẬT TƯ — CỐ ĐỊNH TRONG CODE (chủ dự án chốt: không bảng). Khớp check
// constraint shop_products.category (0060). Icon là TÊN component trong
// components/icons.tsx — cấm emoji (03 §4).
import type { ProductCategory } from "./types";

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  "may-dong-co", "dien-tu-hang-hai", "ngu-cu", "dau-nhot-nhien-lieu",
  "da-bao-quan", "nhu-yeu-pham", "an-toan", "phu-tung", "khac",
] as const;

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  "may-dong-co": "Máy & động cơ",
  "dien-tu-hang-hai": "Điện tử hàng hải",
  "ngu-cu": "Ngư cụ",
  "dau-nhot-nhien-lieu": "Dầu nhớt & nhiên liệu",
  "da-bao-quan": "Đá & bảo quản",
  "nhu-yeu-pham": "Nhu yếu phẩm",
  "an-toan": "An toàn",
  "phu-tung": "Phụ tùng",
  "khac": "Khác",
};

/** Icon — tên trong components/icons.tsx. Đã có: FuelIcon, StarIcon, CartIcon. Thiếu thì Core thêm vào icons.tsx (Core own file này, LEAD §5 #2). */
export const CATEGORY_ICON: Record<ProductCategory, string> = {
  "may-dong-co": "EngineIcon", "dien-tu-hang-hai": "RadarIcon", "ngu-cu": "NetIcon",
  "dau-nhot-nhien-lieu": "FuelIcon", "da-bao-quan": "IceIcon", "nhu-yeu-pham": "BasketIcon",
  "an-toan": "LifebuoyIcon", "phu-tung": "GearIcon", "khac": "BoxIcon",
};

export function isProductCategory(v: unknown): v is ProductCategory {
  return typeof v === "string" && (PRODUCT_CATEGORIES as readonly string[]).includes(v);
}
export function categoryLabel(v: unknown): string {
  return isProductCategory(v) ? CATEGORY_LABEL[v] : CATEGORY_LABEL.khac;
}
```

### 3.3 `src/lib/market/errors.ts` (nguyên văn)

```ts
// LỖI CÓ MÃ của sàn — adapter ném, route map sang {ok:false, code} + status.
export type MarketErrorCode =
  | "unavailable"        // 503 — không tra được (env thiếu, DB nghẹt, file khoá)
  | "not_found"          // 404
  | "forbidden"          // 403 — không phải chủ shop / không phải chủ đơn
  | "shop_not_active"    // 403 — shop chưa duyệt / tạm khoá / bị từ chối
  | "shop_paused"        // 409 — shop tự tạm nghỉ (LEAD §4 #8) — chỉ chặn ĐẶT, không chặn xem
  | "no_shop"            // 404 — SĐT này chưa có shop
  | "invalid"            // 400 — validate thuần trả câu lỗi (kèm message VN)
  | "bad_type"           // 415 — ảnh không phải jpeg/png/webp (mime HOẶC magic bytes sai)
  | "bad_size"           // 413 — ảnh > 500 KB
  | "line_unavailable"   // 409 — hết hàng / ngừng bán / sai biến thể (kèm productIds)
  | "price_changed"      // 409 — giá đổi giữa lúc xem và lúc đặt
  | "bad_transition"     // 409 — trạng thái đã đổi bởi người khác
  | "review_not_allowed" // 409
  | "already_reviewed"   // 409
  | "slug_taken"         // 409 — tên shop đã có người dùng
  | "insert_failed";     // 500

export const MARKET_ERROR_STATUS: Record<MarketErrorCode, number> = {
  unavailable: 503, not_found: 404, forbidden: 403, shop_not_active: 403, shop_paused: 409, no_shop: 404,
  invalid: 400, bad_type: 415, bad_size: 413, line_unavailable: 409, price_changed: 409, bad_transition: 409,
  review_not_allowed: 409, already_reviewed: 409, slug_taken: 409, insert_failed: 500,
};

export class MarketError extends Error {
  constructor(
    public readonly code: MarketErrorCode,
    /** câu tiếng Việt cho người dùng (validate) — tuỳ chọn */
    message?: string,
    public readonly productIds: string[] = [],
  ) {
    super(message ?? code);
    this.name = "MarketError";
  }
  get status(): number { return MARKET_ERROR_STATUS[this.code]; }
}
export const isMarketError = (e: unknown): e is MarketError => e instanceof MarketError;
```

### 3.4 `src/lib/market/store.ts` — interface (nguyên văn) + `getMarketStore()`

```ts
import "server-only";
// HỢP ĐỒNG KHO của Chợ vật tư. Hai bản: supabase-store.ts (prod) · file-store.ts (dev).
// LUẬT: adapter KHÔNG chứa nghiệp vụ. Nó nhận dữ liệu đã validate/tính xong và
// ghi/đọc; ràng buộc nguyên tử (kho, trùng đơn) nằm ở RPC (supabase) hoặc trong
// hàng đợi ghi (file). Mọi lỗi ném MarketError (errors.ts) — route map sang JSON.
// Người mua KHÔNG BAO GIỜ thấy món deletedAt/adminHidden hay đánh giá hidden —
// adapter lọc, không để route nhớ.
import type {
  Actor, Address, AdminOverview, BankInfo, DevPersona, Order, OrderLine, OrderStatus, Page,
  PaymentMethod, PaymentStatus, PlaceOrderResult, Product, ProductCard, ProductDraftM, ProductQuery,
  Review, Shop, ShopDraft, ShopPatch, ShopStats, ShopStatus, StatsRange, TimelineEntry,
} from "./types";

/** Vá một đơn — adapter chỉ GHI đúng các trường có mặt; nội dung do applyTransition /
 *  applyPaymentTransition / settleOverdue (order-state.ts) tính. */
export interface OrderPatch {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  cancelBy?: Actor;
  cancelReason?: string;
  needsRefund?: boolean;
  sellerNote?: string;
  carrier?: string;
  trackingCode?: string;
  deliveredAt?: string;
  completedAt?: string;
  /** mục MỚI nối vào timeline (adapter append, không thay cả mảng) */
  timelineAppend?: TimelineEntry;
}

/** Đầu vào placeOrders — do route dựng từ pricing.ts. */
export interface PreparedShopOrder {
  shopId: string;
  clientRef: string;
  lines: OrderLine[];
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
  /** STK shop lúc đặt — route lấy từ Shop khi paymentMethod = chuyen_khoan */
  bankSnapshot?: BankInfo;
  /** ghi chú RIÊNG cho shop này — adapter ghi vào buyer_note của đơn; thiếu ⇒ common.buyerNote */
  buyerNote?: string;
}

export interface OrderListQuery { status?: OrderStatus; page?: number; pageSize?: number }

export interface MarketStore {
  // ── Sản phẩm (người mua) ─────────────────────────────────────────────
  listProducts(q: ProductQuery): Promise<Page<ProductCard>>;
  /** null khi không có / đã xoá. adminHidden vẫn trả (kèm cờ) — route buyer coi như 404, route seller/admin hiện băng đỏ. */
  getProduct(id: string): Promise<ProductCard | null>;
  /** nhiều id một lượt — cho giỏ + đặt hàng (không N+1). Trả cả 'an'/'het_hang'/adminHidden (KHÔNG trả deleted) để buildMarketLines tự loại + báo lý do. */
  getProductsByIds(ids: string[]): Promise<Product[]>;

  // ── Shop ─────────────────────────────────────────────────────────────
  getShop(id: string): Promise<Shop | null>;
  getShopBySlug(slug: string): Promise<Shop | null>;
  getShopByOwner(ownerPhone: string): Promise<Shop | null>;
  /** slug = toSlug(draft.name); trùng ⇒ MarketError('slug_taken'); owner trùng ⇒ 'invalid' "Số này đã có shop rồi…" */
  createShop(ownerPhone: string, draft: ShopDraft, slug: string): Promise<Shop>;
  /** đổi tên ⇒ caller truyền slug mới; trùng ⇒ 'slug_taken' */
  updateShop(id: string, patch: ShopPatch, slug?: string): Promise<Shop>;
  listShops(q: { status?: ShopStatus; page?: number; pageSize?: number }): Promise<Page<Shop>>;
  /** hoat_dong lần đầu ⇒ adapter đặt approvedAt */
  setShopStatus(id: string, status: ShopStatus, note: string | null): Promise<Shop>;
  /** admin gán chủ shop (seed SDVICO) — ownerPhone đã chuẩn hoá; đã là chủ shop khác ⇒ 'invalid' */
  setShopOwner(id: string, ownerPhone: string): Promise<Shop>;

  // ── Sản phẩm (người bán) ─────────────────────────────────────────────
  listShopProducts(shopId: string, q: Omit<ProductQuery, "shopId">): Promise<Page<Product>>;
  createProduct(shopId: string, draft: ProductDraftM, searchText: string): Promise<Product>;
  /** không đổi được adminHidden qua đây (seller) — adapter bỏ qua nếu có */
  updateProduct(shopId: string, id: string, patch: Partial<ProductDraftM>, searchText?: string): Promise<Product>;
  /** XOÁ MỀM: deletedAt = now (LEAD §4 #12). Ảnh giữ. Không phải của shop ⇒ 'not_found'. */
  deleteProduct(shopId: string, id: string): Promise<void>;
  /** admin gỡ / trả lại món (11 §7) — hidden=true bắt buộc reason */
  setProductAdminHidden(id: string, hidden: boolean, reason: string | null): Promise<Product>;

  // ── Đơn ──────────────────────────────────────────────────────────────
  /**
   * Đặt hàng: MỖI shop một đơn, NGUYÊN TỬ TRONG SHOP, độc lập GIỮA các shop
   * (shop A hết hàng không kéo shop B — LEAD §4 #5). Tham số lines/totals ĐÃ TÍNH
   * ở route bằng pricing.ts; adapter chỉ chạy RPC/ghi file + sinh mã (order-code.ts).
   * Thứ tự kết quả = thứ tự `prepared`.
   */
  placeOrders(buyerPhone: string, prepared: PreparedShopOrder[], common: {
    address: Address; paymentMethod: PaymentMethod;
    /** ghi chú chung — chỉ dùng khi prepared[].buyerNote trống */
    buyerNote?: string;
  }): Promise<PlaceOrderResult[]>;
  listBuyerOrders(buyerPhone: string, q?: OrderListQuery): Promise<Page<Order>>;
  listShopOrders(shopId: string, q?: OrderListQuery): Promise<Page<Order>>;
  /** admin: mọi đơn, lọc tuỳ chọn (11 §7: shop / trạng thái / SĐT người mua / mã đơn) */
  listAllOrders(q?: OrderListQuery & { shopId?: string; buyerPhone?: string; code?: string }): Promise<Page<Order>>;
  /** quét cho settleOverdue: đơn da_giao có deliveredAt ≤ mốc (≤ 200 đơn/lượt) */
  listOverdueDelivered(beforeIso: string, shopId?: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  getOrderByClientRef(buyerPhone: string, clientRef: string): Promise<Order | null>;
  /**
   * Ghi vá có ĐIỀU KIỆN: chỉ ghi khi đơn vẫn ở `expectStatus` (chống hai người
   * bấm sát nhau) — không khớp ⇒ MarketError('bad_transition'). Nếu patch.status
   * === 'da_huy' thì adapter gọi hoàn kho (RPC market_restock_order / file: cộng
   * lại stock) NGAY SAU khi ghi. Dùng cho cả chuyển thanh toán (patch.paymentStatus)
   * và ghi chú/vận chuyển (không đổi status — expectStatus vẫn phải khớp).
   */
  transitionOrder(id: string, expectStatus: OrderStatus, patch: OrderPatch): Promise<Order>;

  // ── Đánh giá ─────────────────────────────────────────────────────────
  addReview(input: { orderId: string; productId: string; buyerPhone: string; rating: 1 | 2 | 3 | 4 | 5; comment?: string }): Promise<Review>;
  /** mặc định KHÔNG trả hidden; includeHidden chỉ route admin dùng */
  listProductReviews(productId: string, q?: { page?: number; pageSize?: number; includeHidden?: boolean }): Promise<Page<Review>>;
  /** admin ẩn/hiện — tính lại ratingAvg/ratingCount sản phẩm + shop từ đánh giá KHÔNG ẩn (RPC market_set_review_hidden) */
  setReviewHidden(id: string, hidden: boolean): Promise<Review>;
  /** id món buyer đã đánh giá trong đơn — cho canReview */
  reviewedProductIds(orderId: string): Promise<string[]>;

  // ── Thống kê + ảnh ───────────────────────────────────────────────────
  stats(shopId: string, range: StatsRange): Promise<ShopStats>;
  overview(): Promise<AdminOverview>;
  /** bytes ĐÃ nén ở client (≤ 400 KB, server vẫn chặn ≤ 500 KB) → URL công khai */
  saveUpload(shopId: string, bytes: Uint8Array, mime: "image/jpeg" | "image/png" | "image/webp"): Promise<{ url: string }>;

  // ── Dev (CHỈ file-store; supabase-store ném MarketError('forbidden')) ──
  devLogin(phone: string): Promise<{ token: string; persona: DevPersona }>;
  devIdentity(token: string): Promise<DevPersona | null>;
  devPersonas(): Promise<DevPersona[]>;
  devNotifications(phone: string): Promise<{ at: string; title: string; body: string; url?: string; pushOs: boolean }[]>;
}

// ── Singleton sống qua HMR ──────────────────────────────────────────────
import { isDevFileMode } from "./dev-mode";

type G = typeof globalThis & { __sdfishMarketStore?: MarketStore };

export async function getMarketStore(): Promise<MarketStore> {
  const g = globalThis as G;
  if (g.__sdfishMarketStore) return g.__sdfishMarketStore;
  // import() động: file-store kéo node:fs — không để nó nằm trong bundle của
  // mọi route khi chạy prod (chỉ supabase-store được nạp).
  const store: MarketStore = isDevFileMode()
    ? (await import("./file-store")).createFileStore()
    : (await import("./supabase-store")).createSupabaseStore();
  g.__sdfishMarketStore = store;
  return store;
}
```

### 3.5 `src/lib/market/dev-mode.ts` (nguyên văn — THUẦN, có test)

```ts
// CỔNG BA ĐIỀU KIỆN cho kho file (dev). Sai một điều kiện là KHÔNG bao giờ file
// mode, kể cả ai đó đặt MARKET_STORE=file trên Vercel. Thuần để test được.
export function isDevFileModeEnv(env: Record<string, string | undefined>): boolean {
  return env.MARKET_STORE === "file" && !env.VERCEL && env.NODE_ENV !== "production";
}
export function isDevFileMode(): boolean {
  return isDevFileModeEnv(process.env as Record<string, string | undefined>);
}
/** file-store gọi lúc khởi tạo: điều kiện sai ⇒ ném, không bao giờ im lặng chạy file ở prod. */
export function assertDevFileMode(): void {
  if (!isDevFileMode()) {
    throw new Error("[market] file-store chỉ chạy khi MARKET_STORE=file, không VERCEL, NODE_ENV!=production");
  }
}
```

### 3.6 Hợp đồng chung cho cả hai adapter (test `market-store-contract.test.ts` chạy trên file-store với thư mục tạm)

| Hành vi | Bắt buộc |
|---|---|
| `listProducts` mặc định (buyer) — 2026-09-07: món `price_vnd` null (Liên hệ báo giá) xếp CUỐI ở cả `gia_tang` lẫn `gia_giam` (`nullsFirst:false` / `cmpPrice`) | `status ∈ dang_ban|het_hang` (hết hàng vẫn hiện — 11 §5.2), `adminHidden=false`, `deletedAt=null`, shop `hoat_dong` (shop `paused` VẪN hiện, thẻ mang `shopPaused`); `q` so với `search_text` bằng `foldVn(q)` chứa; `province` = lọc `shops.province`; sort `moi` = created_at desc; `ban_chay` = sold_count desc; `gia_tang/gia_giam` theo `price_vnd`; `pageSize` trần 50 |
| `getProduct` | deleted ⇒ null; adminHidden ⇒ trả kèm cờ (route buyer 404) |
| `getProductsByIds` | trả cả `an`/`het_hang`/adminHidden, KHÔNG deleted; việc loại là của `buildMarketLines` (nó cần biết shop) ⇒ route đọc `getShop` cho từng shopId trong giỏ (≤ 5 shop/lần đặt) |
| `createShop` | `owner_phone` trùng ⇒ `invalid` ("Số này đã có shop rồi. Vào Kênh người bán để xem."); slug trùng ⇒ `slug_taken` ("Tên shop này đã có người dùng — chọn tên khác.") |
| `setShopStatus` | `hoat_dong` khi `approvedAt` null ⇒ đặt `approvedAt = now` |
| `deleteProduct` | đặt `deletedAt`; gọi lại lần 2 ⇒ `not_found`; món không hiện ở `listProducts`/`getProductsByIds` sau đó |
| `placeOrders` | thứ tự kết quả = thứ tự `prepared`; mỗi shop độc lập; `duplicate:true` khi client_ref đã có (KHÔNG trừ kho lần 2); `line_unavailable` kèm `productIds` (đúng id thiếu) + `available`; shop `paused` ⇒ `shop_paused`; shop ≠ `hoat_dong` ⇒ `shop_not_active`; mã đơn trùng ⇒ tự sinh lại tối đa 3 lần; `bankSnapshot` ghi vào đơn khi `chuyen_khoan`; `sold_count` cộng đúng qty |
| `transitionOrder` | ghi có điều kiện `expectStatus`; `da_huy` ⇒ hoàn kho + trừ `sold_count` đúng 1 lần (gọi lại không cộng đôi); `timelineAppend` nối cuối; `needsRefund` ghi được |
| `listOverdueDelivered` | chỉ `da_giao` có `deliveredAt ≤ beforeIso`; trần 200 |
| `addReview` | trùng (order, product) ⇒ `already_reviewed`; cập nhật `rating_avg/count` cho cả sản phẩm và shop (chỉ đếm hidden=false) |
| `setReviewHidden` | ẩn 1 trong 2 đánh giá 4★/2★ ⇒ avg = điểm còn lại, count = 1 (cả sản phẩm lẫn shop) |
| `listProductReviews` | mặc định không có hidden; `includeHidden:true` có kèm cờ |
| `saveUpload` | trả URL tuyệt đối/đường dẫn dùng thẳng trong `<img src>`; > 500 KB ⇒ `bad_size` |
| `dev*` | supabase-store: ném `forbidden` |
| Review trả ra ngoài | `buyerPhoneMasked` = `maskPhone(phone)` (§4.7): `0901***567` |

---

## 4. Logic THUẦN — `src/lib/market/*.ts` (file · export · chữ ký · luật · test)

Tất cả không `"use client"` trừ 5 file kho máy (§4.8–4.12). Test tại `src/lib/__tests__/market-<file>.test.ts`. Mọi TRẦN số (§4.3) là **một nguồn** — 11 §10 R8 chép đúng bảng đó.

### 4.1 `order-state.ts`

```ts
export const ORDER_STATUSES: readonly OrderStatus[];            // 6 nấc, thứ tự tiến trình
export const ORDER_STATUS_LABEL: Record<OrderStatus, string>;   // cho_xac_nhan "Chờ xác nhận" · da_xac_nhan "Đã xác nhận" · dang_giao "Đang giao" · da_giao "Đã giao" · hoan_thanh "Hoàn thành" · da_huy "Đã huỷ"
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string>; // "Chưa thanh toán" · "Đã báo chuyển — chờ shop xác nhận" · "Đã thanh toán"
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string>; // cod "Trả tiền khi nhận hàng" · chuyen_khoan "Chuyển khoản"
/** Chip theo 03 §"Đặt hàng": cặp token nền/chữ — KHÔNG hex. */
export const ORDER_STATUS_CHIP: Record<OrderStatus, { bg: string; fg: string }>;
//  cho_xac_nhan {bg:"var(--field)", fg:"var(--navy)"} · da_xac_nhan {warn-bg, warn} · dang_giao {sea, card}
//  da_giao {ok-bg, ok} · hoan_thanh {ok, card} · da_huy {danger-bg, danger}
export function isOrderStatus(v: unknown): v is OrderStatus;
export function isPaymentStatus(v: unknown): v is PaymentStatus;
export function isPaymentMethod(v: unknown): v is PaymentMethod;

/** Bảng chuyển hợp lệ theo ACTOR (một chiều, không quay lui) — 11 §4.1. Admin = mọi việc seller làm được + huỷ tới dang_giao (LEAD §4 #2). */
export const TRANSITIONS: Record<OrderStatus, Partial<Record<Actor, OrderStatus[]>>> = {
  cho_xac_nhan: { seller: ["da_xac_nhan", "da_huy"], admin: ["da_xac_nhan", "da_huy"], buyer: ["da_huy"] },
  da_xac_nhan:  { seller: ["dang_giao", "da_huy"],   admin: ["dang_giao", "da_huy"] },
  dang_giao:    { seller: ["da_giao"],               admin: ["da_giao", "da_huy"] },
  da_giao:      { buyer: ["hoan_thanh"],             admin: ["hoan_thanh"], system: ["hoan_thanh"] },
  hoan_thanh:   {},
  da_huy:       {},
};
export function canTransitionOrder(from: OrderStatus, to: OrderStatus, actor: Actor): boolean;
/** Huỷ cần lý do khi actor là seller/admin (buyer không bắt buộc). */
export function cancelNeedsReason(actor: Actor): boolean;

/** Chuyển thanh toán (11 §4.1 P1–P3):
 *  buyer:  chua_thanh_toan → bao_da_chuyen   (chỉ chuyen_khoan; status ∉ {da_huy, hoan_thanh})
 *  seller/admin: bao_da_chuyen → da_thanh_toan (P2 "Đã nhận tiền") · chua_thanh_toan → da_thanh_toan (nhận tiền không qua báo)
 *                bao_da_chuyen → chua_thanh_toan (P3 "Chưa thấy tiền", note BẮT BUỘC 5..200)
 *  COD: buyer KHÔNG bấm gì; da_thanh_toan tự đặt khi hoan_thanh. */
export function canTransitionPayment(o: Pick<Order, "paymentMethod" | "paymentStatus" | "status">, to: PaymentStatus, actor: Actor): boolean;

/** Nhãn `by` cho timeline: admin ⇒ `admin:<sđt>` (LEAD §4 #2), còn lại = actor. */
export function timelineBy(actor: Actor, actorPhone?: string): TimelineBy;

/**
 * Dựng OrderPatch cho một cú chuyển TRẠNG THÁI ĐƠN — NGUỒN DUY NHẤT của tác dụng phụ:
 *  · da_giao    ⇒ deliveredAt = nowIso
 *  · hoan_thanh ⇒ completedAt = nowIso; paymentMethod=cod ⇒ paymentStatus = da_thanh_toan
 *  · da_huy     ⇒ cancelBy = actor, cancelReason = note (bắt buộc khi cancelNeedsReason);
 *                 needsRefund = paymentMethod=chuyen_khoan ∧ paymentStatus ∈ {bao_da_chuyen, da_thanh_toan} (LEAD §4 #7 — KHÔNG phụ thuộc actor)
 *  · luôn timelineAppend {status:to, at:nowIso, by:timelineBy(actor, actorPhone), note}
 * KHÔNG đụng soldCount (cộng lúc đặt, trừ khi hoàn kho — §2). Trả null khi không được phép.
 */
export function applyTransition(o: Order, to: OrderStatus, actor: Actor, note: string | undefined, nowIso: string, actorPhone?: string): OrderPatch | null;

/** Như trên cho THANH TOÁN: patch {paymentStatus, timelineAppend{status:to,…}}; P3 thiếu note ⇒ null. */
export function applyPaymentTransition(o: Order, to: PaymentStatus, actor: Actor, note: string | undefined, nowIso: string, actorPhone?: string): OrderPatch | null;

/** Buyer được đánh giá món này? = đơn hoan_thanh + món có trong items + chưa có review (reviewedProductIds do route đưa). */
export function canReview(o: Order, productId: string, reviewedProductIds: string[]): boolean;

/**
 * TỰ HOÀN THÀNH LƯỜI — LEAD §4 #3 / §5 #6, KHÔNG cron.
 * Đơn da_giao có deliveredAt và (nowIso − deliveredAt) ≥ 7 × 24 giờ ⇒ patch = applyTransition(o, "hoan_thanh", "system",
 * "Tự hoàn thành sau 7 ngày", <deliveredAt + 7 ngày>) — completedAt/at lấy MỐC ĐẾN HẠN, không lấy giờ đọc, để doanh
 * thu rơi đúng ngày dù ai đọc lúc nào. Không đủ điều kiện ⇒ null. Chạy ở MỌI route đọc đơn/thống kê qua
 * `settleOverdueOrders` (route-utils.ts §7).
 */
export const AUTO_COMPLETE_MS = 7 * 24 * 3600 * 1000;
export function settleOverdue(o: Order, nowIso: string): OrderPatch | null;
/** Đơn cho_xac_nhan quá 48 giờ — chỉ để hiện nhắc (11 §4.3), không đổi trạng thái. */
export const PENDING_WARN_MS = 48 * 3600 * 1000;
export function isPendingTooLong(o: Pick<Order, "status" | "createdAt">, nowIso: string): boolean;
```

Test `market-order-state.test.ts`: (1) bảng chân trị TRANSITIONS — mọi cặp (from,to,actor) hợp lệ đúng như bảng, `hoan_thanh`/`da_huy` không đi đâu; buyer không huỷ được `da_xac_nhan`; seller không `da_huy` từ `dang_giao`; admin huỷ được `dang_giao`; (2) `applyTransition` đặt `deliveredAt`/`completedAt`/`paymentStatus` COD đúng, chuyển khoản không tự `da_thanh_toan`; huỷ bởi seller thiếu note ⇒ null; `needsRefund` true cho CK `bao_da_chuyen` + `da_thanh_toan` (cả 3 actor), false cho COD/`chua_thanh_toan`; `by` = `admin:0909000000` khi admin; (3) `canTransitionPayment` 8 ca gồm P3; `applyPaymentTransition` P3 thiếu note ⇒ null; (4) `canReview` 4 ca; (5) `settleOverdue`: 6d23h ⇒ null, đúng 7d ⇒ patch với `completedAt = deliveredAt + 7d`, `by:"system"`, COD ⇒ `da_thanh_toan`; đơn không phải da_giao ⇒ null; (6) `isPendingTooLong` biên 48h; (7) chip không chứa `#`.

### 4.2 `pricing.ts`

```ts
export type DropReason = "khong_ton_tai" | "ngung_ban" | "het_hang" | "thieu_hang" | "sai_bien_the" | "shop_dong" | "shop_nghi";
export interface DroppedLine { productId: string; variantLabel?: string; reason: DropReason; available?: number }
export const DROP_LABEL: Record<DropReason, string>;
//  "Món này không còn trên chợ" · "Shop đã ngừng bán món này" · "Hết hàng" · "Chỉ còn {n}" · "Loại/cỡ này không còn" · "Shop đang tạm đóng" · "Shop đang tạm nghỉ, mở lại sau"

/** Gom giỏ theo shop — giữ thứ tự xuất hiện; dòng không tìm thấy sản phẩm ⇒ dropped. */
export function groupCartByShop(lines: MarketCartLine[], products: Product[]): { byShop: Map<string, MarketCartLine[]>; dropped: DroppedLine[] };

/** Đơn giá thật của một dòng: biến thể có priceVnd thì lấy, không thì giá gốc; biến thể không tồn tại ⇒ null. */
export function unitPriceFor(p: Product, variantLabel?: string): number | null;

/** Dựng dòng hàng THẬT cho MỘT shop. Bỏ + báo lý do: sản phẩm không có / deletedAt / adminHidden / status≠dang_ban (ngung_ban) /
 *  stock=0 (het_hang) / stock<qty (thieu_hang + available) / biến thể sai / shop≠hoat_dong (shop_dong) / shop.paused (shop_nghi). */
export function buildMarketLines(items: MarketCartLine[], products: Product[], shop: Pick<Shop, "id" | "status" | "paused">): { lines: OrderLine[]; dropped: DroppedLine[] };

/** "Mua được" cho UI (11 §3.2) = shop hoat_dong ∧ !paused ∧ status=dang_ban ∧ !adminHidden ∧ !deletedAt ∧ stock ≥ 1. */
export function isPurchasable(p: Pick<Product, "status" | "adminHidden" | "deletedAt" | "stock">, shop: Pick<Shop, "status" | "paused">): boolean;

export function shippingFor(shop: Pick<Shop, "shippingFlatVnd" | "freeShipFromVnd">, subtotalVnd: number): number;
// = 0 khi subtotal=0; = 0 khi freeShipFromVnd != null && subtotal >= freeShipFromVnd; else shippingFlatVnd

export function computeTotals(lines: OrderLine[], shop: Pick<Shop, "shippingFlatVnd" | "freeShipFromVnd">): { subtotalVnd: number; shippingVnd: number; totalVnd: number };

/** Tổng cả giỏ nhiều shop cho màn giỏ/đặt hàng. */
export function computeCartSummary(groups: { lines: OrderLine[]; shippingVnd: number }[]): { subtotalVnd: number; shippingVnd: number; totalVnd: number; shopCount: number };

/** Số lượng hợp lệ: nguyên 1..999 (cùng ngưỡng catalog-orders isValidQty — KHÔNG import từ đó để tránh kéo ProductListing). */
export function isValidMarketQty(qty: unknown): qty is number;
/** % giảm để hiện "-20%": compareAt > price ⇒ round; < 5% hoặc không có ⇒ null (11 §5). */
export function discountPercent(p: Pick<Product, "priceVnd" | "compareAtVnd">): number | null;
/** Shop có nhận chuyển khoản không = đủ 3 trường STK. */
export function acceptsBankTransfer(shop: Pick<Shop, "bankName" | "bankAccount" | "bankHolder">): boolean;
/** Lần đặt có shop không nhận CK ⇒ ép COD (LEAD §4 #9). Trả tên shop ép, [] = không ép. */
export function shopsForcingCod(shops: Pick<Shop, "name" | "bankName" | "bankAccount" | "bankHolder">[]): string[];
```

Test `market-pricing.test.ts`: buildMarketLines mỗi DropReason một ca (7) + `available` đúng; biến thể có giá riêng; shippingFor 4 ca (0, dưới ngưỡng, bằng ngưỡng, không ngưỡng); computeTotals; groupCartByShop giữ thứ tự; discountPercent làm tròn + dưới 5% ⇒ null; isPurchasable 6 ca; shopsForcingCod.

### 4.3 `validate.ts` — mọi hàm trả `string | null` (câu lỗi tiếng Việt đời thường — câu CHUẨN ở 11 §3, chép nguyên)

```ts
// TRẦN — một nguồn cho cả client lẫn server (11 R8)
export const CART_MAX_LINES = 50;          // dòng/giỏ
export const ORDER_MAX_LINES = 20;         // dòng/đơn-shop
export const CHECKOUT_MAX_SHOPS = 5;       // shop/lần đặt
export const PRODUCT_IMAGE_MAX = 6;
export const IMAGE_MAX_BYTES = 400 * 1024; // client nén; server chặn 500 KB
export const VARIANT_MIN = 2;              // 0 hoặc 2..10
export const VARIANT_MAX = 10;
export const ADDRESS_MAX = 10;
export const FAVORITES_MAX = 100;
export const NOTE_MAX = 300;
export const REVIEW_MAX = 500;
export const PRICE_MIN = 1_000;
export const PRICE_MAX = 1_000_000_000;
export const STOCK_MAX = 99_999;

export function validateShopDraft(d: ShopDraft): string | null;
//  name 3..60 · phone (nếu có) isValidVnPhone · province bắt buộc (trong COASTAL_PROVINCES của lib/region.ts) · address ≤200 · description ≤1000
//  shippingFlatVnd nguyên 0..5_000_000 · freeShipFromVnd (nếu có) nguyên ≥ 0
//  bankAccount (nếu có) 6..20 chữ số; có bankAccount thì phải có bankName 2..40 + bankHolder 3..60
export function validateMarketProductDraft(d: ProductDraftM): string | null;
//  title 3..120 · isProductCategory · priceVnd nguyên PRICE_MIN..PRICE_MAX · compareAtVnd (nếu có) > priceVnd
//  unit 1..20 · stock nguyên 0..STOCK_MAX · description ≤2000 · images ≤ 6, mỗi URL bắt đầu "https://" | "/api/dev/uploads/" | "data:image/svg+xml" (seed dev)
//  variants: 0 HOẶC 2..10 phần tử, label 1..40 duy nhất (so foldVn), priceVnd (nếu có) cùng khoảng giá
export function validateAddress(a: Address): string | null;
//  name 2..60 · isValidVnPhone(phone) · province 2..40 · isPort ? detail 2..80 ("Ghi tên cảng / bến nhận hàng.") : detail 5..200 ("Ghi địa chỉ đủ để người giao tìm được.")
export function validateCheckout(d: CheckoutDraft): string | null;
//  1..CHECKOUT_MAX_SHOPS shop, shopId không trùng; mỗi shop 1..ORDER_MAX_LINES item ("Mỗi đơn tối đa 20 món — tách bớt sang lần đặt sau");
//  qty isValidMarketQty; productId chuỗi không rỗng; clientRef 8..64; expectedTotalVnd nguyên ≥ 0
//  isPaymentMethod; validateAddress; buyerNote ≤ NOTE_MAX (cả chung lẫn shops[].buyerNote)
export function validateReview(r: { rating: unknown; comment?: string }): string | null;
//  rating 1..5 nguyên ("Chọn số sao.") · comment ≤ REVIEW_MAX ("Nhận xét tối đa 500 chữ.")
export function validateCancelReason(actor: Actor, reason?: string): string | null;  // seller/admin bắt buộc 5..200 ("Ghi lý do cho người mua biết."); buyer tuỳ chọn ≤200
export function validatePaymentNote(reason?: string): string | null;                  // P3 "Chưa thấy tiền": 5..200
export function validateStatusNote(note?: string): string | null;                     // admin từ chối/khoá: 5..300 ("Ghi lý do cho shop biết.")
/** Sản phẩm: kho về 0 ⇒ het_hang; het_hang mà kho > 0 ⇒ dang_ban; 'an' giữ nguyên. */
export function normalizeProductStatus(status: ProductStatus, stock: number): ProductStatus;
```

Test `market-validate.test.ts`: mỗi hàm ≥ 1 ca OK + mỗi luật một ca lỗi (khớp regex chữ khoá: /tên/, /điện thoại/, /giá/, /ảnh/, /số lượng/, /cảng/, /địa chỉ/, /lý do/…); biến thể 1 phần tử ⇒ lỗi, 11 phần tử ⇒ lỗi; 21 dòng/shop ⇒ lỗi; 6 shop ⇒ lỗi; `normalizeProductStatus` 5 ca.

### 4.4 `order-ref.ts`

```ts
/** FNV-1a 32-bit hai vòng ⇒ 16 hex. Tách từ catalog-orders.ts (Core đổi bản đó sang import hàm này — hết hai bản, LEAD §5 #2). */
export function fnv1a64Hex(s: string): string;
/** Vân tay NỘI DUNG đơn của MỘT shop (LEAD §4 #6): shopId + món (productId, variantLabel, qty — sắp theo khoá) + địa chỉ (5 trường, trim)
 *  + cách trả + ghi chú (trim). Cùng nội dung ⇒ cùng mã ⇒ server nhận ra lần gửi lại; đổi một chữ ⇒ đơn mới (bài học 2026-08-18). */
export function marketOrderClientRef(shop: Pick<ShopCheckoutDraft, "shopId" | "items">, common: { address: Address; paymentMethod: PaymentMethod; buyerNote?: string }): string;  // "m1-" + 16 hex
```

Test `market-order-ref.test.ts`: ổn định qua thứ tự món; đổi qty ⇒ khác; đổi biến thể ⇒ khác; đổi địa chỉ ⇒ khác; đổi cách trả ⇒ khác; đổi ghi chú ⇒ khác; đổi shop ⇒ khác; `fnv1a64Hex` khớp vector đã biết (so với bản cũ trong catalog-orders để bảo đảm không đổi mã đơn cũ — `orderClientRef` vẫn ra cùng chuỗi `v1-…` sau khi đổi import).

### 4.5 `order-code.ts`

```ts
export const ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // 32 ký hiệu, bỏ 0/O/1/I
/** SD + yymmdd (giờ VN) + 4 ký tự từ `rand` (0..1) — thuần, test được bằng rand cố định. Đọc qua điện thoại: "SD, 26-09-06, K7PQ". */
export function makeOrderCode(now: Date, rand: () => number): string;   // vd "SD260906K7PQ"
export function isOrderCode(v: unknown): v is string;                    // /^SD\d{6}[A-HJ-NP-Z2-9]{4}$/
```

Test: khuôn; ngày theo giờ VN (23:30 UTC = ngày hôm sau VN — dùng `todayIsoVN` của `lib/days.ts`, không viết lại); alphabet không có ký tự dễ nhầm.

### 4.6 (gộp vào `text.ts`, không tách file)

### 4.7 `text.ts`

```ts
/** Chữ thường, bỏ dấu, đ→d, chỉ giữ [a-z0-9 ], còn lại thành khoảng trắng, gộp — dùng cho search_text VÀ chuỗi tìm VÀ so trùng nhãn biến thể. */
export function foldVn(s: string): string;
/** "Đại lý Hải Đăng" → "dai-ly-hai-dang"; rỗng ⇒ "shop". Tên shop DUY NHẤT qua slug (không hậu tố). */
export function toSlug(s: string): string;
/** search_text cho sản phẩm. */
export function productSearchText(d: Pick<ProductDraftM, "title" | "description">): string;
/** "0901234567" → "0901***567". */
export function maskPhone(phone: string): string;
```

Test: foldVn("Dây thừng Ø12 — Đà Nẵng") ⇒ "day thung 12 da nang"; toSlug; maskPhone 10 số + số ngắn không ném.

### 4.8 `cart.ts` (`"use client"`) — khoá `forfish.mcart.v1`

```ts
export const MARKET_CART_KEY = "forfish.mcart.v1";
export const MARKET_CART_EVENT = "forfish-mcart-changed";
// Trần: CART_MAX_LINES (validate.ts) = 50. Ngăn theo SĐT: TÁI DÙNG `cartBucket` từ "@/lib/cart" (cùng luật cách ly máy dùng chung).
export function addMarketLine(items: MarketCartLine[], productId: string, variantLabel: string | undefined, qty?: number): { items: MarketCartLine[]; reason?: "gio_day" };  // cộng dồn theo (productId, variantLabel); vượt 50 dòng ⇒ items cũ + reason
export function setMarketLineQty(items: MarketCartLine[], productId: string, variantLabel: string | undefined, qty: number): MarketCartLine[];  // qty<=0 = bỏ; clamp 1..999
export function removeMarketLine(items: MarketCartLine[], productId: string, variantLabel?: string): MarketCartLine[];
export function removeShopLines(items: MarketCartLine[], productIds: string[]): MarketCartLine[];   // xoá đúng dòng đã đặt được (LEAD §4 #5)
export function marketCartCount(items: MarketCartLine[]): number;
export function loadMarketCart(phone: string | null | undefined): MarketCartLine[];   // ngăn khác ⇒ []
export function saveMarketCart(phone: string | null | undefined, items: MarketCartLine[]): boolean;  // đọc lại xác minh; false ⇒ UI băng đỏ "Máy hết chỗ — CHƯA lưu được giỏ" (storageFullCopy); EVENT chỉ khi ok; GIỮ quote đang có
export function clearMarketCart(phone: string | null | undefined): void;
/** Bản tra gần nhất (11 §3.3) — mất sóng hiện "giá lúc HH:MM". */
export function loadMarketQuote(phone: string | null | undefined): CartQuote | null;
export function saveMarketQuote(phone: string | null | undefined, quote: CartQuote): void;   // nuốt lỗi — tra lại được
// ── Ô chọn trong giỏ (F-05, 2026-09-06) — chỉ THÊM, không đổi chữ ký cũ ──
export const marketLineKey: (productId: string, variantLabel?: string) => string;   // `productId|variantLabel` — khoá dòng dùng chung giỏ/bản tra/ô chọn
export function pruneUnselected(items: MarketCartLine[], off: readonly string[]): string[];   // tỉa khoá của dòng không còn trong giỏ
export function selectedMarketLines(items: MarketCartLine[], off: readonly string[]): MarketCartLine[];   // mặc định chọn hết (off rỗng ⇒ trả đúng mảng gốc)
export function setMarketSelection(off: readonly string[], keys: readonly string[], on: boolean): string[];   // bật/tắt một nhóm khoá (dòng / shop / cả giỏ)
export function loadMarketUnselected(phone: string | null | undefined): string[];   // đã tỉa theo giỏ hiện có; ngăn khác ⇒ []
export function saveMarketUnselected(phone: string | null | undefined, off: readonly string[]): boolean;   // giữ items + quote; nuốt lỗi (false)
```

Hình dạng lưu: `{ phone: string, items: MarketCartLine[], quote?: CartQuote, off?: string[] }` — `off` = khoá dòng bỏ chọn (vắng = chọn hết); `saveMarketCart` tỉa `off` theo giỏ mới, `saveMarketQuote` giữ nguyên `off`. Test `market-cart.test.ts`: cộng dồn đúng biến thể, clamp 1..999, trần 50 trả `gio_day`, `removeShopLines`, load ngăn khác ⇒ rỗng, save trả false khi setItem ném (mock) và KHÔNG mất quote.

### 4.9 `addresses.ts` (`"use client"`) — khoá `forfish.maddr.v1`

```ts
export const MARKET_ADDR_KEY = "forfish.maddr.v1";
// Trần: ADDRESS_MAX (validate.ts) = 10.
export interface SavedAddress extends Address { id: string; isDefault: boolean }
export function loadAddresses(phone): SavedAddress[];
export function upsertAddress(list: SavedAddress[], a: SavedAddress): SavedAddress[];   // đầy 10 ⇒ thay cái cũ nhất không default
export function setDefaultAddress(list: SavedAddress[], id: string): SavedAddress[];
export function removeAddress(list: SavedAddress[], id: string): SavedAddress[];
export function saveAddresses(phone, list: SavedAddress[]): boolean;
/** Địa chỉ gợi ý lần đầu: tên/SĐT tài khoản + tỉnh cảng nhà (`loadHome().province`, lib/region.ts) — chỉ thiếu cảng/địa chỉ (11 §5.6). */
export function seedAddress(input: { name?: string; phone: string; province?: string }): Address;
```
Hình dạng: `{ phone, items: SavedAddress[] }`. Test: thuần 3 hàm + ngăn + seedAddress.

### 4.10 `favorites.ts` (`"use client"`) — khoá `forfish.mfav.v1`

```ts
export const MARKET_FAV_KEY = "forfish.mfav.v1";
// Trần: FAVORITES_MAX (validate.ts) = 100. Kèm SNAPSHOT để mất sóng còn hiện (11 §3.7).
export interface FavItem { productId: string; savedAt: number; snapshot: { title: string; priceVnd: number | null; image?: string; shopName: string } }  // null = liên hệ báo giá (ADR 0014)
export function loadFavorites(phone): FavItem[];
export function toggleFavorite(list: FavItem[], item: FavItem): FavItem[];  // có ⇒ bỏ; chưa ⇒ thêm đầu; đầy ⇒ bỏ cũ nhất
export function isFavorite(list: FavItem[], productId: string): boolean;
export function saveFavorites(phone, list: FavItem[]): boolean;
```
Hình dạng: `{ phone, items: FavItem[] }`. Test: toggle + trần + ngăn.

### 4.11 `orders-cache.ts` (`"use client"`) — khoá `forfish.morders.v1`

```ts
export const MARKET_ORDERS_CACHE_KEY = "forfish.morders.v1";
export function loadCachedMarketOrders(phone): { savedAt: number; orders: Order[] } | null;
export function saveCachedMarketOrders(phone, orders: Order[]): void;   // nuốt lỗi — tải lại được; giữ ≤ 50 đơn mới nhất
export function clearCachedMarketOrders(): void;
```
Hình dạng: `{ phone, savedAt, orders }`. Test: ngăn khác ⇒ null; JSON hỏng ⇒ null; cắt 50.

### 4.12 `seller-flag.ts` (`"use client"`) — khoá `forfish.mshop.v1`

Cho sheet Tài khoản (LEAD §4 #16) biết máy này có shop không mà KHÔNG gọi mạng lúc mở app: `hero-account.tsx` tra `GET /api/ban-hang/shop` **chỉ khi sheet mở và có sóng** (12 s, `.catch`), ghi cờ; mất sóng đọc cờ. Không có cờ + mất sóng ⇒ ẩn cả hai dòng (mời gọi tầng 5 ẩn khi offline).

```ts
export const MARKET_SHOP_FLAG_KEY = "forfish.mshop.v1";
export interface ShopFlag { hasShop: boolean; status?: ShopStatus; at: number }
export function loadShopFlag(phone): ShopFlag | null;    // ngăn khác ⇒ null
export function saveShopFlag(phone, v: ShopFlag): void;  // nuốt lỗi
export function clearShopFlag(): void;
```
Hình dạng: `{ phone, hasShop, status, at }`. Test: ngăn + JSON hỏng.

### 4.13 Đăng ký khoá + sao lưu (Core — LEAD §5 #2 cấp `offline-backup.ts` cho Core)

- `lib/offline-backup.ts` `NEVER_BACKUP_PREFIXES` thêm **5** dòng `"forfish.mcart."`, `"forfish.maddr."`, `"forfish.mfav."`, `"forfish.morders."`, `"forfish.mshop."` kèm chú thích vì sao (giỏ/địa chỉ/đơn = PII + tải lại được; yêu thích/cờ shop = của máy này). Cổng `offline-backup.test.ts` "KHÔNG khoá forfish.* nào trong src/ còn chưa xếp loại" đỏ nếu thiếu.
- `ops/state-registry.md` bảng `forfish.*`: 5 dòng mới (writer/reader/reset) — Admin+Docs agent.
- `hero-account.tsx` "Xoá dữ liệu tài khoản khỏi máy" + đăng xuất: gọi `clearMarketCart(phone)`, `clearCachedMarketOrders()`, `clearShopFlag()` — Seller agent (đang own file đó).

---

## 5. Adapter file — `src/lib/market/file-store.ts`

**Chỉ tồn tại cho dev.** Khởi tạo gọi `assertDevFileMode()` — sai điều kiện ⇒ ném ngay, không có đường lùi.

### 5.1 Tệp `.local/market-dev.json` (gitignore: `/.local/` — ĐÃ có trong `.gitignore` working tree 2026-09-06)

**Đường dẫn**: `MARKET_STORE_FILE` (tuyệt đối, hoặc tương đối cwd) trỏ tệp kho; không đặt ⇒ `.local/market-dev.json`. Ảnh tải lên luôn ở `market-uploads/` **cạnh tệp đó** (`devStoreFile()` / `devUploadDir()` — route `/api/dev/uploads/[name]` đọc cùng chỗ). Nhờ vậy e2e chạy trên kho riêng, không đè kho dev đang dùng tay.

```jsonc
{
  "version": 1,
  "shops":    [ /* Shop[] snake→camel y hệt supabase (có paused, approvedAt) */ ],
  "products": [ /* Product + searchText (có adminHidden, deletedAt) */ ],
  "orders":   [ /* Order + restockedAt (có needsRefund, bankSnapshot) */ ],
  "reviews":  [ /* Review + buyerPhone (thô; mask lúc trả ra) + hidden */ ],
  "sessions": { "<token>": { "phone": "0901000001", "issuedAt": "…" } },
  "personas": [ /* DevPersona[] — seed */ ],
  "notifications": [ /* {at, phone, title, body, url, pushOs} — thay push ở dev, /dev hiện ra */ ]
}
```
id = `crypto.randomUUID()` để giống prod (không đếm `seq`).

### 5.2 Ghi an toàn + khoá đơn giản

- Mọi thao tác ghi đi qua **một hàng đợi promise** (`let chain = Promise.resolve(); const withLock = (fn) => (chain = chain.then(fn, fn))`) — LEAD §4 #1 "file-store: khoá ghi tuần tự"; trong một tiến trình Next dev thì đủ.
- Ghi = `writeFile(path + ".tmp")` → `rename(tmp, path)` (nguyên tử trên cùng ổ). Đọc lỗi JSON ⇒ **không** đè: ném `MarketError('unavailable')` kèm log đường dẫn để dev tự sửa/xoá (đúng nguyên tắc "đọc hỏng không mở cửa ghi", K4).
- Bộ nhớ: nạp một lần vào RAM (`state`), mỗi lần ghi thì serialize toàn bộ (vài trăm KB — chấp nhận ở dev).
- `placeOrders`: trong `withLock`, cho từng shop: kiểm shop `hoat_dong` (không ⇒ `shop_not_active`) → `paused` (⇒ `shop_paused`) → kiểm từng dòng (đúng shop, `dang_ban`, `!adminHidden`, `!deletedAt`, `stock>=qty`, giá khớp gốc/biến thể) trên **bản sao**; đủ hết mới áp (trừ kho, cộng `soldCount`, `normalizeProductStatus`) và push đơn (kèm `bankSnapshot` khi `chuyen_khoan`); thiếu một dòng ⇒ shop đó `line_unavailable` + `productIds` + `available`, KHÔNG đụng kho. Trùng `client_ref` ⇒ trả đơn cũ `duplicate:true`. Mã đơn: `makeOrderCode(new Date(), Math.random)` — trùng thì sinh lại.
- `transitionOrder`: kiểm `status === expectStatus` trong lock; `da_huy` ⇒ cộng kho + trừ `soldCount` nếu `restockedAt` null, đặt `restockedAt`.
- `deleteProduct`: đặt `deletedAt` (xoá mềm); `setProductAdminHidden`: đặt 2 trường.
- `addReview`: kiểm đúng như RPC; `setReviewHidden` + `recountRating(productId, shopId)` — hàm TS cùng luật `market_recount_rating` (chỉ `hidden=false`).
- `listProducts`: lọc đúng §3.6 (buyer: `dang_ban|het_hang`, `!adminHidden`, `!deletedAt`, shop `hoat_dong`; `province` = so `foldVn`) + `foldVn(q)` chứa trong `searchText`; sort; cắt trang.
- `listOverdueDelivered`: lọc `da_giao` + `deliveredAt <= before`.
- `stats`/`overview`: tính trên RAM theo giờ VN (`todayIsoVN` của `lib/days.ts`).
- `saveUpload`: ghi `.local/market-uploads/<shopId>-<uuid>.<ext>` (Buffer; `ext` suy từ MIME đã kiểm, KHÔNG từ tên file client), trả `{ url: "/api/dev/uploads/<tên file>" }`.
- `devLogin(phone)`: persona phải tồn tại (không thì `not_found`); token = `newDeviceToken()` (**bắt buộc**, LEAD §5 #4 — `readToken()` ở máy khách lọc bằng `isValidTokenShape`, chuỗi khác khuôn bị coi là chưa đăng nhập); lưu `sessions[token] = {phone}`; trả `{token, persona}`. `devIdentity(token)` tra `sessions`.

### 5.3 Seed lần đầu (file chưa có ⇒ sinh) — LEAD §5 A2: persona SDVICO có shop hoạt động sẵn

| Nhóm | Nội dung |
|---|---|
| Persona | `0901000001` "Anh Ba (mua)" buyer basic · `0901000002` "Chị Tư (mua)" buyer premium · `0901000003` "Cô Năm (mua)" buyer basic — chưa có shop, dùng để test đăng ký · `0902000001` "SDVICO" seller · `0902000002` "Đại lý Hải Đăng" seller · `0902000003` "Đại lý Phương Nam (chờ duyệt)" seller · `0909000000` "Admin" admin |
| Shop | SDVICO (`hoat_dong`, owner `0902000001`, Thành phố Hồ Chí Minh — sửa 2026-10-23, ship 0, free từ null, KHÔNG STK — để test ép COD) · Đại lý Hải Đăng (`hoat_dong`, Bình Định, ship 30.000, miễn phí từ 2.000.000, có STK, `paused:false`) · Đại lý Phương Nam (`cho_duyet`, Kiên Giang) |
| Sản phẩm | ~24 món phủ **đủ 9 danh mục** (≥2 món/danh mục, id gạch-ngang), chia 2 shop hoạt động (16 SDVICO + 8 Hải Đăng), có: 3 món `compareAtVnd` (giá gạch), 2 món có `variants` (dây thừng Ø10/Ø12/Ø14; đèn LED 50W/100W có giá riêng), 1 món `stock: 0` (`het_hang`), 1 món `an`, 1 món `adminHidden` (lý do "Ngư cụ cấm"), 1 món `deletedAt`, 1 món `stock: 2` (test "chỉ còn 2"), `soldCount` rải 0..120, `ratingAvg` rải. Ảnh = **SVG data-URI** placeholder theo danh mục (màu lấy từ bảng cố định trong seed, không phải class Tailwind nên không dính hook hex) |
| Đơn mẫu | 4 đơn của `0901000001`: 1 `cho_xac_nhan` (chuyen_khoan Hải Đăng, `bao_da_chuyen`, có `bankSnapshot`), 1 `dang_giao` (COD), 1 `da_giao` (COD, `deliveredAt` 2 ngày trước), 1 `da_giao` (COD, `deliveredAt` **9 ngày trước** — để thấy `settleOverdue` chạy ngay lượt đọc đầu), 1 `hoan_thanh` (đã có 1 review); 1 đơn `da_huy` của `0901000002` (seller huỷ CK sau `bao_da_chuyen` ⇒ `needsRefund:true`). Timeline đủ mục |
| Đánh giá | 3 đánh giá, 1 trong đó `hidden:true` (điểm cache đã tính không gồm nó) |
| Địa chỉ | không seed (localStorage máy khách) |

Seed nằm ở `src/lib/market/dev-seed.ts` (thuần: `buildDevSeed(now: Date)` → object; test `market-dev-seed.test.ts` kiểm: đủ 9 danh mục, mọi product `validateMarketProductDraft` = null, mọi shop `validateShopDraft` = null, id không trùng, persona SĐT `isValidVnPhone`, điểm cache = `recountRating` tính lại).

### 5.4 Adapter supabase — `src/lib/market/supabase-store.ts` (tóm tắt để Core làm đúng)

- `createAdminClient()` null ⇒ mọi method ném `unavailable` (503) — **không** ném lúc khởi tạo (route vẫn lên, trả 503 sạch).
- Mọi truy vấn gắn `timeoutSignal(10000)` qua `.abortSignal()` (khuôn `product-catalog.ts`; `if (s) q = q.abortSignal(s)`).
- `placeOrders`: cho từng `prepared` gọi `admin.rpc("market_place_order", {...p_bank_snapshot})`; bắt lỗi: `P0001` message `shop_not_active` / `shop_paused` / `line_unavailable:<id>` ⇒ kết quả lỗi cho shop đó (với `line_unavailable` đọc lại `stock` của id đó để điền `available`); `23505` với `market_orders_code_key` ⇒ sinh mã mới thử lại (≤3); `23505` với `market_orders_client_ref_uniq` ⇒ `getOrderByClientRef` ⇒ `duplicate:true`; lỗi khác ⇒ `insert_failed` (log `console.error("[market] …", code, message)`). **Không** `Promise.all` — tuần tự theo shop, để lỗi shop trước không che shop sau và log dễ đọc.
- `transitionOrder` (**từ 0064, 2026-10-19**): MỘT `rpc("market_transition_order", {p_id, p_expect, p_patch, p_entry})` — UPDATE có điều kiện status + `timeline || entry` tại DB + `da_huy` ⇒ hoàn kho trong CÙNG giao dịch; P0001 `bad_transition`/`not_found` ⇒ MarketError; đọc lại bằng `getOrder` (kèm join shop). `patchRequest`/`acceptRequest` tương tự qua `market_patch_request`/`market_accept_request` (04 mục "GHI NGUYÊN TỬ"). ~~timeline đọc-rồi-ghi + rpc hoàn kho thứ hai~~ (rà Codex: hai người bấm sát nhau là đủ mất sự kiện, không phải chuyện tải).
- `listProducts`: `ProductCard` = select `*, shops!inner(name, slug, province, status, paused)` + `.eq("shops.status","hoat_dong")` + `.is("deleted_at", null)` + `.eq("admin_hidden", false)` + `.in("status", ["dang_ban","het_hang"])`; `q` ⇒ `.ilike("search_text", "%" + foldVn(q) + "%")`; `province` ⇒ `.eq("shops.province", province)`.
- `deleteProduct` ⇒ `update set deleted_at = now()`; `setProductAdminHidden` ⇒ update 2 cột; `setReviewHidden` ⇒ `rpc("market_set_review_hidden")`; `listOverdueDelivered` ⇒ `.eq("status","da_giao").lte("delivered_at", before).limit(200)`.
- `stats`/`overview`: vài câu `select … count` theo trạng thái + một câu lấy đơn `hoan_thanh` trong kỳ để cộng `total_vnd`/top món ở TS (không cần aggregate PostgREST).
- `saveUpload`: `admin.storage.from("market-media").upload(\`${shopId}/${crypto.randomUUID()}.${ext}\`, bytes, {contentType, upsert:false})` → `getPublicUrl(path).data.publicUrl`.
- `rowToShop/rowToProduct/rowToOrder/rowToReview` khoan dung với giá trị lạ (khuôn `rowToOrder` cũ), `toLines()` lọc dòng đúng hình dạng; `ShopPublic` dựng qua `toShopPublic(shop)` (route-utils) — bỏ 4 trường + thêm `acceptsBankTransfer`.
- `dev*` ⇒ `forbidden`.

---

## 6. Dev identity — chỉ file mode

### 6.1 Header và chuỗi

- Header máy khách gửi: **`x-sdfish-token`** (`DEVICE_TOKEN_HEADER` trong `lib/device-token.ts`; `tokenHeader()`/`authedFetch` gắn nó; `readTokenHeader` cũng nhận `Authorization: Bearer`).
- Chuỗi dev **phải** là `newDeviceToken()` (`sdf_` + 43 ký tự base64url) — nếu không, `readToken()` trả null và app coi là chưa đăng nhập dù `saveToken` đã ghi.

### 6.2 `src/lib/api-identity.ts` — chỗ sửa (Core, ≤ 15 dòng)

Đặt **ngay đầu** `identityFromRequest`, trước `tokenIdentity(req)`:

```ts
  /*  NHÁNH DEV — CHỈ khi kho file (MARKET_STORE=file, không Vercel, không
      production; xem lib/market/dev-mode.ts). Máy dev không có service key nên
      tokenIdentity() trả `unavailable` ⇒ 503 cho mọi thứ; nhánh này tra chuỗi ở
      sổ persona của file-store thay cho device_tokens. Ở prod isDevFileMode()
      là false theo ba điều kiện — không có đường nào bật nhầm. */
  if (isDevFileMode()) {
    const raw = readTokenHeader(req.headers);
    const who = raw ? await (await getMarketStore()).devIdentity(raw) : null;
    if (who) return { ok: true, phone: normalizeVnPhone(who.phone), legacy: false };
    if (anonymous) return { ok: true, phone: "", legacy: false };
    return deny(401, raw ? "unknown_token" : "no_token");
  }
```

Import thêm: `isDevFileMode` từ `@/lib/market/dev-mode`, `readTokenHeader` từ `@/lib/device-token`, `getMarketStore` từ `@/lib/market/store` (đã `server-only`, import động bên trong nên không kéo `fs` vào bundle prod).

### 6.3 `src/lib/admin-auth.ts` — chỗ sửa (Core, ≤ 12 dòng)

Đặt đầu `requireStaff()`, trước `createClient()`:

```ts
  if (isDevFileMode()) {
    const raw = readTokenHeader(await headers());
    const who = raw ? await (await getMarketStore()).devIdentity(raw) : null;
    if (!who) return { ok: false, status: 401, code: "login_required" };
    if (who.role === "admin") return { ok: true, phone: who.phone, role: "admin", permissions: null };
    return { ok: false, status: 403, code: "staff_only" };
  }
```

`requireAdmin`/`requirePermission` đi qua `requireStaff` nên tự có nhánh dev.

### 6.4 Route + trang dev (Core)

| Route/trang | Hành vi | Khi không file mode |
|---|---|---|
| `POST /api/dev/login` `{phone}` | `store.devLogin` → `{ok, token, persona:{phone,name,role,tier}}` | 404 `{ok:false, code:"not_found"}` |
| `GET /api/dev/personas` | danh sách persona + shop của họ (nếu có) | 404 |
| `GET /api/dev/uploads/[name]` | đọc `.local/market-uploads/<name>` — `name` phải khớp **`/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/`** (dấu chấm CHỈ ở đuôi ⇒ không có `..`; regex cũ `[A-Za-z0-9._-]+` vẫn khớp `..`), rồi `path.resolve(UPLOAD_DIR, name)` phải `startsWith(UPLOAD_DIR + sep)` (lưới thứ hai); `Content-Type` theo đuôi từ bảng cố định, `Cache-Control: no-store` | 404 |
| `GET /api/dev/notifications?phone=` | mục `notifications` của file-store (thay push) | 404 |
| `/dev` (`src/app/dev/page.tsx`, client) | thẻ persona (tên, vai, SĐT, shop/status) + nút **Đăng nhập** → `POST /api/dev/login` → `saveToken(token, persona.tier, null)` → `applyIdentityAction`? **KHÔNG** — `saveToken` đã bắn `TOKEN_STORE_EVENT`; danh tính offline (`forfish.identity.v1`) do `use-auth.ts` ghi khi có user, ở dev không cần. Sau đó `router.push("/cho")` hoặc `/ban-hang` hoặc `/quan-tri` theo vai. Nút **Đăng xuất** = `signOutLocal("user")`. Khi API trả 404 ⇒ trang hiện "Chỉ dùng khi chạy `MARKET_STORE=file npm run dev`" | Trang vẫn build được (client fetch 404 → thông báo) |

### 6.5 Rủi ro + chốt an toàn

| Rủi ro | Chốt |
|---|---|
| File mode bật nhầm ở prod | `isDevFileModeEnv` ba điều kiện (`MARKET_STORE=file` **và** không `VERCEL` **và** `NODE_ENV!=='production'`); `next build` đặt `NODE_ENV=production` nên cả `npm run build && npm start` local cũng không vào file mode; test `market-dev-mode.test.ts` 8 tổ hợp env |
| Nhánh dev lọt vào `identityFromRequest` khi `MARKET_STORE` không đặt | nhánh nằm trọn trong `if (isDevFileMode())`; test `market-identity-dev.test.ts` mock env và khẳng định với env prod thì hàm không hề gọi `getMarketStore` (spy) |
| Chuỗi dev là chuỗi thật? | Không: `sessions` chỉ trong file local, không bao giờ vào `device_tokens`; supabase-store `devIdentity` ném `forbidden` |
| `getMarketStore` kéo `node:fs` vào Edge/bundle | import động trong nhánh; không có `middleware.ts`/`proxy.ts` import `api-identity` (đã kiểm 2026-09-06) |
| Persona admin có toàn quyền `/quan-tri` ở dev | đúng ý — chỉ dữ liệu file local |

---

## 7. Route API

Quy ước chung: JSON `{ ok:true, ... }` / `{ ok:false, code, message?, productIds? }`; `message` chỉ có khi `code="invalid"` (câu tiếng Việt từ validate). Body sai JSON ⇒ 400 `bad_body`. Mọi route `try/catch` ⇒ `isMarketError(e) ? err(e.status, e.code, e.message, e.productIds) : err(500, "internal")`. **Helper dùng chung ở `src/lib/market/route-utils.ts`** (`server-only`, Core viết, cả 3 nhóm dùng):

```ts
export function marketErrorResponse(e: unknown): NextResponse;
export function toShopPublic(s: Shop): ShopPublic;                       // bỏ ownerPhone/bank*/statusNote + acceptsBankTransfer
/** LEAD §4 #3: áp settleOverdue cho danh sách vừa đọc — có patch thì store.transitionOrder(id,"da_giao",patch);
 *  bad_transition (ai đó vừa bấm) ⇒ đọc lại đơn; lỗi khác ⇒ log + trả đơn như DB đang có (không nói dối). */
export async function settleOverdueOrders(store: MarketStore, orders: Order[], nowIso: string): Promise<Order[]>;
/** Quét toàn shop/sàn trước khi tính thống kê (stats/overview/tổng quan): listOverdueDelivered(now − 7d) → settleOverdueOrders. */
export async function settleOverdueForStats(store: MarketStore, nowIso: string, shopId?: string): Promise<void>;
/** Đọc multipart `file`, kiểm mime ∈ jpeg/png/webp VÀ magic bytes (FF D8 FF · 89 50 4E 47 · RIFF…WEBP), ≤ 500 KB ⇒ {bytes, mime}; sai ⇒ MarketError bad_type/bad_size. */
export async function readImageUpload(req: Request): Promise<{ bytes: Uint8Array; mime: "image/jpeg" | "image/png" | "image/webp" }>;
```

Thời gian máy khách chờ: đọc 12 s, ghi 20 s, upload 60 s. **Không route nào dưới đây vào `API_CACHE_ALLOW` của SW** — `/api/admin/*` SW đã bỏ qua; `/api/cho|ban-hang|dev` không nằm trong allowlist nên SW để mạng lo (không sửa `sw.js`, không sửa `sw-cache-policy.ts`). **SĐT không bao giờ lấy từ body/query để lọc** (11 R16): `buyerPhone` = `identityFromRequest`, chủ shop = `requireShopOwner`; `address.phone` trong đơn là SĐT NGƯỜI NHẬN (dữ liệu, không phải danh tính).

**Mọi route đọc đơn/thống kê gọi `settleOverdueOrders`/`settleOverdueForStats` TRƯỚC khi trả** — đánh dấu ⏱ dưới đây.

### 7.1 Người mua — `/api/cho/*` (Buyer agent)

| Method + path | Auth | Body / query | 200 | Lỗi |
|---|---|---|---|---|
| `GET /api/cho/san-pham` | `identityFromRequest(req, true)` — khách lạ xem được (LEAD §5 #8) | `?q&category&province&shopId&sort&page&pageSize` | `{ok, items: ProductCard[], total, page, pageSize}` | 400 `invalid` (category/sort lạ) |
| `GET /api/cho/san-pham/[id]` | anonymous ok | — | `{ok, product: ProductCard, shop: ShopPublic, reviews: {avg, count, latest: Review[] (≤5)}, canReview: {orderId} \| null}` (`canReview` chỉ khi có phone: đơn `hoan_thanh` chứa món chưa review, mới nhất). `deletedAt`/`adminHidden` ⇒ 404 (buyer không phân biệt). Shop ≠ `hoat_dong` vẫn 200 — UI đọc `shop.status` để nói "Shop này đang tạm đóng" + ẩn nút; `shop.paused` ⇒ băng "tạm nghỉ" + nút vô hiệu | 404 |
| `GET /api/cho/san-pham/[id]/danh-gia` | anonymous ok | `?page` | `{ok, items: Review[], total}` (không có hidden) | 404 |
| `GET /api/cho/shop/[slug]` | anonymous ok | `?page&sort&category` | `{ok, shop: ShopPublic, products: Page<ProductCard>}` | 404 `not_found` (slug lạ); 403 `shop_not_active` (có nhưng chưa duyệt/khoá/từ chối — UI "Shop này đang tạm đóng", KHÔNG lộ lý do) |
| `POST /api/cho/gio/tinh` | anonymous ok (giỏ xem được chưa cần đăng nhập) | `{items: MarketCartLine[]}` (≤ 50) | `{ok, quote: CartQuote}` — groups có `shop.acceptsBankTransfer`/`shop.paused`; client cất `saveMarketQuote` | 400 |
| `POST /api/cho/don` | đăng nhập | `CheckoutDraft` | `{ok, results: PlaceOrderResult[]}` (200 kể cả khi một shop lỗi — client hiện từng shop, xoá khỏi giỏ đúng dòng của shop `ok`). Luật server: (1) `validateCheckout`; (2) `getProductsByIds` + `getShop` từng shop; (3) `buildMarketLines` — có `dropped` ⇒ kết quả shop đó `line_unavailable` (không gọi store); (4) `paymentMethod=chuyen_khoan` mà `shopsForcingCod(shops)` ≠ [] ⇒ **400 `invalid`** "Shop {tên} chỉ nhận tiền mặt — chọn Trả khi nhận hàng cho cả lần đặt" (client đã ẩn chip, đây là lưới); (5) `computeTotals` ≠ `expectedTotalVnd` ⇒ kết quả shop đó `price_changed` + `quote` (không gọi store); (6) `placeOrders` cho các shop còn lại (kèm `bankSnapshot` và `buyerNote` riêng của shop nếu có — adapter rơi về `common.buyerNote` khi trống); (7) `notifyMarket` N1 cho `shop.ownerPhone` mỗi đơn ok (không phải duplicate) | 400 `invalid`+message; 503 |
| `GET /api/cho/don` ⏱ | đăng nhập | `?status&page` (pageSize 20, cache máy 50) | `{ok, items: Order[], total}` (kèm shopName/shopPhone/shopSlug) | — |
| `GET /api/cho/don/[id]` ⏱ | đăng nhập | — | `{ok, order}` — `bankSnapshot` nằm trong order (KHÔNG đọc STK hiện tại của shop — 11 R11) — **buyer_phone ≠ phone ⇒ 404** (không lộ tồn tại) | 404 |
| `POST /api/cho/don/[id]/huy` | đăng nhập | `{reason?}` (≤200) | `{ok, order}` — `applyTransition(o,"da_huy","buyer")`; N6 cho shop | 409 `bad_transition` |
| `POST /api/cho/don/[id]/da-nhan` | đăng nhập | — | `{ok, order}` (`da_giao` → `hoan_thanh`, COD ⇒ `da_thanh_toan`); N5 cho shop | 409 |
| `POST /api/cho/don/[id]/bao-chuyen` | đăng nhập | — | `{ok, order}` (`applyPaymentTransition(o,"bao_da_chuyen","buyer")`); N8 cho shop | 400 `invalid` (COD); 409 |
| `POST /api/cho/don/[id]/danh-gia` | đăng nhập | `{productId, rating, comment?}` | `{ok, review}` | 400; 409 `review_not_allowed`/`already_reviewed` |

### 7.2 Người bán — `/api/ban-hang/*` (Seller agent)

Cổng: `requireShopOwner(req, opts)` trong `src/lib/market/shop-auth.ts` (Core viết, `server-only`):

```ts
export type ShopGate =
  | { ok: true; phone: string; shop: Shop }
  | { ok: false; res: NextResponse };  // 401/503 từ identityFromRequest · 404 no_shop · 403 shop_not_active
/** `allow`: trạng thái shop được qua (mặc định: tất cả — chủ shop tam_khoa vẫn xử lý đơn treo, 11 §6.2). */
export async function requireShopOwner(req: Request, opts?: { allow?: ShopStatus[] }): Promise<ShopGate>;
```

| Method + path | Auth | Body | 200 | Lỗi |
|---|---|---|---|---|
| `GET /api/ban-hang/shop` | đăng nhập | — | `{ok, shop: Shop \| null}` (null = chưa đăng ký; client ghi `saveShopFlag`) | — |
| `POST /api/ban-hang/shop` | đăng nhập | `ShopDraft` | 201 `{ok, shop}` (status `cho_duyet`; slug = `toSlug(name)`). SĐT đã có shop **`tu_choi`** ⇒ cập nhật draft + `setShopStatus(id,"cho_duyet",null)` (gửi lại, cùng id, 11 §6.1); đã có shop trạng thái khác ⇒ 409 `invalid` "Số này đã có shop rồi. Vào Kênh người bán để xem." | 400; 409 `invalid` / `slug_taken` |
| `PATCH /api/ban-hang/shop` | chủ shop (mọi status) | `ShopPatch` (kể cả `paused` — LEAD §4 #8; đổi `name` ⇒ slug mới, trùng ⇒ 409) | `{ok, shop}` | 400; 409 `slug_taken` |
| `GET /api/ban-hang/san-pham` | chủ shop | `?status&q&page` (includeHidden = true; `status=bi_go` = adminHidden) | `{ok, items, total}` (không có deleted) | — |
| `POST /api/ban-hang/san-pham` | chủ shop `allow: ["cho_duyet","hoat_dong"]` (pending soạn trước — 11 §6.2) | `ProductDraftM` | 201 `{ok, product}` | 400; 403 `shop_not_active` (tam_khoa/tu_choi) |
| `GET/PATCH/DELETE /api/ban-hang/san-pham/[id]` | chủ shop (PATCH/DELETE `allow: ["cho_duyet","hoat_dong"]`) | `Partial<ProductDraftM>` (bỏ qua `adminHidden` nếu client gửi) | `{ok, product}` / `{ok}` (DELETE = xoá mềm) | 404 (không phải của shop / đã xoá ⇒ 404) |
| `GET /api/ban-hang/don` ⏱ | chủ shop (mọi status) | `?status&page` | `{ok, items, total}` | — |
| `GET /api/ban-hang/don/[id]` ⏱ | chủ shop | — | `{ok, order}` (đơn của shop khác ⇒ 404) | 404 |
| `PATCH /api/ban-hang/don/[id]` | chủ shop (mọi status — `tam_khoa` vẫn xử lý đơn treo) | `{status?, note?, paymentStatus?, sellerNote?, carrier?, trackingCode?}` — mỗi request **một** trong: đổi status (`applyTransition(o, status, "seller", note)`) · đổi paymentStatus (`applyPaymentTransition`, P3 cần note) · chỉ ghi chú/vận chuyển (patch trần, `expectStatus` = status hiện tại). `dang_giao` được gửi kèm `carrier`/`trackingCode` trong cùng request | `{ok, order}` | 400 `invalid` (huỷ thiếu lý do / P3 thiếu lý do / carrier > 40); 409 `bad_transition` |
| `GET /api/ban-hang/thong-ke` ⏱ | chủ shop | `?range=today\|7d\|30d` | `{ok, stats: ShopStats}` | — |
| `POST /api/ban-hang/upload` | chủ shop (mọi status — đăng ký cần logo) | multipart `file` (jpeg/png/webp ≤ 500 KB, `readImageUpload`) | `{ok, url}` | 415 `bad_type`; 413 `bad_size`; 500 `insert_failed` |

Đổi status/paymentStatus ⇒ `notifyMarket` theo bảng §7.4 (buyer push chỉ `dang_giao`/`da_giao`/`da_huy`/P3 — đúng luật 07 §12 + LEAD §4 #4).

### 7.3 Admin — `/api/admin/cho/*` (Admin+Docs agent) — tất cả `requireAdmin()` (LEAD §4 #13, nợ manager)

Mọi ghi: `logActivity(admin, {action, target, detail})` với **`AdminActionKey` mới theo quy ước `'<khu>.<việc>'`** của `lib/admin-activity.ts` (Admin agent thêm 5 mã + nhãn ở `ACTION_LABEL`, test sẵn có bắt thiếu nhãn): `market.shop-status` · `market.shop-owner` · `market.order-update` · `market.product-hide` · `market.review-hide`. Timeline đơn ghi `by = admin:<sđt>` (`timelineBy("admin", who.phone)`).

| Method + path | Body/query | 200 |
|---|---|---|
| `GET /api/admin/cho/tong-quan` ⏱ | — | `{ok, overview: AdminOverview}` (11 §7 KPI sàn) |
| `GET /api/admin/cho/shops` | `?status&page` (mặc định `cho_duyet`) | `{ok, items: (Shop & {productCount: number})[], total}` (có ownerPhone) |
| `GET /api/admin/cho/shops/[id]` | — | `{ok, shop, productCount}` |
| `PATCH /api/admin/cho/shops/[id]` | `{status?, statusNote?, ownerPhone?}` — `tu_choi`/`tam_khoa` bắt buộc `statusNote` (`validateStatusNote`); `ownerPhone` qua `normalizeVnPhone` + `isValidVnPhone` (gán chủ shop SDVICO — LEAD §5 A2) | `{ok, shop}`; đổi status ⇒ `notifyMarket` N10/N11/N12 cho `shop.ownerPhone` (bỏ qua khi owner là sentinel) |
| `GET /api/admin/cho/don` ⏱ | `?status&shopId&buyerPhone&code&page` | `{ok, items, total}` |
| `PATCH /api/admin/cho/don/[id]` | như seller PATCH, actor `admin` — **xử lý thay mọi shop** (LEAD §4 #2), `by = admin:<sđt>`; huỷ được tới `dang_giao` (T7) | `{ok, order}` + thông báo như seller |
| `GET /api/admin/cho/san-pham` | `?shopId&q&page` (includeHidden) | `{ok, items: ProductCard[], total}` |
| `PATCH /api/admin/cho/san-pham/[id]` | `{adminHidden: boolean, reason?}` — `true` bắt buộc `reason` 5..300 | `{ok, product}`; gỡ ⇒ N13 cho seller |
| `GET /api/admin/cho/danh-gia` | `?productId&page` (includeHidden) | `{ok, items: Review[], total}` |
| `PATCH /api/admin/cho/danh-gia/[id]` | `{hidden: boolean}` | `{ok, review}` (điểm sản phẩm + shop đã tính lại) |

### 7.4 Thông báo — `src/lib/market/notify.ts` (Core, `server-only`)

```ts
/** Best-effort. Prod: notifyAccount(createAdminClient(), phone, {...msg, sentBy:"system:market"}). File mode: push vào file-store.notifications (xem ở /dev). Không bao giờ ném. Bỏ qua khi phone không hợp lệ (sentinel). */
export async function notifyMarket(phone: string, msg: { title: string; body: string; url?: string; pushOs?: boolean; tag?: string }): Promise<void>;
export type MarketEvent = "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "N7" | "N8" | "N9" | "N9b" | "N10" | "N11" | "N12" | "N13";
/** Dựng title/body/url/pushOs/tag cho một sự kiện theo bảng 11 §8 — THUẦN, có test (mọi câu có mã đơn; pushOs đúng bảng). */
export function marketNotice(ev: MarketEvent, ctx: { order?: Order; shop?: Pick<Shop, "id" | "name">; product?: Pick<Product, "id" | "title">; reason?: string; hotline: string }): { title: string; body: string; url: string; pushOs: boolean; tag: string };
```

`sentBy` = `"system:market"` (tiền tố `system:` để `/quan-tri` lọc như `system:order`). `tag` = `mdon-<orderId>` cho việc của đơn, `mshop-<shopId>` cho việc của shop. **Ngoại lệ push đã chốt (LEAD §4 #4, ghi 1 dòng vào 07 §12 cùng commit — Admin+Docs)**: actor NGƯỜI BÁN nhận push OS cho N1 (đơn mới), N8 (báo đã CK), N10–N12 (duyệt/từ chối/khoá); người mua giữ luật cũ: chỉ N3/N4/N7/N9b push, còn lại hộp thư.

| Sự kiện | Tới | pushOs | url |
|---|---|---|---|
| N1 đơn mới (T0) | shop | **có** | `/ban-hang/don/{id}` |
| N2 đã xác nhận (T1) | buyer | không | `/cho/don/{id}` |
| N3 đang giao (T2) | buyer | có | ↑ |
| N4 đã giao (T3) | buyer | có | ↑ |
| N5 buyer đã nhận (T4) | shop | không | seller url |
| N6 buyer huỷ (T5) | shop | không | seller url |
| N7 shop/admin huỷ (T6/T7) | buyer | có (+ "Shop sẽ hoàn tiền đã chuyển." khi `needsRefund`) | ↑ |
| N8 buyer báo đã CK (P1) | shop | **có** | seller url |
| N9 shop xác nhận tiền (P2) | buyer | không | ↑ |
| N9b shop chưa thấy tiền (P3) | buyer | có | ↑ |
| N10/N11/N12 duyệt/từ chối/khoá shop | seller | **có** | `/ban-hang` |
| N13 gỡ sản phẩm | seller | không | `/ban-hang/san-pham/{id}` |

T4' (`settleOverdue`) KHÔNG gửi thông báo (hệ thống tự làm lúc đọc, không phải tin mới).

---

## 8. Trang + component

Đường dẫn theo LEAD-BRIEF §2 (+ `/cho/shop/[slug]` theo §5 #8). Tất cả trang trong `src/app/cho/**` và `src/app/ban-hang/**` là **server component vỏ** (`page.tsx` chỉ render `<PageHeader>` + client component) để prerender được và theo khuôn `app/tien/page.tsx`. Khu `/ban-hang` dùng chung app-shell mobile (dock vẫn hiện — người bán ở đại lý vẫn là người dùng SDFish); **không** thoát khung như `/quan-tri`. Hành vi từng màn (key, ma trận trạng thái, câu chữ) là của **11 §5–§7** — bảng dưới chỉ nói file, component, dữ liệu.

**Cổng đăng nhập (LEAD §5 #8, chốt)**: `/cho`, `/cho/tim`, `/cho/sp/[id]`, `/cho/shop/[slug]`, `/cho/gio` **KHÔNG** bọc `RequireLogin` — khách lạ xem được. Điểm chạm cần tài khoản dùng `LoginGate` (`components/login-gate.tsx`, đã có: `feature`, `blurb`, `accent="t3"`) **tại chỗ**: nút Đặt hàng ở giỏ · ♡ yêu thích · nút Đánh giá. `/cho/thanh-toan`, `/cho/don`, `/cho/don/[id]` bọc `RequireLogin what="đơn hàng"`; `/ban-hang/**` bọc `RequireLogin what="kênh người bán"`. Lời mời đăng nhập ẩn khi offline (tầng 5); **nút Gọi shop `tel:` KHÔNG ẩn khi offline** (LEAD §4 #10).

### 8.1 Dùng chung — `src/components/market/shared/**` (**Core** viết trong Phase 2a, trước Buyer/Seller; các agent khác chỉ import)

| File | Export | Props chính | Ghi chú |
|---|---|---|---|
| `product-card.tsx` | `MarketProductCard` | `product: ProductCard; href; fav?: boolean; onFav?` | **Gọn như Shopee (F-04, 2026-09-06)**: ảnh 1:1 (placeholder icon nhóm hàng khi không ảnh/ảnh lỗi) + badge "-N%" + ♡ đè góc ảnh (nút riêng 2.75rem — ngoại lệ có chủ đích, không lồng trong `<a>`), tên 2 dòng, `PriceText`, "Đã bán N · ★x.x", shop · tỉnh 1 dòng; kho=0 ⇒ phủ "Hết hàng"; `shopPaused` ⇒ chip "Tạm nghỉ" trên ảnh. **Chạm cả thẻ → trang món; KHÔNG còn "+ Giỏ"/"Chọn"** (prop `onAdd` đã bỏ). `ProductGrid` dùng `auto-rows-fr` để hai cột bằng nhau. Tên export có tiền tố `Market` để không trùng type `ProductCard` |
| `market-header.tsx` | `MarketHeader` | `title; fallback?="/cho"; right?` | **Đầu màn chợ gọn ≤ 6rem (F-08/F-09)** thay `PageHeader` hero ở mọi `/cho/**`: `[‹ Quay lại 3.5rem][tiêu đề]` trên gradient trục 3; Quay lại = `router.back()`, `history.length ≤ 1` ⇒ `router.push(fallback)` |
| `line-thumb.tsx` | `LineThumb` | `image?; size?=3 (rem); className?` | ảnh nhỏ của một dòng hàng (`OrderLine.image` snapshot) — thẻ đơn, chi tiết đơn, tóm tắt đặt hàng, giỏ (F-06); không ảnh/ảnh lỗi ⇒ ô xám icon giỏ |
| `price-text.tsx` | `PriceText` | `priceVnd; compareAtVnd?; size?: "sm"\|"lg"` | `formatVnd` (lib/format); giá gạch `line-through text-foreground/50` |
| `rating-stars.tsx` | `RatingStars` | `value: number; count?: number; size?; interactive?; onChange?` | 5 sao từ `StarIcon` (icons.tsx — đã có); interactive: vùng chạm mỗi sao theo thang 03 §0 |
| `order-status-chip.tsx` | `OrderStatusChip`, `PaymentStatusChip` | `status` | màu từ `ORDER_STATUS_CHIP` (style inline `backgroundColor/color` bằng `var(--…)` như `my-orders.tsx`) |
| `order-timeline.tsx` | `OrderTimeline` | `timeline: TimelineEntry[]; carrier?; trackingCode?` | dòng thời gian dọc "Đặt 09:00 → Đã xác nhận 09:40 → Đang giao (Gửi xe · mã …)"; mục thanh toán hiện xen kẽ; `by` bắt đầu `admin:` ⇒ nhãn "SDVICO" |
| `shop-badge.tsx` | `ShopBadge` | `name; province?; ratingAvg?; paused?` | dòng nhỏ dưới tên món |
| `qty-stepper.ts` | — | — | **KHÔNG tạo** — import `QtyStepper` từ `@/components/cart-sheet` |
| `image-picker.tsx` | `ImagePicker` | `value: string[]; onChange; max=6; upload: (blob) => Promise<string>` | `<input type=file accept=image/* multiple>`; nén qua `resizeForMarket(file)` (`src/lib/market/image-resize.ts`, `"use client"`: canvas cạnh dài ≤ 1024, JPEG 0.8, lặp hạ chất lượng tới ≤ 400 KB — **không** dùng `compressImage` của `doc-photos.ts` vì ngưỡng khác 1600/1.8 MB) rồi gọi `upload` từng ảnh với tiến trình; ảnh lỗi ⇒ thẻ đỏ + Thử lại ảnh đó (không chặn ảnh khác); >400 KB sau nén ⇒ "Ảnh quá lớn, chụp lại gần hơn"; hàng ảnh cuộn ngang, nút X `<CloseButton>` |
| `empty-net.tsx` | `EmptyNet` | `what: string; onRetry; savedAt?: number; extra?: ReactNode` | "Máy đang không có sóng — {what} cần mạng." + nút Thử lại (`PrimaryButton`), có `savedAt` ⇒ "Đang xem bản đã lưu {savedAgoLabel}"; `extra` cho nút "Xem đơn của tôi" (11 §5) |
| `net-chip.tsx` | `NetChip` | `state: "offline"\|"stale"\|"error"; text` | chip tầng 4 (07 §12): 1 chip/màn, tự tắt 5s/8s |
| `category-chips.tsx` | `CategoryChips` | `value; onChange` | `ChipRow` **level 1** accent `t3` (3.5rem — F-21), "Tất cả" + 9 danh mục đúng thứ tự `PRODUCT_CATEGORIES` |
| `address-form.tsx` | `AddressForm` | `value: Address; onChange; error?; homeProvince?` | `Field` + `inputClass`; toggle "Giao ra cảng" (isPort) đổi nhãn ô detail; tỉnh = **`<select>` nền tảng** từ `COASTAL_PROVINCES`, `homeProvince` đứng đầu (F-11); `error` (câu từ `validateAddress`) đặt **ngay dưới ô sai** (`addressErrorField` ở `validate.ts`) + focus/scroll tới ô |
| `src/lib/market/client.ts` (`"use client"`) | `marketGet<T>(path, timeoutMs=12000)`, `marketPost<T>(path, body, timeoutMs=20000)`, `marketUpload(path, blob, timeoutMs=60000)` | — | bọc `authedFetch` + parse `{ok,…}` ⇒ `{ ok:true, data } \| { ok:false, code, message, status, offline: boolean }`; `offline = res===null`. Mọi màn dùng đúng 3 hàm này — không `fetch` trần |
| `src/lib/market/use-online.ts` (`"use client"`) | `useOnlineRefetch(fn)` | — | nghe `online` ⇒ gọi `fn` (11 §9 "có sóng lại tự tải") |

### 8.2 Người mua — `src/app/cho/**` + `src/components/market/buyer/**` (Buyer agent)

| Route | page.tsx render | Client component | Dữ liệu + nhánh bắt buộc trong code (chi tiết câu chữ: 11 §5.x) |
|---|---|---|---|
| `/cho` | `PageHeader` "Chợ vật tư" + `<MarketHome/>` | `buyer/market-home.tsx` | ô tìm (→ `/cho/tim?q=`), `CategoryChips` (→ `/cho/tim?category=`), nút Giỏ (badge `marketCartCount`) + nút Đơn hàng (badge đơn chưa kết thúc từ cache); thẻ "Đơn đang tới" (từ `loadCachedMarketOrders`, 1 thẻ); "Mua lại" (≤6 món từ đơn `hoan_thanh` trong cache — không gọi API); **"Gần bà con — {tỉnh}"** khi `loadHome().province` có (`GET san-pham?province=&sort=moi`, 10 món) đặt TRÊN "Món mới lên chợ" (`sort=moi`, 20 món) — LEAD §4 #11; Yêu thích (snapshot local). Nhánh: skeleton 6 thẻ / lỗi + Thử lại / offline `EmptyNet extra="Xem đơn của tôi"` (Giỏ + Đơn vẫn bấm) / rỗng "Chợ chưa có món nào. SDVICO đang mời các đại lý lên sàn." |
| `/cho/tim` | `<MarketSearch/>` | `buyer/market-search.tsx` | đọc `?q&category&province` sau mount (không Suspense — khuôn `Tabs paramKey`), lưới `MarketProductCard`, phân trang "Xem thêm" + "Đang xem 40/500", sheet Sắp xếp 4 kiểu, **chip "Gần tôi"** (bật = `province=loadHome().province`; không có tỉnh cảng nhà ⇒ chip ẩn); rỗng "Không thấy món nào cho '{q}'…"; lỗi trang 2 giữ kết quả cũ; offline giữ kết quả + `NetChip` |
| `/cho/sp/[id]` | `<ProductDetail id/>` | `buyer/product-detail.tsx` | ảnh cuộn ngang, `PriceText`, biến thể (chip, bắt buộc chọn ⇒ "Chọn loại"), `QtyStepper` (clamp tồn + "Chỉ còn M"), "Thêm vào giỏ" (nút chính duy nhất — full-width `PrimaryButton`; **KHÔNG có "Mua ngay"** — 11 Assumptions), ♡ (LoginGate nếu chưa đăng nhập), `ShopBadge` → `/cho/shop/[slug]`, `CallButton` (`tel:` shop.phone, KHÔNG ẩn offline), "Đã bán N", "Còn M {unit}" khi ≤20, mô tả thu gọn, đánh giá 3–5 mới nhất + "Xem tất cả" (`BottomSheet` phân trang); hết hàng ⇒ nút disabled "Hết hàng"; `shop.status≠hoat_dong` ⇒ "Shop này đang tạm đóng." + ẩn nút; `shop.paused` ⇒ `StatusBanner warn` "Shop đang tạm nghỉ, mở lại sau" + nút vô hiệu; 404 ⇒ "Món này không còn trên chợ." + Về chợ; **offline**: nhận `initial` từ `sessionStorage` bản thẻ của danh sách vừa xem (Buyer tự truyền qua `history.state`/`sessionStorage`, không thêm khoá `forfish.*`) ⇒ hiện tên/giá/ảnh + "giá lúc HH:MM"; không có ⇒ `EmptyNet`; Thêm vào giỏ vẫn chạy (local) |
| `/cho/shop/[slug]` | `<ShopPage slug/>` | `buyer/shop-page.tsx` | đầu trang shop (logo, tên, tỉnh + địa chỉ, sao (N), "Giao: …", `CallButton`, giới thiệu thu gọn, băng "Shop đang tạm nghỉ" khi `paused`), chip nhóm hàng của shop, lưới sản phẩm 20/trang; 403 `shop_not_active` ⇒ "Shop này đang tạm đóng."; 0 món ⇒ "Shop chưa đăng món nào." |
| `/cho/gio` | `<MarketCart/>` | `buyer/market-cart.tsx` | `loadMarketCart(phone)` → `POST gio/tinh` → `saveMarketQuote`; nhóm theo shop, `QtyStepper` (+ vượt tồn ⇒ clamp + "Chỉ còn M"), dòng "Giá vừa đổi: a → b" khi khác quote cũ, dropped ⇒ thẻ mờ + `DROP_LABEL` + SQ_BTN Bỏ (không tính tổng), "Bỏ" 1 món không ConfirmDialog (có "Hoàn lại" 5s), "Bỏ hết" ConfirmDialog; thanh ghim đáy "N món · Tổng tạm" + SQ_BTN "Đặt hàng" (chưa đăng nhập ⇒ `LoginGate`; shop nào >20 dòng ⇒ vô hiệu + "Mỗi đơn tối đa 20 món…"; offline ⇒ vô hiệu + "Đặt hàng cần có sóng. Giỏ vẫn giữ nguyên."); giỏ trống `EmptyState` + Đi chợ; **offline** ⇒ hiện từ `loadMarketQuote` + "giá lúc HH:MM"; chưa từng tra ⇒ số dòng + "Chưa tải được giá — máy không có sóng"; `saveMarketCart` false ⇒ băng đỏ máy hết chỗ, badge không tăng |
| `/cho/thanh-toan` | `<Checkout/>` | `buyer/checkout.tsx` | chỉ mang dòng mua được từ quote; (1) địa chỉ: dòng đọc-được + SQ_BTN "Đổi" (sheet `addresses.ts`; chưa có ⇒ sheet mở sẵn với `seedAddress`, nút Đặt vô hiệu); (2) cách trả: 2 chip, chip Chuyển khoản **ẩn** khi `shopsForcingCod` ≠ [] + dòng "Shop X chỉ nhận tiền mặt" (ép COD cả lần đặt); (3) thẻ mỗi shop + ô "Ghi chú cho shop" (SQ_BTN); (4) "Sẽ tạo N đơn cho N shop · Tổng"; (5) "Đặt hàng" full-width + "Không trả tiền trong app…". Gửi `POST don` với `clientRef = marketOrderClientRef(...)` + `expectedTotalVnd` từng shop; state `sending` chặn bấm đúp; kết quả từng shop inline: ok ⇒ thẻ mã · shop · tổng · cách trả (+ khối STK từ `order.bankSnapshot` + nội dung CK = mã + nút "Sao chép"), `duplicate` = ok; `line_unavailable` ⇒ "Shop X chỉ còn M…" + qty giỏ hạ về `available`; `price_changed` ⇒ "Giá vừa đổi ở shop X — tổng mới …đ. Xem lại rồi bấm Đặt hàng lần nữa." (cập nhật expected, KHÔNG tự đặt lại); `shop_not_active`/`shop_paused` ⇒ "Shop X vừa tạm đóng/tạm nghỉ"; **`removeShopLines` chỉ cho shop ok**; timeout/offline khi gửi ⇒ câu 11 §5.6 (giỏ giữ nguyên) |
| `/cho/don` | `<MyMarketOrders/>` | `buyer/my-market-orders.tsx` | chip: Đang xử lý (`cho_xac_nhan`+`da_xac_nhan`+`dang_giao`) · Chờ nhận (`da_giao`) · Xong · Đã huỷ; thẻ đơn (mã, shop, tóm tắt "Dầu DO ×2, Đá cây ×10", tổng, `OrderStatusChip`, mốc) + ô hành động SQ_BTN theo trạng thái (Huỷ / Đã nhận / Đã CK); `isPendingTooLong` ⇒ dòng "Shop chưa xác nhận sau 2 ngày"; online ok ⇒ `saveCachedMarketOrders`; **offline** ⇒ `loadCachedMarketOrders` + `EmptyNet savedAt` (nút ghi vô hiệu + "việc này cần có sóng"); `useOnlineRefetch`; >50 ⇒ Xem thêm |
| `/cho/don/[id]` | `<MarketOrderDetail id/>` | `buyer/market-order-detail.tsx` | mã đơn to (chọn-sao-chép), chip, `OrderTimeline`, dòng hàng, tiền hàng + phí giao + Tổng, Nhận tại, Trả tiền (COD / CK: `bankSnapshot` + nội dung + `PaymentStatusChip`), ghi chú 2 chiều, hàng shop + `CallButton`; hành động theo `canTransitionOrder(…,"buyer")`/`canTransitionPayment`: Huỷ (ConfirmDialog + chip lý do tuỳ chọn) · Tôi đã chuyển khoản · Đã nhận hàng (nút chính) → "Cảm ơn bà con. Đánh giá món hàng?" · Đánh giá (`BottomSheet` `RatingStars` + textarea 500); `needsRefund` ⇒ khối "Shop cần hoàn tiền cho bà con"; P3 ⇒ khối vàng "Shop chưa thấy tiền: {lý do}"; 404 ⇒ "Không tìm thấy đơn này."; **offline** ⇒ tìm trong cache đơn |

### 8.3 Người bán — `src/app/ban-hang/**` + `src/components/market/seller/**` (Seller agent)

| Route | Client component | Nội dung + trạng thái (chi tiết: 11 §6) |
|---|---|---|
| `/ban-hang` | `seller/seller-home.tsx` | `GET shop` (+ `saveShopFlag`): null ⇒ thẻ "Mở gian hàng trên SDFish" + nút → `/ban-hang/dang-ky`; `cho_duyet` ⇒ `StatusBanner neutral` "Đang chờ SDVICO duyệt (1–2 ngày)" + nút Thêm sản phẩm + Sửa đăng ký + Gọi SDVICO; `tu_choi` ⇒ băng danger + `statusNote` + Sửa đăng ký; `tam_khoa` ⇒ băng danger + `statusNote` + Gọi SDVICO (`SDVICO_HOTLINE`) — vẫn vào Đơn hàng; `hoat_dong` ⇒ 3 ô cần làm ngay (`pendingOrders` · `shippingOrders` · `awaitingPaymentConfirm` → `/ban-hang/don?tab=`), chip Hôm nay/7 ngày/30 ngày (`GET thong-ke?range=`) → "Đơn: a · Hoàn thành: b · Doanh thu: …đ (tính theo đơn hoàn thành)", "Bán chạy" top 5, 4 lối (Sản phẩm · Đơn hàng · Cài đặt · Xem shop trên chợ → `/cho/shop/[slug]`); `paused` ⇒ băng warn "Shop đang tạm nghỉ — bà con không đặt được" + nút Mở bán lại. Offline: "Kênh người bán cần có sóng." (không cache) |
| `/ban-hang/dang-ky` | `seller/shop-register.tsx` | form `ShopDraft` (tên, SĐT liên hệ điền sẵn, tỉnh chip, địa chỉ, giới thiệu, logo `ImagePicker max=1`, Phí giao `MoneyField`, Miễn phí giao từ, STK thu gọn sau SQ_BTN "Thêm STK" + dòng "Không có STK thì shop chỉ nhận tiền mặt") → `POST shop`; lỗi validate dưới ô, cuộn tới ô lỗi đầu; 409 `slug_taken` ⇒ lỗi dưới ô tên; 409 `invalid` da_co_shop ⇒ chuyển `/ban-hang`; `tu_choi` ⇒ form điền sẵn + băng "Lần trước bị từ chối: {lý do}"; offline ⇒ nút vô hiệu + "Đăng ký cần có sóng"; timeout ⇒ giữ form |
| `/ban-hang/san-pham` | `seller/product-list.tsx` | chip Đang bán · Đã ẩn · Hết hàng · Bị gỡ (`adminHidden`), tìm theo tên, thẻ (ảnh, tên, giá, kho, đã bán) + SQ_BTN Sửa + SQ_BTN "Hết hàng" (đặt tồn 0, "Hoàn lại" 5s); `adminHidden` ⇒ băng đỏ "SDVICO đã gỡ: {lý do}" + Gọi SDVICO; hàng tiêu đề SQ_BTN "Thêm" → `/ban-hang/san-pham/moi`; 0 món `EmptyState`; 500 món ⇒ 20/trang |
| `/ban-hang/san-pham/[id]` (`moi` = tạo) | `seller/product-form.tsx` | key: ảnh (≤6) · tên · nhóm (`ChipRow` level 2 cuộn) · giá (`MoneyField`) · tồn (`QtyStepper` + ô số) · đơn vị; thu gọn: giá gạch · biến thể (công tắc "Món có nhiều loại/cỡ" → danh sách [nhãn · giá tuỳ chọn], **2..10**, kho vẫn chung — nói rõ 1 dòng) · mô tả · Ẩn/Hiện; Lưu full-width (→ danh sách, "Đã lưu {tên}" 5s); Xoá (ConfirmDialog "Xoá {tên}? Đơn cũ vẫn giữ tên và giá lúc đặt." → DELETE xoá mềm); `adminHidden` ⇒ nút Hiện vô hiệu; lưu offline ⇒ "Chưa lưu được — cần sóng. Nội dung vẫn ở trên màn." |
| `/ban-hang/don` | `seller/shop-orders.tsx` | tab 6 trạng thái + badge (từ `stats.byStatus`), thẻ đơn (mã · người nhận · tỉnh/cảng · tóm tắt · tổng · cách trả + "Báo đã CK" vàng · tuổi đơn); `isPendingTooLong` ⇒ băng vàng; không cache |
| `/ban-hang/don/[id]` | `seller/shop-order-detail.tsx` | như buyer detail + SĐT người nhận + `CallButton` "Gọi người mua" + ô `sellerNote` (SQ_BTN Lưu) + hàng hành động theo `TRANSITIONS.seller`: Xác nhận đơn (nút chính) · Huỷ (sheet lý do bắt buộc, chip gợi ý) · Giao hàng (sheet: chip cách giao "Tự giao/Gửi xe/Gửi ra cảng" + nhà xe + mã vận đơn — tuỳ chọn, gửi cùng `status:"dang_giao"`) · Đã giao xong · `da_giao` ⇒ dòng "Chờ người mua bấm Đã nhận (tự hoàn thành sau 7 ngày)"; `bao_da_chuyen` ⇒ hàng vàng + SQ_BTN "Đã nhận tiền" · "Chưa thấy" (lý do); `needsRefund` ⇒ băng đỏ "Cần hoàn {tổng}đ cho người mua {SĐT}"; 409 ⇒ "Đơn đã sang bước khác rồi — tải lại" + tự tải |
| `/ban-hang/cai-dat` | `seller/shop-settings.tsx` | `PATCH shop` (cùng form đăng ký, prefilled) + công tắc **"Tạm nghỉ bán"** (`paused`, LEAD §4 #8) + xoá STK ⇒ "Shop sẽ chỉ nhận tiền mặt"; không có nút xoá shop |

Lối vào ở `hero-account.tsx` (§9). Seller agent cũng thêm `clearMarketCart/clearCachedMarketOrders/clearShopFlag` vào đường đăng xuất/xoá dữ liệu ở file đó.

### 8.4 Admin — `src/components/admin/market-admin-tab.tsx` (Admin+Docs agent)

Client component, props `{ me: Me }`; 5 mục con bằng chip (khuôn tab `/quan-tri`): **Tổng quan** (`tong-quan` — KPI 11 §7) · **Gian hàng** (danh sách theo status mặc định `cho_duyet`, thẻ [tên · SĐT chủ · tỉnh · ngày · số món]; chi tiết: Duyệt / Từ chối (dialog lý do) / Tạm khoá (dialog lý do) / Mở lại / **Gán chủ shop** (ô SĐT, `sanitizePhoneInput` + `isValidVnPhone`)) · **Đơn hàng** (lọc status/shop/SĐT/mã; chi tiết = PATCH như seller, actor admin — xử lý thay shop; Huỷ với lý do) · **Sản phẩm** (lọc shop + tìm; Gỡ (dialog lý do) / Trả lại; trong chi tiết món: danh sách đánh giá kể cả ẩn + nút Ẩn/Hiện) · **Đánh giá** (gộp vào chi tiết món — không tab riêng). Mọi hành động ghi đều qua `ConfirmDialog` (11 §7: không có hành động 1 chạm). Gọi API bằng `fetch(apiUrl(path), { headers: tokenHeader() })` + `timeoutSignal(12000)` như phần còn lại của `page.tsx`. Nối vào `page.tsx`: xem §9.

---

## 9. Lối vào (chỉ chèn đúng chỗ + copy)

| File (owner) | Chỗ | Chèn |
|---|---|---|
| `src/components/trade-hub.tsx` (Buyer) | **trên** `ChipRow` (đầu `<div>`), cùng khổ với thẻ `surface` | `<Link href="/cho" className="mx-4 mb-4 flex min-h-[3.5rem] items-center gap-3 px-4 surface">` icon `BasketIcon` + `<span className="text-[1.125rem] font-bold text-navy">Chợ vật tư tàu cá</span>` + dòng phụ `text-[1rem] text-foreground/65` "Máy, ngư cụ, dầu nhớt, đá… nhiều đại lý, giao ra cảng" + `ChevronRightIcon` — KHÔNG thêm chip mới vào `SECTIONS` (3 chip là đủ, 03 "nhãn ngang hàng") |
| `src/components/boat-products.tsx` (Buyer) | ~~trong mục `sdvico`, trên `<SdvicoCatalog>`~~ → **THAY HẲN 2026-09-07** ([ADR 0014](../adr/0014-gop-cua-hang-vao-cho.md)) | **ĐÃ GỘP** — không còn chip `SECTIONS` nào: tab Sản phẩm chỉ còn đồ đang dùng trên tàu. Đúng chỗ hai chip "Cửa hàng" · "Đơn của tôi" cũ đứng nay là MỘT thẻ `surface` hai hàng, ngăn bằng `border-t`: (1) `BasketIcon` "Mua đồ cho tàu — Chợ vật tư" / "Máy, ngư cụ, đá cây, dầu nhớt… SDVICO và nhiều đại lý, giao ra cảng" → `/cho`; (2) `ClockIcon` "Đơn hàng của tôi" / "Coi đơn đã đặt, tới đâu rồi" → `/cho/don`. `SdvicoCatalog`/`MyOrders` **hết được dựng** (file giữ lại, có `// nợ:` ghi trần) |
| `src/components/hero-account.tsx` (Seller) | **ngay dưới khối danh tính/hạng, TRÊN hàng "Cài đặt khác" thu gọn** (sửa 2026-09-06: trước nằm TRONG nhóm thu gọn nên phải bấm "Mở" mới thấy — lối vào một trục việc, không phải một tuỳ chọn cài đặt), cùng class | **Hai dạng dòng (LEAD §4 #16)**, quyết định bởi `loadShopFlag(phone)` (cập nhật khi sheet mở + có sóng qua `GET /api/ban-hang/shop`, 12 s, `.catch`): (a) `hasShop` ⇒ `<Link href="/ban-hang">` "Kênh người bán" + dòng phụ "Đăng sản phẩm, xử lý đơn, thống kê" + `ChevronRightIcon` (thêm "· đang chờ duyệt" khi `status=cho_duyet`); (b) `hasShop=false` ⇒ dòng **mờ** (`text-foreground/65`, không icon nổi) "Bà con có bán vật tư? Đăng ký shop" → `/ban-hang/dang-ky` — không đếm là nudge tầng 5; (c) chưa có cờ + offline ⇒ ẩn cả hai. Cùng file: đăng xuất/xoá dữ liệu gọi thêm `clearMarketCart(phone)`, `clearCachedMarketOrders()`, `clearShopFlag()` |
| `src/app/quan-tri/page.tsx` (Admin+Docs) | (1) union `type Tab` thêm `\| "cho-vat-tu"`; (2) mảng `tabs` admin thêm `["cho-vat-tu", "Chợ vật tư"]` sau `["don-hang", "Đơn hàng"]`; (3) sau dòng `{activeTab === "don-hang" && …}` thêm `{activeTab === "cho-vat-tu" && isAdmin && <MarketAdminTab me={me} />}`; (4) import `MarketAdminTab` | **3 dòng + 1 import** (LEAD §5 #1 đã OK). Nhãn 2 chữ "Chợ vật tư" khớp luật 03 |
| `src/lib/admin-activity.ts` (Admin+Docs — LEAD §5 #2) | `ADMIN_ACTIONS` + `ACTION_LABEL` | 5 mã `market.*` (§7.3) + nhãn tiếng Việt; `isDangerAction` thêm `market.shop-status` khi status ∈ tu_choi/tam_khoa? — KHÔNG: giữ hàm như cũ, nhãn đủ |
| `docs/app-map/07-design-spec.md` §12 (Admin+Docs) | bảng "Luật chung" dòng "Đơn hàng" | thêm 1 dòng "Chợ vật tư (2026-09-06): ngoại lệ push OS cho actor NGƯỜI BÁN — N1/N8/N10–N12 (LEAD §4 #4); người mua giữ luật cũ" |

---

## 10. Kế hoạch build theo pha + FILE OWNERSHIP CUỐI CÙNG

### 10.1 Ownership (rời nhau — invariant 05-agents-team; đã gộp LEAD §3 + §5 #2/#3)

| Agent | OWN (chỉ agent này được ghi) | Ghi chú |
|---|---|---|
| **Core** (Phase 2a, chạy TRƯỚC) | `src/lib/market/**` (mọi file §3–§4 + `store.ts`, `route-utils.ts`, `shop-auth.ts`, `notify.ts`, `image-resize.ts`, `client.ts`, `use-online.ts`, `file-store.ts`, `dev-seed.ts`, `supabase-store.ts`) · `src/lib/__tests__/market-*.test.ts` · `supabase/migrations/0060_marketplace.sql` · `src/lib/api-identity.ts` + `src/lib/admin-auth.ts` (CHỈ nhánh dev §6) · `src/app/api/dev/**` · `src/app/dev/**` · `.gitignore` (`/.local/` — đã có) · **`src/lib/offline-backup.ts`** (5 prefix) · **`src/lib/catalog-orders.ts`** (CHỈ khối FNV → import `fnv1a64Hex`) · **`src/components/icons.tsx`** (icon danh mục thiếu) · `src/components/market/shared/**` · `docs/app-map/04-data-model.md` mục 0060 (cùng commit migration — hook chặn lệch) | LEAD §5 #2 cấp 3 file chung cho Core. 04 phải đi cùng migration nên Core ghi mục 0060, KHÔNG phải Admin+Docs |
| **Buyer** (2b) | `src/app/cho/**` · `src/app/api/cho/**` · `src/components/market/buyer/**` · `src/components/trade-hub.tsx` (1 thẻ) · **`src/components/boat-products.tsx`** (1 thẻ trong mục `sdvico` — LEAD §5 #3, KHÔNG `tau-tabs.tsx`) | |
| **Seller** (2b) | `src/app/ban-hang/**` · `src/app/api/ban-hang/**` · `src/components/market/seller/**` · `src/components/hero-account.tsx` (2 dạng dòng §9 + 3 lệnh clear) | |
| **Admin+Docs** (2b) | `src/components/admin/market-admin-tab.tsx` · `src/app/api/admin/cho/**` · `src/app/quan-tri/page.tsx` (3 điểm + import) · **`src/lib/admin-activity.ts`** (5 mã `market.*`) · `docs/app-map/01-product.md` · `02-architecture.md` · `03-design-system.md` · `07-design-spec.md` (screen map + ma trận + §12 dòng push) · `docs/app-map/ops/state-registry.md` (5 khoá) · `docs/adr/README.md` | |
| **QA** (3) | `tests/e2e/san/**` · `playwright.san.config.ts` · `docs/test-cases/san-thuong-mai-*.md` | thêm ca "ảnh sản phẩm hiện trên PWA" (LEAD §5 #10) |
| **Lead** (2c/4) | merge, doc-health, apply 0060 khi chủ dự án ra lệnh | |

Thứ tự: **Core xong + `npm test` xanh → 3 agent 2b chạy SONG SONG trên 3 nhánh**, mỗi nhánh chỉ chạm tập file của mình; cần đổi hợp đồng `lib/market/**` ⇒ báo lead, KHÔNG tự sửa.

### 10.2 Pha

| Pha | Ai | Việc | "Xong" khi | Lệnh kiểm |
|---|---|---|---|---|
| **2a Core-lõi** (chạy TRƯỚC, ~1 ngày) | Core | toàn bộ tập file ở 10.1 | `npm test` xanh (≥ 13 file test mới: order-state · pricing · validate · order-ref · order-code · text · cart · addresses · favorites · orders-cache · seller-flag · dev-mode · dev-seed · store-contract · identity-dev · notice); `npm run typecheck`; `MARKET_STORE=file npm run dev` → `/dev` đăng nhập được persona, `curl -H "x-sdfish-token: <t>" localhost:3000/api/cho/san-pham` trả 22 món (24 − 1 `an` − 1 `deleted`… đúng số seed, KHÔNG có `adminHidden`/`deleted`), `GET /api/cho/don` của Anh Ba thấy đơn 9 ngày đã `hoan_thanh`; `identityFromRequest` không chạm store khi env prod (test); cổng `offline-backup.test.ts`, `server-client-boundary.test.ts`, `no-bare-abort-timeout.test.ts` xanh | `npm test` · `npm run typecheck` · `npm run lint` · `MARKET_STORE=file npm run dev` |
| **2b Buyer ∥ Seller ∥ Admin** (song song sau 2a, ~2 ngày) | Buyer / Seller / Admin+Docs | route + trang + component theo §7–§9; docs theo 10.1 | mỗi agent: `npm run typecheck` + `npm run lint` xanh; chạy tay vòng lõi ở file mode: Buyer — khách lạ xem `/cho` → tìm → xem → giỏ 2 shop (SDVICO không STK ⇒ chip CK ẩn) → LoginGate → đặt → 2 đơn `cho_xac_nhan` → huỷ 1 → bản lưu đơn hiện khi tắt mạng (DevTools offline); Seller — persona `0901000003` đăng ký shop → chờ duyệt (thêm món trước) → (admin duyệt) → món hiện → nhận đơn → xác nhận → giao → buyer đã nhận → đánh giá → sao đổi; tạm nghỉ ⇒ buyer không đặt được; Admin — duyệt/từ chối/khoá/gán chủ shop SDVICO/xử lý đơn thay shop (timeline `admin:…`)/gỡ món/ẩn đánh giá; mỗi trang có 4 nhánh trống/đang tải/lỗi/offline **trong code** (hook 1f-c) | như trên + `npm run build` (xanh dù không có `SUPABASE_SERVICE_ROLE_KEY`) |
| **2c Ghép** (lead, ½ ngày) | Lead | merge 3 nhánh, chạy toàn bộ, đối chiếu doc-sync (02 §2 bảng route, 03 chip, 07 screen map/ma trận/§12, 04 0060, state-registry 5 khoá, ADR index 0008) | `sh .githooks/pre-commit --self-test`; `sh scripts/doc-health-report.sh` không SUSPECT mới; `npm run build` | — |
| **3 QA** | QA | `tests/e2e/san/**` Playwright ở file mode + `docs/test-cases/san-thuong-mai-*.md` theo AC 11 §11 | 14 ca vòng lõi + 8 ca lỗi (hết hàng lúc đặt, giá đổi, huỷ trùng, mất mạng lúc đặt, ảnh > 400 KB, shop bị khoá giữa chừng, shop tạm nghỉ, huỷ CK ⇒ needsRefund) | `npx playwright test -c playwright.san.config.ts` |
| **4 Apply prod** (chủ dự án ra lệnh) | Lead | apply 0060 qua Supabase MCP/dashboard; kiểm `get_advisors`; gán chủ shop SDVICO ở `/quan-tri`; tạo 1 đơn thử | 4 bảng + 5 hàm + bucket có; RLS bật 0 policy; anon không còn grant | truy vấn read-only theo khuôn 04 §0052 |

Commit message mỗi pha ghi câu trả lời offline (CLAUDE.md pre-flight 🟡): *"Thêm request mạng lúc mở `/cho` (có timeout 12 s, `.catch`, màn EmptyNet); sheet Tài khoản gọi `/api/ban-hang/shop` chỉ khi mở sheet + có sóng; không đụng `sw.js`/SHELL/cache; không đè dữ liệu bà con; `/cho/don`, `/cho/gio` có nhánh bản lưu."*

---

## 11. Phản biện khung lead — ĐÃ CHỐT (LEAD-BRIEF §5, 2026-09-06)

| # | Vấn đề | Đề xuất | Chốt của lead → chỗ ghi |
|---|---|---|---|
| 1 | "Nối 1 dòng vào `quan-tri/page.tsx`" — thực tế cần **3 dòng + 1 import** | Ghi rõ 3 điểm chèn (§9) | OK → §9 |
| 2 | Partition thiếu 3 file Core bắt buộc chạm (`offline-backup.ts`, `catalog-orders.ts` khối FNV, `icons.tsx`); Admin chạm `admin-activity.ts` | Cấp cho Core / Admin | OK → §10.1 |
| 3 | Chip "Cửa hàng" ở `boat-products.tsx`, không phải `tau-tabs.tsx` | Đổi own của Buyer | OK → §9, §10.1 |
| 4 | Chuỗi dev phải đúng khuôn `sdf_`+43 (`isValidTokenShape`) | Bắt buộc `newDeviceToken()` | OK → §5.2, §6.1 |
| 5 | Tồn kho theo sản phẩm, không theo biến thể | v1 kho chung; nợ có trần | OK → §2 comment, §12 |
| 6 | Cron tự hoàn thành 1 lần/ngày vào `vercel.json` được | Phase 3 nếu còn thời gian | **KHÔNG làm** — dùng `settleOverdue` lười khi đọc (BA #3) → §4.1, §7 ⏱ |
| 7 | Admin-only ⇒ manager không duyệt shop được | ghi nợ `MANAGER_TABS` | OK admin-only, nợ → §12 |
| 8 | Người chưa có tài khoản có được XEM chợ? | xem được, gate tại điểm chạm | **Xem được** `/cho`, `/cho/tim`, `/cho/sp`, `/cho/shop` + giỏ; đặt/đơn/đánh giá/bán cần đăng nhập → §8 đầu mục |
| 9 | Thiếu lọc tỉnh / gần tôi | `?province` + chip "Gần tôi" | OK (khớp BA #11) → §3.1 ProductQuery, §8.2 |
| 10 | SW không chặn ảnh cross-origin | QA thêm ca ảnh trên PWA | OK → §10.2 |
| — | **Vòng 2 kênh người bán + quản trị (2026-09-07)** | — | Đường API đổi: `GET /api/ban-hang/don` nhận thêm **`ma`** (mã đơn) + **`sdt`** (SĐT người mua) và trả `total` để màn dựng "Xem thêm"; `GET /api/admin/cho/danh-gia` **bỏ bắt buộc `productId`** (trống = cả sàn) + nhận **`sao`** (lấy đánh giá ≤ n sao); `GET /api/admin/cho/san-pham` nhận **`status`** (`dang_ban`/`an`/`het_hang`/`bi_go`). Kho: `listProductReviews(productId, q)` → **`listReviews(q)`** một hàm; `OrderListQuery` thêm `code`/`buyerPhone` áp trong hàm dùng chung của cả hai adapter; `listProducts` áp `status` khi `includeHidden` (bản Supabase trước đây quên, file-store vốn đã có) |
| 11 | Hai cửa hàng song song | chỉ đổi lối vào, gộp = ADR sau | OK → §9 · **ĐÃ TRẢ NỢ 2026-09-07: [ADR 0014](../adr/0014-gop-cua-hang-vao-cho.md) + migration 0061 — gộp về MỘT chợ, SDVICO là một gian hàng; sinh thêm bậc sản phẩm "Liên hệ báo giá" (`price_vnd` null)** |
| 12 | `notifyAccount` cần SupabaseClient | `notifyMarket` adapter mỏng | OK → §7.4 |
| A2 | Chủ shop SDVICO prod | sentinel + admin gán; file-store persona có shop | OK → §2 seed, §5.3 |
| A4 | Mua của chính shop mình | không chặn v1 | OK → Assumptions #4 (11 bỏ R4) |

---

## 12. Nợ kỹ thuật có trần (ghi cùng marker trong code — `// nợ: <trần>, <điều kiện nâng cấp>`)

| Nợ | Trần | Điều kiện nâng cấp |
|---|---|---|
| Kho chung theo sản phẩm (biến thể chỉ nhãn + giá) | shop bán biến thể cùng kho | shop bán ≥ 3 cỡ có kho khác nhau ⇒ `variants[].stock` + RPC cập nhật jsonb có khoá |
| ~~`transitionOrder` supabase: timeline đọc-rồi-ghi (2 câu)~~ | **ĐÃ TRẢ 2026-10-19** (0064 `market_transition_order`, append tại DB) | — |
| Tự hoàn thành LƯỜI khi đọc (`settleOverdue`), không cron | đơn `da_giao` quá hạn chỉ chuyển khi CÓ AI đọc; thống kê 30 ngày quét ≤ 200 đơn/lượt | > 200 đơn `da_giao` quá hạn cùng lúc ⇒ cron ngày 1 lần (ADR 0006 cho phép) |
| Hoàn kho không kiểm trần (seller tăng tồn tay rồi đơn huỷ ⇒ cộng thêm) | sai lệch nhỏ, seller sửa tay | seller phàn nàn ⇒ ghi "kho lúc đặt" vào đơn để hoàn có trần |
| Nhiều SĐT / shop (nhân viên trực đơn) | 1 SĐT chủ + admin xử lý thay | ≥ 1 shop có 2 người trực ⇒ bảng `shop_staff` |
| Dọn ảnh mồ côi (xoá mềm giữ ảnh) | Storage phình | > 1 GB bucket ⇒ job dọn ảnh không còn tham chiếu > 90 ngày |
| Review chỉ text, không ảnh, không trả lời của shop | — | shop yêu cầu |
| Tìm kiếm `ilike` (không rank) | vài nghìn sản phẩm | > 5.000 sản phẩm ⇒ `ts_rank`/`similarity` |
| Admin-only (không manager) | — | có manager cần duyệt shop ⇒ `cho-vat-tu` vào `MANAGER_TABS` |
| Không mã giảm giá/voucher | chỉ giá gạch | chủ dự án yêu cầu |
| Đơn `cho_xac_nhan` > 48h không tự huỷ, chỉ nhắc | — | ≥ 10 đơn treo/tháng ⇒ tự huỷ + N14 |
| Chọn cách trả tiền chung cả lần đặt (ép COD khi có shop không STK) | — | bà con phàn nàn ⇒ chọn theo từng shop |

---

## 13. Luồng giống Shopee — hẹn giao, tự huỷ 72 giờ, yêu cầu đặt hàng (2026-10-18)

Hành vi ở [11 §4.3–§4.4, §5.9, §7b](11-ba-spec-san-thuong-mai.md); đây là TÊN.

| Lớp | Thêm |
|---|---|
| `types.ts` | `Order.etaFrom?/etaTo?/requestId?` · `RequestStatus` (`moi`·`da_bao_gia`·`da_dat`·`khong_tim_duoc`·`da_huy`·`het_han`) · `RequestQuote {goodsVnd, shippingVnd, etaFrom, etaTo, note?, quotedAt, expiresAt}` · `MarketRequest` (+ `quoteShopId/quoteShopName/orderId/timeline`) · `RequestDraft` |
| `order-state.ts` | `cho_xac_nhan.system: ["da_huy"]` · `AUTO_CANCEL_MS` 72h · `AUTO_CANCEL_REASON` · `settlePending` (gọi từ `settleOverdue`) · `msUntilAutoCancel` |
| `eta.ts` (mới, thuần) | `ETA_PRESETS` · `presetRange` · `validateEta` · `readEta(body)` (preset hoặc from/to) · `etaLabel` · `isLate` · `vnToday` · `ETA_MAX_DAYS` 60 |
| `request-state.ts` (mới, thuần) | bảng chuyển theo actor · `applyQuote/applyReject/applyBuyerCancel/applyAccept` · `settleRequest` (3 ngày / 7 ngày) · `requestToOrder` → `PreparedRequestOrder` · `patchRequest` · `quoteTotal` · nhãn + chip token |
| `validate.ts` | `validateRequestDraft` · `validateQuote` · `REQUEST_IMAGE_MAX` 3 · `REQUEST_QTY_MAX` 9999 · `SHIPPING_MAX` |
| `order-code.ts` | `makeRequestCode` = "YC" + khuôn mã đơn |
| `notice.ts` | `requestNotice("Y1"|"Y2")` · N2 đọc hẹn giao (`ctx.today`) |
| `store.ts` (hợp đồng) | `listOverduePending(before, shopId?)` · `createRequest` · `listBuyerRequests` · `listAllRequests` · `getRequest` · `patchRequest(id, expectStatus, patch)` (ghi có điều kiện như `transitionOrder`) · `acceptRequest(id, patch, PreparedRequestOrder)` → `{request, order}` |
| `supabase-store.ts` | `rowToRequest` · `eta_from/eta_to/request_id` trong `rowToOrder` + `transitionOrder` · `acceptRequest`: GIỮ yêu cầu (`da_bao_gia → da_dat`, có điều kiện) RỒI insert đơn (`client_ref = yc:<id>`, trùng ⇒ trả đơn cũ), hỏng ⇒ trả yêu cầu về `da_bao_gia` + `insert_failed` |
| `file-store.ts` | `DevSeed.requests?` (tệp cũ thiếu ⇒ `[]`) · cùng 6 hàm, một `mutate` cho cả "sinh đơn + vá yêu cầu" |
| `route-utils.ts` | `settleOverdueOrders` ghi theo `o.status` (không còn gài `da_giao`) + N7 khi tự huỷ · `settleOverdueForStats` quét cả chờ quá 72h · `settleRequests` |
| `requests-cache.ts` (client) | `forfish.myc.v1` ngăn SĐT, ≤ 30, gộp theo id — `NEVER_BACKUP_PREFIXES` |
| Route | `GET/POST /api/cho/yeu-cau` · `GET/PATCH /api/cho/yeu-cau/[id]` (`dong_y`·`huy`) · `GET /api/admin/cho/yeu-cau` (+`counts.moi`) · `GET/PATCH /api/admin/cho/yeu-cau/[id]` (`bao_gia`·`khong_tim_duoc`, nhật ký `market.request-quote`) · `PATCH /api/ban-hang/don/[id]` + `/api/admin/cho/don/[id]`: `da_xac_nhan` bắt buộc hẹn, dời hẹn ở nhánh "chỉ ghi" |
| Migration | `0063_market_requests_eta.sql` — ✅ ĐÃ APPLY prod 2026-10-18 (04 §7g) |

Gác dữ liệu: `/api/cho/*` + `/api/admin/cho/*` đã nằm trong `KHONG_PHAI_DU_LIEU` của `data-route-rules` (route sàn tự gác bằng `identityFromRequest`/`requireAdmin`) — route mới không cần dòng mới.

## Assumptions (đã đối chiếu LEAD-BRIEF §4/§5 — mục nào lead đã chốt thì ghi "chốt")

1. **Chốt (LEAD §5 #8)**: khách lạ xem được `/cho`, `/cho/tim`, `/cho/sp/[id]`, `/cho/shop/[slug]`, `/cho/gio`; đặt/đơn/đánh giá/♡/bán hàng cần đăng nhập (`LoginGate` tại điểm chạm, `RequireLogin` cho `/cho/thanh-toan`, `/cho/don*`, `/ban-hang/**`).
2. **Chốt (LEAD §5 A2)**: SĐT chủ shop SDVICO **không** nằm trong migration/env; sentinel `sdvico:chua-gan`, admin gán qua `/quan-tri`. Shop vẫn hiện và nhận đơn trước khi gán — admin xử lý thay (by `admin:<sđt>`). File-store: persona `0902000001` là chủ shop SDVICO hoạt động sẵn.
3. **Chốt (LEAD §5 #5)**: tồn kho theo sản phẩm; biến thể chỉ nhãn + giá riêng (0 hoặc 2..10).
4. **Chốt (LEAD §5 A4)**: mỗi SĐT tối đa một shop; người bán cũng mua được; **không chặn** mua của chính shop mình ở v1 (11 bỏ R4).
5. Ảnh sản phẩm là nội dung công khai ⇒ bucket public, không signed URL (khác `user-docs` private của giấy tờ).
6. `search_text` do ứng dụng ghi (không generated column) để file-store và supabase-store tìm cùng một cách; không dấu qua `foldVn`.
7. `payment_status` chỉ là **lời khai hai bên** — app không xác minh tiền; copy trên màn nói rõ "Không trả tiền trong app. Trả khi nhận hoặc chuyển khoản thẳng cho shop."; `needsRefund` chỉ NHẮC.
8. Trần (một nguồn `validate.ts` §4.3): 5 shop/lần đặt · 20 dòng/đơn-shop · 50 dòng/giỏ · 6 ảnh ≤ 400 KB · biến thể 0|2..10 · 10 địa chỉ · 100 yêu thích (kèm snapshot) · 50 đơn trong bản lưu · ghi chú 300 · đánh giá 500 · tên món 3..120 · giá 1.000..1 tỷ · tên shop 3..60 · lý do huỷ/từ chối 5..200/300.
9. Giờ VN cho mã đơn (`makeOrderCode`) và thống kê theo ngày (`todayIsoVN` của `lib/days.ts` — tái dùng); biên "7 ngày" của `settleOverdue` là 7×24 giờ tính từ `deliveredAt` (không cần giờ VN).
10. `/ban-hang` ở trong khung mobile + dock (không thoát khung như `/quan-tri`).
11. Tên shop duy nhất qua `slug` (không hậu tố `-2`): hai "Đại lý Hải Đăng" là hai shop gây nhầm cho bà con; trùng ⇒ 409 `slug_taken`, câu "Tên shop này đã có người dùng — chọn tên khác."
12. `sold_count` cộng lúc ĐẶT (trong RPC), trừ khi hoàn kho — không cộng ở `hoan_thanh` (11 T4 sửa theo), vì `settleOverdue` chạy trên đường ĐỌC không được ghi sản phẩm.
13. `province` trong `listProducts` là **LỌC** (không phải xếp hạng): "cùng tỉnh trước, rồi mới nhất" (LEAD §4 #11) hiện thực bằng khối "Gần bà con" đặt trên khối "Món mới lên chợ" ở `/cho` + chip "Gần tôi" ở `/cho/tim`. Xếp hạng theo tỉnh trong một truy vấn PostgREST không có; hai khối rẻ hơn và không mất món khi tỉnh nhà chưa có shop.
14. Cờ `forfish.mshop.v1` (khoá thứ 5) để sheet Tài khoản biết có shop mà không gọi mạng lúc mở app; sai lệch tối đa tới lần mở sheet có sóng kế tiếp.

## History
- **1.5 (2026-09-06) — Buyer, vòng fix UX 2 (ux-audit2)**: `ShopCheckoutDraft.buyerNote?` + `PreparedShopOrder.buyerNote?` (ghi chú theo TỪNG shop; `placeOne` của cả hai adapter dùng `pre.buyerNote ?? common.buyerNote`; `validateCheckout` đo cùng trần `NOTE_MAX`); `MoneyText` luôn `whitespace-nowrap`; `market-order-detail.tsx` thêm "Mua lại" (dùng lại `POST /api/cho/gio/tinh` + `marketLineKey` + `useMarketCart`, không đẻ luật còn-bán thứ hai). Không đổi schema/migration.
- **1.4 (2026-09-06) — Buyer, vòng fix UX**: `cart.ts` thêm 6 export ô chọn (§4.8, shape lưu thêm `off?`); `validate.ts` thêm `addressErrorField`; `login-gate.tsx` thêm prop `verb?` (mặc định "xem"); `buyer/hooks.ts` `useMarketCart` thêm `unselected/selectedItems/select`, `count` = **số dòng** (F-19); shared thêm `market-header.tsx`, `line-thumb.tsx`; `product-card.tsx` bỏ `onAdd`; `category-chips` level 1; `address-form` `<select>` + `homeProvince`; `LoginInvite` thành BottomSheet (`verb` thay `feature`); `/dev` persona login gọi `applyIdentityAction("SIGNED_IN", true, phone)` (F-29). `OrderLine.image` đã có sẵn từ 1.1 (buildMarketLines + 2 adapter + comment migration) — KHÔNG thêm `imageUrl` trùng nghĩa (nguyên tắc 3), chỉ thêm test. Chữ ký hàm Core cũ giữ nguyên.
- **1.3 (2026-09-06) — Seller**: lối vào Kênh người bán (§9) chuyển RA NGOÀI nhóm "Cài đặt khác" thu gọn của `hero-account.tsx`, đặt ngay dưới khối danh tính/hạng — nằm trong nhóm thu gọn thì bà con phải bấm "Mở" mới thấy. Hai dạng dòng, cờ `seller-flag` và luật ẩn khi chưa biết + mất sóng GIỮ NGUYÊN.
- 1.0 (2026-09-06): khởi tạo pha Kiến trúc từ LEAD-BRIEF; 12 điểm phản biện.
- **1.2 (2026-09-06) — Core**: `ProductQuery.status` (`ProductStatusFilter` = ProductStatus | `bi_go` | `all`) cho `listShopProducts` ở CẢ HAI adapter — route `/api/ban-hang/san-pham` truyền thẳng xuống kho, hết quét 1.000 món rồi lọc trong route (gỡ `// nợ:`); `listProducts` (chợ) không đổi. Thêm biến môi trường `MARKET_STORE_FILE` trỏ tệp kho dev (§5.1), uploads đi theo thư mục của tệp.
- **1.1 (2026-09-06) — hợp nhất sau phản biện**: đưa đủ LEAD-BRIEF §4/§5 vào schema/type/store/route (`settleOverdue`, `needs_refund`, `shops.paused`, `product_reviews.hidden`, `admin_hidden`, `deleted_at`, `bank_snapshot`, `approved_at`, danh mục id gạch-ngang, `marketOrderClientRef`, `expectedTotalVnd`/`price_changed`, `results[]` từng shop, ép COD, `?province`, khách lạ xem chợ, 2 dạng dòng sheet Tài khoản, sentinel SDVICO, push người bán); tên/mã/số khớp 11-ba-spec 1.1; ownership cuối cùng §10.1. Bảng đối chiếu: `_generated/phan-bien-san-thuong-mai-2026-09-06.md`.

**Last updated**: 2026-09-06 (1.5)
