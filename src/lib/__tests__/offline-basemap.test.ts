import { describe, expect, it } from "vitest";
import {
  BASEMAP_FAIL_LIMIT,
  BASEMAP_SILENT_MS,
  basemapIsSilent,
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

  // Ca C-6 — "sóng sống mà chết": máy tưởng có mạng, ô nền treo nên KHÔNG bao
  // giờ báo lỗi ⇒ hai vế trên đều im. Không có vế này thì hình bờ + đảo đã nằm
  // sẵn trong máy không bao giờ được vẽ, bà con mất định hướng giữa biển.
  it("ô nền im lặng quá lâu (treo, không báo lỗi) → vẫn phải bật", () => {
    expect(
      shouldUseOfflineBasemap({ online: true, fails: 0, silent: true }),
    ).toBe(true);
  });

  it("ô nền im lặng = false → giữ nguyên hai vế cũ", () => {
    expect(
      shouldUseOfflineBasemap({ online: true, fails: 0, silent: false }),
    ).toBe(false);
    expect(
      shouldUseOfflineBasemap({ online: false, fails: 0, silent: false }),
    ).toBe(true);
  });

  it("hằng số im lặng đủ dài để không bật nhầm lúc mạng chỉ chậm", () => {
    expect(BASEMAP_SILENT_MS).toBeGreaterThanOrEqual(5000);
    expect(BASEMAP_SILENT_MS).toBeLessThanOrEqual(15000);
  });
});

/* LỖI 1 (soát chéo 2026-08-02) — đồng hồ im lặng phải bấm từ lúc bản đồ THẬT
   SỰ xin ô nền, không phải từ lúc mở màn. Bấm sai mốc = dương tính giả: ở 3G
   cảng, MapLibre lazy-load ngốn gần hết 9 giây trước request đầu tiên ⇒ giây 9
   bật hình bờ kèm câu "Mạng yếu" (SAI SỰ THẬT), giây 12 ô về thì tắt. */
describe("basemapIsSilent", () => {
  it("CHƯA xin ô nền lần nào (askedAt null) → KHÔNG bao giờ là im lặng", () => {
    expect(basemapIsSilent(null, false, 1_000_000)).toBe(false);
    // dù đồng hồ máy đã chạy rất lâu kể từ lúc mở màn
    expect(basemapIsSilent(null, false, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it("đã có ô nền về → không im lặng, dù chờ bao lâu", () => {
    expect(basemapIsSilent(0, true, BASEMAP_SILENT_MS * 10)).toBe(false);
  });

  it("xin ô rồi im: chưa hết ngân sách thì chưa kết luận", () => {
    expect(basemapIsSilent(1000, false, 1000 + BASEMAP_SILENT_MS - 1)).toBe(
      false,
    );
    expect(basemapIsSilent(1000, false, 1000 + BASEMAP_SILENT_MS)).toBe(true);
  });

  it("ngân sách đếm TỪ LÚC XIN Ô, không phải từ mốc 0 của màn hình", () => {
    // mở màn ở t=0, mãi t=8000 bản đồ mới xin được ô đầu tiên (3G cảng)
    const askedAt = 8000;
    // t=9000: mốc CŨ (mount) đã kêu "mạng yếu" — mốc đúng thì chưa
    expect(basemapIsSilent(askedAt, false, 9000)).toBe(false);
    expect(basemapIsSilent(askedAt, false, askedAt + BASEMAP_SILENT_MS)).toBe(
      true,
    );
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

  it("nói việc, KHÔNG dùng từ kỹ thuật, và KHÔNG phán về mạng của bà con", () => {
    const off = offlineBasemapNote({ online: false, fails: 0 })!;
    const weak = offlineBasemapNote({ online: true, fails: 9 })!;
    expect(off).toContain("Mất sóng");
    /*  ĐỔI CHIỀU 2026-08-18 (chủ dự án bắt trên máy thật: "t vào internet ầm ầm
        mà mạng yếu gì?"). Bản cũ khoá lại chữ "Mạng yếu" — một điều app KHÔNG
        BIẾT: thứ nó quan sát được chỉ là ô nền không về, mà ô nền lấy từ host
        NGOÀI (cartocdn) nên CDN chậm/ISP lọc cũng ra đúng triệu chứng đó trong
        khi mạng bà con vẫn nhanh. Nói sai nguyên nhân thì bà con đi sửa nhầm
        chỗ và mất lòng tin vào mọi cảnh báo khác của app, kể cả cảnh báo bão.
        Nay câu chữ chỉ nói THỨ THẤY ĐƯỢC + HỆ QUẢ. */
    expect(weak).not.toContain("Mạng yếu");
    expect(weak).toContain("nền bản đồ");
    expect(weak).toContain("lưu trong máy");
    for (const s of [off, weak]) {
      for (const jargon of ["tile", "offline", "cache", "basemap", "GeoJSON"]) {
        expect(s.toLowerCase()).not.toContain(jargon.toLowerCase());
      }
    }
  });

  it("CHƯA có hình bờ trong máy thì KHÔNG được khoe 'đang dùng bản đồ lưu trong máy' (M6)", () => {
    const off = offlineBasemapNote({ online: false, fails: 0 }, false)!;
    const weak = offlineBasemapNote({ online: true, fails: 9 }, false)!;
    for (const s of [off, weak]) {
      expect(s).not.toContain("lưu trong máy");
      expect(s).toContain("Chưa tải được nền bản đồ");
    }
    expect(off).toContain("không có sóng");
    expect(weak).not.toContain("sóng"); // online mà đổ cho sóng là phán bừa
    // có bờ rồi thì câu cũ giữ nguyên
    expect(offlineBasemapNote({ online: false, fails: 0 }, true)).toContain(
      "lưu trong máy",
    );
    // bình thường vẫn im dù chưa có bờ
    expect(offlineBasemapNote({ online: true, fails: 0 }, false)).toBeNull();
  });
});
