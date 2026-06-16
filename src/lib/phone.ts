// Helper SĐT VN — THUẦN (dùng cả client lẫn server: route OTP/webhook). Tách
// khỏi auth-form.tsx ("use client") để server import không kéo client bundle.

/** Đuôi email ảo Supabase Auth — 1 SĐT = 1 email duy nhất (cùng pattern CRM). */
export const PHONE_EMAIL_DOMAIN = "sdvico.local";

/** 0901234567 / 84901234567 / +84 901 234 567 → "0901234567". */
export function normalizeVnPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  else if (!d.startsWith("0")) d = "0" + d;
  return d;
}

/** SĐT chuẩn hoá → email ảo. 0901234567 → 0901234567@sdvico.local */
export function phoneToEmail(rawPhone: string): string {
  return `${normalizeVnPhone(rawPhone)}@${PHONE_EMAIL_DOMAIN}`;
}

/** Ô nhập SĐT chỉ nhận SỐ, tối đa 11 số. */
export function sanitizePhoneInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

/** Hợp lệ tối thiểu: 10–11 chữ số sau chuẩn hoá. */
export function isValidVnPhone(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("84") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  return /^[1-9]\d{8,9}$/.test(local);
}
