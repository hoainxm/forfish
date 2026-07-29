// Trục 1 — DỰNG DỮ LIỆU cho lớp WebGL nền màu MỊN (kiểu Windy).
//
// Windy vẽ trường vô hướng bằng TEXTURE + GPU nội suy bilinear (không phải
// polygon). File này lo phần THUẦN, test được: (a) đóng gói lưới giá trị thành
// texture RGBA (R = giá trị chuẩn hoá 0..1, G = cờ hợp lệ) để GPU LINEAR nội
// suy mượt; (b) nướng thang màu SCALAR_RAMP thành ramp texture 1 chiều 256px.
// Phần WebGL (shader, custom layer) ở components/scalar-gl-field.tsx.

import {
  SCALAR_RAMP,
  scalarColor,
  fillCoastalGaps,
  type ScalarKind,
  type ScalarGrid,
} from "@/lib/scalar-field";
import { GRID_N_LAT, GRID_N_LON } from "@/lib/forecast-grid";

/** [min, max] của thang màu một lớp (từ chặng đầu/cuối SCALAR_RAMP) */
export function rampRange(kind: ScalarKind): [number, number] {
  const s = SCALAR_RAMP[kind];
  return [s[0].value, s[s.length - 1].value];
}

/** Hộp bao (bbox) của lưới: [west, south, east, north] theo cells (lat/lon tăng) */
export function gridBounds(grid: ScalarGrid): {
  west: number;
  south: number;
  east: number;
  north: number;
  nLat: number;
  nLon: number;
} {
  const nLat = grid.nLat ?? GRID_N_LAT;
  const nLon = grid.nLon ?? GRID_N_LON;
  const c = grid.cells;
  return {
    west: c[0].lon,
    south: c[0].lat,
    east: c[nLon - 1].lon,
    north: c[(nLat - 1) * nLon].lat,
    nLat,
    nLon,
  };
}

/**
 * Texture giá trị RGBA (nLon × nLat, hàng từ NAM→BẮC = thứ tự cells row-major).
 * R = (v−min)/(max−min) kẹp [0,1] × 255; G = 255 nếu ô có số, 0 nếu null (đất/
 * thiếu) — GPU LINEAR nội suy cả hai, fragment loại ô có cờ < 0.5. B,A = 0/255.
 * Trả null nếu lưới sai kích thước.
 */
export function buildValueTexture(
  grid: ScalarGrid,
  timeIdx: number,
): { data: Uint8Array; nLat: number; nLon: number } | null {
  const nLat = grid.nLat ?? GRID_N_LAT;
  const nLon = grid.nLon ?? GRID_N_LON;
  if (grid.cells.length !== nLat * nLon) return null;
  const [min, max] = rampRange(grid.kind);
  const span = max - min || 1;
  // lan màu ven bờ TRƯỚC khi nướng texture — hết thủng lỗ sát bờ. Lưới gắn
  // noFill (dòng chảy tầng sâu) thì GIỮ NGUYÊN null — vùng nông phải trống thật.
  const raw = grid.cells.map((c) => {
    const v = c.values[timeIdx];
    return v != null && Number.isFinite(v) ? v : null;
  });
  const values = grid.noFill ? raw : fillCoastalGaps(raw, nLat, nLon);
  const data = new Uint8Array(nLat * nLon * 4);
  for (let i = 0; i < nLat * nLon; i++) {
    const v = values[i];
    const o = i * 4;
    if (v == null) {
      data[o] = 0;
      data[o + 1] = 0; // cờ null (xa biển hẳn — 2 vòng lan không tới)
    } else {
      const n = Math.max(0, Math.min(1, (v - min) / span));
      data[o] = Math.round(n * 255);
      data[o + 1] = 255; // hợp lệ
    }
    data[o + 3] = 255;
  }
  return { data, nLat, nLon };
}

/** Ramp texture 1 chiều: 256×1 RGBA, nướng SCALAR_RAMP (đã có alpha) qua
    scalarColor để shader tra `texture2D(ramp, vec2(n, .5))`. */
export function buildRampTexture(kind: ScalarKind, width = 256): Uint8Array {
  const [min, max] = rampRange(kind);
  const span = max - min || 1;
  const data = new Uint8Array(width * 4);
  for (let x = 0; x < width; x++) {
    const v = min + (x / (width - 1)) * span;
    const css = scalarColor(kind, v); // "rgba(r,g,b,a)"
    const m = css.match(/rgba?\(([^)]+)\)/);
    const p = m ? m[1].split(",").map((s) => parseFloat(s)) : [0, 0, 0, 0];
    data[x * 4] = p[0] || 0;
    data[x * 4 + 1] = p[1] || 0;
    data[x * 4 + 2] = p[2] || 0;
    data[x * 4 + 3] = Math.round((p[3] ?? 1) * 255);
  }
  return data;
}
