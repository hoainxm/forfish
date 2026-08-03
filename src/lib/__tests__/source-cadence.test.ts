import { describe, expect, it } from "vitest";
import {
  nextReleaseAfter,
  isCacheCurrent,
  isDailyCacheCurrent,
  nextDailyReleaseAfter,
  OM_RELEASE_HOURS_UTC,
  MIN_REFETCH_MS,
  MAX_CACHE_MS,
  MAX_DAILY_CACHE_MS,
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

/* ═══ NGUỒN CHẠY THEO NGÀY (Copernicus: dòng chảy tầng sâu, độ mặn) ═══
   Cổng cho lỗi 2026-08-03: áp lịch 4-mốc-một-ngày của GFS lên nguồn ra bản MỘT
   LẦN/NGÀY ⇒ ngày bốn lượt vứt bản đang có, đi đốt 55 giây route live để nhận
   lại đúng con số cũ. */
describe("isDailyCacheCurrent — nguồn theo NGÀY", () => {
  it("bản cron sáng vẫn HIỆN HÀNH suốt chiều (chỗ isCacheCurrent xử oan)", () => {
    const saved = utc(29, 8, 51); // đúng giờ cron thật đã ghi curdepth:t50:d10
    const now = utc(29, 11, 30); // đã qua mốc GFS 10:00
    expect(isCacheCurrent(saved, now)).toBe(false); // luật cũ: kéo lại (oan)
    expect(isDailyCacheCurrent(saved, now)).toBe(true); // luật ngày: dùng luôn
  });

  it("qua mốc phát hành NGÀY (12:00 UTC) → mới phải kéo lại", () => {
    const saved = utc(29, 8, 51);
    expect(isDailyCacheCurrent(saved, utc(29, 12, 30))).toBe(false);
  });

  it("lưu SAU mốc ngày → giữ tới trưa hôm sau", () => {
    const saved = utc(29, 13);
    expect(isDailyCacheCurrent(saved, utc(30, 11))).toBe(true);
    expect(isDailyCacheCurrent(saved, utc(30, 12, 30))).toBe(false);
  });

  it("vừa lưu xong thì luôn dùng, khỏi tính mốc", () => {
    const saved = utc(29, 11, 50); // ngay trước mốc 12:00
    expect(isDailyCacheCurrent(saved, saved + MIN_REFETCH_MS - 60_000)).toBe(true);
  });

  it("quá trần 26 giờ → cứ thử lại dù tính mốc thế nào", () => {
    const saved = utc(29, 13);
    expect(isDailyCacheCurrent(saved, saved + MAX_DAILY_CACHE_MS + 1000)).toBe(false);
  });

  it("chưa có bản / mốc lỗi / đồng hồ chỉnh lùi → kéo lại", () => {
    expect(isDailyCacheCurrent(null, utc(29, 12))).toBe(false);
    expect(isDailyCacheCurrent(NaN, utc(29, 12))).toBe(false);
    expect(isDailyCacheCurrent(utc(30, 4), utc(29, 12))).toBe(false);
  });

  it("mốc ngày kế tiếp: đúng ngay mốc thì lấy mốc SAU nó", () => {
    expect(nextDailyReleaseAfter(utc(29, 12))).toBe(utc(30, 12));
    expect(nextDailyReleaseAfter(utc(29, 3))).toBe(utc(29, 12));
  });
});
