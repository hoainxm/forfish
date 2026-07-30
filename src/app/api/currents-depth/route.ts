import { fetchCurDepthGrid } from "@/lib/copernicus-cur-depth";
import {
  CUR_DEPTH_TIERS,
  CUR_DEPTH_MAX_DAYS,
  type CurDepthTier,
} from "@/lib/weather-snapshot-id";
import { createClient } from "@/lib/supabase/server";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";
import { resolveTier } from "@/lib/tier";

/**
 * DÒNG CHẢY THEO TẦNG — đường LIVE khi snapshot chưa có (client đi snapshot
 * TRƯỚC, route này là nấc sau). Server fetch Copernicus phy-cur P1D (chunk đã
 * cache 6h qua next fetch) rồi trả lưới NGÀY 156 điểm.
 *
 * PREMIUM: >3 ngày chặn thật (cùng luật /api/weather-snapshot — thời tiết >3
 * ngày là hàng premium). Demo mode (chưa cấu hình Supabase) → mở.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function premiumDenied(): Promise<{ status: number; code: string } | null> {
  const supabase = await createClient();
  if (!supabase) return null; // demo mode — mở
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) return { status: 401, code: "login_required" };
  if (isAdminPhone(email, parseAdminPhones(process.env.ADMIN_PHONES))) return null;
  const { data: cust, error } = await supabase
    .from("customers")
    .select("tier, premium_until")
    .maybeSingle();
  const tier = error
    ? "basic"
    : resolveTier(cust?.tier, cust?.premium_until, Date.now());
  return tier === "premium" ? null : { status: 403, code: "premium_required" };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tier = Number(url.searchParams.get("tier"));
  const days = Number(url.searchParams.get("days") ?? CUR_DEPTH_MAX_DAYS);
  if (!CUR_DEPTH_TIERS.includes(tier as CurDepthTier)) {
    return Response.json({ ok: false, code: "bad_tier" }, { status: 400 });
  }
  if (![3, CUR_DEPTH_MAX_DAYS].includes(days)) {
    return Response.json({ ok: false, code: "bad_days" }, { status: 400 });
  }
  if (days > 3) {
    const denied = await premiumDenied();
    if (denied) {
      return Response.json(
        { ok: false, code: denied.code },
        { status: denied.status },
      );
    }
  }

  const grid = await fetchCurDepthGrid(tier, days);
  if (!grid) {
    return Response.json({ ok: false, code: "source_down" }, { status: 503 });
  }
  return Response.json(
    { ok: true, savedAt: Date.now(), ...grid },
    {
      headers: {
        // nguồn theo NGÀY — cache tư nhân 1h là đủ; khung premium không để CDN chung
        "Cache-Control": days > 3 ? "private, max-age=3600" : "public, s-maxage=3600",
      },
    },
  );
}
