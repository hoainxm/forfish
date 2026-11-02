/* eslint-disable @typescript-eslint/no-explicit-any -- mock Supabase admin client bắt-lời-gọi */
import { describe, it, expect, vi, beforeEach } from "vitest";

/*  GET /api/cho/don-sdvico(+/[id]) — ĐƠN SDVICO của TÔI (ADR 0018). Khoá: SĐT LUÔN từ phiên
    (identityFromRequest), không bao giờ từ query; đơn người khác ⇒ 404; DB hỏng ⇒ 503. */

vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => {
  const state = {
    phone: "0901234567",
    rows: [] as any[],
    error: null as null | { message: string },
    eqs: [] as [string, string][],
  };
  const query = () => {
    const q: any = {
      select: () => q,
      eq: (col: string, val: string) => {
        state.eqs.push([col, val]);
        return q;
      },
      order: () => q,
      limit: () => Promise.resolve({ data: state.error ? null : state.rows, error: state.error }),
      maybeSingle: () => {
        const want = Object.fromEntries(state.eqs);
        const hit = state.rows.find((r) => r.id === want.id && r.customer_phone === want.customer_phone);
        return Promise.resolve({ data: state.error ? null : hit ?? null, error: state.error });
      },
    };
    return q;
  };
  return { state, admin: { from: () => query() } };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/api-identity", () => ({
  identityFromRequest: async () => ({ ok: true, phone: h.state.phone }),
}));

import { GET as LIST } from "@/app/api/cho/don-sdvico/route";
import { GET as ONE } from "@/app/api/cho/don-sdvico/[id]/route";

const ID = "11111111-1111-4111-8111-111111111111";
const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  code: "DH75768",
  customer_phone: "0901234567",
  status: "dang_giao",
  ordered_at: "2026-11-02T00:00:00Z",
  items: [{ name: "Máy", qty: 1, unit: "cái", unitPriceVnd: 100, lineTotalVnd: 100 }],
  services: [],
  subtotal_vnd: 100, discount_vnd: 0, vat_vnd: 0, service_vnd: 0, total_vnd: 100,
  carrier_name: null, tracking_number: null, updated_at: "2026-11-02T00:00:00Z",
  ...over,
});

beforeEach(() => {
  h.state.phone = "0901234567";
  h.state.rows = [];
  h.state.error = null;
  h.state.eqs = [];
});

describe("GET /api/cho/don-sdvico", () => {
  it("lọc theo SĐT PHIÊN — ?phone= trên URL bị bỏ qua", async () => {
    h.state.rows = [row()];
    const res = await LIST(new Request("http://x/api/cho/don-sdvico?phone=0999999999"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(h.state.eqs).toEqual([["customer_phone", "0901234567"]]);
    expect(json.items[0]).toMatchObject({ id: ID, code: "DH75768", status: "dang_giao", totalVnd: 100 });
    expect(json.items[0]).not.toHaveProperty("customer_phone");
  });

  it("hàng trạng thái lạ bị loại", async () => {
    h.state.rows = [row(), row({ id: "x", status: "hoan_thanh" })];
    const json = await (await LIST(new Request("http://x/api/cho/don-sdvico"))).json();
    expect(json.items).toHaveLength(1);
  });

  it("DB hỏng → 503 unavailable", async () => {
    h.state.error = { message: "boom" };
    const res = await LIST(new Request("http://x/api/cho/don-sdvico"));
    expect(res.status).toBe(503);
  });
});

describe("GET /api/cho/don-sdvico/[id]", () => {
  it("đơn của tôi → 200", async () => {
    h.state.rows = [row()];
    const res = await ONE(new Request("http://x"), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(200);
    expect((await res.json()).order.code).toBe("DH75768");
  });

  it("đơn của SĐT khác → 404 (không lộ tồn tại)", async () => {
    h.state.rows = [row({ customer_phone: "0912345678" })];
    const res = await ONE(new Request("http://x"), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(404);
  });

  it("id không phải uuid → 404, không truy vấn", async () => {
    const res = await ONE(new Request("http://x"), { params: Promise.resolve({ id: "../../x" }) });
    expect(res.status).toBe(404);
    expect(h.state.eqs).toHaveLength(0);
  });
});
