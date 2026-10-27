import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/*  Dòng tin mặc định XẾP trên ứng viên NHẸ (2026-10-27): 400 ứng viên chỉ lấy cột xếp (PostXep), đủ cột chỉ cho
    ~20 bài của trang. Máy chủ sdvico ở VN kéo 400 hàng đủ cột (~497 KB) qua đường mất gói tới Supabase Seoul là
    chặng nặng nhất ⇒ app báo "Mạng yếu, chưa tải được". Test chốt: KẾT QUẢ Y HỆT cách cũ (đủ cột), bài trả về
    vẫn đủ nội dung, và chỉ lấy đủ cột cho bài của trang. */

const h = vi.hoisted(() => ({ store: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-identity", () => ({
  identityFromRequest: async () => ({ ok: true, phone: null }),
}));
vi.mock("@/lib/app-config", () => ({ getConfigValue: async () => null }));
vi.mock("@/lib/kairos/store", async (orig) => ({ ...(await orig<object>()), getKairosStore: async () => h.store }));

vi.stubEnv("MARKET_STORE", "file");
vi.stubEnv("VERCEL", "");

import { createKairosFileStore } from "@/lib/kairos/file-store";
import type { KairosStore, NewPost, PostXep } from "@/lib/kairos/store";
import { GET as feedGet } from "@/app/api/kairos/feed/route";

const COT_XEP: (keyof PostXep)[] = ["id", "kind", "author_phone", "source_id", "outlet", "topic", "regions", "provinces", "ports", "hay_count", "comment_count", "published_at", "feed_at"];
const nhe = <T extends object>(r: T) => Object.fromEntries(COT_XEP.map((k) => [k, (r as Record<string, unknown>)[k]])) as PostXep;

let dir: string;
let goc: KairosStore;
const MOC = Date.now() + 60_000;

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "kairos-xep-nhe-"));
  goc = createKairosFileStore({ dir });
  const bai: NewPost[] = Array.from({ length: 45 }, (_, i) => ({
    kind: "bao", author_phone: null, body: `thân bài ${i}`, images: [], topic: i % 3 ? "tin" : "bien", regions: i % 2 ? ["mien-trung"] : [],
    provinces: [], ports: [], reshare_of: null, outlet: `Báo ${i % 5}`, url: `https://bao.vn/${i}`, url_hash: `h${i}`, title: `Tin ${i}`,
    title_norm: `tin ${i}`, summary: `tóm tắt ${i}`, summary_by: "ai", attachments: [], mod_state: "dat",
  }));
  await goc.insertBao(bai);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function goi(xepTraNhe: boolean) {
  const goiGetPosts: string[][] = [];
  const goiListPosts: number[] = [];
  h.store = {
    ...goc,
    listPostsXep: async (f: Parameters<KairosStore["listPostsXep"]>[0], n: number) => {
      const rows = await goc.listPostsXep(f, n);
      return xepTraNhe ? rows.map(nhe) : rows;
    },
    listPosts: async (f: Parameters<KairosStore["listPosts"]>[0], n: number) => (goiListPosts.push(n), goc.listPosts(f, n)),
    getPosts: async (ids: string[]) => (goiGetPosts.push(ids), goc.getPosts(ids)),
  } satisfies KairosStore;
  // cùng một mốc giờ cho hai lượt (con trỏ trang sau mã hoá mốc chụp; điểm xếp có hệ số tuổi bài)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MOC);
  const res = await feedGet(new Request("http://x/api/kairos/feed?hat=7"));
  vi.useRealTimers();
  const j = await res.json();
  return { status: res.status, j, goiGetPosts, goiListPosts };
}

describe("GET /api/kairos/feed — xếp trên ứng viên nhẹ", () => {
  it("thứ tự y hệt khi ứng viên đủ cột; bài trả về đủ nội dung; đủ cột chỉ cho bài của trang", async () => {
    const cu = await goi(false);
    const moi = await goi(true);
    expect(moi.status).toBe(200);
    expect(moi.j.posts.length).toBe(cu.j.posts.length);
    expect(moi.j.posts.map((p: { id: string }) => p.id)).toEqual(cu.j.posts.map((p: { id: string }) => p.id));
    expect(moi.j.next).toBe(cu.j.next);
    // đủ nội dung dù ứng viên chỉ có cột xếp
    expect(moi.j.posts.every((p: { title?: string; summary?: string }) => !!p.title && !!p.summary)).toBe(true);
    // không kéo đủ cột cho cả danh sách ứng viên: một lượt getPosts ≤ một trang, không listPosts
    expect(moi.goiListPosts).toEqual([]);
    expect(moi.goiGetPosts.length).toBe(1);
    expect(moi.goiGetPosts[0].length).toBeLessThanOrEqual(20);
  });
});
