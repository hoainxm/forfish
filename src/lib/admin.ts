// Quản trị viên (admin) — logic THUẦN, dùng được ở middleware (edge) lẫn
// route handler. Admin KHÔNG phải một hạng tài khoản trong DB: danh sách SĐT
// nằm ở env ADMIN_PHONES (phẩy ngăn cách) — đổi admin là đổi env + redeploy,
// không cần migration. Admin được:
// · vào /quan-tri (web quản trị — ĐỘC LẬP về giao diện, chung deploy/DB;
//   chốt 2026-07-26 sau một vòng thử tách project riêng rồi quay lại)
// · xem dự báo cá như premium (kiểm tra đúng thứ khách premium thấy)

import {
  isValidVnPhone,
  normalizeVnPhone,
  PHONE_EMAIL_DOMAIN,
  phoneFromAuthEmail,
} from "@/lib/phone";

/** "0901234567, 84912345678" → ["0901234567","0912345678"] (chuẩn hoá, bỏ rác) */
export function parseAdminPhones(env: string | undefined | null): string[] {
  if (!env) return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /\d{9,}/.test(s.replace(/\D/g, "")))
    .map(normalizeVnPhone);
}

/** SĐT (hoặc email ảo {sđt}@sdvico.local) có trong danh sách admin không */
export function isAdminPhone(
  phoneOrEmail: string | null | undefined,
  adminPhones: string[],
): boolean {
  if (!phoneOrEmail || adminPhones.length === 0) return false;
  const phone = phoneOrEmail.includes("@")
    ? phoneFromAuthEmail(phoneOrEmail)
    : normalizeVnPhone(phoneOrEmail);
  if (!phone) return false;
  return adminPhones.includes(phone);
}

// ── ĐẠI LÝ TỔNG (master agent) — env MASTER_AGENT_PHONES ─────────────────────
// Vai giữa "đại lý thường" (chỉ thấy khách MÌNH cấp) và "admin" (thấy hết):
// ĐẠI LÝ TỔNG thấy MỌI khách CÒN PREMIUM hiệu lực, KHÔNG thấy khách thường.
// Danh sách SĐT ở env MASTER_AGENT_PHONES (phẩy ngăn) — giống ADMIN_PHONES,
// đổi là đổi env + redeploy, không cần migration. Vẫn phải là manager trong DB
// (customers.role='manager') để qua cửa staff; env này chỉ MỞ RỘNG tầm nhìn của
// một đại lý sẵn có, KHÔNG tự cấp quyền vào /quan-tri. Dùng chung parser SĐT với
// admin (parseAdminPhones).

/** SĐT có trong danh sách "đại lý tổng" không (dùng chung logic với isAdminPhone). */
export function isMasterAgentPhone(
  phoneOrEmail: string | null | undefined,
  masterPhones: string[],
): boolean {
  return isAdminPhone(phoneOrEmail, masterPhones);
}

// ── HAI NGUỒN ADMIN (2026-07-31, user chốt) ─────────────────────────────────
// Trước: admin CHỈ từ env → thêm/bớt phải sửa Vercel + deploy, và trong web
// không thấy ai là admin. Nay admin = env HOẶC `customers.role='admin'`:
// · db  — quản từ tab Phân quyền, đổi là ăn ngay, không deploy
// · env — CỬA CỨU HỘ: web không hạ được, giữ lại ít nhất 1 số phòng khi DB bị
//         sửa sai/hạ nhầm hết admin (không thì phải vào Supabase chạy SQL tay)

export type AdminSource = "env" | "db";
export type AdminEntry = { phone: string; source: AdminSource };

/** Gộp 2 nguồn, không trùng — env thắng (vì env không hạ được từ web). */
export function mergeAdmins(
  envPhones: string[],
  dbPhones: string[],
): AdminEntry[] {
  const env = envPhones.map(normalizeVnPhone);
  const seen = new Set(env);
  const out: AdminEntry[] = env.map((phone) => ({ phone, source: "env" }));
  for (const raw of dbPhones) {
    const phone = normalizeVnPhone(raw);
    if (seen.has(phone)) continue;
    seen.add(phone);
    out.push({ phone, source: "db" });
  }
  return out;
}

/**
 * Được phép HẠ một quản trị viên xuống không — trả `null` nếu được, hoặc mã
 * lý do từ chối. Chặn 3 kiểu tự bắn vào chân:
 * · self       — tự hạ mình (đang thao tác xong mất quyền giữa chừng)
 * · env_admin  — admin từ env: web không sửa được, phải đổi ADMIN_PHONES
 * · last_admin — hạ xong không còn quản trị viên nào ⇒ khoá cửa cả nhà
 */
export function checkDemoteAdmin(args: {
  actorPhone: string;
  targetPhone: string;
  envPhones: string[];
  dbAdminPhones: string[];
  /** có ADMIN TỔNG (OWNER_LOGIN) ⇒ không bao giờ "hết quản trị viên" */
  ownerConfigured?: boolean;
}): "self" | "env_admin" | "last_admin" | null {
  const actor = normalizeVnPhone(args.actorPhone);
  const target = normalizeVnPhone(args.targetPhone);
  if (actor === target) return "self";
  if (isAdminPhone(target, args.envPhones.map(normalizeVnPhone)))
    return "env_admin";
  const remaining = mergeAdmins(args.envPhones, args.dbAdminPhones).filter(
    (a) => a.phone !== target,
  );
  return remaining.length === 0 && !args.ownerConfigured ? "last_admin" : null;
}

/**
 * Luật đầy đủ cho một lần đổi vai (`PATCH /api/admin/staff` action=set-role).
 * Trả `null` = được phép.
 *
 * NÂNG lên quản trị viên thì LUÔN được, kể cả SĐT đang là admin nhờ env —
 * đó chính là đường DI CƯ env → DB (ghi vai vào DB xong mới xoá bớt env cho
 * an toàn). Chỉ khi HẠ mới phải qua checkDemoteAdmin.
 */
export function checkSetRole(args: {
  actorPhone: string;
  targetPhone: string;
  curRole: string;
  nextRole: "customer" | "manager" | "admin";
  envPhones: string[];
  dbAdminPhones: string[];
  ownerConfigured?: boolean;
}): "self" | "env_admin" | "last_admin" | null {
  if (args.nextRole === "admin") return null;
  // đang là admin (dù nguồn nào) mà hạ xuống → soi kỹ
  const isAdminNow =
    args.curRole === "admin" ||
    isAdminPhone(args.targetPhone, args.envPhones.map(normalizeVnPhone));
  if (!isAdminNow) return null;
  return checkDemoteAdmin({
    actorPhone: args.actorPhone,
    targetPhone: args.targetPhone,
    envPhones: args.envPhones,
    dbAdminPhones: args.dbAdminPhones,
    ownerConfigured: args.ownerConfigured,
  });
}

const ROLE_RANK = { customer: 0, manager: 1, admin: 2 } as const;
export type AccountRole = keyof typeof ROLE_RANK;

/**
 * Vai SAU KHI "tạo tài khoản" (`POST /api/admin/accounts`) trên một SĐT có thể
 * ĐÃ có hàng `customers`. Tạo CHỈ được NÂNG, không bao giờ HẠ: lấy vai cao hơn
 * giữa vai hiện có và vai yêu cầu. Hạ vai phải đi `set-role` (qua 3 chốt
 * checkDemoteAdmin + ghi nhật ký) — án lệ 2026-09-30: form tạo KHÁCH cấp premium
 * cho một SĐT đã có tài khoản và lặng lẽ ghi đè `role` thành 'customer'.
 * Vai lạ trong DB coi như 'customer' (không cho nó thắng).
 */
export function roleAfterCreate(
  existingRole: string | null | undefined,
  requested: AccountRole,
): AccountRole {
  const cur =
    existingRole &&
    Object.prototype.hasOwnProperty.call(ROLE_RANK, existingRole)
      ? (existingRole as AccountRole)
      : "customer";
  return ROLE_RANK[cur] > ROLE_RANK[requested] ? cur : requested;
}

// ── BA TRỤC TÀI KHOẢN (RBAC 2026-10-02, user chốt "làm hết") ─────────────────
// Trước: vai trò, loại tài khoản và hạng dồn vào một hàng `customers`, và
// "ai là admin" được tính lại ở 6 chỗ, mỗi chỗ một luật. Nay tách ba trục ĐỘC
// LẬP, mỗi trục một nguồn:
// · VAI  (admin | manager | không)  — bảng `staff_accounts` (0056); env
//        ADMIN_PHONES chỉ còn là CỬA CỨU HỘ
// · LOẠI (real | test | demo | reviewer) — `customers.account_kind` (0056)
// · HẠNG (basic | premium)            — `customers.tier`, không đổi
// Mọi chỗ cần biết "người này là ai" đi qua `loadActor` (lib/staff-store.ts),
// luật thuần nằm ở đây để test.

export type AccountKind = "real" | "test" | "demo" | "reviewer";
export const ACCOUNT_KINDS: readonly AccountKind[] = [
  "real",
  "test",
  "demo",
  "reviewer",
] as const;

/** Giá trị lạ / cột chưa có → "real" (luật chặt nhất cho TOKEN: không hết hạn
 *  oan của bà con thật; và loại khác real mới bị cấm làm staff). */
export function normalizeAccountKind(v: unknown): AccountKind {
  return typeof v === "string" && (ACCOUNT_KINDS as readonly string[]).includes(v)
    ? (v as AccountKind)
    : "real";
}

/** Tầm nhìn của QUẢN LÝ: `own` = khách mình cấp · `all_premium` = mọi khách
 *  còn premium (thay env MASTER_AGENT_PHONES). Lạ → `own` (hẹp nhất). */
export type StaffScope = "own" | "all_premium";
export function normalizeStaffScope(v: unknown): StaffScope {
  return v === "all_premium" ? "all_premium" : "own";
}

export type StaffRoleResolved = {
  role: "admin" | "manager" | null;
  source: "env" | "db" | null;
};

/**
 * VAI của một SĐT — luật DUY NHẤT (thay 6 bản rải rác).
 * · env ADMIN_PHONES → admin (cứu hộ; thắng mọi thứ, kể cả loại tài khoản)
 * · tài khoản test/demo/reviewer → KHÔNG BAO GIỜ là staff (tách tài khoản thử
 *   khỏi quyền quản trị — một token test lọt ra không mở được /quan-tri)
 * · bảng staff_accounts đã có (`tableReady`) → theo hàng của bảng; hàng đã khoá
 *   (`disabled`) = không vai
 * · bảng chưa có (0056 chưa apply) → đường lùi `customers.role` như cũ
 */
export function resolveStaffRole(args: {
  envAdmin: boolean;
  kind: AccountKind;
  tableReady: boolean;
  staff: { role?: string | null; disabled?: boolean } | null;
  legacyRole: string | null | undefined;
}): StaffRoleResolved {
  if (args.envAdmin) return { role: "admin", source: "env" };
  if (args.kind !== "real") return { role: null, source: null };
  const raw = args.tableReady
    ? args.staff && !args.staff.disabled
      ? args.staff.role
      : null
    : args.legacyRole;
  if (raw === "admin" || raw === "manager") return { role: raw, source: "db" };
  return { role: null, source: null };
}

const HOUR = 60 * 60 * 1000;
export const STAFF_TOKEN_TTL_MS = 7 * 24 * HOUR;
export const TEST_TOKEN_TTL_MS = 24 * HOUR;
export const DEMO_TOKEN_TTL_MS = 7 * 24 * HOUR;
/** Admin tổng: chìa mở mọi cửa — phiên ngắn nhất trong nhóm staff. */
export const OWNER_TOKEN_TTL_MS = 12 * HOUR;

/**
 * Tuổi thọ chuỗi cứng. `null` = KHÔNG hết hạn — bắt buộc cho KHÁCH THẬT: bà
 * con mất sóng nhiều ngày ngoài biển, token hết hạn giữa chuyến là văng khỏi
 * tài khoản đúng lúc cần dự báo (luật 0037 giữ nguyên cho nhóm này).
 * Staff/test/demo thì có hạn: chuỗi quản trị bị lộ không sống mãi.
 */
export function tokenTtlMs(args: {
  isStaff: boolean;
  kind: AccountKind;
  isOwner?: boolean;
}): number | null {
  if (args.isOwner) return OWNER_TOKEN_TTL_MS;
  if (args.kind === "test") return TEST_TOKEN_TTL_MS;
  if (args.isStaff) return STAFF_TOKEN_TTL_MS;
  if (args.kind === "demo" || args.kind === "reviewer") return DEMO_TOKEN_TTL_MS;
  return null;
}

/**
 * QUẢN LÝ được đụng vào khách này không — luật chung cho cấp premium, xoá,
 * gửi thông báo riêng. Admin không đi qua đây. Trả `null` = được.
 * · self          — tự cấp premium/xoá chính mình
 * · staff_target  — đụng tài khoản quản trị/quản lý khác
 * · not_your_customer — khách đã có người khác cấp (`grantedBy` không có mình)
 * `allowUnclaimed`: khách CHƯA ai cấp lần nào — cho phép với CẤP PREMIUM (đó là
 * cách đại lý nhận khách mới), cấm với XOÁ/NHẮN (chưa phải khách của ai).
 * Tầm `all_premium` được đụng mọi khách đang premium (đúng tầm nó nhìn thấy).
 */
export function managerTargetDenial(args: {
  actorPhone: string;
  targetPhone: string;
  targetIsStaff: boolean;
  grantedBy: string[];
  scope: StaffScope;
  targetIsPremium: boolean;
  allowUnclaimed: boolean;
}): "self" | "staff_target" | "not_your_customer" | null {
  const actor = normalizeVnPhone(args.actorPhone);
  if (normalizeVnPhone(args.targetPhone) === actor) return "self";
  if (args.targetIsStaff) return "staff_target";
  const by = args.grantedBy.map(normalizeVnPhone);
  if (by.includes(actor)) return null;
  if (args.scope === "all_premium" && args.targetIsPremium) return null;
  if (by.length === 0 && args.allowUnclaimed) return null;
  return "not_your_customer";
}

// ── ADMIN TỔNG (owner) — chủ dự án chốt 2026-10-02 ──────────────────────────
// MỘT tài khoản đăng nhập bằng TÊN (vd "admin"), không phải SĐT, đứng trên mọi
// quản trị viên: web không hạ/xoá được, CHỈ người này nâng/hạ quản trị viên.
// Thay vai "cứu hộ" của env ADMIN_PHONES (env bỏ sau khi admin tổng đăng nhập
// được — ops/rbac-runbook.md). Tên khai ở env OWNER_LOGIN; không khai = không
// có admin tổng (mọi luật quay về như trước).
// Định danh trong hệ thống = chính tên đó (thay cho SĐT ở device_tokens,
// nhật ký…). Không có hồ sơ khách, không dùng app ngư dân.

/** Khuôn tên đăng nhập admin tổng: chữ thường, 3–32 ký tự, bắt đầu bằng chữ,
 *  KHÔNG được là SĐT (để không bao giờ đè lên danh tính một khách). */
export function normalizeOwnerLogin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(s)) return null;
  if (isValidVnPhone(s)) return null;
  return s;
}

/** Tên admin tổng đang khai ở env (server). null = không có admin tổng. */
export function ownerLogin(): string | null {
  return normalizeOwnerLogin(process.env.OWNER_LOGIN);
}

/** Email Supabase Auth của admin tổng: `<tên>@sdvico.local`. */
export function ownerEmail(login: string): string {
  return `${login}@${PHONE_EMAIL_DOMAIN}`;
}

/**
 * ĐỊNH DANH của một phiên Supabase — SĐT như cũ (phoneFromAuthEmail), CỘNG
 * đúng MỘT ngoại lệ: `<OWNER_LOGIN>@sdvico.local` → tên admin tổng. Tên khác
 * không phải SĐT vẫn bị từ chối như lớp vá P0 (không mở cửa cho tên bất kỳ).
 */
export function authIdentity(
  email: string | null | undefined,
  owner: string | null,
): string | null {
  if (email && owner) {
    const at = email.lastIndexOf("@");
    if (
      at > 0 &&
      email.slice(at + 1).toLowerCase() === PHONE_EMAIL_DOMAIN &&
      email.slice(0, at).toLowerCase() === owner
    )
      return owner;
  }
  return phoneFromAuthEmail(email);
}

/** Định danh này có phải admin tổng không (so đúng tên, không chuẩn hoá SĐT). */
export function isOwnerIdentity(id: string | null | undefined, owner: string | null): boolean {
  return Boolean(id && owner && id.toLowerCase() === owner);
}
