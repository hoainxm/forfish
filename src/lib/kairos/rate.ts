// KAIROS — TRẦN TẦN SUẤT GHI THEO SĐT (14 Assumptions A1, AC07/AC21). THUẦN.
//
// Theo NGÀY đếm TRONG KHO (bảng kairos_*: Vercel chạy nhiều instance, đếm bộ nhớ là trần ảo).
// Hay (300/giờ) đếm bằng lib/rate-limit.ts — bộ nhớ instance, nợ đã ghi ở file đó; Hay là
// thao tác bật/tắt vô hại, PK cặp ở DB đã chặn đếm trùng.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export const KAIROS_RATES = {
  posts: { limit: 10, windowMs: DAY_MS },
  comments: { limit: 60, windowMs: DAY_MS },
  uploads: { limit: 30, windowMs: DAY_MS },
  reports: { limit: 20, windowMs: DAY_MS },
  "follows+blocks": { limit: 100, windowMs: DAY_MS },
  // SỬA bài (PATCH): mỗi lần sửa đưa bài về hàng chờ agent (một lượt gọi Claude) — không trần là
  // một người sửa đi sửa lại đốt hạn mức kiểm duyệt của cả cộng đồng. Đếm bằng nhật ký `post_edit`.
  edits: { limit: 30, windowMs: DAY_MS },
  hay: { limit: 300, windowMs: HOUR_MS },
  // ĐỌC (dòng tin, bài, bình luận, trang người, đếm bài mới) — cùng trần "data" của dataGate
  // (600/10 phút). Đăng nhập đếm theo SĐT; khách theo IP (khách không có SĐT).
  read: { limit: 600, windowMs: 10 * 60 * 1000 },
} as const;
export type KairosRateKey = keyof typeof KAIROS_RATES;

// Việc ghi để lại dấu trong nhật ký (kairos_audit): đếm cả nhật ký vì dòng bảng XOÁ được — xoá
// bài rồi đăng lại không được tính là "chưa đăng".
export const RATE_AUDIT_ACTIONS: Partial<Record<KairosRateKey, readonly string[]>> = {
  posts: ["post_create", "post_reshare"],
  comments: ["comment_create"],
  uploads: ["upload"],
  edits: ["post_edit"],
};

/** Số đã dùng = số lớn hơn giữa dòng còn trong bảng và dấu nhật ký (nhật ký ghi hỏng thì bảng vẫn chặn). */
export function rateUsed(tableCount: number, auditCounts: readonly number[]): number {
  return Math.max(tableCount, auditCounts.reduce((a, b) => a + b, 0));
}

/** Mốc đầu cửa sổ (ISO) để đếm `created_at >= since`. */
export function windowStart(key: KairosRateKey, now: number): string {
  return new Date(now - KAIROS_RATES[key].windowMs).toISOString();
}

/** Đã đủ trần chưa — `used` = số đã ghi trong cửa sổ (chưa kể lượt này). */
export function overLimit(key: KairosRateKey, used: number): boolean {
  return !(Number.isFinite(used) && used >= 0) || used >= KAIROS_RATES[key].limit;
}

/** Đang bị cấm ghi không (`banned_until` > now). Giờ hỏng ⇒ coi như đang cấm (an toàn). */
export function isBanned(bannedUntil: string | null | undefined, now: number): boolean {
  if (!bannedUntil) return false;
  const t = Date.parse(bannedUntil);
  return !Number.isFinite(t) || t > now;
}
