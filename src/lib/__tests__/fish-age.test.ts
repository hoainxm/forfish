import { describe, expect, it } from "vitest";
import { fishForecastAge, FISH_STALE_DAYS } from "../fish-age";

// 25/7/2026 lúc 10:00 giờ VN = 03:00Z
const NOW = Date.parse("2026-07-25T03:00:00Z");
const iso = (s: string) => Date.parse(s);

/*
  LỖI đã sửa: bản đồ cá được service worker giữ lại (network-first) nên mất sóng
  vẫn vẽ điểm nóng — mà payload không có mốc nào, bản 10 ngày trước trông y hệt
  bản mới. `date` (ngày ẢNH) và `generatedAt` (lúc TÍNH/lấy về) là HAI thứ khác.
*/
describe("fishForecastAge — ảnh ngày nào vs lấy về lúc nào", () => {
  it("bản vừa lấy: ảnh trễ 2 ngày (bình thường) → không cảnh báo", () => {
    const a = fishForecastAge(
      { date: "2026-07-23", generatedAt: "2026-07-25T02:30:00Z" },
      NOW,
    );
    expect(a.imageDays).toBe(2);
    expect(a.warn).toBe(false);
    expect(a.label).toBe("Ảnh ngày 23/7 (2 ngày trước) · lấy về 09:30 ngày 25/7");
  });

  it("ảnh hôm nay → không kèm '(… ngày trước)'", () => {
    const a = fishForecastAge(
      { date: "2026-07-25", generatedAt: "2026-07-25T00:15:00Z" },
      NOW,
    );
    expect(a.imageDays).toBe(0);
    expect(a.label).toBe("Ảnh ngày 25/7 · lấy về 07:15 ngày 25/7");
  });

  it("ngày thứ 10 của chuyến: ảnh 12 ngày tuổi → CẢNH BÁO, nói rõ tuổi", () => {
    const a = fishForecastAge(
      { date: "2026-07-13", generatedAt: "2026-07-15T02:00:00Z" },
      NOW,
    );
    expect(a.imageDays).toBe(12);
    expect(a.warn).toBe(true);
    expect(a.label).toContain("(12 ngày trước)");
    expect(a.label).toContain("lấy về 09:00 ngày 15/7");
  });

  it("ngưỡng cảnh báo đúng bằng FISH_STALE_DAYS (5 ngày chưa kêu, 6 ngày kêu)", () => {
    const at = (d: string) =>
      fishForecastAge({ date: d, generatedAt: "2026-07-25T02:00:00Z" }, NOW);
    // 5 = mức đo được còn tin cậy (tương quan không gian ~0.976 ở lead 5 ngày,
    // xem scripts/fish-plankton-*.mjs); quá đó là ngoài vùng đã đo → phải kêu.
    expect(FISH_STALE_DAYS).toBe(5);
    expect(at("2026-07-20").imageDays).toBe(5);
    expect(at("2026-07-20").warn).toBe(false);
    expect(at("2026-07-19").imageDays).toBe(6);
    expect(at("2026-07-19").warn).toBe(true);
  });

  it("bản cũ KHÔNG có generatedAt → nói thẳng 'chưa rõ lấy về lúc nào', không đoán là mới", () => {
    const a = fishForecastAge({ date: "2026-07-24" }, NOW);
    expect(a.fetchedAtMs).toBeNull();
    expect(a.label).toContain("chưa rõ lấy về lúc nào");
    expect(a.warn).toBe(false); // ảnh vẫn mới → không hù doạ oan
  });

  it("generatedAt rác → coi như không biết, KHÔNG văng lỗi giữa biển", () => {
    const a = fishForecastAge(
      { date: "2026-07-24", generatedAt: "hôm nọ" },
      NOW,
    );
    expect(a.fetchedAtMs).toBeNull();
    expect(a.label).toContain("chưa rõ lấy về lúc nào");
  });

  it("ngày ảnh hỏng → cảnh báo (không có gì bảo đảm thì phải nói)", () => {
    const a = fishForecastAge({ date: "" }, NOW);
    expect(a.imageDays).toBeNull();
    expect(a.warn).toBe(true);
    expect(a.label).toContain("Chưa rõ ảnh ngày nào");
  });

  it("mốc giờ đọc theo GIỜ VIỆT NAM, không theo múi giờ máy", () => {
    // 17:30Z = 00:30 ngày hôm sau ở VN
    const a = fishForecastAge(
      { date: "2026-07-24", generatedAt: "2026-07-24T17:30:00Z" },
      iso("2026-07-25T03:00:00Z"),
    );
    expect(a.label).toContain("lấy về 00:30 ngày 25/7");
  });
});
