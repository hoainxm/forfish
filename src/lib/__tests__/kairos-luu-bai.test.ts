// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANH_MO_BYTES,
  LUU_ANH_CACHE,
  LUU_KEY,
  LUU_MAX_ANH_BYTES,
  LUU_MAX_CHU_BYTES,
  LUU_MAX_POSTS,
  anhCuaBai,
  anhKhongDung,
  boLuu,
  chiGiuNgan,
  daLuu,
  docLuu,
  dungLuong,
  emptyLuu,
  ghiLuu,
  listLuu,
  luuLoiText,
  parseLuu,
  serializeLuu,
  themLuu,
  toSavedPost,
  xoaLuuTaiKhoan,
  type LuuState,
} from "@/lib/kairos/luu-bai";
import { clearKairosStorage, KAIROS_CACHE_KEY } from "@/lib/kairos/cache";
import { boLuuBai, daLuuBai, docBaiLuu, luuBaiMangTheo } from "@/lib/kairos/luu-client";
import type { KairosPost } from "@/lib/kairos/types";

const t0 = Date.parse("2026-10-24T00:00:00Z");
const A = "0901234567";
const B = "0987654321";
const KHACH = "__khach__";
const post = (n: number, over: Partial<KairosPost> = {}): KairosPost => ({
  id: `p${n}`,
  kind: "ba-con",
  author: { profileId: "u1", handle: "Tư", subline: "Cảng Sa Huỳnh", avatarUrl: "https://x/a.jpg", official: false },
  outlet: null,
  url: null,
  title: null,
  body: "Biển êm",
  summary: null,
  summaryBy: null,
  coverUrl: null,
  images: [`https://kho/${n}-1.jpg`, `https://kho/${n}-2.jpg`],
  topic: "nghe-ca",
  regions: ["mien-trung"],
  provinces: [],
  ports: [],
  reshareOf: null,
  pinnedUntil: null,
  hayCount: 0,
  commentCount: 0,
  hayByMe: false,
  topComments: [],
  publishedAt: new Date(t0 + n * 60_000).toISOString(),
  editedAt: null,
  mine: false,
  ...over,
});
const anh = (p: KairosPost, bytes = 100_000) => anhCuaBai(p).map((url) => ({ url, bytes }));

function them(s: LuuState, ngan: string, p: KairosPost, b?: number, now = t0): LuuState {
  const r = themLuu(s, ngan, p, anh(p, b), now);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

describe("luu-bai — bài mang theo giữ ẢNH, bỏ ảnh đại diện", () => {
  it("giữ ảnh + ảnh bìa, bỏ avatar, ≤2 bình luận, bài gốc đăng lại chỉ chữ", () => {
    const c = { id: "c", postId: "p1", parentId: null, author: { profileId: "u2", handle: "Ba", subline: "", avatarUrl: "https://x/b.jpg", official: false }, body: "ừ", hayCount: 0, hayByMe: false, createdAt: "", mine: false };
    const p = toSavedPost(post(1, { coverUrl: "https://bao/c.jpg", topComments: [c, c, c], reshareOf: post(0) }));
    expect(p.images).toEqual(["https://kho/1-1.jpg", "https://kho/1-2.jpg"]);
    expect(p.coverUrl).toBe("https://bao/c.jpg");
    expect(p.author?.avatarUrl).toBeNull();
    expect(p.topComments).toHaveLength(2);
    expect(p.topComments[0].author.avatarUrl).toBeNull();
    expect(p.reshareOf?.images).toEqual([]);
    expect(p.reshareOf?.imageCount).toBe(2);
    expect(p.reshareOf?.reshareOf).toBeNull();
  });

  it("anhCuaBai: ảnh bài + ảnh bìa, chỉ http(s), không trùng, ≤5 ảnh bài", () => {
    const imgs = [1, 2, 3, 4, 5, 6].map((i) => `https://k/${i}.jpg`);
    expect(anhCuaBai({ images: [...imgs, "javascript:x"], coverUrl: "https://k/1.jpg" })).toEqual(imgs.slice(0, 5));
    expect(anhCuaBai({ images: [], coverUrl: "https://bao/c.jpg" })).toEqual(["https://bao/c.jpg"]);
  });
});

describe("luu-bai — gộp / bỏ / trần", () => {
  it("thêm, làm mới cùng id (không tính thêm), mới lưu trước", () => {
    let s = them(emptyLuu(), A, post(1), undefined, t0);
    s = them(s, A, post(2), undefined, t0 + 1);
    s = them(s, A, post(1, { body: "sửa" }), undefined, t0 + 2);
    const l = listLuu(s, A);
    expect(l.map((e) => e.post.id)).toEqual(["p1", "p2"]);
    expect(l[0].post.body).toBe("sửa");
    expect(daLuu(s, A, "p2")).toBe(true);
    expect(dungLuong(s, A)).toEqual({ bai: 2, anhBytes: 400_000 });
  });

  it("trần 50 bài ⇒ báo đầy, KHÔNG tự bỏ bài cũ", () => {
    let s = emptyLuu();
    for (let i = 0; i < LUU_MAX_POSTS; i++) s = them(s, A, post(i, { images: [] }));
    const r = themLuu(s, A, post(999), [], t0);
    expect(r).toEqual({ ok: false, reason: "bai" });
    expect(listLuu(s, A)).toHaveLength(LUU_MAX_POSTS);
    // làm mới bài ĐÃ có vẫn được khi đầy
    expect(themLuu(s, A, post(3, { images: [] }), [], t0).ok).toBe(true);
  });

  it("trần 20 MB ảnh ⇒ báo đầy", () => {
    const s = them(emptyLuu(), A, post(1), LUU_MAX_ANH_BYTES / 2 - 10);
    expect(themLuu(s, A, post(2), [{ url: "https://k/x", bytes: 100 }], t0).ok).toBe(false);
    expect(themLuu(s, A, post(2), [{ url: "https://k/x", bytes: 100 }], t0)).toEqual({ ok: false, reason: "anh" });
  });

  it("trần chữ cả khoá ⇒ báo đầy", () => {
    const big = "x".repeat(2000);
    // 50 bài × 2.000 ký tự vừa trong 400 KB ở MỘT ngăn — đầy chữ chỉ khi nhiều ngăn cộng lại
    let o = emptyLuu();
    for (let i = 0; i < LUU_MAX_POSTS; i++) o = them(o, A, post(i, { body: big, images: [] }));
    expect(listLuu(o, A)).toHaveLength(LUU_MAX_POSTS);
    let full = o;
    let last: ReturnType<typeof themLuu> | null = null;
    for (let i = 0; i < 200; i++) {
      last = themLuu(full, `k${i}`, post(1000 + i, { body: big, images: [] }), [], t0);
      if (!last.ok) break;
      full = last.state;
    }
    expect(last).toEqual({ ok: false, reason: "chu" });
    expect(new TextEncoder().encode(serializeLuu(full)).length).toBeLessThanOrEqual(LUU_MAX_CHU_BYTES);
  });

  it("bỏ lưu; ngăn rỗng gỡ luôn; bỏ bài không có ⇒ y nguyên", () => {
    const s = them(emptyLuu(), A, post(1));
    expect(boLuu(s, A, "pX")).toBe(s);
    const s2 = boLuu(s, A, "p1");
    expect(s2.ngan[A]).toBeUndefined();
  });

  it("ảnh dùng chung hai ngăn: bỏ ở ngăn này KHÔNG xoá ảnh ngăn kia", () => {
    let s = them(emptyLuu(), A, post(1));
    s = them(s, B, post(1));
    const sau = boLuu(s, A, "p1");
    expect(anhKhongDung(s, sau)).toEqual([]);
    expect(anhKhongDung(sau, boLuu(sau, B, "p1")).sort()).toEqual(["https://kho/1-1.jpg", "https://kho/1-2.jpg"]);
  });

  it("cách ly ngăn SĐT: ngăn này không thấy bài ngăn kia", () => {
    const s = them(emptyLuu(), A, post(1));
    expect(listLuu(s, B)).toEqual([]);
    expect(daLuu(s, KHACH, "p1")).toBe(false);
  });
});

describe("luu-bai — đọc hỏng / ghi hỏng / đăng xuất", () => {
  it("JSON hỏng / sai phiên bản ⇒ rỗng; mục hỏng lẻ ⇒ bỏ mục đó", () => {
    expect(parseLuu("{hỏng")).toEqual(emptyLuu());
    expect(parseLuu(JSON.stringify({ v: 2, ngan: {} }))).toEqual(emptyLuu());
    expect(parseLuu(JSON.stringify({ v: 1, ngan: [] }))).toEqual(emptyLuu());
    const good = them(emptyLuu(), A, post(1));
    const raw = JSON.parse(serializeLuu(good));
    raw.ngan[A].push({ post: { id: 5 }, savedAt: 1, anh: [] }, null, { post: post(2), savedAt: "x", anh: [] });
    raw.ngan[A][0].anh.push({ url: "javascript:x", bytes: 1 }, { url: "https://k/z", bytes: -1 });
    raw.ngan[B] = "hỏng";
    const back = parseLuu(JSON.stringify(raw));
    expect(listLuu(back, A).map((e) => e.post.id)).toEqual(["p1"]);
    expect(listLuu(back, A)[0].anh).toHaveLength(2);
    expect(back.ngan[B]).toBeUndefined();
  });

  it("ghiLuu: máy không ghi được ⇒ false (không nuốt); rỗng ⇒ gỡ khoá", () => {
    const st = window.localStorage;
    st.clear();
    expect(ghiLuu(st, them(emptyLuu(), A, post(1)))).toBe(true);
    expect(st.getItem(LUU_KEY)).toBeTruthy();
    expect(ghiLuu(st, emptyLuu())).toBe(true);
    expect(st.getItem(LUU_KEY)).toBeNull();
    const bad = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); }, removeItem: () => {} } as unknown as Storage;
    expect(ghiLuu(bad, them(emptyLuu(), A, post(1)))).toBe(false);
    expect(ghiLuu(null, emptyLuu())).toBe(false);
  });

  it("đăng xuất: bỏ mọi ngăn tài khoản, GIỮ ngăn khách; trả ảnh không còn ai dùng", () => {
    const st = window.localStorage;
    st.clear();
    let s = them(emptyLuu(), A, post(1));
    s = them(s, KHACH, post(2));
    s = them(s, KHACH, post(1)); // khách cũng lưu p1 ⇒ ảnh p1 phải ở lại
    s = them(s, B, post(3));
    ghiLuu(st, s);
    const xoa = xoaLuuTaiKhoan(st, KHACH);
    const con = docLuu(st);
    expect(Object.keys(con.ngan)).toEqual([KHACH]);
    expect(xoa.sort()).toEqual(["https://kho/3-1.jpg", "https://kho/3-2.jpg"]);
    expect(chiGiuNgan(s, "khong-co")).toEqual(emptyLuu());
  });

  it("clearKairosStorage (nút Đăng xuất) cũng dọn bài lưu của tài khoản, giữ bài khách", () => {
    const st = window.localStorage;
    st.clear();
    st.setItem("forfish.fc.v3", "giữ");
    st.setItem(KAIROS_CACHE_KEY, "x");
    ghiLuu(st, them(them(emptyLuu(), A, post(1)), KHACH, post(2)));
    const xoa = clearKairosStorage(st);
    expect(xoa).toHaveLength(2);
    expect(Object.keys(docLuu(st).ngan)).toEqual([KHACH]);
    expect(st.getItem("forfish.fc.v3")).toBe("giữ");
  });

  it("câu báo đầy đúng chữ spec", () => {
    expect(luuLoiText("bai")).toBe("Bộ nhớ lưu đầy — bỏ bớt bài đã lưu.");
    expect(luuLoiText("anh")).toBe(luuLoiText("chu"));
    expect(luuLoiText("ghi")).not.toBe(luuLoiText("bai"));
  });
});

// ── luu-client: ghép kho ảnh giả + localStorage jsdom ─────────────────────

class FakeCache {
  m = new Map<string, Response>();
  failPut = false;
  async match(u: string) {
    return this.m.get(u)?.clone();
  }
  async put(u: string, r: Response) {
    if (this.failPut) throw new Error("QuotaExceededError");
    this.m.set(u, r);
  }
  async delete(u: string) {
    return this.m.delete(u);
  }
}

describe("luu-client — Lưu / Bỏ lưu đầu-cuối", () => {
  let kho: FakeCache;
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    window.localStorage.clear();
    kho = new FakeCache();
    vi.stubGlobal("caches", { open: async (n: string) => (n === LUU_ANH_CACHE ? kho : new FakeCache()) });
    fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("bao")) {
        if (init?.mode === "cors") throw new TypeError("CORS");
        return { type: "opaque", ok: false, status: 0 } as unknown as Response;
      }
      if (url.includes("mat")) return new Response("", { status: 404 });
      return new Response(new Uint8Array(1234), { status: 200, headers: { "content-type": "image/jpeg" } });
    });
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lưu chữ + ảnh kho (đo cỡ thật) + ảnh bìa báo kiểu mờ (tính khoán)", async () => {
    const p = post(1, { coverUrl: "https://bao/c.jpg" });
    const r = await luuBaiMangTheo(A, p, t0);
    expect(r).toEqual({ ok: true, anhLuu: 3, anhThieu: 0 });
    expect(kho.m.size).toBe(3);
    const e = docBaiLuu(A)[0];
    expect(e.anh.find((a) => a.url.includes("bao"))?.bytes).toBe(ANH_MO_BYTES);
    expect(e.anh.find((a) => a.url.includes("kho"))?.bytes).toBe(1234);
    expect(daLuuBai(A, "p1")).toBe(true);
    expect(daLuuBai(B, "p1")).toBe(false);
  });

  it("ảnh hỏng ⇒ vẫn lưu chữ, báo số ảnh thiếu; bài chỉ chữ từ bản lưu dòng tin ⇒ ảnh tính thiếu", async () => {
    const r = await luuBaiMangTheo(A, post(1, { images: ["https://kho/1.jpg", "https://mat/2.jpg"] }), t0);
    expect(r).toEqual({ ok: true, anhLuu: 1, anhThieu: 1 });
    const r2 = await luuBaiMangTheo(A, post(2, { images: [], imageCount: 3 }), t0);
    expect(r2).toEqual({ ok: true, anhLuu: 0, anhThieu: 3 });
  });

  it("đầy 50 bài ⇒ báo đầy, KHÔNG tốn sóng tải ảnh", async () => {
    let s = emptyLuu();
    for (let i = 0; i < LUU_MAX_POSTS; i++) s = them(s, A, post(i, { images: [] }));
    ghiLuu(window.localStorage, s);
    const r = await luuBaiMangTheo(A, post(999), t0);
    expect(r).toEqual({ ok: false, reason: "bai" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ảnh vừa tải làm vượt 20 MB ⇒ báo đầy, KHÔNG ghi ảnh nào vào kho", async () => {
    ghiLuu(window.localStorage, them(emptyLuu(), A, post(1, { images: ["https://kho/to.jpg"] }), LUU_MAX_ANH_BYTES - 1000));
    const r = await luuBaiMangTheo(A, post(2), t0);
    expect(r).toEqual({ ok: false, reason: "anh" });
    expect(kho.m.size).toBe(0);
  });

  it("ghi chữ hỏng ⇒ báo lỗi, gỡ ảnh vừa ghi (không mồ côi)", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const r = await luuBaiMangTheo(A, post(1), t0);
    spy.mockRestore();
    expect(r).toEqual({ ok: false, reason: "ghi" });
    await new Promise((res) => setTimeout(res, 0));
    expect(kho.m.size).toBe(0);
  });

  it("không có Cache Storage ⇒ vẫn lưu chữ, ảnh tính thiếu", async () => {
    vi.stubGlobal("caches", undefined);
    const r = await luuBaiMangTheo(A, post(1), t0);
    expect(r).toEqual({ ok: true, anhLuu: 0, anhThieu: 2 });
  });

  it("bỏ lưu gỡ chữ + ảnh; ảnh bài khác còn dùng thì giữ", async () => {
    await luuBaiMangTheo(A, post(1), t0);
    await luuBaiMangTheo(A, post(2, { images: ["https://kho/1-1.jpg"] }), t0 + 1);
    expect(await boLuuBai(A, "p1")).toBe(true);
    expect([...kho.m.keys()]).toEqual(["https://kho/1-1.jpg"]);
    expect(docBaiLuu(A).map((e) => e.post.id)).toEqual(["p2"]);
  });
});

describe("public/sw.js — kho ảnh bài đã lưu", () => {
  const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
  it("tên kho trong sw.js TRÙNG LUU_ANH_CACHE", () => {
    expect(sw).toContain(`const SDFISH_KAIROS_LUU_V = "${LUU_ANH_CACHE}"`);
  });
  it("activate KHÔNG xoá kho này (bump vỏ không mất ảnh bà con mang theo)", () => {
    const block = sw.match(/addEventListener\("activate"[\s\S]*?\n\}\);/);
    expect(block![0]).toContain("k !== SDFISH_KAIROS_LUU_V");
  });
  it("ảnh khác origin tra kho này; yêu cầu khác origin còn lại vẫn không đụng", () => {
    const h = sw.slice(sw.indexOf('addEventListener("fetch"'));
    expect(h).toMatch(/url\.origin !== self\.location\.origin\) \{\s*\/\/[^\n]*\n\s*if \(req\.destination === "image"[^\n]*kairosLuuAnh\(req\)\);\s*return;/);
    expect(sw).toMatch(/caches\.match\(req\.url, \{ cacheName: SDFISH_KAIROS_LUU_V/);
  });
});
