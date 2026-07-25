import { describe, expect, it } from "vitest";
import {
  BASEMAP_FAIL_LIMIT,
  nextFailCount,
  offlineBasemapNote,
  shouldUseOfflineBasemap,
} from "../offline-basemap";

describe("shouldUseOfflineBasemap", () => {
  it("có sóng, nền tải được → KHÔNG vẽ nền trong máy (đỡ rối)", () => {
    expect(shouldUseOfflineBasemap({ online: true, fails: 0 })).toBe(false);
  });

  it("máy báo mất mạng → bật ngay, không bắt chờ đủ ô lỗi", () => {
    expect(shouldUseOfflineBasemap({ online: false, fails: 0 })).toBe(true);
  });

  it("máy báo có mạng nhưng ô nền cứ trượt → bật khi đủ ngưỡng", () => {
    expect(
      shouldUseOfflineBasemap({ online: true, fails: BASEMAP_FAIL_LIMIT - 1 }),
    ).toBe(false);
    expect(
      shouldUseOfflineBasemap({ online: true, fails: BASEMAP_FAIL_LIMIT }),
    ).toBe(true);
  });
});

describe("nextFailCount", () => {
  it("tải được thì về 0, trượt thì cộng dồn", () => {
    expect(nextFailCount(0, false)).toBe(1);
    expect(nextFailCount(5, false)).toBe(6);
    expect(nextFailCount(9, true)).toBe(0);
  });
});

describe("offlineBasemapNote", () => {
  it("bình thường thì im lặng", () => {
    expect(offlineBasemapNote({ online: true, fails: 0 })).toBeNull();
  });

  it("nói việc, KHÔNG dùng từ kỹ thuật", () => {
    const off = offlineBasemapNote({ online: false, fails: 0 })!;
    const weak = offlineBasemapNote({ online: true, fails: 9 })!;
    expect(off).toContain("Mất sóng");
    expect(weak).toContain("Mạng yếu");
    for (const s of [off, weak]) {
      for (const jargon of ["tile", "offline", "cache", "basemap", "GeoJSON"]) {
        expect(s.toLowerCase()).not.toContain(jargon.toLowerCase());
      }
    }
  });
});
