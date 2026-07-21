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
