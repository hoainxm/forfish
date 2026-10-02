-- 0056 — TỔ CHỨC LẠI TÀI KHOẢN: VAI · LOẠI · HẠN CHUỖI (RBAC 2026-10-02)
--
-- Vì sao (chủ dự án chốt "làm hết" 2026-10-02): vai trò (admin/quản lý), loại
-- tài khoản (thật/test/demo) và hạng (premium) dồn chung một hàng `customers`
-- do webhook SDWork upsert/xoá; "ai là admin" tính lại ở 6 chỗ với 6 luật.
-- Tách thành ba trục độc lập, mỗi trục một nguồn:
--
--   VAI   → bảng `staff_accounts` (mới)          — webhook KHÔNG đụng tới
--   LOẠI  → cột  `customers.account_kind` (mới)  — real | test | demo | reviewer
--   HẠNG  → cột  `customers.tier` (giữ nguyên)
--
-- Kèm hai lớp vá:
--   · `device_tokens.expires_at` — chuỗi của staff/test/demo có hạn. Khách THẬT
--     để NULL = không hạn (luật 0037: bà con mất sóng nhiều ngày ngoài biển).
--   · `current_phone()` — chặn email đuôi lạ giả dạng SĐT (vd
--     `<SĐT nạn nhân>@gmail.com`) đọc được hàng của SĐT đó qua RLS.
--
-- CODE CHẠY ĐƯỢC CẢ TRƯỚC LẪN SAU KHI APPLY (lib/staff-store.ts tự lùi về
-- customers.role / bỏ expires_at khi bảng/cột chưa có). Apply xong thì vai đọc
-- từ bảng mới; `customers.role` + `staff_permissions` vẫn được ghi GƯƠNG để
-- lùi bản deploy không lệch quyền. Gỡ hai cột cũ = migration RIÊNG, sau này.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md 🔴, ref
-- znzgugvfhgmiszqgjulk). Thứ tự an toàn: deploy code TRƯỚC, apply SAU
-- (docs/app-map/ops/rbac-runbook.md).
--
-- ⚠️ OFFLINE: không đổi gì với khách thật — chuỗi của họ vẫn không hạn, không
-- request mới lúc mở app. Chỉ staff/test/demo phải đăng nhập lại theo hạn.

-- ── 1. VAI: staff_accounts ───────────────────────────────────────────────────
create table if not exists public.staff_accounts (
  phone        text primary key,                 -- SĐT chuẩn hoá 0xxxxxxxxx
  role         text not null check (role in ('admin', 'manager')),
  permissions  jsonb,                            -- chỉ manager; NULL = preset mặc định
  scope        text not null default 'own'
               check (scope in ('own', 'all_premium')), -- all_premium = đại lý tổng
  created_by   text,                             -- SĐT người cấp vai gần nhất
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  disabled_at  timestamptz                       -- khoá vai mà giữ lịch sử
);

comment on table public.staff_accounts is
  'VAI quản trị (admin|manager) — tách khỏi customers (webhook SDWork không đụng). Env ADMIN_PHONES chỉ còn là cửa cứu hộ. Xem 0056 + lib/staff-store.ts.';
comment on column public.staff_accounts.scope is
  'Tầm nhìn quản lý: own = khách mình cấp premium; all_premium = mọi khách còn premium (thay env MASTER_AGENT_PHONES).';

-- Chép vai đang có. Không ghi đè nếu chạy lại (idempotent).
insert into public.staff_accounts (phone, role, permissions, created_by)
select c.phone, c.role, case when c.role = 'manager' then c.staff_permissions end, 'migration:0056'
from public.customers c
where c.role in ('admin', 'manager')
on conflict (phone) do nothing;

-- KHOÁ KÍN như device_tokens (0037): chỉ service-role. Khách không có lý do đọc
-- vai của ai, kể cả của mình (UI lấy vai qua /api/admin/health).
alter table public.staff_accounts enable row level security;
revoke all on table public.staff_accounts from anon, authenticated;

-- ── 2. LOẠI tài khoản ────────────────────────────────────────────────────────
alter table public.customers
  add column if not exists account_kind text not null default 'real';

do $$ begin
  alter table public.customers
    add constraint customers_account_kind_check
    check (account_kind in ('real', 'test', 'demo', 'reviewer'));
exception when duplicate_object then null; end $$;

comment on column public.customers.account_kind is
  'real | test | demo | reviewer. Khác real: KHÔNG được làm staff, chuỗi có hạn, loại khỏi thông báo hàng loạt. Chỉ admin đổi (PATCH set-kind) hoặc scripts/test-account.mjs.';

-- ── 3. HẠN CHUỖI ─────────────────────────────────────────────────────────────
alter table public.device_tokens
  add column if not exists expires_at timestamptz;

comment on column public.device_tokens.expires_at is
  'NULL = không hạn (khách thật). Có giá trị = staff 7 ngày / test 24 giờ / demo 7 ngày (lib/admin tokenTtlMs). Quá hạn → cổng coi như chuỗi không có.';

-- ── 4. current_phone(): chặn email đuôi lạ giả dạng SĐT ─────────────────────
-- Luật khớp lib/phone.ts phoneFromAuthEmail:
--   · @sdvico.local                        → phần trước @ (như cũ)
--   · đuôi khác + phần trước @ là SĐT VN   → NULL (không khớp hàng nào)
--   · đuôi khác, không phải SĐT (email thật nhóm SDVICO) → như cũ
create or replace function public.current_phone()
  returns text
  language sql stable security definer set search_path = public
as $$
  with e as (
    select lower(coalesce(auth.jwt() ->> 'email', '')) as email
  ), p as (
    select split_part(email, '@', 1) as local,
           split_part(email, '@', 2) as domain,
           regexp_replace(split_part(email, '@', 1), '\D', '', 'g') as digits
    from e
  )
  select case
    when domain = 'sdvico.local' then local
    when (case when digits like '84%' then substr(digits, 3)
               when digits like '0%'  then substr(digits, 2)
               else digits end) ~ '^[1-9][0-9]{8}$' then null
    else local
  end
  from p
$$;
