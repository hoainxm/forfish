import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveTier } from "@/lib/tier";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import { tokenIdentity } from "@/lib/device-token-server";
import { readTokenHeader } from "@/lib/device-token";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { dataRouteRule, type DataRouteRule } from "@/lib/data-route-rules";

/**
 * CỔNG DỮ LIỆU của mọi route trả dữ liệu cho app (2026-09-16 — trước đó chỉ
 * /api/fish-forecast): 401 chưa đăng nhập · 403 chưa premium (dự báo cá, lưới
 * thời tiết >3 ngày) · 429 gọi dồn. Chặn ở MIDDLEWARE thay vì trong route để
 * route giữ nguyên ISR — đọc danh tính trong route sẽ biến nó thành dynamic,
 * mỗi request tính lại nguồn ngoài 14–30s.
 *
 * Nhận diện theo THỨ TỰ:
 *   1. chuỗi cứng trong header (đường chính từ 2026-08-02) — CÓ ĐỆM 10 phút
 *      theo chuỗi, vì ô ảnh bản đồ gọi hàng trăm lượt một phiên; không đệm là
 *      mỗi ô một lượt tra DB (đúng điều matcher cũ cố tránh).
 *   2. phiên Supabase cũ (đường lùi một nhịp phát hành — xem lib/api-identity.ts)
 *
 * ⚠️ KHÔNG BAO GIỜ trả 401 vì hạ tầng. Không tra được hạng → 503. Trả 401 lúc
 * Supabase nghẹt là màn hình bà con hiện "cần đăng nhập" giữa biển cho một tài
 * khoản đang còn hạn — đúng khuôn lỗi mà cả việc này sinh ra để chấm dứt.
 */
export async function dataGate(request: NextRequest, rule: DataRouteRule) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Chưa cấu hình → demo mode, mở hết như cũ.
  if (!url || !key) return NextResponse.next({ request });

  const deny = (status: number, code: string) =>
    NextResponse.json({ ok: false, code }, { status });

  // ── 1. CHUỖI CỨNG ────────────────────────────────────────────────────────
  const raw = readTokenHeader(request.headers);
  const hit = raw ? identityCache.get(raw) : undefined;
  if (hit && hit.exp > Date.now()) return gateByPhone(hit.phone, rule, deny);

  // GỘP LƯỢT TRA: mở bản đồ là vài chục ô ảnh xin CÙNG LÚC trước khi đệm kịp
  // đầy — không gộp thì mỗi ô một lượt tra DB đúng lúc đệm đang trống.
  const who = raw ? await dedupedIdentity(raw, request) : await tokenIdentity(request);
  if (who.ok) {
    if (raw) cacheTokenPhone(raw, who.phone);
    return gateByPhone(who.phone, rule, deny);
  }
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

  const res = await gateByPhone(phone, rule, deny);
  // JSON lỗi phải mang theo cookie vừa refresh — không thì phiên "đứng hình".
  supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
  return res;
}

/** Giữ tên cũ cho /api/fish-forecast (premium + 60 lượt/10 phút). */
export async function premiumGate(request: NextRequest) {
  const rule = dataRouteRule("/api/fish-forecast", new URLSearchParams());
  return dataGate(request, rule!);
}

/**
 * Sau khi biết SĐT: premium (nếu luật đòi) rồi rate limit theo xô.
 * Tra hạng bằng service key vì đường chuỗi cứng không có phiên nào để RLS bám
 * vào — nên PHẢI tự lọc theo đúng SĐT vừa xác thực, không nhận SĐT từ đâu khác.
 * Hạng có đệm 5 phút theo SĐT (hạ hạng chậm tối đa 5 phút — chấp nhận).
 */
async function gateByPhone(
  phone: string,
  rule: DataRouteRule,
  deny: (status: number, code: string) => NextResponse,
): Promise<NextResponse> {
  if (rule.premium) {
    // Admin (env ADMIN_PHONES) xem như premium — kiểm tra được đúng thứ khách
    // premium thấy, khỏi phải tự gán hạng cho mình trong DB.
    const admin = isAdminPhone(phone, parseAdminPhones(process.env.ADMIN_PHONES));
    if (!admin) {
      const tier = await cachedTier(phone);
      if (tier === "unavailable") return deny(503, "unavailable");
      if (tier !== "premium") return deny(403, "premium_required");
    }
  }
  // Gọi dồn dập (cào để phát lại) → 429. Máy bà con gọi vài lượt mỗi lần mở
  // bản đồ, ô ảnh vài trăm — cách trần rất xa. 429 nằm trong `isRescuableStatus`
  // của SW ⇒ vẫn trả bản cũ trong kho, không trắng lớp.
  const store = rateStores[rule.bucket];
  if (!allowRequest(store, phone, Date.now(), rule.rate)) {
    return deny(429, "rate_limited");
  }
  return NextResponse.next();
}

// ── ĐỆM trong bộ nhớ instance (Vercel nhiều instance, mỗi cái đệm riêng) ──
const IDENTITY_TTL = 10 * 60 * 1000;
const TIER_TTL = 5 * 60 * 1000;
const CACHE_MAX = 5000;
const identityCache = new Map<string, { phone: string; exp: number }>();
const tierCache = new Map<string, { tier: string; exp: number }>();
const rateStores: Record<DataRouteRule["bucket"], RateStore> = {
  fish: new Map(),
  data: new Map(),
  tiles: new Map(),
};

const inflightIdentity = new Map<string, Promise<Awaited<ReturnType<typeof tokenIdentity>>>>();
function dedupedIdentity(token: string, request: NextRequest) {
  let p = inflightIdentity.get(token);
  if (!p) {
    p = tokenIdentity(request).finally(() => inflightIdentity.delete(token));
    inflightIdentity.set(token, p);
  }
  return p;
}

/** Đệm chuỗi → SĐT (KHÔNG phải sổ danh tính máy — lib/offline-identity mới là chỗ đó). */
function cacheTokenPhone(token: string, phone: string): void {
  if (identityCache.size >= CACHE_MAX) {
    const oldest = identityCache.keys().next().value;
    if (oldest !== undefined) identityCache.delete(oldest);
  }
  identityCache.set(token, { phone, exp: Date.now() + IDENTITY_TTL });
}

async function cachedTier(phone: string): Promise<string> {
  const hit = tierCache.get(phone);
  if (hit && hit.exp > Date.now()) return hit.tier;
  const admin = createAdminClient();
  if (!admin) return "unavailable";
  const { data, error } = await admin
    .from("customers")
    .select("tier, premium_until")
    .eq("phone", phone)
    .maybeSingle();
  // KHÔNG tra được ≠ chưa premium. 503 để máy giữ nguyên dấu đã lưu và thử lại.
  if (error) {
    console.error("[data-gate] tra hạng HỎNG:", error.code, error.message);
    return "unavailable";
  }
  const tier = resolveTier(data?.tier, data?.premium_until, Date.now());
  if (tierCache.size >= CACHE_MAX) {
    const oldest = tierCache.keys().next().value;
    if (oldest !== undefined) tierCache.delete(oldest);
  }
  tierCache.set(phone, { tier, exp: Date.now() + TIER_TTL });
  return tier;
}
