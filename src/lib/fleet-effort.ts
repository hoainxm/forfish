/**
 * KÊNH BẰNG CHỨNG "ĐỘI TÀU" cho dự báo cá (2026-10-11).
 *
 * Lưới `src/data/fleet-effort-025.v1.json` (scripts/build-fleet-effort-grid.mjs) = giờ tàu có
 * mặt-đánh bắt theo VMS, ô 0,25° CÙNG TRỤC lưới cá, theo tháng × nhóm nghề, chỉ ô ≥3 tàu.
 * Ở đây biến nó thành `x ∈ [0,1]` cho MỘT loài ở MỘT tháng-trong-năm:
 *
 *   tốc độ (giờ/ngày) của các NGHỀ bắt loài đó → cửa sổ tháng (tháng mình ×1, hai tháng kề
 *   ×0,5 — vụ không cắt đúng ranh giới tháng) → làm mượt 3×3 (đàn cá rộng hơn một ô) →
 *   x = 1 − e^(−giờ-30-ngày / FLEET_FULL_HOURS) (bão hoà: có tàu làm đều là đủ, không cần
 *   "đông nhất vùng" — so hạng thì ô khơi luôn thua ô ven bờ vì ven bờ tàu nhỏ đông gấp trăm).
 *
 * Thiếu lưới / loài không có nghề / ô trống ⇒ 0 ⇒ không đổi điểm (bất biến "mất nguồn chỉ
 * giảm" của buildFishForecast vẫn giữ).
 */

export interface FleetEffortGrid {
  v: number;
  axis: { lat0: number; lon0: number; step: number; nLat: number; nLon: number };
  gears: string[];
  months: string[];
  days: Record<string, number>;
  speciesGears: Record<string, string[]>;
  /** tháng "YYYY-MM" → nghề → [[i, j, giờ]] */
  effort: Record<string, Record<string, [number, number, number][]>>;
}

/** Giờ-30-ngày để x = 1 − 1/e ≈ 0,63. Chốt bằng kiểm định DataLake (ops/fish-validate-positions §10). */
export const FLEET_FULL_HOURS = 60;
/** Trọng số tháng kề trong cửa sổ vụ */
export const FLEET_NEIGHBOR_MONTH_W = 0.5;
/** Nhân 3×3: tâm 2 · cạnh 1 · góc 0,5 (tổng 8) */
const KERNEL: [number, number, number][] = [
  [0, 0, 2],
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, 0.5], [-1, 1, 0.5], [1, -1, 0.5], [1, 1, 0.5],
];
const KERNEL_SUM = 8;

/** Tháng-trong-năm (1..12) của "YYYY-MM" */
const moy = (ym: string) => Number(ym.slice(5, 7));

/**
 * Lưới x (Float32, nLat×nLon phẳng) cho một tập nghề ở tháng `month` (1..12).
 * Tháng không có dữ liệu năm nào ⇒ chỉ dùng tháng kề; không có gì ⇒ null.
 */
export function fleetPresenceGrid(
  g: FleetEffortGrid,
  gears: string[],
  month: number,
  fullHours = FLEET_FULL_HOURS,
): Float32Array | null {
  const { nLat, nLon } = g.axis;
  const rate = new Float64Array(nLat * nLon);
  let wSum = 0;
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  for (const ym of g.months) {
    const m = moy(ym);
    const w = m === month ? 1 : m === prev || m === next ? FLEET_NEIGHBOR_MONTH_W : 0;
    if (w === 0) continue;
    const days = g.days[ym] ?? 30;
    wSum += w;
    for (const gear of gears) {
      for (const [i, j, h] of g.effort[ym]?.[gear] ?? []) {
        if (i >= 0 && i < nLat && j >= 0 && j < nLon) rate[i * nLon + j] += (w * h) / days;
      }
    }
  }
  if (wSum === 0) return null;
  const out = new Float32Array(nLat * nLon);
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      let s = 0;
      for (const [di, dj, kw] of KERNEL) {
        const a = i + di, b = j + dj;
        if (a >= 0 && a < nLat && b >= 0 && b < nLon) s += kw * rate[a * nLon + b];
      }
      const hours30 = ((s / KERNEL_SUM) * 30) / wSum;
      out[i * nLon + j] = hours30 > 0 ? 1 - Math.exp(-hours30 / fullHours) : 0;
    }
  }
  return out;
}

/**
 * Bộ tra x theo loài (tên ngắn) cho một tháng — dựng lười, nhớ theo tập nghề (nhiều loài
 * chung nghề dùng chung một lưới). Trả `(short, lat, lon) → x`.
 */
export function fleetPresenceLookup(
  g: FleetEffortGrid | null | undefined,
  month: number,
  fullHours = FLEET_FULL_HOURS,
): (short: string, lat: number, lon: number) => number {
  if (!g) return () => 0;
  const cache = new Map<string, Float32Array | null>();
  const { lat0, lon0, step, nLat, nLon } = g.axis;
  return (short, lat, lon) => {
    const gears = g.speciesGears[short];
    if (!gears || gears.length === 0) return 0;
    const key = gears.join("+");
    if (!cache.has(key)) cache.set(key, fleetPresenceGrid(g, gears, month, fullHours));
    const grid = cache.get(key);
    if (!grid) return 0;
    const i = Math.round((lat - lat0) / step);
    const j = Math.round((lon - lon0) / step);
    if (i < 0 || j < 0 || i >= nLat || j >= nLon) return 0;
    return grid[i * nLon + j];
  };
}
