import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Làm tươi phiên đăng nhập (refresh session) trên mỗi request để cookie
 * không hết hạn. KHÔNG chặn, KHÔNG chuyển hướng ai cả — app vẫn dùng được
 * bình thường khi chưa đăng nhập. Nếu chưa cấu hình Supabase (thiếu env)
 * thì đây chỉ là passthrough, không làm gì.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Chưa cấu hình → cho qua, không động vào gì.
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Gọi getUser() để @supabase/ssr làm tươi token và ghi lại cookie.
  // KHÔNG có logic chuyển hướng — chỉ giữ phiên luôn mới.
  await supabase.auth.getUser();

  return supabaseResponse;
}
