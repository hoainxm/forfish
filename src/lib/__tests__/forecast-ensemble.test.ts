import { describe, expect, it } from "vitest";
import {
  stdDev,
  spreadToConfidence,
  aggregateDailySpread,
  CONFIDENCE_K_KMH,
} from "../forecast-ensemble";

describe("stdDev", () => {
  it("mảng rỗng hoặc 1 phần tử → 0 (không có phân tán)", () => {
    expect(stdDev([])).toBe(0);
    expect(stdDev([42])).toBe(0);
  });

  it("mọi giá trị bằng nhau → 0", () => {
    expect(stdDev([10, 10, 10, 10])).toBe(0);
  });

  it("tính đúng population std", () => {
    // [2,4,4,4,5,5,7,9]: mean=5, variance=4, std=2
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 10);
  });

  it("std của [0,10] = 5", () => {
    expect(stdDev([0, 10])).toBeCloseTo(5, 10);
  });
});

describe("spreadToConfidence", () => {
  it("spread = 0 → tin gần như tuyệt đối (~1)", () => {
    expect(spreadToConfidence(0)).toBeCloseTo(1, 10);
  });

  it("spread = K → đúng 0.5 (mốc một nửa)", () => {
    expect(spreadToConfidence(CONFIDENCE_K_KMH)).toBeCloseTo(0.5, 10);
  });

  it("spread = 2K → 0.2", () => {
    expect(spreadToConfidence(2 * CONFIDENCE_K_KMH)).toBeCloseTo(0.2, 10);
  });

  it("đơn điệu giảm theo spread", () => {
    const spreads = [0, 5, 10, 15, 20, 30, 50, 100];
    for (let i = 1; i < spreads.length; i++) {
      expect(spreadToConfidence(spreads[i])).toBeLessThan(
        spreadToConfidence(spreads[i - 1]),
      );
    }
  });

  it("luôn kẹp trong [0,1], kể cả spread rất lớn hoặc âm/không hợp lệ", () => {
    for (const s of [-10, 0, 15, 500, 1e6, NaN, Infinity]) {
      const c = spreadToConfidence(s);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    // spread âm hoặc không hợp lệ được coi như 0 → tin cao
    expect(spreadToConfidence(-10)).toBeCloseTo(1, 10);
    expect(spreadToConfidence(NaN)).toBeCloseTo(1, 10);
  });
});

describe("aggregateDailySpread", () => {
  it("gom 2 ngày, lấy gió-đỉnh mỗi thành viên mỗi ngày rồi tính std", () => {
    const times = [
      "2026-07-25T00:00",
      "2026-07-25T12:00",
      "2026-07-26T00:00",
      "2026-07-26T12:00",
    ];
    // 2 thành viên. Ngày 25: đỉnh member A=20, B=30 → std([20,30])=5.
    //                Ngày 26: đỉnh A=10, B=10 → std=0 (đồng thuận).
    const memberSeries = [
      [15, 20, 8, 10], // member A
      [25, 30, 10, 9], // member B
    ];
    const out = aggregateDailySpread(times, memberSeries);
    expect(out).toHaveLength(2);

    expect(out[0].date).toBe("2026-07-25");
    expect(out[0].members).toBe(2);
    expect(out[0].windSpreadKmh).toBeCloseTo(5, 10);
    expect(out[0].confidence).toBeCloseTo(spreadToConfidence(5), 10);

    expect(out[1].date).toBe("2026-07-26");
    expect(out[1].windSpreadKmh).toBeCloseTo(0, 10);
    expect(out[1].confidence).toBeCloseTo(1, 10);
  });

  it("các thành viên đồng thuận hoàn toàn → spread 0, tin ~1", () => {
    const times = ["2026-07-25T00:00", "2026-07-25T06:00", "2026-07-25T12:00"];
    const memberSeries = [
      [10, 12, 11],
      [11, 12, 9],
      [12, 11, 10],
    ];
    // đỉnh mỗi thành viên = 12 → std([12,12,12]) = 0
    const out = aggregateDailySpread(times, memberSeries);
    expect(out).toHaveLength(1);
    expect(out[0].windSpreadKmh).toBeCloseTo(0, 10);
    expect(out[0].confidence).toBeCloseTo(1, 10);
    expect(out[0].members).toBe(3);
  });

  it("bỏ qua ô không hợp lệ (NaN/null) khi tìm gió-đỉnh", () => {
    const times = ["2026-07-25T00:00", "2026-07-25T12:00"];
    const memberSeries = [
      [NaN, 20], // đỉnh = 20 (bỏ NaN)
      [30, NaN], // đỉnh = 30
    ];
    const out = aggregateDailySpread(times, memberSeries);
    expect(out[0].windSpreadKmh).toBeCloseTo(5, 10); // std([20,30])
    expect(out[0].members).toBe(2);
  });

  it("giữ thứ tự ngày theo lần xuất hiện đầu tiên trong times", () => {
    const times = [
      "2026-07-26T00:00",
      "2026-07-25T00:00",
      "2026-07-26T12:00",
    ];
    const out = aggregateDailySpread(times, [[1, 2, 3]]);
    expect(out.map((d) => d.date)).toEqual(["2026-07-26", "2026-07-25"]);
  });

  it("không có thành viên → mỗi ngày members=0, spread 0", () => {
    const out = aggregateDailySpread(["2026-07-25T00:00"], []);
    expect(out).toHaveLength(1);
    expect(out[0].members).toBe(0);
    expect(out[0].windSpreadKmh).toBe(0);
  });

  it("spread lớn (thành viên mỗi bản một phách) → tin thấp hẳn", () => {
    const times = ["2026-07-25T00:00"];
    // đỉnh: 5, 25, 45, 65 → std = ~22.4 → confidence thấp
    const out = aggregateDailySpread(times, [[5], [25], [45], [65]]);
    expect(out[0].windSpreadKmh).toBeGreaterThan(20);
    expect(out[0].confidence).toBeLessThan(0.35);
  });
});
