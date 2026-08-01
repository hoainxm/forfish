-- SDFish — ĐỌC TRONG APP CŨNG LÀ ĐỌC (2026-08-01, chủ dự án yêu cầu).
--
-- VẤN ĐỀ: 0023 chỉ ghi `opened_at` ở nhánh `notificationclick` — tức là CHỈ
-- đếm khi bà con BẤM vào banner thông báo. Nhưng thực tế trên iPhone (phần lớn
-- máy đang dùng) bà con đọc ngay trên màn khoá rồi vuốt tắt, hoặc mở app đọc
-- trong mục Thông báo ở trang chủ. Cả hai đường đó KHÔNG ghi gì ⇒ trang quản
-- trị hiện "đọc 0" vĩnh viễn, đọc như "không ai xem" trong khi bà con đã xem.
-- Cột dối như vậy còn tệ hơn không có cột: người gửi tin bão sẽ tưởng tin
-- không tới và gửi lại, hoặc tệ hơn — kết luận sai rằng bà con không quan tâm.
--
-- ĐƠN VỊ ĐẾM: `push_receipts` đếm theo MÁY (endpoint) vì nó đo việc giao tin.
-- Bảng này đếm theo NGƯỜI ĐỌC (`reader`) vì nó đo việc đọc — một người hai máy
-- đọc một tin thì vẫn là MỘT người đọc. Hai bảng, hai đơn vị, cố ý tách:
--   `reader` = 'sdt:<SĐT>'      khi đã đăng nhập (máy chủ tự lấy từ phiên)
--   `reader` = 'may:<endpoint>' khi chưa đăng nhập (hộp thư mở cho cả khách)
-- Trang quản trị GỘP hai nguồn (bấm banner + đọc trong app) rồi đếm số khoá
-- KHÁC NHAU, nên bấm banner xong lại mở app đọc vẫn chỉ tính một.
--
-- KHÔNG sửa `push_receipts`: nó là sổ giao-tin theo máy, vẫn đúng việc của nó.
--
-- RLS bật, KHÔNG policy: chỉ service-role (route /api/*) đọc/ghi — giống 0023.
-- ⚠️ ĐÃ APPLY prod 2026-08-01 (ref znzgugvfhgmiszqgjulk) — kiểm lại: bảng có,
-- rls=true, policies=0.

create table if not exists public.push_reads (
  message_id uuid not null references public.push_messages(id) on delete cascade,
  -- 'sdt:<phone>' hoặc 'may:<endpoint>' — xem ghi chú đơn vị đếm ở trên
  reader     text not null,
  -- SĐT nếu tra ra được (từ phiên, hoặc từ push_subscriptions theo endpoint);
  -- null = khách chưa gắn tài khoản. Để sau này soi được "ai đã đọc".
  account_phone text,
  -- LẦN ĐẦU đọc; ghi bằng upsert ignoreDuplicates nên không bị đè bởi lần sau
  read_at    timestamptz not null default now(),
  primary key (message_id, reader)
);
create index if not exists push_reads_msg_idx
  on public.push_reads (message_id);

alter table public.push_reads enable row level security;
