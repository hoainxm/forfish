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

/** Ô nhập SĐT chỉ nhận SỐ. Dạng nội địa 0xxxxxxxxx = 10 số → cap 10.
 *  Dạng quốc tế 84xxxxxxxxx = 11 số (84 + 9) → cap 11 để +84 vẫn gõ được. */
export function sanitizePhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("84") ? d.slice(0, 11) : d.slice(0, 10);
}

/** SĐT VN hợp lệ = ĐÚNG 10 số (0 + 9). Chấp nhận nhập kiểu 84/+84 (quốc tế,
 *  quy về 9 số local). Chối 11 số kiểu 0xxxxxxxxxx (thừa số). */
export function isValidVnPhone(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("84") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  return /^[1-9]\d{8}$/.test(local);
}
