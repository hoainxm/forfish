import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveTier } from "@/lib/tier";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";

/**
 * Làm tươi phiên đăng nhập (refresh session) trên mỗi request để cookie
 * không hết hạn. Với app nói chung: KHÔNG chặn, KHÔNG chuyển hướng — vẫn
 * dùng được bình thường khi chưa đăng nhập. Nếu chưa cấu hình Supabase
 * (thiếu env) thì đây chỉ là passthrough, không làm gì (demo mode mở hết).
 *
 * NGOẠI LỆ DUY NHẤT — /api/fish-forecast (2026-07-26, phân hạng tài khoản):
 * dự báo cá là tính năng PREMIUM. Chặn ở MIDDLEWARE (trước cache) thay vì
 * trong route để route giữ nguyên ISR 6h — đọc cookies trong route sẽ biến nó
 * thành dynamic, mỗi request tính lại lưới ERDDAP 14–30s. Đây là chốt THẬT
 * (khoá UI chỉ là lớp vỏ): 401 chưa đăng nhập · 403 chưa premium.
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
  const { data } = await supabase.auth.getUser();

  if (request.nextUrl.pathname === "/api/fish-forecast") {
    // WEB QUẢN TRỊ (app riêng, thư mục admin/ — tách 2026-07-26) kiểm tra
    // nguồn dự báo cá bằng server-to-server: header x-admin-key khớp shared
    // secret ADMIN_API_KEY (set cả hai bên) thì đi qua như premium.
    const adminKey = process.env.ADMIN_API_KEY;
    if (adminKey && request.headers.get("x-admin-key") === adminKey) {
      return supabaseResponse;
    }
    // JSON lỗi phải mang theo cookie vừa refresh — không thì phiên "đứng hình".
    const deny = (status: number, code: string) => {
      const res = NextResponse.json({ ok: false, code }, { status });
      supabaseResponse.cookies
        .getAll()
        .forEach((c) => res.cookies.set(c.name, c.value));
      return res;
    };
    if (!data?.user) return deny(401, "login_required");
    // Admin (env ADMIN_PHONES) xem như premium — kiểm tra được đúng thứ khách
    // premium thấy, khỏi phải tự gán hạng cho mình trong DB.
    const admin = isAdminPhone(
      data.user.email,
      parseAdminPhones(process.env.ADMIN_PHONES),
    );
    if (!admin) {
      // Hạng của chính mình — RLS own-phone (0002); cột 0003. Lỗi/migration
      // chưa apply → 'basic' (fail-closed, cùng luật resolveTier).
      const { data: cust, error } = await supabase
        .from("customers")
        .select("tier, premium_until")
        .maybeSingle();
      const tier = error
        ? "basic"
        : resolveTier(cust?.tier, cust?.premium_until, Date.now());
      if (tier !== "premium") return deny(403, "premium_required");
    }
  }

  return supabaseResponse;
}
