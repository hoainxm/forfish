import { describe, expect, it } from "vitest";
import { amLichFromIso, amLichText, solarToLunar } from "@/lib/am-lich";

/* Đối chiếu các mốc âm lịch Việt Nam đã công bố (Tết, Trung thu, Vu Lan,
   tháng nhuận) — sai một ngày ở đây là bà con tính nhầm con nước/nghề đèn. */
describe("âm lịch Việt Nam (múi +7)", () => {
  it("mùng 1 Tết các năm", () => {
    expect(solarToLunar(10, 2, 2024)).toEqual({ day: 1, month: 1, year: 2024, leap: false });
    expect(solarToLunar(29, 1, 2025)).toEqual({ day: 1, month: 1, year: 2025, leap: false });
    expect(solarToLunar(17, 2, 2026)).toEqual({ day: 1, month: 1, year: 2026, leap: false });
  });

  it("ngày trước Tết vẫn thuộc năm âm cũ (tháng 12)", () => {
    const a = solarToLunar(28, 1, 2025);
    expect(a.year).toBe(2024);
    expect(a.month).toBe(12);
  });

  it("Trung thu 2025 = Rằm tháng 8, Vu Lan 2025 = Rằm tháng 7", () => {
    expect(solarToLunar(6, 10, 2025)).toMatchObject({ day: 15, month: 8, year: 2025 });
    expect(solarToLunar(6, 9, 2025)).toMatchObject({ day: 15, month: 7, year: 2025 });
  });

  it("năm 2025 có tháng 6 nhuận (bắt đầu 25/7/2025)", () => {
    expect(solarToLunar(25, 7, 2025)).toEqual({ day: 1, month: 6, year: 2025, leap: true });
    expect(solarToLunar(25, 6, 2025)).toEqual({ day: 1, month: 6, year: 2025, leap: false });
  });

  it("chuỗi ISO + câu hiển thị", () => {
    expect(amLichFromIso("2025-10-06")).toMatchObject({ day: 15, month: 8 });
    expect(amLichFromIso("rác")).toBeNull();
    expect(amLichText({ day: 15, month: 8, year: 2025, leap: false })).toBe("Rằm · 15/8");
    expect(amLichText({ day: 1, month: 6, year: 2025, leap: true })).toBe("Mùng 1 · 1/6 nhuận");
    expect(amLichText({ day: 9, month: 3, year: 2026, leap: false })).toBe("9/3");
  });
});
