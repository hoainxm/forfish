import { describe, expect, it } from "vitest";
import {
  CrewMember,
  crewIssue,
  formatCccd,
  isValidCccd,
  normalizeCccd,
} from "../crew";

const TODAY = new Date("2026-06-10T00:00:00Z");

function member(over: Partial<CrewMember>): CrewMember {
  return {
    id: "m1",
    name: "Test",
    cccd: "079090001234",
    role: "thuyen_vien",
    hasInsurance: true,
    ...over,
  };
}

describe("crewIssue", () => {
  it("không bảo hiểm là nặng nhất", () => {
    const m = member({ hasInsurance: false, certExpiry: "2027-01-01" });
    expect(crewIssue(m, TODAY)).toEqual({
      level: "danger",
      label: "Chưa có bảo hiểm",
    });
  });

  it("giấy tờ quá hạn → danger kèm số ngày", () => {
    const m = member({ certLabel: "Máy trưởng hạng II", certExpiry: "2026-06-01" });
    expect(crewIssue(m, TODAY)).toEqual({
      level: "danger",
      label: "Máy trưởng hạng II quá hạn 9 ngày",
    });
  });

  it("sắp hết hạn trong 30 ngày → warn", () => {
    const m = member({ insuranceExpiry: "2026-06-25" });
    expect(crewIssue(m, TODAY)).toEqual({
      level: "warn",
      label: "Bảo hiểm còn 15 ngày",
    });
  });

  it("lấy mốc gần nhất khi có nhiều hạn", () => {
    const m = member({
      insuranceExpiry: "2026-12-01",
      certLabel: "Thuyền trưởng hạng II",
      certExpiry: "2026-06-20",
    });
    expect(crewIssue(m, TODAY).label).toContain("Thuyền trưởng hạng II còn 10");
  });

  it("đủ và còn xa hạn → ok", () => {
    const m = member({ insuranceExpiry: "2027-01-01" });
    expect(crewIssue(m, TODAY)).toEqual({ level: "ok", label: "Giấy tờ ổn" });
  });
});

describe("CCCD — định danh", () => {
  it("bỏ dấu cách/gạch khi chuẩn hoá", () => {
    expect(normalizeCccd("079 090 001 234")).toBe("079090001234");
    expect(normalizeCccd("079-090-001-234")).toBe("079090001234");
  });

  it("hợp lệ đúng 12 chữ số", () => {
    expect(isValidCccd("079090001234")).toBe(true);
    expect(isValidCccd("079 090 001 234")).toBe(true);
    expect(isValidCccd("07909000123")).toBe(false); // 11 số
    expect(isValidCccd("0790900012345")).toBe(false); // 13 số
    expect(isValidCccd("07909000123a")).toBe(false); // có chữ
    expect(isValidCccd("")).toBe(false);
  });

  it("hiện dạng nhóm 4-4-4", () => {
    expect(formatCccd("079090001234")).toBe("0790 9000 1234");
    expect(formatCccd("bậy")).toBe("bậy");
  });
});
