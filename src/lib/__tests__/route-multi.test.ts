import { describe, it, expect } from "vitest";

import { mergeLegPlans } from "../route-multi";
import type { LatLon, RoutePlan } from "../route-plan";

/** Chặng mẫu — mặc định "sạch", từng ca tự bật cờ mình cần soi */
function leg(waypoints: LatLon[], over: Partial<RoutePlan> = {}): RoutePlan {
  return {
    waypoints,
    distKm: 100,
    hours: 8,
    fuelL: 160,
    maxWaveM: 1.2,
    maxWindKmh: 20,
    hasRoughLeg: false,
    hasShallowLeg: false,
    hasVeryShallowLeg: false,
    hasNearLandLeg: false,
    hasFollowingSeaRisk: false,
    depthChecked: true,
    cappedToDirect: false,
    direct: { distKm: 95, hours: 7.5, fuelL: 150, maxWaveM: 1.1 },
    fuelDeltaL: 10,
    beyondForecastH: 0,
    ...over,
  };
}

const A = { lat: 13, lon: 110 };
const B = { lat: 14, lon: 111 };
const C = { lat: 15, lon: 112 };

describe("mergeLegPlans — nối các chặng thành MỘT tuyến", () => {
  it("không có chặng nào ⇒ null (nơi gọi tự lo, đừng để lọt tuyến rỗng)", () => {
    expect(mergeLegPlans([])).toBeNull();
  });

  it("nối waypoints, KHÔNG lặp điểm nối giữa hai chặng", () => {
    const m = mergeLegPlans([
      leg([A, { lat: 13.5, lon: 110.5 }, B]),
      leg([B, { lat: 14.5, lon: 111.5 }, C]),
    ])!;
    expect(m.plan.waypoints).toEqual([
      A,
      { lat: 13.5, lon: 110.5 },
      B,
      { lat: 14.5, lon: 111.5 },
      C,
    ]);
    // B chỉ xuất hiện MỘT lần
    expect(m.plan.waypoints.filter((w) => w.lat === 14)).toHaveLength(1);
  });

  it("stopWpIdx trỏ đúng điểm cuối của từng chặng", () => {
    const m = mergeLegPlans([
      leg([A, { lat: 13.5, lon: 110.5 }, B]),
      leg([B, { lat: 14.5, lon: 111.5 }, C]),
    ])!;
    expect(m.stopWpIdx).toEqual([2, 4]);
    expect(m.plan.waypoints[m.stopWpIdx[0]]).toEqual(B);
    expect(m.plan.waypoints[m.stopWpIdx[1]]).toEqual(C);
  });

  it("một chặng ⇒ số liệu y nguyên chặng đó", () => {
    const one = leg([A, B]);
    const m = mergeLegPlans([one])!;
    expect(m.plan.distKm).toBe(one.distKm);
    expect(m.plan.waypoints).toEqual([A, B]);
    expect(m.stopWpIdx).toEqual([1]);
  });

  it("cộng quãng/giờ/dầu, lấy MAX sóng gió", () => {
    const m = mergeLegPlans([
      leg([A, B], { distKm: 100, hours: 8, fuelL: 160, maxWaveM: 1.2, maxWindKmh: 20 }),
      leg([B, C], { distKm: 60, hours: 5, fuelL: 100, maxWaveM: 2.4, maxWindKmh: 45 }),
    ])!;
    expect(m.plan.distKm).toBe(160);
    expect(m.plan.hours).toBe(13);
    expect(m.plan.fuelL).toBe(260);
    expect(m.plan.maxWaveM).toBe(2.4);
    expect(m.plan.maxWindKmh).toBe(45);
  });

  it("MỘT chặng nguy hiểm là CẢ TUYẾN phải nói (OR mọi cờ cảnh báo)", () => {
    const m = mergeLegPlans([
      leg([A, B]),
      leg([B, C], {
        hasRoughLeg: true,
        hasShallowLeg: true,
        hasVeryShallowLeg: true,
        hasNearLandLeg: true,
        hasFollowingSeaRisk: true,
        cappedToDirect: true,
      }),
    ])!;
    expect(m.plan.hasRoughLeg).toBe(true);
    expect(m.plan.hasShallowLeg).toBe(true);
    expect(m.plan.hasVeryShallowLeg).toBe(true);
    expect(m.plan.hasNearLandLeg).toBe(true);
    expect(m.plan.hasFollowingSeaRisk).toBe(true);
    expect(m.plan.cappedToDirect).toBe(true);
  });

  it("MỘT chặng chưa kiểm độ sâu là cả tuyến coi như chưa kiểm (AND)", () => {
    const m = mergeLegPlans([
      leg([A, B], { depthChecked: true }),
      leg([B, C], { depthChecked: false }),
    ])!;
    expect(m.plan.depthChecked).toBe(false);
  });

  it("mọi chặng đều sạch thì tuyến sạch — không bịa cảnh báo", () => {
    const m = mergeLegPlans([leg([A, B]), leg([B, C])])!;
    expect(m.plan.hasRoughLeg).toBe(false);
    expect(m.plan.depthChecked).toBe(true);
  });

  it("thiếu nền 'chạy thẳng' của MỘT chặng ⇒ cả tuyến bỏ so sánh (direct null)", () => {
    const m = mergeLegPlans([
      leg([A, B]),
      leg([B, C], { direct: null, fuelDeltaL: null }),
    ])!;
    expect(m.plan.direct).toBeNull();
    expect(m.plan.fuelDeltaL).toBeNull();
  });

  it("đủ nền 'chạy thẳng' thì cộng và tính lại chênh dầu CÓ DẤU", () => {
    const m = mergeLegPlans([
      leg([A, B], {
        fuelL: 160,
        direct: { distKm: 95, hours: 7.5, fuelL: 150, maxWaveM: 1.1 },
      }),
      leg([B, C], {
        fuelL: 100,
        direct: { distKm: 58, hours: 4.8, fuelL: 96, maxWaveM: 2.0 },
      }),
    ])!;
    expect(m.plan.direct!.distKm).toBe(153);
    expect(m.plan.direct!.hours).toBeCloseTo(12.3, 6);
    expect(m.plan.direct!.fuelL).toBe(246);
    expect(m.plan.direct!.maxWaveM).toBe(2.0);
    expect(m.plan.fuelDeltaL).toBe(14); // 260 − 246, tốn THÊM, giữ dấu dương
  });

  it("cộng phần đuôi chạy quá cửa sổ dự báo", () => {
    const m = mergeLegPlans([
      leg([A, B], { beyondForecastH: 0 }),
      leg([B, C], { beyondForecastH: 5 }),
    ])!;
    expect(m.plan.beyondForecastH).toBe(5);
  });
});
