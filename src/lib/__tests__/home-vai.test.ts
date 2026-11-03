import { describe, expect, it } from "vitest";

import { caDangBan } from "@/lib/home-vai";
import type { MarketListing } from "@/lib/market-listings-core";

const tin = (p: Partial<MarketListing> & { id: string }): MarketListing => ({
  side: "ban",
  posterKind: "ngu-dan",
  posterName: "Tàu",
  species: "Cá ngừ",
  status: "open",
  postedOn: "2026-11-01",
  ...p,
});

describe("cá đang bán gần cảng — trang chủ vai Thu mua (spec 17 §4.2)", () => {
  it("chỉ tin bán đang mở, bỏ tin của mình", () => {
    const r = caDangBan(
      [
        tin({ id: "a" }),
        tin({ id: "b", side: "mua" }),
        tin({ id: "c", status: "closed" }),
        tin({ id: "d", mine: true }),
      ],
      undefined,
    );
    expect(r.map((l) => l.id)).toEqual(["a"]);
  });
  it("cùng tỉnh cảng nhà lên trước (không phân biệt dấu/hoa), rồi tin mới trước", () => {
    const r = caDangBan(
      [
        tin({ id: "xa-moi", province: "Bình Định", postedOn: "2026-11-03" }),
        tin({ id: "gan-cu", province: "Quảng Ngãi", postedOn: "2026-10-30" }),
        tin({ id: "gan-moi", province: "quang  ngai", postedOn: "2026-11-02" }),
      ],
      "Quảng Ngãi",
    );
    expect(r.map((l) => l.id)).toEqual(["gan-moi", "gan-cu", "xa-moi"]);
  });
  it("chưa khai cảng ⇒ chỉ theo ngày; trần n tin", () => {
    const ds = Array.from({ length: 8 }, (_, i) => tin({ id: `t${i}`, postedOn: `2026-10-0${i + 1}` }));
    const r = caDangBan(ds, undefined);
    expect(r).toHaveLength(5);
    expect(r[0].id).toBe("t7");
    expect(caDangBan(ds, undefined, 0)).toEqual([]);
  });
});
