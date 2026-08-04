// Dịch lỗi đổi mật khẩu của Supabase Auth sang câu tiếng Việt NÓI RÕ PHẢI LÀM
// GÌ. THUẦN — test được, không đụng React/Supabase client.
//
// Bối cảnh (rà 2026-07-21): màn /doi-mat-khau gộp MỌI lỗi thành một câu "Chưa
// đổi được mật khẩu. Bạn thử lại giúp nhé." Câu đó bảo KH thử lại, nhưng thử
// lại y hệt thì hỏng y hệt — KH không có thông tin để sửa. Cộng với middleware
// chặn mọi trang khi còn cờ must_change_password → KH kẹt cứng, bỏ app luôn
// (mất khách thật 0907905359, đăng nhập 02/07 rồi không quay lại).
//
// Ca hay gặp nhất: KH gõ LẠI chính mật khẩu nhân viên đã báo (họ không hiểu vì
// sao phải đổi) → Supabase chối "same_password" → phải nói thẳng ra điều đó.

/** Mã lỗi Supabase Auth trả về (`AuthError.code`), kèm dò theo message cho bản
 *  cũ chưa có `code`. */
type RawAuthError = { code?: string; message?: string; status?: number } | null;

export const FALLBACK_MESSAGE =
  "Chưa đổi được mật khẩu. Bà con thử lại, hoặc gọi SDVICO để được giúp.";

/**
 * Lỗi Supabase → câu tiếng Việt đời thường, luôn kèm HÀNH ĐỘNG tiếp theo.
 * Không rõ lỗi gì → câu chung có lối thoát (gọi SDVICO), KHÔNG bảo "thử lại"
 * cụt lủn.
 */
export function passwordChangeErrorMessage(err: RawAuthError): string {
  const code = (err?.code ?? "").toLowerCase();
  const msg = (err?.message ?? "").toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => msg.includes(n));

  // Gõ lại đúng mật khẩu cũ — ca phổ biến nhất, phải nói thẳng.
  if (code === "same_password" || has("should be different", "same password")) {
    return "Mật khẩu mới đang trùng mật khẩu cũ. Bà con đặt một mật khẩu KHÁC nhé.";
  }

  // Mật khẩu quá ngắn / quá yếu theo cấu hình project.
  if (
    code === "weak_password" ||
    has("password should be at least", "weak password", "password is too short")
  ) {
    return "Mật khẩu quá ngắn hoặc quá dễ đoán. Bà con đặt mật khẩu dài hơn 6 ký tự nhé.";
  }

  // Mật khẩu nằm trong danh sách rò rỉ (nếu project bật kiểm tra).
  if (has("pwned", "leaked", "compromised")) {
    return "Mật khẩu này quá phổ biến, dễ bị đoán. Bà con chọn mật khẩu khác nhé.";
  }

  // Phiên đăng nhập hết hạn / token hỏng → phải đăng nhập lại.
  if (
    code === "session_not_found" ||
    err?.status === 401 ||
    has("session", "jwt", "token", "not authenticated", "unauthorized")
  ) {
    return "Phiên đăng nhập đã hết hạn. Bà con đăng nhập lại rồi đổi mật khẩu nhé.";
  }

  // Bấm quá nhiều lần.
  if (
    code === "over_request_rate_limit" ||
    err?.status === 429 ||
    has("rate limit", "too many")
  ) {
    return "Bà con bấm hơi nhanh. Chờ một chút rồi thử lại nhé.";
  }

  // Mất mạng / máy chủ không trả lời.
  if (
    has("failed to fetch", "network", "timeout", "networkerror") ||
    (err?.status !== undefined && err.status >= 500)
  ) {
    return "Mạng đang chập chờn nên chưa lưu được. Bà con kiểm tra sóng rồi thử lại nhé.";
  }

  return FALLBACK_MESSAGE;
}

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

/**
 * ĐỒNG HỒ CHẶN cho một promise không có nút hủy — hết giờ thì trả `null`.
 *
 * VÌ SAO CẦN (soát offline 2026-08-02, khuôn lỗi K1): các lời gọi auth của
 * Supabase (`signInWithPassword`, `signOut`, `getUser`) KHÔNG nhận
 * `AbortSignal`. Ở sóng "sống mà chết" chúng bắt tay xong rồi treo — không
 * resolve, không reject — nên `await` đứng mãi và màn hình kẹt ở "Đang vào…"
 * VĨNH VIỄN. Nặng nhất là các cú gọi nằm SAU khi việc chính đã xong (thu hồi
 * phiên máy khác sau khi đã đổi mật khẩu): bà con tưởng chưa đổi được, đi gõ
 * lại mật khẩu cũ.
 *
 * Hết giờ KHÔNG hủy việc đang chạy (không hủy được) — chỉ thôi chờ. Promise
 * gốc được nuốt lỗi để không thành "unhandled rejection" khi nó về muộn.
 *
 * Trả `null` = "chưa biết kết quả", KHÔNG phải "thất bại" — chỗ gọi tự quyết.
 */
export function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(null);
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        // Lỗi cũng là "xong" — chỗ gọi chỉ cần biết "không có kết quả".
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
