-- SDFish — ĐO THẬT VIỆC DÙNG APP (2026-08-01, chủ dự án duyệt).
--
-- Vì sao: tab Tài khoản ở /quan-tri đang có chip THỦ CÔNG "đã/chưa sử dụng"
-- (0029) do nhân viên tự tick — niềm tin, không phải số đo. Thứ thật sự cần
-- biết là: ai ĐÃ CÀI app mà CHƯA BAO GIỜ MỞ BẢN CÀI. Trên iPhone, kho của bản
-- "Thêm vào Màn hình chính" TÁCH RIÊNG với Safari, nên nhóm đó sẽ ra khơi với
-- máy trắng tay dù đã tải đủ dữ liệu trong Safari. Đó là danh sách để GỌI ĐIỆN
-- NHẮC, không phải để thống kê chơi.
--
-- Chỉ ghi MỐC THỜI GIAN + CHẾ ĐỘ CHẠY. KHÔNG vị trí, KHÔNG thao tác, KHÔNG
-- nội dung — app của ngư dân không được biến thành thứ theo dõi bà con.
-- Chỉ quy được về người ĐÃ ĐĂNG NHẬP; khách chưa đăng nhập không attribute.

alter table public.customers
  -- lần cuối mở ở CHẾ ĐỘ ĐÃ CÀI (PWA / Thêm vào Màn hình chính)
  add column if not exists pwa_last_open_at timestamptz,
  -- lần cuối mở trong TAB trình duyệt thường
  add column if not exists web_last_open_at timestamptz,
  -- lần cuối máy tự báo: vỏ app đã cài đủ VÀ đã tải đủ gói dữ liệu đi biển
  add column if not exists offline_ready_at timestamptz;

comment on column public.customers.pwa_last_open_at is
  'Lần cuối mở app ở chế độ đã cài (standalone). NULL = chưa bao giờ mở bản cài.';
comment on column public.customers.web_last_open_at is
  'Lần cuối mở app trong tab trình duyệt thường.';
comment on column public.customers.offline_ready_at is
  'Lần cuối máy báo ĐỦ ĐỒ ĐI BIỂN: vỏ app cài đủ + mọi lớp dữ liệu đã tải.';
