// Mật khẩu tạm khi admin ĐẶT LẠI mật khẩu cho khách (/api/admin/accounts
// action='reset-password').
//
// ĐỔI 2026-10-02 (RBAC P0, user chốt "làm hết"): bản cũ CỐ ĐỊNH "sd123456"
// (chốt 2026-07-29) — trùng mật khẩu mặc định của khách SDWork (ADR 0007) và
// mật khẩu khởi tạo admin chung ⇒ ai cũng biết. Nay NGẪU NHIÊN mỗi lần, vẫn
// giữ khuôn dễ đọc qua điện thoại cho bà con 40–60 tuổi: "sd" + 6 chữ số.
// Admin thấy đúng một lần trong phản hồi và báo cho khách; khách bị bắt đổi
// ngay lần đăng nhập kế (must_change_password).
// KHÔNG đụng mật khẩu MẶC ĐỊNH lúc provision của webhook SDWork — đó là quyết
// định kích hoạt riêng (ADR 0007), có lộ trình siết riêng.

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
