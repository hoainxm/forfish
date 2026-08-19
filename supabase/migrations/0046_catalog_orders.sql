-- SDFish — ĐƠN ĐẶT HÀNG nhu yếu phẩm/sản phẩm cho chuyến biển (2026-08-11).
-- Chủ tàu chọn hàng từ Cửa hàng (product_listings orderable, 0032) → đặt đơn;
-- nhà cung cấp (SDVICO — 1 NCC, MVP) nhận và giao. KHÔNG thanh toán trong app
-- (chốt tiền lúc giao / ngoài app — nhất quán 04-data-model.md §"KHÔNG có luồng
-- thanh toán"). Online-only (SW bỏ qua POST, không outbox).
--
-- items: SNAPSHOT dòng hàng dạng jsonb — [{listing_id,title,unit,price_vnd,qty,
-- line_total_vnd}]. Đóng băng giá lúc đặt để đổi bảng giá về sau không sửa đơn cũ.
-- total_vnd: SERVER tự tính lại từ product_listings hiện tại (không tin client).
--
-- Định danh chủ tàu = customer_phone (device token, KHÔNG auth.uid — 0026/0028).
-- Auth: KHÔNG có RLS policy — chủ tàu đọc đơn mình qua /api/me/orders
-- (identityFromRequest tự lọc phone), NCC/admin nhận & chuyển trạng thái qua
-- /api/admin/orders (requirePermission 'don-hang'). Client KHÔNG chạm bảng trực
-- tiếp (giống pattern product_inquiries/premium_grants). Xem 04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.catalog_orders (
  id               uuid primary key default gen_random_uuid(),
  customer_phone   text not null,                 -- chủ tàu (từ device token, đã chuẩn hoá)
  boat_name        text,                           -- tên tàu gắn đơn (tuỳ chọn)
  boat_ref         text,                           -- id/mã tàu (tuỳ chọn)
  items            jsonb not null default '[]'::jsonb,  -- snapshot dòng hàng, giá đóng băng
  total_vnd        integer not null default 0,     -- server tính lại
  delivery_location text,                          -- cảng / điểm giao
  contact_name     text,
  contact_phone    text not null,                  -- SĐT nhận hàng
  note             text,                           -- ghi chú chủ tàu
  status           text not null default 'moi'
                     check (status in ('moi', 'da_nhan', 'dang_giao', 'da_giao', 'da_huy')),
  handled_by       text,                           -- SĐT staff/NCC xử lý gần nhất
  handled_at       timestamptz,
  dealer_note      text,                           -- ghi chú NCC khi xử lý/giao
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Đọc đơn theo chủ tàu (/api/me/orders) và theo trạng thái (/api/admin/orders).
create index if not exists catalog_orders_customer_idx
  on public.catalog_orders (customer_phone, created_at desc);
create index if not exists catalog_orders_status_idx
  on public.catalog_orders (status, created_at desc);

alter table public.catalog_orders enable row level security;

-- KHÔNG có policy nào — client không đọc/ghi trực tiếp, chỉ qua service-role
-- trong route (giống pattern product_inquiries/premium_grants).
