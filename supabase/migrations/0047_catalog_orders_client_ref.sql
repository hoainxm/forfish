-- SDFish — CHỐNG ĐƠN TRÙNG khi sóng chập chờn (2026-08-16, thẩm định P1).
--
-- VÌ SAO: `POST /api/me/orders` không có khoá chống trùng. Ở cảng 3G, cú POST đi
-- tới máy chủ và ghi đơn THÀNH CÔNG nhưng phản hồi không về trong 20 giây ⇒
-- client báo "Chưa gửi được — cần có mạng, thử lại khi có sóng" ⇒ bà con bấm
-- lại ⇒ HAI ĐƠN THẬT: nhà cung cấp giao hai lần, thu tiền hai lần. Đây là ca
-- thường gặp nhất ở đúng nơi bà con đặt hàng (bến, trước lúc nhổ neo).
--
-- CÁCH CHỮA: client sinh `client_ref` cho mỗi GIỎ (một lần, giữ trong
-- localStorage cùng giỏ), gửi kèm mọi lần bấm Đặt. Unique (customer_phone,
-- client_ref) làm trọng tài ở tầng DB — bấm lại lần hai đụng unique, route đọc
-- lại đơn cũ và trả `ok:true` kèm chính id đó. Không có đơn thứ hai, và bà con
-- vẫn thấy "đã đặt" thay vì một câu lỗi khó hiểu.
--
-- Cột NULLABLE + unique index CÓ ĐIỀU KIỆN: đơn cũ (trước bản này) và mọi đơn
-- không mang ref vẫn hợp lệ, không cần backfill.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).
-- Trước khi apply, app chạy ở NHÁNH LÙI: route bỏ qua `client_ref` (cột chưa
-- có ⇒ insert vẫn chạy như cũ), tức hành vi y hệt hôm nay, không hỏng gì.

alter table public.catalog_orders
  add column if not exists client_ref text;

comment on column public.catalog_orders.client_ref is
  'Mã giỏ do MÁY của khách sinh (lib/cart.ts). Cùng (customer_phone, client_ref) = CÙNG MỘT lần đặt — chống đơn trùng khi mạng chập chờn.';

create unique index if not exists catalog_orders_client_ref_uniq
  on public.catalog_orders (customer_phone, client_ref)
  where client_ref is not null;
