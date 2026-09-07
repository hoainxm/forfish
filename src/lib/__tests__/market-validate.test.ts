import { describe, it, expect } from "vitest";
import {
  CART_MAX_LINES,
  CHECKOUT_MAX_SHOPS,
  normalizeProductStatus,
  ORDER_MAX_LINES,
  addressErrorField,
  validateAddress,
  validateCancelReason,
  validateCheckout,
  validateMarketProductDraft,
  validatePaymentNote,
  validateReview,
  validateShopDraft,
  validateStatusNote,
} from "@/lib/market/validate";
import type { Address, CheckoutDraft, ProductDraftM, ShopDraft } from "@/lib/market/types";

const shop = (p: Partial<ShopDraft> = {}): ShopDraft => ({
  name: "Đại lý Hải Đăng", province: "Khánh Hòa", shippingFlatVnd: 30000, ...p,
});
const prod = (p: Partial<ProductDraftM> = {}): ProductDraftM => ({
  title: "Đá cây 50kg", category: "da-bao-quan", priceVnd: 35000, unit: "cây", stock: 100, images: [], variants: [], status: "dang_ban", ...p,
});
const addr = (p: Partial<Address> = {}): Address => ({
  name: "Nguyễn Văn Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng Hòn Rớ", isPort: true, ...p,
});
const checkout = (p: Partial<CheckoutDraft> = {}): CheckoutDraft => ({
  shops: [{ shopId: "s1", items: [{ productId: "p1", qty: 2 }], clientRef: "m1-0123456789abcdef", expectedTotalVnd: 100000 }],
  address: addr(), paymentMethod: "cod", ...p,
});

describe("validateShopDraft", () => {
  it("OK", () => {
    expect(validateShopDraft(shop())).toBeNull();
    expect(validateShopDraft(shop({ bankAccount: "0071000123456", bankName: "Vietcombank", bankHolder: "NGUYEN VAN HAI", freeShipFromVnd: 0 }))).toBeNull();
  });
  it("mỗi luật một ca lỗi", () => {
    expect(validateShopDraft(shop({ name: "ab" }))).toMatch(/tên shop/i);
    expect(validateShopDraft(shop({ phone: "123" }))).toMatch(/điện thoại/i);
    expect(validateShopDraft(shop({ province: "Hà Nội" }))).toMatch(/tỉnh/i);
    expect(validateShopDraft(shop({ address: "x".repeat(201) }))).toMatch(/địa chỉ/i);
    expect(validateShopDraft(shop({ description: "x".repeat(1001) }))).toMatch(/giới thiệu/i);
    expect(validateShopDraft(shop({ shippingFlatVnd: 5_000_001 }))).toMatch(/phí giao/i);
    expect(validateShopDraft(shop({ freeShipFromVnd: -1 }))).toMatch(/miễn phí/i);
    expect(validateShopDraft(shop({ bankAccount: "12345" }))).toMatch(/tài khoản/i);
    expect(validateShopDraft(shop({ bankAccount: "123456789" }))).toMatch(/ngân hàng/i);
  });
});

describe("validateMarketProductDraft", () => {
  it("OK — kể cả ảnh dev/data-uri và biến thể 2..10", () => {
    expect(validateMarketProductDraft(prod())).toBeNull();
    expect(validateMarketProductDraft(prod({
      images: ["https://x.supabase.co/a.jpg", "/api/dev/uploads/a.jpg", "data:image/svg+xml;utf8,x"],
      variants: [{ label: "Ø10" }, { label: "Ø12", priceVnd: 50000 }],
      compareAtVnd: 40000, description: "ok",
    }))).toBeNull();
  });
  it("mỗi luật một ca lỗi", () => {
    expect(validateMarketProductDraft(prod({ title: "ab" }))).toMatch(/tên món/i);
    expect(validateMarketProductDraft(prod({ category: "xe-may" as never }))).toMatch(/nhóm hàng/i);
    expect(validateMarketProductDraft(prod({ priceVnd: 999 }))).toMatch(/giá/i);
    expect(validateMarketProductDraft(prod({ compareAtVnd: 35000 }))).toMatch(/giá gạch/i);
    expect(validateMarketProductDraft(prod({ unit: "" }))).toMatch(/đơn vị/i);
    expect(validateMarketProductDraft(prod({ stock: 100000 }))).toMatch(/tồn kho/i);
    expect(validateMarketProductDraft(prod({ description: "x".repeat(2001) }))).toMatch(/mô tả/i);
    expect(validateMarketProductDraft(prod({ images: Array(7).fill("https://a/b.jpg") }))).toMatch(/ảnh/i);
    expect(validateMarketProductDraft(prod({ images: ["http://khong-https/a.jpg"] }))).toMatch(/ảnh/i);
    expect(validateMarketProductDraft(prod({ variants: [{ label: "Ø10" }] }))).toMatch(/ít nhất 2/);
    expect(validateMarketProductDraft(prod({ variants: Array.from({ length: 11 }, (_, i) => ({ label: `L${i}` })) }))).toMatch(/tối đa 10/i);
    expect(validateMarketProductDraft(prod({ variants: [{ label: "Đỏ" }, { label: "do" }] }))).toMatch(/trùng tên/i);
    expect(validateMarketProductDraft(prod({ variants: [{ label: "A" }, { label: "B", priceVnd: 10 }] }))).toMatch(/giá/i);
  });

  /*  MÓN LIÊN HỆ BÁO GIÁ (priceVnd null) — ADR 0011. Máy tàu, thiết bị lớn báo
      giá theo từng chiếc; không có bậc này thì shop phải bịa một con số. */
  describe("liên hệ báo giá (priceVnd null)", () => {
    it("hợp lệ khi không giá gạch, không loại/cỡ", () => {
      expect(validateMarketProductDraft(prod({ priceVnd: null, stock: 0 }))).toBeNull();
      expect(validateMarketProductDraft(prod({ priceVnd: null, stock: 0, description: "máy lọc nước biển 40L/h" }))).toBeNull();
    });
    it("giá gạch KHÔNG đi kèm — không có giá gốc thì gạch cái gì", () => {
      expect(validateMarketProductDraft(prod({ priceVnd: null, compareAtVnd: 40000 }))).toMatch(/giá gạch/i);
    });
    it("loại/cỡ KHÔNG đi kèm — giá biến thể đo theo giá gốc", () => {
      expect(
        validateMarketProductDraft(prod({ priceVnd: null, variants: [{ label: "50W" }, { label: "100W" }] })),
      ).toMatch(/loại/i);
    });
    it("giá 0 hay số âm vẫn là SAI, không phải 'liên hệ' — chỉ null mới là liên hệ", () => {
      expect(validateMarketProductDraft(prod({ priceVnd: 0 }))).toMatch(/giá/i);
      expect(validateMarketProductDraft(prod({ priceVnd: -1 }))).toMatch(/giá/i);
    });
  });
});

describe("validateAddress", () => {
  it("OK cảng + OK địa chỉ", () => {
    expect(validateAddress(addr())).toBeNull();
    expect(validateAddress(addr({ isPort: false, detail: "12 Trần Phú, Nha Trang" }))).toBeNull();
  });
  it("lỗi từng ô", () => {
    expect(validateAddress(addr({ name: "B" }))).toMatch(/tên người nhận/i);
    expect(validateAddress(addr({ phone: "09" }))).toMatch(/điện thoại/i);
    expect(validateAddress(addr({ province: "K" }))).toMatch(/tỉnh/i);
    expect(validateAddress(addr({ detail: "C" }))).toMatch(/cảng/i);
    expect(validateAddress(addr({ isPort: false, detail: "ngắn" }))).toMatch(/địa chỉ/i);
  });
});

describe("addressErrorField — ô nào sai, khớp thứ tự câu của validateAddress (F-11)", () => {
  const addr = (p: Partial<Address> = {}): Address => ({
    name: "Nguyễn Văn Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng Hòn Rớ", isPort: true, ...p,
  });
  it("đúng ô, null khi hợp lệ", () => {
    expect(addressErrorField(addr())).toBeNull();
    expect(addressErrorField(addr({ name: "B" }))).toBe("name");
    expect(addressErrorField(addr({ phone: "09" }))).toBe("phone");
    expect(addressErrorField(addr({ province: "" }))).toBe("province");
    expect(addressErrorField(addr({ detail: "C" }))).toBe("detail");
    expect(addressErrorField(addr({ isPort: false, detail: "ngắn" }))).toBe("detail");
    // sai nhiều ô ⇒ ô ĐẦU TIÊN theo đúng thứ tự validateAddress (câu lỗi cũng là câu của ô đó)
    expect(addressErrorField(addr({ name: "", detail: "" }))).toBe("name");
  });
});

describe("validateCheckout", () => {
  it("OK", () => {
    expect(validateCheckout(checkout())).toBeNull();
    expect(validateCheckout(checkout({ paymentMethod: "chuyen_khoan", buyerNote: "Giao sáng" }))).toBeNull();
  });
  it("trần: 21 dòng/shop, 6 shop, shopId trùng, qty, clientRef, expectedTotal, cách trả, ghi chú", () => {
    const many = Array.from({ length: ORDER_MAX_LINES + 1 }, (_, i) => ({ productId: `p${i}`, qty: 1 }));
    expect(validateCheckout(checkout({ shops: [{ ...checkout().shops[0], items: many }] }))).toMatch(/tối đa 20 món/);
    const six = Array.from({ length: CHECKOUT_MAX_SHOPS + 1 }, (_, i) => ({ ...checkout().shops[0], shopId: `s${i}` }));
    expect(validateCheckout(checkout({ shops: six }))).toMatch(/5 shop/);
    expect(validateCheckout(checkout({ shops: [checkout().shops[0], checkout().shops[0]] }))).toMatch(/một đơn/i);
    expect(validateCheckout(checkout({ shops: [{ ...checkout().shops[0], items: [{ productId: "p1", qty: 0 }] }] }))).toMatch(/số lượng/i);
    expect(validateCheckout(checkout({ shops: [{ ...checkout().shops[0], clientRef: "ngan" }] }))).toMatch(/mã chống trùng/i);
    expect(validateCheckout(checkout({ shops: [{ ...checkout().shops[0], expectedTotalVnd: -1 }] }))).toMatch(/tổng tiền/i);
    expect(validateCheckout(checkout({ paymentMethod: "tien_ao" as never }))).toMatch(/cách trả/i);
    expect(validateCheckout(checkout({ address: addr({ phone: "1" }) }))).toMatch(/điện thoại/i);
    expect(validateCheckout(checkout({ buyerNote: "x".repeat(301) }))).toMatch(/ghi chú/i);
    // ghi chú RIÊNG theo shop (11 §5.6) — cùng trần 300 chữ, sai kiểu ⇒ chặn
    expect(validateCheckout(checkout({ shops: [{ ...checkout().shops[0], buyerNote: "Giao trước 6h" }] }))).toBeNull();
    expect(validateCheckout(checkout({ shops: [{ ...checkout().shops[0], buyerNote: "x".repeat(301) }] }))).toMatch(/ghi chú/i);
    expect(validateCheckout(checkout({ shops: [{ ...checkout().shops[0], buyerNote: 5 as never }] }))).toMatch(/ghi chú/i);
    expect(validateCheckout(checkout({ shops: [] }))).toMatch(/chưa có món/i);
    expect(CART_MAX_LINES).toBe(50);
  });
});

describe("validateReview / cancel / payment note / status note", () => {
  it("review", () => {
    expect(validateReview({ rating: 5 })).toBeNull();
    expect(validateReview({ rating: 0 })).toBe("Chọn số sao.");
    expect(validateReview({ rating: 4.5 })).toBe("Chọn số sao.");
    expect(validateReview({ rating: 3, comment: "x".repeat(501) })).toBe("Nhận xét tối đa 500 chữ.");
  });
  it("lý do huỷ: seller/admin bắt buộc 5..200; buyer tuỳ chọn ≤ 200", () => {
    expect(validateCancelReason("seller")).toMatch(/lý do/i);
    expect(validateCancelReason("admin", "ngắn")).toMatch(/lý do/i);
    expect(validateCancelReason("seller", "Hết hàng rồi")).toBeNull();
    expect(validateCancelReason("buyer")).toBeNull();
    expect(validateCancelReason("buyer", "x".repeat(201))).toMatch(/lý do/i);
  });
  it("payment note P3 5..200; status note admin 5..300", () => {
    expect(validatePaymentNote("Chưa thấy tiền về")).toBeNull();
    expect(validatePaymentNote("")).toMatch(/lý do/i);
    expect(validateStatusNote("Thiếu giấy phép kinh doanh")).toBeNull();
    expect(validateStatusNote("x".repeat(301))).toMatch(/lý do/i);
    expect(validateStatusNote()).toMatch(/lý do/i);
  });
});

describe("normalizeProductStatus", () => {
  it("món CÓ GIÁ: kho 0 ⇒ het_hang; het_hang có kho ⇒ dang_ban; an giữ nguyên", () => {
    expect(normalizeProductStatus("dang_ban", 0, 35_000)).toBe("het_hang");
    expect(normalizeProductStatus("het_hang", 3, 35_000)).toBe("dang_ban");
    expect(normalizeProductStatus("an", 0, 35_000)).toBe("an");
    expect(normalizeProductStatus("an", 5, 35_000)).toBe("an");
    expect(normalizeProductStatus("dang_ban", 5, 35_000)).toBe("dang_ban");
  });

  /*  Lỗi thật đã dính (ADR 0011): món liên hệ báo giá để stock 0 vì KHÔNG đếm
      kho, nhưng hàm này lật nó thành "het_hang" ⇒ thẻ trên chợ dán "Hết hàng"
      lên hàng vẫn còn. Khoá lại ở đây, chỗ 6 nơi gọi đều đi qua. */
  it("món LIÊN HỆ BÁO GIÁ: kho 0 KHÔNG thành het_hang — nó không đếm kho", () => {
    expect(normalizeProductStatus("dang_ban", 0, null)).toBe("dang_ban");
    expect(normalizeProductStatus("dang_ban", 99, null)).toBe("dang_ban");
    expect(normalizeProductStatus("an", 0, null)).toBe("an");
    // đang mang nhãn het_hang từ trước mà chuyển sang liên hệ báo giá ⇒ gỡ nhãn
    expect(normalizeProductStatus("het_hang", 0, null)).toBe("dang_ban");
  });
});
