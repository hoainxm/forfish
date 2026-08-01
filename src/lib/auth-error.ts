// Phân biệt hai kiểu "không lấy được người đang đăng nhập" — THUẦN, có test.
//
// VÌ SAO CẦN (lỗi 2026-08-01): `supabase.auth.getUser()` KHÔNG reject khi mất
// sóng. auth-js bắt lỗi fetch, dựng `AuthRetryableFetchError` rồi RESOLVE kèm
// `{ data: { user: null }, error }` (@supabase/auth-js: lib/fetch.js ném
// AuthRetryableFetchError cho lỗi mạng + 5xx/408/429; GoTrueClient._getUser bắt
// `isAuthError` rồi trả kết quả thay vì ném). Chỗ gọi chỉ bóc `data` thì LỖI
// MẠNG ĐỘI LỐT ĐĂNG XUẤT THẬT:
//  · use-tier tưởng bà con vừa đăng xuất → XOÁ dấu premium trong máy → khách đã
//    trả tiền mất bản đồ cá + thời tiết dài ngày suốt phần còn lại của chuyến;
//  · market-listings báo "Cần đăng nhập để đăng tin" cho người ĐANG đăng nhập.
// Ca dính là sóng "sống mà chết" ngoài khơi (navigator.onLine vẫn true, gói tin
// không về) — đúng ca các nấc offline sinh ra để cứu.

/** Tên lỗi auth-js nghĩa là "không hỏi được máy chủ", không phải "chưa đăng nhập" */
const NETWORK_AUTH_ERROR_NAMES = new Set([
  "AuthRetryableFetchError",
  "AuthUnknownError",
]);

/**
 * Lỗi từ `getUser()` này là do MẠNG (chưa kết luận được gì) hay do MÁY CHỦ ĐÃ
 * TRẢ LỜI (hết phiên / token hỏng = đăng xuất thật)?
 *
 * `true`  → giữ nguyên trạng thái cũ, đánh dấu "không tra được".
 * `false` → máy chủ đã nói, coi là chưa đăng nhập.
 */
export function isNetworkAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: unknown; status?: unknown };
  if (typeof e.name === "string" && NETWORK_AUTH_ERROR_NAMES.has(e.name)) {
    return true;
  }
  // Lưới an toàn: máy chủ/gateway hỏng (500, 502, 504 của gateway vệ tinh) cũng
  // KHÔNG kết luận được là đăng xuất.
  return typeof e.status === "number" && e.status >= 500;
}
