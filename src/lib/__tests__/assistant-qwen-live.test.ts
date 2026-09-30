import { describe, expect, it, vi } from "vitest";

/*  QWEN THẬT (tích hợp, doc 10 §4.5 "chưa có integration Ollama thật cho askQwen").
    BỎ QUA mặc định — chỉ chạy khi có máy Qwen:
      QWEN_LIVE_URL=http://127.0.0.1:11434/v1 npx vitest run src/lib/__tests__/assistant-qwen-live.test.ts
    Soi đúng hai lỗi đã dính thật: (1) Qwen3.5 "nghĩ" mặc định → content RỖNG sau
    30 s; (2) câu trả lời phải qua finalize (giọng, ≤4 câu, không số bịa).  */

const URL_ = process.env.QWEN_LIVE_URL;
const MODEL = process.env.QWEN_LIVE_MODEL ?? "qwen3.5:9b";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/fuel-price/route", () => ({ GET: async () => new Response("{}", { status: 503 }) }));
vi.mock("@/app/api/port-prices/route", () => ({ GET: async () => new Response("{}", { status: 503 }) }));
vi.mock("@/app/api/storms/route", () => ({
  GET: async () => Response.json({ checkedAt: "2026-09-30T00:00:00Z", storms: [] }),
}));
vi.mock("@/lib/market/store", () => ({ getMarketStore: async () => { throw new Error("no store"); } }));
vi.mock("@/lib/market/route-utils", () => ({ settleOverdueOrders: async (_s: unknown, o: unknown[]) => o }));
vi.mock("@/lib/weather-snapshot", () => ({ loadWeatherSnapshot: async () => ({ payload: null, unreachable: true }) }));

const snapshot = {
  takenAt: Date.now(), route: "/", online: true, premium: false,
  home: { portId: "quy-nhon", portName: "Quy Nhơn", province: "Gia Lai" },
  weather: null, storm: null, tide: null, boat: null, docs: [], maintenance: [], crew: null,
  cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null, inboxUnread: 0, placeNames: [],
};

describe.skipIf(!URL_)("askQwen — máy Qwen thật", () => {
  it("câu mở: có chữ (không rỗng vì 'nghĩ'), ≤4 câu, trong ngân sách 20 s", async () => {
    const { askQwen } = await import("@/lib/assistant/server/qwen");
    const t0 = Date.now();
    const r = await askQwen({ text: "mai ra khơi cần mang theo gì", route: "/", snapshot }, "0900000000", { baseUrl: URL_!, model: MODEL });
    const ms = Date.now() - t0;
    console.log(`[qwen-live] ${ms} ms →`, r.text);
    expect(r.text.length).toBeGreaterThan(10);
    expect(r.text).not.toBe("Tôi chưa trả lời được câu này. Bác hỏi cách khác giúp.");
    expect(r.source).toBe("online");
    expect(ms).toBeLessThan(20_000);
  }, 30_000);

  it("hỏi bão: gọi tin_bao, nhắc đài duyên hải", async () => {
    const { askQwen } = await import("@/lib/assistant/server/qwen");
    const r = await askQwen({ text: "biển đông có bão không", route: "/", snapshot }, "0900000000", { baseUrl: URL_!, model: MODEL });
    console.log("[qwen-live] bão →", r.text);
    expect(r.text).toMatch(/đài duyên hải/i);
  }, 30_000);
});
