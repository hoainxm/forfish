import { describe, it, expect, vi, beforeEach } from "vitest";

/*  Rà 28/10 mục A10 — POST /api/cho/don trả mã đơn KHÔNG chờ thông báo cho chủ shop. Thông báo đi qua `after()`
    (chạy sau khi trả lời); đơn trùng clientRef (`duplicate`) không báo lại. */

vi.mock("server-only", () => ({}));
const { hangSau, notifyMarket, ds } = vi.hoisted(() => ({
  hangSau: [] as (() => Promise<void>)[],
  notifyMarket: vi.fn(async (phone: string, msg: unknown) => void [phone, msg]),
  ds: { placed: [] as unknown[] },
}));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => void hangSau.push(fn),
}));
vi.mock("@/lib/api-identity", () => ({ identityFromRequest: async () => ({ ok: true, phone: "0901234567" }) }));
vi.mock("@/lib/market/notify", () => ({ notifyMarket, marketNotice: () => ({ title: "t", body: "b" }) }));
vi.mock("@/lib/market/validate", () => ({ validateCheckout: () => null }));
vi.mock("@/lib/market/pricing", () => ({
  buildMarketLines: () => ({ lines: [{ productId: "p" }], dropped: [] }),
  computeTotals: () => ({ totalVnd: 100 }),
  shopsForcingCod: () => [],
}));
vi.mock("@/lib/market/store", () => ({
  getMarketStore: async () => ({
    getProductsByIds: async () => [],
    getShop: async (id: string) => ({ id, name: "Shop", status: "hoat_dong", paused: false, ownerPhone: "0912345678" }),
    placeOrders: async () => ds.placed,
  }),
}));

import { POST } from "@/app/api/cho/don/route";

const dat = () =>
  POST(
    new Request("http://x/api/cho/don", {
      method: "POST",
      body: JSON.stringify({
        shops: [
          { shopId: "s1", clientRef: "c1", items: [{ productId: "p", qty: 1 }], expectedTotalVnd: 100 },
          { shopId: "s2", clientRef: "c2", items: [{ productId: "p", qty: 1 }], expectedTotalVnd: 100 },
        ],
        paymentMethod: "cod",
        address: {},
      }),
    }),
  );

beforeEach(() => {
  hangSau.length = 0;
  notifyMarket.mockClear();
});

describe("đặt hàng — thông báo chủ shop chạy sau khi trả lời", () => {
  it("trả mã đơn trước, thông báo nằm trong after(); đơn trùng không báo", async () => {
    ds.placed = [
      { shopId: "s1", ok: true, order: { id: "o1" } },
      { shopId: "s2", ok: true, duplicate: true, order: { id: "o2" } },
    ];
    const r = await dat();
    expect(r.status).toBe(200);
    expect(((await r.json()) as { results: { shopId: string }[] }).results.map((x) => x.shopId)).toEqual(["s1", "s2"]);
    expect(notifyMarket).not.toHaveBeenCalled(); // câu trả lời không đợi thông báo
    expect(hangSau).toHaveLength(1);
    await hangSau[0]();
    expect(notifyMarket).toHaveBeenCalledTimes(1);
    expect(notifyMarket).toHaveBeenCalledWith("0912345678", expect.anything());
  });
  it("không có đơn mới nào ⇒ không đăng việc sau", async () => {
    ds.placed = [
      { shopId: "s1", ok: false, code: "insert_failed", productIds: [] },
      { shopId: "s2", ok: true, duplicate: true, order: { id: "o2" } },
    ];
    await dat();
    expect(hangSau).toHaveLength(0);
  });
});
