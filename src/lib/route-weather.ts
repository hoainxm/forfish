// Trục 1 — adapter dự báo cho DẪN ĐƯỜNG: lưới thời tiết THÔ phủ vùng tính
// toán (≤ ~120 điểm/lượt, theo GIỜ, 72h, kèm HƯỚNG sóng/gió), thuật toán
// nội suy xuống lưới tìm đường mịn hơn (sampleField trong route-plan.ts).
// Nguồn: Open-Meteo (miễn phí, không key) — đổi nguồn chỉ sửa file này.

import type {
  BBox,
  HourSample,
  WeatherCellSeries,
  WeatherField,
} from "@/lib/route-plan";

// 72 giờ — đủ cho chuyến dài quanh mũi đất; route-plan giữ giờ cuối khi hơn
const FORECAST_DAYS = 3;
// lưới thô tối đa ~12×10 = 120 điểm một lượt gọi (đã thử thực tế với
// Open-Meteo, trả đủ 120 vị trí × 72 giờ)
const MAX_AXIS = 12;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

type RawLocation = {
  hourly?: {
    wind_speed_10m?: unknown[];
    wind_direction_10m?: unknown[];
    wave_height?: unknown[];
    wave_direction?: unknown[];
    ocean_current_velocity?: unknown[];
    ocean_current_direction?: unknown[];
  };
};

/** Toạ độ các mắt lưới thô cho một bbox — lat tăng trước, lon tăng sau */
export function fieldGrid(bbox: BBox): {
  lats: number[];
  lons: number[];
} {
  const span = (a: number, b: number) => Math.max(1e-6, b - a);
  const nLat = Math.min(
    MAX_AXIS,
    Math.max(4, Math.round(span(bbox.latMin, bbox.latMax) / 0.35) + 1),
  );
  const nLon = Math.min(
    MAX_AXIS - 2,
    Math.max(4, Math.round(span(bbox.lonMin, bbox.lonMax) / 0.35) + 1),
  );
  const lats = Array.from(
    { length: nLat },
    (_, i) => bbox.latMin + (span(bbox.latMin, bbox.latMax) * i) / (nLat - 1),
  );
  const lons = Array.from(
    { length: nLon },
    (_, j) => bbox.lonMin + (span(bbox.lonMin, bbox.lonMax) * j) / (nLon - 1),
  );
  return { lats, lons };
}

/**
 * Ghép JSON gió + sóng thành WeatherField. Ô không có số sóng nào →
 * onSea=false (đất liền) — cùng cách nhận biết đất với marine-weather.ts.
 */
export function parseWeatherField(
  wind: RawLocation[],
  wave: RawLocation[],
  lats: number[],
  lons: number[],
): WeatherField {
  const cells: WeatherCellSeries[] = [];
  for (let i = 0; i < lats.length; i++) {
    for (let j = 0; j < lons.length; j++) {
      const k = i * lons.length + j;
      const speeds = wind[k]?.hourly?.wind_speed_10m ?? [];
      const dirs = wind[k]?.hourly?.wind_direction_10m ?? [];
      const waves = wave[k]?.hourly?.wave_height ?? [];
      const waveDirs = wave[k]?.hourly?.wave_direction ?? [];
      const curVels = wave[k]?.hourly?.ocean_current_velocity ?? [];
      const curDirs = wave[k]?.hourly?.ocean_current_direction ?? [];
      const hours: HourSample[] = speeds.map((s, t) => ({
        waveM: num(waves[t]),
        waveFromDeg: num(waveDirs[t]),
        windKmh: num(s) ?? 0,
        windFromDeg: num(dirs[t]) ?? 0,
        // dòng chảy: km/h, hướng CHẢY TỚI (chuẩn hải dương — nguồn SMOC có
        // cả dòng triều; kém chính xác sát bờ, đã ghi trong copy)
        currentKmh: num(curVels[t]) ?? 0,
        currentToDeg: num(curDirs[t]),
      }));
      cells.push({ onSea: waves.some((v) => num(v) != null), hours });
    }
  }
  return {
    lat0: lats[0],
    lon0: lons[0],
    dLat: lats.length > 1 ? lats[1] - lats[0] : 1,
    dLon: lons.length > 1 ? lons[1] - lons[0] : 1,
    nLat: lats.length,
    nLon: lons.length,
    cells,
  };
}

/** Lưới thời tiết 72 giờ phủ bbox — 2 lượt gọi cho mọi mắt lưới */
export async function fetchWeatherField(bbox: BBox): Promise<WeatherField> {
  const { lats, lons } = fieldGrid(bbox);
  // Open-Meteo nhận danh sách vị trí: nhân chéo lat×lon thành danh sách phẳng
  const latList: number[] = [];
  const lonList: number[] = [];
  for (const la of lats)
    for (const lo of lons) {
      latList.push(la);
      lonList.push(lo);
    }
  const common =
    `latitude=${latList.map((v) => v.toFixed(3)).join(",")}` +
    `&longitude=${lonList.map((v) => v.toFixed(3)).join(",")}` +
    `&timezone=Asia%2FHo_Chi_Minh&forecast_days=${FORECAST_DAYS}`;

  const [windRes, waveRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?${common}&hourly=wind_speed_10m,wind_direction_10m`,
    ),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_direction,ocean_current_velocity,ocean_current_direction`,
    ),
  ]);
  if (!windRes.ok || !waveRes.ok) {
    throw new Error("Không lấy được dự báo cho tuyến");
  }
  const norm = (j: unknown): RawLocation[] =>
    Array.isArray(j) ? (j as RawLocation[]) : [j as RawLocation];
  return parseWeatherField(
    norm(await windRes.json()),
    norm(await waveRes.json()),
    lats,
    lons,
  );
}
