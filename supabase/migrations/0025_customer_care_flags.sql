-- SDFish — 2 CỜ CHĂM KHÁCH cho khu đại lý (ba-spec 10 NV2, 2026-07-30).
-- Đại lý/nhân viên đánh dấu trạng thái chăm sóc từng khách ngay trên danh sách:
--   · premium_used  = khách ĐÃ THỰC SỰ dùng premium chưa (đại lý xác nhận tay)
--   · contacted     = đã LIÊN HỆ khách chưa
-- Cả 2 do STAFF đặt tay (chip bấm đổi), độc lập nhau + độc lập việc kích hoạt
-- premium. Đọc/ghi qua /api/admin/accounts (service-role) — client KHÔNG sửa
-- trực tiếp nên KHÔNG cần policy mới (RLS customers bật sẵn, đọc theo phone chủ).
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

alter table public.customers
  add column if not exists premium_used boolean not null default false,
  add column if not exists contacted    boolean not null default false;
