// Trục 1 — adapter dự báo cho DẪN ĐƯỜNG: gió + sóng THEO GIỜ cho nhiều điểm
// trong MỘT lần gọi (Open-Meteo nhận danh sách tọa độ cách nhau dấu phẩy).
// Nguồn: Open-Meteo (miễn phí, không key) — đổi nguồn chỉ sửa file này,
// thuật toán tìm đường (route-plan.ts) không đụng tới.

import type { HourSample, LatLon, RouteCell } from "@/lib/route-plan";

// 48 giờ — đủ cho chuyến chạy tới ngư trường; route-plan tự giữ giờ cuối
// khi chuyến dài hơn dự báo
const FORECAST_DAYS = 2;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

type RawLocation = {
  hourly?: {
    wind_speed_10m?: unknown[];
    wind_direction_10m?: unknown[];
    wave_height?: unknown[];
  };
};

/**
 * Ghép JSON gió + sóng (mỗi cái là mảng kết quả theo điểm) thành RouteCell[]
 * đúng thứ tự `points`. Điểm không có số sóng nào → onSea=false (đất liền),
 * thuật toán sẽ né — cùng cách nhận biết đất với marine-weather.ts.
 */
export function parseRouteWeather(
  wind: RawLocation[],
  wave: RawLocation[],
  points: LatLon[],
): RouteCell[] {
  return points.map((point, i) => {
    const speeds = wind[i]?.hourly?.wind_speed_10m ?? [];
    const dirs = wind[i]?.hourly?.wind_direction_10m ?? [];
    const waves = wave[i]?.hourly?.wave_height ?? [];
    const hours: HourSample[] = speeds.map((s, k) => ({
      waveM: num(waves[k]),
      windKmh: num(s) ?? 0,
      windFromDeg: num(dirs[k]) ?? 0,
    }));
    const onSea = waves.some((v) => num(v) != null);
    return { point, onSea, hours };
  });
}

/** Dự báo 48 giờ cho cả lưới hành lang tuyến — 2 lượt gọi cho mọi điểm */
export async function fetchRouteWeather(
  points: LatLon[],
): Promise<RouteCell[]> {
  const lats = points.map((p) => p.lat.toFixed(3)).join(",");
  const lons = points.map((p) => p.lon.toFixed(3)).join(",");
  const common = `latitude=${lats}&longitude=${lons}&timezone=Asia%2FHo_Chi_Minh&forecast_days=${FORECAST_DAYS}`;

  const [windRes, waveRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?${common}&hourly=wind_speed_10m,wind_direction_10m`,
    ),
    fetch(`https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height`),
  ]);
  if (!windRes.ok || !waveRes.ok) {
    throw new Error("Không lấy được dự báo cho tuyến");
  }
  // 1 điểm → object, nhiều điểm → mảng; chuẩn hoá về mảng
  const norm = (j: unknown): RawLocation[] =>
    Array.isArray(j) ? (j as RawLocation[]) : [j as RawLocation];
  return parseRouteWeather(
    norm(await windRes.json()),
    norm(await waveRes.json()),
    points,
  );
}
