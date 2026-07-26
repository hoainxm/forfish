import "server-only";
import { createClient } from "./supabase/server";
import { isAdminPhone, parseAdminPhones } from "./admin";

/**
 * Kiểm quyền admin cho mọi route /api/admin/* của web quản trị.
 * Admin = đã đăng nhập (SĐT + mật khẩu, chung tài khoản Supabase với app
 * ngư dân) + SĐT nằm trong env ADMIN_PHONES của WEB NÀY.
 */
export async function requireAdmin(): Promise<
  { ok: true; phone: string } | { ok: false; status: number; code: string }
> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, status: 503, code: "not_configured" };
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) return { ok: false, status: 401, code: "login_required" };
  const phone = email.split("@")[0];
  if (!isAdminPhone(phone, parseAdminPhones(process.env.ADMIN_PHONES))) {
    return { ok: false, status: 403, code: "admin_only" };
  }
  return { ok: true, phone };
}
