-- 0038 — DỮ LIỆU TỚI NGÀY NÀO: TÁCH KHO BẢN CÀI VỚI KHO WEB
--
-- Vì sao (chủ dự án chỉ ra 2026-08-02g): *"user đã pass qua bước bản cài, đã có
-- dữ liệu, nhưng sau đó toàn dùng bản web?"* và *"dữ liệu tới ngày nào cũng cần
-- rõ là dữ liệu đó trên bản cài hay bản web"*.
--
-- LỖI ĐÃ SỬA — /quan-tri đang mô tả NHẦM KHO. Cột `data_until` (0036) được ghi
-- từ MỌI nhịp. Trên iOS, kho của bản Thêm-vào-Màn-hình-chính TÁCH RIÊNG với
-- Safari, nên ca này có thật và hoàn toàn im lặng:
--   · 01/08 bà con tải đủ trong BẢN CÀI      → data_until = 17/08
--   · 05/08 mở app bằng Safari (kho khác)    → nhịp web GHI ĐÈ = 05/08 (kho rỗng)
--   · /quan-tri: "dữ liệu tới 05/08" — nói về cái kho sẽ KHÔNG ra khơi.
-- Chiều ngược lại sai y hệt: kho web đầy hơn thì bảng báo yên tâm trong khi bản
-- cài (thứ thật sự đi biển) đã cạn. Đây là số liệu để quyết định có gọi điện
-- nhắc hay không, nên sai kho = gọi nhầm người và bỏ sót người cần gọi.
--
-- NAY HAI CỘT, DÁN NHÃN RÕ:
--   · `data_until`      kho BẢN CÀI (giữ nguyên tên của 0036 — chỉ thu hẹp lại
--                       đúng nghĩa nó vẫn nên có; từ nay chỉ nhịp bản cài ghi)
--   · `data_until_web`  kho WEB
-- Android dùng chung kho nên hai cột trùng nhau — vô hại. iOS thì lệch, và chỗ
-- lệch đó chính là thứ người trực tổng đài cần thấy.
--
-- ⚠️ KHÔNG backfill, KHÔNG đụng dữ liệu cũ: giá trị `data_until` đang có là hỗn
-- hợp hai kho, không cách nào tách ngược. Để nguyên rồi nhịp sau ghi đúng —
-- xoá đi là mất số liệu của cả nhóm đang dùng bản cài đúng cách.
--
-- ⚠️ OFFLINE: cột chỉ chảy MỘT CHIỀU máy → máy chủ. Không có đường nào chạy
-- ngược về máy; máy mất sóng không gửi gì và giá trị cũ nằm nguyên.
--
-- ✅ ĐÃ APPLY prod 2026-08-02 (chủ dự án ra lệnh "apply đi"). Kiểm sau khi apply:
--    customers.data_until_web VÀ customer_devices.data_until_web đều tồn tại;
--    KHÔNG backfill, giá trị data_until cũ giữ nguyên.

alter table public.customers
  add column if not exists data_until_web date;

comment on column public.customers.data_until_web is
  'Ngày xa nhất dữ liệu trong kho WEB còn phủ tới. Tách khỏi data_until (kho BẢN CÀI) vì trên iOS hai kho RIÊNG — xem 0038.';

comment on column public.customers.data_until is
  'Ngày xa nhất dữ liệu trong kho BẢN CÀI còn phủ tới — kho sẽ ra khơi. CHỈ nhịp từ bản cài mới ghi cột này (thu hẹp lại từ 0038).';

-- Sổ theo từng máy (0033/0036) cũng tách y vậy, để đổi điện thoại vẫn tra được
-- máy cũ tải tới đâu VÀ tải ở kho nào.
alter table public.customer_devices
  add column if not exists data_until_web date;

comment on column public.customer_devices.data_until_web is
  'Như customers.data_until_web nhưng theo từng máy.';
