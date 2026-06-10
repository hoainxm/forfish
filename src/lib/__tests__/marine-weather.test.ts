import { describe, expect, it } from "vitest";
import {
  beaufort,
  forecastConfidence,
  formatNumberVN,
  windDirectionVN,
  FORECAST_MAX_DAYS,
} from "../marine-weather";
import { levelOf, scoreDay } from "../sea";

describe("beaufort", () => {
  it("biên các cấp quen dùng", () => {
    expect(beaufort(0)).toBe(0);
    expect(beaufort(10)).toBe(2);
    expect(beaufort(19)).toBe(4); // 19 là sàn của cấp 4
    expect(beaufort(28)).toBe(5);
    expect(beaufort(38)).toBe(6);
    expect(beaufort(50)).toBe(7);
    expect(beaufort(120)).toBe(12);
  });
});

describe("windDirectionVN", () => {
  it("8 hướng chính", () => {
    expect(windDirectionVN(0)).toBe("Bắc");
    expect(windDirectionVN(45)).toBe("Đông Bắc");
    expect(windDirectionVN(90)).toBe("Đông");
    expect(windDirectionVN(180)).toBe("Nam");
    expect(windDirectionVN(270)).toBe("Tây");
  });

  it("làm tròn về hướng gần nhất, quay vòng 360", () => {
    expect(windDirectionVN(350)).toBe("Bắc");
    expect(windDirectionVN(211)).toBe("Tây Nam");
    expect(windDirectionVN(360)).toBe("Bắc");
  });
});

describe("forecastConfidence", () => {
  it("1–3 ngày đầu (index 0–2) tin được, từ ngày 4 chuyển sang cảnh báo", () => {
    expect(forecastConfidence(0).tone).toBe("ok");
    expect(forecastConfidence(2).tone).toBe("ok");
    expect(forecastConfidence(3).tone).toBe("warn");
    expect(forecastConfidence(6).tone).toBe("warn");
  });

  it("dự báo xa (index ≥7) có lời dặn riêng, và mọi index trong tầm nguồn đều có nhãn", () => {
    expect(forecastConfidence(7).label).toContain("Dự báo xa");
    for (let i = 0; i < FORECAST_MAX_DAYS; i++) {
      expect(forecastConfidence(i).label.length).toBeGreaterThan(0);
    }
  });
});

describe("formatNumberVN", () => {
  it("dấu phẩy thập phân kiểu Việt", () => {
    expect(formatNumberVN(1.24)).toBe("1,2");
    expect(formatNumberVN(5.55, 0)).toBe("6");
  });
});

// Thang điểm dùng chung của trục 1 (src/lib/sea.ts) — chốt hành vi để
// bản đồ và dự báo theo cảng không bao giờ lệch nhau.
describe("scoreDay + levelOf (lib/sea)", () => {
  const calm = { date: "2026-06-10", waveMaxM: 0.4, windMaxKmh: 10, gustMaxKmh: 20, precipMm: 0 };
  const rough = { date: "2026-06-10", waveMaxM: 2.8, windMaxKmh: 45, gustMaxKmh: 70, precipMm: 25 };

  it("biển lặng → điểm tối đa, mức good", () => {
    expect(scoreDay(calm)).toBe(100);
    expect(levelOf(100)).toBe("good");
  });

  it("biển động → điểm thấp, mức bad; không tụt dưới 5", () => {
    const s = scoreDay(rough);
    expect(s).toBeLessThan(50);
    expect(s).toBeGreaterThanOrEqual(5);
    expect(levelOf(s)).toBe("bad");
  });

  it("sóng tăng thì điểm không tăng (đơn điệu)", () => {
    const s1 = scoreDay({ ...calm, waveMaxM: 1.0 });
    const s2 = scoreDay({ ...calm, waveMaxM: 1.6 });
    expect(s2).toBeLessThanOrEqual(s1);
  });
});
