// Quên mật khẩu — gửi yêu cầu đặt lại sang SDWork (CRM). THUẦN, test được.
//
// Bối cảnh (2026-07-21): SDFish KHÔNG email/OTP (quyết định 2026-06-16) nên
// không làm được "gửi link đặt lại" kiểu thường. Rà CRM thì thấy đã có sẵn TRỌN
// quy trình: Edge Function `request-password-reset` + bảng `password_reset_requests`
// + `approve-password-reset`/`reject-password-reset` cho nhân viên duyệt + chống
// spam theo IP. Nên SDFish CHỈ cần dựng màn nhập và gọi sang — không xây mới.
//
// ⚠️ GỌI TỪ TRÌNH DUYỆT KHÁCH, KHÔNG qua máy chủ SDFish. CRM chặn 5 yêu cầu/giờ
// theo `requester_ip`; nếu máy chủ SDFish gọi hộ thì MỌI khách chung 1 IP →
// khách thứ 6 trong giờ bị từ chối oan. Gọi thẳng từ máy khách = mỗi người 1 IP,
// đúng ý đồ thiết kế của CRM.
//
// Khoá dùng ở đây là ANON key của CRM — loại công khai theo thiết kế Supabase
// (vốn nằm sẵn trong app di động), KHÔNG phải bí mật. Tuyệt đối không dùng
// service-role ở phía client.

import { normalizeVnPhone } from "@/lib/phone";

/** Thân yêu cầu đúng shape Edge Function `request-password-reset` của CRM. */
export type ResetRequestBody = {
  username: string;
  phone: string;
  full_name: string;
};

/**
 * Dựng thân yêu cầu.
 *
 * CRM dò user theo thứ tự: `users.login_phone` = normalizePhone(username) →
 * `users.email` → `users.phone` → `users.employee_code`. Vì KH SDFish đăng nhập
 * bằng SĐT và KHÔNG biết tên đăng nhập bên CRM, ta đưa **SĐT vào cả `username`
 * lẫn `phone`** — nhánh dò đầu tiên khớp ngay `login_phone`.
 */
export function buildResetRequest(phone: string, fullName: string): ResetRequestBody {
  const p = normalizeVnPhone(phone);
  return { username: p, phone: p, full_name: fullName.trim() };
}

/** Lỗi nhập liệu phía KH — null = hợp lệ. Kiểm ở client cho phản hồi tức thì;
 *  CRM vẫn kiểm lại (400 nếu thiếu trường). */
export function validateResetInput(
  phone: string,
  fullName: string,
  isValidPhone: (p: string) => boolean,
): string | null {
  if (!isValidPhone(phone)) {
    return "Số điện thoại phải đủ 10 số (ví dụ 0901234567). Bà con kiểm tra lại nhé.";
  }
  const name = fullName.trim();
  if (name.length < 2) {
    return "Bà con nhập họ tên đầy đủ giúp nhé.";
  }
  if (!name.includes(" ")) {
    return "Bà con nhập CẢ họ và tên (ví dụ: Nguyễn Văn Ba) để đối chiếu cho đúng.";
  }
  return null;
}

export type ResetOutcome = { ok: boolean; message: string };

const SUCCESS_MESSAGE =
  "Đã gửi yêu cầu tới SDVICO. Nhân viên sẽ gọi lại cho bà con trong vòng 24 giờ để báo mật khẩu mới.";

/**
 * Phản hồi CRM → câu tiếng Việt đời thường.
 *
 * CRM CỐ Ý luôn trả câu chung khi không tìm thấy tài khoản (chống dò xem số nào
 * có đăng ký) → ta giữ nguyên tinh thần đó, KHÔNG nói "số này chưa có tài khoản".
 */
export function resetRequestMessage(
  status: number,
  body: { error?: string; message?: string; success?: boolean } | null,
): ResetOutcome {
  if (status === 429) {
    return {
      ok: false,
      message: "Bà con đã gửi nhiều yêu cầu quá. Chờ khoảng một tiếng rồi thử lại, hoặc gọi thẳng SDVICO nhé.",
    };
  }
  if (status === 400) {
    return {
      ok: false,
      message: body?.error || "Còn thiếu thông tin. Bà con điền đủ số điện thoại và họ tên giúp nhé.",
    };
  }
  // 401/403 = LỖI CẤU HÌNH phía ta (khoá sai project), KH không tự sửa được →
  // đẩy thẳng sang hotline thay vì bảo họ thử lại vô ích.
  if (status === 401 || status === 403) {
    return {
      ok: false,
      message: "Hệ thống đang trục trặc. Bà con gọi SDVICO để được cấp lại mật khẩu ngay nhé.",
    };
  }
  if (status >= 500 || status === 0) {
    return {
      ok: false,
      message: "Chưa gửi được yêu cầu, có thể do mạng. Bà con thử lại, hoặc gọi SDVICO để được giúp ngay.",
    };
  }
  if (status === 200 && body?.success) {
    // CRM trả message riêng khi KH ĐÃ có yêu cầu đang chờ — giữ nguyên câu đó.
    const daCho = body.message && /đang chờ/i.test(body.message);
    return {
      ok: true,
      message: daCho
        ? "Bà con đã gửi yêu cầu rồi, SDVICO đang xử lý. Chờ nhân viên gọi lại nhé."
        : SUCCESS_MESSAGE,
    };
  }
  return {
    ok: false,
    message: "Chưa gửi được yêu cầu. Bà con gọi SDVICO để được giúp nhé.",
  };
}

/**
 * Đã cấu hình đường sang CRM chưa (thiếu URL → màn chỉ hiện hướng dẫn gọi).
 *
 * Khoá là **TUỲ CHỌN** (rút ra khi verify 2026-07-21): Edge Function
 * `request-password-reset` deploy ở chế độ công khai (không verify JWT) nên
 * KHÔNG cần khoá. Nguy hiểm hơn: cổng Supabase **bỏ qua** khoá không đọc được
 * nhưng **chặn 401 "Invalid API key"** với khoá đọc được mà sai project — tức
 * gửi khoá SAI còn tệ hơn không gửi. Vì vậy chỉ đính khoá khi thực sự có cấu
 * hình; sau này CRM bật verify JWT thì điền env là chạy, không phải sửa mã.
 */
export function resetEndpoint(
  functionsUrl: string | undefined,
  anonKey: string | undefined,
): { url: string; anonKey: string | null } | null {
  const base = (functionsUrl ?? "").trim().replace(/\/+$/, "");
  const key = (anonKey ?? "").trim();
  if (!base) return null;
  return { url: `${base}/request-password-reset`, anonKey: key || null };
}

/** Headers gọi CRM — chỉ đính khoá khi có (xem `resetEndpoint`). */
export function resetHeaders(anonKey: string | null): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (anonKey) {
    h.authorization = `Bearer ${anonKey}`;
    h.apikey = anonKey;
  }
  return h;
}
