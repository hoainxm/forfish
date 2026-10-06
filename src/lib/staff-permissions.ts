// Phân quyền STAFF (logic THUẦN — client-safe, KHÔNG import server-only). Dùng
// chung: UI /quan-tri (ẩn/hiện tab + nút), route /api/admin/* (chốt thật qua
// requirePermission), và tab Phân quyền (soạn bảng quyền cho từng quản lý).
//
// HAI VAI (src/lib/admin-auth.ts + lib/staff-store.ts, RBAC 2026-10-02):
// · admin  — env ADMIN_PHONES (cứu hộ) HOẶC staff_accounts role='admin' (0056):
//   TOÀN QUYỀN, bỏ qua bảng quyền (permissions = null).
// · manager — staff_accounts role='manager' + permissions (0056; trước khi
//   apply: customers.role + customers.staff_permissions — 0007/0028): quyền
//   theo TAB × HÀNH ĐỘNG, admin cấu hình trong /quan-tri.
//
// 6 TAB được phép cho quản lý (chốt user 2026-07-30; thêm don-hang 2026-08-11).
// 4 tab còn lại (yeu-cau · vung-bien · du-lieu · he-thong) ADMIN-ONLY CỨNG —
// không nằm ở đây.

export type PermAction = "view" | "create" | "edit" | "delete";
export const PERM_ACTIONS: readonly PermAction[] = [
  "view",
  "create",
  "edit",
  "delete",
] as const;

export type ManagerTab =
  | "tai-khoan"
  | "san-pham"
  | "don-hang"
  | "canh-bao"
  | "thong-bao"
  | "cho-ban";
export const MANAGER_TABS: readonly ManagerTab[] = [
  "tai-khoan",
  "san-pham",
  "don-hang",
  "canh-bao",
  "thong-bao",
  "cho-ban",
] as const;

/** Nhãn tab — GIỮ ĐỒNG BỘ với nhãn tab trong /quan-tri (03-design-system). */
export const TAB_LABEL: Record<ManagerTab, string> = {
  "tai-khoan": "Tài khoản",
  "san-pham": "Sản phẩm",
  "don-hang": "Đơn hàng",
  "canh-bao": "Thuyền viên",
  "thong-bao": "Thông báo",
  "cho-ban": "Chỗ bán",
};

export const ACTION_LABEL: Record<PermAction, string> = {
  view: "Xem",
  create: "Tạo mới",
  edit: "Sửa",
  delete: "Xóa",
};

export type TabPerms = Record<PermAction, boolean>;
/**
 * Bảng quyền = 6 tab × 4 cờ + CỜ RIÊNG `resetPassword` (2026-10-06, user chốt:
 * "phân quyền nút đặt lại mật khẩu cho phép những tài khoản nào có quyền này").
 * Đặt lại mật khẩu không phải Xem/Tạo/Sửa/Xoá của một tab — nó là chìa vào
 * tài khoản khách (mật khẩu về sd123456 ai cũng biết) ⇒ cờ RIÊNG, admin tick
 * từng quản lý, MẶC ĐỊNH TẮT kể cả preset. Có cờ cũng CHỈ trên khách của mình
 * (managerTargetCheck — cấm nhân sự, cấm chính mình). Nằm chung cột jsonb
 * `staff_accounts.permissions` (0056) ⇒ KHÔNG cần migration.
 */
export type StaffPermissions = Record<ManagerTab, TabPerms> & {
  resetPassword: boolean;
};

/** Nhãn cờ riêng — hiện ở tab Phân quyền. */
export const RESET_PASSWORD_LABEL = "Đặt lại mật khẩu khách của mình";

const ALL_FALSE: TabPerms = {
  view: false,
  create: false,
  edit: false,
  delete: false,
};
const ALL_TRUE: TabPerms = { view: true, create: true, edit: true, delete: true };
const VIEW_CREATE_EDIT: TabPerms = {
  view: true,
  create: true,
  edit: true,
  delete: false,
};

/** Bảng quyền của quản lý MỚI (chưa được admin chỉnh tay): xem+tạo+sửa cả 6
 *  tab, KHÔNG xóa (chốt user 2026-07-30 — an toàn nhất, admin bật Xóa khi cần).
 *  KHÔNG đặt lại mật khẩu (2026-10-06) — admin tick riêng từng người. */
export const DEFAULT_MANAGER_PERMISSIONS: StaffPermissions = Object.freeze({
  "tai-khoan": { ...VIEW_CREATE_EDIT },
  "san-pham": { ...VIEW_CREATE_EDIT },
  "don-hang": { ...VIEW_CREATE_EDIT },
  "canh-bao": { ...VIEW_CREATE_EDIT },
  "thong-bao": { ...VIEW_CREATE_EDIT },
  "cho-ban": { ...VIEW_CREATE_EDIT },
  resetPassword: false,
});

export function isManagerTab(tab: string): tab is ManagerTab {
  return (MANAGER_TABS as readonly string[]).includes(tab);
}

function coerceTab(raw: unknown): TabPerms {
  if (!raw || typeof raw !== "object") return { ...ALL_FALSE };
  const r = raw as Record<string, unknown>;
  return {
    view: r.view === true,
    create: r.create === true,
    edit: r.edit === true,
    delete: r.delete === true,
  };
}

/** Bảng quyền mới toanh, tất cả cờ = giá trị cho trước (dùng khi soạn UI). */
export function emptyPermissions(value = false): StaffPermissions {
  const fill = value ? ALL_TRUE : ALL_FALSE;
  const out = { resetPassword: value } as StaffPermissions;
  for (const tab of MANAGER_TABS) out[tab] = { ...fill };
  return out;
}

/** Bản sao sâu (an toàn để mutate trong UI/route). */
export function clonePermissions(p: StaffPermissions): StaffPermissions {
  const out = { resetPassword: p.resetPassword === true } as StaffPermissions;
  for (const tab of MANAGER_TABS) out[tab] = { ...p[tab] };
  return out;
}

/**
 * JSON thô từ DB (customers.staff_permissions) → shape AN TOÀN, đủ 6 tab × 4 cờ.
 * · null/undefined  → preset mặc định (quản lý mới chưa cấu hình — giữ để tài
 *                     khoản cũ và ca "0017 chưa apply" vẫn làm việc được)
 * · object thiếu tab/cờ → tab/cờ đó = false (FAIL-CLOSED: khóa nhầm hơn mở nhầm)
 * · **RÁC** (JSON hỏng, số, chuỗi, mảng) → **KHOÁ HẾT**, không phải preset
 * Luôn trả object MỚI (không giữ tham chiếu tới hằng đông cứng).
 *
 * ⚠️ ĐỔI 2026-08-18 (thẩm định P1 — fail-open còn sót). Bản trước quy MỌI thứ
 * không đọc được về `DEFAULT_MANAGER_PERMISSIONS`, mà preset đó cấp
 * **xem + tạo + sửa trên cả 6 tab**. Nghĩa là một ô `staff_permissions` bị ghi
 * hỏng — migration lỡ tay, ghi dở lúc mất kết nối, ai đó nhét chuỗi vào cột
 * jsonb — sẽ **NỚI quyền** cho đúng người mà máy chủ vừa không đọc nổi bảng
 * quyền của họ. `null` khác hẳn: đó là câu trả lời HỢP LỆ ("chưa cấu hình"),
 * còn rác là "không biết" — và không biết thì phải khoá.
 * Vòng vá trước mới siết nhánh LỖI TRUY VẤN ở `admin-auth.ts`; đây là nhánh
 * DỮ LIỆU HỎNG, cùng một khuôn nhưng khác cửa.
 */
export function normalizePermissions(raw: unknown): StaffPermissions {
  if (raw == null) return clonePermissions(DEFAULT_MANAGER_PERMISSIONS);
  let obj: unknown = raw;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return emptyPermissions(false); // chuỗi không phải JSON = rác ⇒ khoá hết
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return emptyPermissions(false); // số / mảng / "null" / true ⇒ khoá hết
  }
  const r = obj as Record<string, unknown>;
  // cờ riêng: CHỈ `true` mới là bật — thiếu/rác ⇒ tắt (fail-closed)
  const out = { resetPassword: r.resetPassword === true } as StaffPermissions;
  for (const tab of MANAGER_TABS) out[tab] = coerceTab(r[tab]);
  return out;
}

/**
 * CỘT CHƯA CÓ (migration chưa apply) hay TRUY VẤN HỎNG — hai chuyện khác hẳn
 * nhau mà `try/catch` gộp làm một (2026-08-16, thẩm định P1).
 *
 * `normalizePermissions(null)` trả PRESET có `view+create+edit` trên cả 6 tab.
 * Đó là câu trả lời ĐÚNG cho ca "0017 chưa apply" — quản lý phải làm việc được
 * trước khi cột tồn tại. Nhưng nó là câu trả lời SAI cho ca "Postgres nghẹt /
 * schema cache lỗi": lúc đó máy chủ không biết người này được phép gì, mà lại
 * cấp cho họ bộ quyền rộng. Cấp quyền vì hạ tầng hỏng là fail-open.
 *
 * Chỉ hai mã dưới đây mới là "cột chưa có":
 *  · `42703` — undefined_column (Postgres)
 *  · `PGRST204` — PostgREST không thấy cột trong schema cache
 * Mọi mã khác ⇒ chưa biết ⇒ chỗ gọi phải trả 503, đừng đoán.
 */
export function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "42703" || code === "PGRST204";
}

/** BẢNG chưa có (migration chưa apply) — cùng tinh thần `isMissingColumnError`:
 *  CHỈ `42P01` (Postgres) / `PGRST205` (PostgREST không thấy bảng). Mã khác
 *  ⇒ "chưa biết" ⇒ caller trả 503, không đoán. */
export function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "42P01" || code === "PGRST205";
}

/**
 * Quản lý có được làm `action` trên `tab` không. `perms=null` (chưa có bảng)
 * → false (fail-closed). ADMIN không đi qua đây — admin bỏ qua bảng quyền.
 */
export function can(
  perms: StaffPermissions | null | undefined,
  tab: ManagerTab,
  action: PermAction,
): boolean {
  if (!perms) return false;
  return perms[tab]?.[action] === true;
}

/**
 * Được bấm "Đặt lại mật khẩu" không. admin → luôn được (không đi qua bảng
 * quyền); quản lý → CHỈ khi admin đã tick cờ riêng. perms null ⇒ false.
 * Đây mới là cửa VAI; cửa ĐỐI TƯỢNG (khách của mình, không phải nhân sự,
 * không phải chính mình) chốt ở route bằng managerTargetCheck.
 */
export function canResetPassword(
  role: "admin" | "manager",
  perms: StaffPermissions | null | undefined,
): boolean {
  if (role === "admin") return true;
  return perms?.resetPassword === true;
}

/** Quản lý thấy được tab nào (có cờ view). Giữ thứ tự MANAGER_TABS. */
export function visibleTabs(perms: StaffPermissions | null): ManagerTab[] {
  if (!perms) return [];
  return MANAGER_TABS.filter((t) => perms[t]?.view === true);
}
