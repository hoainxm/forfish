// ROUTE /api/kairos/sen-bien chạy thật trên kho file dev — hai loại bài: giới thiệu {chuDe} (14 §14) và tuyên truyền luật
// {luat} (14 §21e, anh Long 2026-10-26). Danh tính/khoá/app_config giả như kairos-routes.test.ts; còn lại là route + kho thật.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const h = vi.hoisted(() => ({ store: null as unknown, key: "k".repeat(40) as string | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-config", () => ({ getConfigValue: async () => h.key }));
vi.mock("@/lib/kairos/store", async (orig) => ({ ...(await orig<object>()), getKairosStore: async () => h.store }));
vi.stubEnv("MARKET_STORE", "file");
vi.stubEnv("VERCEL", "");
vi.stubEnv("KAIROS_INGEST_KEY", "");

import { createKairosFileStore } from "@/lib/kairos/file-store";
import type { KairosStore } from "@/lib/kairos/store";
import { SEN_BIEN_PHONE } from "@/lib/kairos/types";
import { MUC, canCu, ghepBai } from "@/lib/kairos/tuyen-truyen-luat.mjs";
import { CHU_DE } from "@/lib/kairos/sen-bien-gioi-thieu.mjs";
import { POST } from "@/app/api/kairos/sen-bien/route";

let dir: string;
let store: KairosStore;
const goi = (body: unknown, key: string | null = h.key) =>
  POST(
    new Request("http://x/api/kairos/sen-bien", {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { "x-kairos-key": key } : {}) },
      body: JSON.stringify(body),
    }),
  );
const json = async (r: Response) => (await r.json()) as { ok: boolean; code?: string; post?: { kind: string; topic: string; body: string; author?: { handle?: string; official?: boolean } } };

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "kairos-sen-bien-"));
  store = createKairosFileStore({ dir });
  h.store = store;
});
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

describe("tuyên truyền luật {body, luat}", () => {
  const m = MUC.find((x) => x.id === "d21-k2-a")!;
  const bai = ghepBai(m.mau, m);

  it("kho file dev có sẵn hồ sơ Sen Biển (gương 0068) ⇒ đăng được: 201, kind chinh-thuc, topic chinh-sach, đứng tên Sen Biển", async () => {
    expect(await store.profileByPhone(SEN_BIEN_PHONE)).not.toBeNull();
    const r = await goi({ body: bai, luat: m.id });
    expect(r.status).toBe(201);
    const d = await json(r);
    expect(d.post?.kind).toBe("chinh-thuc");
    expect(d.post?.topic).toBe("chinh-sach");
    expect(d.post?.body).toContain(`“${m.trich}”`);
    expect(d.post?.author?.official).toBe(true);
    expect(await store.countAudit("may-thu", "sen_bien_post", "2000-01-01T00:00:00.000Z")).toBeGreaterThanOrEqual(1);
  });
  it("sửa một con số trong trích ⇒ 400 thieu_trich; bỏ căn cứ ⇒ 400 thieu_can_cu; giải thích bịa tiền ⇒ 400 sai_so_tien", async () => {
    expect(await json(await goi({ body: bai.replace("300.000.000", "30.000.000"), luat: m.id }))).toMatchObject({ ok: false, code: "thieu_trich" });
    expect(await json(await goi({ body: bai.replace(canCu(m), ""), luat: m.id }))).toMatchObject({ ok: false, code: "thieu_can_cu" });
    expect(await json(await goi({ body: ghepBai(`${m.mau} Có khi tới 2 tỷ đồng.`, m), luat: m.id }))).toMatchObject({ ok: false, code: "sai_so_tien" });
  });
  it("mục lạ ⇒ 400 bad_topic; gắn bài vào mục khác ⇒ 400 thieu_trich", async () => {
    expect((await goi({ body: bai, luat: "d99-khong-co" })).status).toBe(400);
    expect(await json(await goi({ body: bai, luat: "d21-k2-d" }))).toMatchObject({ ok: false, code: "thieu_trich" });
  });
  it("sai khoá 401, thiếu khoá cấu hình 503", async () => {
    expect((await goi({ body: bai, luat: m.id }, "sai".repeat(14))).status).toBe(401);
    const saved = h.key;
    h.key = null;
    expect((await goi({ body: bai, luat: m.id }, saved)).status).toBe(503);
    h.key = saved;
  });
  it("giới thiệu {chuDe} vẫn chạy như cũ (topic doi-song); trần 4 bài/20 giờ chung cho hai loại ⇒ 429", async () => {
    const c = CHU_DE[0];
    const r = await goi({ body: c.mau, chuDe: c.id });
    expect(r.status).toBe(201);
    expect((await json(r)).post?.topic).toBe("doi-song");
    // đã 2 bài; thêm 2 nữa tới trần 4, bài thứ 5 bị 429
    for (const id of ["d21-k2-d", "d62-hieu-luc"]) {
      const mm = MUC.find((x) => x.id === id)!;
      expect((await goi({ body: ghepBai(mm.mau, mm), luat: id })).status).toBe(201);
    }
    const mm = MUC.find((x) => x.id === "d21-k2-k")!;
    expect((await goi({ body: ghepBai(mm.mau, mm), luat: mm.id })).status).toBe(429);
  });
});
