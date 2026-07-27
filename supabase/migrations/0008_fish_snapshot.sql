-- SDFish — SNAPSHOT DỰ BÁO CÁ tính sẵn (2026-07-26, precompute).
--
-- Vì sao: /api/fish-forecast tính TẠI CHỖ kéo 7 nguồn (NOAA ERDDAP + HYCOM
-- OPeNDAP + Copernicus Zarr) — nặng + hay treo → lần lạnh chậm/hỏng, client 35s
-- hủy → "dự báo cá chưa tải được". Nay CRON (/api/cron/refresh-fish, GitHub
-- Actions 6h + Vercel cron) tính sẵn rồi GHI 1 dòng singleton id='latest';
-- /api/fish-forecast chỉ ĐỌC dòng này (nhanh, không phụ thuộc nguồn treo), chưa
-- có thì tự tính fallback (không bao giờ trắng bản đồ).
--
-- Đọc/ghi CHỈ qua service-role (route server-to-server, lib/fish-snapshot.ts).
-- Dữ liệu KHÔNG cá nhân (bản đồ cá vùng biển) nhưng vẫn để nội bộ: bật RLS,
-- KHÔNG policy nào → client thường không đọc trực tiếp.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.fish_forecast_snapshot (
  id            text primary key default 'latest',
  payload       jsonb not null,               -- payload y hệt /api/fish-forecast
  target_date   date,                          -- ngày ảnh (mốc so "không lùi ngày")
  data_quality  real,
  generated_at  timestamptz,                   -- lúc cron TÍNH bản này
  updated_at    timestamptz not null default now()
);

alter table public.fish_forecast_snapshot enable row level security;
