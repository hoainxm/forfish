// MÃ ĐƠN của Chợ vật tư — THUẦN. "SD" + yymmdd (giờ VN) + 4 ký tự không nhầm.
// Đọc qua điện thoại: "SD, 26-09-06, K7PQ". Ngày lấy theo lịch VN qua
// `todayIsoVN` (lib/days.ts) — không viết lại phép đổi múi giờ.
import { todayIsoVN } from "@/lib/days";

export const ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // 32 ký hiệu, bỏ 0/O/1/I

/** SD + yymmdd (giờ VN) + 4 ký tự từ `rand` (0..1) — thuần, test được bằng rand cố định. */
export function makeOrderCode(now: Date, rand: () => number): string {
  const ymd = todayIsoVN(now).replace(/-/g, "").slice(2); // "2026-09-06" → "260906"
  let tail = "";
  for (let i = 0; i < 4; i++) {
    const r = rand();
    const idx = Math.min(
      ORDER_CODE_ALPHABET.length - 1,
      Math.max(0, Math.floor((Number.isFinite(r) ? r : 0) * ORDER_CODE_ALPHABET.length)),
    );
    tail += ORDER_CODE_ALPHABET[idx];
  }
  return `SD${ymd}${tail}`;
}

/** Mã YÊU CẦU đặt hàng: "YC" + cùng khuôn (2026-10-18) — đọc qua điện thoại không lẫn với mã đơn. */
export function makeRequestCode(now: Date, rand: () => number): string {
  return `YC${makeOrderCode(now, rand).slice(2)}`;
}

export function isOrderCode(v: unknown): v is string {
  return typeof v === "string" && /^SD\d{6}[A-HJ-NP-Z2-9]{4}$/.test(v);
}
