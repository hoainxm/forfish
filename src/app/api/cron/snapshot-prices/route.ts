import { gatherArchiveWeeks } from "@/lib/port-price-archive";
import { saveWeeksToDb } from "@/lib/price-history-store";

/**
 * CRON TÍCH LUỸ LỊCH SỬ GIÁ (2026-07-29). Gom các tuần giá VASEP (Khánh Hòa)
 * rồi UPSERT vào bảng `price_history` (idempotent theo (week_end, species_id)).
 * Lần đầu backfill ~13 tuần; mỗi tuần sau thêm bản mới → lịch sử dài dần, kể cả
 * khi tuần cũ đã rơi khỏi listing VASEP.
 *
 * Chạy bởi VERCEL CRON (vercel.json, `0 3 * * 6` — thứ Bảy). Vercel Cron TỰ
 * gắn `Authorization: Bearer <CRON_SECRET>` khi env CRON_SECRET đã đặt.
 * BẢO VỆ bằng `CRON_SECRET` — chưa đặt secret → CẤM HẲN (401). Chưa cấu hình
 * Supabase → saveWeeksToDb báo no-admin-client (không lỗi), cron trả saved:0.
 * ⚠️ Cron thứ 3 của dự án → Hobby chỉ cho 2, cần Vercel Pro.
 */
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
  const weeks = await gatherArchiveWeeks();
  if (weeks.length === 0) {
    return Response.json({ ok: false, reason: "no-weeks-from-source" });
  }
  const result = await saveWeeksToDb(weeks);
  return Response.json({
    ok: result.saved > 0,
    weeks: weeks.length,
    rows: result.saved,
    reason: result.reason,
  });
}
