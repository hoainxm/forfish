import { describe, expect, it } from "vitest";
import {
  listYears,
  profitOf,
  tripStats,
  yearlyReport,
} from "@/lib/trip-insights";

const trip = (revenueVnd: number, fuelVnd: number, otherVnd: number) => ({
  revenueVnd,
  fuelVnd,
  otherVnd,
});

const dated = (
  date: string,
  revenueVnd: number,
  fuelVnd: number,
  otherVnd: number,
) => ({ date, revenueVnd, fuelVnd, otherVnd });

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

describe("listYears", () => {
  it("trả các năm có chuyến, mới nhất trước, không trùng", () => {
    expect(
      listYears([
        dated("2025-03-10", 1, 0, 0),
        dated("2024-11-02", 1, 0, 0),
        dated("2025-07-20", 1, 0, 0),
      ]),
    ).toEqual([2025, 2024]);
  });

  it("sổ rỗng → []", () => {
    expect(listYears([])).toEqual([]);
  });
});

describe("yearlyReport", () => {
  it("năm không có chuyến → null", () => {
    expect(yearlyReport([dated("2025-01-01", 1, 0, 0)], 2024)).toBeNull();
  });

  it("lọc đúng năm + tách theo tháng (chỉ tháng có chuyến, tăng dần)", () => {
    const r = yearlyReport(
      [
        dated("2025-03-10", 100_000_000, 30_000_000, 20_000_000), // +50tr T3
        dated("2025-03-25", 60_000_000, 20_000_000, 10_000_000), // +30tr T3
        dated("2025-06-01", 40_000_000, 35_000_000, 10_000_000), // -5tr  T6
        dated("2024-12-31", 999, 0, 0), // năm khác — bỏ
      ],
      2025,
    )!;
    expect(r.year).toBe(2025);
    expect(r.count).toBe(3);
    expect(r.totalProfit).toBe(75_000_000);
    expect(r.profitableCount).toBe(2);
    expect(r.months.map((m) => m.month)).toEqual([3, 6]);
    const march = r.months[0];
    expect(march.count).toBe(2);
    expect(march.profit).toBe(80_000_000);
    expect(march.revenue).toBe(160_000_000);
    expect(r.months[1].profit).toBe(-5_000_000);
  });
});
