// CHUỖI CỨNG THEO MÁY — phần THUẦN, dùng chung máy khách và máy chủ.
//
// ⚠️ FILE NÀY TUYỆT ĐỐI KHÔNG ĐƯỢC CÓ "use client" — middleware (Edge) và route
// handler đều import nó. Xem `src/lib/__tests__/server-client-boundary.test.ts`:
// một module "use client" bị gọi từ máy chủ là NÉM NGAY (HTTP 500) mà build vẫn
// xanh, và đúng lỗi đó đã làm chết hẳn nhịp heartbeat gần một ngày.
//
// MÔ HÌNH (chủ dự án chốt 2026-08-02, thay phiên Supabase cho app ngư dân):
// đăng nhập là vô luôn, chuỗi giữ vĩnh viễn, chỉ mất khi máy khác đăng nhập cùng
// số. Không hạn, không xoay, không gia hạn — không có gì để hỏng giữa biển.
//
// Chỉ dùng Web Crypto (`crypto.getRandomValues`, `crypto.subtle`): có đủ trên
// Edge runtime, Node 18+, và mọi trình duyệt bà con đang chạy.

/** Tên header mang chuỗi. KHÔNG dùng cookie: cookie do script ghi bị iOS Safari
 *  xoá sau 7 ngày (đúng cái đang giết phiên), còn header thì do chính app gắn
 *  vào từng lượt fetch nên không dính luật lưu trữ nào. */
export const DEVICE_TOKEN_HEADER = "x-sdfish-token";

/** Tiền tố để nhìn là biết chuỗi của ai, và để chặn sớm mấy chuỗi rác. */
export const DEVICE_TOKEN_PREFIX = "sdf_";

/** 32 byte ngẫu nhiên → 43 ký tự base64url. Cộng tiền tố = 47. */
const RAW_BYTES = 32;
const BODY_LEN = 43;
export const DEVICE_TOKEN_LEN = DEVICE_TOKEN_PREFIX.length + BODY_LEN;

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Sinh một chuỗi cứng mới. CHỈ GỌI TRÊN MÁY CHỦ (route đăng nhập) — chuỗi thô
 * tồn tại đúng một lần, trong đúng một phản hồi, rồi không ai còn giữ nữa ngoài
 * cái máy nhận được nó.
 */
export function newDeviceToken(): string {
  const b = new Uint8Array(RAW_BYTES);
  crypto.getRandomValues(b);
  return DEVICE_TOKEN_PREFIX + base64url(b);
}

/**
 * Có ĐÚNG KHUÔN một chuỗi không — THUẦN, có test.
 *
 * Cổng rẻ đứng trước cổng đắt: sai khuôn thì khỏi băm, khỏi tra DB. Ngoài biển
 * mỗi lượt tra DB là sóng của bà con; và đây cũng là chỗ chặn mấy request dò rác
 * trước khi chúng chạm tới bảng.
 */
export function isValidTokenShape(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (v.length !== DEVICE_TOKEN_LEN) return false;
  if (!v.startsWith(DEVICE_TOKEN_PREFIX)) return false;
  return /^[A-Za-z0-9_-]+$/.test(v.slice(DEVICE_TOKEN_PREFIX.length));
}

/**
 * SHA-256 hex của chuỗi thô — thứ DUY NHẤT được ghi xuống DB.
 *
 * Không thêm muối (salt): chuỗi đã là 32 byte ngẫu nhiên, không có gì để đoán,
 * nên muối chỉ làm mất khả năng tra thẳng bằng khoá chính. Đây KHÁC hẳn mật khẩu
 * (người tự nghĩ, đoán được — chỗ đó vẫn phải bcrypt, và Supabase Auth lo).
 */
export async function hashDeviceToken(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Rút chuỗi ra khỏi header — THUẦN, có test. Sai khuôn → `null` (coi như không
 * gửi), KHÔNG ném: một header rác không được làm hỏng cả request.
 *
 * Nhận cả `Authorization: Bearer <chuỗi>` để sau này Capacitor/native gắn theo
 * đường chuẩn cũng chạy được (xem lib/api-base).
 */
export function readTokenHeader(h: Headers): string | null {
  const direct = h.get(DEVICE_TOKEN_HEADER);
  if (isValidTokenShape(direct)) return direct;
  const auth = h.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (isValidTokenShape(t)) return t;
  }
  return null;
}

/** Vì sao một chuỗi không qua được cửa — máy khách đọc `code` để xử đúng nhánh */
export type TokenDenial =
  /** không gửi chuỗi nào (chưa đăng nhập bao giờ) → mời đăng nhập, KHÔNG dọn gì */
  | "no_token"
  /** gửi rồi nhưng không có trong sổ (chuỗi rác / DB đã dọn) → gỡ tài khoản */
  | "unknown_token"
  /** CÓ trong sổ nhưng đã bị thu hồi vì máy khác đăng nhập → gỡ tài khoản */
  | "token_revoked";

/**
 * Máy PHẢI TỰ GỠ TÀI KHOẢN chưa — THUẦN, có test.
 *
 * Tách khỏi `no_token` vì hai ca khác hẳn nhau về hậu quả: chưa từng đăng nhập
 * thì không có gì để gỡ, còn `token_revoked` là **đã bị máy khác đá** và màn
 * hình phải nói thật chuyện đó.
 *
 * ⚠️ GỠ TÀI KHOẢN ≠ XOÁ DỮ LIỆU. Bà con bị đá lúc đang ngoài khơi vẫn phải giữ
 * nguyên dự báo/bản đồ đã tải về — xem `signOutLocal` ở lib/device-token-store.
 */
export function shouldDropAccount(d: TokenDenial): boolean {
  return d === "unknown_token" || d === "token_revoked";
}
