import { describe, expect, it } from "vitest";
import {
  beaufort,
  dailyCurrentFromHourly,
  forecastConfidence,
  formatNumberVN,
  windDirectionVN,
  windDescribeVN,
  FORECAST_MAX_DAYS,
} from "../marine-weather";
import { levelOf, scoreDay, estimateWaveFromWind } from "../sea";

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

describe("windDescribeVN", () => {
  it("gọi theo GỐC + thổi về (khớp vệt bản đồ = from + 180°)", () => {
    // gió Tây Nam (từ 225°) thổi về Đông Bắc — đúng chiều vệt gió trên bản đồ
    expect(windDescribeVN(225)).toBe("gió Tây Nam (thổi về Đông Bắc)");
    expect(windDescribeVN(270)).toBe("gió Tây (thổi về Đông)");
    expect(windDescribeVN(0)).toBe("gió Bắc (thổi về Nam)");
  });
});

/* Dòng chảy tại điểm (2026-07-29): mỗi ngày lấy MỘT số đại diện GIỮA TRƯA —
   tốc độ + hướng phải là CÙNG một mốc giờ (không max tốc rồi ghép hướng khác). */
describe("dailyCurrentFromHourly", () => {
  it("chọn mốc gần 12h nhất, cặp đúng hướng của mốc đó", () => {
    const times = [
      "2026-07-29T00:00",
      "2026-07-29T12:00",
      "2026-07-29T18:00",
      "2026-07-30T06:00",
    ];
    const vel = [3, 1.5, 2.8, 2];
    const dir = [10, 90, 200, 180];
    const m = dailyCurrentFromHourly(times, vel, dir);
    // ngày 29: đúng mốc 12h (1,5 km/h · 90°) dù 00h/18h chảy mạnh hơn
    expect(m.get("2026-07-29")).toEqual({ curKmh: 1.5, curDirDeg: 90 });
    // ngày 30 chỉ có 06h → lấy nó
    expect(m.get("2026-07-30")).toEqual({ curKmh: 2, curDirDeg: 180 });
  });

  it("giờ có tốc mà thiếu số (null) → bỏ mốc đó; ngày không mốc nào → không có entry", () => {
    const m = dailyCurrentFromHourly(
      ["2026-08-05T12:00", "2026-08-06T12:00"],
      [null, 1],
      [90, null],
    );
    expect(m.has("2026-08-05")).toBe(false); // nguồn hết tầm (~10 ngày) → trống
    expect(m.get("2026-08-06")).toEqual({ curKmh: 1, curDirDeg: null });
  });
});

describe("forecastConfidence", () => {
  it("1–3 ngày đầu (index 0–2) tin được, từ ngày 4 chuyển sang cảnh báo", () => {
    expect(forecastConfidence(0).tone).toBe("ok");
    expect(forecastConfidence(2).tone).toBe("ok");
    expect(forecastConfidence(3).tone).toBe("warn");
    expect(forecastConfidence(6).tone).toBe("warn");
  });

  it("dự báo xa (index ≥7) có lời dặn riêng, và mọi index trong tầm 16 ngày đều có nhãn", () => {
    expect(forecastConfidence(7).label).toContain("xa");
    expect(FORECAST_MAX_DAYS).toBe(16);
    for (let i = 0; i < FORECAST_MAX_DAYS; i++) {
      expect(forecastConfidence(i).label.length).toBeGreaterThan(0);
    }
  });

  it("ngày rất xa 11–16 có nhãn riêng", () => {
    expect(forecastConfidence(12).label).toContain("rất xa");
    expect(forecastConfidence(15).label).toContain("rất xa");
  });

  it("dataConf thấp hạ độ tin kể cả ngày gần; dataConf cao nới nhãn tầm vừa", () => {
    // mô hình lệch nhau nhiều (conf 0.2) ở ngay ngày mai → cảnh báo
    const shaky = forecastConfidence(1, 0.2);
    expect(shaky.tone).toBe("warn");
    expect(shaky.label).toContain("lệch nhau");
    // đồng thuận cao ở tầm 4–7 ngày → nhẹ nhàng hơn nhãn nền warn
    expect(forecastConfidence(5, 0.9).tone).toBe("ok");
  });
});

describe("estimateWaveFromWind", () => {
  it("đơn điệu tăng theo gió, có nền dương khi lặng gió", () => {
    expect(estimateWaveFromWind(0)).toBeGreaterThan(0);
    expect(estimateWaveFromWind(40)).toBeGreaterThan(estimateWaveFromWind(10));
  });
  it("gió âm (dữ liệu rác) không cho sóng âm", () => {
    expect(estimateWaveFromWind(-5)).toBeGreaterThanOrEqual(0);
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
