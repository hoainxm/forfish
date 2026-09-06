import { afterEach, describe, it, expect, vi } from "vitest";
import {
  addMarketLine,
  clearMarketCart,
  loadMarketCart,
  loadMarketQuote,
  MARKET_CART_EVENT,
  MARKET_CART_KEY,
  marketCartCount,
  removeMarketLine,
  removeShopLines,
  saveMarketCart,
  saveMarketQuote,
  setMarketLineQty,
} from "@/lib/market/cart";
import { CART_MAX_LINES } from "@/lib/market/validate";
import type { CartQuote, MarketCartLine } from "@/lib/market/types";

function fakeWindow(opts: { throwOnSet?: boolean; silentDrop?: boolean } = {}) {
  const store = new Map<string, string>();
  const events: string[] = [];
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new DOMException("quota", "QuotaExceededError");
      if (opts.silentDrop) return;
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal("window", { localStorage: ls, dispatchEvent: (e: Event) => (events.push(e.type), true) });
  return { store, events };
}

const quote: CartQuote = { at: "2026-09-06T01:00:00Z", groups: [], dropped: [], summary: { subtotalVnd: 0, shippingVnd: 0, totalVnd: 0, shopCount: 0 } };

describe("thao tác mảng THUẦN", () => {
  it("cộng dồn đúng biến thể; clamp 1..999", () => {
    let items: MarketCartLine[] = [];
    items = addMarketLine(items, "p1", undefined, 2).items;
    items = addMarketLine(items, "p1", "Ø12", 1).items;
    items = addMarketLine(items, "p1", undefined, 3).items;
    expect(items).toEqual([{ productId: "p1", qty: 5 }, { productId: "p1", qty: 1, variantLabel: "Ø12" }]);
    expect(addMarketLine(items, "p1", undefined, 5000).items[0].qty).toBe(999);
    expect(setMarketLineQty(items, "p1", "Ø12", 1000)[1].qty).toBe(999);
    expect(setMarketLineQty(items, "p1", "Ø12", 0)).toEqual([{ productId: "p1", qty: 5 }]);
    expect(setMarketLineQty(items, "p1", undefined, 0.4)).toEqual([{ productId: "p1", qty: 1 }, items[1]]);
    expect(marketCartCount(items)).toBe(6);
  });
  it("trần 50 dòng ⇒ gio_day, giữ items cũ", () => {
    const full = Array.from({ length: CART_MAX_LINES }, (_, i) => ({ productId: `p${i}`, qty: 1 }));
    const r = addMarketLine(full, "moi", undefined, 1);
    expect(r.reason).toBe("gio_day");
    expect(r.items).toBe(full);
    // cộng dồn dòng đã có thì vẫn được dù đầy
    expect(addMarketLine(full, "p3", undefined, 2).reason).toBeUndefined();
  });
  it("removeMarketLine / removeShopLines đúng dòng", () => {
    const items = [{ productId: "a", qty: 1 }, { productId: "a", qty: 2, variantLabel: "X" }, { productId: "b", qty: 1 }];
    expect(removeMarketLine(items, "a")).toEqual([items[1], items[2]]);
    expect(removeShopLines(items, ["a"])).toEqual([items[2]]);
  });
});

describe("lưu / đọc ngăn SĐT", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("save rồi load cùng SĐT; ngăn khác ⇒ rỗng; bắn EVENT khi ok", () => {
    const w = fakeWindow();
    expect(saveMarketCart("0901000001", [{ productId: "p1", qty: 2 }])).toBe(true);
    expect(w.events).toEqual([MARKET_CART_EVENT]);
    expect(loadMarketCart("0901000001")).toEqual([{ productId: "p1", qty: 2 }]);
    expect(loadMarketCart("+84 901 000 001")).toEqual([{ productId: "p1", qty: 2 }]);
    expect(loadMarketCart("0909999999")).toEqual([]);
    expect(loadMarketCart(null)).toEqual([]);
    expect(JSON.parse(w.store.get(MARKET_CART_KEY)!).phone).toBe("0901000001");
  });
  it("máy hết chỗ (setItem ném) ⇒ false, KHÔNG bắn EVENT; Safari im lặng ⇒ false", () => {
    const w1 = fakeWindow({ throwOnSet: true });
    expect(saveMarketCart("0901000001", [{ productId: "p1", qty: 1 }])).toBe(false);
    expect(w1.events).toEqual([]);
    vi.unstubAllGlobals();
    fakeWindow({ silentDrop: true });
    expect(saveMarketCart("0901000001", [{ productId: "p1", qty: 1 }])).toBe(false);
  });
  it("saveMarketCart GIỮ quote đang có; saveMarketQuote giữ items; clear xoá cả hai", () => {
    fakeWindow();
    saveMarketCart("0901000001", [{ productId: "p1", qty: 1 }]);
    saveMarketQuote("0901000001", quote);
    expect(loadMarketQuote("0901000001")?.at).toBe(quote.at);
    expect(loadMarketCart("0901000001")).toEqual([{ productId: "p1", qty: 1 }]);
    saveMarketCart("0901000001", [{ productId: "p2", qty: 3 }]);
    expect(loadMarketQuote("0901000001")?.at).toBe(quote.at);
    expect(loadMarketQuote("0909999999")).toBeNull();
    clearMarketCart("0901000001");
    expect(loadMarketCart("0901000001")).toEqual([]);
    expect(loadMarketQuote("0901000001")).toBeNull();
  });
  it("JSON hỏng / dòng rác ⇒ bỏ qua, không ném", () => {
    const w = fakeWindow();
    w.store.set(MARKET_CART_KEY, "{hỏng");
    expect(loadMarketCart("0901000001")).toEqual([]);
    w.store.set(MARKET_CART_KEY, JSON.stringify({ phone: "0901000001", items: [{ productId: "ok", qty: 1 }, { qty: 2 }, null] }));
    expect(loadMarketCart("0901000001")).toEqual([{ productId: "ok", qty: 1 }]);
  });
});
