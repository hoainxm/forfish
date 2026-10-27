// CỔNG DỮ LIỆU — khách vs bản đồ (2026-10-27, anh Long: "Cho bà con xem các tính năng miễn phí, chỉ có vào bản đồ là
// bắt đăng nhập mua gói"). Chạy `dataGate` THẬT ở chế độ đã cấu hình Supabase, máy KHÔNG có chuỗi đăng nhập:
// route khách cho qua (không tra danh tính), route bản đồ (cần tài khoản) 401; khách gọi dồn quá trần theo IP ⇒ 429.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/device-token-server", () => ({ tokenIdentity: vi.fn(async () => ({ ok: false, denial: "no_token" })) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));

const { dataGate } = await import("@/lib/supabase/middleware");
const { dataRouteRule, RATES } = await import("@/lib/data-route-rules");
const { tokenIdentity } = await import("@/lib/device-token-server");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test");
  vi.mocked(tokenIdentity).mockClear();
});

const req = (path: string, ip = "10.0.0.1") => new NextRequest(`https://app.test${path}`, { headers: { "x-forwarded-for": `${ip}, 10.9.9.9` } });
const qua = (r: Response) => r.headers.get("x-middleware-next") === "1";

describe("dataGate — khách chưa đăng nhập", () => {
  it("route khách (bão, giá, giá dầu, thời tiết cảng) cho qua, KHÔNG tra danh tính", async () => {
    for (const p of ["/api/storms", "/api/port-prices", "/api/port-prices/history", "/api/fuel-price", "/api/weather-snapshot?id=sea:vung-tau:d1", "/api/om/forecast?latitude=10&longitude=107&forecast_days=1"]) {
      const u = new URL(`https://app.test${p}`);
      const r = await dataGate(req(p, "10.0.0.2"), dataRouteRule(u.pathname, u.searchParams)!);
      expect(qua(r), p).toBe(true);
    }
    expect(tokenIdentity).not.toHaveBeenCalled();
  });
  it("route bản đồ (cần tài khoản — miễn phí lẫn cần gói) ⇒ 401", async () => {
    for (const p of ["/api/tiles/chart/5/25/14", "/api/tiles/seamark/12/3263/1890", "/api/weather-snapshot?id=grid:d3", "/api/tau-ais", "/api/fish-forecast", "/api/weather-snapshot?id=sea:vung-tau", "/api/om/marine?latitude=10&longitude=107&forecast_days=16"]) {
      const u = new URL(`https://app.test${p}`);
      const r = await dataGate(req(p, "10.0.0.3"), dataRouteRule(u.pathname, u.searchParams)!);
      expect(r.status, p).toBe(401);
    }
  });
  it("khách gọi dồn quá trần theo IP ⇒ 429; IP khác không bị vạ lây", async () => {
    const rule = dataRouteRule("/api/storms", new URLSearchParams())!;
    let cuoi: Response | null = null;
    for (let i = 0; i <= RATES.guest.limit; i++) cuoi = await dataGate(req("/api/storms", "10.0.0.4"), rule);
    expect(cuoi!.status).toBe(429);
    expect(qua(await dataGate(req("/api/storms", "10.0.0.5"), rule))).toBe(true);
  });
});
