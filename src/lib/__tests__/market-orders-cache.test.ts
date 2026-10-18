import { afterEach, describe, it, expect, vi } from "vitest";
import {
  clearCachedMarketOrders,
  loadCachedMarketOrders,
  MARKET_ORDERS_CACHE_KEY,
  ORDERS_CACHE_MAX,
  saveCachedMarketOrders,
} from "@/lib/market/orders-cache";
import type { Order } from "@/lib/market/types";

const order = (id: string, createdAt: string): Order => ({
  id, code: `SD260906${id.padStart(4, "A")}`.slice(0, 12), buyerPhone: "0901000001", shopId: "s1", items: [],
  subtotalVnd: 0, shippingVnd: 0, totalVnd: 0, paymentMethod: "cod", paymentStatus: "chua_thanh_toan",
  needsRefund: false, status: "cho_xac_nhan",
  address: { name: "Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng", isPort: true },
  timeline: [], createdAt, updatedAt: createdAt,
});

function fakeWindow(throwOnSet = false) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (throwOnSet) throw new Error("full");
        store.set(k, v);
      },
      removeItem: (k: string) => void store.delete(k),
    },
  });
  return store;
}

describe("orders-cache", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("save/load; ngăn khác ⇒ null; JSON hỏng ⇒ null; clear", () => {
    const store = fakeWindow();
    saveCachedMarketOrders("0901000001", [order("1", "2026-09-01T00:00:00Z")]);
    const got = loadCachedMarketOrders("0901000001");
    expect(got?.orders.map((o) => o.id)).toEqual(["1"]);
    expect(typeof got?.savedAt).toBe("number");
    expect(loadCachedMarketOrders("0902000002")).toBeNull();
    store.set(MARKET_ORDERS_CACHE_KEY, "{");
    expect(loadCachedMarketOrders("0901000001")).toBeNull();
    saveCachedMarketOrders("0901000001", [order("2", "2026-09-01T00:00:00Z")]);
    clearCachedMarketOrders();
    expect(loadCachedMarketOrders("0901000001")).toBeNull();
  });
  it("cắt 50 đơn MỚI NHẤT; máy đầy ⇒ nuốt lỗi, không ném", () => {
    fakeWindow();
    const many = Array.from({ length: 60 }, (_, i) => order(`${i}`, `2026-08-${String((i % 28) + 1).padStart(2, "0")}T00:00:${String(i % 60).padStart(2, "0")}Z`));
    saveCachedMarketOrders("0901000001", many);
    const got = loadCachedMarketOrders("0901000001")!;
    expect(got.orders).toHaveLength(ORDERS_CACHE_MAX);
    const sorted = [...got.orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    expect(got.orders).toEqual(sorted);
    const newest = [...many].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    expect(got.orders[0].id).toBe(newest.id);
    vi.unstubAllGlobals();
    fakeWindow(true);
    expect(() => saveCachedMarketOrders("0901000001", many)).not.toThrow();
  });
});
