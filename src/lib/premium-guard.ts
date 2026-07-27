import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";
import { resolveTier } from "@/lib/tier";

// Chốt THẬT ở server cho tính năng PREMIUM ngoài /api/fish-forecast (chặn ở
// middleware). Cảnh báo thuyền viên chỉ mở cho premium — dùng guard này trong
// route. Admin (env ADMIN_PHONES) xem như premium (khỏi tự gán hạng cho mình).
// Chưa cấu hình Supabase (demo mode) → 503: kho cảnh báo cần DB thật.

export async function requirePremiumUser(): Promise<
  | { ok: true; phone: string }
  | { ok: false; status: number; code: string }
> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, status: 503, code: "not_configured" };

  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) return { ok: false, status: 401, code: "login_required" };
  const phone = email.split("@")[0];

  if (isAdminPhone(email, parseAdminPhones(process.env.ADMIN_PHONES))) {
    return { ok: true, phone };
  }

  // Hạng của CHÍNH MÌNH — RLS own-phone (0002) + cột tier/premium_until (0003).
  // Lỗi/chưa apply → 'basic' (fail-closed, khớp resolveTier).
  const { data: cust, error } = await supabase
    .from("customers")
    .select("tier, premium_until")
    .maybeSingle();
  const tier = error
    ? "basic"
    : resolveTier(cust?.tier, cust?.premium_until, Date.now());
  if (tier !== "premium") return { ok: false, status: 403, code: "premium_required" };
  return { ok: true, phone };
}
