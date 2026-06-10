import { describe, expect, it } from "vitest";
import { borderProximity, haversineKm } from "../geofence";
import type { LngLat } from "@/data/vn-maritime-border";

describe("haversineKm", () => {
  it("0 khi cùng điểm", () => {
    expect(haversineKm(10, 107, 10, 107)).toBeCloseTo(0, 5);
  });
  it("1 độ vĩ ≈ 111 km", () => {
    expect(haversineKm(10, 107, 11, 107)).toBeGreaterThan(110);
    expect(haversineKm(10, 107, 11, 107)).toBeLessThan(112);
  });
});

describe("borderProximity", () => {
  // Ranh giả lập: một đoạn thẳng dọc kinh tuyến 110°E từ vĩ 9 tới 11.
  const line: LngLat[] = [
    [110, 9],
    [110, 11],
  ];

  it("điểm ngay trên ranh → ~0 hải lý, very_near", () => {
    const r = borderProximity(10, 110, line);
    expect(r.distanceNm).toBeLessThan(0.2);
    expect(r.level).toBe("very_near");
  });

  it("cách ~30 hải lý phía tây → mức ok", () => {
    // 0.92 độ lng tại vĩ 10 ≈ 0.92*111.32*cos10 ≈ 100km ≈ 54 hải lý... dùng nhỏ hơn
    const r = borderProximity(10, 109.0, line); // ~1 độ lng ~ 59 hải lý
    expect(r.level).toBe("ok");
    expect(r.distanceNm).toBeGreaterThan(40);
  });

  it("trong vùng near (≈10 hải lý) → mức near", () => {
    // 10 hải lý ≈ 18.52 km; tại vĩ 10, 1 độ lng ≈ 109.6 km → 0.169 độ
    const r = borderProximity(10, 110 - 0.169, line);
    expect(r.level).toBe("near");
    expect(r.distanceNm).toBeGreaterThan(6);
    expect(r.distanceNm).toBeLessThan(15);
  });

  it("nearest nằm trong đoạn (kẹp t)", () => {
    // điểm ngang vĩ 10 → chiếu vào giữa đoạn, lat nearest ≈ 10
    const r = borderProximity(10, 109.5, line);
    expect(r.nearest[1]).toBeCloseTo(10, 1);
    expect(r.nearest[0]).toBeCloseTo(110, 3);
  });

  it("điểm ngoài đầu mút → chiếu về đỉnh gần nhất", () => {
    // vĩ 13 (trên đỉnh lat 11) → nearest kẹp về [110,11]
    const r = borderProximity(13, 110, line);
    expect(r.nearest[1]).toBeCloseTo(11, 1);
  });
});

describe("borderProximity với ranh giới VN thật", () => {
  it("giữa Biển Đông xa ranh → ok, khoảng cách hợp lý", () => {
    // gần Vũng Tàu (10.3, 107.1) — cách ranh ngoài khá xa
    const r = borderProximity(10.3, 107.1);
    expect(r.level).toBe("ok");
    expect(r.distanceNm).toBeGreaterThan(15);
    expect(Number.isFinite(r.distanceNm)).toBe(true);
  });

  it("ngay tại một điểm mốc ranh giới → rất gần", () => {
    // điểm mốc trong dữ liệu: [111.02425, 6.249944]
    const r = borderProximity(6.249944, 111.02425);
    expect(r.distanceNm).toBeLessThan(1);
    expect(r.level).toBe("very_near");
  });
});
