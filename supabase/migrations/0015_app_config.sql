-- SDFish — CẤU HÌNH ỨNG DỤNG trong DB (2026-07-28). Thay cho việc lệ thuộc env
-- máy chủ deploy (Vercel): admin dán khoá/cấu hình vào đây (VD khoá VAPID Web
-- Push) là áp dụng NGAY, KHÔNG cần set env + redeploy. Đọc DB-trước, thiếu thì
-- rơi về env cùng tên (di trú êm: env cũ vẫn chạy, DB đè lên khi có).
--
-- BẢO MẬT: bảng chứa SECRET (VD vapid_private_key) → RLS bật, **KHÔNG policy** =
-- chỉ service-role đọc/ghi. Client KHÔNG đọc trực tiếp. Khoá công khai (vd
-- vapid_public_key) chỉ lộ qua API riêng /api/push/vapid-public-key. Ghi/xem
-- qua /api/admin/app-config (requireAdmin) — GET che giá trị secret.
--
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.app_config (
  key         text primary key,
  value       text not null default '',
  updated_by  text,                                  -- SĐT admin sửa gần nhất
  updated_at  timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- KHÔNG có policy — chỉ service-role (route /api/admin/app-config, requireAdmin).
