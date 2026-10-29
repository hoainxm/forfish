import { describe, expect, it } from "vitest";
import { complianceMilestones, dongMocNghiaVu } from "@/lib/compliance";

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

describe("dongMocNghiaVu — một dòng ở Tủ giấy tờ", () => {
  const HOM_NAY = new Date("2026-10-29T03:00:00Z");
  it("tàu 12–15 m: mốc 01/01/2027 sắp tới + số ngày còn", () => {
    expect(dongMocNghiaVu(13, HOM_NAY)).toBe(
      "Tàu 12–15 m: từ 01/01/2027 phải ghi nhật ký khai thác điện tử — còn 64 ngày.",
    );
  });
  it("tàu 15–24 m: mốc đã qua ⇒ nói đã phải ghi từ ngày nào", () => {
    expect(dongMocNghiaVu(20, HOM_NAY)).toBe("Tàu 15–24 m: đã phải ghi nhật ký khai thác điện tử từ 01/09/2026.");
  });
  it("tàu dưới 12 m: chỉ eCDT, nói rõ chưa bắt buộc nhật ký", () => {
    expect(dongMocNghiaVu(9, HOM_NAY)).toMatch(/^Tàu dưới 12 m: phải khai ra\/vào cảng điện tử \(eCDT\) từ 01\/03\/2026/);
  });
  it("trước 01/3/2026, tàu nhỏ: eCDT là mốc sắp tới", () => {
    expect(dongMocNghiaVu(9, new Date("2026-02-20T03:00:00Z"))).toBe(
      "Tàu dưới 12 m: từ 01/03/2026 phải khai ra/vào cảng điện tử (eCDT) — còn 9 ngày.",
    );
  });
  it("chưa khai chiều dài / số lạ ⇒ null (không đoán cỡ tàu)", () => {
    for (const v of [undefined, null, 0, -3, Number.NaN, Infinity]) expect(dongMocNghiaVu(v, HOM_NAY)).toBeNull();
  });
});
