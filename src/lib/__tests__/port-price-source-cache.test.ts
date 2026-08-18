import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/*  Audit thông báo 2026-08-18 G3 — bảng giá phải phân biệt được:
      · hỏi máy chủ OK               → giá tuần, không cờ
      · KHÔNG hỏi được (mất sóng/5xx) + có bản lưu → bản lưu + savedAt + netFailed
      · KHÔNG hỏi được, chưa có bản lưu → bảng tĩnh + netFailed (màn nói "máy
        đang không có sóng")
      · máy chủ trả ok:false (VASEP đổi trang, đang CÓ sóng) → tĩnh, KHÔNG
        netFailed (màn không được đổ cho sóng)  */

const cache = vi.hoisted(() => ({
  hit: null as null | { data: unknown; savedAt: number },
  saved: [] as unknown[],
}));
vi.mock("@/lib/forecast-cache", () => ({
  loadForecast: () => cache.hit,
  saveForecast: (_ns: string, _id: string, data: unknown) => {
    cache.saved.push(data);
    return true;
  },
}));
vi.mock("@/lib/forecast-store", () => ({
  forecastStoreReady: async () => undefined,
}));

import { fetchLivePrices } from "@/lib/port-price-source";

const LIVE = {
  ok: true,
  source: "vasep",
  province: "Khánh Hòa",
  week: "1–7/8/2026",
  prices: [],
};

beforeEach(() => {
  cache.hit = null;
  cache.saved = [];
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchLivePrices — bản lưu và cờ mất sóng", () => {
  it("máy chủ OK → trả giá tuần, cất vào máy, không cờ", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(LIVE)));
    const r = await fetchLivePrices();
    expect(r.source).toBe("vasep");
    expect(r.netFailed).toBeUndefined();
    expect(cache.saved).toHaveLength(1);
  });

  it("mất sóng + có bản lưu → bản lưu kèm savedAt và netFailed", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    cache.hit = { data: LIVE, savedAt: 1_700_000_000_000 };
    const r = await fetchLivePrices();
    expect(r.source).toBe("vasep");
    expect(r.savedAt).toBe(1_700_000_000_000);
    expect(r.netFailed).toBe(true);
  });

  it("mất sóng + CHƯA có bản lưu → bảng tĩnh + netFailed (màn nói mất sóng)", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const r = await fetchLivePrices();
    expect(r.source).toBe("static");
    expect(r.netFailed).toBe(true);
  });

  it("5xx → coi như không hỏi được (netFailed)", async () => {
    vi.stubGlobal("fetch", async () => new Response("x", { status: 503 }));
    const r = await fetchLivePrices();
    expect(r.netFailed).toBe(true);
  });

  it("máy chủ trả ok:false lúc CÓ sóng → tĩnh, KHÔNG được đổ cho sóng", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ ok: false, source: "static", prices: [] })),
    );
    const r = await fetchLivePrices();
    expect(r.source).toBe("static");
    expect(r.netFailed).toBe(false);
  });
});
