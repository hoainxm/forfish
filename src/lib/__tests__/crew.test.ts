import { describe, expect, it } from "vitest";
import {
  CrewMember,
  crewIssue,
  outstandingAdvance,
  splitTrip,
} from "../crew";

const TODAY = new Date("2026-06-10T00:00:00Z");

function member(over: Partial<CrewMember>): CrewMember {
  return {
    id: "m1",
    name: "Test",
    role: "thuyen_vien",
    shares: 1,
    hasInsurance: true,
    advances: [],
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

describe("outstandingAdvance", () => {
  it("chỉ cộng khoản chưa trừ", () => {
    const m = member({
      advances: [
        { id: "a1", date: "2026-06-01", amountVnd: 10_000_000, settled: false },
        { id: "a2", date: "2026-05-01", amountVnd: 5_000_000, settled: true },
        { id: "a3", date: "2026-06-05", amountVnd: 2_000_000, settled: false },
      ],
    });
    expect(outstandingAdvance(m)).toBe(12_000_000);
  });
});

describe("splitTrip — ăn chia", () => {
  const crew = [
    member({ id: "tt", shares: 2 }), // tài công 2 phần
    member({ id: "mt", shares: 1.5 }),
    member({
      id: "b1",
      shares: 1,
      advances: [
        { id: "a", date: "2026-06-01", amountVnd: 3_000_000, settled: false },
      ],
    }),
  ];

  it("trừ tổn chung rồi chia chủ/bạn, bạn chia theo phần", () => {
    // doanh thu 200tr, tổn 100tr → còn 100tr; chủ 50% = 50tr; bạn 50tr / 4.5 phần
    const r = splitTrip(
      { revenueVnd: 200_000_000, commonCostVnd: 100_000_000, ownerPercent: 50 },
      crew,
    );
    expect(r.netVnd).toBe(100_000_000);
    expect(r.ownerVnd).toBe(50_000_000);
    expect(r.crewPoolVnd).toBe(50_000_000);
    expect(r.perShareVnd).toBe(Math.round(50_000_000 / 4.5));
    expect(r.perMember[0].grossVnd).toBe(Math.round((50_000_000 / 4.5) * 2));
    // bạn b1: 1 phần trừ ứng 3tr
    const b1 = r.perMember[2];
    expect(b1.advanceVnd).toBe(3_000_000);
    expect(b1.finalVnd).toBe(b1.grossVnd - 3_000_000);
  });

  it("chuyến lỗ → không chia âm", () => {
    const r = splitTrip(
      { revenueVnd: 80_000_000, commonCostVnd: 100_000_000, ownerPercent: 50 },
      crew,
    );
    expect(r.netVnd).toBe(0);
    expect(r.ownerVnd).toBe(0);
    expect(r.perShareVnd).toBe(0);
  });

  it("không thuyền viên → không chia", () => {
    const r = splitTrip(
      { revenueVnd: 100_000_000, commonCostVnd: 50_000_000, ownerPercent: 60 },
      [],
    );
    expect(r.perShareVnd).toBe(0);
    expect(r.perMember).toEqual([]);
  });
});
