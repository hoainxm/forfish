import { describe, it, expect } from "vitest";

import {
  legRisk,
  summarizeLegs,
  cumulativeKmAt,
  legProgressAt,
} from "../route-legs";
import {
  CAUTION_WAVE_M,
  CAUTION_WIND_KMH,
  DANGER_WAVE_M,
  DANGER_WIND_KMH,
} from "../route-plan";
import type { LatLon, RoutePlan } from "../route-plan";

/** Chặng mẫu "sạch" — từng ca tự bật đúng cờ mình soi */
function leg(over: Partial<RoutePlan> = {}): RoutePlan {
  return {
    waypoints: [
      { lat: 13, lon: 110 },
      { lat: 14, lon: 111 },
    ],
    distKm: 100,
    hours: 8,
    fuelL: 160,
    maxWaveM: 1,
    maxWindKmh: 20,
    hasRoughLeg: false,
    hasShallowLeg: false,
    hasVeryShallowLeg: false,
    hasNearLandLeg: false,
    hasDraftShallowLeg: false,
    nearPortOnly: false,
    hoursAt: [0, 8],
    hasFollowingSeaRisk: false,
    depthChecked: true,
    hazardChecked: false,
    hasHazardLeg: false,
    hasHazardNearPortLeg: false,
    cappedToDirect: false,
    direct: null,
    fuelDeltaL: null,
    beyondForecastH: 0,
    bestEffortSeas: false,
    segRisks: [],
    ...over,
  };
}

describe("legRisk — chấm mức lưu ý cho MỘT chặng", () => {
  it("chặng sạch ⇒ xanh, KHÔNG bịa cớ", () => {
    const r = legRisk(leg());
    expect(r.risk).toBe("blue");
    expect(r.reason).toBeNull();
  });

  it("đỏ: bãi rất cạn · sát đất · sóng/gió mức nguy hiểm · khúc sóng gió dữ", () => {
    expect(legRisk(leg({ hasVeryShallowLeg: true })).risk).toBe("red");
    expect(legRisk(leg({ hasNearLandLeg: true })).risk).toBe("red");
    expect(legRisk(leg({ maxWaveM: DANGER_WAVE_M })).risk).toBe("red");
    expect(legRisk(leg({ maxWindKmh: DANGER_WIND_KMH })).risk).toBe("red");
    expect(legRisk(leg({ hasRoughLeg: true })).risk).toBe("red");
  });

  it("cam: chưa kiểm độ sâu · nước nông · sóng đuôi · sóng/gió mức chú ý", () => {
    expect(legRisk(leg({ depthChecked: false })).risk).toBe("amber");
    expect(legRisk(leg({ hasShallowLeg: true })).risk).toBe("amber");
    expect(legRisk(leg({ hasFollowingSeaRisk: true })).risk).toBe("amber");
    expect(legRisk(leg({ maxWaveM: CAUTION_WAVE_M })).risk).toBe("amber");
    expect(legRisk(leg({ maxWindKmh: CAUTION_WIND_KMH })).risk).toBe("amber");
  });

  /*  VẬT CHẶN (Đợt 2, 2026-09-04): đỏ và ĐỨNG TRƯỚC mọi cớ khác — chặng đi vào
      vòng chặn của xác tàu/giàn khoan là mối nguy nặng nhất trong bảng. */
  it("đỏ: chặng dính vật chặn, thắng cả bãi rất cạn", () => {
    const r = legRisk(leg({ hasHazardLeg: true, hasVeryShallowLeg: true }));
    expect(r.risk).toBe("red");
    expect(r.reason).toContain("vật chìm");
  });

  /*  Còn cờ SÁT BẾN thì CỐ Ý không đổi màu chặng: cảng nào cũng có lồng bè trong
      5 km, tô cam cả chặng 200 km vì một cái lồng bè ở bến là làm bà con quen
      mắt rồi thôi không nhìn nữa. Nó được nói bằng một dòng vàng trên thẻ tuyến. */
  it("cờ vật sát bến KHÔNG làm chặng đổi màu", () => {
    expect(legRisk(leg({ hasHazardNearPortLeg: true })).risk).toBe("blue");
  });

  it("ngay DƯỚI ngưỡng chú ý vẫn là xanh (biên không được nhích)", () => {
    expect(legRisk(leg({ maxWaveM: CAUTION_WAVE_M - 0.01 })).risk).toBe("blue");
    expect(legRisk(leg({ maxWindKmh: CAUTION_WIND_KMH - 0.01 })).risk).toBe(
      "blue",
    );
  });

  it("đỏ THẮNG cam khi một chặng dính cả hai — nói cớ nặng nhất", () => {
    const r = legRisk(leg({ hasVeryShallowLeg: true, hasShallowLeg: true }));
    expect(r.risk).toBe("red");
    expect(r.reason).toContain("rất cạn");
  });

  it("mỗi mức đỏ/cam đều KÈM CỚ — không có nhãn cảnh báo trống", () => {
    for (const p of [
      leg({ hasHazardLeg: true }),
      leg({ hasVeryShallowLeg: true }),
      leg({ hasNearLandLeg: true }),
      leg({ maxWaveM: DANGER_WAVE_M }),
      leg({ maxWindKmh: DANGER_WIND_KMH }),
      leg({ hasRoughLeg: true }),
      leg({ depthChecked: false }),
      leg({ hasShallowLeg: true }),
      leg({ hasFollowingSeaRisk: true }),
      leg({ maxWaveM: CAUTION_WAVE_M }),
      leg({ maxWindKmh: CAUTION_WIND_KMH }),
    ]) {
      const r = legRisk(p);
      expect(r.risk).not.toBe("blue");
      expect(r.reason).toBeTruthy();
    }
  });

  it("summarizeLegs giữ đúng thứ tự + mang theo quãng/giờ của từng chặng", () => {
    const s = summarizeLegs([
      leg({ distKm: 40, hours: 3 }),
      leg({ distKm: 60, hours: 5, hasShallowLeg: true }),
    ]);
    expect(s.map((x) => x.risk)).toEqual(["blue", "amber"]);
    expect(s.map((x) => x.distKm)).toEqual([40, 60]);
    expect(s.map((x) => x.hours)).toEqual([3, 5]);
  });
});

describe("cumulativeKmAt — mốc quãng dọc tuyến", () => {
  const wps: LatLon[] = [
    { lat: 13, lon: 110 },
    { lat: 13.5, lon: 110 },
    { lat: 14, lon: 110 },
    { lat: 14.5, lon: 110 },
  ];

  it("mốc đầu = 0, mốc sau luôn lớn hơn mốc trước", () => {
    const c = cumulativeKmAt(wps, [0, 1, 3]);
    expect(c[0]).toBe(0);
    expect(c[1]).toBeGreaterThan(0);
    expect(c[2]).toBeGreaterThan(c[1]);
  });

  it("nửa độ vĩ ≈ 55,6 km — đo trên chính waypoints, cùng thước với alongKm", () => {
    const c = cumulativeKmAt(wps, [1]);
    expect(c[0]).toBeGreaterThan(54);
    expect(c[0]).toBeLessThan(57);
  });

  it("chỉ số ngoài mảng bị kẹp lại, KHÔNG trả undefined", () => {
    expect(cumulativeKmAt(wps, [99])[0]).toBe(cumulativeKmAt(wps, [3])[0]);
    expect(cumulativeKmAt(wps, [-5])[0]).toBe(0);
  });
});

describe("legProgressAt — tàu đang ở chặng nào", () => {
  const bounds = [50, 120, 200]; // 3 chặng

  it("chưa rời bến ⇒ chặng 0, chưa qua chặng nào", () => {
    const p = legProgressAt(bounds, 0, 10);
    expect(p.currentLeg).toBe(0);
    expect(p.passed).toEqual([false, false, false]);
    expect(p.toNextKm).toBe(50);
  });

  it("qua mốc chặng 1 ⇒ chặng 1 xám, đang chạy chặng 2", () => {
    const p = legProgressAt(bounds, 60, 10);
    expect(p.currentLeg).toBe(1);
    expect(p.passed).toEqual([true, false, false]);
    expect(p.toNextKm).toBe(60);
    expect(p.toNextH).toBeCloseTo(6, 5);
  });

  it("đúng NGAY mốc thì tính là đã qua (đứng ở chỗ ghé = tới rồi)", () => {
    expect(legProgressAt(bounds, 50, 10).passed[0]).toBe(true);
  });

  it("qua hết ⇒ currentLeg = số chặng, không còn điểm kế", () => {
    const p = legProgressAt(bounds, 250, 10);
    expect(p.currentLeg).toBe(3);
    expect(p.passed).toEqual([true, true, true]);
    expect(p.toNextKm).toBeNull();
    expect(p.toNextH).toBeNull();
  });

  it("CHƯA BIẾT TỐC ĐỘ ⇒ không đoán giờ (thà im còn hơn nói sai giờ về bến)", () => {
    expect(legProgressAt(bounds, 60, null).toNextH).toBeNull();
    expect(legProgressAt(bounds, 60, 0).toNextH).toBeNull();
  });

  it("quãng còn lại không bao giờ âm", () => {
    expect(legProgressAt([50], 49.999, 10).toNextKm).toBeGreaterThanOrEqual(0);
  });
});
