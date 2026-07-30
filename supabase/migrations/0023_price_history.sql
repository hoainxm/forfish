-- SDFish — KHO LỊCH SỬ GIÁ CÁ tích luỹ (2026-07-29).
--
-- Vì sao: biểu đồ giá (kiểu chứng khoán) ở Trục 2 cần chuỗi giá tuần dài. Kho
-- bản tin VASEP chỉ giữ ~13 tuần gần nhất trên trang danh sách; muốn lịch sử
-- dài dần thì phải LƯU lại. Cron /api/cron/snapshot-prices (GitHub Actions,
-- tuần 1 lần) gom các tuần VASEP rồi UPSERT vào bảng này (idempotent theo khoá
-- (week_end, species_id)). Tuần cũ rơi khỏi listing VASEP vẫn còn ở đây → lịch
-- sử chỉ dài thêm, không bao giờ ngắn lại.
--
-- Dữ liệu là GIÁ THAM KHẢO CÔNG KHAI (không cá nhân) → RLS bật + policy SELECT
-- cho mọi người đọc; GHI chỉ qua service-role (cron server-to-server, bypass
-- RLS). Chưa apply migration / chưa cấu hình env → lib degrade êm, route lùi về
-- gom kho VASEP trực tiếp = hành vi trước khi có DB.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.price_history (
  week_end    date not null,            -- NGÀY CUỐI tuần bản tin (trục thời gian)
  species_id  text not null,            -- id loài trong app (khớp data/port-prices)
  min_vnd     integer not null,
  max_vnd     integer not null,
  province    text,                     -- tỉnh bản tin, vd "Khánh Hòa"
  source      text not null default 'vasep',
  created_at  timestamptz not null default now(),
  primary key (week_end, species_id)
);

alter table public.price_history enable row level security;

-- Giá tham khảo công khai — ai cũng đọc được (kể cả chưa đăng nhập)
drop policy if exists price_history_read on public.price_history;
create policy price_history_read on public.price_history
  for select using (true);

-- Truy vấn biểu đồ hay lọc theo loài rồi sắp theo tuần
create index if not exists price_history_species_idx
  on public.price_history (species_id, week_end);
