-- SDFish — ĐỐI SOÁT KỲ HẠN PREMIUM cho 0971516459 (2026-08-10, chủ dự án chốt).
--
-- BỐI CẢNH: khách 0971516459 chỉ mua gói 1 NĂM. Nhưng lúc tạo tài khoản,
-- /quan-tri CHƯA có ô chọn kỳ hạn — nút "Kích hoạt premium khi tạo" cấp cứng
-- theo mặc định 1 NĂM 6 THÁNG (18 tháng). Nay ô chọn kỳ hạn đã có (commit
-- de7c7d0), migration này CẮT hạn về đúng 1 năm cho SĐT đó.
--
-- CÁCH LÀM: trừ 6 tháng khỏi premium_until (18 → 12 tháng kể từ mốc kích hoạt)
-- — cùng khuôn với 0032. Neo theo premium_activated_at (KHÔNG theo now) để đúng
-- dù đã dùng vài tháng: khách kích hoạt tháng nào thì hạn mới = tháng đó + 1 năm.
--
-- IDEMPOTENT: chỉ cắt khi premium_until còn > mốc kích hoạt + 13 tháng (tức đang
-- ~18 tháng). Chạy lại sau khi đã cắt (còn ~12 tháng) → điều kiện sai → bỏ qua.
-- KHÔNG ghi thêm dòng premium_grants (giữ báo cáo "người cấp" sạch — cột hạn là
-- thứ duy nhất sai, không phải lượt cấp).
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng thủ công (CLAUDE.md, pre-flight
--    🔴 DB/migration, ref znzgugvfhgmiszqgjulk). Đây là quyền lợi KH đã trả tiền.

begin;

update public.customers
set premium_until = premium_until - interval '6 months',
    updated_at    = now()
where phone = '0971516459'
  and tier = 'premium'
  and premium_until is not null
  and premium_activated_at is not null
  and premium_until > premium_activated_at + interval '13 months';

commit;
