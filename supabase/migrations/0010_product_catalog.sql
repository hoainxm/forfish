-- SDFish — DANH MỤC SẢN PHẨM/DỊCH VỤ do ADMIN quản lý (2026-07-28). Thay cho
-- mảng cứng data/sdvico-showcase.ts: admin ẩn/hiện/xóa/thêm sản phẩm ngay
-- trong /quan-tri, áp dụng NGAY cho app — không cần build/deploy lại app.
-- Cho phép thêm cả sản phẩm/dịch vụ của ĐƠN VỊ NGOÀI SDWork (vendor_kind
-- 'external' + vendor_name + contact_phone/contact_note riêng) — biến tab
-- Sản phẩm /tau thành một sàn thông tin sản phẩm đơn giản, không chỉ SDVICO.
--
-- Auth: bảng CÔNG KHAI đọc (visible=true) — tab Sản phẩm là nội dung public
-- (xem 04-data-model.md §7). GHI chỉ qua service-role trong /api/admin/products
-- (requireStaff) — client KHÔNG có policy ghi nào.
--
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.product_listings (
  id            uuid primary key default gen_random_uuid(),
  vendor_kind   text not null default 'sdvico'
                  check (vendor_kind in ('sdvico', 'external')),
  vendor_name   text,                          -- tên đơn vị ngoài SDWork (bắt buộc khi external)
  title         text not null,
  category      text,                          -- nhãn loại hiện trên thẻ
  description   text,
  features      jsonb not null default '[]'::jsonb,  -- mảng chuỗi tính năng
  price_text    text,                           -- giá tham khảo, chữ tự do
  image_url     text,
  contact_phone text,                           -- SĐT liên hệ (vendor ngoài; SDVICO dùng hotline mặc định)
  contact_note  text,                           -- địa chỉ/ghi chú liên hệ thêm
  line          text,                           -- nối nhóm SKU CRM để nhận diện "đang dùng" (chỉ sdvico)
  visible       boolean not null default true,
  sort_order    integer not null default 0,
  created_by    text,                           -- SĐT staff tạo/sửa gần nhất
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists product_listings_visible_idx
  on public.product_listings (visible, sort_order, created_at desc);

alter table public.product_listings enable row level security;

-- ĐỌC: công khai, chỉ hàng đang hiện (đúng tinh thần "public" của tab Sản phẩm).
drop policy if exists "product listings readable when visible" on public.product_listings;
create policy "product listings readable when visible" on public.product_listings
  for select using (visible = true);

-- GHI/SỬA/XÓA: KHÔNG có policy — chỉ service-role (route /api/admin/products,
-- requireStaff) được ghi, giống pattern crew_reports/premium_grants.

-- Seed: giữ nguyên 6 sản phẩm showcase cũ (data/sdvico-showcase.ts) làm dữ
-- liệu khởi điểm — admin sửa/ẩn/thêm tiếp từ đây, KHÔNG mất nội dung đang có.
insert into public.product_listings
  (id, vendor_kind, title, category, description, features, image_url, line, sort_order)
values
  ('b6e1a1a0-1111-4a11-8a11-000000000001', 'sdvico',
   'Máy lọc nước biển SEA-40', 'Máy lọc nước biển',
   'Máy lọc nước biển thành nước ngọt công suất 40L/h',
   '["Công nghệ RO tiên tiến","Hoạt động bằng điện 220VAC/380VAC","Thiết kế gọn, hợp tàu thuyền"]',
   '/sdvico/sea40.jpg', 'loc-nuoc', 0),
  ('b6e1a1a0-1111-4a11-8a11-000000000002', 'sdvico',
   'Thiết bị GSHT tàu cá VIETTEL S-Tracking', 'Giám sát hành trình',
   'Thiết bị giám sát hành trình tàu cá theo quy định, hỗ trợ định vị và truyền dữ liệu ngoài khơi',
   '["Định vị GPS chính xác","Truyền dữ liệu qua di động và vệ tinh","Chống nước IP67"]',
   '/sdvico/s-tracking.jpg', 'giam-sat', 1),
  ('b6e1a1a0-1111-4a11-8a11-000000000003', 'sdvico',
   'Thuraya Marine Star MNB-01', 'Liên lạc vệ tinh',
   'Thiết bị liên lạc vệ tinh chuyên dụng cho tàu thuyền và ngành hàng hải',
   '["Gọi qua vệ tinh giữa biển","Thoại ổn định, GPS tích hợp","Hợp môi trường hàng hải"]',
   '/sdvico/thuraya.jpg', 'dien-thoai-ve-tinh', 2),
  ('b6e1a1a0-1111-4a11-8a11-000000000004', 'sdvico',
   'Điện thoại vệ tinh XT-Pro', 'Liên lạc vệ tinh',
   'Điện thoại vệ tinh di động cao cấp cho khu vực không có sóng di động',
   '["Kết nối toàn cầu","Siêu bền, GPS và SOS tích hợp","Hợp hoạt động ngoài khơi"]',
   '/sdvico/xt-pro.jpg', 'dien-thoai-ve-tinh', 3),
  ('b6e1a1a0-1111-4a11-8a11-000000000005', 'sdvico',
   'Thiết bị lọc dầu SF-50', 'Thiết bị lọc dầu',
   'Thiết bị lọc dầu công suất 50L/h, hỗ trợ tối ưu vận hành và giảm chi phí',
   '["Hiệu suất lọc cao","Tiết kiệm năng lượng","Giảm chi phí vận hành"]',
   '/sdvico/sf50.jpg', 'xu-ly-dau', 4),
  ('b6e1a1a0-1111-4a11-8a11-000000000006', 'sdvico',
   'PV ENGINE RMI Nano Graphene', 'Dầu nhờn động cơ',
   'Dầu nhờn bôi trơn động cơ cao cấp với công nghệ Nano Graphene',
   '["Công nghệ Nano Graphene","Giảm ma sát, tiết kiệm dầu chạy","Bảo vệ động cơ khỏi hao mòn"]',
   '/sdvico/nano-graphene.jpg', 'nhot', 5)
on conflict (id) do nothing;
