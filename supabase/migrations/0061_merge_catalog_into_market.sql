-- SDFish — GỘP "CỬA HÀNG" CŨ VÀO "CHỢ VẬT TƯ" (2026-09-07, ADR 0014).
--
-- Trước đây bà con có HAI cửa hàng cho cùng một việc mua đồ cho tàu:
--   · tab Tàu cá → Sản phẩm → "Cửa hàng"  = product_listings (0016/0045) +
--     catalog_orders (0046) — một nhà cung cấp (SDVICO), admin tự nhập.
--   · /cho "Chợ vật tư"                    = shops/shop_products/market_orders
--     (0060) — nhiều đại lý, có giỏ, tồn kho, đánh giá, kênh người bán.
-- Hai giỏ, hai chỗ xem đơn, hàng SDVICO hiện ở hai nơi. Chủ dự án chốt gộp về
-- MỘT: chợ là cửa hàng duy nhất, SDVICO là một gian hàng trong đó.
--
-- Migration này KHÔNG xoá bảng cũ (giữ để lùi lại được). Nó:
--   1. Cho phép món "LIÊN HỆ BÁO GIÁ" (price_vnd null) — 6 món giới thiệu của
--      SDVICO (SEA-40, GSHT, Thuraya…) chưa từng niêm yết giá số, bán qua tư
--      vấn. Không có bậc này thì gộp = mất trắng 6 món đó.
--   2. Chuyển product_listings (đang hiện) → shop_products của gian hàng SDVICO.
--   3. Chuyển catalog_orders → market_orders (đơn của bà con không được rơi).
--   4. Ghi chú bảng cũ là ĐÃ NGHỈ.
--
-- ✅ ĐÃ APPLY prod 2026-09-07 (ref znzgugvfhgmiszqgjulk), ngay sau 0060 cùng đợt.
--    Kết quả: 13 món về gian hàng SDVICO (7 có giá + 6 liên hệ báo giá), 1 đơn thật
--    chuyển sang market_orders mã SD260828CAC3; hai bảng cũ giữ nguyên đủ dòng.
--    Đã chạy rồi thì ĐỪNG sửa file này nữa — vá bằng migration mới.
-- Xem docs/app-map/04-data-model.md §7f, docs/adr/0014-gop-cua-hang-vao-cho.md.

-- ── 1. Món LIÊN HỆ BÁO GIÁ ─────────────────────────────────────────────────
-- price_vnd null = chưa niêm yết giá; app hiện "Liên hệ báo giá" + nút "Gọi
-- hỏi giá" thay vì "Thêm vào giỏ". CHECK cũ (between 1000 and 1e9) vẫn giữ:
-- null đi qua CHECK vì null → unknown, không phải false. Giá 0 vẫn bị chặn.
alter table public.shop_products alter column price_vnd drop not null;

comment on column public.shop_products.price_vnd is
  'NULL = LIÊN HỆ BÁO GIÁ (món tư vấn, không niêm yết giá): không thêm được vào giỏ, không lên đơn — chặn ở lib/market/pricing.ts (isPurchasable) VÀ ở market_place_order. Có giá thì 1.000đ–1 tỷ.';

-- Chặn ở TẦNG ĐƠN luôn, không chỉ tin tầng app: dòng hàng của món chưa có giá
-- không bao giờ khớp `price_vnd = (it->>'priceVnd')::integer` trong
-- market_place_order (null = null là unknown) ⇒ đơn bị trả line_unavailable.
-- Ghi ra đây để người đọc sau không tưởng là lỗ hổng.

-- ── 2. Hàm bỏ dấu — bản SQL của foldVn (lib/market/text.ts) ────────────────
-- shop_products.search_text do app ghi bằng foldVn(); migration cũng phải ghi
-- ĐÚNG CÙNG MỘT PHÉP, không thì 13 món này tìm không ra. Không dùng extension
-- unaccent (prod chưa cài, và cài extension là một quyết định riêng).
create or replace function public.market_fold_vn(s text)
returns text
language sql
immutable
strict
as $$
  -- Chuỗi đích dựng bằng repeat() chứ KHÔNG gõ tay: đếm tay lệch một ký tự là
  -- cả bảng dịch trượt, và "Đá" ra "ya" (đã dính đúng vậy lúc viết). Số lượng
  -- theo đúng nhóm dấu của chuỗi nguồn: a×17 · e×11 · i×5 · o×17 · u×11 · y×5 · đ.
  select trim(regexp_replace(
    translate(
      lower(s),
      'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
      repeat('a', 17) || repeat('e', 11) || repeat('i', 5) ||
      repeat('o', 17) || repeat('u', 11) || repeat('y', 5) || 'd'
    ),
    '[^a-z0-9]+', ' ', 'g'))
$$;

comment on function public.market_fold_vn(text) is
  'Bỏ dấu + thường hoá, khớp foldVn() ở src/lib/market/text.ts. Dùng để ghi shop_products.search_text trong migration.';

-- ── 3. product_listings → shop_products (gian hàng SDVICO) ─────────────────
-- Chỉ món ĐANG HIỆN (visible). Chạy lại được: bỏ qua món đã có cùng tên trong
-- gian hàng SDVICO.
--
-- Ánh xạ loại: bảng cũ để loại bằng CHỮ TỰ DO (`category`) + nhóm 3 mục
-- (`group`), bảng mới có 9 mã cố định. Khớp theo TÊN cho 13 dòng đang có
-- (2026-09-07), rơi về nhóm khi tên lạ — món mới sau này nhập thẳng ở /ban-hang
-- nên không cần nuôi bảng ánh xạ này.
--
-- Tồn kho: bảng cũ KHÔNG có tồn kho, món đặt được thì luôn đặt được. Đặt 99 để
-- giữ NGUYÊN hành vi cũ (còn hàng), không phải vì SDVICO có đúng 99 cái.
-- 👉 Việc của SDVICO sau khi apply: vào /ban-hang sửa tồn kho thật + đặt giá cho
--    6 món "Liên hệ báo giá" nếu muốn bán thẳng.
insert into public.shop_products
  (shop_id, title, description, category, price_vnd, unit, stock, images, status, search_text)
select
  s.id,
  pl.title,
  nullif(
    trim(
      coalesce(pl.description, '') ||
      coalesce(
        (select E'\n' || string_agg('· ' || value, E'\n')
           from jsonb_array_elements_text(pl.features) as f(value)
          where jsonb_typeof(pl.features) = 'array'),
        '')
    ), '') as description,
  case pl.title
    when 'Máy lọc nước biển SEA-40'                then 'khac'
    when 'Thiết bị GSHT tàu cá VIETTEL S-Tracking' then 'dien-tu-hang-hai'
    when 'Thuraya Marine Star MNB-01'              then 'dien-tu-hang-hai'
    when 'Điện thoại vệ tinh XT-Pro'               then 'dien-tu-hang-hai'
    when 'Thiết bị lọc dầu SF-50'                  then 'may-dong-co'
    when 'PV ENGINE RMI Nano Graphene'             then 'dau-nhot-nhien-lieu'
    when 'Đá cây ướp cá'                           then 'da-bao-quan'
    when 'Dầu máy Castrol CRB 15W-40'              then 'dau-nhot-nhien-lieu'
    when 'Nước ngọt sinh hoạt'                     then 'nhu-yeu-pham'
    when 'Bộ đàm ICOM IC-M324'                     then 'dien-tu-hang-hai'
    when 'Máy dò cá dò ngang'                      then 'dien-tu-hang-hai'
    when 'Bơm nước biển làm mát'                   then 'may-dong-co'
    when 'Dây curoa máy (bản B)'                   then 'phu-tung'
    else case pl."group"
      when 'dien_tu'       then 'dien-tu-hang-hai'
      when 'co_dien'       then 'may-dong-co'
      when 'nhu_yeu_pham'  then 'nhu-yeu-pham'
      else 'khac'
    end
  end as category,
  pl.price_vnd,                                   -- null ⇒ Liên hệ báo giá
  coalesce(nullif(trim(coalesce(pl.unit, '')), ''), 'bộ') as unit,
  case when pl.orderable and pl.price_vnd is not null then 99 else 0 end as stock,
  case when nullif(trim(coalesce(pl.image_url, '')), '') is null
       then '[]'::jsonb
       else jsonb_build_array(pl.image_url) end as images,
  'dang_ban',
  public.market_fold_vn(pl.title || ' ' || coalesce(pl.description, ''))
from public.product_listings pl
cross join lateral (select id from public.shops where slug = 'sdvico') s
where pl.visible
  and not exists (
    select 1 from public.shop_products sp
     where sp.shop_id = s.id and sp.title = pl.title and sp.deleted_at is null
  );

-- ── 4. catalog_orders → market_orders ──────────────────────────────────────
-- Đơn của bà con KHÔNG được rơi khi đổi nhà. Ánh xạ trạng thái:
--   moi → cho_xac_nhan · da_nhan → da_xac_nhan · dang_giao → dang_giao ·
--   da_giao → da_giao · da_huy → da_huy.
-- Địa chỉ: bảng cũ chỉ có delivery_location/contact_* (đều có thể null) và
-- KHÔNG có tỉnh. KHÔNG bịa tỉnh — để rỗng và ghi thẳng vào `detail` rằng đơn cũ
-- chưa có địa chỉ, để nhân viên gọi lại hỏi. Thà trống thật còn hơn đúng giả.
-- productId trong dòng hàng: nối lại theo TÊN món sang shop_products vừa tạo;
-- không tìm thấy thì để chuỗi rỗng — dòng hàng trong đơn là SNAPSHOT, tên/giá
-- đã đóng băng nên đơn vẫn đọc được, chỉ mất đường bấm sang trang món.
insert into public.market_orders
  (id, code, buyer_phone, shop_id, items, subtotal_vnd, shipping_vnd, total_vnd,
   payment_method, payment_status, status, address, buyer_note, timeline,
   created_at, updated_at)
select
  co.id,
  'SD' || to_char(co.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD')
       || upper(substr(replace(co.id::text, '-', ''), 1, 4)) as code,
  co.customer_phone,
  s.id,
  coalesce(
    (select jsonb_agg(jsonb_build_object(
              'productId', coalesce(sp.id::text, ''),
              'title',     it->>'title',
              'unit',      coalesce(it->>'unit', 'cái'),
              'priceVnd',  coalesce((it->>'priceVnd')::integer, 0),
              'qty',       coalesce((it->>'qty')::integer, 1),
              'lineTotalVnd', coalesce((it->>'lineTotalVnd')::integer, 0)))
       from jsonb_array_elements(co.items) as it
       left join public.shop_products sp
              on sp.shop_id = s.id and sp.title = it->>'title' and sp.deleted_at is null),
    '[]'::jsonb) as items,
  co.total_vnd, 0, co.total_vnd,
  'cod', 'chua_thanh_toan',
  case co.status
    when 'moi'       then 'cho_xac_nhan'
    when 'da_nhan'   then 'da_xac_nhan'
    when 'dang_giao' then 'dang_giao'
    when 'da_giao'   then 'da_giao'
    when 'da_huy'    then 'da_huy'
    else 'cho_xac_nhan'
  end as status,
  jsonb_build_object(
    'name',  coalesce(nullif(trim(coalesce(co.contact_name, '')), ''),
                      (select c.name from public.customers c where c.phone = co.customer_phone), ''),
    'phone', coalesce(nullif(trim(coalesce(co.contact_phone, '')), ''), co.customer_phone),
    'province', '',
    'detail', coalesce(
                nullif(trim(coalesce(co.delivery_location, '')), ''),
                'Đơn cũ từ Cửa hàng — chưa ghi địa chỉ nhận, gọi lại cho bà con'
                  || coalesce(' (tàu ' || nullif(trim(coalesce(co.boat_name, '')), '') || ')', '')),
    'isPort', false) as address,
  co.note,
  jsonb_build_array(jsonb_build_object(
    'status', 'cho_xac_nhan',
    'at', to_char(co.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'by', 'system',
    'note', 'Đơn đặt ở Cửa hàng cũ, chuyển sang chợ ngày 07/09/2026')) as timeline,
  co.created_at, co.updated_at
from public.catalog_orders co
cross join lateral (select id from public.shops where slug = 'sdvico') s
where not exists (select 1 from public.market_orders mo where mo.id = co.id);

-- ── 5. Bảng cũ ĐÃ NGHỈ ─────────────────────────────────────────────────────
-- Giữ nguyên dữ liệu để lùi lại được. App KHÔNG còn đọc hai bảng này; route
-- /api/sdvico/catalog, /api/me/orders, /api/admin/products, /api/admin/orders
-- đã gỡ cùng commit. Xoá bảng là một quyết định riêng, sau khi chợ chạy êm.
comment on table public.product_listings is
  'ĐÃ NGHỈ 2026-09-07 (ADR 0014) — danh mục "Cửa hàng" cũ, đã chuyển sang shop_products của gian hàng SDVICO. App không đọc nữa. Giữ để lùi lại; xoá là quyết định riêng.';
comment on table public.catalog_orders is
  'ĐÃ NGHỈ 2026-09-07 (ADR 0014) — đơn "Cửa hàng" cũ, đã chuyển sang market_orders. App không đọc nữa. Giữ để lùi lại; xoá là quyết định riêng.';
