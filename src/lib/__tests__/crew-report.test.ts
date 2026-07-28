import { describe, expect, it } from "vitest";
import {
  cleanReportDetail,
  CREW_REPORT_CATEGORIES,
  CREW_REPORT_DETAIL_MAX,
  crewReportCategoryLabel,
  isCrewReportCategory,
  lookupLevel,
} from "../crew-report";

describe("crew-report — loại vấn đề", () => {
  it("nhận đúng loại hợp lệ", () => {
    expect(isCrewReportCategory("bo_tau")).toBe(true);
    expect(isCrewReportCategory("khac")).toBe(true);
    expect(isCrewReportCategory("bậy")).toBe(false);
    expect(isCrewReportCategory(123)).toBe(false);
  });

  it("có đủ 6 loại và đều có nhãn", () => {
    expect(CREW_REPORT_CATEGORIES).toHaveLength(6);
    for (const c of CREW_REPORT_CATEGORIES) {
      expect(crewReportCategoryLabel(c).length).toBeGreaterThan(0);
    }
  });

  it("loại lạ → nhãn 'Vấn đề khác'", () => {
    expect(crewReportCategoryLabel("xyz")).toBe("Vấn đề khác");
  });
});

describe("cleanReportDetail", () => {
  it("bỏ khoảng trắng thừa", () => {
    expect(cleanReportDetail("  bỏ tàu  ")).toBe("bỏ tàu");
    expect(cleanReportDetail(null)).toBe("");
    expect(cleanReportDetail(undefined)).toBe("");
  });

  it("cắt tối đa độ dài", () => {
    const long = "x".repeat(CREW_REPORT_DETAIL_MAX + 50);
    expect(cleanReportDetail(long)).toHaveLength(CREW_REPORT_DETAIL_MAX);
  });
});

describe("lookupLevel", () => {
  it("có cảnh báo → danger, sạch → ok", () => {
    expect(lookupLevel({ checked: true, count: 2, reports: [] })).toBe("danger");
    expect(lookupLevel({ checked: true, count: 0, reports: [] })).toBe("ok");
  });
});
