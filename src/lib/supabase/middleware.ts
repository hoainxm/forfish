import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { mustForcePasswordChange } from "@/lib/auth-guard";
import { resolveTier } from "@/lib/tier";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import { tokenIdentity } from "@/lib/device-token-server";

/**
 * CHỐT THẬT của /api/fish-forecast (khoá UI chỉ là lớp vỏ): 401 chưa đăng nhập ·
 * 403 chưa premium. Chặn ở MIDDLEWARE thay vì trong route để route giữ nguyên
 * ISR 6h — đọc danh tính trong route sẽ biến nó thành dynamic, mỗi request tính
 * lại lưới ERDDAP 14–30s.
 *
 * Nhận diện theo THỨ TỰ:
 *   1. chuỗi cứng trong header (đường chính từ 2026-08-02)
 *   2. phiên Supabase cũ (đường lùi một nhịp phát hành — xem lib/api-identity.ts)
 *
 * ⚠️ KHÔNG BAO GIỜ trả 401 vì hạ tầng. Không tra được hạng → 503. Trả 401 lúc
 * Supabase nghẹt là màn hình bà con hiện "cần đăng nhập" giữa biển cho một tài
 * khoản đang còn hạn — đúng khuôn lỗi mà cả việc này sinh ra để chấm dứt.
 */
export async function premiumGate(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Chưa cấu hình → demo mode, mở hết như cũ.
  if (!url || !key) return NextResponse.next({ request });

  const deny = (status: number, code: string) =>
    NextResponse.json({ ok: false, code }, { status });

  // ── 1. CHUỖI CỨNG ────────────────────────────────────────────────────────
  const who = await tokenIdentity(request);
  if (who.ok) return gateByPhone(who.phone, deny);
  if (who.unavailable) return deny(503, "unavailable");
  if (who.denial === "unknown_token" || who.denial === "token_revoked") {
    return deny(401, who.denial);
  }

  // ── 2. PHIÊN SUPABASE CŨ (đường lùi) ─────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return deny(401, "no_token");
  const phone = normalizeVnPhone(data.user.email?.split("@")[0] ?? "");
  if (!phone) return deny(401, "no_token");

  const res = await gateByPhone(phone, deny);
  // JSON lỗi phải mang theo cookie vừa refresh — không thì phiên "đứng hình".
  supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
  return res;
}

/** Hạng của SĐT này có mở được dự báo cá không. Tra bằng service key vì đường
 *  chuỗi cứng không có phiên nào để RLS bám vào — nên PHẢI tự lọc theo đúng SĐT
 *  vừa xác thực, không nhận SĐT từ đâu khác. */
async function gateByPhone(
  phone: string,
  deny: (status: number, code: string) => NextResponse,
): Promise<NextResponse> {
  // Admin (env ADMIN_PHONES) xem như premium — kiểm tra được đúng thứ khách
  // premium thấy, khỏi phải tự gán hạng cho mình trong DB.
  // `isAdminPhone` nhận cả SĐT trần lẫn email ảo — nó tự cắt ở "@".
  if (isAdminPhone(phone, parseAdminPhones(process.env.ADMIN_PHONES))) {
    return NextResponse.next();
  }
  const admin = createAdminClient();
  if (!admin) return deny(503, "unavailable");
  const { data, error } = await admin
    .from("customers")
    .select("tier, premium_until")
    .eq("phone", phone)
    .maybeSingle();
  // KHÔNG tra được ≠ chưa premium. 503 để máy giữ nguyên dấu đã lưu và thử lại.
  if (error) {
    console.error("[premium-gate] tra hạng HỎNG:", error.code, error.message);
    return deny(503, "unavailable");
  }
  const tier = resolveTier(data?.tier, data?.premium_until, Date.now());
  if (tier !== "premium") return deny(403, "premium_required");
  return NextResponse.next();
}
