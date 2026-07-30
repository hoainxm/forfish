-- SDFish — GHI NHẬN THU TIỀN bằng MÃ CK (ba-spec 10 NV3, 2026-07-30).
-- Đại lý/nhân viên nhập MÃ chuyển khoản khi khách đã trả (như thanh toán tên
-- miền — NVHòa chốt "chỉ cần mã"). SDFish KHÔNG lưu SỐ TIỀN/nội dung (R1/AC-4)
-- — tiền thật + đối soát ở SDWork. reconciled_status='pending' = chờ SDWork tra
-- sao kê xác nhận (NV4 bắn mã → NV5 webhook SDWork set 'reconciled'). Hàng chờ
-- trace = các dòng reconciled_status='pending'.
-- Ghi/đọc qua /api/admin/accounts (service-role) — client KHÔNG chạm; RLS bật,
-- KHÔNG policy (chỉ service-role).
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  customer_phone     text not null,                 -- khách trả tiền
  code               text not null,                 -- MÃ CK (chỉ mã, KHÔNG số tiền)
  agent_phone        text,                          -- staff/đại lý ghi nhận
  reconciled_status  text not null default 'pending', -- pending | reconciled
  created_at         timestamptz not null default now(),
  reconciled_at      timestamptz                    -- lúc SDWork xác nhận (NV5)
);

create index if not exists payments_customer_idx
  on public.payments (customer_phone, created_at desc);
create index if not exists payments_pending_idx
  on public.payments (reconciled_status);

alter table public.payments enable row level security;
-- KHÔNG policy — chỉ service-role (route /api/admin/accounts, requireStaff).
