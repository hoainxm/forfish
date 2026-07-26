// Quản trị viên (admin) — logic THUẦN, dùng được ở middleware (edge) lẫn
// route handler. Admin KHÔNG phải một hạng tài khoản trong DB: danh sách SĐT
// nằm ở env ADMIN_PHONES (phẩy ngăn cách, vd "0901234567,0912345678") — đổi
// admin là đổi env + redeploy, không cần migration. Admin được:
// · vào /quan-tri (dashboard theo dõi hệ thống)
// · xem dự báo cá như premium (để kiểm tra đúng thứ khách premium thấy)

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
