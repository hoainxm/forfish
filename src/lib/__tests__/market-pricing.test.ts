import { describe, it, expect } from "vitest";
import {
  acceptsBankTransfer,
  buildMarketLines,
  computeCartSummary,
  computeTotals,
  discountPercent,
  groupCartByShop,
  isPurchasable,
  isValidMarketQty,
  shippingFor,
  shopsForcingCod,
  unitPriceFor,
} from "@/lib/market/pricing";
import type { Product, Shop } from "@/lib/market/types";

function product(p: Partial<Product> = {}): Product {
  return {
    id: "p1", shopId: "s1", title: "Đá cây 50kg", category: "da-bao-quan", priceVnd: 35000, unit: "cây",
    stock: 100, images: ["data:image/svg+xml;utf8,x"], variants: [], status: "dang_ban", adminHidden: false,
    soldCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
    ...p,
  };
}
const shopOk = { id: "s1", status: "hoat_dong" as const, paused: false };

describe("buildMarketLines — mỗi DropReason một ca", () => {
  it("khong_ton_tai (không có / deleted / adminHidden / shop khác)", () => {
    const r = buildMarketLines(
      [{ productId: "x", qty: 1 }, { productId: "p2", qty: 1 }, { productId: "p3", qty: 1 }, { productId: "p4", qty: 1 }],
      [product({ id: "p2", deletedAt: "2026-09-01T00:00:00Z" }), product({ id: "p3", adminHidden: true }), product({ id: "p4", shopId: "s9" })],
      shopOk,
    );
    expect(r.lines).toEqual([]);
    expect(r.dropped.map((d) => d.reason)).toEqual(["khong_ton_tai", "khong_ton_tai", "khong_ton_tai", "khong_ton_tai"]);
  });
  it("ngung_ban (an) · het_hang (stock 0) · thieu_hang kèm available", () => {
    const r = buildMarketLines(
      [{ productId: "a", qty: 1 }, { productId: "b", qty: 1 }, { productId: "c", qty: 5 }],
      [product({ id: "a", status: "an" }), product({ id: "b", stock: 0, status: "het_hang" }), product({ id: "c", stock: 2 })],
      shopOk,
    );
    expect(r.dropped).toEqual([
      { productId: "a", variantLabel: undefined, reason: "ngung_ban" },
      { productId: "b", variantLabel: undefined, reason: "het_hang" },
      { productId: "c", variantLabel: undefined, reason: "thieu_hang", available: 2 },
    ]);
  });
  it("sai_bien_the · shop_dong · shop_nghi", () => {
    const withVar = product({ id: "v", variants: [{ label: "Ø10" }, { label: "Ø12" }] });
    const r1 = buildMarketLines([{ productId: "v", qty: 1, variantLabel: "Ø99" }, { productId: "v", qty: 1 }], [withVar], shopOk);
    expect(r1.dropped.map((d) => d.reason)).toEqual(["sai_bien_the", "sai_bien_the"]);
    const r2 = buildMarketLines([{ productId: "p1", qty: 1 }], [product()], { ...shopOk, status: "tam_khoa" });
    expect(r2.dropped[0].reason).toBe("shop_dong");
    const r3 = buildMarketLines([{ productId: "p1", qty: 1 }], [product()], { ...shopOk, paused: true });
    expect(r3.dropped[0].reason).toBe("shop_nghi");
  });
  it("dòng hợp lệ: snapshot đúng; biến thể có giá riêng lấy giá riêng, không có thì giá gốc", () => {
    const led = product({ id: "led", priceVnd: 850000, variants: [{ label: "50W", priceVnd: 850000 }, { label: "100W", priceVnd: 1450000 }] });
    const rope = product({ id: "rope", priceVnd: 45000, unit: "kg", variants: [{ label: "Ø10" }, { label: "Ø12" }] });
    const r = buildMarketLines(
      [{ productId: "led", qty: 2, variantLabel: "100W" }, { productId: "rope", qty: 3, variantLabel: "Ø12" }, { productId: "p1", qty: 10 }],
      [led, rope, product()],
      shopOk,
    );
    expect(r.dropped).toEqual([]);
    expect(r.lines).toEqual([
      { productId: "led", variantLabel: "100W", title: led.title, unit: "cây", priceVnd: 1450000, qty: 2, lineTotalVnd: 2900000, image: led.images[0] },
      { productId: "rope", variantLabel: "Ø12", title: rope.title, unit: "kg", priceVnd: 45000, qty: 3, lineTotalVnd: 135000, image: rope.images[0] },
      { productId: "p1", title: "Đá cây 50kg", unit: "cây", priceVnd: 35000, qty: 10, lineTotalVnd: 350000, image: "data:image/svg+xml;utf8,x" },
    ]);
    expect(unitPriceFor(led, "50W")).toBe(850000);
    expect(unitPriceFor(led)).toBeNull();
    expect(unitPriceFor(product())).toBe(35000);
  });
});

describe("shippingFor / computeTotals / computeCartSummary", () => {
  const shop = { shippingFlatVnd: 30000, freeShipFromVnd: 2000000 };
  it("4 ca ship: 0 khi subtotal 0 · dưới ngưỡng · bằng ngưỡng · không ngưỡng", () => {
    expect(shippingFor(shop, 0)).toBe(0);
    expect(shippingFor(shop, 1999999)).toBe(30000);
    expect(shippingFor(shop, 2000000)).toBe(0);
    expect(shippingFor({ shippingFlatVnd: 30000 }, 99999999)).toBe(30000);
  });
  it("computeTotals cộng đúng", () => {
    const lines = [
      { productId: "a", title: "A", unit: "cái", priceVnd: 100000, qty: 3, lineTotalVnd: 300000 },
      { productId: "b", title: "B", unit: "cái", priceVnd: 50000, qty: 1, lineTotalVnd: 50000 },
    ];
    expect(computeTotals(lines, shop)).toEqual({ subtotalVnd: 350000, shippingVnd: 30000, totalVnd: 380000 });
    expect(computeTotals([], shop)).toEqual({ subtotalVnd: 0, shippingVnd: 0, totalVnd: 0 });
    expect(computeCartSummary([{ lines, shippingVnd: 30000 }, { lines: [lines[1]], shippingVnd: 0 }])).toEqual({
      subtotalVnd: 400000, shippingVnd: 30000, totalVnd: 430000, shopCount: 2,
    });
  });
});

describe("groupCartByShop", () => {
  it("giữ thứ tự xuất hiện; dòng không có sản phẩm ⇒ dropped", () => {
    const r = groupCartByShop(
      [{ productId: "b", qty: 1 }, { productId: "a", qty: 1 }, { productId: "zzz", qty: 1 }, { productId: "c", qty: 2 }],
      [product({ id: "a", shopId: "s1" }), product({ id: "b", shopId: "s2" }), product({ id: "c", shopId: "s1" })],
    );
    expect([...r.byShop.keys()]).toEqual(["s2", "s1"]);
    expect(r.byShop.get("s1")).toEqual([{ productId: "a", qty: 1 }, { productId: "c", qty: 2 }]);
    expect(r.dropped).toEqual([{ productId: "zzz", variantLabel: undefined, reason: "khong_ton_tai" }]);
  });
});

describe("discountPercent / isPurchasable / isValidMarketQty / acceptsBankTransfer / shopsForcingCod", () => {
  it("discountPercent làm tròn; < 5% hoặc không có ⇒ null", () => {
    expect(discountPercent({ priceVnd: 80000, compareAtVnd: 100000 })).toBe(20);
    expect(discountPercent({ priceVnd: 2450000, compareAtVnd: 2900000 })).toBe(16);
    expect(discountPercent({ priceVnd: 97000, compareAtVnd: 100000 })).toBeNull();
    expect(discountPercent({ priceVnd: 100000 })).toBeNull();
    expect(discountPercent({ priceVnd: 100000, compareAtVnd: 90000 })).toBeNull();
  });
  it("isPurchasable 6 ca", () => {
    const ok = { status: "dang_ban" as const, adminHidden: false, deletedAt: undefined, stock: 1 };
    expect(isPurchasable(ok, shopOk)).toBe(true);
    expect(isPurchasable({ ...ok, stock: 0 }, shopOk)).toBe(false);
    expect(isPurchasable({ ...ok, status: "an" }, shopOk)).toBe(false);
    expect(isPurchasable({ ...ok, adminHidden: true }, shopOk)).toBe(false);
    expect(isPurchasable({ ...ok, deletedAt: "2026-09-01T00:00:00Z" }, shopOk)).toBe(false);
    expect(isPurchasable(ok, { status: "hoat_dong", paused: true })).toBe(false);
    expect(isPurchasable(ok, { status: "cho_duyet", paused: false })).toBe(false);
  });
  it("isValidMarketQty 1..999 nguyên", () => {
    expect(isValidMarketQty(1)).toBe(true);
    expect(isValidMarketQty(999)).toBe(true);
    expect(isValidMarketQty(0)).toBe(false);
    expect(isValidMarketQty(1000)).toBe(false);
    expect(isValidMarketQty(1.5)).toBe(false);
    expect(isValidMarketQty("3")).toBe(false);
  });
  it("acceptsBankTransfer đủ 3 trường; shopsForcingCod trả tên shop không nhận CK", () => {
    const a: Pick<Shop, "name" | "bankName" | "bankAccount" | "bankHolder"> = { name: "SDVICO" };
    const b = { name: "Hải Đăng", bankName: "VCB", bankAccount: "0071000123456", bankHolder: "NGUYEN VAN HAI" };
    expect(acceptsBankTransfer(a)).toBe(false);
    expect(acceptsBankTransfer(b)).toBe(true);
    expect(acceptsBankTransfer({ ...b, bankHolder: " " })).toBe(false);
    expect(shopsForcingCod([a, b])).toEqual(["SDVICO"]);
    expect(shopsForcingCod([b])).toEqual([]);
  });
});
