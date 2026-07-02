import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware làm tươi phiên đăng nhập (giữ cookie luôn mới). KHÔNG gate app
 * công khai — dùng được không cần tài khoản. Ngoại lệ duy nhất: user còn cờ
 * buộc đổi mật khẩu mặc định thì bị ép về /doi-mat-khau (xem updateSession).
 * Khi chưa cấu hình Supabase, middleware là passthrough.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Chạy trên mọi đường dẫn TRỪ các tài nguyên tĩnh:
     * - _next/static, _next/image
     * - favicon, ảnh, icon...
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
