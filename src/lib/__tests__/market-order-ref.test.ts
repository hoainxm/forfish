import { describe, it, expect } from "vitest";
import { fnv1a64Hex, marketOrderClientRef } from "@/lib/market/order-ref";
import { orderClientRef } from "@/lib/catalog-orders";
import type { Address } from "@/lib/market/types";

/** Bản FNV cũ từng nằm trong catalog-orders.ts (trước 2026-09-06) — vector đối chứng. */
function oldFnv(s: string): string {
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return `${fnv(0x811c9dc5)}${fnv(0x9e3779b9)}`;
}

const address: Address = { name: "Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng Hòn Rớ", isPort: true };
const common = { address, paymentMethod: "cod" as const, buyerNote: "Giao sáng" };
const shop = { shopId: "s1", items: [{ productId: "p1", qty: 2 }, { productId: "p2", qty: 1, variantLabel: "Ø12" }] };

describe("fnv1a64Hex — hàm băm dùng chung", () => {
  it("khớp vector của bản cũ trong catalog-orders (mã đơn cũ KHÔNG đổi)", () => {
    for (const s of ["", "a", "p1:2,p2:1|Cảng Cát Lở|Ba|0901000001|", "Dây thừng Ø12 — Đà Nẵng"]) {
      expect(fnv1a64Hex(s)).toBe(oldFnv(s));
      expect(fnv1a64Hex(s)).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(fnv1a64Hex("")).toBe("811c9dc59e3779b9");
  });
  it("orderClientRef (catalog) vẫn ra cùng chuỗi v1-… sau khi đổi import", () => {
    const d = { items: [{ listingId: "p1", qty: 2 }, { listingId: "a9", qty: 1 }], contactPhone: "0901000001", deliveryLocation: "Cảng Cát Lở" };
    // orderFingerprint = [items sắp theo id, boatRef, boatName, deliveryLocation, contactName, contactPhone, note].join("|")
    expect(orderClientRef(d)).toBe(`v1-${oldFnv("a9:1,p1:2|||Cảng Cát Lở||0901000001|")}`);
  });
});

describe("marketOrderClientRef — vân tay nội dung đơn một shop", () => {
  it("khuôn m1- + 16 hex; ổn định qua thứ tự món", () => {
    const a = marketOrderClientRef(shop, common);
    expect(a).toMatch(/^m1-[0-9a-f]{16}$/);
    const swapped = { shopId: "s1", items: [shop.items[1], shop.items[0]] };
    expect(marketOrderClientRef(swapped, common)).toBe(a);
    expect(marketOrderClientRef({ ...shop, items: shop.items.map((i) => ({ ...i })) }, { ...common })).toBe(a);
  });
  it("đổi qty / biến thể / địa chỉ / cách trả / ghi chú / shop ⇒ khác", () => {
    const a = marketOrderClientRef(shop, common);
    expect(marketOrderClientRef({ ...shop, items: [{ productId: "p1", qty: 3 }, shop.items[1]] }, common)).not.toBe(a);
    expect(marketOrderClientRef({ ...shop, items: [shop.items[0], { productId: "p2", qty: 1, variantLabel: "Ø14" }] }, common)).not.toBe(a);
    expect(marketOrderClientRef(shop, { ...common, address: { ...address, detail: "Cảng Vĩnh Lương" } })).not.toBe(a);
    expect(marketOrderClientRef(shop, { ...common, address: { ...address, isPort: false } })).not.toBe(a);
    expect(marketOrderClientRef(shop, { ...common, paymentMethod: "chuyen_khoan" })).not.toBe(a);
    expect(marketOrderClientRef(shop, { ...common, buyerNote: "Giao chiều" })).not.toBe(a);
    expect(marketOrderClientRef({ ...shop, shopId: "s2" }, common)).not.toBe(a);
  });
  it("trim ghi chú/địa chỉ; không ghi chú = ghi chú rỗng", () => {
    expect(marketOrderClientRef(shop, { ...common, buyerNote: "  Giao sáng " })).toBe(marketOrderClientRef(shop, common));
    expect(marketOrderClientRef(shop, { ...common, buyerNote: undefined })).toBe(marketOrderClientRef(shop, { ...common, buyerNote: "" }));
  });
  it("productId:variant:qty có dấu ngăn — 'p1' + '' + 12 ≠ 'p1' + '1' + 2", () => {
    const x = marketOrderClientRef({ shopId: "s", items: [{ productId: "p1", qty: 12 }] }, common);
    const y = marketOrderClientRef({ shopId: "s", items: [{ productId: "p1", qty: 2, variantLabel: "1" }] }, common);
    expect(x).not.toBe(y);
  });
});
