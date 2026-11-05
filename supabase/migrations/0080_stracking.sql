-- 0080 — HẠN CƯỚC + CẢNH BÁO S-TRACKING (Viettel) CHO BÀ CON (2026-11-05, anh Long: "chạy GPU, check 7h, 12h, 17h, 21h
-- để cập nhật cái hạn mới nhất, tổ chức DB ở GPU lưu toàn bộ các thông tin liên quan tới user … dữ liệu tổ chức ở sdfish
-- bảng riêng độc lập, để tránh conflict luồng sdwork").
--
-- Máy GPU (scripts/stracking-dong-bo.mjs) đọc stracking.viettel.io bằng tài khoản đại lý SDVICO, giữ KHO ĐẦY ĐỦ ở máy nhà
-- (SQLite), rồi chỉ gửi lên đây phần bà con cần xem: tên tàu, chủ tàu, SĐT để tra, ngày đăng ký, HẠN, tạm ngưng, trong
-- bờ/ngoài khơi. Địa chỉ, SĐT người thân, SĐT quản lý… KHÔNG lên server.
--
-- ĐỘC LẬP với luồng SDWork/CRM (DB chung exueouggmbjtjvsvpfya, bảng stracking_renewal_*): ba bảng dưới đây chỉ ForFish
-- ghi/đọc, không trigger, không khoá ngoại sang đâu. Yêu cầu gia hạn vẫn đi đường cũ (/api/renewal/*).
--
-- Ghi: POST /api/stracking/nhap (khoá máy GPU). Đọc: GET /api/stracking/cua-toi (SĐT lấy từ phiên). RLS bật + revoke,
-- KHÔNG policy: chỉ service role.

create table if not exists public.stracking_thiet_bi (
  serial            text primary key check (char_length(serial) between 1 and 64),
  imei              text,
  ten_tau           text,
  chu_tau           text,
  sdt_chu_tau       text check (sdt_chu_tau is null or sdt_chu_tau ~ '^0[1-9][0-9]{8}$'),
  thuyen_truong     text,
  sdt_thuyen_truong text check (sdt_thuyen_truong is null or sdt_thuyen_truong ~ '^0[1-9][0-9]{8}$'),
  dang_ky_luc       date,
  het_han           date,
  tam_ngung_tu      date,
  tam_ngung_den     date,
  trong_bo          boolean,
  dong_bo_luc       timestamptz not null default now()
);

create index if not exists stracking_thiet_bi_sdt_chu_idx on public.stracking_thiet_bi (sdt_chu_tau) where sdt_chu_tau is not null;
create index if not exists stracking_thiet_bi_sdt_tt_idx on public.stracking_thiet_bi (sdt_thuyen_truong) where sdt_thuyen_truong is not null;
create index if not exists stracking_thiet_bi_imei_idx on public.stracking_thiet_bi (imei);

alter table public.stracking_thiet_bi enable row level security;
revoke all on table public.stracking_thiet_bi from anon, authenticated;

comment on table public.stracking_thiet_bi is
  'Máy giám sát hành trình S-Tracking (Viettel) — hạn cước theo serial, tra theo SĐT chủ tàu/thuyền trưởng. Máy GPU đồng bộ 4 lần/ngày. Chỉ service role.';

create table if not exists public.stracking_canh_bao (
  imei        text not null check (char_length(imei) between 1 and 32),
  loai        text not null check (char_length(loai) between 1 and 120),
  luc         timestamptz not null,
  serial      text,
  ten_tau     text,
  muc         text,
  nhan_luc    timestamptz not null default now(),
  primary key (imei, loai, luc)
);

create index if not exists stracking_canh_bao_imei_luc_idx on public.stracking_canh_bao (imei, luc desc);
create index if not exists stracking_canh_bao_luc_idx on public.stracking_canh_bao (luc);

alter table public.stracking_canh_bao enable row level security;
revoke all on table public.stracking_canh_bao from anon, authenticated;

comment on table public.stracking_canh_bao is
  'Cảnh báo S-Tracking (SOS, vượt biên, mất GPS, pin…). Giữ 30 ngày (route nhap tự xoá cũ). Chỉ service role.';

create table if not exists public.stracking_lan_dong_bo (
  id          bigserial primary key,
  luc         timestamptz not null,
  trang_thai  text not null check (trang_thai in ('ok', 'het-phien', 'loi')),
  loi         text,
  tong        jsonb not null default '{}'::jsonb,
  so_thiet_bi integer not null default 0,
  so_canh_bao integer not null default 0,
  nhan_luc    timestamptz not null default now()
);

create index if not exists stracking_lan_dong_bo_nhan_idx on public.stracking_lan_dong_bo (nhan_luc desc);

alter table public.stracking_lan_dong_bo enable row level security;
revoke all on table public.stracking_lan_dong_bo from anon, authenticated;

comment on table public.stracking_lan_dong_bo is
  'Sổ các lần máy GPU gửi dữ liệu S-Tracking (ok / hết phiên / lỗi). Giữ 90 ngày. Chỉ service role.';
