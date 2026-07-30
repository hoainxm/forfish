-- SDFish — NHẬT KÝ HOẠT ĐỘNG ADMIN (2026-07-30). Log APPEND-ONLY mọi thao tác
-- GHI/XÓA của staff trên /quan-tri để "tránh thao tác bậy" — truy được AI làm
-- GÌ, LÚC NÀO (nhất là xóa tài khoản/dữ liệu, reset mật khẩu, đổi quyền).
-- · actor_phone/actor_role — SĐT + vai (admin|manager) người thao tác
-- · action — mã '<khu>.<việc>' (vd account.delete, push.send) — nhãn ở
--   src/lib/admin-activity.ts (ACTION_LABEL, có test)
-- · target — SĐT/id đối tượng; detail — tham số/thay đổi (jsonb, KHÔNG chứa
--   bí mật: KHÔNG log mật khẩu/nội dung nhạy cảm)
-- Chỉ service-role (route /api/admin/*) ghi/đọc — RLS bật, KHÔNG policy.
-- Ghi log HỎNG không được chặn thao tác chính (helper fire-and-forget).
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.admin_activity_log (
  id           uuid primary key default gen_random_uuid(),
  actor_phone  text not null,
  actor_role   text not null,
  action       text not null,
  target       text,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists admin_activity_log_created_idx
  on public.admin_activity_log (created_at desc);
create index if not exists admin_activity_log_actor_idx
  on public.admin_activity_log (actor_phone);
create index if not exists admin_activity_log_action_idx
  on public.admin_activity_log (action);

alter table public.admin_activity_log enable row level security;
