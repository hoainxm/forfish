// QUAY VỀ ĐÚNG CHỖ SAU KHI ĐĂNG NHẬP / ĐĂNG KÝ (rà hành trình 2026-10-29).
// Trước đây vào xong luôn `router.replace("/")` — đang đặt hàng hay đang xem bản đồ mà bị mời
// đăng nhập là mất chỗ đang làm, phải tìm lại từ Trang chủ. Cổng mời (LoginGate, RequireLogin,
// PremiumLock) gắn `?next=<đường dẫn hiện tại>`; trang đăng nhập/đăng ký đọc qua `safeNext`.
// THUẦN, có test (auth-next.test.ts).

/** Trang tài khoản — quay về đây là vòng lặp, coi như không có `next`. */
const KHONG_QUAY_VE = ["/login", "/dang-ky", "/quen-mat-khau", "/doi-mat-khau"];

/**
 * `next` an toàn: CHỈ đường dẫn trong app (bắt đầu bằng một dấu `/`). Chặn `//host`, `/\host`,
 * `https://…`, ký tự điều khiển — không ai mượn link đăng nhập của SDFish để đẩy bà con sang
 * trang lạ. Sai ⇒ "/".
 */
export function safeNext(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return "/";
  const path = raw.split(/[?#]/)[0];
  if (KHONG_QUAY_VE.some((p) => path === p || path.startsWith(`${p}/`))) return "/";
  return raw;
}

/** `/login` hoặc `/dang-ky` kèm `?next=` (bỏ khi next là Trang chủ — link gọn như cũ). */
export function withNext(base: "/login" | "/dang-ky", next: string | null | undefined): string {
  const n = safeNext(next);
  return n === "/" ? base : `${base}?next=${encodeURIComponent(n)}`;
}

/** Đọc `next` từ query hiện tại (trình duyệt). Không có / không an toàn ⇒ "/". */
export function readNextParam(search: string): string {
  try {
    return safeNext(new URLSearchParams(search).get("next"));
  } catch {
    return "/";
  }
}
