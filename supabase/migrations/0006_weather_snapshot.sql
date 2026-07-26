-- SDFish — SNAPSHOT THỜI TIẾT Open-Meteo (2026-07-26, LƯỚI AN TOÀN).
--
-- Vì sao: dự báo biển theo cảng + lưới Windy lấy THẲNG Open-Meteo từ CLIENT
-- (nhanh, tải phân tán theo IP từng máy — tốt cho rate-limit). Nhưng khi live
-- lỗi mà máy chưa có bản localStorage thì bà con trắng tay. Cron
-- (/api/cron/refresh-weather, Vercel cron) tính sẵn 1 bản rồi ghi vào đây;
-- client lùi về đây khi live hỏng (LIVE VẪN LÀ CHÍNH — khác dự báo cá dùng
-- snapshot làm chính).
--
-- Nhiều khoá 1 bảng: id = 'sea:<port>' (10 cảng, đủ 16 ngày) | 'grid:d3' (lưới
-- Windy CHỈ khung miễn phí — khung premium không snapshot công khai). Đọc/ghi
-- CHỈ qua service-role (client đọc qua /api/weather-snapshot). RLS bật, KHÔNG policy.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.weather_snapshot (
  id          text primary key,             -- 'sea:<port>' | 'grid:d3'
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.weather_snapshot enable row level security;
