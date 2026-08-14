-- SDFish — DANH MỤC ĐẶT HÀNG ĐƯỢC (2026-08-11). Nâng tab "Sản phẩm" /tau từ
-- "hỏi mua/gọi lại" thành CHỢ ĐẶT HÀNG THẬT: chủ tàu chọn số lượng → đặt →
-- nhà cung cấp (SDVICO, 1 NCC — MVP) nhận đơn và giao (xem 0033_catalog_orders).
--
-- MỞ RỘNG bảng product_listings sẵn có (0010) thay vì tạo bảng danh mục mới:
--   · group      — tách 3 nhóm hiện trên Cửa hàng: điện tử / cơ điện / nhu yếu
--                  phẩm. NULL = dòng cũ chưa gán nhóm (vẫn hiện, gom "Khác").
--   · price_vnd  — GIÁ SỐ (đơn hàng cần để tính tổng). NULL = chưa niêm yết giá
--                  số → KHÔNG đặt được, giữ luồng "hỏi mua/gọi lại" cũ.
--   · unit       — đơn vị bán (kg, lít, thùng, cái…). Bắt buộc khi orderable.
--   · orderable  — có nút "Thêm vào giỏ" hay không. DEFAULT false ⇒ mọi dòng cũ
--                  GIỮ NGUYÊN hành vi hiện tại (backward-safe, không vỡ Cửa hàng).
--
-- Auth: KHÔNG đổi RLS — vẫn đọc công khai (visible=true), ghi qua service-role
-- trong /api/admin/products (requirePermission 'san-pham'). Xem 04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

alter table public.product_listings
  add column if not exists "group" text
    check ("group" in ('dien_tu', 'co_dien', 'nhu_yeu_pham')),
  add column if not exists price_vnd integer
    check (price_vnd is null or price_vnd >= 0),
  add column if not exists unit text,
  add column if not exists orderable boolean not null default false;

-- Lọc nhanh danh mục đặt được theo nhóm (Cửa hàng gom nhóm).
create index if not exists product_listings_orderable_idx
  on public.product_listings (orderable, "group", sort_order)
  where orderable = true and visible = true;
