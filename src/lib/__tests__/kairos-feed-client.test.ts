// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  areaTag,
  avatarLetter,
  avatarTone,
  countLabel,
  feedQuery,
  fetchFeedPage,
  fetchNewCount,
  filterCached,
  homeFromPort,
  loadFeedCache,
  loadHabit,
  parseFeedPage,
  postTimeLabel,
  savedAtLabel,
  saveFeedCache,
  saveHabit,
} from "@/lib/kairos/feed-client";
import { HABIT_KEY, recordChip, recordRead, emptyHabit } from "@/lib/kairos/thoi-quen";
import { KAIROS_CACHE_KEY } from "@/lib/kairos/cache";
import type { KairosPost } from "@/lib/kairos/types";

function post(over: Partial<KairosPost> = {}): KairosPost {
  return {
    id: over.id ?? "p1",
    kind: "ba-con",
    author: { profileId: "a1", handle: "Bà con 1234", subline: "", avatarUrl: "https://x/a.jpg", official: false },
    outlet: null,
    url: null,
    title: null,
    body: "chữ",
    summary: null,
    summaryBy: null,
    coverUrl: null,
    images: ["https://x/1.jpg"],
    topic: "nghe-ca",
    regions: ["mien-trung"],
    provinces: ["quang-ngai"],
    ports: ["sa-huynh"],
    reshareOf: null,
    pinnedUntil: null,
    hayCount: 0,
    commentCount: 0,
    hayByMe: false,
    topComments: [],
    publishedAt: "2026-10-23T05:00:00.000Z",
    editedAt: null,
    mine: false,
    ...over,
  };
}

const NO_HOME = { port: null, province: null };

describe("feedQuery — chip + nơi nhà ⇒ tham số /feed (AC03/AC04)", () => {
  it("Mới không gửi gì; chủ đề gửi đúng mã chip", () => {
    const moi = feedQuery("moi", NO_HOME);
    expect(moi.ok && moi.params.toString()).toBe("");
    const ts = feedQuery("thoi-su", NO_HOME);
    expect(ts.ok && ts.params.toString()).toBe("chip=thoi-su");
  });
  it("Cảng tôi / Gần tôi thiếu nơi nhà ⇒ cần chọn cảng; có thì chỉ gửi MÃ", () => {
    expect(feedQuery("cang-toi", NO_HOME)).toEqual({ ok: false, need: "home" });
    expect(feedQuery("gan-toi", { port: "sa-huynh", province: null })).toEqual({ ok: false, need: "home" });
    const c = feedQuery("cang-toi", { port: "sa-huynh", province: "quang-ngai" });
    expect(c.ok && c.params.toString()).toBe("chip=cang-toi&port=sa-huynh");
    const g = feedQuery("gan-toi", { port: "sa-huynh", province: "quang-ngai" });
    expect(g.ok && g.params.toString()).toBe("chip=gan-toi&province=quang-ngai");
  });
  it("Bến: port đè chip", () => {
    const b = feedQuery("thoi-su", NO_HOME, { port: "sa-huynh" });
    expect(b.ok && b.params.toString()).toBe("port=sa-huynh");
  });
  it("hồ sơ đọc KHÔNG đi vào tham số (AC04)", () => {
    let h = emptyHabit();
    for (let i = 0; i < 9; i++) h = recordChip(recordRead(h, "the-thao"), "the-thao");
    h = { ...h, home: { port: "sa-huynh", province: "quang-ngai" } };
    for (const chip of ["moi", "the-thao", "cang-toi", "gan-toi", "theo-doi"] as const) {
      const q = feedQuery(chip, h.home);
      const s = q.ok ? q.params.toString() : "";
      expect(s).not.toMatch(/topics|chips|habit|thoiquen|\b9\b/);
    }
  });
});

describe("parseFeedPage", () => {
  it("đọc đúng hình dạng, bỏ phần tử hỏng", () => {
    const p = parseFeedPage({ ok: true, posts: [post(), { id: 3 }], pinned: [post({ id: "pin" })], next: "abc", at: "2026-10-23T06:00:00.000Z" }, 0);
    expect(p?.posts.map((x) => x.id)).toEqual(["p1"]);
    expect(p?.pinned.map((x) => x.id)).toEqual(["pin"]);
    expect(p?.next).toBe("abc");
    expect(p?.at).toBe("2026-10-23T06:00:00.000Z");
  });
  it("hình dạng lạ ⇒ null; thiếu at ⇒ giờ máy", () => {
    expect(parseFeedPage(null, 0)).toBeNull();
    expect(parseFeedPage({ ok: false }, 0)).toBeNull();
    expect(parseFeedPage({ ok: true, posts: "x" }, 0)).toBeNull();
    expect(parseFeedPage({ ok: true, posts: [] }, 0)?.at).toBe(new Date(0).toISOString());
    expect(parseFeedPage({ ok: true, posts: [], next: "" }, 0)?.next).toBeNull();
  });
});

describe("filterCached — mất sóng lọc bản lưu theo chip (14 §10)", () => {
  const list = [
    post({ id: "a", topic: "nghe-ca", ports: ["sa-huynh"], provinces: ["quang-ngai"], regions: ["mien-trung"] }),
    post({ id: "b", topic: "the-thao", ports: [], provinces: ["ca-mau"], regions: ["tay-nam-bo", "dong-nam-bo"] }),
    post({ id: "c", topic: "thoi-su", ports: [], provinces: [], regions: ["ca-nuoc"] }),
  ];
  const home = homeFromPort("sa-huynh");
  it("Mới = tất cả; chủ đề lọc topic; Theo dõi ⇒ rỗng", () => {
    expect(filterCached(list, "moi", home).map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(filterCached(list, "the-thao", home).map((p) => p.id)).toEqual(["b"]);
    expect(filterCached(list, "theo-doi", home)).toEqual([]);
  });
  it("Cảng tôi / Gần tôi / Bến", () => {
    expect(filterCached(list, "cang-toi", home).map((p) => p.id)).toEqual(["a"]);
    expect(filterCached(list, "gan-toi", home).map((p) => p.id)).toEqual(["a"]);
    expect(filterCached(list, "cang-toi", NO_HOME)).toEqual([]);
    expect(filterCached(list, "moi", NO_HOME, "sa-huynh").map((p) => p.id)).toEqual(["a"]);
  });
});

describe("areaTag — nhãn Cả nước (14 §4)", () => {
  it("không rõ khu vực ⇒ Cả nước; có cảng ⇒ đã có nhãn Bến; có vùng/tỉnh ⇒ không nhãn", () => {
    expect(areaTag(post({ regions: ["ca-nuoc"], provinces: [], ports: [] }))).toBe("caNuoc");
    expect(areaTag(post({ regions: ["ca-nuoc"], ports: ["sa-huynh"] }))).toBeNull();
    expect(areaTag(post({ regions: ["ca-nuoc"], ports: ["cang-la"] }))).toBe("caNuoc"); // cảng lạ không có nhãn Bến
    expect(areaTag(post({ regions: ["mien-trung"], ports: [] }))).toBeNull();
  });
});

describe("homeFromPort", () => {
  it("cảng trong danh mục ⇒ tỉnh mới; lạ ⇒ null", () => {
    expect(homeFromPort("sa-huynh")).toEqual({ port: "sa-huynh", province: "quang-ngai" });
    expect(homeFromPort("khong-co")).toEqual(NO_HOME);
    expect(homeFromPort(null)).toEqual(NO_HOME);
  });
});

describe("chữ giờ + số đếm + ảnh đại diện", () => {
  const now = new Date(2026, 9, 23, 12, 0).getTime();
  it("postTimeLabel", () => {
    expect(postTimeLabel(new Date(now - 20_000).toISOString(), now)).toBe("Vừa xong");
    expect(postTimeLabel(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5 phút");
    expect(postTimeLabel(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3 giờ");
    expect(postTimeLabel(new Date(2026, 9, 22, 1, 0).toISOString(), now)).toBe("Hôm qua");
    expect(postTimeLabel(new Date(2026, 9, 2, 8, 0).toISOString(), now)).toBe("02/10");
    expect(postTimeLabel(new Date(2025, 11, 31, 8, 0).toISOString(), now)).toBe("31/12/2025");
    expect(postTimeLabel("hỏng", now)).toBe("");
  });
  it("savedAtLabel HH:mm dd/MM", () => {
    expect(savedAtLabel(new Date(2026, 9, 3, 7, 5).getTime())).toBe("07:05 03/10");
  });
  it("countLabel trần 99+", () => {
    expect(countLabel(0)).toBe("0");
    expect(countLabel(99)).toBe("99");
    expect(countLabel(100)).toBe("99+");
  });
  it("avatar: màu ổn định 1..6, chữ cái đầu", () => {
    const t = avatarTone("3f2b…");
    expect(t).toBeGreaterThanOrEqual(1);
    expect(t).toBeLessThanOrEqual(6);
    expect(avatarTone("3f2b…")).toBe(t);
    expect(avatarLetter("  đức long")).toBe("Đ");
    expect(avatarLetter("...")).toBe("B");
  });
});

describe("mạng — không bao giờ ném (AC06)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const params = new URLSearchParams("chip=thoi-su");

  it("fetch ném ⇒ offline; 500 ⇒ error; JSON lạ ⇒ error 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await fetchFeedPage(params, null)).toEqual({ kind: "offline" });
    expect(await fetchNewCount(params, "2026-10-23T00:00:00Z")).toBe(0);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 500 })));
    expect(await fetchFeedPage(params, null)).toEqual({ kind: "error", status: 500 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ nope: 1 }), { status: 200 })));
    expect(await fetchFeedPage(params, null)).toEqual({ kind: "error", status: 502 });
  });

  it("gửi cursor + có tín hiệu đồng hồ; new-count trần 99", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, posts: [], pinned: [], next: null }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const r = await fetchFeedPage(params, "CUR");
    expect(r.kind).toBe("ok");
    expect(String(f.mock.calls[0][0])).toContain("/api/kairos/feed?chip=thoi-su&cursor=CUR");
    expect(f.mock.calls[0][1].signal).toBeDefined();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, n: 250 }), { status: 200 })));
    expect(await fetchNewCount(params, "2026-10-23T00:00:00Z")).toBe(99);
  });
});

describe("kho trong máy", () => {
  afterEach(() => localStorage.clear());
  it("thói quen ghi/đọc lại", () => {
    saveHabit(recordChip(emptyHabit(), "the-thao"));
    expect(localStorage.getItem(HABIT_KEY)).toBeTruthy();
    expect(loadHabit().chips["the-thao"]).toBe(1);
  });
  it("bản lưu: chỉ chữ, cách ly theo SĐT", () => {
    const w = saveFeedCache("0912345678", [post()], 1000);
    expect(w.ok).toBe(true);
    const c = loadFeedCache("0912345678");
    expect(c?.posts[0].images).toEqual([]);
    expect(c?.posts[0].imageCount).toBe(1);
    expect(c?.savedAt).toBe(1000);
    expect(loadFeedCache("0987654321")).toBeNull();
    expect(localStorage.getItem(KAIROS_CACHE_KEY)).not.toContain("https://x/1.jpg");
  });
});
