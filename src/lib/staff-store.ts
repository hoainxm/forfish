import "server-only";

// AI ĐANG THAO TÁC — chỗ DUY NHẤT đọc/ghi VAI + LOẠI tài khoản (RBAC 2026-10-02).
//
// Trước bản này "admin là ai" được tính ở 6 chỗ (admin-auth, middleware,
// api-identity, auth/token, accounts, staff), mỗi chỗ một luật: middleware chỉ
// tin env, token tin env+DB, UI không tin gì. Nay mọi chỗ gọi `loadActor`, luật
// thuần ở `lib/admin.ts` (resolveStaffRole — có test).
//
// CHẠY ĐƯỢC TRƯỚC LẪN SAU migration 0056 (chủ dự án tự apply — CLAUDE.md 🔴):
// · bảng `staff_accounts` chưa có → đọc vai từ `customers.role` như cũ
// · cột `customers.account_kind` chưa có → coi mọi người là "real"
// Đọc hàng khách bằng select("*") để cột chưa có không làm câu truy vấn hỏng.
// Ghi vai luôn ghi CẢ HAI chỗ (bảng mới + cột cũ) để bản deploy cũ/đường lùi
// không lệch nhau trong lúc chuyển.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAdminPhone,
  isMasterAgentPhone,
  isOwnerIdentity,
  ownerLogin,
  managerTargetDenial,
  normalizeAccountKind,
  normalizeStaffScope,
  parseAdminPhones,
  resolveStaffRole,
  type AccountKind,
  type StaffScope,
} from "@/lib/admin";
import {
  isMissingTableError,
  normalizePermissions,
  type StaffPermissions,
} from "@/lib/staff-permissions";
import { resolveTier } from "@/lib/tier";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type Actor = {
  phone: string;
  /** ADMIN TỔNG (OWNER_LOGIN) — luôn kèm role "admin" */
  owner: boolean;
  role: "admin" | "manager" | null;
  source: "env" | "db" | null;
  /** chỉ có với manager; admin = null (toàn quyền) */
  permissions: StaffPermissions | null;
  scope: StaffScope;
  kind: AccountKind;
  /** hàng khách (select *) — để caller khỏi tra lại tier/premium_until */
  customer: Record<string, unknown> | null;
};

export type ActorResult =
  | { ok: true; actor: Actor }
  | { ok: false; unavailable: true };

const envAdmins = () => parseAdminPhones(process.env.ADMIN_PHONES);
const envMasters = () => parseAdminPhones(process.env.MASTER_AGENT_PHONES);

/** Hàng staff_accounts của một SĐT. `tableReady=false` = 0056 chưa apply. */
async function readStaffRow(
  admin: Admin,
  phone: string,
): Promise<
  | { ok: true; tableReady: boolean; row: Record<string, unknown> | null }
  | { ok: false }
> {
  const { data, error } = await admin
    .from("staff_accounts")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return { ok: true, tableReady: false, row: null };
    console.error("[staff-store] tra staff_accounts HỎNG:", error.code, error.message);
    return { ok: false };
  }
  return { ok: true, tableReady: true, row: (data as Record<string, unknown>) ?? null };
}

/**
 * Vai + loại + bảng quyền của MỘT SĐT đã xác thực. DB không tra được →
 * `unavailable` (caller trả 503 — KHÔNG đoán "không phải staff", cũng KHÔNG
 * đoán "là staff").
 */
export async function loadActor(admin: Admin, phone: string): Promise<ActorResult> {
  // ADMIN TỔNG: định danh là TÊN, không có hồ sơ khách, không có hàng staff —
  // vai suy thẳng từ env OWNER_LOGIN, không chạm DB (đây là cửa cứu hộ mới).
  if (isOwnerIdentity(phone, ownerLogin())) {
    return {
      ok: true,
      actor: {
        phone,
        owner: true,
        role: "admin",
        source: "env",
        permissions: null,
        scope: "all_premium",
        kind: "real",
        customer: null,
      },
    };
  }
  const envAdmin = isAdminPhone(phone, envAdmins());

  const cust = await admin.from("customers").select("*").eq("phone", phone).maybeSingle();
  if (cust.error) {
    // env admin vẫn là cửa cứu hộ khi DB trục trặc — nhưng chỉ cho VAI, không
    // bịa ra loại/hạng
    if (envAdmin) {
      return {
        ok: true,
        actor: {
          phone,
          owner: false,
          role: "admin",
          source: "env",
          permissions: null,
          scope: "all_premium",
          kind: "real",
          customer: null,
        },
      };
    }
    console.error("[staff-store] tra customers HỎNG:", cust.error.code, cust.error.message);
    return { ok: false, unavailable: true };
  }
  const customer = (cust.data as Record<string, unknown>) ?? null;
  const kind = normalizeAccountKind(customer?.account_kind);

  const staff = envAdmin ? { ok: true as const, tableReady: true, row: null } : await readStaffRow(admin, phone);
  if (!staff.ok) return { ok: false, unavailable: true };

  // ADMIN TỔNG trong DB (0057): hàng staff_accounts role='owner', còn hiệu lực
  const ownerRow =
    staff.tableReady && staff.row?.role === "owner" && !staff.row.disabled_at;

  const { role, source } = resolveStaffRole({
    envAdmin,
    kind,
    tableReady: staff.tableReady,
    staff: staff.row
      ? { role: staff.row.role as string, disabled: Boolean(staff.row.disabled_at) }
      : null,
    legacyRole: customer?.role as string | undefined,
  });

  let permissions: StaffPermissions | null = null;
  if (role === "manager") {
    permissions = normalizePermissions(
      staff.tableReady ? staff.row?.permissions : customer?.staff_permissions,
    );
  }
  // Tầm nhìn: bảng mới thắng; env MASTER_AGENT_PHONES giữ làm đường lùi cho tới
  // khi chủ dự án chuyển hết vào bảng (xem ops/rbac-runbook.md).
  const scope: StaffScope =
    role === "admin"
      ? "all_premium"
      : staff.tableReady && normalizeStaffScope(staff.row?.scope) === "all_premium"
        ? "all_premium"
        : isMasterAgentPhone(phone, envMasters())
          ? "all_premium"
          : "own";

  return {
    ok: true,
    actor: { phone, owner: ownerRow, role, source, permissions, scope, kind, customer },
  };
}

/**
 * HẠNG HIỆU LỰC cho cổng dữ liệu premium: hạng thật của khách, CỘNG quản trị
 * viên (mọi nguồn — trước đây chỉ admin env được, admin DB bị chặn oan) để
 * kiểm tra được đúng thứ khách premium thấy. Quản lý KHÔNG được miễn: họ dùng
 * hạng của chính tài khoản mình.
 */
export async function effectiveTier(
  admin: Admin,
  phone: string,
): Promise<"premium" | "basic" | "unavailable"> {
  // Đường nóng: đa số lượt gọi là khách premium thật — một câu là xong, khỏi
  // tra bảng staff.
  const { data, error } = await admin
    .from("customers")
    .select("tier, premium_until")
    .eq("phone", phone)
    .maybeSingle();
  if (!error && resolveTier(data?.tier, data?.premium_until, Date.now()) === "premium")
    return "premium";
  const r = await loadActor(admin, phone);
  if (!r.ok) return "unavailable";
  return r.actor.role === "admin" ? "premium" : error ? "unavailable" : "basic";
}

export type StaffListRow = {
  phone: string;
  role: "admin" | "manager";
  permissions: unknown;
  scope: StaffScope;
};

/** Mọi staff trong DB (KHÔNG gồm env). `tableReady=false` → đọc từ customers. */
export async function listDbStaff(
  admin: Admin,
): Promise<{ ok: true; tableReady: boolean; rows: StaffListRow[] } | { ok: false }> {
  const t = await admin
    .from("staff_accounts")
    .select("*")
    .is("disabled_at", null);
  if (!t.error) {
    return {
      ok: true,
      tableReady: true,
      rows: ((t.data ?? []) as Record<string, unknown>[])
        .filter((r) => r.role === "admin" || r.role === "manager")
        .map((r) => ({
          phone: r.phone as string,
          role: r.role as "admin" | "manager",
          permissions: r.permissions ?? null,
          scope: normalizeStaffScope(r.scope),
        })),
    };
  }
  if (!isMissingTableError(t.error)) return { ok: false };
  const c = await admin.from("customers").select("*").in("role", ["admin", "manager"]);
  if (c.error) return { ok: false };
  return {
    ok: true,
    tableReady: false,
    rows: ((c.data ?? []) as Record<string, unknown>[]).map((r) => ({
      phone: r.phone as string,
      role: r.role as "admin" | "manager",
      permissions: r.staff_permissions ?? null,
      scope: isMasterAgentPhone(r.phone as string, envMasters()) ? "all_premium" : "own",
    })),
  };
}

/**
 * GHI VAI. `customer` = gỡ khỏi staff. Ghi bảng mới (nếu có) + gương sang
 * `customers.role`. Trả lỗi đầu tiên gặp — caller báo 500, KHÔNG nuốt (ghi vai
 * nửa vời là lệch quyền).
 */
export async function writeStaffRole(
  admin: Admin,
  args: { phone: string; role: "admin" | "manager" | "customer"; by: string },
): Promise<{ ok: true } | { ok: false; code: string }> {
  const now = new Date().toISOString();
  if (args.role === "customer") {
    const d = await admin.from("staff_accounts").delete().eq("phone", args.phone);
    if (d.error && !isMissingTableError(d.error)) return { ok: false, code: "update_failed" };
  } else {
    const u = await admin.from("staff_accounts").upsert(
      { phone: args.phone, role: args.role, updated_at: now, created_by: args.by, disabled_at: null },
      { onConflict: "phone" },
    );
    if (u.error && !isMissingTableError(u.error)) return { ok: false, code: "update_failed" };
  }
  const m = await admin
    .from("customers")
    .update({ role: args.role, updated_at: now })
    .eq("phone", args.phone);
  if (m.error) return { ok: false, code: "update_failed" };
  return { ok: true };
}

/** GHI BẢNG QUYỀN + TẦM của một quản lý (bảng mới + gương cột cũ). */
export async function writeStaffPermissions(
  admin: Admin,
  args: { phone: string; permissions?: StaffPermissions; scope?: StaffScope },
): Promise<{ ok: true } | { ok: false; code: string }> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (args.permissions) patch.permissions = args.permissions;
  if (args.scope) patch.scope = args.scope;
  const u = await admin.from("staff_accounts").update(patch).eq("phone", args.phone);
  const tableReady = !(u.error && isMissingTableError(u.error));
  if (u.error && tableReady) return { ok: false, code: "update_failed" };
  if (!tableReady && args.scope) return { ok: false, code: "migration_needed" };
  if (args.permissions) {
    const m = await admin
      .from("customers")
      .update({ staff_permissions: args.permissions, updated_at: now })
      .eq("phone", args.phone);
    // bảng mới đã ghi được thì cột cũ hỏng không chặn; chưa có bảng thì cột cũ
    // là nơi duy nhất ⇒ phải báo
    if (m.error && !tableReady) return { ok: false, code: "migration_needed" };
  }
  return { ok: true };
}

/** SĐT này có đang là staff (DB hoặc env) không — để chặn quản lý đụng vào. */
export async function isStaffPhone(admin: Admin, phone: string): Promise<boolean | null> {
  const r = await loadActor(admin, phone);
  if (!r.ok) return null;
  return r.actor.role !== null;
}

/** Ai đã từng cấp premium cho khách này (premium_grants.granted_by). */
export async function grantersOf(admin: Admin, phone: string): Promise<string[] | null> {
  const { data, error } = await admin
    .from("premium_grants")
    .select("granted_by")
    .eq("customer_phone", phone)
    .in("action", ["activate", "renew"]);
  if (error) return isMissingTableError(error) ? [] : null;
  return [...new Set(((data ?? []) as { granted_by: string }[]).map((r) => r.granted_by))];
}

/**
 * QUẢN LÝ được đụng vào khách này không — cấp premium, xoá, ghi cờ, nhắn riêng
 * (luật thuần `managerTargetDenial`). Admin luôn được. Trả `null` = cho qua,
 * hoặc {status, code} để route trả lỗi. Tra không được → 503 (không đoán).
 */
export async function managerTargetCheck(
  admin: Admin,
  who: { phone: string; role: "admin" | "manager"; scope: StaffScope },
  phone: string,
  allowUnclaimed: boolean,
): Promise<{ status: number; code: string } | null> {
  if (who.role === "admin") return null;
  const target = await loadActor(admin, phone);
  if (!target.ok) return { status: 503, code: "unavailable" };
  const grantedBy = await grantersOf(admin, phone);
  if (grantedBy === null) return { status: 503, code: "unavailable" };
  const c = target.actor.customer;
  const denial = managerTargetDenial({
    actorPhone: who.phone,
    targetPhone: phone,
    targetIsStaff: target.actor.role !== null,
    grantedBy,
    scope: who.scope,
    targetIsPremium:
      resolveTier(c?.tier as string, c?.premium_until as string | null, Date.now()) ===
      "premium",
    allowUnclaimed,
  });
  return denial ? { status: 403, code: denial } : null;
}

/** SĐT các tài khoản KHÔNG phải khách thật (test/demo/reviewer) — để loại
 *  khỏi thông báo hàng loạt / thống kê. Cột chưa có (0056) → rỗng. */
export async function nonRealPhones(admin: Admin): Promise<Set<string>> {
  const { data, error } = await admin
    .from("customers")
    .select("phone")
    .neq("account_kind", "real");
  if (error) return new Set();
  return new Set(((data ?? []) as { phone: string }[]).map((r) => r.phone));
}

/**
 * ADMIN TỔNG hiện tại: env OWNER_LOGIN (nếu khai — tương thích) HOẶC hàng
 * staff_accounts role='owner' (0057). `owner:null` = chưa có admin tổng ⇒ các
 * route giữ luật cũ (mọi admin quản lý admin). Tra hỏng → ok:false (caller 503).
 */
export async function findOwner(
  admin: Admin,
): Promise<{ ok: true; owner: string | null } | { ok: false }> {
  const env = ownerLogin();
  if (env) return { ok: true, owner: env };
  const { data, error } = await admin
    .from("staff_accounts")
    .select("phone")
    .eq("role", "owner")
    .is("disabled_at", null)
    .limit(1);
  if (error) return isMissingTableError(error) ? { ok: true, owner: null } : { ok: false };
  const row = (data ?? [])[0] as { phone?: string } | undefined;
  return { ok: true, owner: row?.phone ?? null };
}
