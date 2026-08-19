// Dịch lỗi ĐĂNG NHẬP của Supabase Auth sang câu tiếng Việt nói rõ phải làm gì.
// THUẦN — test được, không đụng React/Supabase client.
//
// Bối cảnh (2026-07-21, hậu chiến dịch reset mật khẩu về sd123456): màn /login
// gộp mọi lỗi thành "Sai số điện thoại hoặc mật khẩu." — KH không biết mình
// gõ sai SỐ hay sai MẬT KHẨU. Supabase trả invalid_credentials chung nên client
// không tự phân biệt được → /api/auth/exists (service-role, RPC 0003) trả về
// boolean "SĐT này có tài khoản chưa" để tách 2 câu:
//   - chưa có tài khoản → chỉ đường gọi SDVICO cấp tài khoản
//   - có rồi → sai mật khẩu, gợi ý mật khẩu ban đầu sd123456 / nút Quên mật khẩu
//
// ⚠️ Đánh đổi user enumeration (dò SĐT nào có tài khoản) + lộ mật khẩu mặc định
// cho SĐT ĐÃ đăng ký: user chốt chấp nhận 2026-07-21 — username là SĐT ai cũng
// đoán được, ưu tiên kích hoạt 380 KH thật; lộ trình siết lại ở
// docs/adr/0007-siet-bao-mat-sau-sd123456.md.

const HOTLINE_HIEN = "1900 23 23 49";

/** Mã lỗi Supabase Auth (`AuthError.code`), kèm dò message cho bản chưa có `code`. */
type RawAuthError = { code?: string; message?: string; status?: number } | null;

/** Kết quả check /api/auth/exists: true/false = biết chắc, null = check fail
 *  (mất mạng, chưa cấu hình service-role) → quay về câu gộp cũ. */
export type AccountExists = boolean | null;

export const LOGIN_FALLBACK_MESSAGE =
  "Sai số điện thoại hoặc mật khẩu. Bà con kiểm tra lại nhé.";

/**
 * Lỗi đăng nhập → câu tiếng Việt đời thường, luôn kèm HÀNH ĐỘNG tiếp theo.
 * `exists` = SĐT đã có tài khoản chưa (null khi không kiểm được).
 */
export function loginErrorMessage(err: RawAuthError, exists: AccountExists): string {
  const code = (err?.code ?? "").toLowerCase();
  const msg = (err?.message ?? "").toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => msg.includes(n));

  // Tài khoản bị khóa (ban) — nói thẳng, KHÔNG gợi ý mật khẩu.
  if (code === "user_banned" || has("banned")) {
    return `Tài khoản này đang bị khóa. Bà con gọi SDVICO ${HOTLINE_HIEN} để được giúp nhé.`;
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
    return "Mạng đang chập chờn nên chưa đăng nhập được. Bà con kiểm tra sóng rồi thử lại nhé.";
  }

  // Sai thông tin đăng nhập — tách theo kết quả check tồn tại tài khoản.
  if (exists === false) {
    return `Số điện thoại này chưa có tài khoản SDFish. Bà con gọi SDVICO ${HOTLINE_HIEN} để được cấp tài khoản nhé.`;
  }
  if (exists === true) {
    return "Số đúng rồi, nhưng mật khẩu chưa đúng. Bà con thử mật khẩu ban đầu sd123456, hoặc bấm Quên mật khẩu bên dưới nhé.";
  }

  // Không kiểm được tài khoản → câu gộp cũ, vẫn có lối đi.
  return LOGIN_FALLBACK_MESSAGE;
}
