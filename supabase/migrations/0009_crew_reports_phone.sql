-- SDFish — CẢNH BÁO THUYỀN VIÊN: định danh bằng CCCD HOẶC SĐT (2026-07-27).
-- Chốt với chủ dự án: nhiều bạn thuyền không đưa CCCD nhưng có SĐT → cho phép
-- tra/báo theo 1 TRONG 2. Thêm khoá tra theo SĐT (hash riêng, tiền tố "phone:"
-- tách miền khỏi hash CCCD). CCCD giờ KHÔNG còn bắt buộc ở cấp bảng (bắt buộc
-- "ít nhất 1 định danh" qua check).
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).

alter table public.crew_reports
  alter column subject_cccd drop not null,
  alter column subject_cccd_hash drop not null,
  add column if not exists subject_phone       text,
  add column if not exists subject_phone_hash  text;

-- ít nhất một định danh (CCCD hoặc SĐT) — không cho hàng "vô danh"
alter table public.crew_reports
  drop constraint if exists crew_reports_identity_check;
alter table public.crew_reports
  add constraint crew_reports_identity_check
  check (subject_cccd_hash is not null or subject_phone_hash is not null);

-- tra theo SĐT (song song với index hash CCCD sẵn có)
create index if not exists crew_reports_phone_hash_status_idx
  on public.crew_reports (subject_phone_hash, status);
