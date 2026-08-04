import { describe, expect, it } from "vitest";
import {
  STORM_REFRESH_MS,
  STORM_RETRY_MS,
  STORM_RETRY_STEPS_MS,
  stormRetryMs,
} from "../use-storm-check";

/*
  CA THẬT (D-PH10, soát offline 2026-08-02): vòng hỏi tin bão trước đây hỏng là
  thử lại sau ĐÚNG 1 phút, MÃI MÃI — ~45–60 request/giờ suốt cả chuyến, mỗi lần
  đánh thức radio, tranh băng thông với chính bản tin bão đang chờ.

  Nhưng bão là AN TOÀN TÍNH MẠNG nên thang lùi không được lùi vô hạn: trần phải
  đúng bằng nhịp hỏi lúc khoẻ. Test khoá cả hai đầu.
*/
describe("stormRetryMs", () => {
  it("hỏng lần đầu → thử lại NHANH (1 phút)", () => {
    expect(stormRetryMs(1)).toBe(STORM_RETRY_MS);
  });

  it("hỏng liên tiếp → giãn dần, KHÔNG giữ 1 phút mãi", () => {
    expect(stormRetryMs(2)).toBeGreaterThan(stormRetryMs(1));
    expect(stormRetryMs(3)).toBeGreaterThan(stormRetryMs(2));
  });

  it("TRẦN đúng bằng nhịp lúc khoẻ — không bao giờ hỏi bão thưa hơn bình thường", () => {
    const cap = STORM_RETRY_STEPS_MS[STORM_RETRY_STEPS_MS.length - 1];
    expect(cap).toBe(STORM_REFRESH_MS);
    expect(stormRetryMs(99)).toBe(STORM_REFRESH_MS);
    expect(stormRetryMs(1000)).toBe(STORM_REFRESH_MS);
  });

  it("máy nói thẳng là MẤT MẠNG → về trần ngay (đừng đốt pin), vẫn còn nhịp", () => {
    expect(stormRetryMs(1, true)).toBe(STORM_REFRESH_MS);
    // vẫn là một con số hữu hạn: máy không bắn sự kiện `online` vẫn phải hỏi lại
    expect(Number.isFinite(stormRetryMs(1, true))).toBe(true);
  });

  it("số lần hỏng lạ/âm → nấc đầu, không NaN", () => {
    expect(stormRetryMs(0)).toBe(STORM_RETRY_MS);
    expect(stormRetryMs(-3)).toBe(STORM_RETRY_MS);
    expect(stormRetryMs(Number.NaN)).toBe(STORM_RETRY_MS);
  });
});
