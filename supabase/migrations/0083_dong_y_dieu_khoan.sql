-- 0083 — SỔ ĐỒNG Ý ĐIỀU KHOẢN + CHÍNH SÁCH (2026-11-05, anh Long: "bổ sung vào T&C lúc đăng ký hoặc đăng nhập lần đầu …
-- chỉ cần có 1 cái là click là đồng ý").
--
-- Vì sao phải có bảng: Nghị định 356/2025/NĐ-CP Điều 6 — sự đồng ý phải KIỂM CHỨNG được (ai, lúc nào, nội dung nào) và
-- bên kiểm soát dữ liệu phải LƯU và CHỨNG MINH được khi có tranh chấp. Bản trong máy bà con không phải bằng chứng.
--
-- Sổ CHỈ THÊM (append-only): mỗi lần bấm Đồng ý một hàng; không sửa, không xoá từ app. Bản hiện hành của một SĐT =
-- hàng mới nhất. Rút đồng ý / xoá tài khoản đi qua SDVICO (hotline) — nhân viên ghi tay, chưa có màn.
--
-- Auth: khuôn 0065 — RLS BẬT, KHÔNG policy, revoke anon/authenticated. Ghi qua POST /api/me/dong-y (service-role, SĐT lấy
-- từ chuỗi cứng); đọc ở /api/auth/token (trả `dongYBan` để máy khỏi hỏi lại sau khi cài lại app).
-- Code chịu được bảng chưa có: route trả 503, máy giữ "chưa gửi" và gửi bù — bà con không bị chặn.
-- ⚠️ KHÔNG tự apply lên prod (CLAUDE.md, ref znzgugvfhgmiszqgjulk) — chờ anh Long duyệt.

create table if not exists public.dong_y_dieu_khoan (
  id          bigint generated always as identity primary key,
  phone       text        not null,
  ban         text        not null,            -- DIEU_KHOAN_BAN (lib/dieu-khoan.ts), vd '2026-11-05'
  luc_may     timestamptz not null,            -- mốc bấm trên máy (bấm lúc mất sóng thì gửi bù sau)
  luc_chu     timestamptz not null default now(), -- mốc máy chủ nhận
  nguon       text        not null check (nguon in ('dang-ky', 'dang-nhap', 'mo-app')),
  platform    text,
  user_agent  text
);

create index if not exists dong_y_dieu_khoan_phone_idx on public.dong_y_dieu_khoan (phone, luc_chu desc);

alter table public.dong_y_dieu_khoan enable row level security;
revoke all on public.dong_y_dieu_khoan from anon, authenticated;

comment on table public.dong_y_dieu_khoan is
  'Bằng chứng đồng ý Điều khoản + Chính sách (NĐ 356/2025 Đ6). Chỉ thêm. Ghi qua /api/me/dong-y. Doc: 04-data-model §0083.';
