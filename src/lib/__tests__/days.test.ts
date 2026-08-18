import { describe, expect, it } from "vitest";
import {
  SOON_DAYS_DOCS,
  SOON_DAYS_SERVICE,
  addDaysIso,
  daysUntil,
  todayIsoVN,
} from "@/lib/days";

/*
  N1 (audit 2026-08-18): 6 bản `daysUntil` cũ tính theo ngày UTC ⇒ từ 00h tới
  07h sáng giờ VN, "hôm nay" vẫn là hôm qua. Bộ test này khoá hành vi: ngày
  tính theo lịch Việt Nam (+07:00) bất kể múi giờ máy chạy test.
*/

describe("todayIsoVN", () => {
  it("00h–07h sáng VN đã là ngày mới (UTC còn hôm qua)", () => {
    // 2026-06-10T18:30Z = 01:30 sáng 11/6 giờ VN
    expect(todayIsoVN(new Date("2026-06-10T18:30:00Z"))).toBe("2026-06-11");
    // 2026-06-10T23:59Z = 06:59 sáng 11/6 giờ VN
    expect(todayIsoVN(new Date("2026-06-10T23:59:00Z"))).toBe("2026-06-11");
    // 2026-06-11T00:00Z = 07:00 sáng 11/6 giờ VN
    expect(todayIsoVN(new Date("2026-06-11T00:00:00Z"))).toBe("2026-06-11");
  });

  it("nhận epoch ms lẫn Date", () => {
    const ms = Date.parse("2026-06-10T05:00:00Z"); // 12:00 trưa VN
    expect(todayIsoVN(ms)).toBe("2026-06-10");
    expect(todayIsoVN(new Date(ms))).toBe("2026-06-10");
  });
});

describe("daysUntil", () => {
  it("giấy hết hạn hôm nay lúc 1h sáng VN → 0, không phải 1", () => {
    const oneAmVN = new Date("2026-06-10T18:00:00Z"); // 01:00 11/6 VN
    expect(daysUntil("2026-06-11", oneAmVN)).toBe(0);
    expect(daysUntil("2026-06-10", oneAmVN)).toBe(-1); // hôm qua đã quá hạn
    expect(daysUntil("2026-06-12", oneAmVN)).toBe(1);
  });

  it("giữa ngày VN — số ngày có dấu, đúng qua tháng", () => {
    const noon = new Date("2026-06-10T05:00:00Z");
    expect(daysUntil("2026-06-10", noon)).toBe(0);
    expect(daysUntil("2026-06-25", noon)).toBe(15);
    expect(daysUntil("2026-06-01", noon)).toBe(-9);
    expect(daysUntil("2026-07-10", noon)).toBe(30);
  });

  it("nhận sẵn chuỗi ngày VN làm mốc", () => {
    expect(daysUntil("2026-06-15", "2026-06-10")).toBe(5);
  });

  it("ngày hỏng → NaN, không giả vờ 0 (= 'hết hạn hôm nay')", () => {
    expect(daysUntil("bậy", "2026-06-10")).toBeNaN();
    expect(daysUntil("2026-06-10", "bậy")).toBeNaN();
  });
});

describe("addDaysIso", () => {
  it("cộng/trừ ngày qua tháng, qua năm", () => {
    expect(addDaysIso("2026-06-10", 25)).toBe("2026-07-05");
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysIso("2026-06-10", 0)).toBe("2026-06-10");
  });
  it("ngày hỏng trả nguyên", () => {
    expect(addDaysIso("bậy", 3)).toBe("bậy");
  });
});

describe("ngưỡng chung", () => {
  it("giấy tờ/bảo hiểm/bảo hành 30 · bảo dưỡng/dịch vụ 14", () => {
    expect(SOON_DAYS_DOCS).toBe(30);
    expect(SOON_DAYS_SERVICE).toBe(14);
  });
});
