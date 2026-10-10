import { computeFishForecast } from "@/lib/fish-forecast-run";
import { getCronSecret } from "@/lib/app-config";
import { saveFishSnapshot } from "@/lib/fish-snapshot";
import { createAdminClient } from "@/lib/supabase/admin";
import { vnToday } from "@/lib/sea-history";
import { ARCHIVE_CONCURRENCY, archivePath, mapPool, putArchive, summarizePuts } from "@/lib/forecast-archive";

/**
 * CRON PRECOMPUTE dự báo cá (2026-07-26). Tính bản đồ cá server-side rồi GHI
 * snapshot Supabase để /api/fish-forecast chỉ việc ĐỌC (nhanh, không phụ thuộc
 * nguồn treo). Gọi bởi: GitHub Actions (cron 6h) + Vercel cron (vercel.json).
 *
 * BẢO VỆ bằng `CRON_SECRET` (header `Authorization: Bearer <secret>`) — cả hai
 * đều gửi được; Vercel Cron TỰ gắn header này khi env `CRON_SECRET` đã đặt.
 * Chưa đặt secret → CẤM HẲN (401), khỏi bị gọi bừa từ ngoài.
 */

// Tính thật kéo nguồn 14–30s → 60s, +30s cho phần lưu trữ lưới đầu vào (2026-10-10,
// ~8 file nén vài MB) = 90s. Dynamic: KHÔNG cache (mỗi lần lịch chạy là một lần tính mới).
export const maxDuration = 90;
export const dynamic = "force-dynamic";

async function authorized(req: Request): Promise<boolean> {
  const secret = await getCronSecret();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!(await authorized(req))) {
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  let inputs: Record<string, unknown> | null = null;
  const payload = await computeFishForecast({ onInputs: (x) => (inputs = x) });
  const result = await saveFishSnapshot(payload);
  // LƯU TRỮ lưới đầu vào (2026-10-10) mỗi lần tính được — kể cả khi snapshot không bị thay
  // (ảnh chưa mới hơn): bỏ thì có ngày kho trống. `saved` cho biết bản này app có phát không.
  // Ghi hỏng không ảnh hưởng snapshot (putArchive không ném).
  let archive: ReturnType<typeof summarizePuts> | null = null;
  const admin = payload.ok === true && inputs ? createAdminClient() : null;
  if (admin && inputs) {
    const day = vnToday(new Date());
    const meta = { saved: result.saved, targetDate: payload.ok === true ? (payload.targetDate ?? null) : null };
    const puts = await mapPool(Object.entries(inputs as Record<string, object>), ARCHIVE_CONCURRENCY, ([k, r]) =>
      putArchive(admin, archivePath("fish-inputs", day, k), { field: k, ...meta, ...r }),
    );
    archive = summarizePuts(puts);
  }
  return Response.json({
    archive,
    ok: payload.ok === true,
    saved: result.saved,
    reason: result.reason,
    targetDate: payload.ok === true ? (payload.targetDate ?? null) : null,
    dataQuality: payload.ok === true ? (payload.dataQuality ?? null) : null,
  });
}
