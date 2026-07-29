import { describe, expect, it } from "vitest";
import {
  nextReleaseAfter,
  isCacheCurrent,
  OM_RELEASE_HOURS_UTC,
  MIN_REFETCH_MS,
  MAX_CACHE_MS,
} from "../source-cadence";

const H = 60 * 60 * 1000;
const utc = (d: number, h: number, m = 0) => Date.UTC(2026, 6, d, h, m, 0, 0);

describe("nextReleaseAfter — mốc bản tin kế tiếp (GFS + độ trễ phát hành)", () => {
  it("giữa hai mốc → mốc kế tiếp trong ngày", () => {
    expect(nextReleaseAfter(utc(29, 5))).toBe(utc(29, 10));
    expect(nextReleaseAfter(utc(29, 11, 30))).toBe(utc(29, 16));
  });

  it("sau mốc cuối ngày → mốc đầu ngày mai", () => {
    expect(nextReleaseAfter(utc(29, 23))).toBe(utc(30, 4));
  });

  it("đúng ngay mốc → lấy mốc SAU nó (không tự trả chính nó)", () => {
    expect(nextReleaseAfter(utc(29, 10))).toBe(utc(29, 16));
  });

  it("4 mốc/ngày, cách đều 6 giờ", () => {
    expect([...OM_RELEASE_HOURS_UTC]).toEqual([4, 10, 16, 22]);
  });
});

describe("isCacheCurrent — có cần gọi lại nguồn không", () => {
  it("vừa tải xong (dưới sàn MIN_REFETCH_MS) → DÙNG cache, dù vừa qua mốc", () => {
    const saved = utc(29, 3, 50); // ngay trước mốc 04:00
    const now = saved + MIN_REFETCH_MS - 60_000;
    expect(isCacheCurrent(saved, now)).toBe(true);
  });

  it("lưu sau mốc, CHƯA tới mốc kế → DÙNG cache (nguồn chưa có số mới)", () => {
    const saved = utc(29, 4, 30);
    expect(isCacheCurrent(saved, utc(29, 9, 30))).toBe(true);
  });

  it("đã qua mốc phát hành kế tiếp → PHẢI gọi lại", () => {
    const saved = utc(29, 4, 30);
    expect(isCacheCurrent(saved, utc(29, 10, 15))).toBe(false);
  });

  it("quá MAX_CACHE_MS → gọi lại dù tính mốc thế nào", () => {
    const saved = utc(29, 4);
    expect(isCacheCurrent(saved, saved + MAX_CACHE_MS + 1000)).toBe(false);
  });

  it("chưa có bản lưu / mốc lỗi → gọi lại", () => {
    expect(isCacheCurrent(null, utc(29, 12))).toBe(false);
    expect(isCacheCurrent(undefined, utc(29, 12))).toBe(false);
    expect(isCacheCurrent(NaN, utc(29, 12))).toBe(false);
  });

  it("mốc lưu ở TƯƠNG LAI (đồng hồ máy chỉnh lùi) → gọi lại, không kẹt vĩnh viễn", () => {
    expect(isCacheCurrent(utc(30, 4), utc(29, 12))).toBe(false);
  });
});
