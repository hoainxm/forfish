// Ép đổi mật khẩu mặc định — logic THUẦN (test được), dùng trong middleware.
// Webhook SDWork provision tài khoản với mật khẩu khởi tạo do CRM gửi + đặt cờ
// user_metadata.must_change_password=true. Trước đây chỉ redirect 1 lần lúc
// login (client) → back/gõ tay URL là lách được, tài khoản dùng mật khẩu mặc
// định ai cũng đoán ra. Giờ chặn SERVER-SIDE: còn cờ thì mọi trang (trừ trang
// auth + API) đều đẩy về /doi-mat-khau. Khách CHƯA đăng nhập không dính (app
// vẫn công khai). Báo cáo test: login không đổi MK mà quay lại vẫn vào được.

/** Các tiền tố ĐƯỢC PHÉP khi đang bị ép đổi mật khẩu: trang đổi MK, trang
 *  đăng nhập/đăng ký (đề phòng nhầm tài khoản), trang quên mật khẩu (KH kẹt ở
 *  màn ép đổi vẫn xin đặt lại được — thêm 2026-07-21), và mọi API (refresh
 *  phiên + đẩy mật khẩu mới sang SDWork). */
const ALLOW_PREFIXES = [
  "/doi-mat-khau",
  "/login",
  "/dang-ky",
  "/quen-mat-khau",
  "/api",
];

/** true = phải đẩy về /doi-mat-khau. Chỉ khi user CÒN cờ must_change_password
 *  VÀ đang ở trang ngoài danh sách cho phép. */
export function mustForcePasswordChange(
  pathname: string,
  meta: { must_change_password?: boolean } | null | undefined,
): boolean {
  if (meta?.must_change_password !== true) return false;
  return !ALLOW_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
