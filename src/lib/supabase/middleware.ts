import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { mustForcePasswordChange } from "@/lib/auth-guard";
import { resolveTier } from "@/lib/tier";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";

/**
 * Làm tươi phiên đăng nhập (refresh session) trên mỗi request để cookie không
 * hết hạn. Với app nói chung: KHÔNG chặn, KHÔNG chuyển hướng; khách chưa đăng
 * nhập vẫn dùng bình thường. Nếu thiếu env Supabase thì passthrough.
 *
 * Ngoại lệ local: user đã đăng nhập còn cờ must_change_password bị ép về
 * /doi-mat-khau.
 *
 * Ngoại lệ base: /api/fish-forecast là tính năng PREMIUM. Chặn ở middleware
 * trước cache để route giữ ISR.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (mustForcePasswordChange(request.nextUrl.pathname, user?.user_metadata)) {
    const redirect = NextResponse.redirect(
      new URL("/doi-mat-khau", request.url),
    );
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirect.cookies.set(c.name, c.value));
    return redirect;
  }

  if (request.nextUrl.pathname === "/api/fish-forecast") {
    const deny = (status: number, code: string) => {
      const res = NextResponse.json({ ok: false, code }, { status });
      supabaseResponse.cookies
        .getAll()
        .forEach((c) => res.cookies.set(c.name, c.value));
      return res;
    };

    if (!user) return deny(401, "login_required");

    const admin = isAdminPhone(
      user.email,
      parseAdminPhones(process.env.ADMIN_PHONES),
    );
    if (!admin) {
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
