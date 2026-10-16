import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PORTS } from "@/data/ports";
import { decodeDepthGrid, depthClassAt } from "@/lib/depth-grid";
import { bboxFor, DEFAULT_BOAT, haversineKm, planRouteWithDiagnostics, type WeatherField } from "@/lib/route-plan";

/*  TUYẾN TỪ CẢNG KHÔNG ĐƯỢC CẮT QUA BÁN ĐẢO / ĐẢO SÁT CẢNG (2026-10-16, chủ dự
    án: "tính từ cảng ra thì một số điểm đi xuyên luôn cả đảo"). Trước bản sửa,
    đất trong vòng nới 5 km quanh cảng không tốn gì ⇒ Quy Nhơn đi thẳng qua
    Phương Mai (~3 km đất), Thọ Quang cắt Sơn Trà, Hòn Rớ cắt doi đất. Đo bằng
    CHÍNH lưới độ sâu máy dùng để tìm đường, mẫu 100 m, bỏ 1,5 km quanh mỗi đầu
    (bản thân cái cảng). */
const buf = readFileSync("public/data/depth-grid.v1.bin");
const depth = decodeDepthGrid(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
const calm = Array.from({ length: 96 }, () => ({
  waveM: 0.5, waveFromDeg: 90, wavePeriodS: 6, windKmh: 10, windFromDeg: 90, currentKmh: 0, currentToDeg: null,
}));
const field: WeatherField = {
  lat0: 0, lon0: 100, dLat: 1, dLon: 1, nLat: 26, nLon: 22,
  cells: Array.from({ length: 26 * 22 }, () => ({ onSea: true, hours: calm })),
};

function landKmOutsidePort(w: { lat: number; lon: number }[]): number {
  const a = w[0];
  const b = w[w.length - 1];
  let km = 0;
  for (let i = 1; i < w.length; i++) {
    const L = haversineKm(w[i - 1], w[i]);
    const n = Math.max(1, Math.ceil(L / 0.1));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const p = { lat: w[i - 1].lat + (w[i].lat - w[i - 1].lat) * t, lon: w[i - 1].lon + (w[i].lon - w[i - 1].lon) * t };
      if (haversineKm(p, a) <= 1.5 || haversineKm(p, b) <= 1.5) continue;
      if (depthClassAt(depth, p.lat, p.lon) === 0) km += L / n;
    }
  }
  return km;
}

const port = (id: string) => {
  const p = PORTS.find((x) => x.id === id)!;
  return { lat: p.lat, lon: p.lon };
};

/*  KHÔNG có Thọ Quang: toạ độ của nó trong `ports.ts` (16.12, 108.26 — điểm đã
    kiểm cho DỰ BÁO sóng) nằm giữa bán đảo Sơn Trà, cách ô nước gần nhất ~2,5
    km; tuyến buộc phải dẫm đoạn đất đó (nay là đoạn NGẮN NHẤT ra cửa sông, thay
    vì cắt ngang cả bán đảo). Sửa toạ độ cảng là việc của dữ liệu, không phải
    của bộ tìm đường. */
describe("tuyến từ cảng không cắt qua đất sát cảng", () => {
  it.each([
    ["quy-nhon", { lat: 14.12, lon: 109.27 }],
    ["quy-nhon", { lat: 14.015, lon: 109.532 }],
    ["hon-ro", { lat: 12.455, lon: 109.511 }],
    ["hon-ro", { lat: 12.2, lon: 109.619 }],
  ])("%s → %o", (id, dest) => {
    const start = port(id);
    const o = planRouteWithDiagnostics({
      start, dest, boat: DEFAULT_BOAT, departHourIdx: 0, field, depth, bbox: bboxFor(start, dest, 60),
    });
    expect(o.plan).not.toBeNull();
    expect(landKmOutsidePort(o.plan!.waypoints)).toBeLessThanOrEqual(0.3);
  });
});
