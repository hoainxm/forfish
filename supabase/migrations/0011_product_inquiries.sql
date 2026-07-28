-- SDFish — YÊU CẦU HỎI MUA/TƯ VẤN từ danh mục sản phẩm (2026-07-28, Phase 2
-- sau product_listings/0010). Bảng RIÊNG của SDFish, KHÔNG dùng chung
-- consultation_requests bên CRM SDWork (user chốt) — admin quản lý ngay
-- trong /quan-tri tab "Yêu cầu", không cần qua project CRM khác.
--
-- Phạm vi (quyết định thiết kế): sản phẩm SDVICO (vendor_kind='sdvico') vẫn
-- giữ NGUYÊN nút "Hỏi mua" cũ → /api/sdvico/request → CRM consultation_requests
-- (kênh bán hàng đã có, SDWork đang theo dõi — KHÔNG đụng để tránh làm rớt
-- lead đang chạy thật). Bảng này phục vụ cái GAP thật: sản phẩm/dịch vụ của
-- ĐƠN VỊ NGOÀI SDWork trước đây chỉ hiện số điện thoại, không có nơi nào ghi
-- lại — nay bà con "Để lại yêu cầu" và admin thấy/xử lý được trong /quan-tri.
--
-- Auth: KHÔNG có RLS policy nào — ghi qua service-role trong
-- /api/product-inquiries (POST công khai, giống /api/sdvico/request cho phép
-- khách chưa đăng nhập) và đọc/sửa qua /api/admin/product-inquiries
-- (requireStaff). Client KHÔNG đọc/ghi bảng này trực tiếp.
--
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.product_inquiries (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid references public.product_listings (id) on delete set null,
  listing_title  text,                          -- lưu lại tên tại thời điểm hỏi (phòng khi listing bị xóa/sửa)
  vendor_kind    text,                           -- sdvico|external tại thời điểm hỏi
  customer_phone text not null,
  customer_name  text,
  message        text,
  status         text not null default 'moi'
                   check (status in ('moi', 'da_lien_he', 'xong')),
  created_at     timestamptz not null default now(),
  handled_by     text,                           -- SĐT staff xử lý gần nhất
  handled_at     timestamptz,
  note           text                            -- ghi chú nội bộ khi xử lý
);

create index if not exists product_inquiries_status_idx
  on public.product_inquiries (status, created_at desc);

alter table public.product_inquiries enable row level security;

-- KHÔNG có policy nào — client không đọc/ghi trực tiếp, chỉ qua service-role
-- trong route (giống pattern crew_reports/premium_grants).
