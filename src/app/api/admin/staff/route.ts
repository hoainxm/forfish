// /api/admin/staff — PHÂN QUYỀN TÀI KHOẢN QUẢN LÝ (2026-07-30). ADMIN-ONLY.
// · GET   : liệt kê mọi tài khoản role='manager' + bảng quyền đã chuẩn hoá
//           (5 tab × view/create/edit/delete). Preset mặc định cho ai chưa
//           cấu hình (normalizePermissions).
// · PATCH : { phone, permissions } — ghi bảng quyền cho một quản lý. Chuẩn hoá
//           trước khi ghi (chỉ nhận 5 tab hợp lệ, ép cờ về boolean, fail-closed).
// Chỉ service-role ghi cột customers.staff_permissions (0017). Chốt thật khi
// quản lý thao tác nằm ở requirePermission trong từng route /api/admin/*.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import {
  checkDemoteAdmin,
  isAdminPhone,
  mergeAdmins,
  parseAdminPhones,
} from "@/lib/admin";
import { normalizeVnPhone } from "@/lib/phone";
import { normalizePermissions } from "@/lib/staff-permissions";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET() {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  // Cột staff_permissions có thể chưa tồn tại (0017 chưa apply) → thử select
  // kèm; lỗi thì rơi về select không có cột (quản lý vẫn hiện, quyền = mặc định)
  // và báo migrationNeeded để UI nói thật.
  let rows: { phone: string; name: string | null; staff_permissions?: unknown }[] =
    [];
  let migrationNeeded = false;
  {
    const withCol = await admin
      .from("customers")
      .select("phone, name, staff_permissions")
      .eq("role", "manager")
      .order("updated_at", { ascending: false });
    if (withCol.error) {
      migrationNeeded = true;
      const noCol = await admin
        .from("customers")
        .select("phone, name")
        .eq("role", "manager")
        .order("updated_at", { ascending: false });
      if (noCol.error) return err(500, "query_failed");
      rows = (noCol.data ?? []) as typeof rows;
    } else {
      rows = (withCol.data ?? []) as typeof rows;
    }
  }

  const managers = rows.map((r) => ({
    phone: r.phone,
    name: r.name ?? null,
    permissions: normalizePermissions(r.staff_permissions),
    // đã cấu hình tay chưa (null = còn ở preset mặc định)
    configured: r.staff_permissions != null,
  }));

  // QUẢN TRỊ VIÊN — HAI NGUỒN (2026-07-31): env ADMIN_PHONES (cửa cứu hộ, web
  // không hạ được) + customers.role='admin' (quản ngay trên web). Trả kèm
  // `source` để UI nói rõ cái nào sửa được ở đây.
  const envPhones = parseAdminPhones(process.env.ADMIN_PHONES);
  const { data: dbAdminRows } = await admin
    .from("customers")
    .select("phone, name")
    .eq("role", "admin");
  const dbAdminPhones = (dbAdminRows ?? []).map(
    (r) => (r as { phone: string }).phone,
  );
  const merged = mergeAdmins(envPhones, dbAdminPhones);

  // tên hiển thị: gom từ hàng customers (admin env có thể chưa có hàng nào)
  let adminNames: Record<string, string | null> = Object.fromEntries(
    (dbAdminRows ?? []).map((r) => [
      (r as { phone: string }).phone,
      (r as { name: string | null }).name ?? null,
    ]),
  );
  const missing = merged
    .map((a) => a.phone)
    .filter((p) => !(p in adminNames));
  if (missing.length > 0) {
    const { data: nRows } = await admin
      .from("customers")
      .select("phone, name")
      .in("phone", missing);
    adminNames = {
      ...adminNames,
      ...Object.fromEntries(
        (nRows ?? []).map((r) => [
          (r as { phone: string }).phone,
          (r as { name: string | null }).name ?? null,
        ]),
      ),
    };
  }
  const admins = merged.map((a) => ({
    phone: a.phone,
    name: adminNames[a.phone] ?? null,
    source: a.source,
  }));

  return NextResponse.json({ ok: true, managers, admins, migrationNeeded });
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
  } | null;
  if (!body?.phone) return err(400, "bad_phone");
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
    // SĐT trong env: đổi cột role KHÔNG có tác dụng (env vẫn thắng) → chặn hẳn
    // cho khỏi tưởng đã hạ xong.
    if (isAdminPhone(phone, envPhones)) return err(400, "env_admin");

    const { data: cur, error: qErr } = await admin
      .from("customers")
      .select("role")
      .eq("phone", phone)
      .maybeSingle();
    if (qErr) return err(500, "query_failed");
    if (!cur) return err(404, "not_found");
    const curRole = (cur as { role?: string }).role ?? "customer";
    if (curRole === nextRole)
      return NextResponse.json({ ok: true, phone, role: nextRole });

    if (curRole === "admin") {
      const { data: dbAdmins } = await admin
        .from("customers")
        .select("phone")
        .eq("role", "admin");
      const reason = checkDemoteAdmin({
        actorPhone: who.phone,
        targetPhone: phone,
        envPhones,
        dbAdminPhones: (dbAdmins ?? []).map(
          (r) => (r as { phone: string }).phone,
        ),
      });
      if (reason) return err(400, reason);
    }

    const { error: upErr } = await admin
      .from("customers")
      .update({ role: nextRole, updated_at: new Date().toISOString() })
      .eq("phone", phone);
    if (upErr) return err(500, "update_failed");

    await logActivity(admin, {
      actorPhone: who.phone,
      actorRole: "admin",
      action: "staff.set-role",
      target: phone,
      detail: { from: curRole, to: nextRole },
    });
    return NextResponse.json({ ok: true, phone, role: nextRole });
  }

  // KHÔNG cho gán quyền cho SĐT admin (admin đã toàn quyền, cột này vô nghĩa
  // và gây hiểu nhầm là quyền của admin bị giới hạn).
  if (isAdminPhone(phone, parseAdminPhones(process.env.ADMIN_PHONES)))
    return err(400, "is_admin");

  // Chỉ áp cho tài khoản đang là quản lý.
  const { data: cur, error: qErr } = await admin
    .from("customers")
    .select("role")
    .eq("phone", phone)
    .maybeSingle();
  if (qErr) return err(500, "query_failed");
  if (!cur) return err(404, "not_found");
  if ((cur as { role?: string }).role !== "manager")
    return err(400, "not_manager");

  const permissions = normalizePermissions(body.permissions);
  const { error } = await admin
    .from("customers")
    .update({ staff_permissions: permissions, updated_at: new Date().toISOString() })
    .eq("phone", phone);
  // cột chưa có (0017 chưa apply) → nói thật để admin đi apply migration
  if (error) return err(500, "migration_needed");

  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: "admin",
    action: "staff.set-permissions",
    target: phone,
    detail: { permissions },
  });
  return NextResponse.json({ ok: true, phone, permissions });
}
