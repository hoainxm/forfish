// Quản trị viên (admin) — logic THUẦN cho middleware (edge). Admin KHÔNG phải
// một hạng tài khoản trong DB: danh sách SĐT nằm ở env ADMIN_PHONES (phẩy
// ngăn cách) — đổi admin là đổi env + redeploy, không cần migration.
// Trong APP NGƯ DÂN admin chỉ có MỘT đặc quyền: xem dự báo cá như premium
// (kiểm tra đúng thứ khách premium thấy). Dashboard quản trị là WEB RIÊNG
// (thư mục admin/, deploy Vercel project riêng — tách 2026-07-26, không còn
// route quản trị nào trong app này).

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
