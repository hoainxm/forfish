// Trục 1 — LƯỚI DỰ BÁO VẼ LÊN BẢN ĐỒ (kiểu Windy): gió / sóng theo GIỜ,
// 3 ngày tới, kéo thanh thời gian là cả vùng biển đổi theo.
//
// Nguồn: Open-Meteo (miễn phí, không key) — một lượt gọi lấy ~80 điểm lưới
// phủ vùng biển VN, mỗi điểm 96 giờ. Quy tắc adapter: đổi nguồn chỉ sửa
// fetchForecastGrid, phần dựng hình (arrowFeatures) là logic thuần test được.

export type ForecastKind = "wind" | "wave";

export interface GridHour {
  windKmh: number | null;
  windDirDeg: number | null; // hướng gió THỔI TỪ (chuẩn khí tượng)
  waveM: number | null;
  waveDirDeg: number | null; // hướng sóng TỚI TỪ
}

export interface GridCell {
  lat: number;
  lon: number;
  hours: GridHour[];
}

export interface ForecastGrid {
  cells: GridCell[];
  /** mốc giờ ISO (giờ VN), dùng chung cho mọi cell */
  times: string[];
}

/** Bước nhảy của thanh thời gian: 3 giờ một nấc, 3 ngày = 24 nấc */
export const TIME_STEP_HOURS = 3;
export const FORECAST_GRID_HOURS = 72;

// Lưới phủ vùng đánh bắt VN — thưa (≈2°) vì mỗi mũi tên đại diện cả ô lớn;
// Open-Meteo nhận tối đa ~120 điểm/lượt nên giữ 8×10 = 80.
const LON_MIN = 102.5;
const LON_MAX = 117.25;
const LAT_MIN = 6.0;
const LAT_MAX = 21.3;
const N_LON = 8;
const N_LAT = 10;

/** Toạ độ các điểm lưới — xuất riêng để test */
export function gridPoints(): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i < N_LAT; i++) {
    for (let j = 0; j < N_LON; j++) {
      pts.push({
        lat: Math.round((LAT_MIN + (i * (LAT_MAX - LAT_MIN)) / (N_LAT - 1)) * 100) / 100,
        lon: Math.round((LON_MIN + (j * (LON_MAX - LON_MIN)) / (N_LON - 1)) * 100) / 100,
      });
    }
  }
  return pts;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export async function fetchForecastGrid(): Promise<ForecastGrid> {
  const pts = gridPoints();
  const lats = pts.map((p) => p.lat).join(",");
  const lons = pts.map((p) => p.lon).join(",");
  const common = `latitude=${lats}&longitude=${lons}&timezone=Asia%2FHo_Chi_Minh&forecast_days=4`;

  // Timeout 15s: mạng ngoài khơi chập chờn — thà báo lỗi rõ còn hơn treo UI
  const [windRes, waveRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?${common}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`,
      { signal: AbortSignal.timeout(15000) },
    ).then((r) => {
      if (!r.ok) throw new Error(`wind grid ${r.status}`);
      return r.json();
    }),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_direction`,
      { signal: AbortSignal.timeout(15000) },
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const windArr: unknown[] = Array.isArray(windRes) ? windRes : [windRes];
  const waveArr: unknown[] = Array.isArray(waveRes)
    ? waveRes
    : waveRes
      ? [waveRes]
      : [];

  const nSteps = Math.floor(FORECAST_GRID_HOURS / TIME_STEP_HOURS);
  const first = windArr[0] as { hourly?: { time?: string[] } };
  const allTimes: string[] = first?.hourly?.time ?? [];
  const times: string[] = [];
  for (let s = 0; s < nSteps && s * TIME_STEP_HOURS < allTimes.length; s++) {
    times.push(allTimes[s * TIME_STEP_HOURS]);
  }

  const cells: GridCell[] = pts.map((p, idx) => {
    const w = windArr[idx] as {
      hourly?: {
        wind_speed_10m?: unknown[];
        wind_direction_10m?: unknown[];
      };
    };
    const v = waveArr[idx] as
      | { hourly?: { wave_height?: unknown[]; wave_direction?: unknown[] } }
      | undefined;
    const hours: GridHour[] = times.map((_, s) => {
      const h = s * TIME_STEP_HOURS;
      return {
        windKmh: num(w?.hourly?.wind_speed_10m?.[h]),
        windDirDeg: num(w?.hourly?.wind_direction_10m?.[h]),
        waveM: num(v?.hourly?.wave_height?.[h]),
        waveDirDeg: num(v?.hourly?.wave_direction?.[h]),
      };
    });
    return { lat: p.lat, lon: p.lon, hours };
  });

  return { cells, times };
}

/* ---------------------------------------------------------------------------
   Dựng mũi tên GeoJSON — logic thuần, test được.
   Mũi tên chỉ HƯỚNG ĐI của gió/sóng (nguồn cho hướng-tới-từ → cộng 180°).
--------------------------------------------------------------------------- */

const SHAFT_DEG = 0.55; // chiều dài thân mũi tên (độ) — hợp với lưới ~2°
const HEAD_DEG = 0.2;

function destPoint(
  lon: number,
  lat: number,
  bearingDeg: number,
  distDeg: number,
): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  // xấp xỉ phẳng: đủ chính xác cho hình vẽ vài chục km
  const dLat = Math.cos(rad) * distDeg;
  const dLon =
    (Math.sin(rad) * distDeg) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return [
    Math.round((lon + dLon) * 10000) / 10000,
    Math.round((lat + dLat) * 10000) / 10000,
  ];
}

/**
 * FeatureCollection mũi tên cho một mốc thời gian.
 * properties.v = độ lớn (km/h với gió, mét với sóng) để tô màu data-driven.
 * Cell thiếu dữ liệu (đất liền với sóng) thì bỏ qua.
 */
export function arrowFeatures(
  grid: ForecastGrid,
  timeIdx: number,
  kind: ForecastKind,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const c of grid.cells) {
    const h = c.hours[timeIdx];
    if (!h) continue;
    const mag = kind === "wind" ? h.windKmh : h.waveM;
    const fromDeg = kind === "wind" ? h.windDirDeg : h.waveDirDeg;
    if (mag == null || fromDeg == null) continue;

    const toDeg = (fromDeg + 180) % 360;
    // thân ngắn dài theo độ lớn một chút cho có "nhịp"
    const scale =
      kind === "wind"
        ? Math.min(1.25, 0.55 + mag / 60)
        : Math.min(1.25, 0.55 + mag / 4);
    const tail: [number, number] = [c.lon, c.lat];
    const head = destPoint(c.lon, c.lat, toDeg, SHAFT_DEG * scale);
    const barbL = destPoint(head[0], head[1], toDeg + 150, HEAD_DEG * scale);
    const barbR = destPoint(head[0], head[1], toDeg - 150, HEAD_DEG * scale);

    features.push({
      type: "Feature",
      properties: { v: mag },
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [tail, head],
          [head, barbL],
          [head, barbR],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/*
  Thang màu mũi tên (màu nội dung bản đồ, không phải token UI):
  xanh dịu = êm → vàng/cam = chú ý → đỏ = dữ. Ngưỡng khớp với mức cảnh báo
  của scoreDay/route-plan (gió 39 km/h ~ cấp 6, sóng 2,5 m = dữ).
*/
export const WIND_COLOR_EXPR = [
  "interpolate",
  ["linear"],
  ["get", "v"],
  5, "#74add1",
  20, "#3d7fb5",
  30, "#e8b339",
  39, "#e06c1f",
  55, "#b71d1d",
] as const;

export const WAVE_COLOR_EXPR = [
  "interpolate",
  ["linear"],
  ["get", "v"],
  0.3, "#74add1",
  1.0, "#3d7fb5",
  1.5, "#e8b339",
  2.5, "#e06c1f",
  4.0, "#b71d1d",
] as const;

const WD_SHORT = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];

/** "2026-06-12T13:00" → "Th 6 12/6 · 13h" (hôm nay/mai nói thẳng) */
export function timeLabelVN(iso: string, todayIso?: string): string {
  const [datePart, timePart] = iso.split("T");
  const [, m, d] = datePart.split("-");
  const hour = timePart?.slice(0, 2) ?? "00";
  let dayName: string;
  if (todayIso && datePart === todayIso) {
    dayName = "Hôm nay";
  } else {
    const dt = new Date(`${datePart}T12:00:00Z`);
    dayName = `${WD_SHORT[dt.getUTCDay()]} ${Number(d)}/${Number(m)}`;
  }
  return `${dayName} · ${Number(hour)}h`;
}
