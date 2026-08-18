import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addToCart,
  cartBucket,
  cartCount,
  cartTotalVnd,
  clearCart,
  loadCart,
  removeItem,
  saveCart,
  setQty,
  type CartLine,
} from "@/lib/cart";
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

describe("thao tác mảng thuần", () => {
  it("addToCart thêm mới + cộng dồn, không đụng mảng cũ", () => {
    const a: CartLine[] = [];
    const b = addToCart(a, "p1", 2);
    expect(a).toEqual([]);
    expect(b).toEqual([{ listingId: "p1", qty: 2 }]);
    const c = addToCart(b, "p1", 3);
    expect(c).toEqual([{ listingId: "p1", qty: 5 }]);
  });
  it("addToCart kẹp trần 999", () => {
    const c = addToCart([{ listingId: "p1", qty: 998 }], "p1", 10);
    expect(c[0].qty).toBe(999);
  });
  it("setQty đặt tuyệt đối; <=0 thì bỏ món", () => {
    expect(setQty([{ listingId: "p1", qty: 2 }], "p1", 5)).toEqual([
      { listingId: "p1", qty: 5 },
    ]);
    expect(setQty([{ listingId: "p1", qty: 2 }], "p1", 0)).toEqual([]);
  });
  it("removeItem bỏ đúng món", () => {
    expect(
      removeItem(
        [
          { listingId: "p1", qty: 1 },
          { listingId: "p2", qty: 2 },
        ],
        "p1",
      ),
    ).toEqual([{ listingId: "p2", qty: 2 }]);
  });
  it("cartCount cộng số lượng", () => {
    expect(
      cartCount([
        { listingId: "p1", qty: 2 },
        { listingId: "p2", qty: 3 },
      ]),
    ).toBe(5);
  });
  it("cartTotalVnd bỏ qua món không đặt được", () => {
    const catalog = [
      listing({ id: "p1", priceVnd: 30000 }),
      listing({ id: "p2", orderable: false }),
    ];
    const total = cartTotalVnd(
      [
        { listingId: "p1", qty: 2 },
        { listingId: "p2", qty: 5 },
      ],
      catalog,
    );
    expect(total).toBe(60000);
  });
});

describe("cartBucket — cách ly tài khoản", () => {
  it("null/rỗng → ngăn khách; SĐT → chuẩn hoá", () => {
    expect(cartBucket(null)).toBe("__khach__");
    expect(cartBucket("")).toBe("__khach__");
    expect(cartBucket("0901234567")).toBe(cartBucket("0901234567"));
    // hai dạng cùng một số → cùng ngăn
    expect(cartBucket("84901234567")).toBe(cartBucket("0901234567"));
  });
});

describe("loadCart/saveCart — keyed theo SĐT (stub window)", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage() {
    const store = new Map<string, string>();
    const ls = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    vi.stubGlobal("window", { localStorage: ls, dispatchEvent: () => true });
    return store;
  }

  it("ghi rồi đọc lại đúng giỏ của SĐT", () => {
    stubStorage();
    saveCart("0901234567", [{ listingId: "p1", qty: 2 }]);
    expect(loadCart("0901234567")).toEqual([{ listingId: "p1", qty: 2 }]);
  });

  it("ngăn của SĐT KHÁC → giỏ rỗng (không lộn máy dùng chung)", () => {
    stubStorage();
    saveCart("0901234567", [{ listingId: "p1", qty: 2 }]);
    expect(loadCart("0912999888")).toEqual([]);
  });

  it("clearCart làm rỗng giỏ", () => {
    stubStorage();
    saveCart("0901234567", [{ listingId: "p1", qty: 2 }]);
    clearCart("0901234567");
    expect(loadCart("0901234567")).toEqual([]);
  });

  /*  Audit 2026-08-18 G5: `saveCart` phải TRẢ TRẠNG THÁI — máy hết chỗ mà nuốt
      im là bấm "Đặt hàng" xong mới thấy giỏ trống. */
  it("ghi được → true và bắn CART_EVENT", () => {
    const store = new Map<string, string>();
    const fired: string[] = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
      dispatchEvent: (e: Event) => {
        fired.push(e.type);
        return true;
      },
    });
    expect(saveCart("0901234567", [{ listingId: "p1", qty: 1 }])).toBe(true);
    expect(fired).toEqual(["forfish-cart-changed"]);
  });

  it("máy hết chỗ (setItem ném) → false, KHÔNG bắn CART_EVENT (đừng đè bản trong tay)", () => {
    const fired: string[] = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("quota", "QuotaExceededError");
        },
        removeItem: () => undefined,
      },
      dispatchEvent: (e: Event) => {
        fired.push(e.type);
        return true;
      },
    });
    expect(saveCart("0901234567", [{ listingId: "p1", qty: 1 }])).toBe(false);
    expect(fired).toEqual([]);
  });

  it("Safari riêng tư đời cũ: setItem im lặng mà không giữ → false", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null, // nhận rồi vứt
        setItem: () => undefined,
        removeItem: () => undefined,
      },
      dispatchEvent: () => true,
    });
    expect(saveCart("0901234567", [{ listingId: "p1", qty: 1 }])).toBe(false);
  });
});
