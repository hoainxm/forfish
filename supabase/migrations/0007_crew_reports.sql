-- SDFish — CẢNH BÁO THUYỀN VIÊN CHÉO giữa chủ tàu (2026-07-27).
-- Một chủ tàu sau chuyến báo cáo vấn đề của thuyền viên (định danh CCCD); chủ
-- tàu KHÁC nhập CCCD trước khi thuê sẽ thấy cảnh báo ĐÃ KIỂM DUYỆT. Chốt với
-- chủ dự án: có kiểm duyệt (admin duyệt mới hiện) + người bị ghi được phản hồi;
-- CHỈ premium mới tra/báo cáo; người báo ẩn với người tra.
--
-- QUYỀN RIÊNG TƯ / NĐ 13/2023: CCCD là dữ liệu cá nhân. Khoá TRA là HASH(CCCD)
-- (pepper env CREW_CCCD_PEPPER) → không dò/duyệt được danh sách. CCCD thô +
-- tên chỉ để ADMIN duyệt và liên hệ người bị ghi. Đọc/ghi CHỈ qua service-role
-- (route /api/crew-reports*, /api/admin/crew-reports) — bảng bật RLS KHÔNG
-- policy client nào (giống fish_forecast_snapshot 0005).
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).

create table if not exists public.crew_reports (
  id                    uuid primary key default gen_random_uuid(),
  -- khoá TRA (không unique — một người có thể bị nhiều report)
  subject_cccd_hash     text not null,
  -- CCCD thô + tên: CHỈ để admin duyệt + liên hệ người bị ghi (không trả cho
  -- người tra). Lưu tối thiểu, không kèm dữ liệu nhạy cảm khác.
  subject_cccd          text not null,
  subject_name          text,
  -- người báo (ẩn với người tra; admin thấy để đối chất)
  reporter_phone        text not null,
  reporter_boat         text,
  -- nội dung
  category              text not null
    constraint crew_reports_category_check check (category in
      ('bo_tau','trom_cap','gay_roi','chat_kich_thich','no_ung','khac')),
  detail                text,
  -- kiểm duyệt: pending im lặng → approved (hiện) / rejected / withdrawn
  status                text not null default 'pending'
    constraint crew_reports_status_check check (status in
      ('pending','approved','rejected','withdrawn')),
  moderated_by          text,                      -- SĐT admin duyệt
  moderated_at          timestamptz,
  -- phản hồi/đính chính của người bị ghi (qua admin, v1)
  subject_response      text,
  subject_responded_at  timestamptz,
  created_at            timestamptz not null default now()
);

-- tra theo hash + chỉ lấy đã duyệt: index phủ đúng truy vấn lookup
create index if not exists crew_reports_hash_status_idx
  on public.crew_reports (subject_cccd_hash, status);
-- hàng chờ duyệt cho admin (mới nhất trước)
create index if not exists crew_reports_status_created_idx
  on public.crew_reports (status, created_at desc);

-- RLS bật + KHÔNG policy client: client thường không đọc/ghi trực tiếp; mọi
-- truy cập qua service-role trong route (đã gác premium + kiểm duyệt).
alter table public.crew_reports enable row level security;
