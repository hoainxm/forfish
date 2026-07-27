import { PORTS } from "@/data/ports";
import { fetchSeaLive } from "@/lib/sea";
import { fetchForecastGridLive } from "@/lib/forecast-grid";
import { saveWeatherSnapshot } from "@/lib/weather-snapshot";
import {
  seaSnapshotId,
  gridSnapshotId,
  SNAPSHOT_GRID_DAYS,
} from "@/lib/weather-snapshot-id";

/**
 * CRON PRECOMPUTE thời tiết Open-Meteo — LƯỚI AN TOÀN (2026-07-26).
 *
 * KHÁC dự báo cá (snapshot là CHÍNH): Open-Meteo nhanh + ổn định nên client vẫn
 * gọi LIVE trực tiếp (tải phân tán theo IP từng máy — tốt cho rate-limit).
 * Snapshot này CHỈ để lùi về khi live lỗi và máy chưa có bản localStorage.
 *
 * Tải: dự báo biển 10 cảng (đủ 16 ngày — client vốn đã tải đủ) + lưới Windy CHỈ
 * khung MIỄN PHÍ d3 (khung premium không snapshot công khai, kẻo lộ). Bảo vệ
 * bằng `CRON_SECRET` (dùng chung với refresh-fish).
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

  let seaOk = 0;
  let seaFail = 0;
  // Tuần tự cho khỏi dội Open-Meteo (10 cảng + 1 lưới, mỗi lịch một lần)
  for (const port of PORTS) {
    try {
      const days = await fetchSeaLive(port);
      if (await saveWeatherSnapshot(seaSnapshotId(port.id), days)) seaOk++;
      else seaFail++;
    } catch {
      seaFail++;
    }
  }

  let gridOk = false;
  try {
    const grid = await fetchForecastGridLive(SNAPSHOT_GRID_DAYS);
    gridOk = await saveWeatherSnapshot(gridSnapshotId(SNAPSHOT_GRID_DAYS), grid);
  } catch {
    gridOk = false;
  }

  return Response.json({
    ok: seaOk > 0 || gridOk,
    sea: { ok: seaOk, failed: seaFail, total: PORTS.length },
    grid: { d: SNAPSHOT_GRID_DAYS, ok: gridOk },
  });
}
