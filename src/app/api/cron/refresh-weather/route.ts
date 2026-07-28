import { PORTS } from "@/data/ports";
import { fetchSeaLive } from "@/lib/sea";
import { fetchForecastGridLive } from "@/lib/forecast-grid";
import { fetchScalarFieldsLive, type OMKind } from "@/lib/scalar-field";
import { saveWeatherSnapshot } from "@/lib/weather-snapshot";
import {
  seaSnapshotId,
  gridSnapshotId,
  scalarSnapshotId,
  SNAPSHOT_DAY_SET,
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

  // Lưới gió/sóng + 5 lớp DẢI MÀU, cho CẢ khung miễn phí (d3) LẪN khung premium
  // (d16) — 2026-07-29: màn Ra khơi tự đặt tầm theo hạng nên premium luôn xin
  // d16; không snapshot d16 thì họ không bao giờ có lưới an toàn khi nguồn lỗi.
  // Tuần tự cho khỏi dội Open-Meteo. Khung premium được CHẶN THẬT lúc ĐỌC.
  const gridOk: Record<number, boolean> = {};
  const scalarOk: Record<number, number> = {};
  for (const days of SNAPSHOT_DAY_SET) {
    try {
      const grid = await fetchForecastGridLive(days);
      gridOk[days] = await saveWeatherSnapshot(gridSnapshotId(days), grid);
    } catch {
      gridOk[days] = false;
    }
    let n = 0;
    try {
      const fields = await fetchScalarFieldsLive(days);
      for (const kind of Object.keys(fields) as OMKind[]) {
        if (await saveWeatherSnapshot(scalarSnapshotId(kind, days), fields[kind]))
          n++;
      }
    } catch {
      n = 0;
    }
    scalarOk[days] = n;
  }

  const anyGrid = Object.values(gridOk).some(Boolean);
  const anyScalar = Object.values(scalarOk).some((n) => n > 0);
  return Response.json({
    ok: seaOk > 0 || anyGrid || anyScalar,
    sea: { ok: seaOk, failed: seaFail, total: PORTS.length },
    grid: gridOk,
    scalar: { ok: scalarOk, perDay: 5 },
  });
}
