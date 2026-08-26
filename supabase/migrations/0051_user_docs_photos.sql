-- SDFish — ẢNH GIẤY TỜ (P3 của docs/specs/dong-bo-so-per-may.md, 2026-08-26).
--
-- Tủ giấy tờ (kind='documents' trong user_docs, 0050) nay đính ẢNH chụp giấy tờ.
-- Ảnh KHÔNG nhét vào jsonb (nặng, tốn băng thông sóng yếu) — để RIÊNG ở Supabase
-- Storage bucket private; document.photos[] chỉ giữ ĐƯỜNG DẪN (path), đồng bộ nhẹ
-- qua user_docs như P2. Bytes đọc/ghi qua ROUTE service-role /api/me/docs/photo
-- (identityFromRequest theo SĐT; path = <owner_phone>/<docId>/<uuid>).
--
-- RIÊNG TƯ: bucket `public=false`, KHÔNG policy cho anon/authenticated → chỉ
-- service-role (route đã kiểm owner theo SĐT) đọc/ghi. Không ai đoán path xem
-- được ảnh người khác. privacy policy /quyen-rieng-tu đã khai (App Store 5.1.2).
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).
-- Nếu apply bằng dashboard: có thể tạo bucket "user-docs" (Private) ở tab Storage
-- thay cho câu insert dưới; RLS storage.objects giữ MẶC ĐỊNH (không policy public).

insert into storage.buckets (id, name, public)
values ('user-docs', 'user-docs', false)
on conflict (id) do nothing;

-- KHÔNG tạo policy trên storage.objects cho anon/authenticated: mọi truy cập đi
-- service-role qua route. (Muốn client-direct sau này thì thêm policy theo tiền
-- tố path = SĐT, KHÔNG mở public.)
