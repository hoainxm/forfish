-- 0076 — LỘ TRÌNH TÀU AIS THEO GIỜ, GIỮ 7 NGÀY (2026-10-29, anh Long: "tổ chức DB lưu các vị trí thông tin các tàu AIS
-- này, 1h 1 lần để biết cả lộ trình tàu luôn"; "lưu ở server 7 ngày, phần còn lại đưa xuống local … lưu vĩnh viễn dùng
-- để học cái pattern" — kho vĩnh viễn nằm ở máy thu nhà, scripts/tau-ais-thu.mjs).
--
-- MỘT DÒNG = MỘT TÀU MỘT NGÀY (giờ VN), `diem` = mảng điểm theo giờ [[giờ epoch giây, lat, lon, kn, hướng], …] (≤24).
-- Gộp theo ngày thay vì một dòng mỗi điểm: ~8 300 tàu × 8 ngày ≈ 66 nghìn dòng (≈30–60 MB) thay vì 1,6 triệu dòng.
-- Ghi qua hàm `ghi_vet_ais` (route POST /api/tau-ais/nhap gọi mỗi lần máy thu gửi bản ~10 phút): chỉ NỐI điểm khi giờ
-- mới hơn điểm cuối ⇒ gọi lại trong cùng giờ là không làm gì (một điểm mỗi giờ); rồi xoá ngày cũ hơn 7 ngày.
-- Đọc: GET /api/tau-ais/vet?id= (gác middleware như /api/tau-ais — quyền xem AIS). RLS bật + revoke, KHÔNG policy:
-- chỉ service role.

create table if not exists public.tau_ais_vet (
  tau_id    text not null check (char_length(tau_id) between 1 and 64),
  ngay      date not null,
  diem      jsonb not null default '[]'::jsonb check (jsonb_typeof(diem) = 'array'),
  cap_nhat  timestamptz not null default now(),
  primary key (tau_id, ngay)
);

create index if not exists tau_ais_vet_ngay_idx on public.tau_ais_vet (ngay);

alter table public.tau_ais_vet enable row level security;
revoke all on table public.tau_ais_vet from anon, authenticated;

comment on table public.tau_ais_vet is
  'Lộ trình tàu AIS theo giờ, 1 dòng/tàu/ngày (giờ VN), diem = [[epoch_s, lat, lon, kn, huong]]. Giữ 7 ngày (ghi_vet_ais tự xoá). Chỉ service role.';

-- p_gio: mốc GIỜ (epoch giây, đã làm tròn xuống đầu giờ ở route). p_ds: [[tau_id, lat, lon, kn, huong], …].
create or replace function public.ghi_vet_ais(p_gio bigint, p_ds jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ngay date := (to_timestamp(p_gio) at time zone 'Asia/Ho_Chi_Minh')::date;
  n integer;
begin
  if p_ds is null or jsonb_typeof(p_ds) <> 'array' then
    return 0;
  end if;
  insert into public.tau_ais_vet as v (tau_id, ngay, diem, cap_nhat)
  select distinct on (e->>0)
         e->>0,
         v_ngay,
         jsonb_build_array(jsonb_build_array(p_gio, e->1, e->2, e->3, e->4)),
         now()
    from jsonb_array_elements(p_ds) as e
   where jsonb_typeof(e) = 'array'
     and coalesce(e->>0, '') <> ''
     and char_length(e->>0) <= 64
  on conflict (tau_id, ngay) do update
     set diem = v.diem || excluded.diem,
         cap_nhat = now()
   where coalesce((v.diem->-1->>0)::bigint, 0) < p_gio;
  get diagnostics n = row_count;
  delete from public.tau_ais_vet where ngay < v_ngay - 7;
  return n;
end
$$;

revoke all on function public.ghi_vet_ais(bigint, jsonb) from public, anon, authenticated;
