// Trục 1 — LỚP DẢI MÀU (vô hướng) kiểu Windy: mây / mưa / nhiệt không khí.
//
// Khác lớp gió/sóng (mũi tên CÓ HƯỚNG), các trường này VÔ HƯỚNG nên vẽ thành
// DẢI MÀU MƯỢT: nội suy song tuyến từ lưới thưa 8×10 lên lưới mịn hơn rồi tô ô
// (fill) theo thang màu — "hiệu ứng Windy". Nguồn: Open-Meteo forecast (miễn
// phí, không key) — CÙNG endpoint + cùng 80 điểm lưới với lớp gió, gộp 3 biến
// vào MỘT request (cloud_cover, precipitation, temperature_2m).
//
// Quy tắc adapter (01-product): đổi nguồn chỉ sửa fetch; phần dựng hình
// (scalarFieldFeatures) + thang màu (SCALAR_RAMP) là logic thuần, test được.
//
// OFFLINE: cùng cơ chế lib/forecast-cache như lưới gió/sóng — lấy được thì lưu
// theo (kind, khung ngày); mất mạng lùi về bản đã lưu + cờ stale.
//
// ĐỘ MẶN (Copernicus): CHƯA nối — theo luật repo phải fetch thử thật kiểm
// đơn vị/endpoint Zarr trước (external-services.md). Để đợt sau kèm probe.

import { saveForecast, loadForecast } from "@/lib/forecast-cache";
import { apiUrl } from "@/lib/api-base";
import {
  scalarSnapshotId,
  SNAPSHOT_GRID_DAYS,
} from "@/lib/weather-snapshot-id";
import {
  gridPoints,
  stepHourIndices,
  GRID_N_LAT,
  GRID_N_LON,
} from "@/lib/forecast-grid";

// mây/mưa/nhiệt/dông = Open-Meteo (lưới gió 8×10, theo GIỜ);
// salinity = Copernicus (lưới 1/3° riêng, theo NGÀY) qua /api/salinity.
// "storm" (dông) = CAPE J/kg: NGUY CƠ dông/sét, KHÔNG phải sét thật
// (Open-Meteo `lightning_potential` trả null ở VN — chỉ có model châu Âu).
export type OMKind = "cloud" | "rain" | "airtemp" | "storm" | "pressure";
export type ScalarKind = OMKind | "salinity";

export interface ScalarGrid {
  kind: ScalarKind;
  /** Ô lưới row-major (i*nLon+j), lat/lon TĂNG DẦN */
  cells: { lat: number; lon: number; values: (number | null)[] }[];
  /** mốc ISO (giờ VN) — theo giờ (gió/mây/…) hoặc theo ngày (salinity) */
  times: string[];
  /** kích thước lưới; mặc định = lưới gió 8×10 (mây/mưa/nhiệt/dông) */
  nLat?: number;
  nLon?: number;
  stale?: boolean;
  savedAt?: number | null;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Biến Open-Meteo (hourly) cho mỗi lớp CÙNG NGUỒN Open-Meteo */
const OM_VAR: Record<OMKind, string> = {
  cloud: "cloud_cover",
  rain: "precipitation",
  airtemp: "temperature_2m",
  storm: "cape", // CAPE J/kg — nguy cơ đối lưu (dông), proxy sét
  pressure: "pressure_msl", // áp suất mực biển (hPa)
};

// ── NGUỒN ──────────────────────────────────────────────────────────────────

/**
 * LIVE Open-Meteo THẲNG — gộp 3 biến trong MỘT request (80 điểm). Trả về map
 * theo kind. Bước giờ thưa dần giống lớp gió (stepHourIndices) để khớp trục.
 */
export async function fetchScalarFieldsLive(
  days = 3,
): Promise<Record<OMKind, ScalarGrid>> {
  const pts = gridPoints();
  const lats = pts.map((p) => p.lat).join(",");
  const lons = pts.map((p) => p.lon).join(",");
  const fd = Math.min(16, Math.max(1, Math.round(days)) + 1);
  const hourly = Object.values(OM_VAR).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&timezone=Asia%2FHo_Chi_Minh&forecast_days=${fd}&hourly=${hourly}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) }).then(
    (r) => {
      if (!r.ok) throw new Error(`scalar grid ${r.status}`);
      return r.json();
    },
  );
  const arr: unknown[] = Array.isArray(res) ? res : [res];

  const first = arr[0] as { hourly?: { time?: string[] } };
  const allTimes: string[] = first?.hourly?.time ?? [];
  const hourIdx = stepHourIndices(days, allTimes.length);
  const times: string[] = hourIdx.map((h) => allTimes[h]);

  const build = (kind: OMKind): ScalarGrid => ({
    kind,
    times,
    // lưu dims để bản LƯU vẫn render đúng khi lưới đổi kích thước về sau
    nLat: GRID_N_LAT,
    nLon: GRID_N_LON,
    cells: pts.map((p, idx) => {
      const h = (arr[idx] as { hourly?: Record<string, unknown[]> })?.hourly;
      const series = h?.[OM_VAR[kind]] ?? [];
      return {
        lat: p.lat,
        lon: p.lon,
        values: hourIdx.map((k) => num(series[k])),
      };
    }),
  });

  return {
    cloud: build("cloud"),
    rain: build("rain"),
    airtemp: build("airtemp"),
    storm: build("storm"),
    pressure: build("pressure"),
  };
}

export const SCALAR_NS = "scalar";
const cacheId = (kind: ScalarKind, days: number) => `${kind}.d${Math.round(days)}`;

/** Độ mặn (Copernicus, theo NGÀY) — qua /api/salinity (server fetch S3). Cache
    offline giống các lớp kia; mất mạng → bản lưu + stale. */
async function fetchSalinityField(days: number): Promise<ScalarGrid> {
  try {
    const r = await fetch(apiUrl(`/api/salinity?days=${Math.round(days)}`), {
      signal: AbortSignal.timeout(35000),
    });
    if (!r.ok) throw new Error(`salinity ${r.status}`);
    const j = (await r.json()) as {
      ok?: boolean;
      times?: string[];
      cells?: ScalarGrid["cells"];
      nLat?: number;
      nLon?: number;
    };
    if (!j?.ok || !Array.isArray(j.cells) || !Array.isArray(j.times)) {
      throw new Error("salinity payload");
    }
    const g: ScalarGrid = {
      kind: "salinity",
      times: j.times,
      cells: j.cells,
      nLat: j.nLat,
      nLon: j.nLon,
    };
    saveForecast(SCALAR_NS, cacheId("salinity", days), g);
    return g;
  } catch (err) {
    const hit = loadForecast<ScalarGrid>(SCALAR_NS, cacheId("salinity", days));
    if (hit) return { ...hit.data, stale: true, savedAt: hit.savedAt };
    throw err;
  }
}

/**
 * Lớp dải màu có cache offline. mây/mưa/nhiệt/dông = Open-Meteo (lưu CẢ 4 kind
 * một request); salinity = Copernicus qua route riêng. Mất mạng → bản đã lưu
 * ĐÚNG (kind, khung) + cờ stale; chưa lưu thì ném lỗi để UI nói thật.
 */
export async function fetchScalarField(
  kind: ScalarKind,
  days = 3,
): Promise<ScalarGrid> {
  if (kind === "salinity") return fetchSalinityField(days);
  try {
    const all = await fetchScalarFieldsLive(days);
    (Object.keys(all) as OMKind[]).forEach((k) =>
      saveForecast(SCALAR_NS, cacheId(k, days), all[k]),
    );
    return all[kind];
  } catch (err) {
    // live lỗi (429/mất mạng): bản trong máy trước; chưa có mà là khung MIỄN
    // PHÍ d3 → snapshot server do cron tính sẵn (pattern forecast-grid).
    const hit = loadForecast<ScalarGrid>(SCALAR_NS, cacheId(kind, days));
    if (hit) return { ...hit.data, stale: true, savedAt: hit.savedAt };
    if (days === SNAPSHOT_GRID_DAYS) {
      const snap = await loadScalarSnapshotClient(kind, days);
      if (snap) return { ...snap, stale: true, savedAt: null };
    }
    throw err;
  }
}

/** LƯỚI AN TOÀN: snapshot lớp dải màu d3 do cron tính sẵn — null nếu chưa có */
async function loadScalarSnapshotClient(
  kind: OMKind,
  days: number,
): Promise<ScalarGrid | null> {
  try {
    const r = await fetch(
      apiUrl(`/api/weather-snapshot?id=${scalarSnapshotId(kind, days)}`),
      { signal: AbortSignal.timeout(10000) },
    );
    if (!r.ok) return null;
    const g = (await r.json()) as ScalarGrid;
    return g && Array.isArray(g.times) && g.times.length > 0 ? g : null;
  } catch {
    return null;
  }
}

// ── THANG MÀU + CHÚ GIẢI (thanh cường độ) ───────────────────────────────────
//
// Màu NỘI DUNG bản đồ (không phải token UI). rgba để tô đè lên biển: giá trị
// thấp → trong suốt, cao → đậm. Mỗi chặng [value, "r,g,b,a"].

export interface ScalarRampStop {
  value: number;
  rgba: [number, number, number, number];
}

export const SCALAR_RAMP: Record<ScalarKind, ScalarRampStop[]> = {
  // Mây (% che phủ): quang (trong) → trắng-lam DỊU (sạch, không xám đục)
  cloud: [
    { value: 0, rgba: [255, 255, 255, 0] },
    { value: 25, rgba: [226, 236, 246, 0.28] },
    { value: 55, rgba: [214, 228, 243, 0.52] },
    { value: 80, rgba: [230, 239, 249, 0.7] },
    { value: 100, rgba: [247, 250, 253, 0.9] },
  ],
  // Mưa (mm/giờ): tạnh → lam nhạt → lục → vàng → cam → đỏ → tím (bám thang Windy)
  rain: [
    { value: 0, rgba: [116, 190, 220, 0] },
    { value: 0.3, rgba: [116, 190, 220, 0.5] },
    { value: 1.5, rgba: [110, 200, 120, 0.66] },
    { value: 4, rgba: [235, 205, 70, 0.74] },
    { value: 8, rgba: [235, 140, 50, 0.8] },
    { value: 16, rgba: [215, 55, 55, 0.85] },
    { value: 30, rgba: [150, 40, 140, 0.9] },
  ],
  // Nhiệt không khí (°C): mát lục → ấm vàng → nóng cam → gắt đỏ (bám thang Windy;
  // biển VN mặt ~20–34 nên vùng này ra cam/đỏ như bản đồ Windy nhiệt độ)
  airtemp: [
    { value: 16, rgba: [90, 180, 120, 0.65] },
    { value: 22, rgba: [200, 210, 90, 0.68] },
    { value: 27, rgba: [245, 190, 70, 0.72] },
    { value: 31, rgba: [240, 130, 55, 0.78] },
    { value: 35, rgba: [215, 55, 45, 0.82] },
  ],
  // Dông (CAPE J/kg): tạnh → vàng → cam → tím (đối lưu mạnh, dễ dông/sét)
  storm: [
    { value: 0, rgba: [250, 204, 120, 0] },
    { value: 1000, rgba: [250, 204, 120, 0.45] },
    { value: 2500, rgba: [239, 159, 39, 0.72] },
    { value: 4000, rgba: [150, 29, 120, 0.9] },
  ],
  // Độ mặn (PSU): nhạt (gần cửa sông) → mặn khơi. Kiểu cmocean "haline"
  // (xanh lá nhạt → lam → chàm). Biển VN mặt ~16–34 PSU (đo probe 2026-07-28).
  salinity: [
    { value: 20, rgba: [150, 199, 148, 0.6] },
    { value: 28, rgba: [64, 158, 160, 0.68] },
    { value: 32, rgba: [45, 104, 168, 0.75] },
    { value: 35, rgba: [40, 54, 120, 0.85] },
  ],
  // Áp suất mực biển (hPa): thấp lam (áp thấp → xấu) → chuẩn nhạt → cao nâu
  // (khớp thang Windy 990→1030).
  pressure: [
    { value: 990, rgba: [56, 110, 180, 0.7] },
    { value: 1005, rgba: [150, 200, 205, 0.55] },
    { value: 1013, rgba: [235, 234, 224, 0.5] },
    { value: 1020, rgba: [205, 165, 110, 0.62] },
    { value: 1032, rgba: [150, 95, 55, 0.75] },
  ],
};

export const SCALAR_META: Record<
  ScalarKind,
  { label: string; unit: string; help: string }
> = {
  cloud: {
    label: "Mây",
    unit: "%",
    help: "Chỗ trắng đục là trời nhiều mây; chỗ trong là trời quang.",
  },
  rain: {
    label: "Mưa",
    unit: "mm/giờ",
    help: "Chỗ đậm là mưa to; tím là hay có dông — nên né.",
  },
  airtemp: {
    label: "Nhiệt không khí",
    unit: "°C",
    help: "Nhiệt độ không khí trên mặt biển theo giờ.",
  },
  storm: {
    label: "Dông",
    unit: "CAPE",
    help: "Nguy cơ dông/sét (chỉ số CAPE) — càng đậm càng dễ dông. Là dự báo NGUY CƠ, không phải sét thật.",
  },
  salinity: {
    label: "Độ mặn",
    unit: "PSU",
    help: "Độ mặn nước biển (PSU) — chỗ nhạt gần cửa sông. Nguồn Copernicus Marine, theo ngày.",
  },
  pressure: {
    label: "Áp suất",
    unit: "hPa",
    help: "Áp suất mực biển — lam là áp thấp (dễ xấu trời), nâu là áp cao (thường êm).",
  },
};

/** rgba() css cho một giá trị theo thang màu (nội suy tuyến tính giữa 2 chặng) */
export function scalarColor(kind: ScalarKind, v: number): string {
  const stops = SCALAR_RAMP[kind];
  if (v <= stops[0].value) return rgbaCss(stops[0].rgba);
  const last = stops[stops.length - 1];
  if (v >= last.value) return rgbaCss(last.rgba);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (v <= b.value) {
      const t = (v - a.value) / (b.value - a.value || 1);
      return rgbaCss([
        Math.round(a.rgba[0] + (b.rgba[0] - a.rgba[0]) * t),
        Math.round(a.rgba[1] + (b.rgba[1] - a.rgba[1]) * t),
        Math.round(a.rgba[2] + (b.rgba[2] - a.rgba[2]) * t),
        Math.round((a.rgba[3] + (b.rgba[3] - a.rgba[3]) * t) * 100) / 100,
      ]);
    }
  }
  return rgbaCss(last.rgba);
}

function rgbaCss([r, g, b, a]: [number, number, number, number]): string {
  return `rgba(${r},${g},${b},${a})`;
}

/** CSS gradient cho thanh chú giải (bỏ alpha để đọc rõ trên nền UI) */
export function scalarGradientCss(kind: ScalarKind): string {
  const stops = SCALAR_RAMP[kind];
  const min = stops[0].value;
  const max = stops[stops.length - 1].value;
  const span = max - min || 1;
  const parts = stops.map(
    (s) =>
      `rgb(${s.rgba[0]},${s.rgba[1]},${s.rgba[2]}) ${Math.round(
        ((s.value - min) / span) * 100,
      )}%`,
  );
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

// ── DỰNG HÌNH: nội suy song tuyến → lưới ô mịn (fill) ────────────────────────

/** Song tuyến trên lưới đều, bỏ qua ô null (trả null nếu thiếu góc) */
function bilinear(
  grid: (number | null)[],
  nLat: number,
  nLon: number,
  fi: number,
  fj: number,
): number | null {
  const i0 = Math.floor(fi);
  const j0 = Math.floor(fj);
  const i1 = Math.min(i0 + 1, nLat - 1);
  const j1 = Math.min(j0 + 1, nLon - 1);
  const di = fi - i0;
  const dj = fj - j0;
  const v00 = grid[i0 * nLon + j0];
  const v01 = grid[i0 * nLon + j1];
  const v10 = grid[i1 * nLon + j0];
  const v11 = grid[i1 * nLon + j1];
  if (v00 == null || v01 == null || v10 == null || v11 == null) return null;
  const top = v00 * (1 - dj) + v01 * dj;
  const bot = v10 * (1 - dj) + v11 * dj;
  return top * (1 - di) + bot * di;
}

/**
 * FeatureCollection ô tô màu (fill) cho MỘT mốc giờ — nội suy lưới 8×10 lên
 * mịn gấp `factor` lần rồi tô mỗi ô mịn. properties.color = rgba() sẵn (tô
 * data-driven bằng ["get","color"]). Ô nội suy ra null (thiếu số / trên bờ) bị
 * bỏ. Thuần, test được.
 */
export function scalarFieldFeatures(
  grid: ScalarGrid,
  timeIdx: number,
  factor = 3,
): GeoJSON.FeatureCollection {
  // lưới gió 8×10 (mây/mưa/nhiệt/dông) hoặc lưới riêng của độ mặn (nLat/nLon)
  const nLat = grid.nLat ?? GRID_N_LAT;
  const nLon = grid.nLon ?? GRID_N_LON;
  const values = grid.cells.map((c) => c.values[timeIdx] ?? null);
  if (values.length !== nLat * nLon || nLat < 2 || nLon < 2) {
    return { type: "FeatureCollection", features: [] };
  }
  const lat0 = grid.cells[0].lat;
  const lon0 = grid.cells[0].lon;
  const latStep = (grid.cells[nLat * nLon - 1].lat - lat0) / (nLat - 1);
  const lonStep = (grid.cells[nLon - 1].lon - lon0) / (nLon - 1);
  const fLat = (nLat - 1) * factor;
  const fLon = (nLon - 1) * factor;
  const cellLat = latStep / factor;
  const cellLon = lonStep / factor;

  const features: GeoJSON.Feature[] = [];
  for (let a = 0; a <= fLat; a++) {
    for (let b = 0; b <= fLon; b++) {
      const v = bilinear(values, nLat, nLon, a / factor, b / factor);
      if (v == null) continue;
      const clat = lat0 + a * cellLat;
      const clon = lon0 + b * cellLon;
      const hLat = cellLat / 2;
      const hLon = cellLon / 2;
      features.push({
        type: "Feature",
        properties: { color: scalarColor(grid.kind, v), v },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [clon - hLon, clat - hLat],
              [clon + hLon, clat - hLat],
              [clon + hLon, clat + hLat],
              [clon - hLon, clat + hLat],
              [clon - hLon, clat - hLat],
            ],
          ],
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

/** Giá trị tại một điểm (cho đọc số ở sheet) — ô lưới gần nhất, null nếu xa */
export function scalarValueAt(
  grid: ScalarGrid,
  timeIdx: number,
  lat: number,
  lon: number,
): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const c of grid.cells) {
    const d = Math.abs(c.lat - lat) + Math.abs(c.lon - lon);
    if (d < bestD) {
      bestD = d;
      best = c.values[timeIdx] ?? null;
    }
  }
  return best;
}
