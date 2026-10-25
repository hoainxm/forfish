import { describe, expect, it } from "vitest";
import { cat, GIU_CHO_TUOI_MS, lay, xoa } from "@/lib/kairos/giu-cho";

describe("kairos giu-cho — giữ chỗ đang đọc trong bộ nhớ", () => {
  it("còn hạn ⇒ trả đúng ảnh chụp", () => {
    cat("feed:", { scrollY: 840, at: 1_000 });
    expect(lay<{ scrollY: number }>("feed:", 1_000 + 60_000)?.scrollY).toBe(840);
  });

  it("quá hạn ⇒ null và bị xoá", () => {
    cat("feed:a", { scrollY: 10, at: 1_000 });
    expect(lay("feed:a", 1_000 + GIU_CHO_TUOI_MS + 1)).toBeNull();
    expect(lay("feed:a", 1_000)).toBeNull();
  });

  it("tuổi tối đa tuỳ chỉnh + giờ máy lùi ⇒ null", () => {
    cat("feed:b", { at: 5_000 });
    expect(lay("feed:b", 5_500, 1_000)).not.toBeNull();
    expect(lay("feed:b", 4_000)).toBeNull();
  });

  it("khoá khác nhau không lẫn; xoa chỉ xoá khoá đó", () => {
    cat("feed:", { scrollY: 1, at: 1 });
    cat("feed:cang-x", { scrollY: 2, at: 1 });
    expect(lay<{ scrollY: number }>("feed:cang-x", 2)?.scrollY).toBe(2);
    xoa("feed:cang-x");
    expect(lay("feed:cang-x", 2)).toBeNull();
    expect(lay<{ scrollY: number }>("feed:", 2)?.scrollY).toBe(1);
    expect(lay("feed:khac", 2)).toBeNull();
  });
});
