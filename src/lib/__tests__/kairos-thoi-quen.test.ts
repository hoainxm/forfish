import { describe, it, expect } from "vitest";
import {
  CHIPS,
  HABIT_MAX_BYTES,
  emptyHabit,
  orderChips,
  parseHabit,
  recordChip,
  recordRead,
  serializeHabit,
  setHome,
  topicAffinity,
  type Habit,
} from "@/lib/kairos/thoi-quen";
import { isPinned, rankPage, scorePost, type RankablePost } from "@/lib/kairos/xep-bai";

describe("thoi-quen — chip", () => {
  it("mặc định đúng thứ tự spec, 'Mới' đầu", () => {
    expect(orderChips(emptyHabit())).toEqual([...CHIPS]);
  });

  it("chip hay bấm tự lên đầu, 'Mới' vẫn luôn đầu", () => {
    let h = emptyHabit();
    for (let i = 0; i < 3; i++) h = recordChip(h, "the-thao");
    h = recordChip(h, "cang-toi");
    for (let i = 0; i < 5; i++) h = recordChip(h, "moi");
    const o = orderChips(h);
    expect(o.slice(0, 3)).toEqual(["moi", "the-thao", "cang-toi"]);
    expect(o).toHaveLength(CHIPS.length);
  });

  it("hoà điểm giữ thứ tự mặc định", () => {
    const h = recordChip(recordChip(emptyHabit(), "kinh-te"), "nghe-ca");
    expect(orderChips(h).slice(0, 3)).toEqual(["moi", "nghe-ca", "kinh-te"]);
  });

  it("đếm có trần: vượt thì cả bảng chia đôi, giữ thứ hạng", () => {
    let h: Habit = { ...emptyHabit(), chips: { "nghe-ca": 500, "kinh-te": 100 } };
    h = recordChip(h, "nghe-ca");
    expect(h.chips["nghe-ca"]).toBe(250);
    expect(h.chips["kinh-te"]).toBe(50);
  });
});

describe("thoi-quen — lưu trong máy", () => {
  it("vòng lưu/đọc giữ nguyên; chuỗi hỏng/phiên bản khác ⇒ trống", () => {
    let h = recordRead(recordChip(emptyHabit(), "the-thao"), "nghe-ca");
    h = setHome(h, { port: "sa-huynh", province: "quang-ngai" });
    expect(parseHabit(serializeHabit(h))).toEqual(h);
    expect(parseHabit("{hỏng")).toEqual(emptyHabit());
    expect(parseHabit(JSON.stringify({ v: 2 }))).toEqual(emptyHabit());
    expect(parseHabit(null)).toEqual(emptyHabit());
  });

  it("bỏ khoá lạ, số âm, tỉnh lạ (không tin dữ liệu trong máy)", () => {
    const h = parseHabit(JSON.stringify({ v: 1, chips: { hack: 9, "the-thao": -1, "kinh-te": 2 }, topics: { x: 1 }, home: { port: "<b>", province: "bac-kinh" } }));
    expect(h.chips).toEqual({ "kinh-te": 2 });
    expect(h.topics).toEqual({});
    expect(h.home).toEqual({ port: null, province: null });
  });

  it("hồ sơ đầy nhất vẫn ≤4 KB", () => {
    const h = emptyHabit();
    for (const c of CHIPS) h.chips[c] = 500;
    for (const t of ["nghe-ca", "thoi-su", "phap-luat", "doi-song", "the-thao", "giai-tri", "kinh-te"] as const) h.topics[t] = 500;
    h.home = { port: "x".repeat(60), province: "ho-chi-minh" };
    expect(serializeHabit(h).length).toBeLessThanOrEqual(HABIT_MAX_BYTES);
  });

  it("tỉ lệ chủ đề", () => {
    const h = recordRead(recordRead(recordRead(emptyHabit(), "nghe-ca"), "nghe-ca"), "kinh-te");
    const a = topicAffinity(h);
    expect(a["nghe-ca"]).toBeCloseTo(2 / 3);
    expect(recordRead(emptyHabit(), "lạ")).toEqual(emptyHabit());
  });
});

describe("xep-bai — xếp trong một trang", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  const p = (id: string, hoursAgo: number, over: Partial<RankablePost> = {}): RankablePost => ({
    id,
    topic: "thoi-su",
    publishedAt: new Date(now - hoursAgo * 3_600_000).toISOString(),
    pinnedUntil: null,
    regions: [],
    provinces: [],
    ports: [],
    ...over,
  });

  it("chưa có thói quen ⇒ giữ đúng thứ tự mới nhất", () => {
    const page = [p("a", 1), p("b", 2), p("c", 3)];
    expect(rankPage(page, emptyHabit(), now).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("bài ghim còn hạn luôn trên; ghim hết hạn thì như bài thường", () => {
    const pinned = p("g", 48, { pinnedUntil: new Date(now + 3_600_000).toISOString() });
    const expired = p("e", 48, { pinnedUntil: new Date(now - 1).toISOString() });
    const out = rankPage([p("a", 1), expired, pinned], emptyHabit(), now).map((x) => x.id);
    expect(out[0]).toBe("g");
    expect(out[out.length - 1]).toBe("e");
    expect(isPinned({ pinnedUntil: "hỏng" }, now)).toBe(false);
  });

  it("bài cảng nhà / chủ đề hay đọc được đẩy lên trên bài mới hơn một chút", () => {
    let h = setHome(emptyHabit(), { port: "sa-huynh", province: "quang-ngai" });
    for (let i = 0; i < 10; i++) h = recordRead(h, "nghe-ca");
    const page = [p("moi", 1), p("cang", 3, { ports: ["sa-huynh"] }), p("chude", 3, { topic: "nghe-ca" })];
    const out = rankPage(page, h, now).map((x) => x.id);
    expect(out.indexOf("cang")).toBeLessThan(out.indexOf("moi"));
    expect(out.indexOf("chude")).toBeLessThan(out.indexOf("moi"));
  });

  it("cảng > tỉnh > vùng", () => {
    const h = setHome(emptyHabit(), { port: "sa-huynh", province: "quang-ngai" });
    const s = (o: Partial<RankablePost>) => scorePost(p("x", 5, o), h, now);
    expect(s({ ports: ["sa-huynh"] })).toBeGreaterThan(s({ provinces: ["quang-ngai"] }));
    expect(s({ provinces: ["quang-ngai"] })).toBeGreaterThan(s({ regions: ["mien-trung"] }));
    expect(s({ regions: ["mien-trung"] })).toBeGreaterThan(s({ regions: ["tay-nam-bo"] }));
  });

  it("không thêm, không bớt bài", () => {
    const page = Array.from({ length: 20 }, (_, i) => p(`p${i}`, i, { topic: i % 2 ? "nghe-ca" : "the-thao" }));
    const out = rankPage(page, recordRead(emptyHabit(), "nghe-ca"), now);
    expect(out.map((x) => x.id).sort()).toEqual(page.map((x) => x.id).sort());
  });
});
