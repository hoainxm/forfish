-- SDFish — PHÂN QUYỀN TÀI KHOẢN QUẢN LÝ (2026-07-30). Nâng model staff từ
-- nhị phân (admin toàn quyền / manager chỉ cấp premium) lên PHÂN QUYỀN THEO TAB
-- × HÀNH ĐỘNG, cấu hình được trong /quan-tri (tab Phân quyền, admin-only).
-- · customers.staff_permissions: JSONB — bảng quyền của một QUẢN LÝ trên 5 tab
--   được phép (tai-khoan · san-pham · canh-bao · thong-bao · cho-ban), mỗi tab
--   4 cờ view/create/edit/delete. NULL = dùng preset mặc định (quản lý mới:
--   xem+tạo+sửa, KHÔNG xóa — xem src/lib/staff-permissions.ts).
--   4 tab còn lại (yeu-cau · vung-bien · du-lieu · he-thong) admin-only CỨNG,
--   không nằm trong bảng quyền.
-- Admin (env ADMIN_PHONES) KHÔNG có cột này — luôn toàn quyền, không cần DB row.
-- Luật THUẦN (dùng chung UI + route + middleware) ở src/lib/staff-permissions.ts
-- (có test). Chốt thật vẫn ở /api/admin/* (requirePermission).
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

alter table public.customers
  add column if not exists staff_permissions jsonb;

comment on column public.customers.staff_permissions is
  'Bảng quyền staff cho role=manager: {tab: {view,create,edit,delete}} trên 5 tab được phép. NULL = preset mặc định. Chỉ service-role (/api/admin/staff) ghi.';
