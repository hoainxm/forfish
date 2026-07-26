// CHÉP từ app chính: ForFish/src/lib/admin.ts (2026-07-26) — sửa thì sửa CẢ HAI.
// Admin = SĐT nằm trong env ADMIN_PHONES (phẩy ngăn cách) — không phải hạng DB.

import { normalizeVnPhone } from "./phone";

export function parseAdminPhones(env: string | undefined | null): string[] {
  if (!env) return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /\d{9,}/.test(s.replace(/\D/g, "")))
    .map(normalizeVnPhone);
}

export function isAdminPhone(
  phoneOrEmail: string | null | undefined,
  adminPhones: string[],
): boolean {
  if (!phoneOrEmail || adminPhones.length === 0) return false;
  const phone = normalizeVnPhone(phoneOrEmail.split("@")[0]);
  return adminPhones.includes(phone);
}
