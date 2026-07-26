-- SDFish — TÀI KHOẢN QUẢN LÝ + LOG CẤP PREMIUM (2026-07-26, đợt 2 phân hạng).
-- · customers.role: 'customer' | 'manager' — QUẢN LÝ (đại lý/sales) được vào
--   /quan-tri để KÍCH HOẠT/GIA HẠN premium cho khách (admin env ADMIN_PHONES
--   vẫn là quyền cao nhất: tạo/xoá/hạ hạng/tạo quản lý).
-- · customers.premium_activated_at: mốc kích hoạt gần nhất (hạn ở premium_until).
-- · premium_grants: LOG mỗi lần kích hoạt/gia hạn/hạ hạng — granted_by = SĐT
--   người thao tác → đếm được mỗi quản lý đang quản bao nhiêu account premium.
-- LUẬT KỲ HẠN (src/lib/tier.ts nextPremiumUntil, có test): 1 lần kích = 1 NĂM;
-- gia hạn khi CÒN hạn thì cộng nối vào hạn cũ, HẾT hạn thì tính từ hiện tại.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

alter table public.customers
  add column if not exists role text not null default 'customer'
    constraint customers_role_check check (role in ('customer', 'manager')),
  add column if not exists premium_activated_at timestamptz;

create table if not exists public.premium_grants (
  id             uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  granted_by     text not null,               -- SĐT admin/quản lý thao tác
  action         text not null check (action in ('activate', 'renew', 'downgrade')),
  activated_at   timestamptz not null default now(),
  premium_until  timestamptz,                 -- hạn SAU thao tác (null khi hạ hạng)
  created_at     timestamptz not null default now()
);
create index if not exists premium_grants_by_idx    on public.premium_grants (granted_by);
create index if not exists premium_grants_phone_idx on public.premium_grants (customer_phone);

-- Log NỘI BỘ: bật RLS nhưng KHÔNG policy nào — chỉ service-role (bypass RLS)
-- của /api/admin/* đọc/ghi; client thường không thấy gì.
alter table public.premium_grants enable row level security;
