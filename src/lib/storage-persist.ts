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

/** Máy Android (loại trừ máy iOS — có UA lẫn chữ "Mobile" giống nhau) */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || "");
}

/**
 * LOẠI MÁY THÔ để báo về /quan-tri — `"ios" | "android" | "khac"`.
 *
 * CHỈ loại máy, KHÔNG bao giờ gửi user-agent đầy đủ: chuỗi UA là dấu vân tay
 * nhận diện được từng máy, mà app của ngư dân không được biến thành thứ theo
 * dõi bà con (cùng luật với migration 0021/0022).
 *
 * Vì sao nhân viên cần biết: hướng dẫn cài đặt của hai nền KHÁC HẲN nhau, mà
 * bản cài trên iOS còn có kho riêng tách Safari — gọi điện nhắc mà không biết
 * máy gì thì dễ chỉ sai bước, bà con làm theo xong vẫn ra khơi tay trắng.
 */
export function devicePlatform(): "ios" | "android" | "khac" {
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  return "khac";
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
