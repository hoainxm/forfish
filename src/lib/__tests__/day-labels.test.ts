import { describe, expect, it } from "vitest";
import {
  chipLabel,
  clockVN,
  dayLabel,
  daysBetweenISO,
  isPastDay,
  isoDateVN,
} from "../day-labels";

// 2026-07-20T00:00:00Z = 07:00 ngày 20/7 giờ VN
const T0 = Date.parse("2026-07-20T00:00:00Z");

describe("isoDateVN", () => {
  it("đổi ngày theo giờ VN (+7), không theo UTC", () => {
    expect(isoDateVN(T0)).toBe("2026-07-20");
    // 22:30 UTC ngày 19/7 = 05:30 ngày 20/7 giờ VN → đã sang ngày mới
    expect(isoDateVN(Date.parse("2026-07-19T22:30:00Z"))).toBe("2026-07-20");
    // 16:30 UTC ngày 19/7 = 23:30 ngày 19/7 giờ VN → vẫn ngày 19
    expect(isoDateVN(Date.parse("2026-07-19T16:30:00Z"))).toBe("2026-07-19");
  });
});

describe("clockVN", () => {
  it("giờ phút + ngày kiểu bà con đọc", () => {
    expect(clockVN(T0)).toBe("07:00 ngày 20/7");
    expect(clockVN(Date.parse("2026-07-19T22:45:00Z"))).toBe("05:45 ngày 20/7");
  });
});

describe("daysBetweenISO / isPastDay", () => {
  it("đếm ngày đúng cả hai chiều", () => {
    expect(daysBetweenISO("2026-07-20", "2026-07-20")).toBe(0);
    expect(daysBetweenISO("2026-07-20", "2026-07-25")).toBe(5);
    expect(daysBetweenISO("2026-07-20", "2026-07-15")).toBe(-5);
    expect(daysBetweenISO("2026-07-28", "2026-08-02")).toBe(5); // qua tháng
  });
  it("ngày đã trôi qua", () => {
    expect(isPastDay("2026-07-19", "2026-07-20")).toBe(true);
    expect(isPastDay("2026-07-20", "2026-07-20")).toBe(false);
    expect(isPastDay("2026-07-21", "2026-07-20")).toBe(false);
  });
});

/* LỖI đã sửa: nhãn cũ trả "Hôm nay" cho PHẦN TỬ ĐẦU mảng — bản dự báo lưu
   trong máy từ 5 hôm trước vẫn được gọi là "Hôm nay". */
describe("dayLabel — so ngày thật, không so vị trí mảng", () => {
  it("đúng ngày mới được gọi Hôm nay / Ngày mai", () => {
    expect(dayLabel("2026-07-20", "2026-07-20")).toBe("Hôm nay");
    expect(dayLabel("2026-07-21", "2026-07-20")).toBe("Ngày mai");
  });
  it("ngày sau nữa hiện thứ + ngày", () => {
    expect(dayLabel("2026-07-22", "2026-07-20")).toBe("Thứ tư 22/7");
  });
  it("bản lưu cũ: ngày đã qua KHÔNG được gọi là Hôm nay", () => {
    const l = dayLabel("2026-07-15", "2026-07-20");
    expect(l).not.toContain("Hôm nay");
    expect(l).toContain("15/7");
    expect(l).toContain("đã qua");
  });
});

describe("chipLabel", () => {
  it("cùng luật với dayLabel, chữ ngắn hơn", () => {
    expect(chipLabel("2026-07-20", "2026-07-20")).toBe("Hôm nay");
    expect(chipLabel("2026-07-21", "2026-07-20")).toBe("Ngày mai");
    expect(chipLabel("2026-07-22", "2026-07-20")).toBe("Th 4 22/7");
    expect(chipLabel("2026-07-19", "2026-07-20")).toBe("CN 19/7 · qua");
  });
});
