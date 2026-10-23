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

  it("lời nghề đèn: tối trời đèn nổi rõ, sáng trăng đèn kém nổi", () => {
    expect(moonPhase(new Date(NEW)).note).toContain("nổi rõ");
    expect(moonPhase(new Date(NEW + 14.77 * day)).note).toContain("kém nổi");
  });

  it("không khẳng định cá ăn kém dưới trăng sáng — dữ liệu 2026 không thấy (Dòng Dẫn bước 15)", () => {
    for (let d = 0; d < 29.5; d += 0.5) {
      const note = moonPhase(new Date(NEW + d * day)).note;
      expect(note).not.toMatch(/kém ăn|ăn kém|cá kém|đánh đèn thuận/);
    }
    expect(moonPhase(new Date(NEW + 14.77 * day)).note).toContain("chưa thấy mực, cá cơm ít đi");
  });
});
