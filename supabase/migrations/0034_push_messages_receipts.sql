-- SDFish — HỘP THƯ + BIÊN NHẬN THÔNG BÁO (2026-08-01, chủ dự án duyệt).
--
-- Hai việc, một migration:
-- (1) HỘP THƯ: app KHÔNG có chỗ xem lại thông báo — vuốt tắt là mất. Ngư dân
--     để điện thoại trong túi, tay ướt, dễ vuốt nhầm; tin bão biến mất không
--     dấu vết. Nay mỗi lần gửi ghi một dòng `push_messages`, trang chủ có mục
--     "Thông báo" đọc lại được.
-- (2) BIÊN NHẬN: trước chỉ biết "đã đẩy tới Apple/Google", không biết máy bà
--     con có nhận không. Nhưng service worker CHẠY THẬT khi tin tới ⇒ nhánh
--     `push` báo về "đã nhận", `notificationclick` báo "đã đọc".
--
-- RLS bật, KHÔNG policy: chỉ service-role (route /api/*) đọc/ghi. Client xem
-- hộp thư qua /api/me/messages (lọc theo tài khoản đang đăng nhập).
-- ⚠️ ĐÃ APPLY prod 2026-08-01 (ref znzgugvfhgmiszqgjulk).

create table if not exists public.push_messages (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  url          text,
  -- 'all' = gửi mọi máy đã đăng ký · 'account' = nhắm một TÀI KHOẢN
  target       text not null check (target in ('all','account')),
  target_phone text,
  sent_by      text not null,
  -- số máy TÌM ĐƯỢC và số máy đẩy THÀNH CÔNG lúc gửi (đo tại chỗ)
  devices      int  not null default 0,
  sent         int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists push_messages_created_idx
  on public.push_messages (created_at desc);
create index if not exists push_messages_target_idx
  on public.push_messages (target, target_phone);

create table if not exists public.push_receipts (
  message_id    uuid not null references public.push_messages(id) on delete cascade,
  endpoint      text not null,
  account_phone text,
  -- máy BÁO VỀ khi service worker nhận được tin (khác "đã đẩy tới Apple")
  delivered_at  timestamptz,
  -- bà con BẤM vào thông báo
  opened_at     timestamptz,
  primary key (message_id, endpoint)
);
create index if not exists push_receipts_msg_idx
  on public.push_receipts (message_id);

alter table public.push_messages enable row level security;
alter table public.push_receipts enable row level security;
