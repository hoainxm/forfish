-- SDFish — TRACE TIỀN (NV4/NV5) + AUDIT QUẢN TRỊ (NV7), ba-spec 10, 2026-07-30.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

-- NV4/NV5 — đánh dấu payment ĐÃ BẮN sang SDWork (traced_at). Hàng chờ bắn =
-- reconciled_status='pending' AND traced_at IS NULL. Bắn 2xx → set traced_at
-- (không bắn lại). SDWork đối chiếu xong → webhook set reconciled_status.
alter table public.payments
  add column if not exists traced_at timestamptz;

create index if not exists payments_trace_queue_idx
  on public.payments (reconciled_status, traced_at);

-- NV7 — NHẬT KÝ HOẠT ĐỘNG QUẢN TRỊ. Mỗi mutation ở /api/admin/* ghi 1 dòng
-- {actor SĐT, action, target khách (null nếu toàn cục), detail}. Chỉ service-role
-- ghi/đọc (route requireStaff/requireAdmin) — RLS bật, KHÔNG policy.
create table if not exists public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null,          -- SĐT staff thao tác
  action      text not null,          -- grant|downgrade|reset_password|set_flag|record_payment|create_account|delete_account…
  target      text,                   -- SĐT khách bị tác động (null = toàn cục)
  detail      text,                   -- chi tiết tuỳ chọn (vd "flag=contacted value=true")
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_actor_idx on public.admin_audit (actor, created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit (target, created_at desc);

alter table public.admin_audit enable row level security;
-- KHÔNG policy — chỉ service-role (route /api/admin/*, requireStaff/requireAdmin).
