-- SDFish — KHO BẢN TIN BÃO để vẽ đường đi như web bão chuyên nghiệp (2026-08-18).
--
-- VÌ SAO (chủ dự án): *"nên có DB lưu các bản tin để vẽ cho chuẩn — bão A có tin
-- lúc nào, tâm bão thời gian nào, bán kính bao nhiêu, hướng di chuyển nào; lúc
-- update thì update phần mới"* và *"cái bão đã đi qua và sắp tới, cứ mỗi lần
-- update thì hiệu chỉnh phần sắp tới thôi"*.
--
-- Trước bản này app chỉ giữ BẢN TIN MỚI NHẤT trong bộ nhớ + cache SW: mỗi lượt
-- hỏi là ghi đè, nên KHÔNG BAO GIỜ vẽ được đoạn đường cơn bão ĐÃ ĐI — đúng thứ
-- làm bản đồ trông trơ so với các web bão khác.
--
-- HÌNH DẠNG BÁM ĐÚNG BẢN TIN, KHÔNG BỊA THÊM:
--   · `storm_bulletins`       — MỘT HÀNG = MỘT BẢN TIN, BẤT BIẾN (chỉ insert).
--     Đường ĐÃ ĐI = nối `lat/lon` các hàng của cùng `storm_key` theo `issued_at`.
--   · `storm_forecast_points` — các mốc dự báo CỦA bản tin đó.
--     Đường SẮP TỚI = mốc của bản tin MỚI NHẤT ⇒ tin mới chỉ đụng phần này.
--
-- ⚠️ `radius_km` NULLABLE và thường NULL: bản tin ÁP THẤP NHIỆT ĐỚI của NCHMF
-- KHÔNG phát bán kính gió mạnh (đã đo trên bản tin thật 18/8). Thứ nguồn CÓ
-- phát là VÙNG NGUY HIỂM dạng khung toạ độ (`danger_box`) — vẽ cái đó mới là
-- vẽ số của cơ quan chịu trách nhiệm. Mượn sai số dự báo của JMA/NHC để vẽ
-- vòng tròn là tự nhận một trách nhiệm mình không có, ở chỗ dính tính mạng.
--
-- RLS: bật, KHÔNG policy — client KHÔNG đọc thẳng. App đọc qua `/api/storms`
-- (service-role), cron ghi qua `/api/cron/refresh-storms`. Cùng khuôn
-- `fish_forecast_snapshot` / `weather_snapshot`.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.storm_bulletins (
  id           uuid primary key default gen_random_uuid(),
  -- gom bản tin về cùng một cơn: "bao-so-5-2026" (bão có số) hoặc
  -- "atnd-20260818" (ATNĐ — nguồn không đặt tên, xem `stormKeyFor`)
  storm_key    text        not null,
  -- giờ PHÁT bản tin ("Tin phát lúc: 08h00 ngày 18/8")
  issued_at    timestamptz not null,
  -- giờ QUAN TRẮC tâm ("Hồi 07 giờ") — sớm hơn giờ phát ~1 giờ
  observed_at  timestamptz,
  la_bao       boolean     not null default false,
  so_bao       text,
  lat          numeric(6,3) not null,
  lon          numeric(6,3) not null,
  cap          smallint,          -- cấp gió (Beaufort)
  giat         smallint,          -- cấp giật
  dir          text,              -- hướng di chuyển ("Tây Tây Bắc")
  speed_kmh    smallint,
  radius_km    smallint,          -- chỉ khi bản tin BÃO ghi thẳng
  danger_box   jsonb,             -- {latMin,latMax,lonMin,lonMax}
  risk         smallint,          -- cấp độ rủi ro thiên tai 1..5
  source       text        not null default 'nchmf',
  url          text,
  raw_text     text,              -- để soi lại khi parser lệch
  created_at   timestamptz not null default now(),
  -- MỘT BẢN TIN GHI ĐÚNG MỘT LẦN: cron chạy 30 phút/lần trong khi nguồn phát
  -- 3–6 giờ/lần, nên phần lớn lượt là ghi trùng — unique lo, không cần đọc trước
  unique (storm_key, issued_at)
);

create index if not exists storm_bulletins_key_time_idx
  on public.storm_bulletins (storm_key, issued_at desc);
create index if not exists storm_bulletins_issued_idx
  on public.storm_bulletins (issued_at desc);

create table if not exists public.storm_forecast_points (
  id           uuid primary key default gen_random_uuid(),
  bulletin_id  uuid not null references public.storm_bulletins (id) on delete cascade,
  valid_at     timestamptz,       -- "07 giờ ngày 19/8"
  lat          numeric(6,3) not null,
  lon          numeric(6,3) not null,
  cap          smallint,
  giat         smallint,
  dir          text,
  speed_kmh    smallint,
  danger_box   jsonb,
  seq          smallint not null default 0   -- thứ tự trong bảng dự báo
);

create index if not exists storm_forecast_points_bulletin_idx
  on public.storm_forecast_points (bulletin_id, seq);

alter table public.storm_bulletins       enable row level security;
alter table public.storm_forecast_points enable row level security;
-- KHÔNG policy: đọc/ghi chỉ qua route server bằng service-role.

comment on table public.storm_bulletins is
  'Bản tin bão/ATNĐ đã phát (NCHMF). BẤT BIẾN — chỉ insert. Nối theo storm_key + issued_at để vẽ đường ĐÃ ĐI.';
comment on column public.storm_bulletins.danger_box is
  'Vùng nguy hiểm do NGUỒN phát (khung toạ độ), KHÔNG phải bán kính suy diễn.';
comment on table public.storm_forecast_points is
  'Các mốc dự báo của MỘT bản tin — đường SẮP TỚI. Tin mới ⇒ hàng mới, phần đã đi giữ nguyên.';
