/**
 * TIN "BẢN MỚI ĐÃ VỀ KHO" từ service worker (2026-10-05).
 *
 * Nhánh /api/* của `public/sw.js` chờ mạng `API_STALE_MS` (10 s); quá thì trả
 * BẢN CŨ trong kho cho bà con khỏi nhìn màn trống, mẻ tải vẫn chạy nền và cất
 * bản mới. Trước đây màn đang mở không hề biết bản mới đã về ⇒ đứng ở bản cũ
 * tới lúc mở lại app. Ca thật: bản đồ cá ~3 MB qua sóng yếu luôn quá 10 s, máy
 * chủ đã có ngừ ồ mà máy bà con vẫn "không có ngừ ồ".
 *
 * Nay SW cất xong thì `postMessage({type, path})`; trang nghe và ĐỌC THẲNG KHO
 * (không fetch lại — tải 3 MB lần hai ngoài biển là phí sóng).
 */

/** Trùng `API_FRESH_MSG` trong public/sw.js. */
export const SW_API_FRESH_MSG = "sdfish:api-fresh";

/** Tin này có phải "bản mới của `path` đã về kho" không — THUẦN. */
export function isApiFreshMsg(data: unknown, path: string): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as { type?: unknown; path?: unknown };
  return d.type === SW_API_FRESH_MSG && d.path === path;
}

/**
 * Nghe tin của SW cho một `path`. Trả hàm huỷ. Không có SW (Capacitor, trình
 * duyệt cũ, SSR) ⇒ không làm gì.
 */
export function onSwApiFresh(path: string, cb: () => void): () => void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return () => {};
  }
  const sw = navigator.serviceWorker;
  const h = (e: MessageEvent) => {
    if (isApiFreshMsg(e.data, path)) cb();
  };
  sw.addEventListener("message", h);
  return () => sw.removeEventListener("message", h);
}

/**
 * Bản `next` có MỚI HƠN bản đang hiện không (theo mốc máy chủ tính) — THUẦN.
 * Thiếu/rác mốc ở `next` ⇒ không thay (đừng đổi bản đang hiện lấy bản không rõ
 * tuổi); `cur` không có/không rõ mốc ⇒ thay.
 */
export function isNewerGeneratedAt(
  cur: string | null | undefined,
  next: string | null | undefined,
): boolean {
  const n = Date.parse(next ?? "");
  if (!Number.isFinite(n)) return false;
  const c = Date.parse(cur ?? "");
  if (!Number.isFinite(c)) return true;
  return n > c;
}
