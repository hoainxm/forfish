-- 0081 — S-TRACKING: THÊM 4 CỘT TRẠNG THÁI MÁY (2026-11-05, anh Long: "Trạng thái đồng bộ Tổng cục, nhóm, ngày tạo,
-- ngày cập nhật, trong bờ hay ngoài khơi cái này quan trọng nhé"). `trong_bo` đã có từ 0080; thêm bốn cột còn lại để
-- bà con thấy máy có đang đẩy dữ liệu về Tổng cục Thủy sản không và vị trí cập nhật lúc nào.
--
-- Chỉ THÊM cột cho phép null — không đổi/xoá gì; hàng cũ nhận giá trị ở lượt đồng bộ kế tiếp (máy GPU gửi lại hồ sơ
-- vì băm bản gửi đổi).

alter table public.stracking_thiet_bi
  add column if not exists dong_bo_tcts   text check (dong_bo_tcts is null or char_length(dong_bo_tcts) <= 60),
  add column if not exists nhom           text check (nhom is null or char_length(nhom) <= 160),
  add column if not exists tao_luc        timestamptz,
  add column if not exists cap_nhat_nguon timestamptz;

comment on column public.stracking_thiet_bi.dong_bo_tcts is 'Trạng thái đồng bộ Tổng cục Thủy sản trên S-Tracking ("Thành công" / "Thất bại").';
comment on column public.stracking_thiet_bi.nhom is 'Nhóm của máy trên S-Tracking (đại lý/khu vực).';
comment on column public.stracking_thiet_bi.tao_luc is 'Ngày tạo máy trên S-Tracking.';
comment on column public.stracking_thiet_bi.cap_nhat_nguon is 'Ngày cập nhật gần nhất trên S-Tracking (vị trí/trạng thái máy).';
