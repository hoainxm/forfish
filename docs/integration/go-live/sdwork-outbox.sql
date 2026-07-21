-- ============================================================================
-- SDWork → SDFish: Transactional Outbox (paste vào CRM SDWork, project
-- exueouggmbjtjvsvpfya → SQL Editor → Run). Idempotent — chạy lại an toàn.
--
-- Nguồn spec:  docs/integration/sdwork-outbox-spec.md
-- Field map:   docs/integration/sdwork-field-map.md (khảo sát CRM 2026-06-18)
-- Sau file này: deploy worker (sdwork-outbox-worker.ts) + cron ở cuối file.
--
-- ⚠️ TRƯỚC KHI CHẠY: verify tên bảng/cột ở mục V (cuối file) — schema CRM có
-- thể đã drift so với khảo sát 2026-06-18.
-- ============================================================================

-- ── I. Bảng outbox ──────────────────────────────────────────────────────────
create table if not exists public.sdfish_outbox (
  id          bigserial primary key,
  entity      text not null check (entity in ('customer','device','supply')),
  action      text not null check (action in ('upsert','delete')),
  ref         text not null,             -- UUID PK bản ghi nguồn
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,               -- null = chưa gửi
  attempts    int not null default 0,
  next_try_at timestamptz not null default now(),  -- backoff
  dead        boolean not null default false,      -- quá max retry → xử tay
  last_error  text
);
-- Bảng có thể đã tồn tại từ đợt dựng trước (shape spec cũ, thiếu cột) —
-- `create table if not exists` KHÔNG thêm cột vào bảng cũ, nên alter bù:
alter table public.sdfish_outbox
  add column if not exists attempts    int not null default 0,
  add column if not exists last_error  text,
  add column if not exists next_try_at timestamptz not null default now(),
  add column if not exists dead        boolean not null default false;

create index if not exists sdfish_outbox_pending
  on public.sdfish_outbox (next_try_at) where sent_at is null and not dead;

-- Chỉ service role đọc/ghi (worker); chặn client thường (outbox có thể chứa
-- password khởi tạo tạm thời — spec §9).
alter table public.sdfish_outbox enable row level security;
revoke all on public.sdfish_outbox from anon, authenticated;

-- ── II. Helper build payload (theo field map) ───────────────────────────────

-- customer payload từ accounts (KHÔNG kèm password — password chỉ đi kèm
-- lúc tạo credential, xem trigger temp_credentials).
create or replace function public.sdfish_customer_payload(a public.accounts)
returns jsonb language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'phone', a.login_phone,          -- ĐÃ normalize; NULL → trigger skip
    'name',  a.name
  ));
$$;

-- device payload từ order_item_serials.id
create or replace function public.sdfish_device_payload(p_serial_id uuid)
returns jsonb language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'customerPhone', acc.login_phone,
    'name',          p.name,
    'serial',        ois.serial_number,
    'model',         p.sku,
    'purchasedOn',   to_char(coalesce(o.delivery_confirmed_at, o.confirmed_at)::date, 'YYYY-MM-DD'),
    'warrantyUntil', coalesce(
        to_char(wc.expires_at::date, 'YYYY-MM-DD'),
        to_char((coalesce(o.delivery_confirmed_at, o.confirmed_at)::date
                 + make_interval(months => coalesce(p.warranty_months, 0)))::date, 'YYYY-MM-DD')
      ),
    'orderCode',     o.code
  ))
  from order_item_serials ois
  join products p   on p.id = ois.product_id
  join orders   o   on o.id = ois.order_id
  join accounts acc on acc.id = o.customer_id
  left join warranty_cards wc
    on wc.order_id = ois.order_id and wc.product_id = ois.product_id
   and wc.serial = ois.serial_number and wc.status = 'active'
  where ois.id = p_serial_id
    and acc.type = 'customer' and acc.login_phone is not null;
$$;

-- supply payload từ order_items.id (chỉ hàng không theo serial)
create or replace function public.sdfish_supply_payload(p_item_id uuid)
returns jsonb language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'customerPhone', acc.login_phone,
    'name',          p.name,
    'qty',           oi.qty,
    'unit',          p.unit,
    'orderCode',     o.code
  ))
  from order_items oi
  join products p   on p.id = oi.product_id
  join orders   o   on o.id = oi.order_id
  join accounts acc on acc.id = o.customer_id
  where oi.id = p_item_id
    and p.track_by_serial = false
    and acc.type = 'customer' and acc.login_phone is not null;
$$;

-- Enqueue tiện dụng
create or replace function public.sdfish_enqueue(
  p_entity text, p_action text, p_ref text, p_data jsonb default '{}'
) returns void language sql as $$
  insert into public.sdfish_outbox (entity, action, ref, data)
  values (p_entity, p_action, p_ref, coalesce(p_data, '{}'));
$$;

-- ── III. Triggers ───────────────────────────────────────────────────────────

-- 1) accounts (khách hàng): tạo/sửa → upsert; status → inactive → delete.
--    Skip account thiếu login_phone (field map: chờ backfill phone xong).
create or replace function public.sdfish_tg_accounts() returns trigger
language plpgsql as $$
begin
  if new.type <> 'customer' then return new; end if;
  if new.status = 'inactive' and (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    perform public.sdfish_enqueue('customer', 'delete', new.id::text);
    return new;
  end if;
  if new.login_phone is null then return new; end if;
  -- chỉ enqueue khi field liên quan đổi (tránh nhiễu update khác)
  if tg_op = 'UPDATE'
     and old.login_phone is not distinct from new.login_phone
     and old.name is not distinct from new.name
     and old.status is not distinct from new.status then
    return new;
  end if;
  perform public.sdfish_enqueue('customer', 'upsert', new.id::text,
                                public.sdfish_customer_payload(new));
  return new;
end $$;
drop trigger if exists sdfish_outbox_accounts on public.accounts;
create trigger sdfish_outbox_accounts
  after insert or update on public.accounts
  for each row execute function public.sdfish_tg_accounts();

-- 2) temp_credentials (mật khẩu khởi tạo lúc tạo khách): emit customer upsert
--    KÈM password — đây là event provision tài khoản đăng nhập SDFish.
--    CHỈ context 'create_customer' (reset về sau đi flow riêng — spec §8;
--    và KHÔNG bao giờ emit khi mk đổi từ sdfish-password-in → hết echo-loop §7).
create or replace function public.sdfish_tg_temp_credentials() returns trigger
language plpgsql as $$
declare a public.accounts;
begin
  if new.context <> 'create_customer' then return new; end if;
  select * into a from public.accounts
    where id = new.account_id and type = 'customer' and login_phone is not null;
  if not found then return new; end if;
  perform public.sdfish_enqueue('customer', 'upsert', a.id::text,
    public.sdfish_customer_payload(a) || jsonb_build_object('password', new.temp_password));
  return new;
end $$;
drop trigger if exists sdfish_outbox_temp_credentials on public.temp_credentials;
create trigger sdfish_outbox_temp_credentials
  after insert on public.temp_credentials
  for each row execute function public.sdfish_tg_temp_credentials();

-- 3) order_item_serials (thiết bị theo đơn)
create or replace function public.sdfish_tg_serials() returns trigger
language plpgsql as $$
declare payload jsonb;
begin
  if tg_op = 'DELETE' then
    perform public.sdfish_enqueue('device', 'delete', old.id::text);
    return old;
  end if;
  if new.order_id is null then return new; end if;   -- nhập kho chưa bán
  payload := public.sdfish_device_payload(new.id);
  if payload is null then return new; end if;         -- không phải customer / thiếu phone
  perform public.sdfish_enqueue('device', 'upsert', new.id::text, payload);
  return new;
end $$;
drop trigger if exists sdfish_outbox_serials on public.order_item_serials;
create trigger sdfish_outbox_serials
  after insert or update or delete on public.order_item_serials
  for each row execute function public.sdfish_tg_serials();

-- 4) order_items (vật tư không serial)
create or replace function public.sdfish_tg_order_items() returns trigger
language plpgsql as $$
declare payload jsonb;
begin
  if tg_op = 'DELETE' then
    perform public.sdfish_enqueue('supply', 'delete', old.id::text);
    return old;
  end if;
  payload := public.sdfish_supply_payload(new.id);
  if payload is null then return new; end if;
  perform public.sdfish_enqueue('supply', 'upsert', new.id::text, payload);
  return new;
end $$;
drop trigger if exists sdfish_outbox_order_items on public.order_items;
create trigger sdfish_outbox_order_items
  after insert or update or delete on public.order_items
  for each row execute function public.sdfish_tg_order_items();

-- 5) warranty_cards (kích hoạt/đổi bảo hành → cập nhật lại device liên quan)
create or replace function public.sdfish_tg_warranty() returns trigger
language plpgsql as $$
declare r record;
begin
  for r in
    select ois.id from public.order_item_serials ois
    where ois.order_id = coalesce(new.order_id, old.order_id)
      and ois.product_id = coalesce(new.product_id, old.product_id)
  loop
    perform public.sdfish_enqueue('device', 'upsert', r.id::text,
                                  public.sdfish_device_payload(r.id));
  end loop;
  return coalesce(new, old);
end $$;
drop trigger if exists sdfish_outbox_warranty on public.warranty_cards;
create trigger sdfish_outbox_warranty
  after insert or update or delete on public.warranty_cards
  for each row execute function public.sdfish_tg_warranty();

-- 6) orders: xác nhận giao (delivery_confirmed_at đổi) → refresh device/supply
create or replace function public.sdfish_tg_orders() returns trigger
language plpgsql as $$
declare r record;
begin
  if old.delivery_confirmed_at is not distinct from new.delivery_confirmed_at
     and old.confirmed_at is not distinct from new.confirmed_at then
    return new;
  end if;
  for r in select id from public.order_item_serials where order_id = new.id loop
    perform public.sdfish_enqueue('device', 'upsert', r.id::text,
                                  public.sdfish_device_payload(r.id));
  end loop;
  for r in
    select oi.id from public.order_items oi
    join public.products p on p.id = oi.product_id and p.track_by_serial = false
    where oi.order_id = new.id
  loop
    perform public.sdfish_enqueue('supply', 'upsert', r.id::text,
                                  public.sdfish_supply_payload(r.id));
  end loop;
  return new;
end $$;
drop trigger if exists sdfish_outbox_orders on public.orders;
create trigger sdfish_outbox_orders
  after update on public.orders
  for each row execute function public.sdfish_tg_orders();

-- ── IV. Cron gọi worker mỗi phút (pg_cron + pg_net) ─────────────────────────
-- Điền <ANON_KEY_CRM> rồi chạy. Worker tự thoát nhanh nếu outbox rỗng.
-- ⚠️ timeout_milliseconds BẮT BUỘC: pg_net mặc định chờ 5s, mà worker chạy lô
--    BATCH=100 (1 POST sang SDFish hạn chờ 10s + tối đa 100 update) nên LUÔN
--    vượt 5s → net._http_response ghi status_code null + "Timeout of 5000 ms".
--    Sự cố thật 2026-07-21. Đặt 30s.
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule('sdfish-outbox-push', '* * * * *', $$
--   select net.http_post(
--     url     := 'https://exueouggmbjtjvsvpfya.supabase.co/functions/v1/sdfish-outbox-push',
--     headers := '{"Authorization": "Bearer <ANON_KEY_CRM>", "Content-Type": "application/json"}'::jsonb,
--     body    := '{}'::jsonb,
--     timeout_milliseconds := 30000
--   );
-- $$);

-- ── V. Verify schema trước khi bật (chạy từng dòng, phải có kết quả) ────────
-- select login_phone, name, status, type from accounts limit 1;
-- select temp_password, context, account_id from temp_credentials limit 1;
-- select serial_number, product_id, order_id from order_item_serials limit 1;
-- select qty, product_id, order_id from order_items limit 1;
-- select sku, unit, warranty_months, track_by_serial from products limit 1;
-- select code, customer_id, confirmed_at, delivery_confirmed_at from orders limit 1;
-- select order_id, product_id, serial, status, expires_at from warranty_cards limit 1;
--
-- Cột nào KHÔNG tồn tại → sửa helper/trigger tương ứng phía trên rồi chạy lại.

-- ── VI. Backfill (tuỳ chọn, 1 lần — bơm snapshot khách + đồ hiện hữu) ───────
-- Upsert idempotent nên replay an toàn. 630 account đã provision 2026-06-30;
-- backfill này nạp DATA (customers/devices/supplies) nếu bảng SDFish còn thiếu.
-- insert into public.sdfish_outbox (entity, action, ref, data)
--   select 'customer', 'upsert', a.id::text, public.sdfish_customer_payload(a)
--   from accounts a where a.type='customer' and a.login_phone is not null and a.status <> 'inactive';
-- insert into public.sdfish_outbox (entity, action, ref, data)
--   select 'device', 'upsert', ois.id::text, public.sdfish_device_payload(ois.id)
--   from order_item_serials ois where ois.order_id is not null
--     and public.sdfish_device_payload(ois.id) is not null;
-- insert into public.sdfish_outbox (entity, action, ref, data)
--   select 'supply', 'upsert', oi.id::text, public.sdfish_supply_payload(oi.id)
--   from order_items oi where public.sdfish_supply_payload(oi.id) is not null;
