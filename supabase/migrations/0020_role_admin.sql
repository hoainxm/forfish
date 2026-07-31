-- SDFish — QUẢN TRỊ VIÊN NGUỒN DB (2026-07-31, user chốt). Trước đây admin CHỈ
-- đến từ env ADMIN_PHONES: thêm/bớt phải sửa Vercel + deploy, và trong web
-- không thấy ai đang là admin. Nay `customers.role='admin'` CŨNG là quản trị
-- viên (lib/admin-auth.ts requireStaff), quản ngay ở /quan-tri tab Phân quyền;
-- env giữ lại làm CỬA CỨU HỘ (web không hạ được admin từ env).
--
-- ⚠️ ĐỒNG BỘ SCHEMA LỆCH: prod đã được sửa TAY từ trước (ràng buộc thật trên
-- prod đã là 3 giá trị, hàng 0900000001 đang mang role='admin') trong khi
-- migration 0004 trong repo chỉ cho ('customer','manager'). File này kéo repo
-- về ĐÚNG prod để môi trường mới dựng lại không lệch. Chạy trên prod là no-op
-- (drop rồi add lại đúng ràng buộc đang có).
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

alter table public.customers
  drop constraint if exists customers_role_check;

alter table public.customers
  add constraint customers_role_check
  check (role in ('customer', 'manager', 'admin'));
