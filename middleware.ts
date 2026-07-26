import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware làm tươi phiên đăng nhập (giữ cookie luôn mới) và là CHỐT THẬT
 * của tính năng premium: /api/fish-forecast bị chặn 401/403 tại đây (trước
 * cache ISR — xem lib/supabase/middleware.ts). Mọi đường dẫn khác: KHÔNG
 * chặn, KHÔNG chuyển hướng. Khi chưa cấu hình Supabase → passthrough.
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
