-- 0079 — VAI TÀI KHOẢN + VIỆC LÀM + HỒ SƠ VỰA (2026-11-03, anh Long: "tổ chức hệ thống account đi, rồi xây UI/UX cho
-- từng loại account … ngư dân vô kiếm việc … đại lý thiết bị … thu mua cá … chủ tàu"). Spec: docs/app-map/17-ba-spec-vai-tai-khoan.md.
--
-- 1. customers.vai — trục thứ 5 (cạnh account_kind / role / tier). MỘT SĐT MỘT VAI, người dùng tự chọn; null = chưa chọn.
--    Vai chỉ đổi giao diện + gác ô Bản đồ của đi bạn/thu mua/đại lý free (lib/data-route-rules vaiGate, §11).
-- 2. job_posts — tin tuyển của chủ tàu (§6.1). job_seekers — hồ sơ tìm tàu, 1/SĐT (§6.2). job_reports — báo xấu.
-- 3. vua_profiles — hồ sơ vựa tự khai, nhân viên duyệt rồi mới lên Đầu mối (§12.4).
--
-- Auth: khuôn Kairos 0065 — RLS BẬT, KHÔNG policy, revoke anon/authenticated: client không chạm bảng, mọi đọc/ghi qua
-- route service-role lọc theo SĐT từ chuỗi cứng. SĐT không bao giờ trả trong danh sách (§5).
-- ⚠️ KHÔNG tự apply lên prod (CLAUDE.md, ref znzgugvfhgmiszqgjulk) — chờ anh Long duyệt.

-- ── 1. Vai ───────────────────────────────────────────────────────────────────
alter table public.customers add column if not exists vai text;
alter table public.customers add column if not exists vai_doi_luc timestamptz;
alter table public.customers add column if not exists vai_xac_minh_at timestamptz;

do $$ begin
  alter table public.customers
    add constraint customers_vai_check check (vai is null or vai in ('ngu-dan', 'chu-tau', 'thu-mua', 'dai-ly'));
exception when duplicate_object then null; end $$;

comment on column public.customers.vai is
  'ngu-dan (Đi bạn) | chu-tau | thu-mua | dai-ly | null = chưa chọn. Người dùng tự chọn (PUT /api/me/vai). Spec 17.';
comment on column public.customers.vai_doi_luc is 'Lần đổi vai gần nhất (máy chủ ghi). null = vai suy ra / chưa chọn.';
comment on column public.customers.vai_xac_minh_at is
  'Thu mua đã được SDVICO xác minh (dấu "Đã xác minh"). Chỉ nhân viên gán ở /quan-tri. Spec 17 §5.';

-- Suy vai cho tài khoản cũ (§3.2) — CHỈ điền hàng đang null, không đè vai người dùng đã chọn.
update public.customers c set vai = 'dai-ly'
 where c.vai is null
   and exists (select 1 from public.shops s where s.owner_phone = c.phone and s.status in ('hoat_dong', 'cho_duyet'));
update public.customers c set vai = 'chu-tau'
 where c.vai is null
   and (exists (select 1 from public.devices d where d.customer_phone = c.phone)
        or exists (select 1 from public.user_docs u
                    where u.owner_phone = c.phone and u.kind = 'boats'
                      and jsonb_typeof(u.data) = 'array' and jsonb_array_length(u.data) > 0));
update public.customers c set vai = 'thu-mua'
 where c.vai is null
   and exists (select 1 from public.kairos_profiles k where k.phone = c.phone and k.nghe = 'thu-mua');

create index if not exists customers_vai_idx on public.customers (vai);

-- ── 2. Việc làm ──────────────────────────────────────────────────────────────
create table if not exists public.job_posts (
  id           uuid primary key default gen_random_uuid(),
  owner_phone  text not null,                                   -- chuỗi cứng, không bao giờ từ body
  nghe         text not null check (char_length(nghe) between 1 and 20),        -- lib/kairos/ho-so NGHE
  port_id      text not null check (char_length(port_id) between 1 and 40),     -- fishing-ports id
  vi_tri       text[] not null check (cardinality(vi_tri) between 1 and 6),     -- lib/viec VI_TRI
  so_nguoi     integer not null check (so_nguoi between 1 and 30),
  ngay_di      date,
  so_ngay      integer check (so_ngay is null or so_ngay between 1 and 120),
  cong         text check (cong is null or char_length(cong) <= 80),             -- chữ tự do; app không tính tiền
  giay         text[] not null default '{}' check (cardinality(giay) <= 3),     -- lib/viec GIAY
  ghi_chu      text check (ghi_chu is null or char_length(ghi_chu) <= 300),
  boat_reg     text check (boat_reg is null or char_length(boat_reg) <= 30),
  show_boat    boolean not null default false,
  status       text not null default 'mo' check (status in ('mo', 'du', 'an')),  -- mở · đủ người · nhân viên ẩn
  expires_at   timestamptz not null default (now() + interval '14 days'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists job_posts_list_idx on public.job_posts (status, expires_at desc);
create index if not exists job_posts_owner_idx on public.job_posts (owner_phone, created_at desc);
create index if not exists job_posts_port_idx on public.job_posts (port_id, status);
comment on table public.job_posts is 'Việc làm: tin tuyển của chủ tàu (spec 17 §6.1). Hạn 14 ngày, ≤5 tin mở/SĐT (route kiểm).';

create table if not exists public.job_seekers (
  phone        text primary key,
  nghe         text[] not null check (cardinality(nghe) between 1 and 9),
  so_nam       integer check (so_nam is null or so_nam between 0 and 50),
  vi_tri       text[] not null check (cardinality(vi_tri) between 1 and 6),
  ports        text[] not null check (cardinality(ports) between 1 and 3),
  giay         text[] not null default '{}' check (cardinality(giay) <= 3),
  san_sang     date,
  ghi_chu      text check (ghi_chu is null or char_length(ghi_chu) <= 150),
  dang_tim     boolean not null default true,
  bat_luc      timestamptz not null default now(),             -- lần bật gần nhất — quá 30 ngày thì tắt
  updated_at   timestamptz not null default now()
);
create index if not exists job_seekers_list_idx on public.job_seekers (dang_tim, bat_luc desc);
comment on table public.job_seekers is 'Việc làm: hồ sơ tìm tàu, 1/SĐT (spec 17 §6.2). SĐT chỉ trả cho vai chu-tau.';

create table if not exists public.job_reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_phone text not null,
  target_kind    text not null check (target_kind in ('post', 'seeker')),
  target_id      text not null check (char_length(target_id) <= 60),
  reason         text check (reason is null or char_length(reason) <= 300),
  status         text not null default 'moi' check (status in ('moi', 'da_xu_ly', 'bo_qua')),
  created_at     timestamptz not null default now(),
  unique (reporter_phone, target_kind, target_id)
);
create index if not exists job_reports_queue_idx on public.job_reports (status, created_at desc);

drop trigger if exists job_posts_set_updated_at on public.job_posts;
create trigger job_posts_set_updated_at before update on public.job_posts
  for each row execute function public.market_set_updated_at();
drop trigger if exists job_seekers_set_updated_at on public.job_seekers;
create trigger job_seekers_set_updated_at before update on public.job_seekers
  for each row execute function public.market_set_updated_at();

-- ── 3. Hồ sơ vựa ─────────────────────────────────────────────────────────────
create table if not exists public.vua_profiles (
  phone        text primary key,                               -- chủ hồ sơ (chuỗi cứng)
  name         text not null check (char_length(name) between 3 and 60),
  kind         text not null check (kind in ('vua', 'nau', 'nha-may', 'cho')),
  province     text check (province is null or char_length(province) <= 40),
  address      text check (address is null or char_length(address) <= 200),
  species      text[] not null default '{}' check (cardinality(species) <= 20),
  hours        text check (hours is null or char_length(hours) <= 60),
  contact      text check (contact is null or char_length(contact) <= 20),   -- SĐT hiện trên Đầu mối (mặc định = phone)
  status       text not null default 'cho_duyet' check (status in ('cho_duyet', 'hoat_dong', 'tu_choi', 'tam_khoa')),
  status_note  text check (status_note is null or char_length(status_note) <= 300),
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists vua_profiles_status_idx on public.vua_profiles (status, created_at desc);
comment on table public.vua_profiles is 'Hồ sơ vựa tự khai (spec 17 §12.4). hoat_dong mới hiện ở Chợ cá › Đầu mối cạnh sell_contacts.';
drop trigger if exists vua_profiles_set_updated_at on public.vua_profiles;
create trigger vua_profiles_set_updated_at before update on public.vua_profiles
  for each row execute function public.market_set_updated_at();

-- ── 4. Khoá kín ──────────────────────────────────────────────────────────────
alter table public.job_posts    enable row level security;
alter table public.job_seekers  enable row level security;
alter table public.job_reports  enable row level security;
alter table public.vua_profiles enable row level security;
revoke all on table public.job_posts, public.job_seekers, public.job_reports, public.vua_profiles from anon, authenticated;
