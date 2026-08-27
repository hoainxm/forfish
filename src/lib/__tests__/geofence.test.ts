import { describe, expect, it } from "vitest";
import {
  borderProximity,
  borderStepCrossed,
  borderStepFor,
  haversineKm,
} from "../geofence";
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
  /*  borderProximity nay nhận NGUỒN BIÊN (đường biển + vùng kín) chứ không phải
      một mảng đường, vì phải phân biệt "ra ngoài bằng đường biển" với "ở phía bờ"
      (bà con 2026-08-25: biên chỉ áp dụng với đường biển). Các ca dưới chỉ đo
      khoảng cách nên vùng kín để rỗng. */
  const src = { line, polys: [] as LngLat[][][] };

  it("điểm ngay trên ranh → ~0 hải lý, very_near", () => {
    const r = borderProximity(10, 110, src);
    expect(r.distanceNm).toBeLessThan(0.2);
    expect(r.level).toBe("very_near");
  });

  it("cách ~30 hải lý phía tây → mức ok", () => {
    // 0.92 độ lng tại vĩ 10 ≈ 0.92*111.32*cos10 ≈ 100km ≈ 54 hải lý... dùng nhỏ hơn
    const r = borderProximity(10, 109.0, src); // ~1 độ lng ~ 59 hải lý
    expect(r.level).toBe("ok");
    expect(r.distanceNm).toBeGreaterThan(40);
  });

  it("trong vùng near (≈10 hải lý) → mức near", () => {
    // 10 hải lý ≈ 18.52 km; tại vĩ 10, 1 độ lng ≈ 109.6 km → 0.169 độ
    const r = borderProximity(10, 110 - 0.169, src);
    expect(r.level).toBe("near");
    expect(r.distanceNm).toBeGreaterThan(6);
    expect(r.distanceNm).toBeLessThan(15);
  });

  it("nearest nằm trong đoạn (kẹp t)", () => {
    // điểm ngang vĩ 10 → chiếu vào giữa đoạn, lat nearest ≈ 10
    const r = borderProximity(10, 109.5, src);
    expect(r.nearest[1]).toBeCloseTo(10, 1);
    expect(r.nearest[0]).toBeCloseTo(110, 3);
  });

  it("điểm ngoài đầu mút → chiếu về đỉnh gần nhất", () => {
    // vĩ 13 (trên đỉnh lat 11) → nearest kẹp về [110,11]
    const r = borderProximity(13, 110, src);
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

describe("mốc nói lại ranh giới khi dẫn đường (M3, 2026-08-18)", () => {
  it("borderStepFor: mốc nhỏ nhất mà d ≤ mốc; ngoài 15 hải lý → null", () => {
    expect(borderStepFor(20)).toBeNull();
    expect(borderStepFor(15)).toBe(15);
    expect(borderStepFor(12)).toBe(15);
    expect(borderStepFor(10)).toBe(10);
    expect(borderStepFor(8)).toBe(10);
    expect(borderStepFor(6)).toBe(6);
    expect(borderStepFor(4)).toBe(6);
    expect(borderStepFor(3)).toBe(3);
    expect(borderStepFor(0.5)).toBe(3);
    expect(borderStepFor(NaN)).toBeNull();
  });

  it("vào 15 nói một lần, đứng yên trong mốc thì im, vượt mốc gần hơn mới nói lại", () => {
    expect(borderStepCrossed(20, null)).toBeNull(); // còn xa
    expect(borderStepCrossed(14, null)).toBe(15); // vào 15 → nói
    expect(borderStepCrossed(13, 15)).toBeNull(); // vẫn 15 → im (không lặp mỗi giây)
    expect(borderStepCrossed(9.9, 15)).toBe(10); // 15→10 → nói
    expect(borderStepCrossed(7, 10)).toBeNull();
    expect(borderStepCrossed(5.5, 10)).toBe(6); // →6 nói
    expect(borderStepCrossed(2.9, 6)).toBe(3); // →3 nói
    expect(borderStepCrossed(1, 3)).toBeNull();
  });

  it("đi ra xa thì im; caller lùi mốc, quay lại gần được nhắc lại", () => {
    expect(borderStepCrossed(12, 6)).toBeNull(); // 6 → ra 15: im
    // caller đặt prev = borderStepFor(12) = 15, rồi tàu quay lại 8 hải lý
    expect(borderStepCrossed(8, borderStepFor(12))).toBe(10);
  });

  it("nhảy thẳng từ xa vào rất gần (GPS thưa) → nói ngay mốc gần nhất", () => {
    expect(borderStepCrossed(2, null)).toBe(3);
    expect(borderStepCrossed(2, 15)).toBe(3);
  });
});
