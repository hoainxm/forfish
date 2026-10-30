-- 0077 — ĐO KAIROS (CDP nội bộ SDVICO), 14 §22. Anh Long 2026-10-30: "cái này tương tự hệ thống CDP — phục vụ nội
-- bộ của mình, không làm lộ lọt dữ liệu KH". Thay A99 ("không đếm bài Tài trợ") bằng A107–A109.
--
-- 1. kairos_tai_tro_dem — lượt XEM (thẻ ≥ 50 % trên màn ≥ 1 s) và lượt BẤM thẻ Tài trợ, GỘP theo (ngày, SĐT, bài
--    tài trợ) — không lưu từng cú bấm, không lưu giờ. Khách chưa đăng nhập không ghi. Giữ 365 ngày.
-- 2. kairos_record_tai_tro(phone, items) — ghi gộp nguyên tử (khuôn kairos_record_reads 0066).
-- 3. kairos_do(days) — MỘT lần gọi trả số liệu cho /quan-tri › Kairos › Đo: từng khách thật (role customer,
--    account_kind real — không tính agent Kairos, tài khoản test, nhân viên) + theo chủ đề + theo bài tài trợ.
--    Nối theo SĐT với đơn Chợ / hỏi mua / hỏi SDVICO đã có sẵn — không thêm cột vào bảng nào.
--
-- Bảo mật: RLS bật, revoke anon/authenticated, KHÔNG policy — chỉ route service-role đọc/ghi. Hàm security definer,
-- revoke khỏi public. Dữ liệu không rời SDVICO (không SDK, không gửi bên thứ ba).

create table if not exists public.kairos_tai_tro_dem (
  ngay   date    not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  phone  text    not null,
  ad_id  text    not null check (ad_id ~ '^[a-z0-9-]{4,40}$'),
  xem    integer not null default 0 check (xem between 0 and 100000),
  bam    integer not null default 0 check (bam between 0 and 100000),
  primary key (ngay, phone, ad_id)
);
create index if not exists kairos_tai_tro_dem_ad_idx on public.kairos_tai_tro_dem (ad_id, ngay desc);
comment on table public.kairos_tai_tro_dem is
  'Kairos: lượt xem/bấm thẻ Tài trợ gộp theo ngày × SĐT × bài — đo nội bộ SDVICO (14 §22, A107). Giữ 365 ngày.';

alter table public.kairos_tai_tro_dem enable row level security;
revoke all on table public.kairos_tai_tro_dem from anon, authenticated;

-- [{id, xem, bam}] ≤ 20 (route đã kiểm). Gộp theo id TRƯỚC (ON CONFLICT đụng một hàng hai lần là lỗi).
create or replace function public.kairos_record_tai_tro(p_phone text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if p_phone is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then
    raise exception 'bad_input' using errcode = 'P0001';
  end if;
  insert into public.kairos_tai_tro_dem as d (phone, ad_id, xem, bam)
  select p_phone, g.ad_id, least(g.xem, 1000), least(g.bam, 1000)
  from (
    select x->>'id' as ad_id,
           sum(greatest(0, least(coalesce((x->>'xem')::int, 0), 1000)))::int as xem,
           sum(greatest(0, least(coalesce((x->>'bam')::int, 0), 1000)))::int as bam
    from jsonb_array_elements(p_items) x
    where (x->>'id') ~ '^[a-z0-9-]{4,40}$'
    group by 1
  ) g
  where g.xem > 0 or g.bam > 0
  on conflict (ngay, phone, ad_id) do update set
    xem = least(d.xem + excluded.xem, 100000),
    bam = least(d.bam + excluded.bam, 100000);
  get diagnostics n = row_count;
  delete from public.kairos_tai_tro_dem
   where phone = p_phone and ngay < ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 365);
  return n;
end $$;
revoke all on function public.kairos_record_tai_tro(text, jsonb) from public, anon, authenticated;

-- Số liệu Đo trong p_days ngày gần nhất (1–90; kairos_reads chỉ giữ 90 ngày).
-- Đọc theo last_at của kairos_reads: một cặp người–bài tính vào khoảng nếu có tín hiệu trong khoảng.
create or replace function public.kairos_do(p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with moc as (
  select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 90))) as t
),
kh as (
  select c.phone, c.name, c.tier, c.device_platform,
         greatest(c.pwa_last_open_at, c.web_last_open_at,
                  (select max(d.last_seen_at) from public.customer_devices d where d.customer_phone = c.phone)) as lan_mo
  from public.customers c
  where c.role = 'customer' and c.account_kind = 'real'
),
rd as (
  select r.phone, r.views, r.opened, r.dwell_ms, p.topic
  from public.kairos_reads r
  join public.kairos_posts p on p.id = r.post_id
  join kh on kh.phone = r.phone
  cross join moc
  where r.last_at >= moc.t
),
r as (
  select phone,
         count(*) filter (where views > 0)::int as bai_xem,
         count(*) filter (where opened)::int as bai_mo,
         coalesce(sum(dwell_ms) filter (where opened) / 1000, 0)::int as giay_doc
  from rd group by phone
),
ct as (
  select phone, jsonb_object_agg(topic, n) as chu_de
  from (select phone, topic, sum(views + case when opened then 3 else 0 end)::int as n from rd group by 1, 2) x
  group by phone
),
tt as (
  select d.phone, d.ad_id, d.xem, d.bam
  from public.kairos_tai_tro_dem d
  join kh on kh.phone = d.phone
  cross join moc
  where d.ngay >= (moc.t at time zone 'Asia/Ho_Chi_Minh')::date
),
ttk as (
  select phone, sum(xem)::int as tt_xem, sum(bam)::int as tt_bam,
         coalesce(array_agg(distinct ad_id) filter (where bam > 0), '{}') as tt_bam_ids
  from tt group by phone
),
don as (
  select u.phone, count(*)::int as n
  from (
    select buyer_phone as phone, created_at from public.market_orders
    union all select buyer_phone, created_at from public.market_requests
    union all select customer_phone, created_at from public.catalog_orders
    union all select customer_phone, created_at from public.product_inquiries
    union all select phone, created_at from public.sdvico_khach_hoi
  ) u cross join moc
  where u.created_at >= moc.t and u.phone is not null
  group by u.phone
),
dong as (
  select kh.phone, kh.name, kh.tier, kh.device_platform, kh.lan_mo,
         kp.que_tinh, kp.home_port,
         coalesce(r.bai_xem, 0) as bai_xem, coalesce(r.bai_mo, 0) as bai_mo, coalesce(r.giay_doc, 0) as giay_doc,
         coalesce(ct.chu_de, '{}'::jsonb) as chu_de,
         coalesce(ttk.tt_xem, 0) as tt_xem, coalesce(ttk.tt_bam, 0) as tt_bam,
         coalesce(ttk.tt_bam_ids, '{}') as tt_bam_ids,
         coalesce(don.n, 0) as don
  from kh
  cross join moc
  left join r on r.phone = kh.phone
  left join ct on ct.phone = kh.phone
  left join ttk on ttk.phone = kh.phone
  left join don on don.phone = kh.phone
  left join public.kairos_profiles kp on kp.phone = kh.phone
  where kh.lan_mo >= moc.t or r.phone is not null or ttk.phone is not null or don.phone is not null
)
select jsonb_build_object(
  'tong_khach', (select count(*) from kh),
  'khach', coalesce((select jsonb_agg(to_jsonb(dong)) from dong), '[]'::jsonb),
  'chu_de', coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'topic', topic, 'nguoi', count(distinct phone), 'luot_xem', sum(views),
        'bai_xem', count(*) filter (where views > 0), 'bai_mo', count(*) filter (where opened),
        'giay_doc', coalesce(sum(dwell_ms) filter (where opened) / 1000, 0)) as x
      from rd group by topic) s), '[]'::jsonb),
  'tai_tro', coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'id', ad_id, 'nguoi_xem', count(distinct phone) filter (where xem > 0), 'luot_xem', sum(xem),
        'nguoi_bam', count(distinct phone) filter (where bam > 0), 'luot_bam', sum(bam)) as x
      from tt group by ad_id) s), '[]'::jsonb)
);
$$;
revoke all on function public.kairos_do(integer) from public, anon, authenticated;
