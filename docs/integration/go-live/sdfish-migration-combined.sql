-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SDFish go-live — gộp 0002_customers + 0003_auth_password_sync.            ║
-- ║ Paste TOÀN BỘ file này 1 lần vào Supabase SQL Editor của project          ║
-- ║ znzgugvfhgmiszqgjulk (SDFish) → Run. Idempotent: chạy lại an toàn.        ║
-- ║ (Bản gốc: supabase/migrations/0002_*.sql + 0003_*.sql — KHÔNG sửa ở đây.) ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 0002: DB khách hàng riêng (webhook nạp) + RLS theo SĐT ──────────────────

-- SĐT của user hiện tại (email ảo {SĐT}@sdvico.local)
create or replace function public.current_phone()
  returns text
  language sql stable security definer set search_path = public
as $$
  select split_part((auth.jwt() ->> 'email'), '@', 1)
$$;

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null unique,
  name        text,
  sdwork_ref  text unique,
  updated_at  timestamptz not null default now()
);

create table if not exists public.devices (
  id             uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  name           text not null,
  serial         text,
  model          text,
  purchased_on   date,
  warranty_until date,
  order_code     text,
  sdwork_ref     text unique,
  updated_at     timestamptz not null default now()
);
create index if not exists devices_customer_phone_idx on public.devices (customer_phone);

create table if not exists public.supplies (
  id             uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  name           text not null,
  qty            numeric,
  unit           text,
  order_code     text,
  sdwork_ref     text unique,
  updated_at     timestamptz not null default now()
);
create index if not exists supplies_customer_phone_idx on public.supplies (customer_phone);

create table if not exists public.support_requests (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  phone       text,
  summary     text not null,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);
create index if not exists support_requests_owner_idx on public.support_requests (owner_id);

alter table public.customers        enable row level security;
alter table public.devices          enable row level security;
alter table public.supplies         enable row level security;
alter table public.support_requests enable row level security;

drop policy if exists "customers readable by owner phone" on public.customers;
create policy "customers readable by owner phone" on public.customers
  for select using (phone = public.current_phone());

drop policy if exists "devices readable by owner phone" on public.devices;
create policy "devices readable by owner phone" on public.devices
  for select using (customer_phone = public.current_phone());

drop policy if exists "supplies readable by owner phone" on public.supplies;
create policy "supplies readable by owner phone" on public.supplies
  for select using (customer_phone = public.current_phone());

drop policy if exists "support requests private to owner" on public.support_requests;
create policy "support requests private to owner" on public.support_requests
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ── 0003: RPC tra auth user theo SĐT (webhook reset mật khẩu cần) ───────────

create or replace function public.auth_user_id_by_phone(p_phone text)
  returns uuid
  language sql stable security definer set search_path = public
as $$
  select id from auth.users where email = p_phone || '@sdvico.local' limit 1
$$;
revoke all on function public.auth_user_id_by_phone(text) from public, anon, authenticated;

-- ── Verify (chạy riêng sau khi Run, phải đủ 4 bảng + 2 function) ────────────
-- select tablename from pg_tables where schemaname='public'
--   and tablename in ('customers','devices','supplies','support_requests');
-- select proname from pg_proc where proname in ('current_phone','auth_user_id_by_phone');
