-- 0082 — ĐÓNG CẢNH BÁO S-TRACKING ĐÃ CLEAR (2026-11-05, anh Long: "nếu cảnh báo đã được clear thì đóng cảnh báo cho họ").
--
-- Máy GPU báo trạng thái mới nhất của từng máy; máy đã về bình thường SAU giờ cảnh báo ⇒ route /api/stracking/nhap
-- đặt `da_dong_luc` cho các cảnh báo còn mở của máy đó, rồi gửi tin "đã hết cảnh báo" (cùng tag) để đè thông báo cũ.
-- `cua-toi` chỉ trả cảnh báo chưa đóng. Cộng thêm cột, không đổi dữ liệu cũ (null = còn mở).

alter table public.stracking_canh_bao add column if not exists da_dong_luc timestamptz;

create index if not exists stracking_canh_bao_mo_idx on public.stracking_canh_bao (imei) where da_dong_luc is null;

comment on column public.stracking_canh_bao.da_dong_luc is
  'Giờ S-Tracking báo máy về bình thường sau cảnh báo này (null = còn mở). Ghi bởi /api/stracking/nhap.';
