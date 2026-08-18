-- SDFish — QUÉT NGUỒN TIN BÃO THEO MỨC ƯU TIÊN (2026-08-18).
--
-- VÌ SAO (chủ dự án): *"quét theo mức độ ưu tiên, chứ không phải cứ quét 30
-- phút 1 lần mãi; thường 1 ngày 1 lần định kỳ là ok, rồi khi có bão thì theo
-- dõi diễn biến mới tăng tần suất lên 1h/lần … tránh quét liên tục rồi bị treo
-- lỗi và làm tốn tài nguyên"*.
--
-- Bản 0036 quét NCHMF 30 phút/lần bất kể trời yên hay bão: 48 lượt/ngày × 2 lượt
-- tải HTML = 96 request/ngày vào trang của cơ quan nhà nước, phần lớn để nhận
-- lại đúng bản tin đã có. Luật nhịp mới ở `src/lib/storm-scan.ts` (thuần, có
-- test); migration này thêm HAI THỨ luật đó cần nhớ giữa các lượt cron:
--
--   1. `storm_bulletins.next_at` — giờ NGUỒN TỰ HẸN bản tin kế ("Bản tin tiếp
--      theo: 14h00 ngày 18/8"). Đây là nhịp THẬT do cơ quan phát tin công bố, và
--      nó tự đổi khi họ leo thang (QĐ 18/2021: 6 giờ/lần ngoài Biển Đông → 3
--      giờ/lần gần bờ → 1 giờ/lần khẩn cấp). Đọc số nguồn ghi thì mọi nấc tự
--      khớp; chép cứng bảng tần suất vào code thì sai đúng lúc nguy hiểm nhất.
--
--   2. `storm_scan_log` — MỖI LƯỢT THẬT SỰ HỎI NGUỒN một hàng. Cổng nhịp cần
--      biết "lần cuối hỏi nguồn là lúc nào", mà `storm_bulletins` KHÔNG trả lời
--      được: ngày trời yên không có bản tin nào để ghi, nên kho đứng im và cổng
--      sẽ tưởng chưa bao giờ quét ⇒ quét lại mỗi lượt. Bảng này cũng là BẰNG
--      CHỨNG nhịp thật (soi lại khi nghi app đang đập nguồn), nên giữ cả lượt
--      hỏng.
--
-- RLS: bật, KHÔNG policy — cùng khuôn 0036. Chỉ route server (service-role) đọc/ghi.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

alter table public.storm_bulletins
  add column if not exists next_at timestamptz;

comment on column public.storm_bulletins.next_at is
  'Giờ NGUỒN tự hẹn bản tin kế ("Bản tin tiếp theo: 14h00 ngày 18/8"). Quyết định nhịp quét — xem src/lib/storm-scan.ts. NULL = bản tin không ghi (dùng đường lùi 6 giờ).';

create table if not exists public.storm_scan_log (
  id          uuid primary key default gen_random_uuid(),
  scanned_at  timestamptz not null default now(),
  -- 'ngu' | 'xa' | 'gan' — mức ưu tiên lúc quyết định quét
  muc         text,
  -- 'saved' | 'da-co' | 'no-bulletin' | 'parse-failed' | 'index-failed' | ...
  ket_qua     text,
  storm_key   text,
  -- câu lý do của cổng nhịp, nguyên văn (để soi lại vì sao lượt đó quét)
  vi          text
);

-- cổng nhịp chỉ hỏi MỘT câu: "lần quét gần nhất lúc nào"
create index if not exists storm_scan_log_time_idx
  on public.storm_scan_log (scanned_at desc);

alter table public.storm_scan_log enable row level security;
-- KHÔNG policy: đọc/ghi chỉ qua route server bằng service-role.

comment on table public.storm_scan_log is
  'Một hàng = một lượt THẬT SỰ hỏi nguồn NCHMF. Nuôi cổng nhịp quét (lần cuối hỏi lúc nào) và làm bằng chứng nhịp thật. Giữ cả lượt hỏng.';
