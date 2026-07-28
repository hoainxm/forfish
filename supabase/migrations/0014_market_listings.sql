-- SDFish — CHỢ TIN MUA/BÁN (2026-07-27). Chủ tàu tự đăng TIN BÁN (có cá cần
-- bán) và TIN MUA (cần mua gì — đá, dầu, gom hàng…); đầu nậu/vựa/nhà máy sẽ
-- đăng TIN CẦN MUA qua app thu mua (webhook, owner_id NULL + sdwork_ref). Cả
-- làng cùng xem tin đang mở để gọi thẳng nhau, đỡ bị ép giá.
--
-- Auth: dùng lại auth.uid() (0002). ĐỌC = user ĐÃ ĐĂNG NHẬP xem mọi tin 'open'
-- + tin của mình (kể cả đã đóng). GHI = chỉ chủ tin. Webhook bên thu mua ghi
-- qua service-role (bypass RLS) như customers/devices.
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.market_listings (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users (id) on delete cascade,  -- NULL = tin từ webhook thu mua
  side         text not null check (side in ('mua','ban')),         -- ban = cần bán; mua = cần mua
  poster_kind  text not null default 'ngu-dan'
                 check (poster_kind in ('ngu-dan','nau','vua','nha-may','cho')),
  poster_name  text not null,                 -- tên hiển thị (tàu / vựa …)
  species      text not null,                 -- loài, tiếng đời thường
  quantity     text,                          -- khối lượng tự do ("~2 tấn/chuyến")
  price_text   text,                          -- giá tự do ("28–32 nghìn/kg")
  province     text,
  phone        text,                          -- SĐT liên hệ (marketplace: hiện cho người xem gọi)
  note         text,
  status       text not null default 'open' check (status in ('open','closed')),
  sdwork_ref   text unique,                   -- id bên thu mua (idempotent upsert từ webhook)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists market_listings_feed_idx
  on public.market_listings (status, created_at desc);
create index if not exists market_listings_owner_idx
  on public.market_listings (owner_id);

alter table public.market_listings enable row level security;

-- ĐỌC: user đã đăng nhập xem mọi tin đang mở + tin của mình (kể cả đã đóng).
-- Chưa đăng nhập → không thấy tin thật (client tự rơi về TIN MẪU minh họa).
drop policy if exists "market listings readable to signed-in" on public.market_listings;
create policy "market listings readable to signed-in" on public.market_listings
  for select using (
    (status = 'open' and auth.uid() is not null)
    or auth.uid() = owner_id
  );

-- ĐĂNG: chủ tin tự đăng đứng tên mình (không đăng hộ owner khác).
drop policy if exists "market listings insert own" on public.market_listings;
create policy "market listings insert own" on public.market_listings
  for insert with check (auth.uid() = owner_id);

-- SỬA / ĐÓNG: chỉ chủ tin.
drop policy if exists "market listings update own" on public.market_listings;
create policy "market listings update own" on public.market_listings
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- XÓA: chỉ chủ tin.
drop policy if exists "market listings delete own" on public.market_listings;
create policy "market listings delete own" on public.market_listings
  for delete using (auth.uid() = owner_id);
