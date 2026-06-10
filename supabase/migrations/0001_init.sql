-- ForFish — initial schema
-- Trục 4 (Tuân thủ dễ hơn): boats + their compliance documents.
-- Built first because it needs no external data source.

-- ── boats ────────────────────────────────────────────────────────────────
create table if not exists public.boats (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  name          text not null,                 -- tên tàu / chủ đặt
  registration  text,                           -- số đăng ký, vd "BV-1234-TS"
  length_m      numeric,                        -- chiều dài (m)
  created_at    timestamptz not null default now()
);

-- ── documents (giấy tờ) ──────────────────────────────────────────────────
-- kind: loại giấy tờ. expires_on drives the reminder logic.
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  boat_id     uuid not null references public.boats (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  kind        text not null,                    -- 'dang_kiem' | 'giay_phep_khai_thac' | ...
  label       text not null,                    -- nhãn hiển thị tiếng Việt
  number      text,                             -- số hiệu giấy tờ
  issued_on   date,
  expires_on  date,                             -- null = không hết hạn
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists documents_boat_id_idx on public.documents (boat_id);
create index if not exists documents_expires_on_idx on public.documents (expires_on);

-- ── row level security ───────────────────────────────────────────────────
alter table public.boats enable row level security;
alter table public.documents enable row level security;

drop policy if exists "boats are private to owner" on public.boats;
create policy "boats are private to owner" on public.boats
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "documents are private to owner" on public.documents;
create policy "documents are private to owner" on public.documents
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
