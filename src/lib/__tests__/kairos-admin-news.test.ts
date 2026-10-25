import { describe, it, expect } from "vitest";
import { NEWS_STALE_MS, newsStaleText } from "@/lib/kairos/admin-action";

const NOW = Date.parse("2026-10-23T15:00:00Z");

describe("tab quản trị Kairos — nhắc khi máy thu tin im", () => {
  it("chưa từng có bài ⇒ nhắc", () => {
    expect(newsStaleText(null, NOW)).toMatch(/Chưa nhận được bài báo nào/);
  });
  it("dưới 2 giờ ⇒ không nhắc; đúng 2 giờ ⇒ nhắc theo giờ; ≥48 giờ ⇒ nói theo ngày", () => {
    expect(newsStaleText(new Date(NOW - NEWS_STALE_MS + 1000).toISOString(), NOW)).toBeNull();
    expect(newsStaleText(new Date(NOW - NEWS_STALE_MS).toISOString(), NOW)).toMatch(/^Đã 2 giờ không có bài báo mới/);
    expect(newsStaleText(new Date(NOW - 3 * 86_400_000).toISOString(), NOW)).toMatch(/^Đã 3 ngày/);
  });
  it("giờ hỏng ⇒ không nhắc (không báo động giả)", () => {
    expect(newsStaleText("rác", NOW)).toBeNull();
  });
});
