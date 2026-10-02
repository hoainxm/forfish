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

/**
 * SĐT của PHIÊN Supabase — chỗ DUY NHẤT server đổi email đăng nhập ra SĐT
 * (vá 2026-10-02, RBAC P0). Bản cũ `normalizeVnPhone(email.split("@")[0])`
 * không xét đuôi: ai đăng ký được `<SĐT nạn nhân>@gmail.com` (hay
 * `x0912345678@…` — bóc chữ còn số) là nhận chuỗi cứng của SĐT đó, kể cả SĐT
 * quản trị viên.
 * · `…@sdvico.local` → SĐT chuẩn hoá (luôn là tài khoản do hệ thống mình tạo).
 * · đuôi KHÁC mà phần trước @ quy ra một SĐT VN hợp lệ → null (chặn giả dạng).
 * · đuôi khác, không phải SĐT (email thật của nhóm SDVICO, vd `duclong292`)
 *   → giữ hành vi cũ để không mất danh tính/dữ liệu của nhóm đó.
 * Trả null khi không có gì dùng được — caller coi như chưa đăng nhập.
 */
export function phoneFromAuthEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (domain !== PHONE_EMAIL_DOMAIN && isValidVnPhone(local)) return null;
  const phone = normalizeVnPhone(local);
  return phone === "0" ? null : phone;
}
