-- 0025 — DỮ LIỆU ĐI BIỂN TRONG MÁY CÓ TỚI NGÀY NÀO
--
-- Vì sao cần (chủ dự án chốt 2026-08-02d): ba mốc của 0021 chỉ trả lời "máy có
-- mở app không" và "đã qua bước cài chưa". Chúng KHÔNG trả lời câu quan trọng
-- nhất với người trực tổng đài: **cái máy đó ra khơi ngày mai thì trong tay bà
-- con có dự báo tới ngày nào?** Một máy "đủ đồ đi biển" tải từ 5 hôm trước và
-- một máy vừa tải sáng nay nhìn y hệt nhau trên /quan-tri.
--
-- Cột này do NHỊP ĐỊNH KỲ báo lên (30 phút/lần khi máy có sóng) — KHÔNG phải
-- nhịp sự kiện: ngày phủ dữ liệu đổi liên tục theo mỗi lượt tải, đưa vào chữ ký
-- sự kiện là máy sẽ bắn nhịp liên tục. Xem `src/lib/heartbeat-policy.ts`.
--
-- LUẬT KHÔNG ĐỔI: chỉ ghi MỐC + TRẠNG THÁI. Không vị trí, không thao tác, không
-- nội dung. `data_until` là một NGÀY của bản dự báo, không phải hành vi người
-- dùng, và không suy ra được bà con đang ở đâu hay làm gì.
--
-- ⚠️ OFFLINE: cột này chỉ được ghi khi máy CÓ SÓNG và tự gửi nhịp. Máy mất sóng
-- không gửi gì, và giá trị cũ nằm lại nguyên vẹn — đúng ý nghĩa "lần cuối biết
-- được là tới ngày này". Không có đường nào từ cột này chạy ngược về máy.

alter table public.customers
  add column if not exists data_until date;

comment on column public.customers.data_until is
  'Ngày XA NHẤT mà dữ liệu dự báo đã lưu trong máy còn phủ tới (nhịp định kỳ báo lên). NULL = chưa bao giờ báo được.';

-- Lịch sử theo TỪNG MÁY (0022) — giữ song song để đổi điện thoại vẫn tra được
-- máy cũ đã tải tới đâu.
alter table public.customer_devices
  add column if not exists data_until date;

comment on column public.customer_devices.data_until is
  'Như customers.data_until nhưng theo từng máy — máy cũ tải tới đâu vẫn tra lại được sau khi bà con đổi điện thoại.';
