-- 0038 — VÙNG NÀO LÀ RANH GIỚI DÙNG ĐỂ CẢNH BÁO (2026-08-25)
--
-- Vì sao cần: từ 2026-07-28 biên trên bản đồ = 3 vùng VMS do admin quản lý,
-- nhưng cảnh báo IUU (`lib/geofence`) vẫn đo theo dữ liệu tĩnh SDVico gửi kèm
-- app. Muốn admin đổi được biên thì app phải biết TRONG SỐ các vùng, vùng nào
-- là "ranh giới" — hai vùng còn lại (Cần chú ý / Chỉ cá đáy) là lớp lưu ý, lấy
-- hợp của cả ba sẽ ra một vùng vô nghĩa và app sẽ báo "đã ngoài ranh giới" trên
-- gần hết vùng biển VN.
--
-- Ý nghĩa: `is_border = true` ⇒ hình của vùng này ĐỊNH NGHĨA ranh giới cảnh báo.
--  · Vùng KÍN (Polygon/MultiPolygon) — nên dùng: một hình cho cả hai việc, vừa
--    đo khoảng cách tới viền vừa biết điểm nằm trong hay ngoài.
--  · Chỉ là ĐƯỜNG (LineString) — app vẫn đo được khoảng cách nhưng KHÔNG dám
--    khẳng định trong/ngoài (đường hở thì không có "bên trong"), nên sẽ không
--    hiện câu "đã ngoài ranh giới".
--
-- Không đánh dấu vùng nào ⇒ app giữ nguyên hành vi cũ: dùng dữ liệu tĩnh
-- `src/data/vms-zones.json`. Đây là đường lùi an toàn, KHÔNG phải trạng thái lỗi.
--
-- ⚠️ CHƯA APPLY lên prod (project znzgugvfhgmiszqgjulk) — theo luật repo, agent
-- không tự chạy migration. Mã đọc/ghi đều có nhánh lùi khi cột chưa tồn tại nên
-- deploy trước khi apply vẫn chạy bình thường.

alter table public.vms_zones
  add column if not exists is_border boolean not null default false;

comment on column public.vms_zones.is_border is
  'true = hình vùng này định nghĩa ranh giới dùng cho cảnh báo IUU trên app ngư dân. Nên là vùng KÍN để app biết trong/ngoài.';

-- Chỉ số nhỏ: app chỉ cần lọc ra các vùng biên đang hiện.
create index if not exists vms_zones_is_border_idx
  on public.vms_zones (is_border)
  where is_border = true;
