-- Mở role='admin' trong customers: FULL-ADMIN quản lý TRONG DB, không chỉ qua
-- env ADMIN_PHONES (user chốt 2026-07-28). requireStaff coi customers.role='admin'
-- = admin toàn quyền (ngang env ADMIN_PHONES). env VẪN dùng được (bootstrap +
-- belt-and-braces: env khó tác động hơn 1 hàng DB).
--
-- Vì sao mở trong DB: production self-host 1 VPS + nhiều deploy test cùng 1 DB
-- (znzgugvfhgmiszqgjulk). Admin để ở DB thì thêm/bớt bằng SQL/UI, không phải sửa
-- env + restart từng chỗ.
--
-- Bootstrap admin đầu tiên (sau khi tài khoản đã đăng ký ở /dang-ky):
--   insert into public.customers (phone, role) values ('0938635689','admin')
--   on conflict (phone) do update set role='admin';

alter table public.customers drop constraint if exists customers_role_check;
alter table public.customers
  add constraint customers_role_check check (role in ('customer', 'manager', 'admin'));
