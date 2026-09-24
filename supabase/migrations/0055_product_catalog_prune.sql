-- SDFish — DỌN danh mục sản phẩm (2026-09-24). Chủ dự án: chỉ giữ 11 sản phẩm
-- SDVICO trong tài liệu chính thức; xóa các sản phẩm SDVICO không liên quan còn
-- sót trong bảng (bộ đàm, máy dò cá, hàng test…). Sinh TỰ ĐỘNG từ
-- src/data/sdvico-showcase.ts (scripts/gen-product-seed.mjs) — đừng sửa tay.
--
-- GIỮ nguyên sản phẩm ĐƠN VỊ NGOÀI (vendor_kind='external'). Idempotent.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

delete from public.product_listings
where vendor_kind = 'sdvico'
  and id not in ('b6e1a1a0-2222-4a22-8a22-000000000001', 'b6e1a1a0-2222-4a22-8a22-000000000002', 'b6e1a1a0-2222-4a22-8a22-000000000003', 'b6e1a1a0-2222-4a22-8a22-000000000004', 'b6e1a1a0-2222-4a22-8a22-000000000005', 'b6e1a1a0-2222-4a22-8a22-000000000006', 'b6e1a1a0-2222-4a22-8a22-000000000007', 'b6e1a1a0-2222-4a22-8a22-000000000008', 'b6e1a1a0-2222-4a22-8a22-000000000009', 'b6e1a1a0-2222-4a22-8a22-000000000010', 'b6e1a1a0-2222-4a22-8a22-000000000011');
