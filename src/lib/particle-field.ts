// Trục 1 — TRƯỜNG U/V cho HẠT BAY kiểu Windy — THUẦN, có test.
//
// Mô hình đúng Windy (user 2026-07-29): mỗi ô lưới có HƯỚNG (gió, hoặc sóng ở
// lớp sóng); hạt bay trong ô theo hướng đó, tới rìa ô thì trôi tiếp theo hướng
// của Ô KẾ (trường u/v nội suy BILINEAR nên chuyển hướng mượt, không gãy khúc).
// Nền màu là chuyện của scalar-field/scalar-gl — file này CHỈ lo chuyển động.
//
// Đơn vị: u (đông+) / v (bắc+) theo km/h. Hướng nguồn là "TỚI TỪ" (chuẩn khí
// tượng) → hướng BAY = from + 180°. Sóng không có tốc độ km/h nên lấy độ cao
// (m) × hệ số làm tốc độ TƯỢNG TRƯNG (chỉ để hạt chạy nhanh chậm theo sóng to
// nhỏ — không phải vận tốc thật, không hiển thị số).

import type { ForecastGrid, ForecastKind } from "@/lib/forecast-grid";

export interface UVField {
  nLat: number;
  nLon: number;
  lat0: number;
  lon0: number;
  dLat: number;
  dLon: number;
  /** km/h — NaN = ô thiếu số */
  u: Float32Array;
  v: Float32Array;
}

/** Sóng: m → "km/h tượng trưng" cho tốc độ hạt (2 m ≈ gió 24 km/h nhìn vừa mắt) */
const WAVE_M_TO_KMH = 12;

/**
 * Dựng trường u/v từ lưới dự báo tại một mốc giờ. Kích thước lưới TỰ SUY từ
 * cells (row-major: đếm cells cùng lat đầu = nLon) — bản lưu lưới CŨ trong máy
 * (80/110 ô trước khi mở 156) vẫn chạy, không chết theo hằng số hiện tại.
 */
export function buildUVField(
  grid: ForecastGrid,
  timeIdx: number,
  kind: ForecastKind,
): UVField | null {
  const cells = grid.cells;
  if (!cells?.length) return null;
  let nLon = 1;
  while (nLon < cells.length && cells[nLon].lat === cells[0].lat) nLon++;
  const nLat = Math.floor(cells.length / nLon);
  if (nLat < 2 || nLon < 2 || nLat * nLon !== cells.length) return null;
  const u = new Float32Array(nLat * nLon).fill(NaN);
  const v = new Float32Array(nLat * nLon).fill(NaN);
  for (let i = 0; i < grid.cells.length; i++) {
    const h = grid.cells[i].hours[timeIdx];
    if (!h) continue;
    const speed =
      kind === "wind"
        ? h.windKmh
        : h.waveM != null
          ? h.waveM * WAVE_M_TO_KMH
          : null;
    const from = kind === "wind" ? h.windDirDeg : h.waveDirDeg;
    if (speed == null || from == null) continue;
    const toRad = (((from + 180) % 360) * Math.PI) / 180;
    u[i] = speed * Math.sin(toRad);
    v[i] = speed * Math.cos(toRad);
  }
  const c = grid.cells;
  const lat0 = c[0].lat;
  const lon0 = c[0].lon;
  return {
    nLat,
    nLon,
    lat0,
    lon0,
    dLat: (c[(nLat - 1) * nLon].lat - lat0) / (nLat - 1),
    dLon: (c[nLon - 1].lon - lon0) / (nLon - 1),
    u,
    v,
  };
}

/**
 * u/v tại (lat,lon) — BILINEAR (chuyển ô mượt). Ngoài lưới → null.
 *
 * Góc THIẾU SỐ (đất liền với lớp sóng — marine API trả null trên bờ/đảo) thì
 * BỎ góc đó và CHIA LẠI trọng số cho các góc còn số — không giết cả quad.
 * Vì sao (user 2026-07-29, ảnh lớp sóng "ô có ô không"): lưới thưa ~2°, đòi đủ
 * 4 góc thì MỘT ô đất (Hải Nam, ven bờ, Luzon…) tắt hạt cả vùng ~2°×2° quanh
 * nó trong khi màu + mũi tên (vẽ theo TỪNG ô) vẫn hiện — loang lổ. Ngưỡng 0,25:
 * quá 3/4 trọng số rơi vào góc thiếu (đi sâu về phía đất) thì hạt chết như cũ.
 */
export function sampleUV(
  f: UVField,
  lat: number,
  lon: number,
): [number, number] | null {
  const fi = (lat - f.lat0) / f.dLat;
  const fj = (lon - f.lon0) / f.dLon;
  if (fi < 0 || fj < 0 || fi > f.nLat - 1 || fj > f.nLon - 1) return null;
  const i0 = Math.min(f.nLat - 2, Math.floor(fi));
  const j0 = Math.min(f.nLon - 2, Math.floor(fj));
  const di = fi - i0;
  const dj = fj - j0;
  const idx = (i: number, j: number) => i * f.nLon + j;
  const corners = [idx(i0, j0), idx(i0, j0 + 1), idx(i0 + 1, j0), idx(i0 + 1, j0 + 1)];
  const weights = [
    (1 - di) * (1 - dj),
    (1 - di) * dj,
    di * (1 - dj),
    di * dj,
  ];
  let sw = 0;
  let su = 0;
  let sv = 0;
  for (let k = 0; k < 4; k++) {
    const c = corners[k];
    if (!Number.isFinite(f.u[c])) continue;
    sw += weights[k];
    su += f.u[c] * weights[k];
    sv += f.v[c] * weights[k];
  }
  if (sw < 0.25) return null;
  return [su / sw, sv / sw];
}

const KM_PER_DEG = 111;

/**
 * Bước một hạt: (lat,lon) → vị trí mới sau `dtSec`, tốc độ nhân `speedFactor`.
 * Tốc THẬT quá chậm để thấy (36 km/h ≈ 0,0004°/frame) — Windy cũng phóng đại;
 * 15000 cho gió 36 km/h chạy ~1,3°/s: thong thả ở zoom 4, sống động khi zoom
 * gần. Trả null khi ra ngoài lưới / ô thiếu — hạt chết, chỗ gọi respawn.
 */
export function stepParticle(
  f: UVField,
  lat: number,
  lon: number,
  dtSec: number,
  speedFactor = 15000,
): [number, number] | null {
  const uv = sampleUV(f, lat, lon);
  if (!uv) return null;
  const kmPerH = dtSec / 3600;
  const dLat = ((uv[1] * kmPerH) / KM_PER_DEG) * speedFactor;
  const dLon =
    ((uv[0] * kmPerH) /
      (KM_PER_DEG * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))) *
    speedFactor;
  return [lat + dLat, lon + dLon];
}
