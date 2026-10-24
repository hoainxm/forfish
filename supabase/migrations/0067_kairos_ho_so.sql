-- SDFish — KAIROS: TRANG CÁ NHÂN KIỂU FACEBOOK (2026-10-24)
--
-- Anh Long hỏi "trang này đã đủ tương tự fb chưa" (ảnh: chỉ vòng chữ "B", "Bà con 5689", "0 bài").
-- Câu trả lời đã chốt cần thêm vào kairos_profiles (14-ba-spec-kairos §3.8, §6; AC13 bản 2026-10-24):
--   cover_path  — ảnh bìa, đường kho kairos-media '<profileId>/<uuid>.<ext>' (như avatar_path)
--   que_tinh    — quê, mã 34 tỉnh sau sáp nhập (lib/kairos/khu-vuc.mjs PROVINCES — khớp từng ký tự)
--   nghe        — nghề, mã lib/kairos/ho-so.ts NGHE (khớp từng ký tự)
--   gioi_thieu  — một dòng tự giới thiệu ≤150 ký tự (route lọc chữ bậy + chủ quyền)
--   home_port   — cảng nhà chủ tự chọn, mã src/data/fishing-ports.ts (route kiểm danh mục; DB chỉ
--                 trần độ dài vì danh mục là TS). Có ⇒ thắng cảng theo sổ tàu ở dòng phụ.
-- Số người theo dõi / đang theo dõi đếm từ kairos_follows (0065) — không cột mới.
-- Cờ agent AI (16-ba-spec-agent-kairos, nháp): CHƯA có cột — DTO `isAgent` luôn false.
--
-- Chạy lại an toàn: `add column if not exists` (cột đã có ⇒ bỏ qua cả check đi kèm).
-- Auth: khuôn 0065 — RLS đã bật trên kairos_profiles, KHÔNG policy mới, client không chạm bảng;
-- mọi đọc/ghi qua route service-role.
-- Deploy có thể đi TRƯỚC migration: kho Supabase thấy cột thiếu (42703) ⇒ đọc bằng cột gốc, trang
-- vẫn hiện (Giới thiệu trống); ghi trường mới ⇒ 503 `fields_missing`.
--
-- ⛔ CHƯA APPLY. Áp bằng tay (SQL Editor) — anh Long duyệt. Xem docs/app-map/04-data-model.md mục KAIROS.

alter table public.kairos_profiles
  add column if not exists cover_path text
    check (cover_path is null or char_length(cover_path) <= 200),
  add column if not exists que_tinh text
    check (que_tinh is null or que_tinh in (
      'ha-noi','hue','lai-chau','dien-bien','son-la','lang-son','cao-bang','quang-ninh','thanh-hoa','nghe-an',
      'ha-tinh','tuyen-quang','lao-cai','thai-nguyen','phu-tho','bac-ninh','hung-yen','hai-phong','ninh-binh',
      'quang-tri','da-nang','quang-ngai','gia-lai','khanh-hoa','lam-dong','dak-lak','ho-chi-minh','dong-nai',
      'tay-ninh','can-tho','vinh-long','dong-thap','ca-mau','an-giang')),
  add column if not exists nghe text
    check (nghe is null or nghe in ('cau-muc','luoi-vay','luoi-re','luoi-keo','cau-tay','lan','nuoi-trong','thu-mua','khac')),
  add column if not exists gioi_thieu text
    check (gioi_thieu is null or char_length(gioi_thieu) between 1 and 150),
  add column if not exists home_port text
    check (home_port is null or char_length(home_port) between 1 and 60);

comment on column public.kairos_profiles.cover_path is 'Kairos: ảnh bìa trang cá nhân — đường kho kairos-media <profileId>/<uuid>.<ext>.';
comment on column public.kairos_profiles.que_tinh is 'Kairos: quê — mã tỉnh (lib/kairos/khu-vuc.mjs).';
comment on column public.kairos_profiles.nghe is 'Kairos: nghề — mã lib/kairos/ho-so.ts NGHE.';
comment on column public.kairos_profiles.gioi_thieu is 'Kairos: một dòng tự giới thiệu ≤150 ký tự (đã lọc chữ bậy + chủ quyền ở route).';
comment on column public.kairos_profiles.home_port is 'Kairos: cảng nhà chủ tự chọn (fishing-ports.ts id) — thắng cảng theo sổ tàu.';

-- RLS: bật sẵn từ 0065 (nhắc lại vô hại, giữ khuôn) — không thêm policy.
alter table public.kairos_profiles enable row level security;
revoke all on table public.kairos_profiles from anon, authenticated;
