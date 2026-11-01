-- 0078 — TÀU QUANH MỘT ĐIỂM, N GIỜ QUA (2026-10-31, anh Long: "đè 3 s thì cho ra option … xem tàu có phát AIS trong bán
-- kính 6 hải lý trong 6h, tính năng này chỉ với acc của 0938635689").
--
-- Đọc bảng tau_ais_vet (0076) — KHÔNG thêm bảng/cột. Lọc THÔ theo hộp độ quanh tâm + giờ ngay trong Postgres để
-- route không phải kéo cả ~8 000 dòng/ngày về; vòng tròn thật (haversine) lọc lại ở route (lib/tau-ais-quanh gopTauQuanh).
-- Trả mỗi tàu một dòng, `diem` = các mốc lọt hộp [[epoch_s, lat, lon, kn, huong], …] theo giờ tăng dần.
-- Gọi: GET /api/tau-ais/quanh (gác middleware feature "ais"). Chỉ service role, như ghi_vet_ais.

create or replace function public.tau_ais_quanh(p_lat double precision, p_lon double precision, p_km double precision, p_tu bigint)
returns table (tau_id text, diem jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select v.tau_id, jsonb_agg(e order by (e->>0)::bigint) as diem
    from public.tau_ais_vet v
   cross join lateral jsonb_array_elements(v.diem) as e
   where v.ngay >= (to_timestamp(p_tu) at time zone 'Asia/Ho_Chi_Minh')::date
     and v.cap_nhat >= to_timestamp(p_tu)
     and jsonb_typeof(e) = 'array'
     and jsonb_typeof(e->0) = 'number' and jsonb_typeof(e->1) = 'number' and jsonb_typeof(e->2) = 'number'
     and (e->>0)::bigint >= p_tu
     and abs((e->>1)::double precision - p_lat) <= least(p_km, 100) / 111.0
     and abs((e->>2)::double precision - p_lon) <= least(p_km, 100) / (111.0 * greatest(cos(radians(p_lat)), 0.2))
   group by v.tau_id
   limit 2000
$$;

revoke all on function public.tau_ais_quanh(double precision, double precision, double precision, bigint) from public, anon, authenticated;
