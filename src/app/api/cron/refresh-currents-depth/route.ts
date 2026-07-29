import { fetchCurDepthGrid, sliceCurDepthDays } from "@/lib/copernicus-cur-depth";
import { saveWeatherSnapshot } from "@/lib/weather-snapshot";
import {
  CUR_DEPTH_TIERS,
  CUR_DEPTH_MAX_DAYS,
  curDepthSnapshotId,
} from "@/lib/weather-snapshot-id";

/**
 * CRON PRECOMPUTE dòng chảy THEO TẦNG (2026-07-29) — nguồn Copernicus phy-cur
 * P1D chỉ ra bản MỚI 1 lần/ngày nên cron chạy 2 lần/ngày là dư dả (GH Actions
 * refresh-currents-depth.yml). Mỗi tầng ~9 ngày × 2 biến × 1,37 MB ≈ 25 MB —
 * 4 tầng ≈ 99 MB/lượt, chạy TUẦN TỰ theo tầng (chunk đã song song trong ngày).
 *
 * Ghi 2 bản mỗi tầng: d10 (premium) + d3 cắt từ chính nó (miễn phí) — client
 * đọc qua /api/weather-snapshot (chặn premium sẵn). Tầng 0 (mặt, trung bình
 * ngày) còn được cron refresh-weather đọc làm VÉT CUỐI cho dòng chảy mặt của
 * lưới Windy khi SMOC chết (đủ ~10 ngày thay vì chỉ hôm nay).
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
  const savedAt = Date.now();
  const tiers: Record<number, boolean> = {};
  for (const tier of CUR_DEPTH_TIERS) {
    try {
      const grid = await fetchCurDepthGrid(tier, CUR_DEPTH_MAX_DAYS);
      if (!grid) {
        tiers[tier] = false;
        continue;
      }
      const okFull = await saveWeatherSnapshot(
        curDepthSnapshotId(tier, CUR_DEPTH_MAX_DAYS),
        { savedAt, ...grid },
      );
      const okFree = await saveWeatherSnapshot(curDepthSnapshotId(tier, 3), {
        savedAt,
        ...sliceCurDepthDays(grid, 3),
      });
      tiers[tier] = okFull && okFree;
    } catch {
      tiers[tier] = false;
    }
  }
  return Response.json({
    ok: Object.values(tiers).some(Boolean),
    tiers,
  });
}
