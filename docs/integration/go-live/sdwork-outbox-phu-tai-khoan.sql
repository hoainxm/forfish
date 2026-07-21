-- ============================================================================
-- SDWork → SDFish: VÁ PHỦ TÀI KHOẢN (paste vào CRM SDWork, project
-- exueouggmbjtjvsvpfya → SQL Editor → Run). Idempotent — chạy lại an toàn.
--
-- Mục tiêu (yêu cầu user 2026-07-21): MỌI khách hàng trong SDWork — hiện tại
-- lẫn tạo mới về sau — đều có 1 tài khoản đăng nhập SDFish tương ứng.
--
-- CHẠY SAU `sdwork-outbox.sql` (file này chỉ ĐÈ LẠI helper/trigger đã có).
--
-- Bối cảnh số liệu CRM 2026-07-21 (user chạy thống kê):
--   customer     574 (540 có SĐT ·  34 thiếu · 32 tạo sau đợt provision 30/06)
--   sub          106 (100 có SĐT ·   6 thiếu ·  5 tạo sau)
--   supplier      22 (  0 có SĐT ·  22 thiếu ·  7 tạo sau)  ← nhà cung cấp, KHÔNG phải khách
--   collaborator   5 (  5 có SĐT)
--   distributor    1 (  1 có SĐT)
--   → Khách thật (trừ supplier) = 686, đủ điều kiện (có SĐT) = 646.
--   → SDFish đang có 630 tài khoản từ CRM ⇒ THIẾU ~16 tài khoản.
--
-- BA LỖ HỔNG file này vá:
--   A. `sdwork-outbox.sql` hardcode `type = 'customer'` ở 4 chỗ → nhóm sub /
--      collaborator / distributor (112 account) KHÔNG bao giờ được tạo tài
--      khoản khi tạo mới — dù đợt provision 30/06 ĐÃ tạo cho họ (95 sub + 5
--      collab + 2 distributor). Luồng tự động HẸP HƠN đợt provision → lệch.
--   B. Không có cơ chế bù khi webhook rớt / tạo ngoài giờ trigger → mục III
--      thêm đồng bộ lại ĐỊNH KỲ (tự lành, không cần ai theo dõi).
--   C. 40 khách thật thiếu `login_phone` → im lặng bị bỏ qua. Mục IV liệt kê
--      ra để nhân viên bổ sung số (KHÔNG tự chế số).
--
-- ⚠️ Supplier (22) CỐ Ý loại: nhà cung cấp cho SDVICO, không phải ngư dân
--    dùng app. Muốn phủ luôn thì thêm 'supplier' vào mục I.
-- ============================================================================

-- ── I. Nguồn sự thật DUY NHẤT: loại account nào được có tài khoản SDFish ────
-- Đổi danh sách ở ĐÂY là đổi cho toàn bộ trigger + backfill + đối soát bên dưới.
--
-- ⚠️ `accounts.type` là ENUM `account_type` (không phải text) → MỌI so sánh với
--    mảng này phải ép `type::text = any(...)`. Thiếu ::text sẽ lỗi:
--    "42883: operator does not exist: account_type = text" (đã vấp 2026-07-21).
--    Ép ::text cũng an toàn hơn enum literal: tên loại không tồn tại trong enum
--    thì chỉ KHÔNG khớp, không làm hỏng cả câu lệnh.
create or replace function public.sdfish_khach_types()
returns text[] language sql immutable as $$
  select array['customer','sub','collaborator','distributor']::text[];
$$;

-- ── II. Đè lại helper + trigger: 'customer' → mọi loại khách ────────────────

-- device payload: bỏ ràng buộc type='customer'
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
    and acc.type::text = any(public.sdfish_khach_types())
    and acc.login_phone is not null;
$$;

-- supply payload: bỏ ràng buộc type='customer'
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
    and acc.type::text = any(public.sdfish_khach_types())
    and acc.login_phone is not null;
$$;

-- trigger accounts: bỏ ràng buộc type='customer'
create or replace function public.sdfish_tg_accounts() returns trigger
language plpgsql as $$
begin
  if not (new.type::text = any(public.sdfish_khach_types())) then return new; end if;
  if new.status = 'inactive' and (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    perform public.sdfish_enqueue('customer', 'delete', new.id::text);
    return new;
  end if;
  if new.login_phone is null then return new; end if;
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

-- trigger temp_credentials (mật khẩu khởi tạo): bỏ ràng buộc type='customer'
create or replace function public.sdfish_tg_temp_credentials() returns trigger
language plpgsql as $$
declare a public.accounts;
begin
  if new.context <> 'create_customer' then return new; end if;
  select * into a from public.accounts
    where id = new.account_id
      and type::text = any(public.sdfish_khach_types())
      and login_phone is not null;
  if not found then return new; end if;
  perform public.sdfish_enqueue('customer', 'upsert', a.id::text,
    public.sdfish_customer_payload(a) || jsonb_build_object('password', new.temp_password));
  return new;
end $$;

-- ── III. Đồng bộ lại ĐỊNH KỲ — tự lành, phủ cả khoảng trống 30/06 → nay ─────
-- Đẩy lại TOÀN BỘ khách đủ điều kiện. An toàn tuyệt đối: phía SDFish, khách đã
-- có tài khoản + KHÔNG kèm `resetPassword` → BỎ QUA, không ghi đè mật khẩu KH
-- đã tự đổi (hợp đồng §5). Nên chạy lại bao nhiêu lần cũng được.
--
-- ⚠️ Đợt này KHÔNG kèm password → chỉ upsert HỒ SƠ, KHÔNG tạo được tài khoản
--    đăng nhập cho khách chưa có. Muốn tạo tài khoản cho ~16 khách còn thiếu,
--    CRM phải sinh `temp_credentials` context 'create_customer' cho họ (trigger
--    mục II sẽ tự bắn kèm mật khẩu khởi tạo) — xem mục V.
create or replace function public.sdfish_dong_bo_lai()
returns integer language plpgsql as $$
declare n integer;
begin
  insert into public.sdfish_outbox (entity, action, ref, data)
  select 'customer', 'upsert', a.id::text, public.sdfish_customer_payload(a)
  from public.accounts a
  where a.type::text = any(public.sdfish_khach_types())
    and a.login_phone is not null
    and a.status <> 'inactive';
  get diagnostics n = row_count;
  return n;
end $$;

-- Chạy tay 1 lần ngay (bù khoảng trống 30/06 → nay):
-- select public.sdfish_dong_bo_lai();

-- Hẹn giờ hằng tuần (03:00 sáng Chủ nhật, giờ VN = 20:00 thứ Bảy UTC).
-- Cần extension pg_cron (đã bật ở mục IV file sdwork-outbox.sql).
-- select cron.schedule('sdfish-dong-bo-lai-tuan', '0 20 * * 6',
--                      $$select public.sdfish_dong_bo_lai();$$);

-- ── IV. Danh sách khách THIẾU SĐT — không bao giờ có tài khoản nếu không bù ──
-- Giao nhân viên bổ sung `login_phone` trong CRM. KHÔNG tự chế số.
-- select id, type, name, status, created_at
--   from public.accounts
--  where type::text = any(public.sdfish_khach_types())
--    and login_phone is null
--    and status <> 'inactive'
--  order by type, created_at desc;

-- ── V. Đối soát: khách đủ điều kiện vs tài khoản SDFish đã có ───────────────
-- Chạy ở CRM để biết TỔNG đủ điều kiện:
-- select count(*) from public.accounts
--  where type::text = any(public.sdfish_khach_types())
--    and login_phone is not null and status <> 'inactive';
--
-- Rồi chạy ở SDFish (znzgugvfhgmiszqgjulk) để biết SỐ ĐÃ CÓ:
-- select count(*) from auth.users where email like '%@sdvico.local';
--
-- Lệch > 0 = còn khách chưa có tài khoản đăng nhập → sinh temp_credentials
-- context 'create_customer' cho nhóm đó ở CRM (trigger mục II tự bắn kèm mật
-- khẩu khởi tạo sang SDFish).
