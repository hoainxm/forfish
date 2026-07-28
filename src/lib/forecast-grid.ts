// Trục 1 — LƯỚI DỰ BÁO VẼ LÊN BẢN ĐỒ (kiểu Windy): gió / sóng theo GIỜ,
// CHỌN KHUNG NGÀY 3/5/7/10/16, kéo thanh thời gian là cả vùng biển đổi theo.
//
// Nguồn: Open-Meteo (miễn phí, không key) — một lượt gọi lấy ~80 điểm lưới
// phủ vùng biển VN. Quy tắc adapter: đổi nguồn chỉ sửa fetchForecastGrid,
// phần dựng hình (arrowFeatures) là logic thuần test được.
//
// Càng xa càng thưa khung để KHÔNG phình tải/khung hình: ≤3 ngày lấy mỗi 3h,
// 4–7 ngày mỗi 6h, >7 ngày mỗi 12h. Sóng dùng model ncep_gfswave025 (best-match
// sóng theo giờ chỉ ~9 ngày; model này phủ đủ 16). Gió best-match phủ 16 ngày.
//
// OFFLINE: lấy được thì LƯU localStorage; ra biển mất mạng lùi về bản đã lưu
// (lib/forecast-cache) — kéo thanh giờ vẫn xem được lưới đã tải trước lúc đi.

import { saveForecast, loadForecast, loadAll } from "@/lib/forecast-cache";
import { apiUrl } from "@/lib/api-base";
import { gridSnapshotId, SNAPSHOT_GRID_DAYS } from "@/lib/weather-snapshot-id";

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
  /** true = bản ĐÃ LƯU (offline/mất mạng), không phải bản mới */
  stale?: boolean;
  /** epoch ms lúc lưu (chỉ có ý nghĩa khi stale) */
  savedAt?: number | null;
}

/** Bước nhảy GẦN của thanh thời gian: 3 giờ một nấc (giữ cho tầm ≤3 ngày) */
export const TIME_STEP_HOURS = 3;
export const FORECAST_GRID_HOURS = 72;

/** Các khung ngày bà con chọn được cho lớp vẽ động */
export const GRID_DAY_OPTIONS = [3, 5, 7, 10, 16] as const;
export type GridDays = (typeof GRID_DAY_OPTIONS)[number];

/** Model sóng phủ đủ 16 ngày theo giờ (best-match sóng chỉ ~9 ngày) */
const WAVE_MODEL = "ncep_gfswave025";

/**
 * Chỉ số GIỜ cho từng khung của thanh thời gian: dày (3h) ở gần, thưa dần khi
 * ra xa để chặn số khung (16 ngày ~ 50 khung thay vì 128). `availableHours` là
 * số giờ nguồn thật trả về — không lấy quá.
 */
export function stepHourIndices(days: number, availableHours: number): number[] {
  const maxH = Math.min(days * 24, Math.max(0, availableHours - 1));
  const idx: number[] = [];
  let h = 0;
  while (h <= maxH) {
    idx.push(h);
    h += h < 72 ? 3 : h < 168 ? 6 : 12;
  }
  return idx;
}

// Lưới phủ vùng lớn (98–123°Đ, 1–24°B) — MỞ RỘNG 2026-07-28 để lớp màu/gió
// KHÔNG "hụt" mép khi zoom thoải mái; thưa (~2,5°) vì là nền, mỗi mũi tên đại
// diện ô lớn. Open-Meteo nhận ~120 điểm/lượt → giữ 10×11 = 110.
const LON_MIN = 98;
const LON_MAX = 123;
const LAT_MIN = 1;
const LAT_MAX = 24;
const N_LON = 13;
const N_LAT = 12; // 13×12 = 156 điểm (~150, user 2026-07-28) · bước ~2° đều

/** Bước lưới THẬT theo từng chiều (độ) — suy từ khung trên, không gõ số rời */
export const GRID_STEP_LAT_DEG = (LAT_MAX - LAT_MIN) / (N_LAT - 1); // ≈ 1,70°
export const GRID_STEP_LON_DEG = (LON_MAX - LON_MIN) / (N_LON - 1); // ≈ 2,11°

/** Số điểm lưới mỗi chiều — export để dựng WeatherField offline cho DẪN ĐƯỜNG
    (route-weather.ts lùi về lưới này khi mất sóng). Đổi khung ở trên là đủ. */
export const GRID_N_LAT = N_LAT;
export const GRID_N_LON = N_LON;

/**
 * TRẦN SNAP = NỬA BƯỚC LƯỚI, tính RIÊNG từng chiều. Xa hơn thì ô lưới KHÔNG CÒN
 * PHỦ chỗ bà con vừa chạm → cấm lấy số của nó (chỗ chạm thuộc ô KHÁC, dán số ô
 * khác vào là quay lại đúng lỗi "mượn số của toạ độ khác").
 *
 * Vì sao TỪNG CHIỀU chứ không một bán kính tròn: lưới này dẹt (ngang ~2,11° mà
 * dọc ~1,70°). Một bán kính tròn nửa-bước-lớn vẫn để THỦNG mấy góc ô — chạm vào
 * đó bị từ chối trong khi mũi tên đang vẽ ngay chỗ đó, đúng cái mâu thuẫn bà con
 * kêu. Hai nửa-bước theo hai chiều phủ KÍN đúng ô, không thừa không thiếu.
 *
 * KHÔNG đặt nhỏ hơn (vd 0,5°): lưới thưa ~2°, đặt 0,5° thì quá nửa số lần chạm
 * giữa hai mũi tên sẽ báo "chưa có số" trong khi số đang có ngay đó.
 */
/** Toạ độ ô làm tròn 0,01° (xem gridPoints) → khe thật giữa hai ô có thể nhỉnh
    hơn bước lý thuyết đúng ngần này; cộng bù cho khỏi thủng đúng CHÍNH GIỮA. */
const GRID_ROUND_DEG = 0.01;
export const GRID_SNAP_MAX_LAT_DEG = (GRID_STEP_LAT_DEG + GRID_ROUND_DEG) / 2; // ≈ 0,86°
export const GRID_SNAP_MAX_LON_DEG = (GRID_STEP_LON_DEG + GRID_ROUND_DEG) / 2; // ≈ 1,06°
/** Trần xa nhất theo bất kỳ chiều nào — con số để nói/ghi doc (≈ 1,05°) */
export const GRID_SNAP_MAX_DEG = Math.max(
  GRID_SNAP_MAX_LAT_DEG,
  GRID_SNAP_MAX_LON_DEG,
);

/**
 * Ô lưới PHỦ chỗ vừa chạm — null nếu lưới rỗng hoặc chỗ đó nằm NGOÀI vùng lưới.
 * Chọn ô có khoảng cách CHUẨN HOÁ theo nửa-bước nhỏ nhất; ≤ 1 nghĩa là chỗ chạm
 * nằm trong ô đó. Thuần, test được.
 */
export function nearestGridCell(
  grid: ForecastGrid,
  lat: number,
  lon: number,
): { cell: GridCell; distDeg: number } | null {
  let best: GridCell | null = null;
  let bestScore = Infinity;
  for (const c of grid.cells ?? []) {
    const score = Math.max(
      Math.abs(c.lat - lat) / GRID_SNAP_MAX_LAT_DEG,
      Math.abs(c.lon - lon) / GRID_SNAP_MAX_LON_DEG,
    );
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (!best || bestScore > 1) return null;
  return { cell: best, distDeg: Math.hypot(best.lat - lat, best.lon - lon) };
}

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

/** Namespace localStorage cho lưới Windy (offline) */
export const GRID_NS = "grid";

/** id bản lưu theo khung ngày — "d3", "d16"… (một khung một bản) */
export function gridCacheId(days: number): string {
  return `d${Math.round(days)}`;
}

/**
 * Lưới Windy có cache offline: lấy được thì LƯU (theo khung ngày); mất mạng →
 * lùi về bản đã lưu ĐÚNG KHUNG NGÀY ĐÓ + cờ `stale`.
 *
 * LỖI CŨ (đã sửa 2026-07-25): mất mạng mà chưa lưu khung đang xin thì lấy đại
 * "bản gần nhất" — xin 16 ngày, nhận lưới 3 ngày đã lưu, mà chip vẫn sáng "16
 * ngày". Bà con kéo thanh giờ tưởng đang xem nửa tháng tới. Nay không có đúng
 * khung thì BÁO LỖI, UI nói thật + chỉ ra khung nào thật sự đang có trong máy.
 */
export async function fetchForecastGrid(days = 3): Promise<ForecastGrid> {
  const id = gridCacheId(days);
  try {
    const g = await fetchForecastGridLive(days);
    saveForecast(GRID_NS, id, g);
    return g;
  } catch (err) {
    // LƯỚI AN TOÀN khi live lỗi: bản trong máy trước; nếu chưa có mà là khung
    // MIỄN PHÍ (d3) thì thử snapshot server cron tính sẵn (khung premium không
    // snapshot công khai — xem weather-snapshot-id.ts). Giữ cờ stale để UI nói thật.
    const hit = loadForecast<ForecastGrid>(GRID_NS, id);
    if (hit) return { ...hit.data, stale: true, savedAt: hit.savedAt };
    if (days === SNAPSHOT_GRID_DAYS) {
      const snap = await loadGridSnapshotClient(days);
      if (snap) return { ...snap, stale: true, savedAt: null };
    }
    throw err;
  }
}

/** LƯỚI AN TOÀN: snapshot lưới d3 do cron tính sẵn (same-origin) — null nếu chưa có */
async function loadGridSnapshotClient(days: number): Promise<ForecastGrid | null> {
  try {
    const r = await fetch(apiUrl(`/api/weather-snapshot?id=${gridSnapshotId(days)}`), {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const g = (await r.json()) as ForecastGrid;
    return g && Array.isArray(g.times) && g.times.length > 0 ? g : null;
  } catch {
    return null;
  }
}

/** Các khung ngày ĐANG CÓ bản lưu trong máy (tăng dần) — để UI nói đúng sự thật */
export function savedGridDays(): number[] {
  return loadAll<ForecastGrid>(GRID_NS)
    .map((e) => Number(/^d(\d+)$/.exec(e.id)?.[1]))
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
}

/**
 * Bản lưới ĐÃ LƯU DÀI NGÀY NHẤT còn trong máy (d16 → d7 → d3…) — phủ được nhiều
 * ngày nhất cho chuyến dài. Dùng khi mất sóng mà chỗ vừa chạm chưa từng mở xem:
 * lưới phủ CẢ VÙNG BIỂN nên vẫn có gió/sóng ĐÚNG chỗ đó (xem marine-weather).
 * null = trong máy chưa có lưới nào dùng được.
 */
export function loadLongestSavedGrid(): {
  grid: ForecastGrid;
  savedAt: number;
  days: number;
} | null {
  const days = savedGridDays();
  for (let i = days.length - 1; i >= 0; i--) {
    const hit = loadForecast<ForecastGrid>(GRID_NS, gridCacheId(days[i]));
    const g = hit?.data;
    if (!g?.cells?.length || !g.times?.length) continue;
    return { grid: g, savedAt: hit!.savedAt, days: days[i] };
  }
  return null;
}

/** LIVE Open-Meteo THẲNG — export để cron precompute dùng chung (client vẫn gọi
    qua fetchForecastGrid có cache + fallback). */
export async function fetchForecastGridLive(days = 3): Promise<ForecastGrid> {
  const pts = gridPoints();
  const lats = pts.map((p) => p.lat).join(",");
  const lons = pts.map((p) => p.lon).join(",");
  // +1 ngày đệm để mốc cuối đủ giờ; trần nguồn 16 ngày
  const fd = Math.min(16, Math.max(1, Math.round(days)) + 1);
  const common = `latitude=${lats}&longitude=${lons}&timezone=Asia%2FHo_Chi_Minh&forecast_days=${fd}`;

  // Timeout 20s (tầm 16 ngày × 80 điểm là payload lớn) — thà báo lỗi rõ còn hơn treo UI
  const [windRes, waveRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?${common}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`,
      { signal: AbortSignal.timeout(20000) },
    ).then((r) => {
      if (!r.ok) throw new Error(`wind grid ${r.status}`);
      return r.json();
    }),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_direction&models=${WAVE_MODEL}`,
      { signal: AbortSignal.timeout(20000) },
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

  const first = windArr[0] as { hourly?: { time?: string[] } };
  const allTimes: string[] = first?.hourly?.time ?? [];
  // chỉ số GIỜ từng khung: dày ở gần, thưa dần khi xa (chặn số khung)
  const hourIdx = stepHourIndices(days, allTimes.length);
  const times: string[] = hourIdx.map((h) => allTimes[h]);

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
    const hours: GridHour[] = hourIdx.map((h) => ({
      windKmh: num(w?.hourly?.wind_speed_10m?.[h]),
      windDirDeg: num(w?.hourly?.wind_direction_10m?.[h]),
      waveM: num(v?.hourly?.wave_height?.[h]),
      waveDirDeg: num(v?.hourly?.wave_direction?.[h]),
    }));
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

// Sóng (m): bám thang Windy — teal nhạt (êm) → lam → chàm → đỏ (dữ). KHÔNG
// dùng vàng/cam như trước (Windy sóng đi thẳng lam→đỏ tím).
export const WAVE_COLOR_EXPR = [
  "interpolate",
  ["linear"],
  ["get", "v"],
  0.3, "#75c8be",
  1.0, "#4682c8",
  2.0, "#5a50b4",
  3.0, "#b43c78",
  4.5, "#c62828",
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

// ── THANH THỜI GIAN KIỂU WINDY ────────────────────────────────────────────
// Dải ngày cuộn ngang: mỗi ngày một khối, dưới có nấc GIỜ (không ghi số
// gió/sóng lên thanh — chỉ ngày + giờ). Nấc giờ ánh xạ về đúng chỉ số trong
// mảng times[] để chạm là nhảy tới khung đó.

/** Nhãn ngắn cho ĐẦU khối ngày trên thanh: "Hôm nay" / "Mai" / "Th 6 12/6" */
export function scrubDayLabel(isoDate: string, todayIso?: string): string {
  if (todayIso) {
    const a = Date.parse(`${todayIso}T00:00:00Z`);
    const b = Date.parse(`${isoDate}T00:00:00Z`);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const diff = Math.round((b - a) / (24 * 60 * 60 * 1000));
      if (diff === 0) return "Hôm nay";
      if (diff === 1) return "Mai";
    }
  }
  const dt = new Date(`${isoDate}T12:00:00Z`);
  return `${WD_SHORT[dt.getUTCDay()]} ${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`;
}

export interface ScrubDay {
  /** ngày lịch "YYYY-MM-DD" (giờ VN) */
  iso: string;
  /** các nấc giờ trong ngày, kèm chỉ số vào mảng times[] để seek */
  ticks: { idx: number; hour: number }[];
}

/**
 * Gom mảng times[] (ISO giờ VN, đã thưa dần theo tầm) thành các KHỐI NGÀY để
 * vẽ thanh cuộn. Giữ nguyên chỉ số gốc — chạm nấc giờ là seek đúng khung đó.
 */
export function groupTimesByDay(times: string[]): ScrubDay[] {
  const days: ScrubDay[] = [];
  times.forEach((t, idx) => {
    const [date, time] = t.split("T");
    const hour = Number(time?.slice(0, 2) ?? "0");
    const last = days[days.length - 1];
    if (last && last.iso === date) last.ticks.push({ idx, hour });
    else days.push({ iso: date, ticks: [{ idx, hour: Number.isFinite(hour) ? hour : 0 }] });
  });
  return days;
}

export interface LegendStop {
  /** ngưỡng: gió km/h · sóng m */
  value: number;
  color: string;
}

/**
 * Thang màu cường độ (chú giải "thanh cường độ" kiểu Windy) — suy THẲNG từ
 * WIND/WAVE_COLOR_EXPR để chú giải KHÔNG BAO GIỜ lệch với màu vẽ trên bản đồ.
 */
export function legendStops(kind: ForecastKind): LegendStop[] {
  const expr = kind === "wind" ? WIND_COLOR_EXPR : WAVE_COLOR_EXPR;
  const stops: LegendStop[] = [];
  // cấu trúc: [..., value, color, value, color, ...] bắt đầu ở chỉ số 3
  for (let i = 3; i + 1 < expr.length; i += 2) {
    stops.push({ value: expr[i] as number, color: expr[i + 1] as string });
  }
  return stops;
}

/** CSS gradient cho thanh cường độ — vị trí mỗi chặng theo TỶ LỆ giá trị thật
    (khớp cách MapLibre nội suy tuyến tính), không chia đều giả tạo. */
export function legendGradientCss(kind: ForecastKind): string {
  const stops = legendStops(kind);
  if (stops.length === 0) return "var(--field)";
  const min = stops[0].value;
  const max = stops[stops.length - 1].value;
  const span = max - min || 1;
  const parts = stops.map(
    (s) => `${s.color} ${Math.round(((s.value - min) / span) * 100)}%`,
  );
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

/** Đơn vị hiển thị trên thanh cường độ — GIỮ đơn vị của app (không đổi sang
    knot như Windy): gió km/h, sóng m. */
export function legendUnit(kind: ForecastKind): string {
  return kind === "wind" ? "km/h" : "m";
}
