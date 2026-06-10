import { describe, expect, it } from "vitest";
import {
  BoatProduct,
  byWarrantyUrgency,
  demoProducts,
  getWarrantyStatus,
} from "../products";

const TODAY = new Date("2026-06-10T00:00:00Z");

function product(over: Partial<BoatProduct>): BoatProduct {
  return {
    id: "p1",
    name: "Máy dò cá",
    ...over,
  };
}

/** ISO date `offset` days from TODAY. */
function iso(offsetDays: number): string {
  const t = new Date(TODAY);
  t.setUTCDate(t.getUTCDate() + offsetDays);
  return t.toISOString().slice(0, 10);
}

describe("getWarrantyStatus", () => {
  it("không có ngày bảo hành → none", () => {
    expect(getWarrantyStatus(product({ warrantyUntil: undefined }), TODAY)).toEqual(
      { level: "none", days: null, label: "Không rõ hạn bảo hành" },
    );
  });

  it("quá hạn → expired, đếm số ngày đã quá", () => {
    const s = getWarrantyStatus(product({ warrantyUntil: iso(-5) }), TODAY);
    expect(s.level).toBe("expired");
    expect(s.days).toBe(-5);
    expect(s.label).toBe("Hết bảo hành 5 ngày");
  });

  it("hết hạn hôm nay → soon", () => {
    const s = getWarrantyStatus(product({ warrantyUntil: iso(0) }), TODAY);
    expect(s.level).toBe("soon");
    expect(s.days).toBe(0);
    expect(s.label).toBe("Hết bảo hành hôm nay");
  });

  it("trong vòng 30 ngày → soon", () => {
    const s = getWarrantyStatus(product({ warrantyUntil: iso(20) }), TODAY);
    expect(s.level).toBe("soon");
    expect(s.days).toBe(20);
    expect(s.label).toBe("Còn bảo hành 20 ngày");
  });

  it("đúng mốc 30 ngày vẫn là soon", () => {
    expect(getWarrantyStatus(product({ warrantyUntil: iso(30) }), TODAY).level).toBe(
      "soon",
    );
  });

  it("còn dài hạn (>30 ngày) → ok", () => {
    const s = getWarrantyStatus(product({ warrantyUntil: iso(200) }), TODAY);
    expect(s.level).toBe("ok");
    expect(s.days).toBe(200);
  });
});

describe("byWarrantyUrgency", () => {
  it("xếp khẩn cấp nhất lên đầu, không rõ hạn xuống cuối", () => {
    const items: BoatProduct[] = [
      product({ id: "ok", warrantyUntil: iso(200) }),
      product({ id: "none", warrantyUntil: undefined }),
      product({ id: "expired", warrantyUntil: iso(-10) }),
      product({ id: "soon", warrantyUntil: iso(15) }),
    ];
    const sorted = [...items].sort(byWarrantyUrgency(TODAY)).map((p) => p.id);
    expect(sorted).toEqual(["expired", "soon", "ok", "none"]);
  });
});

describe("demoProducts", () => {
  it("gắn boatId truyền vào và có 2 sản phẩm (1 soon, 1 ok)", () => {
    const items = demoProducts(TODAY, "boat-9");
    expect(items).toHaveLength(2);
    expect(items.every((p) => p.boatId === "boat-9")).toBe(true);
    const levels = items.map((p) => getWarrantyStatus(p, TODAY).level);
    expect(levels).toContain("soon");
    expect(levels).toContain("ok");
  });
});
