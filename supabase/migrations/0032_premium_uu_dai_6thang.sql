-- SDFish — ĐỐI SOÁT KỲ HẠN PREMIUM sau ưu đãi +6 tháng (2026-08-04, chủ dự án chốt).
--
-- BỐI CẢNH: gói 500k nâng 1 năm → 1 NĂM 6 THÁNG (ưu đãi +6 tháng ~ giá trị 300k);
-- luật cấp MỚI đã đổi ở src/lib/tier.ts (PREMIUM_TERM_DAYS 365 → 548). Gói 300k
-- giữ 1 NĂM.
--
-- ĐÃ XẢY RA: bản +6 tháng chạy trước đó với danh sách loại trừ CŨ (0384668304 +
-- 0383148503 — số thứ 2 GHI NHẦM). Hệ quả trên DB (SELECT 2026-08-04):
--   · 11 account 500k → cấp+18 tháng (≈1.5 năm) = ĐÚNG, giữ nguyên.
--   · 0384668304 (300k) → loại trừ, còn 2027-08-04 = 1 năm = ĐÚNG.
--   · 0376002882 (300k, đáng lẽ loại trừ) → BỊ +6 tháng nhầm, giờ 2028-02-02 =
--     1.5 năm. PHẢI cắt về 2027-08-02 = cấp+12 tháng (trừ 6 tháng).
-- Mỗi lần +6 tháng ghi 1 dòng premium_grants (granted_by=
-- 'migration-0032-uu-dai-6thang') → dấu này thành "lượt cấp gần nhất" của 12
-- khách, CHIẾM credit trên màn "Premium theo người cấp" (staff thật hiện quản 0).
--
-- MIGRATION NÀY (chạy SAU bản +6 tháng, đối soát):
--   1. Cắt 0376002882 về đúng 1 năm (chỉ khi đang ~18 tháng — idempotent, chạy
--      lại bỏ qua). KHÔNG ghi thêm dấu log để tránh bẩn báo cáo tiếp.
--   2. Xoá 12 dòng log dấu migration +6 tháng → trả credit "người cấp" về staff
--      thật. Cột premium_until (đã +6 tháng) KHÔNG bị đụng — chỉ dọn log.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng thủ công (CLAUDE.md, pre-flight
--    🔴 DB/migration, ref znzgugvfhgmiszqgjulk). Đây là quyền lợi KH đã trả tiền.

begin;

-- 1) Cắt 0376002882 (gói 300k) về đúng 1 năm — chốt chặn >13 tháng để idempotent.
update public.customers
set premium_until = premium_until - interval '6 months',
    updated_at    = now()
where phone = '0376002882'
  and tier = 'premium'
  and premium_until is not null
  and premium_until > now() + interval '13 months';

-- 2) Dọn dấu log của bản +6 tháng — khôi phục đúng "người cấp" cho 12 khách.
--    (premium_until đã cộng vẫn giữ; chỉ xoá dòng log đối soát.)
delete from public.premium_grants
where granted_by = 'migration-0032-uu-dai-6thang';

commit;
