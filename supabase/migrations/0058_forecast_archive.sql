-- SDFish — KHO LƯU TRỮ DỰ BÁO THEO NGÀY (2026-10-10, chủ dự án: "lưu đầy đủ đi, để phục
-- vụ cho tối ưu sau này").
--
-- Vì sao: các bảng snapshot (weather_snapshot, fish_forecast_snapshot) GHI ĐÈ mỗi ngày;
-- fish_forecast_daily (0005) chỉ giữ ô nóng s ≥ 60, sea_daily chỉ 10 điểm cảng. Lưới gió/
-- sóng/mây/mưa/dòng chảy/độ mặn đầy đủ, bản đồ cá MỌI ô, và các lưới ĐẦU VÀO mô hình cá
-- (SST, phù du, SLA, HYCOM, Copernicus…) đều mất sau 24 h ⇒ không fit/kiểm định lại được
-- trên đúng cái production đã dùng (kiểm định DataLake 2026-10-10 phải DỰNG LẠI, thiếu
-- HYCOM/Copernicus).
--
-- Lưu FILE nén theo ngày ở Storage (không phải bảng): mỗi ngày vài MB, đọc lại bằng script
-- offline; không ai truy vấn theo hàng. Đường dẫn: <loại>/<YYYY>/<YYYY-MM-DD>/<tên>.json.gz
-- (lib/forecast-archive.ts). Ghi bởi cron /api/collect/archive và /api/cron/refresh-fish.
--
-- RIÊNG TƯ: bucket `public=false`, KHÔNG policy cho anon/authenticated → chỉ service-role
-- đọc/ghi (giống user-docs 0051). Dự báo cá là hàng premium — kho không được lộ ra ngoài.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).
-- Apply bằng dashboard: tạo bucket "forecast-archive" (Private) ở tab Storage thay câu dưới.

insert into storage.buckets (id, name, public)
values ('forecast-archive', 'forecast-archive', false)
on conflict (id) do nothing;
