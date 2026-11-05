-- 0085 — BÀ CON TỰ XOÁ MÁY GIÁM SÁT KHỎI DANH SÁCH (2026-11-06; anh Hoà đề xuất trong nhóm Zalo SDVico SDFish, anh Long
-- duyệt: "làm đi, migrate đi, máy nào ẩn thì ko cần thông báo liên quan nữa (ko gọi là ẩn mà là xoá, mặc dù trong hệ thống
-- là ẩn)").
--
-- Bắt nốt máy đã huỷ/bán mà luật tự động (lib/stracking/may-da-bo: tên DE…/Thu…, bỏ đọng >1 năm + hết hạn) không nhận ra.
-- Giao diện gọi "Xoá"; hệ thống chỉ ẨN theo (SĐT, serial): kho S-Tracking giữ nguyên, người khác cùng máy (chủ tàu ↔ thuyền
-- trưởng) không bị ảnh hưởng, "Hiện lại" là xoá dòng này. Máy đã xoá: không hiện ở thẻ, không tin cảnh báo / nhắc nhở.
--
-- Ghi: /api/stracking/an (SĐT lấy từ phiên, chỉ máy khớp sdt_chu_tau/sdt_thuyen_truong). RLS bật + revoke, KHÔNG policy:
-- chỉ service role.

create table if not exists public.stracking_an (
  sdt     text not null check (sdt ~ '^0[1-9][0-9]{8}$'),
  serial  text not null check (char_length(serial) between 1 and 64),
  an_luc  timestamptz not null default now(),
  primary key (sdt, serial)
);

alter table public.stracking_an enable row level security;
revoke all on table public.stracking_an from anon, authenticated;

comment on table public.stracking_an is
  'Máy giám sát bà con tự "xoá" khỏi danh sách (thực chất ẩn theo SĐT) — không hiện, không thông báo. Chỉ service role.';
