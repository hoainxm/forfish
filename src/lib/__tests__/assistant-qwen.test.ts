import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*  ENGINE QWEN (server/qwen.ts) — vòng lặp tool qua endpoint chuẩn OpenAI, KHÔNG
    gọi mạng thật (fetch mock). Soi: TOOLS chuyển đúng khuôn OpenAI; tin user bọc
    <du_lieu_may>; vòng tool_calls → chạy executeTool → nhét role:tool → vòng kế;
    finalize (hậu kiểm chống bịa + đài duyên hải) vẫn chạy trên chữ cuối. Đây là
    tầng "thay Claude bằng Qwen" — an toàn giữ nguyên vì finalize dùng chung.  */

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/fuel-price/route", () => ({ GET: async () => new Response("{}", { status: 503 }) }));
vi.mock("@/app/api/port-prices/route", () => ({ GET: async () => new Response("{}", { status: 503 }) }));
vi.mock("@/app/api/storms/route", () => ({
  GET: async () =>
    new Response(JSON.stringify({ checkedAt: "2026-09-12T07:00:00Z", storms: [{ name: "", kindLabel: "Áp thấp nhiệt đới", windKmh: 43, alert: "watch", lat: 15.6, lon: 110.3 }] }), { status: 200 }),
}));
vi.mock("@/lib/market/store", () => ({ getMarketStore: async () => { throw new Error("no store"); } }));
vi.mock("@/lib/market/route-utils", () => ({ settleOverdueOrders: async (_s: unknown, o: unknown[]) => o }));
vi.mock("@/lib/weather-snapshot", () => ({ loadWeatherSnapshot: async () => ({ payload: null, unreachable: true }) }));

const { askQwen, buildUserContent, OPENAI_TOOLS } = await import("@/lib/assistant/server/qwen");
const { AssistantServerError } = await import("@/lib/assistant/server/claude");
import type { AssistantRequest, DeviceSnapshot } from "@/lib/assistant/types";

const NOW = Date.parse("2026-09-12T07:05:00Z");
const CFG = { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen3.5:9b", apiKey: null };

function snapshot(): DeviceSnapshot {
  return {
    takenAt: NOW, route: "/ngu-truong", online: true, premium: false,
    home: { portId: "quy-nhon", portName: "Quy Nhơn", province: "Gia Lai" },
    weather: null, storm: { savedAt: NOW - 3600_000, storms: [] }, tide: null, boat: null, docs: [], maintenance: [],
    crew: null, cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null, inboxUnread: 0, placeNames: [],
  };
}
const BODY: AssistantRequest = { text: "biển có bão không", route: "/ngu-truong", snapshot: snapshot() };

const oaiRes = (obj: unknown) => ({ ok: true, status: 200, json: async () => obj });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("qwen — chuyển TOOLS sang khuôn OpenAI", () => {
  it("mỗi tool là {type:function, function:{name, parameters}}, giữ đủ 6, sort theo tên", () => {
    expect(OPENAI_TOOLS).toHaveLength(7);
    for (const t of OPENAI_TOOLS) {
      expect(t.type).toBe("function");
      expect(typeof t.function.name).toBe("string");
      expect(t.function.parameters).toHaveProperty("type", "object");
    }
    const names = OPENAI_TOOLS.map((t) => t.function.name);
    expect(names).toEqual([...names].sort());
    expect(names).toContain("tin_bao");
  });
});

describe("qwen — tin user", () => {
  it("bọc <du_lieu_may> + ngữ cảnh giờ VN + màn + câu nói, không history", () => {
    const s = buildUserContent(BODY, NOW);
    expect(s).toMatch(/^<du_lieu_may>\{[\s\S]*\}<\/du_lieu_may>/);
    expect(s).toContain("gio_vn: 2026-09-12T14:05+07:00");
    expect(s).toContain("man: /ngu-truong");
    expect(s).toContain('Bà con nói: "biển có bão không"');
    expect(s).not.toContain("history");
  });
});

describe("qwen — vòng lặp tool → finalize", () => {
  // đóng băng đồng hồ về NOW: loop tính ngân sách bằng Date.now()-started, nếu
  // không băng thì elapsed = giờ-thật − NOW (quá khứ) rất lớn ⇒ timeout giả.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("tool_calls → chạy executeTool(tin_bao) → nhét kết quả → vòng kế → chữ cuối qua finalize", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(oaiRes({
        choices: [{ message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "tin_bao", arguments: "{}" } }] }, finish_reason: "tool_calls" }],
      }))
      .mockResolvedValueOnce(oaiRes({
        choices: [{ message: { content: "Có bão gần Hoàng Sa, biển động mạnh." }, finish_reason: "stop" }],
      }));
    vi.stubGlobal("fetch", fetchMock);

    const reply = await askQwen(BODY, "0900000000", CFG, NOW);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // gọi đúng endpoint OpenAI
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:11434/v1/chat/completions");
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body1.model).toBe("qwen3.5:9b");
    expect(body1.tool_choice).toBe("auto");
    expect(body1.stream).toBe(false);
    expect(body1.tools.map((t: { function: { name: string } }) => t.function.name)).toContain("tin_bao");
    expect(body1.messages[0]).toEqual({ role: "system", content: expect.stringContaining("<du_lieu_may>") });
    expect(body1.messages[1].content).toContain('Bà con nói: "biển có bão không"');
    // vòng 2: có assistant(tool_calls) + tool(result)
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const roles = body2.messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "tool"]);
    const toolMsg = body2.messages[3];
    expect(toolMsg.tool_call_id).toBe("c1");
    expect(toolMsg.content).toContain("Áp thấp nhiệt đới");
    // finalize: câu bão → nối "đài duyên hải"; source online
    expect(reply.source).toBe("online");
    expect(reply.text).toMatch(/đài duyên hải/);
  });

  it("trả chữ ngay (không tool) → finalize, ≤4 câu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(oaiRes({
      choices: [{ message: { content: "Bác chạm Ra khơi để xem điểm đi biển." }, finish_reason: "stop" }],
    })));
    const reply = await askQwen(BODY, "0900000000", CFG, NOW);
    expect(reply.text).toContain("Ra khơi");
    expect(reply.source).toBe("online");
  });

  it("endpoint HTTP lỗi → AssistantServerError upstream", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await expect(askQwen(BODY, "0900000000", CFG, NOW)).rejects.toBeInstanceOf(AssistantServerError);
  });

  it("có apiKey → gửi Authorization Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(oaiRes({ choices: [{ message: { content: "ừ." }, finish_reason: "stop" }] }));
    vi.stubGlobal("fetch", fetchMock);
    await askQwen(BODY, "0900000000", { ...CFG, apiKey: "sk-test" }, NOW);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer sk-test");
  });
});
