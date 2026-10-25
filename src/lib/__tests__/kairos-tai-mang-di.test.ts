import { describe, expect, it } from "vitest";
import {
  nenGoiY,
  parseAnDen,
  serializeAnDen,
  soBaiConLuu,
  songTot,
  taiNhieuTrang,
  TMD_AN_MS,
  TMD_CU_MS,
  TMD_IT_BAI,
  TMD_TRANG,
} from "@/lib/kairos/tai-mang-di";
import type { FeedPage, NetResult } from "@/lib/kairos/feed-client";
import { CACHE_MAX_BYTES, mergeAndTrim } from "@/lib/kairos/cache";
import type { KairosPost } from "@/lib/kairos/types";

const now = Date.parse("2026-10-24T08:00:00Z");
const p = (id: string, over: Partial<KairosPost> = {}): KairosPost => ({
  id,
  kind: "bao",
  author: null,
  outlet: "VnExpress",
  url: `https://vnexpress.net/${id}.html`,
  title: "Ngư dân Quảng Ngãi trúng đậm cá ngừ đại dương sau chuyến biển dài ngày",
  body: "",
  summary: "Tàu cá của ngư dân xã Bình Châu cập cảng Sa Huỳnh với gần 3 tấn cá ngừ đại dương, giá bán tăng so với tuần trước. ".repeat(3),
  summaryBy: "ai",
  coverUrl: "https://i.vnecdn.net/c.jpg",
  images: [],
  topic: "nghe-ca",
  regions: ["mien-trung"],
  provinces: ["quang-ngai"],
  ports: [],
  reshareOf: null,
  pinnedUntil: null,
  hayCount: 3,
  commentCount: 0,
  hayByMe: false,
  topComments: [],
  publishedAt: new Date(now - Number(id.replace(/\D/g, "")) * 60_000).toISOString(),
  editedAt: null,
  mine: false,
  ...over,
});

describe("songTot — chỉ gợi ý khi sóng đủ", () => {
  it("mất sóng / tiết kiệm dữ liệu / 2G ⇒ không; không biết loại mạng (Safari) ⇒ có", () => {
    expect(songTot(null)).toBe(false);
    expect(songTot({ onLine: false })).toBe(false);
    expect(songTot({ onLine: true, connection: { saveData: true, effectiveType: "4g" } })).toBe(false);
    expect(songTot({ onLine: true, connection: { effectiveType: "2g" } })).toBe(false);
    expect(songTot({ onLine: true, connection: { effectiveType: "slow-2g" } })).toBe(false);
    expect(songTot({ onLine: true, connection: { effectiveType: "3g" } })).toBe(true);
    expect(songTot({ onLine: true, connection: { effectiveType: "4g" } })).toBe(true);
    expect(songTot({ onLine: true })).toBe(true);
  });
});

describe("nenGoiY — bản lưu cũ > 6 giờ hoặc < 40 bài, trừ khi đang Để sau", () => {
  const base = { songTot: true, savedAt: now - 60_000, soBai: 100, anDen: 0, now };
  it("bản lưu mới + đủ bài ⇒ không gợi ý", () => {
    expect(nenGoiY(base)).toBe(false);
  });
  it("cũ hơn 6 giờ / chưa có bản lưu / ít hơn 40 bài ⇒ gợi ý", () => {
    expect(nenGoiY({ ...base, savedAt: now - TMD_CU_MS - 1 })).toBe(true);
    expect(nenGoiY({ ...base, savedAt: null })).toBe(true);
    expect(nenGoiY({ ...base, soBai: TMD_IT_BAI - 1 })).toBe(true);
    expect(nenGoiY({ ...base, soBai: TMD_IT_BAI })).toBe(false);
  });
  it("sóng yếu / đang trong 24 giờ Để sau ⇒ không", () => {
    expect(nenGoiY({ ...base, savedAt: null, songTot: false })).toBe(false);
    expect(nenGoiY({ ...base, savedAt: null, anDen: now + 1 })).toBe(false);
    expect(nenGoiY({ ...base, savedAt: null, anDen: now })).toBe(true);
  });
  it("mốc Để sau: ẩn đúng 24 giờ; hỏng ⇒ 0", () => {
    expect(parseAnDen(serializeAnDen(now))).toBe(now + TMD_AN_MS);
    expect(parseAnDen(null)).toBe(0);
    expect(parseAnDen("{hỏng")).toBe(0);
    expect(parseAnDen(JSON.stringify({ an: "mai" }))).toBe(0);
  });
});

const page = (ids: string[], next: string | null, pinned: string[] = []): NetResult<FeedPage> => ({
  kind: "ok",
  value: { posts: ids.map((i) => p(i)), pinned: pinned.map((i) => p(i)), next, at: new Date(now).toISOString() },
});

describe("taiNhieuTrang — tối đa 5 trang, hỏng giữa chừng giữ phần đã có", () => {
  it("dừng ở 5 trang dù còn trang", async () => {
    const calls: (string | null)[] = [];
    const r = await taiNhieuTrang(async (c) => {
      calls.push(c);
      const n = calls.length;
      return page([`a${n}1`, `a${n}2`], `c${n}`);
    });
    expect(calls).toEqual([null, "c1", "c2", "c3", "c4"]);
    expect(r).toMatchObject({ kind: "ok", trang: TMD_TRANG, het: false });
    if (r.kind === "ok") expect(r.posts).toHaveLength(10);
  });
  it("hết trang sớm ⇒ dừng; bài ghim lọt trang sau chỉ giữ một", async () => {
    let n = 0;
    const r = await taiNhieuTrang(async () => (++n === 1 ? page(["x1"], "c1", ["g1"]) : page(["g1", "x2"], null)));
    expect(r).toMatchObject({ kind: "ok", trang: 2, het: true });
    if (r.kind === "ok") expect(r.posts.map((x) => x.id)).toEqual(["g1", "x1", "x2"]);
  });
  it("trang đầu mất sóng / lỗi ⇒ trả đúng lỗi đó", async () => {
    expect(await taiNhieuTrang(async () => ({ kind: "offline" }))).toEqual({ kind: "offline" });
    expect(await taiNhieuTrang(async () => ({ kind: "error", status: 500 }))).toEqual({ kind: "error", status: 500 });
  });
  it("trang 3 mất sóng ⇒ giữ 2 trang đã có", async () => {
    let n = 0;
    const r = await taiNhieuTrang(async () => (++n <= 2 ? page([`b${n}`], `c${n}`) : { kind: "offline" }));
    expect(r).toMatchObject({ kind: "ok", trang: 2, het: false });
  });
});

describe("gộp 100 bài mang đi vào bản lưu — trần 200 bài / 400 KB", () => {
  it("100 bài báo mới + 150 bài cũ ⇒ còn ≤200 bài, ≤400 KB, đủ cả 100 bài mới", () => {
    const old = Array.from({ length: 150 }, (_, i) => p(`o${200 + i}`));
    const fresh = Array.from({ length: 100 }, (_, i) => p(`n${i + 1}`));
    const merged = mergeAndTrim(mergeAndTrim([], old), fresh);
    expect(merged.length).toBeLessThanOrEqual(200);
    expect(new TextEncoder().encode(JSON.stringify(merged)).length).toBeLessThanOrEqual(CACHE_MAX_BYTES);
    expect(soBaiConLuu(fresh, merged)).toBe(100);
  });
  it("soBaiConLuu đếm đúng bài vừa tải còn nằm trong bản lưu", () => {
    expect(soBaiConLuu([p("n1"), p("n2")], [p("n2"), p("o9")])).toBe(1);
  });
});
