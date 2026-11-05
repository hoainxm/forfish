-- 0084 — SĐT PHỤ CHO TÀI KHOẢN (2026-11-05, anh Long: "cho bổ sung thêm 1 sdt, tức là cho phép 1 acc 2 sdt").
-- Ca thật: khách Phan Kim Tài đăng nhập 0918…742, nhưng tàu KG-91737-TS / KG-94292-TS trên S-Tracking (Viettel) đứng
-- SĐT 0946…444 ⇒ không hiện ở khối "Giám sát hành trình".
--
-- customers.sdt_phu — MỘT SĐT phụ / tài khoản. CHỈ nhân viên gán ở /quan-tri (PATCH /api/admin/accounts/sdt-phu, quyền
-- tai-khoan edit, có nhật ký) — app chưa có OTP nên bà con KHÔNG tự thêm được (tự thêm = xem được máy của người khác).
-- Dùng cho S-Tracking: tra máy (cua-toi), gia hạn (renewal/request), đối chiếu yêu cầu (renewal/mine). KHÔNG đổi đăng
-- nhập, KHÔNG đổi SĐT chính.
--
-- Bảng customers đã RLS owner-only; cột mới không cần policy riêng (đọc/ghi qua route service role).

alter table public.customers add column if not exists sdt_phu text;
alter table public.customers add column if not exists sdt_phu_luc timestamptz;

do $$ begin
  alter table public.customers
    add constraint customers_sdt_phu_check check (sdt_phu is null or (sdt_phu ~ '^0[1-9][0-9]{8}$' and sdt_phu <> phone));
exception when duplicate_object then null; end $$;

create index if not exists customers_sdt_phu_idx on public.customers (sdt_phu) where sdt_phu is not null;

comment on column public.customers.sdt_phu is
  'SĐT phụ (1/tài khoản) — tra thêm máy S-Tracking đứng tên SĐT này. Chỉ nhân viên gán ở /quan-tri. Migration 0084.';
comment on column public.customers.sdt_phu_luc is 'Lần nhân viên đổi SĐT phụ gần nhất.';
