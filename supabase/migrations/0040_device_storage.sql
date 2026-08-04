-- 0040 — MÁY BÀ CON CÒN BAO NHIÊU CHỖ (nhịp "đã mở app" báo lên)
--
-- Vì sao (chủ dự án chốt 2026-08-02j): *"làm cái heartbeat để biết dung lượng
-- storage bao nhiêu thôi rồi phải ưu tiên localStorage rồi cache rồi… để đảm bảo
-- offline luôn chạy."*
--
-- CHUYỆN THẬT DẪN TỚI ĐÂY: cả một ngày soát offline được xây trên con số "5 MB"
-- mà không ai đo. Đo thật thì Chromium cho **99,88 MB** localStorage và 1.425 MB
-- cho cả origin — tức toàn bộ lo lắng "chật kho" sai hẳn về mức độ trên Android.
-- Nhưng **iOS Safari / WKWebView thì chưa ai đo**, mà iPhone lại là phần lớn bà
-- con. Không thể quyết kiến trúc lưu trữ bằng phỏng đoán.
--
-- Nhịp 30 phút đã nói chuyện với máy chủ về đúng máy đó rồi — cho nó chở thêm
-- hai con số của `navigator.storage.estimate()`. Sau một ngày là có số THẬT của
-- cả đội tàu, tách theo iOS/Android, và lúc đó mới quyết được:
--   · có phải dời lớp nặng sang IndexedDB không
--   · máy nào sắp đầy để gọi nhắc bà con dọn bớt ảnh/video TRƯỚC khi ra khơi
--
-- LUẬT KHÔNG ĐỔI: chỉ ghi MỐC + SỐ ĐO. Không vị trí, không thao tác, không nội
-- dung. Dung lượng kho là số của MÁY, không suy ra được bà con đang ở đâu hay
-- làm gì.
--
-- ⚠️ OFFLINE: cột chỉ chảy MỘT CHIỀU máy → máy chủ, và chỉ khi máy CÓ SÓNG (nhịp
-- im lặng tuyệt đối lúc mất sóng). Không có đường nào chạy ngược về máy.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).

alter table public.customers
  add column if not exists storage_quota_mb integer,
  add column if not exists storage_used_mb integer;

comment on column public.customers.storage_quota_mb is
  'navigator.storage.estimate().quota (MB) — TRẦN kho của cả origin trên máy đó. NULL = máy chưa báo được (trình duyệt cũ không có Storage API).';
comment on column public.customers.storage_used_mb is
  'navigator.storage.estimate().usage (MB) — app đang chiếm bao nhiêu. Cùng máy mà used tiến sát quota = sắp không lưu thêm được, đáng gọi nhắc trước khi ra khơi.';

-- Theo TỪNG MÁY (0033) — đổi điện thoại vẫn tra được máy cũ chật tới đâu, và để
-- so iOS với Android trên cùng một bảng.
alter table public.customer_devices
  add column if not exists storage_quota_mb integer,
  add column if not exists storage_used_mb integer;

comment on column public.customer_devices.storage_quota_mb is
  'Như customers.storage_quota_mb nhưng theo từng máy — chỗ tra "iOS thật sự cho bao nhiêu".';
