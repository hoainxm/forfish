-- 0087 — S-TRACKING: TRẠNG THÁI KẾT NỐI THẬT CỦA TỪNG MÁY (2026-11-06). Nhân viên hỏi trong nhóm Zalo "Sao ko báo mkn đại ca"
-- khi thẻ GL-99280-TS ghi "cập nhật 06:45" lúc 13:11 — nhưng máy KHÔNG mất kết nối (đợt cuối 04/09 → 07/09). Dòng đó là cột
-- "Ngày cập nhật" bản ghi S-Tracking (cap_nhat_nguon), chỉ lấy lại ở lượt cào đủ 07:30 ⇒ dễ hiểu nhầm. Anh Long: "fix hết đi".
--
-- Máy GPU đọc báo cáo mất kết nối MỖI 15 PHÚT (ngoài khơi ~22 ngày, trong bờ ~9 ngày gần nhất) và gửi đợt MỚI NHẤT của mỗi máy
-- có trong báo cáo: đang mất ⇒ `mat_ket_noi_tu`; đã có lại ⇒ `mat_ket_noi_tu` = null + `co_lai_luc`. Máy không có trong báo cáo
-- ⇒ không đụng. Chỉ THÊM cột cho phép null.

alter table public.stracking_thiet_bi
  add column if not exists mat_ket_noi_tu   timestamptz,
  add column if not exists co_lai_luc       timestamptz,
  add column if not exists ket_noi_kiem_luc timestamptz;

comment on column public.stracking_thiet_bi.mat_ket_noi_tu is 'Đang mất kết nối từ lúc này (null = không đang mất, theo báo cáo mất kết nối S-Tracking).';
comment on column public.stracking_thiet_bi.co_lai_luc is 'Đợt mất kết nối gần nhất đã có tín hiệu lại lúc này.';
comment on column public.stracking_thiet_bi.ket_noi_kiem_luc is 'Lúc máy GPU kiểm trạng thái kết nối của máy này lần gần nhất.';

create index if not exists stracking_thiet_bi_mat_ket_noi_idx on public.stracking_thiet_bi (mat_ket_noi_tu) where mat_ket_noi_tu is not null;
