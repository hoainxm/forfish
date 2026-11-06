import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { decodeDepthGrid, depthClassAt } from "@/lib/depth-grid";
import {
  bboxOfPoints,
  DEFAULT_BOAT,
  haversineKm,
  planRouteWithDiagnostics,
  type BBox,
  type LatLon,
  type WeatherField,
} from "@/lib/route-plan";

/*  CHUYẾN XA TỪ CẢNG SÂU TRONG SÔNG / GIỮA ĐẢO (2026-11-06, chủ dự án: "nó phải
    luôn tìm được đường chứ?"). Trước bản sửa: quét 527 chuyến thật (cảng × điểm
    ngoài khơi, biển êm) thì 129 chuyến "Chưa tìm được đường" — cảng Ba Tri, Bình
    Khánh, Thạnh Phú (lòng sông lưới 450 m vẽ thành đất, bãi bùn cửa sông rộng hơn
    vòng nới 12 km), Cái Rồng, Hòn Gai (lối giữa đảo hẹp hơn ô lưới thô). Nay tách
    ba đoạn qua cửa biển (`planQuaCuaBien`); bộ quét đủ cảng 1019/1019 ra tuyến.
    06/11b: chuyến ngắn từ cảng cửa sông/giữa đảo cũng ra — quét 1901/1901 (5–700 km).
    Test này ghim các ca đại diện trên CHÍNH lưới độ sâu máy dùng. */
const buf = readFileSync("public/data/depth-grid.v1.bin");
const depth = decodeDepthGrid(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
const calm = Array.from({ length: 200 }, () => ({
  waveM: 0.5, waveFromDeg: 90, wavePeriodS: 6, windKmh: 10, windFromDeg: 90, currentKmh: 0, currentToDeg: null,
}));
const field: WeatherField = {
  lat0: 0, lon0: 100, dLat: 1, dLon: 1, nLat: 26, nLon: 22,
  cells: Array.from({ length: 26 * 22 }, () => ({ onSea: true, hours: calm })),
};
const VN: BBox = { latMin: 4, latMax: 24.5, lonMin: 99, lonMax: 119 };

/** đúng vòng margin đầu của route-planner (khung nhỏ) */
function khungDau(a: LatLon, b: LatLon): BBox {
  const d = haversineKm(a, b);
  const k = bboxOfPoints([a, b], Math.min(150, Math.max(45, d * 0.3)));
  return {
    latMin: Math.max(k.latMin, VN.latMin), latMax: Math.min(k.latMax, VN.latMax),
    lonMin: Math.max(k.lonMin, VN.lonMin), lonMax: Math.min(k.lonMax, VN.lonMax),
  };
}

function datKm(w: LatLon[]): number {
  let km = 0;
  for (let i = 1; i < w.length; i++) {
    const L = haversineKm(w[i - 1], w[i]);
    const n = Math.max(1, Math.ceil(L / 0.2));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      if (depthClassAt(depth, w[i - 1].lat + (w[i].lat - w[i - 1].lat) * t, w[i - 1].lon + (w[i].lon - w[i - 1].lon) * t) === 0) km += L / n;
    }
  }
  return km;
}

const CA: [string, LatLon, LatLon][] = [
  ["Ba Tri → khơi Côn Đảo", { lat: 9.976821, lon: 106.617499 }, { lat: 8.5, lon: 107.5 }],
  ["Bình Khánh → khơi Bình Thuận", { lat: 10.66356, lon: 106.775565 }, { lat: 10, lon: 109 }],
  ["Thạnh Phú → khơi Ninh Thuận", { lat: 9.882571, lon: 106.598325 }, { lat: 11.5, lon: 110.5 }],
  ["Mỹ Tho → khơi Vũng Tàu", { lat: 10.350849, lon: 106.378648 }, { lat: 10, lon: 107.5 }],
  ["Cái Rồng → vịnh Bắc Bộ", { lat: 21.061114, lon: 107.429209 }, { lat: 19, lon: 107.5 }],
  ["Hòn Gai → khơi Quảng Trị", { lat: 20.952837, lon: 107.08 }, { lat: 17.5, lon: 107.5 }],
  // chuyến NGẮN (2026-11-06b): một đầu thoáng — cả chuyến là đoạn ra cửa
  ["Ba Tri → khơi 25 km", { lat: 9.976821, lon: 106.617499 }, { lat: 9.976821, lon: 106.846 }],
  // chuyến ngắn không đầu nào thoáng — giữa đảo Bái Tử Long
  ["Cái Rồng → giữa đảo 25 km", { lat: 21.061114, lon: 107.429209 }, { lat: 20.902, lon: 107.26 }],
];

describe("chuyến xa từ cảng sâu trong sông / giữa đảo phải ra tuyến", () => {
  for (const [ten, a, b] of CA) {
    it(ten, () => {
      const o = planRouteWithDiagnostics({
        start: a, dest: b, boat: DEFAULT_BOAT, departHourIdx: 6, field, depth, bbox: khungDau(a, b),
      });
      expect(o.failure).toBeNull();
      const p = o.plan!;
      // hai đầu là toạ độ THẬT của bà con, không phải cửa biển
      expect(p.waypoints[0]).toEqual(a);
      expect(p.waypoints[p.waypoints.length - 1]).toEqual(b);
      // ghép chặng không làm lệch mảng giờ / mảng mức nguy hiểm từng khúc
      expect(p.hoursAt.length).toBe(p.waypoints.length);
      expect(p.segRisks.length).toBe(p.waypoints.length - 1);
      // không cắt ngang đồng bằng/đảo: tổng đất dẫm ≤ trần đoạn ra cửa (20 km) mỗi đầu
      expect(datKm(p.waypoints)).toBeLessThanOrEqual(20);
      // không vòng vô lý
      expect(p.distKm).toBeLessThan(haversineKm(a, b) * 2);
    });
  }
});
