import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/*  Rà 28/10 nhóm auth.
    A4 — Đăng xuất thu hồi ĐÚNG chuỗi đang cầm, không phải mọi chuỗi của SĐT (nhân sự nhiều máy).
    A5 — cổng dữ liệu đệm danh tính 60 giây: chuỗi bị thu hồi bị chặn sau tối đa 1 phút.
    A6 — thiếu cột expires_at ⇒ KHÔNG cấp chuỗi không hạn; báo 503. */

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  tokenIdentity: vi.fn(),
  revokeTokenHash: vi.fn(async () => ({ ok: true, revoked: 1 })),
  revokeTokensOfPhone: vi.fn(async () => ({ ok: true, revoked: 0 })),
  insert: vi.fn(async (row: unknown) => void row),
}));
vi.mock("@/lib/device-token-server", () => ({
  tokenIdentity: m.tokenIdentity,
  revokeTokenHash: m.revokeTokenHash,
  revokeTokensOfPhone: m.revokeTokensOfPhone,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: "0901234567@x.vn" } } }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: m.insert }) }),
}));
vi.mock("@/lib/staff-store", () => ({
  loadActor: async () => ({ ok: true, actor: { role: "admin", kind: "real", owner: false, customer: null } }),
  effectiveTier: async () => "basic",
}));
vi.mock("@/lib/admin", async (orig) => ({
  ...(await orig<typeof import("@/lib/admin")>()),
  authIdentity: () => "0901234567",
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));

const { POST, DELETE } = await import("@/app/api/auth/token/route");
const { dataGate, IDENTITY_TTL } = await import("@/lib/supabase/middleware");
const { dataRouteRule } = await import("@/lib/data-route-rules");
const { newDeviceToken } = await import("@/lib/device-token");

beforeEach(() => {
  for (const f of [m.tokenIdentity, m.revokeTokenHash, m.revokeTokensOfPhone, m.insert]) f.mockClear();
});

describe("A4 — đăng xuất một máy", () => {
  it("thu hồi đúng tokenHash đang cầm, không đụng chuỗi khác của SĐT", async () => {
    m.tokenIdentity.mockResolvedValueOnce({ ok: true, phone: "0901234567", tokenHash: "h-may-A" });
    const r = await DELETE(new Request("http://x/api/auth/token", { method: "DELETE" }));
    expect(r.status).toBe(200);
    expect(m.revokeTokenHash).toHaveBeenCalledWith("h-may-A", "user_signout");
    expect(m.revokeTokensOfPhone).not.toHaveBeenCalled();
  });
  it("thu hồi hỏng ⇒ 503 (máy giữ chuỗi, mời bấm lại) — không phải 200 ok:false", async () => {
    m.tokenIdentity.mockResolvedValueOnce({ ok: true, phone: "0901234567", tokenHash: "h" });
    m.revokeTokenHash.mockResolvedValueOnce({ ok: false, revoked: 0 });
    const r = await DELETE(new Request("http://x/api/auth/token", { method: "DELETE" }));
    expect(r.status).toBe(503);
  });
});

describe("A6 — không cấp chuỗi nhân sự không hạn", () => {
  it("insert kèm expires_at; thiếu cột ⇒ 503, không thử lại bản không hạn", async () => {
    m.insert.mockResolvedValueOnce({ error: { code: "PGRST204", message: "column expires_at does not exist" } } as never);
    const r = await POST(new Request("http://x/api/auth/token", { method: "POST", body: "{}" }));
    expect(r.status).toBe(503);
    expect(m.insert).toHaveBeenCalledTimes(1);
    expect(m.insert.mock.calls[0][0]).toHaveProperty("expires_at");
    expect(m.revokeTokensOfPhone).not.toHaveBeenCalled(); // nhân sự nhiều máy: không đá máy cũ
  });
});

describe("A5 — hạn thu hồi ở cổng dữ liệu", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test");
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("chuỗi bị thu hồi còn qua tối đa 60 giây, sau đó 401", async () => {
    expect(IDENTITY_TTL).toBeLessThanOrEqual(60_000);
    const rule = dataRouteRule("/api/tiles/seamark/12/3263/1890", new URLSearchParams())!;
    const chuoi = newDeviceToken();
    const goi = () =>
      dataGate(new NextRequest("https://app.test/api/tiles/seamark/12/3263/1890", { headers: { authorization: `Bearer ${chuoi}` } }), rule);
    m.tokenIdentity.mockResolvedValueOnce({ ok: true, phone: "0901234567", tokenHash: "h" });
    expect((await goi()).status).not.toBe(401);
    expect(m.tokenIdentity).toHaveBeenCalledTimes(1);
    m.tokenIdentity.mockResolvedValue({ ok: false, denial: "token_revoked" });
    vi.advanceTimersByTime(30_000);
    expect((await goi()).status).not.toBe(401);
    expect(m.tokenIdentity).toHaveBeenCalledTimes(1); // còn trong đệm
    vi.advanceTimersByTime(IDENTITY_TTL);
    expect((await goi()).status).toBe(401);
  });
});
