import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware làm tươi phiên đăng nhập (giữ cookie luôn mới). App công khai vẫn
 * dùng được khi chưa đăng nhập. Ngoại lệ:
 * - user còn cờ đổi mật khẩu mặc định bị ép về /doi-mat-khau
 * - /api/fish-forecast bị chặn premium trong lib/supabase/middleware.ts
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
