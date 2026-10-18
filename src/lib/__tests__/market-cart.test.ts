import { afterEach, describe, it, expect, vi } from "vitest";
import {
  addMarketLine,
  clearMarketCart,
  loadMarketCart,
  loadMarketQuote,
  loadMarketUnselected,
  MARKET_CART_EVENT,
  MARKET_CART_KEY,
  marketCartCount,
  marketLineKey,
  pruneUnselected,
  removeMarketLine,
  removeShopLines,
  saveMarketCart,
  saveMarketQuote,
  saveMarketUnselected,
  selectedMarketLines,
  setMarketLineQty,
  setMarketSelection,
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

describe("ô chọn trong giỏ (F-05) — THUẦN", () => {
  const items: MarketCartLine[] = [
    { productId: "a", qty: 1 },
    { productId: "a", qty: 2, variantLabel: "X" },
    { productId: "b", qty: 3 },
  ];
  const kA = marketLineKey("a");
  const kAX = marketLineKey("a", "X");
  const kB = marketLineKey("b");

  it("mặc định chọn hết: off rỗng ⇒ selectedMarketLines trả đúng mảng gốc", () => {
    expect(selectedMarketLines(items, [])).toBe(items);
    expect(marketLineKey("a", undefined)).toBe("a|");
    expect(kAX).toBe("a|X");
  });
  it("bỏ chọn một dòng / cả shop / chọn lại — key theo (productId, variantLabel)", () => {
    let off = setMarketSelection([], [kAX], false);
    expect(off).toEqual([kAX]);
    expect(selectedMarketLines(items, off)).toEqual([items[0], items[2]]);
    off = setMarketSelection(off, [kA, kB], false);
    expect(new Set(off)).toEqual(new Set([kAX, kA, kB]));
    expect(selectedMarketLines(items, off)).toEqual([]);
    off = setMarketSelection(off, [kA, kAX, kB], true);
    expect(off).toEqual([]);
    // bỏ chọn hai lần không nhân đôi khoá
    expect(setMarketSelection([kA], [kA], false)).toEqual([kA]);
  });
  it("pruneUnselected tỉa khoá của dòng không còn trong giỏ", () => {
    expect(pruneUnselected(items, [kA, "zzz|", kB, kA])).toEqual([kA, kB]);
    expect(pruneUnselected([], [kA])).toEqual([]);
  });
});

describe("ô chọn trong giỏ (F-05) — lưu cùng khoá giỏ", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("saveMarketUnselected giữ items + quote; saveMarketCart tỉa off theo giỏ mới; ngăn khác ⇒ []", () => {
    fakeWindow();
    saveMarketCart("0901000001", [{ productId: "p1", qty: 1 }, { productId: "p2", qty: 1 }]);
    saveMarketQuote("0901000001", quote);
    expect(saveMarketUnselected("0901000001", ["p2|"])).toBe(true);
    expect(loadMarketUnselected("0901000001")).toEqual(["p2|"]);
    expect(loadMarketCart("0901000001")).toHaveLength(2);
    expect(loadMarketQuote("0901000001")?.at).toBe(quote.at);
    expect(loadMarketUnselected("0909999999")).toEqual([]);
    // dòng p2 bị bỏ khỏi giỏ ⇒ khoá bỏ-chọn của nó biến mất, quote vẫn còn
    saveMarketCart("0901000001", [{ productId: "p1", qty: 1 }]);
    expect(loadMarketUnselected("0901000001")).toEqual([]);
    expect(loadMarketQuote("0901000001")?.at).toBe(quote.at);
    // saveMarketQuote KHÔNG làm mất phần bỏ chọn
    saveMarketUnselected("0901000001", ["p1|"]);
    saveMarketQuote("0901000001", quote);
    expect(loadMarketUnselected("0901000001")).toEqual(["p1|"]);
  });
  it("máy hết chỗ ⇒ saveMarketUnselected trả false, không ném", () => {
    fakeWindow({ throwOnSet: true });
    expect(saveMarketUnselected("0901000001", ["p1|"])).toBe(false);
  });
});
