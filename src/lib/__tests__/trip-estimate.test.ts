import { describe, expect, it } from "vitest";
import { estimateTrip } from "@/lib/trip-estimate";

describe("estimateTrip", () => {
  it("tổn = dầu (ngày×lít×giá) + chi khác", () => {
    const e = estimateTrip({
      days: 10,
      fuelPerDayL: 200, // 2000 lít cả chuyến
      fuelPriceVnd: 20_000, // → 40tr dầu
      otherCostVnd: 15_000_000,
    });
    expect(e.fuelCostVnd).toBe(40_000_000);
    expect(e.totalCostVnd).toBe(55_000_000);
    expect(e.fuelShare).toBeCloseTo(40 / 55, 5);
    expect(e.breakevenKg).toBeNull(); // chưa nhập giá cá
  });

  it("nhập giá cá → sản lượng hoà vốn làm tròn LÊN", () => {
    const e = estimateTrip({
      days: 1,
      fuelPerDayL: 0,
      fuelPriceVnd: 0,
      otherCostVnd: 10_000_000,
      fishPricePerKgVnd: 30_000, // 10tr/30k = 333,33 → 334 kg
    });
    expect(e.totalCostVnd).toBe(10_000_000);
    expect(e.breakevenKg).toBe(334);
  });

  it("input trống/âm → coi như 0, không NaN, không chia 0", () => {
    const e = estimateTrip({
      days: -3,
      fuelPerDayL: NaN,
      fuelPriceVnd: 20_000,
      otherCostVnd: 0,
      fishPricePerKgVnd: 30_000,
    });
    expect(e.fuelCostVnd).toBe(0);
    expect(e.totalCostVnd).toBe(0);
    expect(e.fuelShare).toBeNull();
    expect(e.breakevenKg).toBeNull(); // tổn 0 → không có ngưỡng hoà vốn
  });
});
