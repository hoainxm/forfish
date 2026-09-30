import { describe, expect, it, vi } from "vitest";

/*  SCHEMA TOOL CHO MODEL (14 §6.4): mọi tool `strict`, `additionalProperties:false`,
    `required` = toàn bộ `properties`, tên `^[a-z_]+$`, mảng đã sort theo tên
    (cache ổn định — tools render ở vị trí 0 của prompt).

    `server/tools.ts` mở đầu `import "server-only"` và kéo handler route thật
    (storms/port-prices/fuel-price) + kho chợ. Mock các module đó để chỉ soi
    SCHEMA, không đụng mạng/đĩa.  */

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/fuel-price/route", () => ({ GET: async () => new Response("{}", { status: 503 }) }));
vi.mock("@/app/api/port-prices/route", () => ({ GET: async () => new Response("{}", { status: 503 }) }));
vi.mock("@/app/api/storms/route", () => ({ GET: async () => new Response("{}", { status: 503 }) }));
vi.mock("@/lib/market/store", () => ({ getMarketStore: async () => { throw new Error("không có kho trong test"); } }));
vi.mock("@/lib/market/route-utils", () => ({ settleOverdueOrders: async (_s: unknown, o: unknown[]) => o }));
vi.mock("@/lib/weather-snapshot", () => ({ loadWeatherSnapshot: async () => ({ payload: null, unreachable: true }) }));

const { TOOLS, TOOL_NAMES, executeTool } = await import("@/lib/assistant/server/tools");

describe("assistant-tools-schema", () => {
  it("đúng 7 tool, tên hợp lệ, đã sort", () => {
    expect(TOOL_NAMES).toEqual(["don_cua_toi", "gia_ca", "gia_dau", "thoi_tiet_cang", "tim_san_pham", "tin_bao", "tra_kho"]);
    expect([...TOOL_NAMES].sort()).toEqual(TOOL_NAMES);
    for (const n of TOOL_NAMES) expect(n).toMatch(/^[a-z_]+$/);
  });

  it("mọi tool strict + additionalProperties:false + required đủ mọi trường", () => {
    for (const t of TOOLS) {
      expect(t.strict, t.name).toBe(true);
      const schema = t.input_schema as { type: string; properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
      expect(schema.type).toBe("object");
      expect(schema.additionalProperties, t.name).toBe(false);
      expect([...schema.required].sort(), t.name).toEqual(Object.keys(schema.properties).sort());
      expect((t.description ?? "").length, t.name).toBeGreaterThan(20);
    }
  });

  it("thoi_tiet_cang.ngay là enum 0|1|2 (≤3 ngày cho mọi hạng — brief §4 #6)", () => {
    const t = TOOLS.find((x) => x.name === "thoi_tiet_cang")!;
    const ngay = (t.input_schema as { properties: Record<string, { enum?: number[] }> }).properties.ngay;
    expect(ngay.enum).toEqual([0, 1, 2]);
  });

  it("executor không ném: tool lạ / nguồn 503 / kho hỏng → is_error có câu đời thường", async () => {
    expect(await executeTool("khong_co", {}, "0901", 2000)).toMatchObject({ is_error: true });
    expect(await executeTool("gia_dau", {}, "0901", 2000)).toMatchObject({ is_error: true, content: "Chưa lấy được giá dầu kỳ này." });
    expect(await executeTool("tin_bao", {}, "0901", 2000)).toMatchObject({ is_error: true, content: "Cả hai nguồn bão chưa trả lời." });
    expect(await executeTool("thoi_tiet_cang", { port_id: "quy-nhon", ngay: 0 }, "0901", 2000)).toMatchObject({ is_error: true, content: "Máy chủ chưa hỏi được thời tiết." });
    expect(await executeTool("don_cua_toi", { dang_giao: true }, "0901", 2000)).toMatchObject({ is_error: true, content: "Không đọc được đơn." });
    const r = await executeTool("tim_san_pham", { q: "nhớt", so_luong_toi_da: 3 }, "0901", 2000);
    expect(r.is_error).toBe(true);
    expect(r.content).not.toMatch(/Error|stack/);
  });

  it("tra_kho: chỉ đọc kho ĐÃ PHÁT HÀNH; không có mục khớp → báo thật, không bịa", async () => {
    const r = await executeTool("tra_kho", { cau_hoi: "ai là tổng thống mỹ" }, "0901", 2000);
    expect(r).toMatchObject({ is_error: true, content: "Kho chưa có tài liệu cho chuyện này." });
  });
});
