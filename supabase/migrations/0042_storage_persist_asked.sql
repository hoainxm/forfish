-- 0042 — ĐÃ HỎI XIN BỘ NHỚ BỀN CHƯA, VÀ BỊ TỪ CHỐI HAY ĐƯỢC GẬT
--
-- Vì sao (chủ dự án hỏi 2026-08-03: *"đã có bản cài thì có bị từ chối không?"*):
-- 0041 chở về `storage_persisted` = `navigator.storage.persisted()`. Một mình nó
-- KHÔNG phân biệt được hai ca cần hai cách xử lý khác hẳn nhau:
--   · **đã hỏi, trình duyệt TỪ CHỐI** — giới hạn nền tảng. Safari và Chromium
--     "tự gật hoặc tự từ chối theo lịch sử tương tác với trang, không hỏi người
--     dùng", nên gọi điện nhắc bà con làm gì đó cũng không đổi được kết quả.
--   · **CHƯA HỎI LẠI LẦN NÀO** — lỗi của app, sửa được. Trước 2026-08-03 app gọi
--     `persist()` đúng một lần trong `useEffect` của layout, tức một lần mỗi lần
--     TÀI LIỆU được nạp; mà bản cài PWA bấm Home rồi quay lại KHÔNG nạp lại tài
--     liệu. Máy dùng nhiều tháng có thể chỉ được hỏi vài lần, và lần hỏi đầu rơi
--     đúng lúc app vừa cài — lúc "lịch sử tương tác" mỏng nhất, dễ bị từ chối nhất.
--
-- CA THẬT dẫn tới cột này: khách `0123456154` (iOS, ĐÃ cài ra màn hình chính, dữ
-- liệu đủ tới 18/08) vẫn báo `storage_persisted = false`. Không có cột này thì
-- không ai trả lời được "vì sao", và /quan-tri cứ hô cảnh báo mà nhân viên không
-- biết phải nhắc bà con làm gì.
--
-- Ý NGHĨA GIÁ TRỊ:
--   · `null`  — máy CHƯA HỎI lần nào (hoặc bản app cũ chưa có cơ chế hỏi lại)
--   · `false` — đã hỏi, bị TỪ CHỐI  → tổ hợp với `storage_persisted = false` là
--               giới hạn nền tảng, KHÔNG phải việc gọi điện
--   · `true`  — đã hỏi và ĐƯỢC CẤP  → `storage_persisted` phải cũng true
--
-- LUẬT KHÔNG ĐỔI: chỉ ghi MỐC + SỐ ĐO của MÁY. Không vị trí, không thao tác,
-- không nội dung, không user-agent đầy đủ.
--
-- ⚠️ OFFLINE: cột chảy MỘT CHIỀU máy → máy chủ, chỉ khi máy có sóng. Bản thân
-- việc HỎI (`persist()`) là API cục bộ của trình duyệt, KHÔNG phải request mạng
-- — chạy được cả giữa biển, không tốn tiền sóng, không có gì để timeout.
--
-- ✅ ĐÃ APPLY prod 2026-08-03 (chủ dự án ra lệnh trực tiếp: "migrate đi").
-- App chạy được TRƯỚC khi apply: cả hai đường ghi đều có nhánh lùi bỏ cột lạ
-- (`src/app/api/me/heartbeat/route.ts`).

alter table public.customers
  add column if not exists storage_persist_asked boolean;

comment on column public.customers.storage_persist_asked is
  'Kết quả lần XIN bộ nhớ bền gần nhất (navigator.storage.persist()). null = chưa hỏi lần nào · false = đã hỏi và BỊ TỪ CHỐI (giới hạn nền tảng — đừng gọi điện) · true = được cấp. Đọc CÙNG storage_persisted mới ra nghĩa.';

-- Theo TỪNG MÁY (0033) — để so iOS với Android: nền nào hay từ chối hơn.
alter table public.customer_devices
  add column if not exists storage_persist_asked boolean;

comment on column public.customer_devices.storage_persist_asked is
  'Như customers.storage_persist_asked nhưng theo MÁY — dùng để so tỉ lệ bị từ chối giữa iOS và Android, thứ quyết định có nên đổi cách hướng dẫn bà con hay không.';
