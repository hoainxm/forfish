-- SDFish — LƯU LỊCH SỬ dữ liệu tab Ra khơi (yêu cầu 2026-07-02: tích luỹ để
-- predict sau này). Cron gọi /api/collect/sea-daily 1 lần/ngày, ghi bằng
-- service-role (bypass RLS). App KHÔNG đọc các bảng này (Đợt này chỉ THU);
-- predict đọc thẳng qua service-role / notebook. RLS bật, không policy anon —
-- client không đọc/ghi được.
-- Xem docs/app-map/04-data-model.md §5c.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).

-- ── sea_daily: dự báo biển theo CẢNG × NGÀY (10 cảng src/data/ports.ts) ────
-- Mỗi lần thu ghi cả dải 10 ngày dự báo (lead_days 0–9): sau này so dự báo xa
-- với thực tế gần (lead 0) là có ngay bộ dữ liệu đánh giá độ tin + train.
create table if not exists public.sea_daily (
  id           bigint generated always as identity primary key,
  collected_on date not null,                  -- ngày thu (giờ VN)
  port_id      text not null,                  -- slug cảng, vd "vung-tau"
  date         date not null,                  -- ngày được dự báo
  lead_days    smallint not null,              -- date - collected_on (0 = hôm nay)
  wave_max_m   real,
  wind_max_kmh real,
  gust_max_kmh real,
  precip_mm    real,
  wmo_code     smallint,                       -- mã thời tiết WMO (dông ≥95)
  score        smallint,                       -- điểm đi biển 1–100 (lib/sea scoreDay)
  created_at   timestamptz not null default now(),
  unique (collected_on, port_id, date)         -- idempotent: thu lại trong ngày = ghi đè
);
create index if not exists sea_daily_port_date_idx on public.sea_daily (port_id, date);

-- ── fish_forecast_daily: điểm nóng PFZ theo NGÀY (nguồn NOAA qua lib thuần) ─
-- Chỉ lưu Ô ĐẠT NGƯỠNG hiển thị (s ≥ 55, trùng client) — không lưu cả lưới thô.
create table if not exists public.fish_forecast_daily (
  id           bigint generated always as identity primary key,
  collected_on date not null,
  source_date  date not null,                  -- ngày ảnh vệ tinh (FishForecast.date)
  lat          real not null,
  lon          real not null,
  score        smallint not null,              -- 0–100 (loài tốt nhất tại ô)
  top_species  text[] not null default '{}',   -- loài đạt ngưỡng, mạnh nhất trước
  species_scores jsonb,                        -- điểm từng loài {"nuc": 72, ...}
  sst_c        real,                           -- nhiệt độ mặt nước °C
  chl_mg_m3    real,                           -- phù du mg/m³ (null nếu thiếu)
  created_at   timestamptz not null default now(),
  unique (collected_on, lat, lon)
);
create index if not exists fish_daily_collected_idx on public.fish_forecast_daily (collected_on);

-- ── storm_events: bão / áp thấp Biển Đông theo lần thu ─────────────────────
create table if not exists public.storm_events (
  id           bigint generated always as identity primary key,
  collected_on date not null,
  storm_id     text not null,                  -- id nguồn GDACS
  name         text not null,
  kind_label   text not null,                  -- "Bão" / "Áp thấp nhiệt đới"...
  wind_kmh     real,
  lat          real not null,
  lon          real not null,
  alert        text not null,                  -- "watch" | "danger"
  updated_src  text,                           -- mốc cập nhật phía nguồn
  created_at   timestamptz not null default now(),
  unique (collected_on, storm_id)
);

-- ── RLS: bật cho cả 3, KHÔNG mở policy nào — chỉ service-role đọc/ghi ──────
alter table public.sea_daily            enable row level security;
alter table public.fish_forecast_daily  enable row level security;
alter table public.storm_events         enable row level security;
