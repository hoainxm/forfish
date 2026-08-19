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
      days: -1,
    });
  });

  it("giấy tờ quá hạn → danger kèm số ngày", () => {
    const m = member({ certLabel: "Máy trưởng hạng II", certExpiry: "2026-06-01" });
    expect(crewIssue(m, TODAY)).toEqual({
      level: "danger",
      label: "Máy trưởng hạng II quá hạn 9 ngày",
      days: -9,
    });
  });

  it("hết hạn HÔM NAY = đã hết hạn (đỏ), không vàng (T5, 2026-08-18)", () => {
    const m = member({ insuranceExpiry: "2026-06-10" });
    expect(crewIssue(m, TODAY)).toEqual({
      level: "danger",
      label: "Bảo hiểm hết hạn hôm nay",
      days: 0,
    });
  });

  it("1h sáng giờ VN: hạn hôm nay vẫn là hôm nay (N1 — không lệch UTC)", () => {
    // 2026-06-09T18:00Z = 01:00 sáng 10/6 giờ VN
    const oneAm = new Date("2026-06-09T18:00:00Z");
    expect(crewIssue(member({ insuranceExpiry: "2026-06-10" }), oneAm).level).toBe(
      "danger",
    );
  });

  it("sắp hết hạn trong 30 ngày → warn", () => {
    const m = member({ insuranceExpiry: "2026-06-25" });
    expect(crewIssue(m, TODAY)).toEqual({
      level: "warn",
      label: "Bảo hiểm còn 15 ngày",
      days: 15,
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
    expect(crewIssue(m, TODAY)).toEqual({
      level: "ok",
      label: "Giấy tờ ổn",
      days: null,
    });
  });

  it("có bảo hiểm nhưng KHÔNG ghi hạn → neutral 'Chưa ghi hạn bảo hiểm', không xanh (T2)", () => {
    expect(crewIssue(member({}), TODAY)).toEqual({
      level: "neutral",
      label: "Chưa ghi hạn bảo hiểm",
      days: null,
    });
    // chứng chỉ sắp hết vẫn thắng (ưu tiên vàng trước neutral)
    expect(
      crewIssue(member({ certLabel: "TT hạng II", certExpiry: "2026-06-20" }), TODAY)
        .level,
    ).toBe("warn");
    // chứng chỉ còn xa nhưng bảo hiểm chưa ghi hạn → vẫn neutral
    expect(
      crewIssue(member({ certLabel: "TT hạng II", certExpiry: "2027-06-20" }), TODAY)
        .level,
    ).toBe("neutral");
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
