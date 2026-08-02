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
import {
  GRID_N_LAT,
  GRID_N_LON,
  GRID_STEP_LAT_DEG,
  GRID_STEP_LON_DEG,
  gridPoints,
  loadLongestSavedGrid,
  type ForecastGrid,
} from "@/lib/forecast-grid";
import { timeoutSignal } from "@/lib/abort";

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
    fieldCache.delete(key); // lỗi/offline không được găm 45 phút
    // OFFLINE (2026-07-28): mất sóng thì lùi về lưới Windy đã lưu sẵn (pretrip
    // tải lúc còn ở bờ) — cùng triết lý forecast-grid: KHÔNG thêm nguồn mới,
    // xài lại thứ đã có trong máy. Thô hơn + không dòng chảy, source='grid' để
    // UI nói thật. Không có lưới nào trong máy → ném lại như cũ (UI báo thiếu).
    const fb = offlineFieldFromGrid(now);
    if (fb) return fb;
    throw e;
  });
  fieldCache.set(key, { at: now.getTime(), field });
  return field;
}

// ── OFFLINE: dựng WeatherField từ lưới Windy đã lưu ─────────────────────────
// Lưới Windy (forecast-grid) đã được pretrip tải sẵn cho CẢ vùng biển VN 3/7/16
// ngày và lưu localStorage. Mất sóng, ta dựng lại WeatherField từ nó cho dẫn
// đường. Khác biệt phải nói thật: lưới ~2° (thô hơn ~0,35° của tuyến), CHỈ có
// gió + sóng (không chu kỳ sóng, không dòng chảy) — sampleField/route-plan vốn
// đã chịu được các trường null này (giảm chất lượng, vẫn an toàn nhờ lưới độ sâu
// riêng). Độ sâu vẫn né bãi cạn như thường (asset tĩnh precache trong SW).

const VN_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ymdToDays = (y: number, m: number, d: number): number =>
  Date.UTC(y, m - 1, d) / 86400000;

/**
 * Số giờ của một mốc ISO (đã ở GIỜ VN — forecast-grid gọi Open-Meteo với
 * timezone VN) so với 0h HÔM NAY giờ VN. null nếu chuỗi không parse được.
 * So sánh THEO NGÀY LỊCH nên bản lưới lưu từ hôm trước vẫn ghép đúng vào trục
 * giờ hôm nay (tránh lỗi "lệch nguyên 24h" khi đi biển nhiều ngày).
 */
export function gridHourOffsetFromToday(
  iso: string,
  today: { y: number; m: number; d: number },
): number | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(iso);
  if (!mt) return null;
  return (
    (ymdToDays(+mt[1], +mt[2], +mt[3]) - ymdToDays(today.y, today.m, today.d)) *
      24 +
    Number(mt[4])
  );
}

/**
 * Lưới Windy đã lưu → WeatherField cho dẫn đường. Trục giờ ĐẶT LẠI về 0h hôm
 * nay (khớp departHourIdx = vnHourIndex(now) của route-planner); mốc trong quá
 * khứ bị loại. Lưới toàn quá khứ → null (thà báo thiếu còn hơn dẫn theo bản cũ
 * đội lốt mới). Thuần — test được, không đụng localStorage.
 */
export function gridToWeatherField(
  grid: ForecastGrid,
  now: Date = new Date(),
  savedAt: number | null = null,
): WeatherField | null {
  const times = grid.times ?? [];
  const cells = grid.cells ?? [];
  if (times.length === 0 || cells.length === 0) return null;

  const [ty, tm, td] = VN_DATE_FMT.format(now).split("-").map(Number);
  const today = { y: ty, m: tm, d: td };

  // mốc nguồn → giờ so với 0h hôm nay; chỉ giữ HÔM NAY trở đi, xếp tăng dần
  const src: { gi: number; hour: number }[] = [];
  for (let gi = 0; gi < times.length; gi++) {
    const ho = gridHourOffsetFromToday(times[gi], today);
    if (ho == null || ho < 0) continue;
    src.push({ gi, hour: ho });
  }
  if (src.length === 0) return null; // lưới toàn quá khứ
  src.sort((a, b) => a.hour - b.hour);

  // forward-fill: mỗi giờ 0..max → chỉ số nguồn gần nhất KHÔNG vượt quá nó
  // (lưới thưa 3/6/12h; hourAt của route-plan cũng làm tròn nên khớp cách dùng)
  const maxHour = src[src.length - 1].hour;
  const fillGi = new Array<number>(maxHour + 1);
  let p = 0;
  for (let h = 0; h <= maxHour; h++) {
    while (p + 1 < src.length && src[p + 1].hour <= h) p++;
    fillGi[h] = src[p].gi;
  }

  const wfCells: WeatherCellSeries[] = cells.map((c) => {
    const gh = c.hours ?? [];
    // onSea theo CÙNG quy ước parseWeatherField: ô có số sóng = biển
    const onSea = gh.some((h) => h && h.waveM != null);
    if (!onSea) return { onSea: false, hours: [] };
    const hours: HourSample[] = new Array(maxHour + 1);
    for (let h = 0; h <= maxHour; h++) {
      const g = gh[fillGi[h]];
      hours[h] = {
        waveM: g?.waveM ?? null,
        waveFromDeg: g?.waveDirDeg ?? null,
        wavePeriodS: null, // lưới Windy không có chu kỳ sóng
        windKmh: g?.windKmh ?? 0,
        windFromDeg: g?.windDirDeg ?? 0,
        currentKmh: 0, // không có dòng chảy khi offline
        currentToDeg: null,
      };
    }
    return { onSea: true, hours };
  });

  const origin = gridPoints()[0];
  return {
    lat0: origin.lat,
    lon0: origin.lon,
    dLat: GRID_STEP_LAT_DEG,
    dLon: GRID_STEP_LON_DEG,
    nLat: GRID_N_LAT,
    nLon: GRID_N_LON,
    cells: wfCells,
    source: "grid",
    savedAt,
  };
}

/** Lấy lưới đã lưu DÀI NGÀY NHẤT trong máy → WeatherField, hoặc null nếu chưa có. */
function offlineFieldFromGrid(now: Date): WeatherField | null {
  try {
    const saved = loadLongestSavedGrid();
    if (!saved) return null;
    return gridToWeatherField(saved.grid, now, saved.savedAt);
  } catch {
    return null;
  }
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
      { signal: timeoutSignal(15000) },
    ),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction`,
      { signal: timeoutSignal(15000) },
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
