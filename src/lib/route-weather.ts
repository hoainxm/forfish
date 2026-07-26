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
    wave_period?: unknown[];
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
      const wavePeriods = wave[k]?.hourly?.wave_period ?? [];
      const curVels = wave[k]?.hourly?.ocean_current_velocity ?? [];
      const curDirs = wave[k]?.hourly?.ocean_current_direction ?? [];
      const hours: HourSample[] = speeds.map((s, t) => ({
        waveM: num(waves[t]),
        waveFromDeg: num(waveDirs[t]),
        wavePeriodS: num(wavePeriods[t]),
        windKmh: num(s) ?? 0,
        windFromDeg: num(dirs[t]) ?? 0,
        // dòng chảy: km/h, hướng CHẢY TỚI (chuẩn hải dương — nguồn SMOC có
        // cả dòng triều; kém chính xác sát bờ, đã ghi trong copy)
        currentKmh: num(curVels[t]) ?? 0,
        currentToDeg: num(curDirs[t]),
      }));
      // onSea đòi CẢ số sóng LẪN có giờ gió: ô có sóng mà hours rỗng (nguồn
      // gió trả thiếu vị trí) sẽ làm hourAt trả giờ-0-an-toàn → biển lặng giả
      // ngay giữa khơi. Coi là ô không dữ liệu (như đất) cho nội suy bỏ qua.
      cells.push({
        onSea: hours.length > 0 && waves.some((v) => num(v) != null),
        hours,
      });
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

// ── cache lượt gọi ───────────────────────────────────────────────────────
// Bấm "Tính lại" hoặc vòng nở khung của route-planner từng REFETCH trọn bộ
// ~0,7–1,5 MB — cache promise theo khoá bbox+ngày, TTL 45 phút (dự báo giờ
// Open-Meteo cập nhật ~mỗi giờ). Pattern promise-cache + xoá-khi-lỗi giống
// fetchDepthGrid.
const CACHE_TTL_MS = 45 * 60 * 1000;
const fieldCache = new Map<string, { at: number; field: Promise<WeatherField> }>();

/**
 * Khoá cache: bbox làm tròn 0,001° + NGÀY theo giờ VN — trục giờ của
 * WeatherField tính từ 0h HÔM NAY giờ VN, nên bản lấy trước nửa đêm mà dùng
 * sau nửa đêm sẽ lệch nguyên 24 tiếng → qua ngày là khoá mới.
 */
export function weatherFieldCacheKey(bbox: BBox, now: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(now);
  return (
    [bbox.latMin, bbox.latMax, bbox.lonMin, bbox.lonMax]
      .map((v) => v.toFixed(3))
      .join(",") + `|${day}`
  );
}

/** Lưới thời tiết 72 giờ phủ bbox — cache 45 phút, `now` truyền được để test */
export function fetchWeatherField(
  bbox: BBox,
  now: Date = new Date(),
): Promise<WeatherField> {
  const key = weatherFieldCacheKey(bbox, now);
  const hit = fieldCache.get(key);
  if (hit && now.getTime() - hit.at < CACHE_TTL_MS) return hit.field;
  // dọn bản hết hạn — phiên dài chạm nhiều nơi cũng chỉ giữ vài khung sống
  for (const [k, v] of fieldCache) {
    if (now.getTime() - v.at >= CACHE_TTL_MS) fieldCache.delete(k);
  }
  const field = fetchWeatherFieldFresh(bbox).catch((e) => {
    fieldCache.delete(key); // lỗi mạng không được găm 45 phút
    throw e;
  });
  fieldCache.set(key, { at: now.getTime(), field });
  return field;
}

async function fetchWeatherFieldFresh(bbox: BBox): Promise<WeatherField> {
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
      { signal: AbortSignal.timeout(15000) },
    ),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction`,
      { signal: AbortSignal.timeout(15000) },
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
