// Quản trị viên (admin) — logic THUẦN, dùng được ở middleware (edge) lẫn
// route handler. Admin KHÔNG phải một hạng tài khoản trong DB: danh sách SĐT
// nằm ở env ADMIN_PHONES (phẩy ngăn cách) — đổi admin là đổi env + redeploy,
// không cần migration. Admin được:
// · vào /quan-tri (web quản trị — ĐỘC LẬP về giao diện, chung deploy/DB;
//   chốt 2026-07-26 sau một vòng thử tách project riêng rồi quay lại)
// · xem dự báo cá như premium (kiểm tra đúng thứ khách premium thấy)

import { normalizeVnPhone } from "@/lib/phone";

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
  const phone = normalizeVnPhone(phoneOrEmail.split("@")[0]);
  return adminPhones.includes(phone);
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
}): "self" | "env_admin" | "last_admin" | null {
  const actor = normalizeVnPhone(args.actorPhone);
  const target = normalizeVnPhone(args.targetPhone);
  if (actor === target) return "self";
  if (isAdminPhone(target, args.envPhones.map(normalizeVnPhone)))
    return "env_admin";
  const remaining = mergeAdmins(args.envPhones, args.dbAdminPhones).filter(
    (a) => a.phone !== target,
  );
  return remaining.length === 0 ? "last_admin" : null;
}
