import { describe, expect, it } from "vitest";
import { complianceMilestones } from "@/lib/compliance";

const TODAY = new Date("2026-06-15T00:00:00Z");

describe("complianceMilestones", () => {
  it("eCDT áp dụng mọi tàu, đã hiệu lực (01/3/2026 < 15/6/2026)", () => {
    const ms = complianceMilestones(8, TODAY);
    const ecdt = ms.find((m) => m.id === "ecdt")!;
    expect(ecdt.status).toBe("active");
    expect(ecdt.daysUntil).toBeLessThan(0);
  });

  it("tàu <12m: chưa bắt buộc NKKT (chỉ có eCDT)", () => {
    const ms = complianceMilestones(10, TODAY);
    expect(ms.map((m) => m.id)).toEqual(["ecdt"]);
  });

  it("tàu ≥24m: NKKT 01/7/2026 còn sắp tới", () => {
    const ms = complianceMilestones(26, TODAY);
    const nkkt = ms.find((m) => m.id === "nkkt")!;
    expect(nkkt.effectiveDate).toBe("2026-07-01");
    expect(nkkt.status).toBe("upcoming");
    expect(nkkt.daysUntil).toBe(16);
  });

  it("mốc NKKT theo cỡ tàu", () => {
    expect(
      complianceMilestones(20, TODAY).find((m) => m.id === "nkkt")!.effectiveDate,
    ).toBe("2026-09-01");
    expect(
      complianceMilestones(13, TODAY).find((m) => m.id === "nkkt")!.effectiveDate,
    ).toBe("2027-01-01");
  });
});
