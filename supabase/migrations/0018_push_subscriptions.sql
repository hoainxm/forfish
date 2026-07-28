-- SDFish — WEB PUSH: đăng ký nhận thông báo (2026-07-28, Phase 3 sau danh
-- mục sản phẩm + yêu cầu tư vấn). Admin gửi thông báo cho TỪNG user (theo
-- SĐT) hoặc TOÀN BỘ user trong /quan-tri tab "Thông báo" — gửi qua PWA
-- service worker (public/sw.js), KHÔNG cần app store update, KHÔNG cần
-- SMS/Zalo (đợt sau nếu cần).
--
-- Auth: KHÔNG có RLS policy nào — client không đọc/ghi trực tiếp. Đăng ký/hủy
-- qua /api/push/subscribe (POST/DELETE, dùng được cả khi CHƯA đăng nhập —
-- customer_phone NULL vẫn nhận được thông báo BROADCAST TOÀN BỘ, chỉ không
-- nhận được thông báo NHẮM THEO SĐT). Gửi qua /api/admin/push (requireStaff).
--
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  customer_phone text,                          -- null = ẩn danh (chỉ nhận broadcast)
  endpoint       text not null unique,
  p256dh         text not null,
  auth_key       text not null,
  user_agent     text,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

create index if not exists push_subscriptions_phone_idx
  on public.push_subscriptions (customer_phone);

alter table public.push_subscriptions enable row level security;

-- KHÔNG có policy nào — client không đọc/ghi trực tiếp, chỉ qua service-role
-- trong route (giống pattern crew_reports/product_inquiries).
