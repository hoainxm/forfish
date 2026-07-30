import { loadWeatherSnapshot } from "@/lib/weather-snapshot";
import {
  isValidSnapshotId,
  snapshotNeedsPremium,
} from "@/lib/weather-snapshot-id";
import { createClient } from "@/lib/supabase/server";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";
import { resolveTier } from "@/lib/tier";

/**
 * ĐỌC snapshot thời tiết (LƯỚI AN TOÀN) — client gọi khi live Open-Meteo lỗi.
 *
 * Khung MIỄN PHÍ (d3) + dự báo theo cảng: PUBLIC — dữ liệu thời tiết không cá
 * nhân, client vốn tải được từ live nên không lộ thêm gì.
 *
 * Khung PREMIUM (>3 ngày, từ 2026-07-29 cron có snapshot d16): CHẶN THẬT ở đây
 * — 401 chưa đăng nhập · 403 chưa premium, cùng luật middleware /api/fish-forecast
 * (admin theo ADMIN_PHONES xem như premium). Demo mode (chưa cấu hình Supabase)
 * → MỞ, khớp triết lý app: thiếu env thì chạy được hết bằng dữ liệu công khai.
 *
 * Whitelist id để không thành proxy đọc bảng tuỳ ý.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 15;

async function premiumDenied(): Promise<{ status: number; code: string } | null> {
  const supabase = await createClient();
  if (!supabase) return null; // demo mode — mở
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) return { status: 401, code: "login_required" };
  if (isAdminPhone(email, parseAdminPhones(process.env.ADMIN_PHONES))) return null;
  // Hạng của CHÍNH MÌNH (RLS own-phone); lỗi/chưa migrate → basic (fail-closed)
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
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!isValidSnapshotId(id)) {
    return Response.json({ ok: false, code: "bad_id" }, { status: 400 });
  }

  const needsPremium = snapshotNeedsPremium(id);
  if (needsPremium) {
    const denied = await premiumDenied();
    if (denied) {
      return Response.json(
        { ok: false, code: denied.code },
        { status: denied.status },
      );
    }
  }

  const payload = await loadWeatherSnapshot(id);
  if (payload == null) {
    return Response.json({ ok: false, code: "not_found" }, { status: 404 });
  }
  // Khung miễn phí: CDN + SW cache theo id (thời tiết đổi chậm, cron 1 lần/ngày).
  // Khung premium: `private` — không để CDN dùng chung bản đã qua cửa cho người khác.
  return Response.json(payload, {
    headers: {
      "Cache-Control": needsPremium
        ? "private, max-age=1800"
        : "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
