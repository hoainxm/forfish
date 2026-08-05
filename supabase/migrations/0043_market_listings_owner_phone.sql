-- SDFish — CHỢ TIN MUA/BÁN chuyển sang ĐỊNH DANH THEO SĐT (2026-08-05).
--
-- VÌ SAO: sau bản chuỗi-cứng (0037), app KHÔNG còn giữ phiên Supabase — `/login`
-- cấp chuỗi rồi `signOut()` ngay, nên `auth.uid()` là NULL vĩnh viễn trên máy bà
-- con. Cột `owner_id` (auth.users) + RLS `auth.uid() = owner_id` do đó không bao
-- giờ khớp: người ĐANG đăng nhập vẫn bị "Cần đăng nhập để đăng tin", và cả feed
-- (RLS signed-in read) cũng rỗng. Cả app đã dời sang định danh theo SĐT
-- (customer_phone: devices/supplies/push_messages…). Chợ tin nay theo cùng luật.
--
-- Ghi/đọc từ nay đi qua ROUTE SERVER (/api/market-listings) bằng service-role +
-- chuỗi cứng (identityFromRequest), KHÔNG còn client-direct. RLS giữ nguyên làm
-- lá chắn tầng hai (client ẩn danh không đọc/ghi thẳng được).
--
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

-- SĐT chủ tin (đã chuẩn hoá 0xxxxxxxxx). NULL = tin webhook thu mua (như owner_id).
alter table public.market_listings
  add column if not exists owner_phone text;

create index if not exists market_listings_owner_phone_idx
  on public.market_listings (owner_phone);

-- Backfill tin cũ (owner_id → owner_phone) từ email ảo {SĐT}@sdvico.local.
-- An toàn chạy lại: chỉ đụng hàng còn thiếu owner_phone mà có owner_id.
update public.market_listings ml
   set owner_phone = split_part(u.email, '@', 1)
  from auth.users u
 where ml.owner_id = u.id
   and ml.owner_phone is null;
