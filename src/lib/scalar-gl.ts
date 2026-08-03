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
  /*  ═══ Ô NULL VẪN PHẢI MANG MỘT GIÁ TRỊ ĐỌC ĐƯỢC ═══ (2026-08-03)

      GPU nội suy LINEAR **cả hai kênh**, không chỉ cờ hợp lệ. Bản cũ ghi `R = 0`
      cho ô null, tức GIÁ TRỊ ĐẦU THANG MÀU — nên mọi điểm ảnh nằm giữa một ô có
      số và một ô null bị kéo màu tụt về đầu thang. Trên lưới thô ~1,7°×2,1°
      (≈190×230 km/ô) và tầng sâu 50 m có tới 83/156 ô null (đáy nông hơn tầng),
      cái "kéo tụt" đó chiếm gần nửa vùng nhìn thấy: đúng mấy vệt nhợt nhạt viền
      quanh các mảng màu mà chủ dự án chụp lại được.

      Nay ô null mang giá trị của Ô CÓ SỐ GẦN NHẤT (lan theo vòng đồng tâm) —
      chỉ để phép nội suy có số tử tế mà nhân; cờ hợp lệ VẪN = 0 nên chỗ đó không
      được vẽ. Khác hẳn `fillCoastalGaps`: kia BỊA RA SỐ để vẽ thật, đây chỉ đệm
      cho phép toán, không một điểm ảnh nào của vùng nông được tô. */
  const filled = nearestValueFill(values, nLat, nLon);
  const data = new Uint8Array(nLat * nLon * 4);
  for (let i = 0; i < nLat * nLon; i++) {
    const v = filled[i];
    const o = i * 4;
    const n = v == null ? 0 : Math.max(0, Math.min(1, (v - min) / span));
    data[o] = Math.round(n * 255);
    data[o + 1] = values[i] == null ? 0 : 255; // cờ hợp lệ theo lưới GỐC
    data[o + 3] = 255;
  }
  return { data, nLat, nLon };
}

/**
 * ĐỆM GIÁ TRỊ cho ô null bằng ô CÓ SỐ gần nhất (khoảng cách ô, lan lần lượt từ
 * mọi ô có số ra — BFS). KHÔNG đổi ô nào đang có số, KHÔNG dùng để vẽ: cờ hợp lệ
 * mới quyết định vẽ hay không (xem `buildValueTexture`).
 *
 * Trả mảng MỚI; lưới không có ô nào có số thì trả nguyên bản.
 * THUẦN — test được.
 */
export function nearestValueFill(
  values: (number | null)[],
  nLat: number,
  nLon: number,
): (number | null)[] {
  const out = values.slice();
  const queue: number[] = [];
  for (let i = 0; i < out.length; i++) if (out[i] != null) queue.push(i);
  if (queue.length === 0 || queue.length === out.length) return out;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const r = Math.floor(i / nLon);
    const c = i % nLon;
    const v = out[i];
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= nLat || nc < 0 || nc >= nLon) continue;
      const j = nr * nLon + nc;
      if (out[j] != null) continue;
      out[j] = v;
      queue.push(j);
    }
  }
  return out;
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
