// Trục 1 — lưới độ sâu tĩnh cho dẫn đường (ràng buộc tĩnh kiểu VISIR:
// bathymetry/shoreline). Nguồn: ETOPO 2022 (NOAA, public domain), đóng gói
// sẵn bằng scripts/generate-depth-grid.mjs → public/data/depth-grid.v1.bin
// (2 bit/ô, bước 0,05° ≈ 5,5 km). Đáy biển không đổi → asset tĩnh, runtime
// không gọi API ngoài. Đổi nguồn độ sâu chỉ sửa script + file này.

export type DepthClass =
  | 0 // đất liền (z > -2 m)
  | 1 // rất cạn (z > -4 m) — tuyến không đi qua (rạn, bãi nổi)
  | 2 // nước nông (z > -12 m) — đi được, cảnh báo (tàu cá VN mớn 1,5–3 m
  //   chạy vùng 5–8 m hằng ngày; ETOPO ~mực nước trung bình, triều ±2 m)
  | 3; // đủ sâu

// PHẢI khớp scripts/generate-depth-grid.mjs
export const DEPTH_META = {
  lat0: 5.0,
  lon0: 102.0,
  step: 0.05,
  nLat: 371,
  nLon: 321,
} as const;

export type DepthGrid = { data: Uint8Array };

export function decodeDepthGrid(buf: ArrayBuffer): DepthGrid {
  const data = new Uint8Array(buf);
  const need = Math.ceil((DEPTH_META.nLat * DEPTH_META.nLon) / 4);
  if (data.length !== need) {
    throw new Error(`depth grid sai cỡ: ${data.length} ≠ ${need}`);
  }
  return { data };
}

/** Lớp độ sâu tại một điểm — null khi ngoài vùng lưới (không kết luận gì) */
export function depthClassAt(
  g: DepthGrid,
  lat: number,
  lon: number,
): DepthClass | null {
  const { lat0, lon0, step, nLat, nLon } = DEPTH_META;
  const i = Math.round((lat - lat0) / step);
  const j = Math.round((lon - lon0) / step);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return null;
  const k = i * nLon + j;
  return ((g.data[k >> 2] >> ((k & 3) * 2)) & 3) as DepthClass;
}

let cached: Promise<DepthGrid> | null = null;

/** Tải lưới độ sâu (≈30 KB, cùng origin) — cache cho cả phiên */
export function fetchDepthGrid(): Promise<DepthGrid> {
  if (!cached) {
    cached = fetch("/data/depth-grid.v1.bin")
      .then((r) => {
        if (!r.ok) throw new Error(`depth grid ${r.status}`);
        return r.arrayBuffer();
      })
      .then(decodeDepthGrid)
      .catch((e) => {
        cached = null; // lần sau thử lại
        throw e;
      });
  }
  return cached;
}
