import { describe, it, expect } from "vitest";
import {
  CACHE_MAX_BYTES,
  CACHE_MAX_POSTS,
  DRAFT_MAX,
  KAIROS_CACHE_KEY,
  KAIROS_DRAFT_KEY,
  cacheBucket,
  clearKairosStorage,
  draftKey,
  draftSlot,
  mergeAndTrim,
  parseCache,
  parseDrafts,
  putDraft,
  toCachedPost,
  writeCache,
} from "@/lib/kairos/cache";
import type { KairosPost } from "@/lib/kairos/types";

const t0 = Date.parse("2026-10-23T00:00:00Z");
const post = (n: number, over: Partial<KairosPost> = {}): KairosPost => ({
  id: `p${String(n).padStart(4, "0")}`,
  kind: "ba-con",
  author: { profileId: "u1", handle: "Tư", subline: "Cảng Sa Huỳnh", avatarUrl: "https://x/a.jpg", official: false },
  outlet: null,
  url: null,
  title: null,
  body: "Biển êm",
  summary: null,
  summaryBy: null,
  coverUrl: "https://x/c.jpg",
  images: ["https://x/1.jpg", "https://x/2.jpg"],
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

class MemStorage implements Storage {
  m = new Map<string, string>();
  quota = Infinity;
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    if (v.length > this.quota) {
      const e = new Error("quota");
      e.name = "QuotaExceededError";
      throw e;
    }
    this.m.set(k, v);
  }
}

describe("cache — chỉ chữ", () => {
  it("bỏ ảnh/ảnh bìa/ảnh đại diện, nhớ số ảnh, ≤2 bình luận, đăng lại 1 tầng", () => {
    const inner = post(1, { reshareOf: post(0) });
    const c = toCachedPost(post(2, { reshareOf: inner }));
    expect(c.images).toEqual([]);
    expect(c.imageCount).toBe(2);
    expect(c.coverUrl).toBeNull();
    expect(c.author?.avatarUrl).toBeNull();
    expect(c.reshareOf?.reshareOf).toBeNull();
    expect(c.reshareOf?.images).toEqual([]);
  });
});

describe("cache — trần 200 bài / 300 KB", () => {
  it("quá 200 bài ⇒ giữ 200 bài MỚI nhất", () => {
    const many = Array.from({ length: 250 }, (_, i) => post(i));
    const out = mergeAndTrim([], many);
    expect(out).toHaveLength(CACHE_MAX_POSTS);
    expect(out[0].id).toBe("p0249");
    expect(out[out.length - 1].id).toBe("p0050");
  });

  it("vượt trần byte ⇒ cắt bài cũ tới khi lọt", () => {
    const fat = Array.from({ length: 200 }, (_, i) => post(i, { body: "á".repeat(1990) })); // ~4 KB/bài
    const out = mergeAndTrim([], fat);
    const size = new TextEncoder().encode(JSON.stringify(out)).length;
    expect(size).toBeLessThanOrEqual(CACHE_MAX_BYTES);
    expect(out.length).toBeGreaterThan(50);
    expect(out[0].id).toBe("p0199"); // bỏ bài CŨ, không bỏ bài mới
  });

  it("bản mới tải đè bản cũ cùng id, không lặp bài", () => {
    const out = mergeAndTrim([toCachedPost(post(1, { hayCount: 1 }))], [post(1, { hayCount: 9 }), post(2)]);
    expect(out.map((p) => p.id)).toEqual(["p0002", "p0001"]);
    expect(out[1].hayCount).toBe(9);
  });
});

describe("cache — cách ly tài khoản + ghi", () => {
  it("ngăn theo SĐT đã chuẩn hoá; khác người ⇒ không đọc được", () => {
    const s = new MemStorage();
    expect(writeCache(s, "+84 901 234 567", [post(1)], t0)).toEqual({ ok: true, kept: 1 });
    expect(parseCache(s.getItem(KAIROS_CACHE_KEY), "0901234567")?.posts).toHaveLength(1);
    expect(parseCache(s.getItem(KAIROS_CACHE_KEY), "0909999999")).toBeNull();
    expect(parseCache(s.getItem(KAIROS_CACHE_KEY), null)).toBeNull();
    expect(cacheBucket("")).toBe(cacheBucket(null));
  });

  it("nhánh khách không đè bản của người đã đăng nhập", () => {
    const s = new MemStorage();
    writeCache(s, "0901234567", [post(1)], t0);
    expect(writeCache(s, null, [post(2)], t0)).toEqual({ ok: true, kept: 0 });
    expect(parseCache(s.getItem(KAIROS_CACHE_KEY), "0901234567")?.posts[0].id).toBe("p0001");
  });

  it("đầy bộ nhớ ⇒ cắt nửa thử lại; hết đường ⇒ báo lỗi, không nuốt", () => {
    const s = new MemStorage();
    const posts = Array.from({ length: 100 }, (_, i) => toCachedPost(post(i)));
    s.quota = JSON.stringify({ bucket: "0901234567", savedAt: t0, posts: posts.slice(0, 30) }).length;
    const r = writeCache(s, "0901234567", posts, t0);
    expect(r.ok).toBe(true);
    expect(r.ok && r.kept).toBeLessThanOrEqual(30);
    s.quota = 5;
    expect(writeCache(s, "0901234567", posts, t0)).toEqual({ ok: false, reason: "quota" });
  });

  it("lỗi khác quota ⇒ { ok:false, reason:'error' }", () => {
    const s = new MemStorage();
    s.setItem = () => {
      throw new Error("SecurityError");
    };
    expect(writeCache(s, "0901234567", [post(1)], t0)).toEqual({ ok: false, reason: "error" });
  });

  it("đăng xuất xoá bản lưu + nháp, KHÔNG đụng forfish.fc.*", () => {
    const s = new MemStorage();
    s.setItem("forfish.fc.v3", "giữ");
    s.setItem(KAIROS_CACHE_KEY, "x");
    s.setItem(KAIROS_DRAFT_KEY, "y");
    clearKairosStorage(s);
    expect(s.getItem("forfish.fc.v3")).toBe("giữ");
    expect(s.getItem(KAIROS_CACHE_KEY)).toBeNull();
    expect(s.getItem(KAIROS_DRAFT_KEY)).toBeNull();
  });

  it("bản lưu hỏng ⇒ null, không ném", () => {
    expect(parseCache("{hỏng", null)).toBeNull();
    expect(parseCache(JSON.stringify({ bucket: "__khach__" }), null)).toBeNull();
  });
});

describe("nháp — chỉ chữ, ≤20", () => {
  it("đặt, xoá khi rỗng, giữ 20 nháp mới nhất", () => {
    let d = putDraft({}, draftKey("bai"), "chào", 1);
    expect(d.bai.text).toBe("chào");
    d = putDraft(d, "bai", "  ", 2);
    expect(d.bai).toBeUndefined();
    for (let i = 0; i < 25; i++) d = putDraft(d, draftKey("bl", `p${i}`), `bl ${i}`, 100 + i);
    expect(Object.keys(d)).toHaveLength(DRAFT_MAX);
    expect(d["bl:p0"]).toBeUndefined();
    expect(d["bl:p24"].text).toBe("bl 24");
  });
  it("nháp chia ngăn theo SĐT: người sau trên máy chung không thấy nháp người trước", () => {
    const a = draftSlot("0901000001", draftKey("bai"));
    const b = draftSlot("0901000002", draftKey("bai"));
    expect(a).not.toBe(b);
    expect(draftSlot(null, "bai")).toBe(draftSlot("", "bai"));
    const d = putDraft({}, a, "của A", 1);
    expect(d[b]).toBeUndefined();
    const sua = draftSlot("0901000001", draftKey("sua", "00000000-0000-4000-8000-000000000001"));
    expect(parseDrafts(JSON.stringify(putDraft({}, sua, "x", 1)))[sua]?.text).toBe("x");
  });
  it("đọc nháp bỏ mục hỏng", () => {
    expect(parseDrafts(JSON.stringify({ a: { text: "x", at: 1 }, b: { text: 1 }, c: null }))).toEqual({ a: { text: "x", at: 1 } });
    expect(parseDrafts("[]")).toEqual({});
    expect(parseDrafts("hỏng")).toEqual({});
  });
});
