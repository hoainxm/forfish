-- 0078 — ĐƠN SDVICO (CRM/SDWork) cho khách lẻ xem ở `/cho/don` (2026-11-02, ADR 0018).
--
-- CRM đẩy snapshot đơn khách lẻ đã xác nhận qua webhook sẵn có `/api/sdwork/webhook`
-- (event entity "order", idempotent theo sdwork_ref = id đơn bên CRM). Bảng này là
-- BẢN SAO CHỈ ĐỌC — khách không huỷ/sửa được; KHÔNG dính máy trạng thái chợ
-- (market_orders). Trạng thái đã chuẩn hoá phía CRM về 4 mã.
--
-- Bảo mật: RLS bật, revoke anon/authenticated, KHÔNG policy — chỉ route service-role
-- đọc (lọc theo SĐT phiên) / webhook ghi qua crm_order_upsert. Không chứa dữ liệu nội
-- bộ CRM (giá vốn, hoa hồng, NV bán, ghi chú, công nợ).
--
-- Rollback: docs/integration/go-live/rollback-0078_crm_orders.sql

create table if not exists public.crm_orders (
  id               uuid primary key default gen_random_uuid(),
  sdwork_ref       text not null unique,                 -- id đơn bên CRM (khoá idempotent)
  code             text not null check (char_length(code) <= 40),   -- DH… / DS…
  customer_phone   text not null check (customer_phone ~ '^0[0-9]{9}$'),
  customer_name    text check (customer_name is null or char_length(customer_name) <= 200),
  status           text not null check (status in ('dang_chuan_bi', 'dang_giao', 'da_giao', 'da_huy')),
  ordered_at       timestamptz,
  items            jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
                     -- [{name, qty, unit, unitPriceVnd, lineTotalVnd}]
  services         jsonb not null default '[]'::jsonb check (jsonb_typeof(services) = 'array'),
                     -- [{name, qty, unitPriceVnd, lineTotalVnd}]
  subtotal_vnd     bigint not null default 0,
  discount_vnd     bigint not null default 0,
  vat_vnd          bigint not null default 0,
  service_vnd      bigint not null default 0,
  total_vnd        bigint not null default 0,
  carrier_name     text check (carrier_name is null or char_length(carrier_name) <= 120),
  tracking_number  text check (tracking_number is null or char_length(tracking_number) <= 120),
  external_ref     text check (external_ref is null or char_length(external_ref) <= 120),
  snapshot_at      timestamptz not null,                 -- giờ CRM chụp — chống bản cũ ghi đè bản mới
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists crm_orders_phone_idx
  on public.crm_orders (customer_phone, ordered_at desc);
comment on table public.crm_orders is
  'Đơn SDVICO (CRM) của khách lẻ — bản sao chỉ đọc, nạp qua /api/sdwork/webhook entity=order. Hiện ở /cho/don.';

alter table public.crm_orders enable row level security;
revoke all on table public.crm_orders from anon, authenticated;

-- "BIA MỘ" khi CRM gỡ đơn (KH đơn không còn là khách lẻ / đơn bị xoá cứng): nhớ
-- snapshot_at của lệnh gỡ ⇒ event upsert CŨ HƠN retry tới sau KHÔNG làm đơn sống
-- lại (kể cả khi lệnh gỡ tới trước khi bản upsert nào được ghi). Upsert MỚI HƠN
-- (đơn quay lại khách lẻ) vẫn qua.
create table if not exists public.crm_order_tombstones (
  sdwork_ref   text primary key,
  snapshot_at  timestamptz not null,
  created_at   timestamptz not null default now()
);
comment on table public.crm_order_tombstones is
  'Đơn CRM đã gỡ khỏi crm_orders + mốc snapshot của lệnh gỡ — chặn upsert cũ hơn làm đơn sống lại (ADR 0018).';
alter table public.crm_order_tombstones enable row level security;
revoke all on table public.crm_order_tombstones from anon, authenticated;

-- Ghi CÓ ĐIỀU KIỆN: chỉ nhận bản có snapshot_at >= bản đang có (event cũ retry tới
-- sau event mới thì bỏ). Trả 'applied' | 'stale'. Vào: hàng ĐÃ map ở TS
-- (lib/sdwork-webhook.ts toCrmOrderRow — đã validate + làm tròn tiền).
create or replace function public.crm_order_upsert(p jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if exists (
    select 1 from public.crm_order_tombstones t
     where t.sdwork_ref = p->>'sdwork_ref' and t.snapshot_at >= (p->>'snapshot_at')::timestamptz
  ) then
    return 'stale';
  end if;
  insert into public.crm_orders as c (
    sdwork_ref, code, customer_phone, customer_name, status, ordered_at, items, services,
    subtotal_vnd, discount_vnd, vat_vnd, service_vnd, total_vnd,
    carrier_name, tracking_number, external_ref, snapshot_at
  ) values (
    p->>'sdwork_ref', p->>'code', p->>'customer_phone', nullif(p->>'customer_name', ''),
    p->>'status', (p->>'ordered_at')::timestamptz,
    coalesce(p->'items', '[]'::jsonb), coalesce(p->'services', '[]'::jsonb),
    coalesce((p->>'subtotal_vnd')::bigint, 0), coalesce((p->>'discount_vnd')::bigint, 0),
    coalesce((p->>'vat_vnd')::bigint, 0), coalesce((p->>'service_vnd')::bigint, 0),
    coalesce((p->>'total_vnd')::bigint, 0),
    nullif(p->>'carrier_name', ''), nullif(p->>'tracking_number', ''), nullif(p->>'external_ref', ''),
    (p->>'snapshot_at')::timestamptz
  )
  on conflict (sdwork_ref) do update set
    code            = excluded.code,
    customer_phone  = excluded.customer_phone,
    customer_name   = excluded.customer_name,
    status          = excluded.status,
    ordered_at      = excluded.ordered_at,
    items           = excluded.items,
    services        = excluded.services,
    subtotal_vnd    = excluded.subtotal_vnd,
    discount_vnd    = excluded.discount_vnd,
    vat_vnd         = excluded.vat_vnd,
    service_vnd     = excluded.service_vnd,
    total_vnd       = excluded.total_vnd,
    carrier_name    = excluded.carrier_name,
    tracking_number = excluded.tracking_number,
    external_ref    = excluded.external_ref,
    snapshot_at     = excluded.snapshot_at,
    updated_at      = now()
  where c.snapshot_at <= excluded.snapshot_at
  returning c.id into v_id;
  return case when v_id is null then 'stale' else 'applied' end;
end
$$;
revoke all on function public.crm_order_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.crm_order_upsert(jsonb) to service_role;

-- Gỡ đơn: ghi/nâng bia mộ rồi xoá hàng (chỉ khi hàng không mới hơn lệnh gỡ).
-- p_snapshot_at NULL (CRM cũ không gửi) ⇒ coi như now(). Trả 'applied' | 'stale'.
create or replace function public.crm_order_delete(p_ref text, p_snapshot_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_at timestamptz := coalesce(p_snapshot_at, now());
begin
  insert into public.crm_order_tombstones as t (sdwork_ref, snapshot_at)
  values (p_ref, v_at)
  on conflict (sdwork_ref) do update set snapshot_at = greatest(t.snapshot_at, excluded.snapshot_at);
  delete from public.crm_orders c where c.sdwork_ref = p_ref and c.snapshot_at <= v_at;
  return case when exists (select 1 from public.crm_orders c where c.sdwork_ref = p_ref)
              then 'stale' else 'applied' end;
end
$$;
revoke all on function public.crm_order_delete(text, timestamptz) from public, anon, authenticated;
grant execute on function public.crm_order_delete(text, timestamptz) to service_role;
