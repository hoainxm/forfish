import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authIdentity,
  loginNameFromAuthEmail,
  ownerLogin,
  type StaffScope,
} from "@/lib/admin";
import { tokenIdentity } from "@/lib/device-token-server";
import { loadActor } from "@/lib/staff-store";
import {
  can,
  normalizePermissions,
  type ManagerTab,
  type PermAction,
  type StaffPermissions,
} from "@/lib/staff-permissions";

export type StaffRole = "admin" | "manager";

/** Ai đang thao tác /api/admin/*. admin bỏ qua bảng quyền (permissions=null,
 *  toàn quyền); manager mang bảng quyền đã chuẩn hoá (5 tab × 4 cờ). */
export type StaffContext =
  | {
      ok: true;
      phone: string;
      role: "admin";
      permissions: null;
      scope: StaffScope;
      /** ADMIN TỔNG (OWNER_LOGIN) — người DUY NHẤT nâng/hạ quản trị viên */
      owner: boolean;
    }
  | {
      ok: true;
      phone: string;
      role: "manager";
      permissions: StaffPermissions;
      /** own = khách mình cấp · all_premium = đại lý tổng */
      scope: StaffScope;
      owner: false;
    }
  | { ok: false; status: number; code: string };

/**
 * Kiểm quyền STAFF cho route /api/admin/* — hai vai:
 * · admin   — env ADMIN_PHONES (CỬA CỨU HỘ, web không hạ được) HOẶC hàng
 *             staff_accounts role='admin' (0056; trước khi apply: customers.role)
 *             → toàn quyền (permissions=null).
 * · manager — staff_accounts role='manager' + permissions/scope: quyền theo
 *             TAB × HÀNH ĐỘNG, tầm nhìn own | all_premium.
 * Chưa cấu hình Supabase (demo mode) → không có staff.
 */
export async function requireStaff(): Promise<StaffContext> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, status: 503, code: "not_configured" };

  /*  AI ĐANG GỌI — CHUỖI CỨNG TRƯỚC, rồi mới phiên Supabase cũ (sửa sau sync base
      2026-08-04). App bỏ phiên Supabase (device-token): admin đăng nhập qua
      /login xong là signOut ⇒ chỉ còn chuỗi cứng trong header, KHÔNG còn cookie
      phiên. Đọc mỗi getUser() thì mọi staff token-only bị 401 ⇒ /quan-tri +
      nút "Trang quản trị" chết. `headers()` (next/headers) đọc header request
      ambient trong route handler — khỏi đổi chữ ký requireStaff/các caller.
      KHÔNG tra được sổ chuỗi (DB nghẹt) → 503, KHÔNG 401 (đừng đá staff oan). */
  let phone: string | null = null;
  const tok = await tokenIdentity({
    headers: await headers(),
  } as unknown as Request);
  if (tok.ok) {
    phone = tok.phone;
  } else if (tok.unavailable) {
    return { ok: false, status: 503, code: "unavailable" };
  } else {
    // chưa gửi chuỗi / chuỗi bị thu hồi → thử phiên Supabase cũ (đường lùi)
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email;
    phone = authIdentity(email, ownerLogin()) ?? loginNameFromAuthEmail(email);
  }
  if (!phone) return { ok: false, status: 401, code: "login_required" };

  /*  VAI tra ở MỘT chỗ (lib/staff-store loadActor — RBAC 2026-10-02): env
      ADMIN_PHONES (cứu hộ) → bảng staff_accounts (0056) → đường lùi
      customers.role khi 0056 chưa apply. Tài khoản test/demo/reviewer KHÔNG
      BAO GIỜ là staff. DB không tra được → 503 (không đoán, không đá oan).
      Bảng quyền hỏng/thiếu cột → normalizePermissions fail-closed như cũ. */
  const admin = createAdminClient();
  if (!admin) return { ok: false, status: 503, code: "not_configured" };
  const r = await loadActor(admin, phone);
  if (!r.ok) return { ok: false, status: 503, code: "unavailable" };
  const a = r.actor;
  if (a.role === "admin") {
    return {
      ok: true,
      phone,
      role: "admin",
      permissions: null,
      scope: "all_premium",
      owner: a.owner,
    };
  }
  if (a.role === "manager") {
    return {
      ok: true,
      phone,
      role: "manager",
      permissions: a.permissions ?? normalizePermissions(null),
      scope: a.scope,
      owner: false,
    };
  }
  return { ok: false, status: 403, code: "staff_only" };
}

/** Giữ cho chỗ chỉ chấp nhận ADMIN (hạ hạng/đặt-lại-mật-khẩu/tạo quản lý/xoá
 *  cấu hình/4 tab admin-only cứng). */
export async function requireAdmin(): Promise<
  | { ok: true; phone: string; role: "admin"; scope: StaffScope; owner: boolean }
  | { ok: false; status: number; code: string }
> {
  const who = await requireStaff();
  if (!who.ok) return who;
  if (who.role !== "admin")
    return { ok: false, status: 403, code: "admin_only" };
  return { ok: true, phone: who.phone, role: "admin", scope: who.scope, owner: who.owner };
}

/** CHỈ ADMIN TỔNG — nâng/hạ/tạo quản trị viên (chủ dự án chốt 2026-10-02:
 *  một quản trị viên bị lộ không tự sinh thêm quản trị viên được). */
export async function requireOwner(): Promise<
  { ok: true; phone: string } | { ok: false; status: number; code: string }
> {
  const who = await requireStaff();
  if (!who.ok) return who;
  if (who.role !== "admin" || !who.owner)
    return { ok: false, status: 403, code: "owner_only" };
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
  | { ok: true; phone: string; role: StaffRole; scope: StaffScope }
  | { ok: false; status: number; code: string }
> {
  const who = await requireStaff();
  if (!who.ok) return who;
  if (who.role === "admin")
    return { ok: true, phone: who.phone, role: "admin", scope: who.scope };
  if (!can(who.permissions, tab, action))
    return { ok: false, status: 403, code: "no_permission" };
  return { ok: true, phone: who.phone, role: "manager", scope: who.scope };
}
