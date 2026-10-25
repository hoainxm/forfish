import { afterEach, describe, it, expect, vi } from "vitest";
import { clearShopFlag, loadShopFlag, MARKET_SHOP_FLAG_KEY, savePendingFlag, saveShopFlag } from "@/lib/market/seller-flag";

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

  it("pending (BH-11): ghi sau Tổng quan, giữ qua lần ghi lại cờ không kèm pending, bỏ khi hết shop / đổi SĐT / bản hỏng", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    // chưa có cờ ⇒ không ghi (useMyShop ghi hasShop trước)
    savePendingFlag("0902000001", 3, 100);
    expect(loadShopFlag("0902000001")).toBeNull();
    saveShopFlag("0902000001", { hasShop: true, status: "hoat_dong", at: 1 });
    savePendingFlag("0902000001", 3, 100);
    expect(loadShopFlag("0902000001")).toEqual({ hasShop: true, status: "hoat_dong", at: 1, pending: 3, pendingAt: 100 });
    // sheet Tài khoản ghi lại cờ từ /api/ban-hang/shop (không biết pending) ⇒ GIỮ số Tổng quan vừa ghi
    saveShopFlag("0902000001", { hasShop: true, status: "hoat_dong", at: 2 });
    expect(loadShopFlag("0902000001")).toEqual({ hasShop: true, status: "hoat_dong", at: 2, pending: 3, pendingAt: 100 });
    // ghi 0 vẫn là số thật (hết việc) — không phải "chưa biết"
    savePendingFlag("0902000001", 0, 200);
    expect(loadShopFlag("0902000001")?.pending).toBe(0);
    // số lẻ / âm ⇒ làm tròn xuống, không âm
    savePendingFlag("0902000001", -2.5, 300);
    expect(loadShopFlag("0902000001")?.pending).toBe(0);
    savePendingFlag("0902000001", 2.9, 300);
    expect(loadShopFlag("0902000001")?.pending).toBe(2);
    // hết shop ⇒ bỏ pending
    saveShopFlag("0902000001", { hasShop: false, at: 3 });
    expect(loadShopFlag("0902000001")).toEqual({ hasShop: false, at: 3 });
    savePendingFlag("0902000001", 5, 400);
    expect(loadShopFlag("0902000001")?.pending).toBeUndefined();
    // SĐT khác ⇒ ngăn khác, không mang pending theo
    saveShopFlag("0902000001", { hasShop: true, at: 4 });
    savePendingFlag("0902000001", 7, 500);
    saveShopFlag("0901000001", { hasShop: true, at: 5 });
    expect(loadShopFlag("0901000001")).toEqual({ hasShop: true, at: 5 });
    // bản hỏng (pending là chữ) ⇒ coi như chưa có
    store.set(MARKET_SHOP_FLAG_KEY, JSON.stringify({ phone: "0901000001", hasShop: true, at: 6, pending: "3", pendingAt: 1 }));
    expect(loadShopFlag("0901000001")).toEqual({ hasShop: true, at: 6 });
  });
});
