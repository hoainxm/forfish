import { describe, expect, it } from "vitest";
import { profitOf, tripStats } from "@/lib/trip-insights";

const trip = (revenueVnd: number, fuelVnd: number, otherVnd: number) => ({
  revenueVnd,
  fuelVnd,
  otherVnd,
});

describe("profitOf", () => {
  it("lãi = tiền bán − dầu − tổn khác", () => {
    expect(profitOf(trip(100_000_000, 30_000_000, 20_000_000))).toBe(50_000_000);
    expect(profitOf(trip(40_000_000, 35_000_000, 10_000_000))).toBe(-5_000_000);
  });
});

describe("tripStats", () => {
  it("chưa ghi chuyến nào → null (không hiện thẻ)", () => {
    expect(tripStats([])).toBeNull();
  });

  it("tính đủ: tổng, bình quân, số chuyến lãi, phần dầu, nhất/bét", () => {
    const s = tripStats([
      trip(100_000_000, 30_000_000, 20_000_000), // +50tr
      trip(40_000_000, 35_000_000, 10_000_000), // -5tr
      trip(60_000_000, 20_000_000, 10_000_000), // +30tr
    ])!;
    expect(s.count).toBe(3);
    expect(s.totalRevenue).toBe(200_000_000);
    expect(s.totalProfit).toBe(75_000_000);
    expect(s.avgProfit).toBe(25_000_000);
    expect(s.profitableCount).toBe(2);
    expect(s.fuelShare).toBeCloseTo(85_000_000 / 200_000_000, 5);
    expect(s.bestProfit).toBe(50_000_000);
    expect(s.worstProfit).toBe(-5_000_000);
  });

  it("doanh thu 0 đồng → fuelShare null, không chia cho 0", () => {
    const s = tripStats([trip(0, 5_000_000, 0)])!;
    expect(s.fuelShare).toBeNull();
    expect(s.totalProfit).toBe(-5_000_000);
    expect(s.profitableCount).toBe(0);
  });
});
