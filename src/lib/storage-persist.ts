// Offline WEB — GIỮ CACHE KHỎI BỊ TRÌNH DUYỆT DỌN.
//
// Vì sao cần: service worker + localStorage chạy được cả trong TAB trình duyệt
// (không chỉ PWA đã cài), NHƯNG là bộ nhớ "best-effort" — máy đầy thì trình
// duyệt tự xoá. `navigator.storage.persist()` xin trình duyệt GIỮ BỀN (không tự
// xoá khi thiếu chỗ). Riêng iOS Safari còn xoá SẠCH storage sau ~7 ngày không
// dùng NẾU CHƯA "Thêm vào màn hình chính" — cái đó không có API vượt được, chỉ
// cài về máy mới thoát (xem components/install-prompt.tsx).
//
// Toàn hàm thuần gọi browser API, best-effort (nuốt lỗi) — offline là tăng
// cường, không được làm hỏng app. Chỉ client component import.

/** Đang chạy ở chế độ đã cài (PWA / thêm vào màn hình chính)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      // iOS Safari: cờ riêng, không theo chuẩn display-mode
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** Máy iOS (iPhone/iPad) — iPadOS 13+ báo "Mac", nhận thêm qua touch */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSClassic = /iphone|ipad|ipod/i.test(ua);
  const iPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  return iOSClassic || iPadOS;
}

/**
 * Xin bộ nhớ BỀN. Trả true nếu đang/được cấp bền. Idempotent (đã bền thì thôi).
 * Best-effort: máy không hỗ trợ / bị chặn → false, KHÔNG ném. Chrome cấp theo
 * mức dùng (đã cài / hay mở / đã cho thông báo); Safari thường cấp mặc định.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      return false;
    }
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
