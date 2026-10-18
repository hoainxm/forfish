import { describe, expect, it } from "vitest";

import { fixQuaCu, STALE_DUNG_MS, STALE_MS } from "@/lib/use-nav-tracking";

// LỖI 2026-10-18 (iPhone): đứng yên ⇒ fix thưa ⇒ báo "Mất định vị" dù vừa có toạ độ.
describe("fixQuaCu — bao lâu không có fix mới thì là mất định vị", () => {
  const t0 = 1_000_000;
  it("chưa từng có fix ⇒ không nói mất (đang tìm lần đầu là trạng thái khác)", () =>
    expect(fixQuaCu(null, null, t0)).toBe(false));
  it("đang chạy: quá 10 s là mất", () => {
    expect(fixQuaCu(t0, 12, t0 + STALE_MS - 1)).toBe(false);
    expect(fixQuaCu(t0, 12, t0 + STALE_MS + 1)).toBe(true);
  });
  it("đứng yên: 30 s chưa có fix mới vẫn là đang theo dõi, quá 60 s mới mất", () => {
    expect(fixQuaCu(t0, null, t0 + 30_000)).toBe(false);
    expect(fixQuaCu(t0, null, t0 + STALE_DUNG_MS + 1)).toBe(true);
  });
});
