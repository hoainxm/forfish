-- 0053 — ADMIN ĐƯỢC NHIỀU CHUỖI SỐNG (app + web /quan-tri cùng lúc)
--
-- Vì sao (chủ dự án 2026-08-31): luật "1 tài khoản 1 máy" (0039) đá phiên app
-- khi admin đăng nhập /quan-tri trên web, và ngược lại. Admin cần cả app (điện
-- thoại) LẪN web quản trị cùng lúc — hai token sống song song. CHỈ nới cho
-- admin; khách/đại lý giữ nguyên "1 tài khoản 1 máy" (chống chia sẻ tài khoản).
--
-- Cách: thêm cột `allow_multi`. Token của admin cấp với allow_multi=true và
-- được MIỄN ràng buộc một-chuỗi-sống. Index unique partial (0039) nay loại trừ
-- các hàng allow_multi=true, nên admin có bao nhiêu máy cũng được; hàng
-- allow_multi=false (khách/đại lý) vẫn nhiều nhất MỘT chuỗi sống.
--
-- ⚠️ OFFLINE: không ảnh hưởng — bảng chỉ đụng lúc đăng nhập/đăng xuất (có sóng).
--
-- 🔴 CHƯA APPLY prod (ref znzgugvfhgmiszqgjulk) — chủ dự án apply tay.

alter table public.device_tokens
  add column if not exists allow_multi boolean not null default false;

comment on column public.device_tokens.allow_multi is
  'true = MIEN rang buoc 1-chuoi-song (chi cap cho token admin: app + web cung luc). Xem 0053.';

-- Dựng lại index của 0039 với điều kiện loại trừ token admin.
drop index if exists public.device_tokens_one_live_idx;

create unique index if not exists device_tokens_one_live_idx
  on public.device_tokens (customer_phone)
  where revoked_at is null and allow_multi = false;

comment on index public.device_tokens_one_live_idx is
  'Mot SDT nhieu nhat MOT chuoi song — TRU token admin (allow_multi=true). Xem 0039 + 0053.';
