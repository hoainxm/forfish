import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { mustForcePasswordChange } from "@/lib/auth-guard";

/**
 * Làm tươi phiên đăng nhập (refresh session) trên mỗi request để cookie
 * không hết hạn. KHÔNG gate app công khai — khách chưa đăng nhập vẫn dùng
 * bình thường. NGOẠI LỆ DUY NHẤT: user đã đăng nhập mà CÒN cờ buộc đổi mật
 * khẩu mặc định (must_change_password) thì ép về /doi-mat-khau — chặn ở đây
 * (server) để không lách được bằng nút back / gõ URL tay. Chưa cấu hình
 * Supabase (thiếu env) → passthrough, không làm gì.
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

  // Gọi getUser() để @supabase/ssr làm tươi token và ghi lại cookie. getUser
  // xác thực với Auth server nên user_metadata luôn là bản mới nhất (đổi mật
  // khẩu xong cờ tắt ngay → không kẹt vòng lặp redirect).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ép đổi mật khẩu mặc định — server-side, không lách được (báo cáo test:
  // login không đổi MK mà quay lại vẫn vào app). Chỉ user CÒN cờ mới bị đẩy.
  if (mustForcePasswordChange(request.nextUrl.pathname, user?.user_metadata)) {
    const redirect = NextResponse.redirect(
      new URL("/doi-mat-khau", request.url),
    );
    // giữ cookie phiên vừa refresh để không rớt đăng nhập khi chuyển hướng
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirect.cookies.set(c.name, c.value));
    return redirect;
  }

  return supabaseResponse;
}
