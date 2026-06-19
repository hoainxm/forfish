-- SDFish — đồng bộ MẬT KHẨU 2 chiều với SDWork (1 credential dùng cho cả 2 app).
-- Webhook reset (SDWork→SDFish) cần tra auth user theo SĐT để updateUserById.
-- auth.users KHÔNG đọc được qua PostgREST → RPC security-definer tra id theo
-- email ảo {SĐT}@sdvico.local. CHỈ service-role gọi (webhook), nên revoke public.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).

create or replace function public.auth_user_id_by_phone(p_phone text)
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select id
  from auth.users
  where email = p_phone || '@sdvico.local'
  limit 1
$$;

-- Chỉ tiến trình đặc quyền (service-role) được tra — không lộ cho anon/authenticated.
revoke all on function public.auth_user_id_by_phone(text) from public, anon, authenticated;
