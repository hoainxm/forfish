-- 0086 — "SỐ KHÁC CỦA TÔI": danh sách SĐT khác của một tài khoản (2026-11-06, anh Long duyệt "làm đi").
--
-- Thay cột đơn customers.sdt_phu (0084). Một ô không đủ: khách đăng nhập số A, máy giám sát hành trình đứng tên B, mua
-- hàng SDVICO bằng C ⇒ gán C là đè mất B. Nghĩa của B và C như nhau — "số này là của tôi, nhân viên đã xác nhận" — nên
-- MỘT danh sách dùng chung cho S-Tracking (tra máy, gia hạn, tin cảnh báo) và đồ mua SDVICO (/api/me/sdvico).
--
-- Luật (CHẶN Ở DB, không chỉ ở route):
--   · tối đa 3 số / tài khoản (kể cả số đang chờ duyệt) — trigger sdt_khac_toi_da
--   · một số ĐÃ DUYỆT chỉ thuộc MỘT tài khoản — unique một phần trên (sdt) where duyet_luc is not null.
--     Trước đây chỉ mục 0084 không unique ⇒ hai tài khoản gán cùng số là cùng xem máy của số đó.
--   · số khác ≠ SĐT chính của chính tài khoản đó
--   · CHỈ dòng đã duyệt (duyet_luc not null) được dùng để tra. Dòng chờ = bà con tự gửi từ app (chưa có OTP ⇒ không tự
--     gắn được, tự gắn = xem đồ/máy người khác); nhân viên duyệt ở /quan-tri.
--
-- Không RLS policy: đọc/ghi CHỈ qua route service role (giống customers.sdt_phu).
-- Cột customers.sdt_phu GIỮ LẠI một nhịp: code mới đọc bảng này, bảng chưa có thì lùi về cột cũ (deploy trước migration
-- không mất số phụ đang dùng). Bỏ cột ở migration sau khi bản mới chạy ổn.

create table if not exists public.sdt_khac (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null references public.customers (phone) on update cascade on delete cascade,
  sdt        text not null check (sdt ~ '^0[1-9][0-9]{8}$'),
  -- 'nhan-vien' = nhân viên gán thẳng ở /quan-tri · 'khach' = bà con gửi từ app, chờ duyệt
  nguon      text not null default 'nhan-vien' check (nguon in ('nhan-vien', 'khach')),
  tao_luc    timestamptz not null default now(),
  duyet_luc  timestamptz,
  duyet_boi  text,
  constraint sdt_khac_khac_chinh check (sdt <> phone),
  constraint sdt_khac_mot_lan unique (phone, sdt)
);

create unique index if not exists sdt_khac_da_duyet_mot_nguoi on public.sdt_khac (sdt) where duyet_luc is not null;
create index if not exists sdt_khac_phone_idx on public.sdt_khac (phone);

create or replace function public.sdt_khac_toi_da() returns trigger
language plpgsql as $$
begin
  -- cặp (phone, sdt) đã có ⇒ để ràng buộc unique `sdt_khac_mot_lan` lên tiếng (bà con bấm gửi hai lần là "đã có",
  -- không phải "đủ 3 số"; chạy lại migration thì `on conflict do nothing` nuốt được)
  if exists (select 1 from public.sdt_khac where phone = new.phone and sdt = new.sdt and id <> new.id) then
    return new;
  end if;
  if (select count(*) from public.sdt_khac where phone = new.phone and id <> new.id) >= 3 then
    raise exception 'sdt_khac_toi_da_3' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists sdt_khac_toi_da on public.sdt_khac;
create trigger sdt_khac_toi_da before insert or update of phone on public.sdt_khac
  for each row execute function public.sdt_khac_toi_da();

alter table public.sdt_khac enable row level security;

-- Chép số phụ 0084 sang (đã duyệt — nhân viên gán). Hai tài khoản trùng một số phụ ⇒ chỉ dòng sửa sớm nhất được giữ,
-- dòng còn lại bỏ (đúng luật mới: một số một người); nhân viên xem lại ở /quan-tri.
insert into public.sdt_khac (phone, sdt, nguon, tao_luc, duyet_luc, duyet_boi)
select distinct on (c.sdt_phu) c.phone, c.sdt_phu, 'nhan-vien', coalesce(c.sdt_phu_luc, now()), coalesce(c.sdt_phu_luc, now()), 'chep-0084'
from public.customers c
where c.sdt_phu is not null and c.sdt_phu ~ '^0[1-9][0-9]{8}$' and c.sdt_phu <> c.phone
order by c.sdt_phu, c.sdt_phu_luc nulls last
on conflict do nothing;

comment on table public.sdt_khac is
  'Số khác của tài khoản (≤3, một số đã duyệt thuộc một người) — tra S-Tracking + đồ mua SDVICO. Chỉ dòng duyet_luc not null được dùng. Migration 0086 thay customers.sdt_phu.';
comment on column public.customers.sdt_phu is 'CŨ (0084) — đã chép sang bảng sdt_khac (0086). Chỉ còn làm đường lùi khi bảng chưa có; sẽ bỏ.';
