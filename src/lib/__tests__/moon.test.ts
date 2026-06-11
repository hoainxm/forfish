import { describe, expect, it } from "vitest";
import { moonPhase } from "../moon";

// mốc chuẩn: 2000-01-06 18:14 UTC là trăng non
const NEW = Date.UTC(2000, 0, 6, 18, 14);
const day = 86400000;

describe("moonPhase", () => {
  it("đúng mốc trăng non / thượng huyền / rằm / hạ huyền", () => {
    expect(moonPhase(new Date(NEW)).label).toContain("Trăng non");
    expect(moonPhase(new Date(NEW + 7.38 * day)).label).toContain("thượng huyền");
    expect(moonPhase(new Date(NEW + 14.77 * day)).label).toContain("rằm");
    expect(moonPhase(new Date(NEW + 22.15 * day)).label).toContain("hạ huyền");
  });

  it("frac quay vòng 0..1, hoạt động cả trước mốc chuẩn", () => {
    const m = moonPhase(new Date(NEW - 3 * day)); // trước mốc
    expect(m.frac).toBeGreaterThanOrEqual(0);
    expect(m.frac).toBeLessThan(1);
    // 29.53 ngày sau trăng non lại về non
    expect(moonPhase(new Date(NEW + 29.530589 * day)).label).toContain("Trăng non");
  });

  it("lời khuyên nghề đèn: tối trời thuận, sáng trăng kém", () => {
    expect(moonPhase(new Date(NEW)).note).toContain("thuận");
    expect(moonPhase(new Date(NEW + 14.77 * day)).note).toContain("kém");
  });
});
