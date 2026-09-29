/**
 * BÁO CÓ BẢN MỚI (2026-09-29) — luật thuần, dùng bởi components/update-notice.
 *
 * Vì sao cần: app cài (PWA/Capacitor) giữ nguyên code đã nạp suốt lúc mở, và
 * mở lại mà mạng chậm quá 2,5 s thì service worker trả trang đã lưu ⇒ bà con
 * kẹt bản cũ nhiều ngày dù đã deploy sửa lỗi (dính thật: ô vuông lớp "Vùng
 * nhiều mồi" 2026-09-28 — sửa đã lên mà máy vẫn chạy bản cũ).
 *
 * Mã bản = commit Vercel (`VERCEL_GIT_COMMIT_SHA`), nhúng lúc build vào
 * `NEXT_PUBLIC_BUILD_ID` (next.config). Client giữ mã của CHÍNH nó; route
 * `/api/version` trả mã của bản ĐANG deploy. Lệch ⇒ có bản mới.
 */

/** Mã bản của code đang chạy (nhúng lúc build). Rỗng = build ngoài Vercel/dev. */
export const LOCAL_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

/** Khoảng cách tối thiểu giữa hai lần hỏi — quay lại app liên tục không đập mạng. */
export const VERSION_CHECK_EVERY_MS = 10 * 60_000;
/** Trần chờ một lần hỏi — sóng yếu thì bỏ, lần sau hỏi lại. */
export const VERSION_CHECK_TIMEOUT_MS = 5_000;

/**
 * Có bản mới hơn không. Mã nào RỖNG ⇒ KHÔNG báo (dev, tự host, route lỗi) —
 * báo nhầm là bắt bà con tải lại vô ích, có khi đang ngoài biển.
 */
export function isNewBuild(local: string, remote: unknown): boolean {
  if (typeof remote !== "string") return false;
  const r = remote.trim();
  return !!local && !!r && r !== local;
}

/** Đã đến lúc hỏi lại chưa (lần đầu = lastMs null ⇒ hỏi). */
export function dueForCheck(lastMs: number | null, nowMs: number): boolean {
  return lastMs == null || nowMs - lastMs >= VERSION_CHECK_EVERY_MS;
}
