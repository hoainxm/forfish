import { afterEach, describe, it, expect, vi } from "vitest";
import { clearShopFlag, loadShopFlag, MARKET_SHOP_FLAG_KEY, saveShopFlag } from "@/lib/market/seller-flag";

describe("seller-flag — cờ máy này có shop", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("save/load; ngăn khác ⇒ null; JSON hỏng ⇒ null; clear; máy đầy nuốt lỗi", () => {
    const store = new Map<string, string>();
    let boom = false;
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (boom) throw new Error("full");
          store.set(k, v);
        },
        removeItem: (k: string) => void store.delete(k),
      },
    });
    saveShopFlag("0902000001", { hasShop: true, status: "hoat_dong", at: 123 });
    expect(loadShopFlag("0902000001")).toEqual({ hasShop: true, status: "hoat_dong", at: 123 });
    expect(loadShopFlag("0901000001")).toBeNull();
    saveShopFlag("0901000001", { hasShop: false, at: 5 });
    expect(loadShopFlag("0901000001")).toEqual({ hasShop: false, at: 5 });
    store.set(MARKET_SHOP_FLAG_KEY, "{hỏng");
    expect(loadShopFlag("0901000001")).toBeNull();
    store.set(MARKET_SHOP_FLAG_KEY, JSON.stringify({ phone: "0901000001", hasShop: "yes", at: 1 }));
    expect(loadShopFlag("0901000001")).toBeNull();
    boom = true;
    expect(() => saveShopFlag("0901000001", { hasShop: true, at: 1 })).not.toThrow();
    boom = false;
    saveShopFlag("0901000001", { hasShop: true, at: 1 });
    clearShopFlag();
    expect(loadShopFlag("0901000001")).toBeNull();
  });
});
