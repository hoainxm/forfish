-- SDWork CRM (project exueouggmbjtjvsvpfya) — RPC tra auth user theo SĐT, để
-- edge function sdfish-password-in đặt lại mật khẩu khách khi SDFish đẩy sang.
-- Paste vào SQL Editor của project CRM → Run. (Giống 0003 bên SDFish — cùng
-- pattern email ảo {SĐT}@sdvico.local.)
--
-- ⚠️ NẾU CRM lưu khách KHÔNG ở auth.users (mà ở bảng riêng + cột mật khẩu hash)
--    thì BỎ RPC này, sửa edge function trỏ đúng bảng/cách đặt mật khẩu của CRM.

create or replace function public.auth_user_id_by_phone(p_phone text)
  returns uuid
  language sql stable security definer set search_path = public
as $$
  select id from auth.users where email = p_phone || '@sdvico.local' limit 1
$$;
revoke all on function public.auth_user_id_by_phone(text) from public, anon, authenticated;
