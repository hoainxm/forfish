import { describe, expect, it } from "vitest";
import { toCachedPost } from "@/lib/kairos/cache";
import type { KairosPost } from "@/lib/kairos/types";

const base = (id: string, over: Partial<KairosPost> = {}): KairosPost => ({
  id,
  kind: "ba-con",
  author: null,
  outlet: null,
  url: null,
  title: null,
  body: "Biển êm",
  summary: null,
  summaryBy: null,
  coverUrl: "https://x/c.jpg",
  images: [],
  topic: "nghe-ca",
  regions: [],
  provinces: [],
  ports: [],
  reshareOf: null,
  pinnedUntil: null,
  hayCount: 0,
  commentCount: 0,
  hayByMe: false,
  topComments: [],
  publishedAt: "2026-10-24T00:00:00Z",
  editedAt: null,
  mine: false,
  ...over,
});

// thẻ bài gốc trong bài đăng lại mất sóng phải còn đủ số ảnh để hiện "Có N ảnh — cần sóng" (post-card Reshare)
describe("toCachedPost — bài gốc đăng lại giữ số ảnh", () => {
  it("ảnh bài gốc bỏ, imageCount còn", () => {
    const c = toCachedPost(base("b", { reshareOf: base("a", { images: ["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg"] }) }));
    expect(c.reshareOf?.images).toEqual([]);
    expect(c.reshareOf?.imageCount).toBe(3);
    expect(c.reshareOf?.coverUrl).toBeNull();
  });
  it("lưu lại lần hai (bản đã lưu) không mất imageCount", () => {
    const once = toCachedPost(base("b", { reshareOf: base("a", { images: ["https://x/1.jpg"] }) }));
    expect(toCachedPost(once).reshareOf?.imageCount).toBe(1);
  });
});
