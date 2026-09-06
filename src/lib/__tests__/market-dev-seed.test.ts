import { describe, it, expect } from "vitest";
import { PRODUCT_CATEGORIES } from "@/lib/market/categories";
import { buildDevSeed, DEV_PERSONAS, seedCategoryCoverage } from "@/lib/market/dev-seed";
import { recountRating } from "@/lib/market/rating";
import { validateMarketProductDraft, validateShopDraft } from "@/lib/market/validate";
import { isValidVnPhone } from "@/lib/phone";

const NOW = new Date("2026-09-06T08:00:00Z");

describe("buildDevSeed — 12 §5.3", () => {
  const seed = buildDevSeed(NOW);

  it("đủ 9 danh mục, mỗi danh mục ≥ 2 món; 3 shop; 7 persona SĐT hợp lệ", () => {
    const cov = seedCategoryCoverage(seed);
    for (const c of PRODUCT_CATEGORIES) expect(cov[c], c).toBeGreaterThanOrEqual(2);
    expect(seed.shops).toHaveLength(3);
    expect(seed.personas).toEqual(DEV_PERSONAS);
    for (const p of seed.personas) expect(isValidVnPhone(p.phone), p.phone).toBe(true);
    expect(seed.personas.filter((p) => p.role === "admin")).toHaveLength(1);
  });

  it("mọi product qua validateMarketProductDraft; mọi shop qua validateShopDraft", () => {
    for (const p of seed.products) {
      const err = validateMarketProductDraft({
        title: p.title, description: p.description, category: p.category, priceVnd: p.priceVnd,
        compareAtVnd: p.compareAtVnd, unit: p.unit, stock: p.stock, images: p.images, variants: p.variants, status: p.status,
      });
      expect(err, p.title).toBeNull();
    }
    for (const s of seed.shops) {
      const err = validateShopDraft({
        name: s.name, description: s.description, phone: s.phone, province: s.province ?? "", address: s.address,
        bankName: s.bankName, bankAccount: s.bankAccount, bankHolder: s.bankHolder,
        shippingFlatVnd: s.shippingFlatVnd, freeShipFromVnd: s.freeShipFromVnd,
      });
      expect(err, s.name).toBeNull();
    }
  });

  it("id không trùng (shop/product/order/review)", () => {
    const ids = [...seed.shops, ...seed.products, ...seed.orders, ...seed.reviews].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(seed.orders.map((o) => o.code)).size).toBe(seed.orders.length);
    expect(new Set(seed.shops.map((s) => s.slug)).size).toBe(3);
  });

  it("các ca đặc biệt: het_hang · an · adminHidden · deleted · stock 2 · biến thể · giá gạch", () => {
    const st = (f: (p: (typeof seed.products)[number]) => boolean) => seed.products.filter(f).length;
    expect(st((p) => p.status === "het_hang" && p.stock === 0)).toBeGreaterThanOrEqual(1);
    expect(st((p) => p.status === "an")).toBeGreaterThanOrEqual(1);
    expect(st((p) => p.adminHidden && p.adminHiddenReason === "Ngư cụ cấm")).toBe(1);
    expect(st((p) => !!p.deletedAt)).toBe(1);
    expect(st((p) => p.stock === 2)).toBeGreaterThanOrEqual(1);
    expect(st((p) => p.variants.length >= 2)).toBe(2);
    expect(st((p) => p.compareAtVnd != null)).toBe(3);
    expect(st(() => true)).toBeGreaterThanOrEqual(24);
  });

  it("SDVICO hoạt động không STK; Hải Đăng có STK + free ship; Phương Nam chờ duyệt; persona 0902000001 là chủ SDVICO", () => {
    const sd = seed.shops.find((s) => s.slug === "sdvico")!;
    const hd = seed.shops.find((s) => s.slug === "dai-ly-hai-dang")!;
    const pn = seed.shops.find((s) => s.slug === "dai-ly-phuong-nam")!;
    expect(sd.status).toBe("hoat_dong");
    expect(sd.ownerPhone).toBe("0902000001");
    expect(sd.bankAccount).toBeUndefined();
    expect(hd.bankAccount).toBeTruthy();
    expect(hd.freeShipFromVnd).toBe(2_000_000);
    expect(hd.shippingFlatVnd).toBe(30_000);
    expect(pn.status).toBe("cho_duyet");
  });

  it("đơn mẫu: 1 cho_xac_nhan CK bao_da_chuyen có bankSnapshot · 1 dang_giao · 2 da_giao (2 ngày + 9 ngày) · 1 hoan_thanh · 1 da_huy needsRefund", () => {
    const by = (s: string) => seed.orders.filter((o) => o.status === s);
    const o1 = by("cho_xac_nhan")[0];
    expect(o1.paymentMethod).toBe("chuyen_khoan");
    expect(o1.paymentStatus).toBe("bao_da_chuyen");
    expect(o1.bankSnapshot?.bankAccount).toBeTruthy();
    expect(by("dang_giao")).toHaveLength(1);
    const dg = by("da_giao");
    expect(dg).toHaveLength(2);
    const ages = dg.map((o) => Math.round((NOW.getTime() - Date.parse(o.deliveredAt!)) / 86400000)).sort();
    expect(ages).toEqual([2, 9]);
    expect(by("hoan_thanh")[0].completedAt).toBeTruthy();
    const huy = by("da_huy")[0];
    expect(huy.buyerPhone).toBe("0901000002");
    expect(huy.needsRefund).toBe(true);
    expect(huy.cancelBy).toBe("seller");
    expect(huy.restockedAt).toBeTruthy();
    for (const o of seed.orders) {
      expect(o.timeline.length).toBeGreaterThan(0);
      expect(o.timeline[0].status).toBe("cho_xac_nhan");
      expect(o.totalVnd).toBe(o.subtotalVnd + o.shippingVnd);
    }
  });

  it("3 đánh giá, 1 ẩn; điểm cache = recountRating tính lại (chỉ đếm không ẩn)", () => {
    expect(seed.reviews).toHaveLength(3);
    expect(seed.reviews.filter((r) => r.hidden)).toHaveLength(1);
    for (const p of seed.products) {
      const r = recountRating(seed.reviews, p.id, p.shopId);
      expect(p.ratingAvg, p.title).toBe(r.product.avg);
      expect(p.ratingCount, p.title).toBe(r.product.count);
    }
    for (const s of seed.shops) {
      const r = recountRating(seed.reviews, "", s.id);
      expect(s.ratingAvg).toBe(r.shop.avg);
      expect(s.ratingCount).toBe(r.shop.count);
    }
    const sd = seed.shops.find((s) => s.slug === "sdvico")!;
    expect(sd.ratingCount).toBe(2);
    expect(sd.ratingAvg).toBe(4.5);
  });

  it("ảnh là SVG data-URI; searchText không dấu", () => {
    for (const p of seed.products) {
      expect(p.images[0]).toMatch(/^data:image\/svg\+xml/);
      expect(p.searchText).toBe(p.searchText.toLowerCase());
      expect(p.searchText).not.toMatch(/[àáạảãđ]/);
    }
  });
});
