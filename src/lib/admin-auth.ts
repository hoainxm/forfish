import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";

export type StaffRole = "admin" | "manager";

/**
 * Kiểm quyền STAFF cho route /api/admin/* — hai nấc (2026-07-26 đợt 2):
 * · admin   — SĐT trong env ADMIN_PHONES: toàn quyền (tạo/xoá/hạ hạng/tạo
 *             tài khoản quản lý)
 * · manager — customers.role='manager' (admin gán): chỉ KÍCH HOẠT/GIA HẠN
 *             premium cho khách (mỗi lần 1 năm, có log premium_grants)
 * Chưa cấu hình Supabase (demo mode) → không có staff.
 */
export async function requireStaff(): Promise<
  | { ok: true; phone: string; role: StaffRole }
  | { ok: false; status: number; code: string }
> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, status: 503, code: "not_configured" };
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) return { ok: false, status: 401, code: "login_required" };
  const phone = email.split("@")[0];

  if (isAdminPhone(phone, parseAdminPhones(process.env.ADMIN_PHONES))) {
    return { ok: true, phone, role: "admin" };
  }

  // quản lý nằm trong DB — tra bằng service-role (chỉ đọc đúng hàng của SĐT
  // đang đăng nhập, không lộ gì thêm)
  const admin = createAdminClient();
  if (!admin) return { ok: false, status: 503, code: "not_configured" };
  try {
    const { data: row, error } = await admin
      .from("customers")
      .select("role")
      .eq("phone", phone)
      .maybeSingle();
    if (!error && row?.role === "manager") {
      return { ok: true, phone, role: "manager" };
    }
  } catch {
    /* cột role chưa có (migration 0004 chưa apply) → không phải manager */
  }
  return { ok: false, status: 403, code: "staff_only" };
}

/** Giữ cho chỗ chỉ chấp nhận ADMIN (tạo/xoá/hạ hạng/tạo quản lý). */
export async function requireAdmin(): Promise<
  { ok: true; phone: string } | { ok: false; status: number; code: string }
> {
  const who = await requireStaff();
  if (!who.ok) return who;
  if (who.role !== "admin")
    return { ok: false, status: 403, code: "admin_only" };
  return { ok: true, phone: who.phone };
}
