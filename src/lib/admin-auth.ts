import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";
import {
  can,
  isMissingColumnError,
  normalizePermissions,
  type ManagerTab,
  type PermAction,
  type StaffPermissions,
} from "@/lib/staff-permissions";

export type StaffRole = "admin" | "manager";

/** Ai đang thao tác /api/admin/*. admin bỏ qua bảng quyền (permissions=null,
 *  toàn quyền); manager mang bảng quyền đã chuẩn hoá (5 tab × 4 cờ). */
export type StaffContext =
  | { ok: true; phone: string; role: "admin"; permissions: null }
  | { ok: true; phone: string; role: "manager"; permissions: StaffPermissions }
  | { ok: false; status: number; code: string };

/**
 * Kiểm quyền STAFF cho route /api/admin/* — hai vai (2026-07-30 phân quyền):
 * · admin   — SĐT trong env ADMIN_PHONES **HOẶC** customers.role='admin'
 *             (2026-07-31, user chốt): toàn quyền (permissions=null). Nguồn DB
 *             để thêm/bớt quản trị viên ngay trên web không cần deploy; env
 *             giữ lại làm CỬA CỨU HỘ (web không hạ được admin từ env).
 * · manager — customers.role='manager' (0004) + customers.staff_permissions
 *             (0017): quyền theo TAB × HÀNH ĐỘNG. Chưa apply 0017 (cột chưa
 *             có) → dùng preset mặc định để quản lý vẫn làm việc được.
 * Chưa cấu hình Supabase (demo mode) → không có staff.
 */
export async function requireStaff(): Promise<StaffContext> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, status: 503, code: "not_configured" };
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) return { ok: false, status: 401, code: "login_required" };
  const phone = email.split("@")[0];

  if (isAdminPhone(phone, parseAdminPhones(process.env.ADMIN_PHONES))) {
    return { ok: true, phone, role: "admin", permissions: null };
  }

  // staff nằm trong DB — tra bằng service-role (chỉ đọc đúng hàng của SĐT
  // đang đăng nhập, không lộ gì thêm)
  const admin = createAdminClient();
  if (!admin) return { ok: false, status: 503, code: "not_configured" };
  try {
    const { data: row, error } = await admin
      .from("customers")
      .select("role")
      .eq("phone", phone)
      .maybeSingle();
    // QUẢN TRỊ VIÊN nguồn DB — toàn quyền y như admin env, KHÔNG tra bảng quyền
    if (!error && row?.role === "admin") {
      return { ok: true, phone, role: "admin", permissions: null };
    }
    if (!error && row?.role === "manager") {
      /*  Bảng quyền tra RIÊNG: 0017 chưa apply (cột chưa có) thì KHÔNG được coi
          quản lý là "không phải staff" — vẫn cho vào với preset mặc định.

          ⚠️ NHƯNG CHỈ CA ĐÓ (sửa 2026-08-16, thẩm định P1). Bản cũ nuốt MỌI
          lỗi vào cùng một nhánh preset, nên Postgres nghẹt / schema cache hỏng
          cũng cấp `view+create+edit` trên cả 6 tab cho một người mà máy chủ
          vừa không tra nổi quyền. Cấp quyền vì hạ tầng hỏng là fail-open —
          đúng thứ `can()` được viết ra để chặn. Nay: cột chưa có → preset (chủ
          ý cũ, giữ nguyên); lỗi khác → 503, để màn quản trị báo "chưa tra được"
          và người ta thử lại, thay vì lặng lẽ làm việc với quyền không ai cấp. */
      let permissions: StaffPermissions;
      try {
        const { data: p, error: pErr } = await admin
          .from("customers")
          .select("staff_permissions")
          .eq("phone", phone)
          .maybeSingle();
        if (pErr && !isMissingColumnError(pErr)) {
          console.error("[admin-auth] tra bảng quyền HỎNG:", pErr.code, pErr.message);
          return { ok: false, status: 503, code: "unavailable" };
        }
        permissions = normalizePermissions(
          (p as { staff_permissions?: unknown } | null)?.staff_permissions,
        );
      } catch (e) {
        // Ném thật (mạng/driver) — cũng là "chưa biết", không phải "cột chưa có"
        if (!isMissingColumnError(e)) {
          return { ok: false, status: 503, code: "unavailable" };
        }
        permissions = normalizePermissions(null);
      }
      return { ok: true, phone, role: "manager", permissions };
    }
  } catch {
    /* cột role chưa có (migration 0004 chưa apply) → không phải manager */
  }
  return { ok: false, status: 403, code: "staff_only" };
}

/** Giữ cho chỗ chỉ chấp nhận ADMIN (hạ hạng/đặt-lại-mật-khẩu/tạo quản lý/xoá
 *  cấu hình/4 tab admin-only cứng). */
export async function requireAdmin(): Promise<
  { ok: true; phone: string } | { ok: false; status: number; code: string }
> {
  const who = await requireStaff();
  if (!who.ok) return who;
  if (who.role !== "admin")
    return { ok: false, status: 403, code: "admin_only" };
  return { ok: true, phone: who.phone };
}

/**
 * Chốt thật một HÀNH ĐỘNG trên một TAB được phép. admin luôn qua; manager tra
 * bảng quyền (fail-closed). Trả kèm role/phone để route ghi log/áp thêm luật
 * (vd tạo tài khoản QUẢN LÝ vẫn admin-only dù có tai-khoan:create).
 */
export async function requirePermission(
  tab: ManagerTab,
  action: PermAction,
): Promise<
  | { ok: true; phone: string; role: StaffRole }
  | { ok: false; status: number; code: string }
> {
  const who = await requireStaff();
  if (!who.ok) return who;
  if (who.role === "admin") return { ok: true, phone: who.phone, role: "admin" };
  if (!can(who.permissions, tab, action))
    return { ok: false, status: 403, code: "no_permission" };
  return { ok: true, phone: who.phone, role: "manager" };
}
