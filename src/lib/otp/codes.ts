// OTP — logic thuần (server-only): sinh mã, hash, verify, hạn, rate-limit.
// KHÔNG lưu mã thô; chỉ lưu hash (sha256 + pepper) trong bảng otp_codes.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/** Mã hết hạn sau 5 phút. */
export const OTP_TTL_MS = 5 * 60 * 1000;
/** Tối đa số lần nhập sai trước khi mã bị vô hiệu. */
export const OTP_MAX_ATTEMPTS = 5;
/** Chặn gửi lại trong vòng 60s (rate-limit cùng SĐT). */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/** Mã 6 chữ số (crypto, không phải Math.random). */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Hash mã gắn SĐT + pepper (env OTP_PEPPER) — không đảo ngược, không dò chéo SĐT. */
export function hashCode(code: string, phone: string, pepper = ""): string {
  return createHash("sha256").update(`${phone}:${code}:${pepper}`).digest("hex");
}

/** So hash an toàn theo thời gian. */
export function verifyCode(
  code: string,
  phone: string,
  hash: string,
  pepper = "",
): boolean {
  const want = Buffer.from(hashCode(code, phone, pepper), "hex");
  let got: Buffer;
  try {
    got = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Hết hạn chưa? (so theo mốc thời gian ms). */
export function isExpired(expiresAtMs: number, nowMs: number): boolean {
  return nowMs >= expiresAtMs;
}

/** Còn trong thời gian chặn gửi lại? (lần gửi trước → giờ). */
export function inResendCooldown(lastSentAtMs: number, nowMs: number): boolean {
  return nowMs - lastSentAtMs < OTP_RESEND_COOLDOWN_MS;
}
