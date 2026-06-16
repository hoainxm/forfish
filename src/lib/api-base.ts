// Base URL của API route — một chỗ điều khiển để app chạy được cả trên web
// (Next server cùng origin) lẫn bản native Capacitor (web bundle ở
// capacitor://, fetch tương đối "/api/..." không trỏ tới server nào).
//
// · Web (mặc định): NEXT_PUBLIC_API_BASE rỗng → giữ nguyên path tương đối,
//   hành vi y như cũ.
// · Native (Capacitor): set NEXT_PUBLIC_API_BASE=https://<backend hosted> khi
//   build → mọi fetch /api/* trỏ tuyệt đối về backend.
// Xem docs/app-map/ops/native-deploy.md.

/** Base đã chuẩn hoá (bỏ "/" cuối). Đọc lúc gọi để test set env được. */
export function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");
}

/**
 * Ghép base + path API. Path tuyệt đối (http...) giữ nguyên; base rỗng → path
 * tương đối như cũ; không nhân đôi dấu "/".
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = apiBase();
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
