import { describe, it, expect } from "vitest";

import { mergeLegPlans } from "../route-multi";
import type { LatLon, RoutePlan } from "../route-plan";

/*  Chặng mẫu — mặc định "sạch", từng ca tự bật cờ mình cần soi.
    `hoursAt` SUY RA TỪ `hours` (chia đều cho các waypoint): trước đây nó bám
    hằng 8 dù ca test đổi `hours`, nên một chặng "5 giờ" lại mang mảng giờ tới
    8 — fixture tự mâu thuẫn thì ca test đọc `hoursAt` không nói lên điều gì. */
function leg(waypoints: LatLon[], over: Partial<RoutePlan> = {}): RoutePlan {
  const hours = over.hours ?? 8;
  return {
    waypoints,
    distKm: 100,
    hours,
    fuelL: 160,
    maxWaveM: 1.2,
    maxWindKmh: 20,
    hasRoughLeg: false,
    hasShallowLeg: false,
    hasVeryShallowLeg: false,
    hasNearLandLeg: false,
    hasDraftShallowLeg: false,
    nearPortOnly: false,
    hoursAt: waypoints.map((_, i) => (hours * i) / Math.max(1, waypoints.length - 1)),
    hasFollowingSeaRisk: false,
    depthChecked: true,
    hazardChecked: false,
    hasHazardLeg: false,
    hasHazardNearPortLeg: false,
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

  /*  BA CỜ HIỂM HOẠ (Đợt 2, 2026-09-04) — hai luật ngược nhau trên cùng một
      lớp dữ liệu, và lẫn hai luật đó là kiểu lỗi im lặng nguy nhất: "một chặng
      chưa soi" mà gộp thành "cả tuyến đã soi" thì thẻ tuyến im như đã đối chiếu
      xong, trong khi có nguyên một chặng chưa ai nhìn tới. */
  it("MỘT chặng chưa soi kho hiểm hoạ ⇒ cả tuyến coi như chưa soi (AND)", () => {
    const m = mergeLegPlans([
      leg([A, B], { hazardChecked: true }),
      leg([B, C], { hazardChecked: false }),
    ])!;
    expect(m.plan.hazardChecked).toBe(false);
  });

  it("mọi chặng đều soi rồi ⇒ cả tuyến đã soi", () => {
    const m = mergeLegPlans([
      leg([A, B], { hazardChecked: true }),
      leg([B, C], { hazardChecked: true }),
    ])!;
    expect(m.plan.hazardChecked).toBe(true);
  });

  it("MỘT chặng dính vật chặn / vật sát bến ⇒ cả tuyến nói (OR)", () => {
    const m = mergeLegPlans([
      leg([A, B], { hazardChecked: true }),
      leg([B, C], {
        hazardChecked: true,
        hasHazardLeg: true,
        hasHazardNearPortLeg: true,
      }),
    ])!;
    expect(m.plan.hasHazardLeg).toBe(true);
    expect(m.plan.hasHazardNearPortLeg).toBe(true);
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

  /*  GIỜ TỚI TỪNG WAYPOINT (review đợt 4, G1). `auditRoute` đọc THẲNG `hoursAt`
      để sinh câu con nước "tại ETA", và `route-hazards.routeGeom` chỉ có nhánh
      phòng thân (sai độ dài ⇒ bỏ ETA, không ném) — nghĩa là mảng lệch một phần
      tử KHÔNG làm gì đỏ, nó chỉ âm thầm dán giờ của waypoint này lên waypoint
      kia. Trước đợt này `hoursAt` chỉ có trong fixture, không một dòng assert. */
  describe("hoursAt — ETA của CẢ chuyến, không phải của riêng chặng", () => {
    const m2 = () =>
      mergeLegPlans([
        leg([A, { lat: 13.5, lon: 110.5 }, B], { hours: 8 }),
        leg([B, { lat: 14.5, lon: 111.5 }, C], { hours: 5 }),
      ])!;

    it("dài đúng bằng waypoints, không lặp điểm nối", () => {
      const m = m2();
      expect(m.plan.hoursAt).toHaveLength(m.plan.waypoints.length);
      expect(m.plan.hoursAt).toHaveLength(5);
    });

    it("tăng dần và không giật lùi ở chỗ nối", () => {
      const h = m2().plan.hoursAt;
      for (let i = 1; i < h.length; i++) expect(h[i]).toBeGreaterThanOrEqual(h[i - 1]);
    });

    it("giờ tại chỗ ghé = giờ chạy hết chặng trước; giờ cuối = tổng chuyến", () => {
      const m = m2();
      const h = m.plan.hoursAt;
      expect(h[0]).toBe(0);
      expect(h[m.stopWpIdx[0]]).toBeCloseTo(8, 9); // tới B
      expect(h[h.length - 1]).toBeCloseTo(13, 9); // 8 + 5
      expect(h[h.length - 1]).toBeCloseTo(m.plan.hours, 9);
    });

    it("ba chặng vẫn khớp — luật cộng dồn không chỉ đúng với hai", () => {
      const D = { lat: 16, lon: 113 };
      const m = mergeLegPlans([
        leg([A, B], { hours: 8 }),
        leg([B, C], { hours: 5 }),
        leg([C, D], { hours: 2 }),
      ])!;
      expect(m.plan.hoursAt).toHaveLength(m.plan.waypoints.length);
      expect(m.plan.hoursAt[m.plan.hoursAt.length - 1]).toBeCloseTo(15, 9);
      expect(m.plan.hoursAt).toEqual([0, 8, 13, 15]);
    });
  });

  /*  LUẬT `nearPortOnly` KHI NỐI — hai vế, và vế thứ hai tinh: một chặng
      `nearPortOnly=false` có thể là "không có chỗ thấp nào" (vô hại) hoặc "có
      chỗ thấp giữa đường" (phải bật lại hai mục đỏ). Ghim hành vi trước, bàn
      sau — đây là chỗ dễ vỡ nhất khi ai đó đổi cách nối chặng. */
  describe("nearPortOnly — 'cạn chỉ ở cảng' cho cả tuyến", () => {
    it("một chặng cạn-ở-cảng + một chặng SẠCH ⇒ vẫn cạn-ở-cảng", () => {
      const m = mergeLegPlans([
        leg([A, B], { nearPortOnly: true, hasNearLandLeg: true }),
        leg([B, C]),
      ])!;
      expect(m.plan.nearPortOnly).toBe(true);
    });

    it("chặng sau có chỗ thấp GIỮA ĐƯỜNG ⇒ mất cờ, hai mục đỏ bật lại", () => {
      const m = mergeLegPlans([
        leg([A, B], { nearPortOnly: true, hasNearLandLeg: true }),
        leg([B, C], { nearPortOnly: false, hasDraftShallowLeg: true }),
      ])!;
      expect(m.plan.nearPortOnly).toBe(false);
    });

    it("KHÔNG chặng nào nói cạn-ở-cảng ⇒ không bịa ra cờ", () => {
      const m = mergeLegPlans([leg([A, B]), leg([B, C])])!;
      expect(m.plan.nearPortOnly).toBe(false);
    });
  });

  it("cộng phần đuôi chạy quá cửa sổ dự báo", () => {
    const m = mergeLegPlans([
      leg([A, B], { beyondForecastH: 0 }),
      leg([B, C], { beyondForecastH: 5 }),
    ])!;
    expect(m.plan.beyondForecastH).toBe(5);
  });
});
