import { describe, expect, it } from "vitest";
import { buildOrderPayload } from "@/lib/sdwork-order";

describe("buildOrderPayload — payload gửi function sdfish-order", () => {
  it("shape đúng: action create · source sdfish · externalRef · customer · items", () => {
    const p = buildOrderPayload({
      externalRef: "sdf-abc",
      fullName: "Anh Hai",
      phone: "0901234567",
      items: [{ productName: "Máy lọc dầu diesel SF50", qty: 1 }],
    });
    expect(p).toMatchObject({
      action: "create",
      source: "sdfish",
      externalRef: "sdf-abc",
      customer: { fullName: "Anh Hai", phone: "0901234567" },
      note: null,
      deliveryAddress: null,
    });
    expect(p.items).toEqual([
      { productName: "Máy lọc dầu diesel SF50", sku: null, qty: 1, unitPriceVnd: null },
    ]);
  });

  it("qty không hợp lệ → 1; giá ≤0/thiếu → null", () => {
    const p = buildOrderPayload({
      externalRef: "r",
      fullName: "x",
      phone: "0900000000",
      items: [
        { productName: "A", qty: 0 },
        { productName: "B", qty: 3, unitPriceVnd: 250000 },
        { productName: "C", qty: -2, unitPriceVnd: 0 },
      ],
    });
    const items = p.items as { qty: number; unitPriceVnd: number | null }[];
    expect(items[0].qty).toBe(1);
    expect(items[1]).toMatchObject({ qty: 3, unitPriceVnd: 250000 });
    expect(items[2]).toMatchObject({ qty: 1, unitPriceVnd: null });
  });

  it("note/deliveryAddress rỗng → null (không đẩy chuỗi rỗng sang CRM)", () => {
    const p = buildOrderPayload({
      externalRef: "r",
      fullName: "x",
      phone: "0900000000",
      items: [{ productName: "A", qty: 1 }],
      note: "   ",
      deliveryAddress: "",
    });
    expect(p.note).toBeNull();
    expect(p.deliveryAddress).toBeNull();
  });
});
