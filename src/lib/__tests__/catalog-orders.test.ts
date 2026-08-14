import { describe, expect, it } from "vitest";
import {
  buildOrderLines,
  canTransition,
  computeOrderTotal,
  isValidQty,
  rowToOrder,
  validateOrderDraft,
  type OrderDraft,
} from "@/lib/catalog-orders";
import type { ProductListing } from "@/lib/product-catalog";

function listing(over: Partial<ProductListing> = {}): ProductListing {
  return {
    id: "p1",
    vendorKind: "sdvico",
    title: "Đá cây",
    features: [],
    group: "nhu_yeu_pham",
    priceVnd: 30000,
    unit: "cây",
    orderable: true,
    visible: true,
    sortOrder: 0,
    createdAt: "",
    ...over,
  };
}

function draft(over: Partial<OrderDraft> = {}): OrderDraft {
  return {
    items: [{ listingId: "p1", qty: 2 }],
    contactPhone: "0901234567",
    ...over,
  };
}

describe("isValidQty", () => {
  it("nguyên 1..999 hợp lệ; ngoài khoảng / lẻ / âm không hợp lệ", () => {
    expect(isValidQty(1)).toBe(true);
    expect(isValidQty(999)).toBe(true);
    expect(isValidQty(0)).toBe(false);
    expect(isValidQty(1000)).toBe(false);
    expect(isValidQty(2.5)).toBe(false);
    expect(isValidQty(-1)).toBe(false);
    expect(isValidQty("2" as unknown as number)).toBe(false);
  });
});

describe("validateOrderDraft", () => {
  it("giỏ hợp lệ + SĐT hợp lệ → null", () => {
    expect(validateOrderDraft(draft())).toBeNull();
  });
  it("giỏ trống → báo lỗi", () => {
    expect(validateOrderDraft(draft({ items: [] }))).toMatch(/trống/i);
  });
  it("số lượng lẻ/0 → báo lỗi số lượng", () => {
    expect(
      validateOrderDraft(draft({ items: [{ listingId: "p1", qty: 0 }] })),
    ).toMatch(/số lượng/i);
  });
  it("SĐT sai → báo lỗi điện thoại", () => {
    expect(validateOrderDraft(draft({ contactPhone: "123" }))).toMatch(/điện thoại/i);
  });
});

describe("buildOrderLines — giá lấy từ danh mục, bỏ món không đặt được", () => {
  it("dựng dòng + tính line_total đúng", () => {
    const { lines, dropped } = buildOrderLines(
      [{ listingId: "p1", qty: 3 }],
      [listing({ priceVnd: 30000 })],
    );
    expect(dropped).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ priceVnd: 30000, qty: 3, lineTotalVnd: 90000 });
  });
  it("món ẩn / không orderable / không giá → bị bỏ (dropped)", () => {
    const catalog = [
      listing({ id: "a", orderable: false }),
      listing({ id: "b", visible: false }),
      listing({ id: "c", priceVnd: undefined }),
    ];
    const { lines, dropped } = buildOrderLines(
      [
        { listingId: "a", qty: 1 },
        { listingId: "b", qty: 1 },
        { listingId: "c", qty: 1 },
        { listingId: "khong-co", qty: 1 },
      ],
      catalog,
    );
    expect(lines).toHaveLength(0);
    expect(dropped.sort()).toEqual(["a", "b", "c", "khong-co"]);
  });
});

describe("computeOrderTotal", () => {
  it("cộng tổng các dòng", () => {
    const { lines } = buildOrderLines(
      [
        { listingId: "p1", qty: 2 },
        { listingId: "p2", qty: 1 },
      ],
      [
        listing({ id: "p1", priceVnd: 30000 }),
        listing({ id: "p2", priceVnd: 50000 }),
      ],
    );
    expect(computeOrderTotal(lines)).toBe(110000);
  });
});

describe("canTransition — một chiều, không quay lui", () => {
  it("chuyển hợp lệ", () => {
    expect(canTransition("moi", "da_nhan")).toBe(true);
    expect(canTransition("moi", "da_huy")).toBe(true);
    expect(canTransition("da_nhan", "dang_giao")).toBe(true);
    expect(canTransition("dang_giao", "da_giao")).toBe(true);
    expect(canTransition("dang_giao", "da_huy")).toBe(true);
  });
  it("chuyển KHÔNG hợp lệ", () => {
    expect(canTransition("moi", "dang_giao")).toBe(false);
    expect(canTransition("da_giao", "dang_giao")).toBe(false);
    expect(canTransition("da_huy", "moi")).toBe(false);
    expect(canTransition("da_nhan", "moi")).toBe(false);
  });
});

describe("rowToOrder", () => {
  it("map field + items lọc dòng lỗi + status lạ → 'moi'", () => {
    const order = rowToOrder({
      id: "o1",
      customer_phone: "0901234567",
      boat_name: "Tàu A",
      boat_ref: null,
      items: [
        { listingId: "p1", title: "Đá", unit: "cây", priceVnd: 30000, qty: 2, lineTotalVnd: 60000 },
        { rác: true },
      ],
      total_vnd: 60000,
      delivery_location: "Cảng Hòn Rớ",
      contact_name: null,
      contact_phone: "0901234567",
      note: null,
      status: "xyz",
      handled_by: null,
      handled_at: null,
      dealer_note: null,
      created_at: "2026-08-11T00:00:00Z",
      updated_at: "2026-08-11T00:00:00Z",
    });
    expect(order.items).toHaveLength(1);
    expect(order.totalVnd).toBe(60000);
    expect(order.status).toBe("moi");
    expect(order.boatName).toBe("Tàu A");
  });
});
