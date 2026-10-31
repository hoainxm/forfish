// Thẻ nổi quảng bá ở Bản đồ (2026-10-31): tối đa một lần mỗi 4 giờ trên một máy.
import { describe, expect, it } from "vitest";
import { CACH_MS, CHO_MS, HIEN_MS, toiLuotBanDo } from "@/components/quang-cao-noi";

describe("toiLuotBanDo", () => {
  it("chưa từng hiện ⇒ tới lượt; dưới 4 giờ ⇒ chưa; đủ 4 giờ ⇒ tới", () => {
    const now = 1_800_000_000_000;
    expect(toiLuotBanDo(undefined, now)).toBe(true);
    expect(toiLuotBanDo(now - CACH_MS + 1000, now)).toBe(false);
    expect(toiLuotBanDo(now - CACH_MS, now)).toBe(true);
  });
  it("nhịp hợp lý: chờ 20 s, hiện 7 s", () => {
    expect(CHO_MS).toBe(20_000);
    expect(HIEN_MS).toBeGreaterThanOrEqual(5_000);
    expect(HIEN_MS).toBeLessThanOrEqual(10_000);
  });
});
