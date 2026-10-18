// LƯỚI GIÓ SÓNG CHO DẪN ĐƯỜNG — NẰM TRÊN SERVER MÌNH (2026-10-16).
//
// Vì sao có: trước đây mỗi lần tính tuyến, ĐIỆN THOẠI gọi thẳng Open-Meteo
// (~120 điểm × 2 nguồn). Gói miễn phí tính lượt theo IP, mà mạng 4G/văn phòng
// dùng chung IP ⇒ vài người thử tuyến là cả nhóm dính 429 "máy chủ dự báo quá
// tải". Chủ dự án chốt: server mình phải giữ dữ liệu, app chỉ hỏi server mình.
//
// Cách làm: cắt vùng biển VN thành 6×6 Ô LỚN (mỗi ô 8×8 mắt lưới, bước 0,35° —
// đúng độ mịn dẫn đường đang dùng). Server lấy + lưu từng ô vào
// `weather_snapshot` (id `routegrid:<hàng>:<cột>`), làm mới khi cũ quá
// ROUTE_GRID_FRESH_MS. Máy ghép các ô phủ khung tuyến thành một WeatherField.
// Ô đi qua /api/weather-snapshot ⇒ có sẵn cổng gác + service worker cache —
// ra khơi mất sóng vẫn dùng lại ô đã tải.
//
// File THUẦN, dùng được cả hai phía (server mã hoá, client ghép).

import type { BBox, HourSample, WeatherCellSeries, WeatherField } from "@/lib/route-plan";

/** Góc tây-nam lưới (mắt [0,0]) */
export const ROUTE_GRID_LAT0 = 6;
export const ROUTE_GRID_LON0 = 102;
/** Bước mắt lưới, độ (~39 km) */
export const ROUTE_GRID_STEP = 0.35;
/** Mắt mỗi cạnh một ô lớn */
export const ROUTE_TILE_N = 8;
/** Số ô lớn mỗi chiều ⇒ phủ 6° → 22,45° B, 102° → 118,45° Đ (cả Hoàng Sa, Trường Sa) */
export const ROUTE_TILES = 6;
/** Tổng mắt mỗi chiều */
export const ROUTE_GRID_N = ROUTE_TILE_N * ROUTE_TILES;
/** Server lấy 4 ngày: bản lấy hôm qua vẫn còn đủ 72 giờ cho hôm nay */
export const ROUTE_GRID_FORECAST_DAYS = 4;
/** Ô cũ hơn mức này thì server lấy lại (nguồn ra bản mới ~6 giờ/lần) */
export const ROUTE_GRID_FRESH_MS = 3 * 60 * 60 * 1000;
/** Ghép xong mỗi chiều tối đa bấy nhiêu mắt — khung rộng thì giãn bước, giữ RAM
    điện thoại (24×24 ô × 72 giờ ≈ 41 nghìn mẫu) */
export const ROUTE_FIELD_MAX_AXIS = 24;
/** Ít hơn bấy nhiêu giờ còn dùng được thì coi như ô không có số */
const MIN_HOURS = 24;

/** Một mắt lưới đã mã hoá: số nguyên đã nhân hệ số, null = nguồn không có */
export type RouteTileCell = {
  /** gió km/h × 10 */
  w: (number | null)[];
  /** hướng gió THỔI TỪ, độ */
  wd: (number | null)[];
  /** sóng m × 100 */
  h: (number | null)[];
  /** hướng sóng TỚI TỪ, độ */
  hd: (number | null)[];
  /** chu kỳ sóng s × 10 */
  p: (number | null)[];
  /** dòng chảy km/h × 100 */
  c: (number | null)[];
  /** hướng dòng CHẢY TỚI, độ */
  cd: (number | null)[];
};

export type RouteTile = {
  v: 1;
  r: number;
  c: number;
  /** ngày (giờ VN, YYYY-MM-DD) của giờ đầu tiên — mốc giờ 0 */
  start: string;
  /** lúc server lấy, ISO */
  builtAt: string;
  /** hàng-trước, i*ROUTE_TILE_N+j, i theo vĩ độ tăng; null = đất liền/không số */
  cells: (RouteTileCell | null)[];
};

const CELL_KEYS = ["w", "wd", "h", "hd", "p", "c", "cd"] as const;

export function routeTileId(r: number, c: number): string {
  return `routegrid:${r}:${c}`;
}

/** id → {r,c} khi hợp lệ, ngược lại null (chặn id lạ ở route) */
export function parseRouteTileId(id: string): { r: number; c: number } | null {
  const m = /^routegrid:(\d+):(\d+)$/.exec(id);
  if (!m) return null;
  const r = Number(m[1]);
  const c = Number(m[2]);
  return r < ROUTE_TILES && c < ROUTE_TILES ? { r, c } : null;
}

/** Toạ độ các mắt của một ô lớn (vĩ độ tăng, kinh độ tăng) */
export function routeTilePoints(r: number, c: number): { lats: number[]; lons: number[] } {
  const at = (base: number, k: number) => Number((base + k * ROUTE_GRID_STEP).toFixed(3));
  const lats = Array.from({ length: ROUTE_TILE_N }, (_, k) => at(ROUTE_GRID_LAT0, r * ROUTE_TILE_N + k));
  const lons = Array.from({ length: ROUTE_TILE_N }, (_, k) => at(ROUTE_GRID_LON0, c * ROUTE_TILE_N + k));
  return { lats, lons };
}

/** Ngày giờ VN YYYY-MM-DD */
export function vnDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayDiff(a: string, b: string): number {
  const d = (s: string) => {
    const [y, m, dd] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, dd) / 86400000;
  };
  return d(a) - d(b);
}

/** Ô còn tươi: lấy chưa quá ROUTE_GRID_FRESH_MS VÀ mốc giờ 0 là hôm nay */
export function routeTileIsFresh(t: RouteTile, now: Date): boolean {
  const age = now.getTime() - Date.parse(t.builtAt);
  return Number.isFinite(age) && age >= 0 && age < ROUTE_GRID_FRESH_MS && t.start === vnDate(now);
}

const q = (v: number | null | undefined, k: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * k) : null;

/**
 * WeatherField 8×8 (ra từ parseWeatherField trên đúng routeTilePoints) → ô đã
 * mã hoá. Ô không phải biển (onSea=false) lưu null cho nhẹ.
 */
export function encodeRouteTile(
  r: number,
  c: number,
  field: WeatherField,
  start: string,
  builtAt: string,
): RouteTile {
  const cells = field.cells.map((cell): RouteTileCell | null =>
    cell.onSea
      ? {
          w: cell.hours.map((h) => q(h.windKmh, 10)),
          wd: cell.hours.map((h) => q(h.windFromDeg, 1)),
          h: cell.hours.map((h) => q(h.waveM, 100)),
          hd: cell.hours.map((h) => q(h.waveFromDeg, 1)),
          p: cell.hours.map((h) => q(h.wavePeriodS, 10)),
          c: cell.hours.map((h) => q(h.currentKmh, 100)),
          cd: cell.hours.map((h) => q(h.currentToDeg, 1)),
        }
      : null,
  );
  return { v: 1, r, c, start, builtAt, cells };
}

const isNumOrNull = (x: unknown) => x === null || (typeof x === "number" && Number.isFinite(x));

/** Kiểm hình dạng ô — dùng ở RANH GIỚI (server đọc DB, client đọc mạng) */
export function isRouteTile(x: unknown): x is RouteTile {
  if (!x || typeof x !== "object") return false;
  const t = x as Partial<RouteTile>;
  if (t.v !== 1 || !Number.isInteger(t.r) || !Number.isInteger(t.c)) return false;
  if (typeof t.start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t.start)) return false;
  if (typeof t.builtAt !== "string" || !Number.isFinite(Date.parse(t.builtAt))) return false;
  if (!Array.isArray(t.cells) || t.cells.length !== ROUTE_TILE_N * ROUTE_TILE_N) return false;
  const maxH = ROUTE_GRID_FORECAST_DAYS * 24;
  return t.cells.every((cell) => {
    if (cell === null) return true;
    if (typeof cell !== "object") return false;
    const len = (cell as RouteTileCell).w?.length;
    if (!Number.isInteger(len) || len > maxH) return false;
    return CELL_KEYS.every((k) => {
      const a = (cell as RouteTileCell)[k];
      return Array.isArray(a) && a.length === len && a.every(isNumOrNull);
    });
  });
}

/** Khoảng chỉ số mắt (toàn lưới) phủ trọn [lo,hi]; null nếu nằm ngoài lưới */
function axisRange(lo: number, hi: number, base: number): [number, number] | null {
  const max = ROUTE_GRID_N - 1;
  const a = Math.floor((lo - base) / ROUTE_GRID_STEP + 1e-9);
  const b = Math.ceil((hi - base) / ROUTE_GRID_STEP - 1e-9);
  if (b < 0 || a > max) return null;
  return [Math.max(0, a), Math.min(max, Math.max(a, b))];
}

/** Bước giãn + các chỉ số mắt dùng cho một chiều (đều nhau, ≤ ROUTE_FIELD_MAX_AXIS) */
function axisIndices([a, b]: [number, number]): { step: number; idx: number[] } {
  const step = Math.max(1, Math.ceil((b - a) / (ROUTE_FIELD_MAX_AXIS - 1)));
  const n = Math.max(2, Math.ceil((b - a) / step) + 1);
  return { step, idx: Array.from({ length: n }, (_, k) => a + k * step) };
}

/** Các id ô lớn cần tải để phủ khung tuyến (rỗng nếu khung nằm ngoài lưới) */
export function routeTileIdsForBBox(bbox: BBox): string[] {
  const ri = axisRange(bbox.latMin, bbox.latMax, ROUTE_GRID_LAT0);
  const rj = axisRange(bbox.lonMin, bbox.lonMax, ROUTE_GRID_LON0);
  if (!ri || !rj) return [];
  const ids: string[] = [];
  const tr = (i: number) => Math.min(ROUTE_TILES - 1, Math.floor(i / ROUTE_TILE_N));
  for (let r = tr(ri[0]); r <= tr(ri[1]); r++)
    for (let c = tr(rj[0]); c <= tr(rj[1]); c++) ids.push(routeTileId(r, c));
  return ids;
}

const EMPTY: WeatherCellSeries = { onSea: false, hours: [] };

function decodeCell(cell: RouteTileCell, from: number, to: number): HourSample[] {
  const d = (v: number | null | undefined, k: number) => (v == null ? null : v / k);
  const hours: HourSample[] = [];
  for (let t = from; t < Math.min(to, cell.w.length); t++) {
    hours.push({
      waveM: d(cell.h[t], 100),
      waveFromDeg: d(cell.hd[t], 1),
      wavePeriodS: d(cell.p[t], 10),
      windKmh: d(cell.w[t], 10) ?? 0,
      windFromDeg: d(cell.wd[t], 1) ?? 0,
      currentKmh: d(cell.c[t], 100) ?? 0,
      currentToDeg: d(cell.cd[t], 1),
    });
  }
  return hours;
}

/**
 * Ghép các ô đã tải thành WeatherField phủ khung tuyến, trục giờ đặt về 0h HÔM
 * NAY giờ VN (ô lấy hôm qua tự dịch 24 giờ). Ô thiếu / đất liền / quá cũ ⇒ mắt
 * onSea=false (bộ tìm đường coi là thiếu số, không phải biển lặng). Không có
 * lấy một mắt biển nào ⇒ null để caller lùi về nấc sau.
 */
export function stitchRouteField(
  bbox: BBox,
  tiles: ReadonlyMap<string, RouteTile>,
  now: Date,
  hoursWanted = 72,
): WeatherField | null {
  const ri = axisRange(bbox.latMin, bbox.latMax, ROUTE_GRID_LAT0);
  const rj = axisRange(bbox.lonMin, bbox.lonMax, ROUTE_GRID_LON0);
  if (!ri || !rj) return null;
  const I = axisIndices(ri);
  const J = axisIndices(rj);
  const today = vnDate(now);
  const cells: WeatherCellSeries[] = [];
  let anySea = false;
  for (const i of I.idx) {
    for (const j of J.idx) {
      if (i >= ROUTE_GRID_N || j >= ROUTE_GRID_N) {
        cells.push(EMPTY);
        continue;
      }
      const tile = tiles.get(
        routeTileId(Math.floor(i / ROUTE_TILE_N), Math.floor(j / ROUTE_TILE_N)),
      );
      const cell = tile?.cells[(i % ROUTE_TILE_N) * ROUTE_TILE_N + (j % ROUTE_TILE_N)];
      if (!tile || !cell) {
        cells.push(EMPTY);
        continue;
      }
      const off = Math.max(0, dayDiff(today, tile.start) * 24);
      const hours = decodeCell(cell, off, off + hoursWanted);
      if (hours.length < MIN_HOURS || !hours.some((h) => h.waveM != null)) {
        cells.push(EMPTY);
        continue;
      }
      anySea = true;
      cells.push({ onSea: true, hours });
    }
  }
  if (!anySea) return null;
  return {
    lat0: ROUTE_GRID_LAT0 + I.idx[0] * ROUTE_GRID_STEP,
    lon0: ROUTE_GRID_LON0 + J.idx[0] * ROUTE_GRID_STEP,
    dLat: I.step * ROUTE_GRID_STEP,
    dLon: J.step * ROUTE_GRID_STEP,
    nLat: I.idx.length,
    nLon: J.idx.length,
    cells,
  };
}
