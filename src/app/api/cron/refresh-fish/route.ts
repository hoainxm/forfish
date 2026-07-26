import { computeFishForecast } from "@/lib/fish-forecast-run";
import { saveFishSnapshot } from "@/lib/fish-snapshot";

/**
 * CRON PRECOMPUTE dự báo cá (2026-07-26). Tính bản đồ cá server-side rồi GHI
 * snapshot Supabase để /api/fish-forecast chỉ việc ĐỌC (nhanh, không phụ thuộc
 * nguồn treo). Gọi bởi: GitHub Actions (cron 6h) + Vercel cron (vercel.json).
 *
 * BẢO VỆ bằng `CRON_SECRET` (header `Authorization: Bearer <secret>`) — cả hai
 * đều gửi được; Vercel Cron TỰ gắn header này khi env `CRON_SECRET` đã đặt.
 * Chưa đặt secret → CẤM HẲN (401), khỏi bị gọi bừa từ ngoài.
 */

// Tính thật kéo nguồn 14–30s → giữ 60s. Dynamic: KHÔNG cache (mỗi lần lịch chạy
// là một lần tính mới).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const payload = await computeFishForecast();
  const result = await saveFishSnapshot(payload);
  return Response.json({
    ok: payload.ok === true,
    saved: result.saved,
    reason: result.reason,
    targetDate: payload.ok === true ? (payload.targetDate ?? null) : null,
    dataQuality: payload.ok === true ? (payload.dataQuality ?? null) : null,
  });
}
