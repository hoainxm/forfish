// Integration test cho route /api/sdwork/password-sync (outbound SDFish→SDWork).
// CHỨNG MINH: SĐT lấy từ SESSION (không tin client), ký HMAC đúng, đẩy tới
// SDWORK_SYNC_URL; chặn khi chưa login / mật khẩu ngắn / chưa cấu hình.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { verifyWebhookSignature } from "@/lib/sdwork-webhook";

const h = vi.hoisted(() => ({
  state: { user: { email: "0901234567@sdvico.local" } as { email: string } | null, fetchStatus: 200 },
  calls: { fetch: [] as { url: any; opts: any }[] },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.state.user } }) },
  }),
}));

import { POST } from "@/app/api/sdwork/password-sync/route";

const SECRET = "test-secret";

beforeEach(() => {
  process.env.SDWORK_SYNC_URL = "https://sdwork.example/in";
  process.env.SDWORK_WEBHOOK_SECRET = SECRET;
  h.state.user = { email: "0901234567@sdvico.local" };
  h.state.fetchStatus = 200;
  h.calls.fetch.length = 0;
  global.fetch = vi.fn(async (url: any, opts: any) => {
    h.calls.fetch.push({ url, opts });
    return new Response("{}", { status: h.state.fetchStatus });
  }) as any;
});

function post(body: unknown) {
  return POST(
    new Request("http://x/api/sdwork/password-sync", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("POST /api/sdwork/password-sync", () => {
  it("đẩy mk mới: SĐT từ session + chữ ký HMAC hợp lệ", async () => {
    const res = await post({ password: "newpass123" });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(h.calls.fetch).toHaveLength(1);

    const { url, opts } = h.calls.fetch[0];
    expect(url).toBe("https://sdwork.example/in");
    const sentBody = opts.body as string;
    expect(JSON.parse(sentBody)).toEqual({ phone: "0901234567", password: "newpass123" });
    // chữ ký khớp body (SDWork verify cùng secret)
    const sig = opts.headers["x-sdfish-signature"];
    expect(verifyWebhookSignature(sentBody, sig, SECRET)).toBe(true);
  });

  it("SĐT lấy từ SESSION, KHÔNG từ client (client gửi phone giả → bỏ qua)", async () => {
    await post({ password: "newpass123", phone: "0999999999" });
    const sentBody = JSON.parse(h.calls.fetch[0].opts.body);
    expect(sentBody.phone).toBe("0901234567"); // session, không phải client
  });

  it("chưa đăng nhập → 401, không đẩy", async () => {
    h.state.user = null;
    const res = await post({ password: "newpass123" });
    expect(res.status).toBe(401);
    expect(h.calls.fetch).toHaveLength(0);
  });

  it("mật khẩu < 6 ký tự → 400, không đẩy", async () => {
    const res = await post({ password: "123" });
    expect(res.status).toBe(400);
    expect(h.calls.fetch).toHaveLength(0);
  });

  it("chưa cấu hình SDWORK_SYNC_URL → 503", async () => {
    delete process.env.SDWORK_SYNC_URL;
    const res = await post({ password: "newpass123" });
    expect(res.status).toBe(503);
    expect(h.calls.fetch).toHaveLength(0);
  });

  it("SDWork trả lỗi → 502 (best-effort, báo về để đối soát)", async () => {
    h.state.fetchStatus = 500;
    const res = await post({ password: "newpass123" });
    expect(res.status).toBe(502);
  });
});
