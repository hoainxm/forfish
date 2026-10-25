-- SDFish — KAIROS: CỖ MÁY PHÂN PHỐI DÒNG TIN + NỘI QUY ĐỒNG Ý MỘT LẦN (2026-10-24)
--
-- 1. kairos_reads — tín hiệu đọc của từng người (anh Long 2026-10-24: "nâng lên" — phân phối tin theo người
--    đọc ở MÁY CHỦ thay vì xếp trong máy). Mỗi (SĐT, bài) một dòng: lần đầu thấy, số lần thấy, đã mở chưa,
--    tổng thời gian dừng đọc. Route /api/kairos/doc ghi (service-role); /api/kairos/feed đọc để chấm điểm
--    (lib/kairos/phan-phoi.ts). Giữ 90 ngày (route xoá dòng cũ của chính người đọc khi ghi).
-- 2. Nội quy (anh Long 2026-10-24: "lúc vào là tự động đồng ý t&c rồi — cho đồng ý 1 lần thôi"): đăng ký app
--    là đã đồng ý điều khoản ⇒ hồ sơ Kairos mới mặc định đã đồng ý nội quy; hồ sơ cũ chưa đồng ý được đánh
--    dấu luôn. Hộp "Nội quy Kairos" vì thế không hiện nữa (composer/post-detail chỉ hiện khi rules_accepted_at null).
--
-- Auth: khuôn 0065 — RLS bật, KHÔNG policy, revoke anon/authenticated. Client không chạm bảng.
-- ⛔ Áp bằng tay (SQL Editor) — anh Long duyệt.

create table if not exists public.kairos_reads (
  phone       text not null,
  post_id     uuid not null references public.kairos_posts (id) on delete cascade,
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  views       integer not null default 1 check (views between 0 and 100000),
  opened      boolean not null default false,
  dwell_ms    integer not null default 0 check (dwell_ms between 0 and 86400000),
  primary key (phone, post_id)
);
create index if not exists kairos_reads_phone_last_idx on public.kairos_reads (phone, last_at desc);
comment on table public.kairos_reads is 'Kairos: tín hiệu đọc (xem/mở/dừng đọc) theo SĐT — chỉ để xếp dòng tin cho chính người đó. Giữ 90 ngày.';

-- Ghi gộp NGUYÊN TỬ (khuôn 0064): cộng dồn views/dwell, opened chỉ bật không tắt. Mảng JSON
-- [{post_id, views, opened, dwell_ms}] ≤ 100 phần tử (route đã kiểm). Bài không tồn tại ⇒ bỏ qua.
create or replace function public.kairos_record_reads(p_phone text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if p_phone is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'bad_input' using errcode = 'P0001';
  end if;
  -- gộp theo bài TRƯỚC (một lô có hai dòng cùng bài ⇒ ON CONFLICT đụng một hàng hai lần là lỗi)
  insert into public.kairos_reads as r (phone, post_id, views, opened, dwell_ms)
  select p_phone, g.post_id, least(g.views, 1000), g.opened, least(g.dwell_ms, 3600000)
  from (
    select (x->>'post_id')::uuid as post_id,
           sum(greatest(0, least(coalesce((x->>'views')::int, 1), 1000)))::int as views,
           bool_or(coalesce((x->>'opened')::boolean, false)) as opened,
           sum(greatest(0, least(coalesce((x->>'dwell_ms')::int, 0), 3600000)))::int as dwell_ms
    from jsonb_array_elements(p_items) x
    group by 1
  ) g
  where exists (select 1 from public.kairos_posts p where p.id = g.post_id)
  on conflict (phone, post_id) do update set
    last_at  = now(),
    views    = least(r.views + excluded.views, 100000),
    opened   = r.opened or excluded.opened,
    dwell_ms = least(r.dwell_ms + excluded.dwell_ms, 86400000);
  get diagnostics n = row_count;
  delete from public.kairos_reads where phone = p_phone and last_at < now() - interval '90 days';
  return n;
end $$;

alter table public.kairos_reads enable row level security;
revoke all on table public.kairos_reads from anon, authenticated;
revoke all on function public.kairos_record_reads(text, jsonb) from public, anon, authenticated;

-- Nội quy: đồng ý một lần (lúc đăng ký app)
alter table public.kairos_profiles alter column rules_accepted_at set default now();
update public.kairos_profiles set rules_accepted_at = created_at where rules_accepted_at is null;
