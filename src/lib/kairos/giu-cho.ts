// KAIROS — GIỮ CHỖ ĐANG ĐỌC khi rời dòng tin rồi quay lại (vd mở bài ⇒ ‹ Quay lại), như Facebook.
// THUẦN, bộ nhớ trong module (Map): sống tới khi tải lại trang/đóng app. CỐ Ý không localStorage,
// không khoá forfish.* — đây chỉ là chỗ cuộn + bài đang hiện, mất thì về đường cũ (đọc bản lưu + tải).

export const GIU_CHO_TUOI_MS = 10 * 60 * 1000;

const kho = new Map<string, { snap: unknown; at: number }>();

/** Cất ảnh chụp. `snap.at` (nếu có) là giờ chụp; không có thì lấy giờ máy. */
export function cat<T extends { at?: number }>(key: string, snap: T): void {
  kho.set(key, { snap, at: typeof snap.at === "number" && Number.isFinite(snap.at) ? snap.at : Date.now() });
}

/** Lấy ảnh chụp còn hạn; quá `tuoiToiDaMs` (hoặc giờ máy lùi) ⇒ xoá và trả null. */
export function lay<T>(key: string, now: number, tuoiToiDaMs = GIU_CHO_TUOI_MS): T | null {
  const v = kho.get(key);
  if (!v) return null;
  const tuoi = now - v.at;
  if (tuoi < 0 || tuoi > tuoiToiDaMs) {
    kho.delete(key);
    return null;
  }
  return v.snap as T;
}

export function xoa(key: string): void {
  kho.delete(key);
}
