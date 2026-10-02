-- 0057 — ADMIN TỔNG NẰM TRONG DB (thay env OWNER_LOGIN)
--
-- Vì sao (chủ dự án 2026-10-02: "không có cách tạo admin nào đỡ rắc rối hơn à,
-- có quyền chạy migrate vào DB mà"): bản trước nhận admin tổng qua env
-- OWNER_LOGIN ⇒ phải sửa .env.production trên server riêng + khởi động lại.
-- Nay vai `owner` là MỘT hàng trong staff_accounts — apply migration này là
-- xong, không đụng server. Env OWNER_LOGIN vẫn được đọc nếu có (tương thích),
-- nhưng không còn cần.
--
-- Định danh admin tổng = TÊN đăng nhập (không phải SĐT): auth user
-- `admin@sdvico.local` (tạo bằng scripts/owner-account.mjs — mật khẩu do chủ
-- dự án tự gõ, KHÔNG nằm trong migration/git).
--
-- MỘT admin tổng duy nhất: index unique trên (role) where role='owner'.
-- Đổi tên admin tổng = update cột phone của hàng owner (có chủ ý, bằng SQL).
--
-- ⚠️ OFFLINE: không ảnh hưởng — chỉ bảng vai quản trị.
--
-- ✅ ĐÃ APPLY prod 2026-10-02 (ref znzgugvfhgmiszqgjulk, chủ dự án duyệt).

alter table public.staff_accounts
  drop constraint if exists staff_accounts_role_check;
alter table public.staff_accounts
  add constraint staff_accounts_role_check check (role in ('owner', 'admin', 'manager'));

create unique index if not exists staff_accounts_one_owner_idx
  on public.staff_accounts (role)
  where role = 'owner';

insert into public.staff_accounts (phone, role, created_by)
values ('admin', 'owner', 'migration:0057')
on conflict (phone) do update
  set role = 'owner', disabled_at = null, updated_at = now();

comment on column public.staff_accounts.role is
  'owner (admin tổng — MỘT người, định danh là tên đăng nhập, nâng/hạ quản trị viên) | admin | manager. Xem 0056 + 0057.';
