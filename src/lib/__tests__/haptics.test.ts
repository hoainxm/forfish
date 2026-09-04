import { describe, it, expect, vi, afterEach } from "vitest";
import { HAZARD_VIBRATE, tapFeedback, vibratePattern } from "@/lib/haptics";

describe("haptics — vibratePattern bọc navigator.vibrate an toàn", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("máy có vibrate → gọi đúng mẫu, trả true", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    expect(vibratePattern(HAZARD_VIBRATE)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);
    tapFeedback(10);
    expect(vibrate).toHaveBeenLastCalledWith(10);
  });

  it("máy không có vibrate (iOS Safari, jsdom) → no-op, trả false, không ném", () => {
    vi.stubGlobal("navigator", {});
    expect(vibratePattern(HAZARD_VIBRATE)).toBe(false);
    expect(() => tapFeedback()).not.toThrow();
  });

  it("vibrate ném lỗi → nuốt, trả false", () => {
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("blocked");
      },
    });
    expect(vibratePattern([50])).toBe(false);
  });

  it("mẫu hiểm hoạ 2 nhịp 200 ms cách 100 ms — cùng hình với chuông A5–A5", () => {
    expect(HAZARD_VIBRATE).toEqual([200, 100, 200]);
  });
});
