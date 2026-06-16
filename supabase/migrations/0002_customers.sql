-- SDFish — DB khách hàng RIÊNG (tách SDWork). App khách hàng: theo dõi thiết
-- bị / bảo hành / hỗ trợ. Dữ liệu KH/thiết bị/vật tư do WEBHOOK SDWork nạp
-- (service-role, bypass RLS); KH chỉ ĐỌC hàng của mình (RLS theo SĐT).
-- Auth: SĐT + OTP (otp_codes) + mật khẩu phụ. Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).

-- ── SĐT của user hiện tại (email ảo {SĐT}@sdvico.local) ────────────────────
create or replace function public.current_phone()
  returns text
  language sql stable security definer set search_path = public
as $$
  select split_part((auth.jwt() ->> 'email'), '@', 1)
$$;

-- ── customers (webhook nạp) ────────────────────────────────────────────────
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null unique,            -- định danh KH (đã chuẩn hoá 0xxxxxxxxx)
  name        text,
  sdwork_ref  text unique,                     -- id bên SDWork (idempotent upsert)
  updated_at  timestamptz not null default now()
);

-- ── devices (= sản phẩm đã mua + bảo hành) ─────────────────────────────────
create table if not exists public.devices (
  id             uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  name           text not null,
  serial         text,
  model          text,
  purchased_on   date,
  warranty_until date,                         -- null = không rõ
  order_code     text,
  sdwork_ref     text unique,
  updated_at     timestamptz not null default now()
);
create index if not exists devices_customer_phone_idx on public.devices (customer_phone);

-- ── supplies (vật tư theo KH) ──────────────────────────────────────────────
create table if not exists public.supplies (
  id             uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  name           text not null,
  qty            numeric,
  order_code     text,
  sdwork_ref     text unique,
  updated_at     timestamptz not null default now()
);
create index if not exists supplies_customer_phone_idx on public.supplies (customer_phone);

-- ── support_requests (KH tự tạo — hỗ trợ kỹ thuật) ─────────────────────────
create table if not exists public.support_requests (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  phone       text,
  summary     text not null,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);
create index if not exists support_requests_owner_idx on public.support_requests (owner_id);

-- ── otp_codes (chỉ service-role chạm — RLS bật, không policy) ───────────────
create table if not exists public.otp_codes (
  phone        text primary key,               -- 1 mã sống / SĐT
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  last_sent_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.customers        enable row level security;
alter table public.devices          enable row level security;
alter table public.supplies         enable row level security;
alter table public.support_requests enable row level security;
alter table public.otp_codes        enable row level security;

-- KH chỉ ĐỌC hàng của mình; ghi do webhook (service-role, bypass RLS).
drop policy if exists "customers readable by owner phone" on public.customers;
create policy "customers readable by owner phone" on public.customers
  for select using (phone = public.current_phone());

drop policy if exists "devices readable by owner phone" on public.devices;
create policy "devices readable by owner phone" on public.devices
  for select using (customer_phone = public.current_phone());

drop policy if exists "supplies readable by owner phone" on public.supplies;
create policy "supplies readable by owner phone" on public.supplies
  for select using (customer_phone = public.current_phone());

-- support_requests: KH tạo + đọc của mình (owner-style như boats/documents).
drop policy if exists "support requests private to owner" on public.support_requests;
create policy "support requests private to owner" on public.support_requests
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- otp_codes: RLS bật + KHÔNG policy = chỉ service-role (admin client) truy cập.
