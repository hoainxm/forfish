import { describe, expect, it } from "vitest";
import { weatherFromCode } from "../weather-codes";
import { scoreDay } from "../sea";

describe("weatherFromCode", () => {
  it("dông (95–99) luôn là danger", () => {
    for (const c of [95, 96, 99]) {
      const w = weatherFromCode(c);
      expect(w?.label).toBe("Có dông sét");
      expect(w?.danger).toBe(true);
    }
  });

  it("mưa thường không phải danger, mưa rất to thì có", () => {
    expect(weatherFromCode(61)?.danger).toBe(false);
    expect(weatherFromCode(80)?.danger).toBe(false);
    expect(weatherFromCode(65)?.danger).toBe(true);
    expect(weatherFromCode(82)?.danger).toBe(true);
  });

  it("trời quang/mây và null → không nói gì", () => {
    expect(weatherFromCode(0)).toBeNull();
    expect(weatherFromCode(2)).toBeNull();
    expect(weatherFromCode(null)).toBeNull();
    expect(weatherFromCode(undefined)).toBeNull();
  });
});

describe("scoreDay với dông", () => {
  const calm = {
    date: "2026-06-10",
    waveMaxM: 0.4,
    windMaxKmh: 10,
    gustMaxKmh: 20,
    precipMm: 0,
  };

  it("ngày êm nhưng có dông → mất 30 điểm, tụt khỏi mức good", () => {
    expect(scoreDay(calm)).toBe(100);
    expect(scoreDay({ ...calm, wmoCode: 95 })).toBe(70);
  });

  it("không có wmoCode (dữ liệu cũ) → điểm như trước, không vỡ", () => {
    expect(scoreDay({ ...calm, wmoCode: null })).toBe(100);
    expect(scoreDay({ ...calm, wmoCode: 61 })).toBe(100);
  });
});
