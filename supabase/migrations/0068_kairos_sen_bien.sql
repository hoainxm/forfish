-- SDFish — KAIROS: HỒ SƠ SEN BIỂN (2026-10-24)
--
-- Anh Long 2026-10-24: "tổ chức cho con gpu thêm 1 task là cho sen biển giới thiệu về mạng xã hội dành riêng cho bà
-- con, đọc báo, trợ lý ...". Sen Biển — trợ lý của SDVICO — đăng một bài giới thiệu app/Kairos mỗi ngày qua
-- /api/kairos/sen-bien (khoá ingest, máy GPU). Bài đứng tên hồ sơ này, dấu "Chính thức" (official).
-- Khuôn hồ sơ SDVICO ở 0065: phone là SENTINEL (không phải SĐT thật), đã đồng ý nội quy.
-- Chạy lại an toàn (on conflict do nothing). Không đổi cấu trúc bảng.

insert into public.kairos_profiles (phone, handle, handle_norm, official, rules_accepted_at)
values ('sen-bien:tro-ly', 'Sen Biển', 'sen bien', true, now())
on conflict (phone) do nothing;
