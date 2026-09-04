// Phản hồi xúc giác nhẹ (haptics) — dùng tiết chế ở xác nhận có nghĩa (xoá,
// gạch nợ). Web: navigator.vibrate (Android PWA rung; iOS Safari không hỗ trợ
// → no-op, không lỗi). Bản native Capacitor sau này thay bằng @capacitor/haptics.
export function tapFeedback(ms = 10): void {
  vibratePattern(ms);
}

/**
 * Mẫu rung cảnh báo HIỂM HOẠ khi đang chạy: hai nhịp 200 ms cách 100 ms —
 * cùng "hình" với chuông A5–A5 giật ở warning-sound.ts, để tay cảm được thứ
 * tai nghe. Bà con tắt được ở cài đặt (nơi gọi kiểm cờ, không phải ở đây).
 */
export const HAZARD_VIBRATE: readonly number[] = [200, 100, 200];

/**
 * Rung theo mẫu (ms rung, ms nghỉ, ms rung…). Máy không có `navigator.vibrate`
 * (iOS Safari, desktop, jsdom) → không làm gì, không ném — rung chỉ là lớp
 * thêm, cảnh báo hình vẫn là đường chính. Trả `true` khi đã gọi được máy.
 */
export function vibratePattern(pattern: number | readonly number[]): boolean {
  try {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & {
      vibrate?: (p: number | number[]) => boolean;
      userActivation?: { hasBeenActive: boolean };
    };
    if (typeof nav.vibrate !== "function") return false;
    /*  Chrome CHẶN vibrate khi người dùng chưa chạm vào trang lần nào và in
        một dòng lỗi mỗi lần gọi (review đợt 4 B2: 5 dòng đỏ lúc mở app vì
        HUD dựng lại sau reload). Hỏi trước thì khỏi gọi vào tường — máy không
        có API này thì cứ gọi như cũ. */
    if (nav.userActivation && !nav.userActivation.hasBeenActive) return false;
    const p = typeof pattern === "number" ? pattern : [...pattern];
    return nav.vibrate(p) === true;
  } catch {
    return false; // thiết bị không hỗ trợ — bỏ qua, không bao giờ làm hỏng thao tác
  }
}
