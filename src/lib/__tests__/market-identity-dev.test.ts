import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

/*  NHÁNH DEV trong identityFromRequest (12 §6.2 / §6.5): với env PROD hàm KHÔNG
    HỀ chạm getMarketStore (spy); với env file mode thì tra sổ persona thay cho
    device_tokens. Mọi hạ tầng máy chủ được mock — test chỉ soi rẽ nhánh. */

const devIdentity = vi.fn();
const getMarketStore = vi.fn(async () => ({ devIdentity }));
const tokenIdentity = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => null }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
vi.mock("@/lib/device-token-server", () => ({ tokenIdentity, touchToken: () => {} }));
vi.mock("@/lib/market/store", () => ({ getMarketStore }));

const TOKEN = "sdf_" + "a".repeat(43);
const req = (token?: string) =>
  ({ headers: new Headers(token ? { "x-sdfish-token": token } : {}) }) as unknown as Request;

describe("identityFromRequest — nhánh dev", () => {
  beforeEach(() => {
    vi.resetModules();
    devIdentity.mockReset();
    getMarketStore.mockClear();
    tokenIdentity.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("env PROD (không MARKET_STORE): KHÔNG gọi getMarketStore; đi đường tokenIdentity như cũ", async () => {
    vi.stubEnv("MARKET_STORE", "");
    tokenIdentity.mockResolvedValue({ ok: true, phone: "0901000001", tokenHash: "h" });
    const { identityFromRequest } = await import("@/lib/api-identity");
    const who = await identityFromRequest(req(TOKEN));
    expect(who).toEqual({ ok: true, phone: "0901000001", legacy: false });
    expect(getMarketStore).not.toHaveBeenCalled();
    expect(tokenIdentity).toHaveBeenCalledTimes(1);
  });

  it("MARKET_STORE=file NHƯNG VERCEL=1 ⇒ vẫn đường prod", async () => {
    vi.stubEnv("MARKET_STORE", "file");
    vi.stubEnv("VERCEL", "1");
    tokenIdentity.mockResolvedValue({ ok: false, unavailable: true });
    const { identityFromRequest } = await import("@/lib/api-identity");
    const who = await identityFromRequest(req(TOKEN));
    expect(who.ok).toBe(false);
    if (!who.ok) expect((who.res as unknown as { status: number }).status).toBe(503);
    expect(getMarketStore).not.toHaveBeenCalled();
  });

  it("file mode: chuỗi có trong sổ persona ⇒ phone; KHÔNG chạm tokenIdentity", async () => {
    vi.stubEnv("MARKET_STORE", "file");
    vi.stubEnv("VERCEL", "");
    devIdentity.mockResolvedValue({ phone: "84901000001", name: "Anh Ba", role: "buyer", tier: "basic" });
    const { identityFromRequest } = await import("@/lib/api-identity");
    const who = await identityFromRequest(req(TOKEN));
    expect(who).toEqual({ ok: true, phone: "0901000001", legacy: false });
    expect(devIdentity).toHaveBeenCalledWith(TOKEN);
    expect(tokenIdentity).not.toHaveBeenCalled();
  });

  it("file mode: chuỗi lạ ⇒ 401 unknown_token; không chuỗi ⇒ 401 no_token; anonymous ⇒ phone rỗng", async () => {
    vi.stubEnv("MARKET_STORE", "file");
    vi.stubEnv("VERCEL", "");
    devIdentity.mockResolvedValue(null);
    const { identityFromRequest } = await import("@/lib/api-identity");
    const bad = await identityFromRequest(req(TOKEN));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.res as unknown).toEqual({ body: { ok: false, code: "unknown_token" }, status: 401 });
    const none = await identityFromRequest(req());
    if (!none.ok) expect(none.res as unknown).toEqual({ body: { ok: false, code: "no_token" }, status: 401 });
    expect(await identityFromRequest(req(), true)).toEqual({ ok: true, phone: "", legacy: false });
    // chuỗi sai khuôn ⇒ readTokenHeader trả null ⇒ không tra sổ
    devIdentity.mockClear();
    await identityFromRequest(req("rac"));
    expect(devIdentity).not.toHaveBeenCalled();
  });
});
