import { describe, expect, it } from "vitest";
import { mapCrmAssets, type CrmWarrantyRow } from "../sdwork-assets";

describe("mapCrmAssets — gồm cả THIẾT BỊ IMPORT (giám sát hành trình)", () => {
  // gateway v4 gộp vw_imported_serials theo SĐT vào warranties; thiết bị import
  // KHÔNG có hạn bảo hành/đơn hàng → expires_at/orders = null.
  const warranties: CrmWarrantyRow[] = [
    {
      serial: "WC1",
      activated_at: "2025-01-01T00:00:00Z",
      expires_at: "2027-01-01T00:00:00Z",
      status: "active",
      order_id: "o1",
      products: { name: "Lọc dầu SF50B" },
      orders: { code: "DH001" },
    },
    {
      serial: "MTR0001",
      activated_at: "2026-04-01T00:00:00Z",
      expires_at: null,
      status: "ACTIVE",
      order_id: null,
      products: { name: "Giám sát hành trình Viettel" },
      orders: null,
    },
  ];

  it("map cả warranty thật lẫn thiết bị import; không bịa hạn bảo hành", () => {
    const out = mapCrmAssets(warranties, [], []);
    expect(out.products).toHaveLength(2);

    const imp = out.products.find((p) => p.serial === "MTR0001")!;
    expect(imp.name).toBe("Giám sát hành trình Viettel");
    expect(imp.warrantyUntil).toBeUndefined(); // không có hạn BH → không bịa
    expect(imp.purchasedOn).toBe("2026-04-01");

    const wc = out.products.find((p) => p.serial === "WC1")!;
    expect(wc.warrantyUntil).toBe("2027-01-01");
    expect(wc.orderCode).toBe("DH001");
  });
});
