import { describe, expect, it } from "vitest";

import {
  projectOntoRoute,
  routeLengthKm,
  steerCue,
  etaHours,
  computeNavProgress,
  mpsToKmh,
  knotToKmh,
  ARRIVE_KM,
  OFF_ROUTE_WARN_KM,
  MIN_MOVING_KMH,
} from "../nav-progress";
import { haversineKm, type LatLon } from "../route-plan";

// Tuyến thử: đi thẳng về ĐÔNG dọc vĩ độ 10° (dễ suy khoảng cách).
// Ở 10°, 1° kinh ≈ 111,32·cos10° ≈ 109,6 km.
const A: LatLon = { lat: 10, lon: 108 };
const B: LatLon = { lat: 10, lon: 109 };
const STRAIGHT = [A, B];
// Tuyến có KHÚC GIỮA: A → M(giữa) → B
const M: LatLon = { lat: 10, lon: 108.5 };
const BEND = [A, M, B];

describe("projectOntoRoute", () => {
  it("điểm nằm GIỮA tuyến → lệch ~0, quãng dọc ~ nửa tuyến", () => {
    const total = haversineKm(A, B);
    const p = projectOntoRoute({ lat: 10, lon: 108.5 }, STRAIGHT);
    expect(p.offRouteKm).toBeLessThan(0.05);
    expect(p.alongKm).toBeCloseTo(total / 2, 0);
    expect(p.segIdx).toBe(0);
  });

  it("điểm lệch sang một bên → offRouteKm = khoảng vuông góc", () => {
    // lệch 0,1° vĩ ≈ 11,13 km về phía bắc
    const p = projectOntoRoute({ lat: 10.1, lon: 108.5 }, STRAIGHT);
    expect(p.offRouteKm).toBeCloseTo(0.1 * 111.32, 0);
    expect(p.alongKm).toBeCloseTo(haversineKm(A, B) / 2, 0);
  });

  it("điểm trước đầu tuyến → kẹp về đầu (t=0)", () => {
    const p = projectOntoRoute({ lat: 10, lon: 107.5 }, STRAIGHT);
    expect(p.tOnSeg).toBe(0);
    expect(p.alongKm).toBeCloseTo(0, 5);
  });

  it("tuyến 1 điểm → chính điểm đó, lệch = khoảng cách thẳng", () => {
    const p = projectOntoRoute({ lat: 10, lon: 108 }, [B]);
    expect(p.snapped).toEqual(B);
    expect(p.offRouteKm).toBeCloseTo(haversineKm({ lat: 10, lon: 108 }, B), 5);
  });
});

describe("routeLengthKm", () => {
  it("cộng dồn từng đoạn", () => {
    expect(routeLengthKm(BEND)).toBeCloseTo(haversineKm(A, M) + haversineKm(M, B), 5);
  });
  it("tuyến rỗng/1 điểm → 0", () => {
    expect(routeLengthKm([])).toBe(0);
    expect(routeLengthKm([A])).toBe(0);
  });
});

describe("steerCue", () => {
  it("chưa có hướng tàu → null (không bịa mũi tên)", () => {
    expect(steerCue(null, 90)).toBeNull();
  });
  it("lệch ≤12° → Đi thẳng", () => {
    expect(steerCue(90, 90)?.side).toBe("straight");
    expect(steerCue(90, 100)?.label).toBe("Đi thẳng");
  });
  it("lệch 13–45° → Chếch, đúng bên", () => {
    expect(steerCue(90, 120)).toMatchObject({ side: "right", label: "Chếch phải" });
    expect(steerCue(90, 60)).toMatchObject({ side: "left", label: "Chếch trái" });
  });
  it("lệch >45° → Rẽ, đúng bên (kể cả vòng qua 360)", () => {
    expect(steerCue(90, 200)).toMatchObject({ side: "right", label: "Rẽ phải" });
    expect(steerCue(90, 350)).toMatchObject({ side: "left", label: "Rẽ trái" });
  });
});

describe("etaHours", () => {
  it("chưa biết tốc độ → null", () => {
    expect(etaHours(100, null)).toBeNull();
  });
  it("tàu chưa chạy (dưới ngưỡng) → null", () => {
    expect(etaHours(100, MIN_MOVING_KMH - 0.1)).toBeNull();
  });
  it("đang chạy → quãng / tốc độ", () => {
    expect(etaHours(100, 20)).toBeCloseTo(5, 5);
  });
});

describe("mpsToKmh / knotToKmh", () => {
  it("m/s → km/h; null/âm/NaN → null", () => {
    expect(mpsToKmh(10)).toBeCloseTo(36, 5);
    expect(mpsToKmh(null)).toBeNull();
    expect(mpsToKmh(-1)).toBeNull();
    expect(mpsToKmh(NaN)).toBeNull();
  });
  it("hải lý/giờ → km/h", () => {
    expect(knotToKmh(10)).toBeCloseTo(18.52, 5);
  });
});

describe("computeNavProgress — bám tuyến", () => {
  const base = { headingDeg: 90, speedKmh: knotToKmh(10) };

  it("quãng còn lại GIẢM DẦN khi tiến về đích", () => {
    const at = (lon: number) =>
      computeNavProgress({ ...base, pos: { lat: 10, lon }, waypoints: STRAIGHT }).remainingKm;
    const r1 = at(108.2);
    const r2 = at(108.5);
    const r3 = at(108.8);
    expect(r1).toBeGreaterThan(r2);
    expect(r2).toBeGreaterThan(r3);
  });

  it("nextWp là khúc rẽ PHÍA TRƯỚC — bỏ qua khúc đã vượt", () => {
    // trước khúc giữa → nextWp = M
    const before = computeNavProgress({
      ...base, pos: { lat: 10, lon: 108.3 }, waypoints: BEND,
    });
    expect(before.nextWp).toEqual(M);
    // đã vượt khúc giữa → nextWp = B (đích)
    const after = computeNavProgress({
      ...base, pos: { lat: 10, lon: 108.7 }, waypoints: BEND,
    });
    expect(after.nextWp).toEqual(B);
  });

  it("tới gần đích (≤ ARRIVE_KM) → arrived", () => {
    const p = computeNavProgress({
      ...base, pos: { lat: 10, lon: 108.999 }, waypoints: STRAIGHT,
    });
    expect(p.remainingKm).toBeLessThanOrEqual(ARRIVE_KM);
    expect(p.arrived).toBe(true);
  });

  it("lệch tuyến quá ngưỡng → offRoute=true; sát tuyến → false", () => {
    const far = computeNavProgress({
      ...base, pos: { lat: 10.05, lon: 108.5 }, waypoints: STRAIGHT,
    });
    expect(far.offRouteKm).toBeGreaterThan(OFF_ROUTE_WARN_KM);
    expect(far.offRoute).toBe(true);

    const near = computeNavProgress({
      ...base, pos: { lat: 10.005, lon: 108.5 }, waypoints: STRAIGHT,
    });
    expect(near.offRoute).toBe(false);
  });

  it("chưa có hướng tàu → steer=null nhưng vẫn có bearing/dirVN tới nextWp", () => {
    const p = computeNavProgress({
      pos: { lat: 10, lon: 108.2 }, headingDeg: null, speedKmh: null, waypoints: STRAIGHT,
    });
    expect(p.steer).toBeNull();
    expect(p.etaHours).toBeNull();
    expect(p.bearingToNextDeg).toBeCloseTo(90, 0); // đi về đông
    expect(p.dirVN).toBe("Đông");
  });

  it("tuyến suy biến (1 điểm) → chim bay tới điểm đó", () => {
    const p = computeNavProgress({
      ...base, pos: { lat: 10, lon: 108 }, waypoints: [B],
    });
    expect(p.remainingKm).toBeCloseTo(haversineKm({ lat: 10, lon: 108 }, B), 1);
    expect(p.nextWp).toEqual(B);
  });
});
