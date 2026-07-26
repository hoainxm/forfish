import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";

/**
 * Kiểm quyền admin cho route /api/admin/* — TRẢ SĐT admin hoặc lý do từ chối.
 * Admin = đã đăng nhập (session Supabase) + SĐT nằm trong env ADMIN_PHONES.
 * Chưa cấu hình Supabase (demo mode) → không có admin (dashboard cần DB thật).
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
