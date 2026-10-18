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
-- ✅ ĐÃ APPLY prod 2026-09-07 (ref znzgugvfhgmiszqgjulk, chủ dự án ra lệnh).
--    Đã chạy rồi thì ĐỪNG sửa file này nữa — vá bằng migration mới (xem 0062).

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
  price_vnd           integer not null check (price_vnd between 1000 and 1000000000),
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
