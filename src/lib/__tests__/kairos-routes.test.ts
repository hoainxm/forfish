import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/*  ROUTE KAIROS chạy thật trên kho file dev (vòng sửa cuối 2026-10-24): danh tính + thông báo +
    app_config được giả, còn lại là code route/server.ts/kho thật. Soi đúng những chỗ đã sửa:
    Hay chặn HAI chiều · trần sửa bài · Huỷ khung soạn xoá ảnh vừa tải · dọn ảnh mồ côi >24 giờ ·
    nhật ký agent_hide khi đích đã ẩn sẵn. */

const h = vi.hoisted(() => ({
  store: null as unknown,
  key: "k".repeat(40) as string | null,
  notify: vi.fn(async () => undefined),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-identity", () => ({
  identityFromRequest: async (req: Request, optional?: boolean) => {
    const phone = req.headers.get("x-test-phone");
    if (phone) return { ok: true, phone };
    return optional ? { ok: true, phone: null } : { ok: false, res: Response.json({ ok: false, code: "login_required" }, { status: 401 }) };
  },
}));
vi.mock("@/lib/market/notify", () => ({ notifyMarket: h.notify }));
vi.mock("@/lib/app-config", () => ({ getConfigValue: async () => h.key }));
vi.mock("@/lib/kairos/store", async (orig) => ({ ...(await orig<object>()), getKairosStore: async () => h.store }));

vi.stubEnv("MARKET_STORE", "file");
vi.stubEnv("VERCEL", "");
vi.stubEnv("KAIROS_INGEST_KEY", "");

import { createKairosFileStore } from "@/lib/kairos/file-store";
import type { KairosStore, PostFull, ProfileFull } from "@/lib/kairos/store";
import { applyDecision, gcOrphanMedia, MEDIA_GC_AGE_MS } from "@/lib/kairos/server";
import { KAIROS_RATES } from "@/lib/kairos/rate";
import { PUT as hayPost } from "@/app/api/kairos/posts/[id]/hay/route";
import { PUT as hayComment } from "@/app/api/kairos/comments/[id]/hay/route";
import { PATCH as patchPost } from "@/app/api/kairos/posts/[id]/route";
import { DELETE as discard } from "@/app/api/kairos/upload/route";
import { DELETE as kiemDelete } from "@/app/api/kairos/kiem/route";

const A = "0901000011";
const B = "0901000012";
const C = "0901000013";
let dir: string;
let store: KairosStore;
const prof: Record<string, ProfileFull> = {};

const req = (method: string, phone: string | null, body?: unknown, url = "http://x/api") =>
  new Request(url, {
    method,
    headers: { ...(phone ? { "x-test-phone": phone } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const img = (who: string) => `${prof[who].id}/${crypto.randomUUID()}.jpg`;
const post = (author: string, over: Partial<Parameters<KairosStore["insertPost"]>[0]> = {}): Promise<PostFull> =>
  store.insertPost({ kind: "ba-con", author_phone: author, body: "Cá về nhiều", images: [], topic: "nghe-ca", regions: [], provinces: [], ports: [], reshare_of: null, ...over });

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "kairos-routes-"));
  store = createKairosFileStore({ dir });
  h.store = store;
  for (const [phone, handle] of [[A, "Ba Sa Huỳnh"], [B, "Tư Tam Quan"], [C, "Năm Cửa Việt"]]) {
    prof[phone] = await store.createProfile({ phone, handle, handle_norm: handle.toLowerCase() });
  }
});
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
beforeEach(() => h.notify.mockClear());

describe("Hay — chặn HAI chiều (AC09/AC15)", () => {
  it("họ chặn mình ⇒ không Hay được bài của họ (404 như không thấy); bỏ chặn ⇒ được", async () => {
    const p = await post(A);
    await store.setEdge("block", A, B, true); // A chặn B
    expect((await hayPost(req("PUT", B, { on: true }), ctx(p.id))).status).toBe(404);
    expect((await store.getPost(p.id))?.hay_count).toBe(0);
    await store.setEdge("block", A, B, false);
    const ok = await hayPost(req("PUT", B, { on: true }), ctx(p.id));
    expect(ok.status).toBe(200);
    expect((await ok.json()).hayCount).toBe(1);
  });

  it("mình chặn họ ⇒ không Hay được (chiều cũ vẫn giữ)", async () => {
    const p = await post(A);
    await store.setEdge("block", B, A, true);
    expect((await hayPost(req("PUT", B, { on: true }), ctx(p.id))).status).toBe(404);
    await store.setEdge("block", B, A, false);
  });

  it("bình luận: chủ bình luận HOẶC chủ bài chặn mình ⇒ 404; bỏ Hay luôn được", async () => {
    const p = await post(A);
    const c = await store.insertComment({ post_id: p.id, parent_id: null, author_phone: C, body: "Giá tốt" });
    expect((await hayComment(req("PUT", B, { on: true }), ctx(c.id))).status).toBe(200);

    await store.setEdge("block", C, B, true); // chủ bình luận chặn B
    expect((await hayComment(req("PUT", B, { on: true }), ctx(c.id))).status).toBe(404);
    // gỡ dấu Hay của chính mình không làm phiền ai ⇒ vẫn được
    expect((await hayComment(req("PUT", B, { on: false }), ctx(c.id))).status).toBe(200);
    await store.setEdge("block", C, B, false);

    await store.setEdge("block", A, B, true); // chủ BÀI chặn B
    expect((await hayComment(req("PUT", B, { on: true }), ctx(c.id))).status).toBe(404);
    await store.setEdge("block", A, B, false);
  });
});

describe("PATCH bài — trần sửa mỗi ngày", () => {
  it(`sửa tới ${KAIROS_RATES.edits.limit} lần/ngày, lần sau 429 rate_limited; bài không đổi`, async () => {
    const p = await post(C, { body: "bản đầu" });
    for (let i = 1; i <= KAIROS_RATES.edits.limit; i++) {
      const r = await patchPost(req("PATCH", C, { body: `bản ${i}`, topic: "nghe-ca" }), ctx(p.id));
      expect(r.status).toBe(200);
    }
    const over = await patchPost(req("PATCH", C, { body: "quá trần", topic: "nghe-ca" }), ctx(p.id));
    expect(over.status).toBe(429);
    expect((await over.json()).code).toBe("rate_limited");
    expect((await store.getPost(p.id))?.body).toBe(`bản ${KAIROS_RATES.edits.limit}`);
  });
});

describe("Huỷ khung soạn ⇒ xoá ảnh vừa tải (DELETE /api/kairos/upload)", () => {
  it("chưa đăng nhập 401; ảnh thư mục người khác 400; ảnh đang thuộc bài GIỮ, ảnh thừa xoá", async () => {
    const used = img(A);
    const spare = img(A);
    await post(A, { images: [used] });
    expect((await discard(req("DELETE", null, { paths: [spare] }))).status).toBe(401);
    expect((await discard(req("DELETE", A, { paths: [img(B)] }))).status).toBe(400);
    expect((await discard(req("DELETE", A, { paths: [] }))).status).toBe(400);
    const r = await discard(req("DELETE", A, { paths: [used, spare] }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, removed: 1, kept: 1 });
    expect(await store.countAudit(A, "media_discard", "2000-01-01T00:00:00.000Z")).toBe(1);
  });
});

describe("dọn ảnh mồ côi >24 giờ (agent kiểm duyệt)", () => {
  it("chỉ xoá ảnh tải quá 24 giờ không thuộc bài/ảnh đại diện; soi rồi không soi lại", async () => {
    const orphan = img(B);
    const inPost = img(B);
    const avatar = img(B);
    await post(B, { images: [inPost] });
    await store.updateProfile(B, { avatar_path: avatar });
    for (const p of [orphan, inPost, avatar]) await store.audit({ actor: B, actor_kind: "ba-con", action: "upload", target_type: "image", target_id: p });

    // chưa đủ 24 giờ ⇒ chưa đụng
    expect(await gcOrphanMedia(store, Date.now())).toEqual({ checked: 0, removed: 0 });
    const later = Date.now() + MEDIA_GC_AGE_MS + 60_000;
    const r = await gcOrphanMedia(store, later);
    expect(r.removed).toBe(1);
    expect(r.checked).toBeGreaterThanOrEqual(3);
    expect(await gcOrphanMedia(store, later)).toEqual({ checked: 0, removed: 0 });
  });

  it("route DELETE /api/kairos/kiem: sai khoá 401, thiếu khoá 503, sai scope 400", async () => {
    const url = "http://x/api/kairos/kiem?scope=media";
    expect((await kiemDelete(new Request(url, { method: "DELETE", headers: { "x-kairos-key": "sai".repeat(14) } }))).status).toBe(401);
    expect((await kiemDelete(new Request("http://x/api/kairos/kiem", { method: "DELETE", headers: { "x-kairos-key": h.key! } }))).status).toBe(400);
    const ok = await kiemDelete(new Request(url, { method: "DELETE", headers: { "x-kairos-key": h.key! } }));
    expect(ok.status).toBe(200);
    const saved = h.key;
    h.key = null;
    expect((await kiemDelete(new Request(url, { method: "DELETE", headers: { "x-kairos-key": saved! } }))).status).toBe(503);
    h.key = saved;
  });
});

describe("agent tự ẩn — nhật ký agent_hide luôn ghi", () => {
  const decide = (id: string) =>
    applyDecision(store, {
      targetType: "post", targetId: id, verdict: "chan", reason: "lừa đảo", score: 0.95, by: "agent", actor: "agent",
      rulesVersion: "kd-test", model: "m", overrides: null,
    });
  const hides = () => store.countAudit("agent", "agent_hide", "2000-01-01T00:00:00.000Z");

  it("bài đang hiện ⇒ ẩn + báo người đăng + nhật ký", async () => {
    const before = await hides();
    const p = await post(A);
    expect(await decide(p.id)).toBe("applied");
    expect((await store.getPost(p.id))?.hidden).toBe(true);
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(await hides()).toBe(before + 1);
  });

  it("bài ĐÃ ẩn sẵn ⇒ không báo lại người đăng nhưng VẪN ghi nhật ký", async () => {
    const before = await hides();
    const p = await post(A);
    await store.updatePost(p.id, { hidden: true, hidden_reason: "người trực ẩn" });
    expect(await decide(p.id)).toBe("applied");
    expect(h.notify).not.toHaveBeenCalled();
    expect(await hides()).toBe(before + 1);
  });
});
