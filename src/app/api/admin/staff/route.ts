// /api/admin/staff — PHÂN QUYỀN NHÂN SỰ. ADMIN-ONLY.
// · GET   : quản trị viên (env + DB) + quản lý kèm bảng quyền đã chuẩn hoá
//           (6 tab × view/create/edit/delete) và tầm nhìn (own | all_premium).
// · PATCH : { phone, permissions } — bảng quyền một quản lý (fail-closed)
//           { phone, action:'set-scope', scope } — tầm nhìn quản lý
//           { phone, action:'set-role', role } — nâng/hạ vai (3 chốt + thu hồi chuỗi)
// Nguồn VAI: bảng staff_accounts (0056, RBAC 2026-10-02) — đọc/ghi qua
// lib/staff-store (gương sang customers.role để đường lùi không lệch).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import {
  checkSetRole,
  isOwnerIdentity,
  mergeAdmins,
  ownerLogin,
  normalizeStaffScope,
  parseAdminPhones,
} from "@/lib/admin";
import {
  listDbStaff,
  loadActor,
  writeStaffPermissions,
  writeStaffRole,
} from "@/lib/staff-store";
import { revokeTokensOfPhone } from "@/lib/device-token-server";
import { normalizeVnPhone } from "@/lib/phone";
import { normalizePermissions } from "@/lib/staff-permissions";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET() {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  // Nguồn VAI: staff_accounts (0056) — chưa apply thì đọc customers.role
  // (listDbStaff tự lùi) và báo migrationNeeded để UI nói thật.
  const staff = await listDbStaff(admin);
  if (!staff.ok) return err(500, "query_failed");
  const migrationNeeded = !staff.tableReady;

  const envPhones = parseAdminPhones(process.env.ADMIN_PHONES);
  const dbAdminPhones = staff.rows.filter((r) => r.role === "admin").map((r) => r.phone);
  const merged = mergeAdmins(envPhones, dbAdminPhones);

  // tên hiển thị: gom từ hàng customers (admin env có thể chưa có hàng nào)
  const phones = [...new Set([...merged.map((a) => a.phone), ...staff.rows.map((r) => r.phone)])];
  const names: Record<string, string | null> = {};
  if (phones.length > 0) {
    const { data: nRows } = await admin.from("customers").select("phone, name").in("phone", phones);
    for (const r of (nRows ?? []) as { phone: string; name: string | null }[])
      names[r.phone] = r.name ?? null;
  }

  const managers = staff.rows
    .filter((r) => r.role === "manager")
    .map((r) => ({
      phone: r.phone,
      name: names[r.phone] ?? null,
      permissions: normalizePermissions(r.permissions),
      // đã cấu hình tay chưa (null = còn ở preset mặc định)
      configured: r.permissions != null,
      scope: r.scope,
    }));
  // ADMIN TỔNG đứng đầu danh sách (nguồn "owner" — web không hạ/xoá được)
  const owner = ownerLogin();
  const admins = [
    ...(owner ? [{ phone: owner, name: "Admin tổng", source: "owner" as const }] : []),
    ...merged.map((a) => ({
      phone: a.phone,
      name: names[a.phone] ?? null,
      source: a.source,
    })),
  ];

  return NextResponse.json({
    ok: true,
    managers,
    admins,
    migrationNeeded,
    /** người đang xem có phải admin tổng — UI chỉ hiện nút nâng/hạ admin khi true */
    canManageAdmins: who.owner || !owner,
  });
}

export async function PATCH(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    permissions?: unknown;
    action?: string;
    role?: string;
    scope?: string;
  } | null;
  if (!body?.phone) return err(400, "bad_phone");
  // Admin tổng không phải đối tượng của bất kỳ thao tác nào ở đây
  if (isOwnerIdentity(body.phone, ownerLogin())) return err(400, "owner");
  const phone = normalizeVnPhone(body.phone);

  // ── NÂNG/HẠ QUẢN TRỊ VIÊN (2026-07-31) ───────────────────────────────────
  // Đổi customers.role giữa 'admin' ⇄ 'manager'/'customer'. Chặn 3 kiểu tự bắn
  // vào chân bằng checkDemoteAdmin (thuần, có test): tự hạ mình · hạ admin từ
  // env (web không sửa được env) · hạ mất người cuối cùng.
  if (body.action === "set-role") {
    const nextRole =
      body.role === "admin"
        ? "admin"
        : body.role === "manager"
          ? "manager"
          : body.role === "customer"
            ? "customer"
            : null;
    if (!nextRole) return err(400, "bad_role");

    const envPhones = parseAdminPhones(process.env.ADMIN_PHONES);

    const cur = await loadActor(admin, phone);
    if (!cur.ok) return err(503, "unavailable");
    if (!cur.actor.customer) return err(404, "not_found");
    // Tài khoản test/demo/reviewer KHÔNG được làm staff (tách tài khoản thử
    // khỏi quyền quản trị). Muốn thì đổi loại về "real" trước — có chủ ý.
    if (nextRole !== "customer" && cur.actor.kind !== "real")
      return err(400, "not_real_account");
    const curRole = cur.actor.source === "db" ? (cur.actor.role ?? "customer") : "customer";
    if (curRole === nextRole && cur.actor.source !== "env")
      return NextResponse.json({ ok: true, phone, role: nextRole });
    // NÂNG lên / HẠ khỏi quản trị viên: CHỈ ADMIN TỔNG (chủ dự án chốt
    // 2026-10-02). Quản trị viên thường chỉ quản lý được vai đại lý/khách.
    // CHƯA khai OWNER_LOGIN thì giữ luật cũ (mọi admin) — không tự khoá cửa
    // trong lúc chuyển đổi.
    const touchesAdmin =
      nextRole === "admin" || curRole === "admin" || cur.actor.source === "env";
    if (touchesAdmin && ownerLogin() && !who.owner) return err(403, "owner_only");

    const dbStaff = await listDbStaff(admin);
    if (!dbStaff.ok) return err(500, "query_failed");
    const reason = checkSetRole({
      actorPhone: who.phone,
      targetPhone: phone,
      curRole,
      nextRole,
      envPhones,
      dbAdminPhones: dbStaff.rows.filter((r) => r.role === "admin").map((r) => r.phone),
      ownerConfigured: Boolean(ownerLogin()),
    });
    if (reason) return err(400, reason);

    const w = await writeStaffRole(admin, { phone, role: nextRole, by: who.phone });
    if (!w.ok) return err(500, w.code);
    // Đổi vai ⇒ thu hồi mọi chuỗi đang sống: chuỗi cấp theo vai CŨ (admin được
    // nhiều máy, không hạn…) không được sống tiếp sau khi hạ vai. Người đó
    // đăng nhập lại là nhận chuỗi đúng vai mới.
    const revoked = await revokeTokensOfPhone(phone, "admin");

    await logActivity(admin, {
      actorPhone: who.phone,
      actorRole: "admin",
      action: "staff.set-role",
      target: phone,
      detail: { from: curRole, to: nextRole, revokedTokens: revoked.revoked },
    });
    return NextResponse.json({ ok: true, phone, role: nextRole });
  }

  // Chỉ áp cho tài khoản đang là QUẢN LÝ (admin đã toàn quyền — gán bảng quyền
  // cho admin vô nghĩa và gây hiểu nhầm là quyền admin bị giới hạn).
  const cur = await loadActor(admin, phone);
  if (!cur.ok) return err(503, "unavailable");
  if (!cur.actor.customer && cur.actor.role === null) return err(404, "not_found");
  if (cur.actor.role === "admin") return err(400, "is_admin");
  if (cur.actor.role !== "manager") return err(400, "not_manager");

  // TẦM NHÌN (thay env MASTER_AGENT_PHONES): own | all_premium
  if (body.action === "set-scope") {
    const scope = normalizeStaffScope(body.scope);
    const w = await writeStaffPermissions(admin, { phone, scope });
    if (!w.ok) return err(500, w.code);
    await logActivity(admin, {
      actorPhone: who.phone,
      actorRole: "admin",
      action: "staff.set-scope",
      target: phone,
      detail: { scope },
    });
    return NextResponse.json({ ok: true, phone, scope });
  }

  const permissions = normalizePermissions(body.permissions);
  const w = await writeStaffPermissions(admin, { phone, permissions });
  // cột/bảng chưa có → nói thật để admin đi apply migration
  if (!w.ok) return err(500, w.code);

  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: "admin",
    action: "staff.set-permissions",
    target: phone,
    detail: { permissions },
  });
  return NextResponse.json({ ok: true, phone, permissions });
}
