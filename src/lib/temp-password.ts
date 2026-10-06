// Mật khẩu khi admin/quản lý ĐẶT LẠI mật khẩu (/api/admin/accounts
// action='reset-password') và mật khẩu MẶC ĐỊNH của khách.
//
// LỊCH SỬ (ADR 0008):
//  · 2026-07-29: cố định "sd123456".
//  · 2026-10-02 (RBAC P0): đổi sang NGẪU NHIÊN "sd" + 6 số mỗi lần.
//  · 2026-10-06 (user chốt, ĐẢO lại cho KHÁCH): "hiện tại còn lung tung nhiều
//    mật khẩu khác nhau" — nhân viên CSKH không nhớ nổi khách nào đang mật khẩu
//    gì, bà con gọi lên hỏi thì không ai trả lời được. Khách về MỘT mật khẩu
//    chung `sd123456` (trùng mật khẩu webhook SDWork tạo — ADR 0007), vẫn bật
//    must_change_password để app NHẮC đổi (có lối "Thoát ra, để đổi sau").
//    Tài khoản NHÂN SỰ thì KHÔNG: quản lý/quản trị viên mở được /quan-tri, mật
//    khẩu ai cũng biết + SĐT là đủ vào ⇒ nhân sự vẫn ngẫu nhiên.

/** Mật khẩu mặc định của KHÁCH — MỘT nguồn cho webhook SDWork (tạo tài khoản),
 *  nút Đặt lại ở /quan-tri và ô mật khẩu điền sẵn khi tạo khách. */
export const DEFAULT_CUSTOMER_PASSWORD = "sd123456";

export const TEMP_PASSWORD_PREFIX = "sd";

/** "sd" + 6 chữ số ngẫu nhiên mật mã (crypto.getRandomValues — có cả ở Node
 *  ≥ 20 lẫn trình duyệt). `rand` chỉ để test bơm giá trị. */
export function randomTempPassword(
  rand: () => number = () => {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    return n[0];
  },
): string {
  return `${TEMP_PASSWORD_PREFIX}${String(rand() % 1_000_000).padStart(6, "0")}`;
}

/** Đặt lại thì ra mật khẩu nào: khách → `sd123456`; nhân sự → ngẫu nhiên. */
export function resetPasswordFor(
  targetIsStaff: boolean,
  rand?: () => number,
): string {
  return targetIsStaff ? randomTempPassword(rand) : DEFAULT_CUSTOMER_PASSWORD;
}
