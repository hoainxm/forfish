-- SDFish — CHỢ TIN MUA/BÁN đổi CHỦ TIN sang SĐT (2026-08-16, thẩm định P0).
--
-- VÌ SAO: bảng 0008 định danh chủ tin bằng `owner_id uuid` = `auth.uid()`, và
-- RLS dựng trên đó — kể cả chiều ĐỌC (`status='open' and auth.uid() is not
-- null`). Từ 0026 app ngư dân KHÔNG CÒN PHIÊN Supabase: `/login` cấp chuỗi cứng
-- rồi `signOut()` ngay, nên `auth.uid()` là NULL trên mọi máy bà con. Hệ quả
-- đang chạy trên prod:
--   · KHÔNG AI đọc được tin thật — cả chợ chỉ thấy TIN MẪU minh hoạ;
--   · KHÔNG AI đăng/sửa/xoá được tin (insert/update/delete đều tựa `auth.uid()`).
-- Tức trục 2 "bán được đắt hơn" đang câm, mà không một câu báo lỗi nào.
--
-- CÁCH CHỮA: chủ tin định danh bằng `owner_phone` (SĐT chuẩn hoá từ device
-- token), giống `catalog_orders.customer_phone` (0033). App đi qua route server
-- `/api/me/market-listings` (identityFromRequest + service-role), KHÔNG chạm
-- bảng trực tiếp nữa — cùng khuôn với đơn hàng và product_inquiries.
--
-- RLS: GIỮ NGUYÊN các policy 0008. Service-role bypass RLS nên route vẫn chạy;
-- policy cũ vẫn đúng cho ai còn phiên thật (khu quản trị, và 15 máy đường lùi).
-- KHÔNG mở policy anon: bảng có SĐT người thật, chỉ đọc qua route.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).
--
-- ═══ ĐO TRÊN PROD 2026-08-17 (chỉ SELECT, read-only) ═══
-- Hai số liệu làm đổi cách đọc migration này:
--  · Cột `owner_phone` **ĐÃ TỒN TẠI** trên prod. Kiểm bằng đối chứng:
--      select=id,owner_phone            → 200
--      select=id,cot_khong_ton_tai_xyz  → 400 / 42703
--    Nên `add column if not exists` ở đây là **no-op trên prod**; phần còn tác
--    dụng là INDEX + comment, và file vẫn cần cho môi trường dựng mới.
--  · Bảng `market_listings` **RỖNG — 0 hàng**. Đây là BẰNG CHỨNG THỰC ĐỊA cho
--    chẩn đoán P0: từ 0026 không ai đăng nổi một tin nào (RLS insert đòi
--    `auth.uid()=owner_id`, mà `auth.uid()` luôn NULL). Kéo theo: câu `update …
--    from auth.users` bên dưới không có hàng nào để backfill — giữ lại cho môi
--    trường khác, không phải việc cần làm trên prod.
--
-- Vì cột đã có, route `/api/me/market-listings` chạy được NGAY trên prod (đã
-- kiểm: GET → 200 `{ok:true, listings:[]}`; POST không token → 401 `no_token`).
-- Thiếu index chỉ chậm chút, không hỏng gì.

alter table public.market_listings
  add column if not exists owner_phone text;

comment on column public.market_listings.owner_phone is
  'SĐT chủ tin (chuẩn hoá 0xxxxxxxxx, từ device token). Nguồn định danh CHÍNH từ 2026-08-16; owner_id giữ lại cho tin cũ + đường lùi phiên.';

-- Tin cũ: suy SĐT từ email ảo của tài khoản đã đăng (phoneToEmail: 090…@sdvico.local).
-- Chỉ chạy được khi còn hàng trong auth.users; tin webhook (owner_id null) bỏ qua.
update public.market_listings m
   set owner_phone = split_part(u.email, '@', 1)
  from auth.users u
 where m.owner_id = u.id
   and m.owner_phone is null
   and u.email like '%@%';

create index if not exists market_listings_owner_phone_idx
  on public.market_listings (owner_phone);
