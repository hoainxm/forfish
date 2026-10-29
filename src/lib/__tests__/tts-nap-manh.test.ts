// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import manhThat from "@/data/giong-sen-bien-manh.json";

/*
  DANH MỤC MẢNH GIỌNG NẠP ĐỘNG (2026-10-29, rà soát tốc độ D): giong-sen-bien-manh.json
  (113 KB, gzip ~30 KB) từng nằm trong first-load của 5 màn qua import tĩnh ở tts.ts.
  Nay `napManhGiong()` nạp lúc cần đọc lần đầu. Luật giữ nguyên:
  · trước khi nạp: câu nguyên vẫn mp3, câu cần ghép mảnh đọc giọng máy (không ném)
  · nạp hỏng ⇒ false, lần sau thử lại (không kẹt lỗi); nhiều lời gọi cùng lúc ⇒ một lượt nạp
  · ttsSpeak câu đầu tiên CHỜ danh mục rồi mới cắt câu ⇒ vẫn trọn giọng Sen Biển như trước
*/

const CAU_MANH = "Còn 3 hải lý."; // không có mp3 nguyên câu, chỉ phủ bằng mảnh

describe("napManhGiong — đường nạp danh mục mảnh", () => {
  beforeEach(() => vi.resetModules());

  it("chưa nạp: câu cần mảnh đọc giọng máy; nạp xong: trọn mảnh mp3", async () => {
    const tts = await import("@/lib/voice/tts");
    expect(tts.manhDaNap()).toBe(false);
    expect(tts.speechParts(CAU_MANH).every((p) => p.clips === null)).toBe(true);
    // câu nguyên (danh mục tĩnh) không phụ thuộc danh mục mảnh
    expect(tts.clipFor("bật tiếng lại")).not.toBeNull();
    expect(await tts.napManhGiong()).toBe(true);
    expect(tts.manhDaNap()).toBe(true);
    expect(tts.speechParts(CAU_MANH).every((p) => p.clips?.length)).toBe(true);
    expect(tts.allClipUrls().length).toBeGreaterThan(1000);
  });

  it("nạp hỏng ⇒ false, không ném; lần sau thử lại được", async () => {
    const tts = await import("@/lib/voice/tts");
    const hong = vi.fn(() => Promise.reject(new Error("mất chunk")));
    expect(await tts.napManhGiong(hong)).toBe(false);
    expect(tts.manhDaNap()).toBe(false);
    const tot = vi.fn(() => Promise.resolve({ default: manhThat as unknown }));
    expect(await tts.napManhGiong(tot)).toBe(true);
    expect(tot).toHaveBeenCalledTimes(1);
  });

  it("gọi chồng nhiều lần cùng lúc ⇒ một lượt nạp; đã nạp thì không nạp lại", async () => {
    const tts = await import("@/lib/voice/tts");
    const nap = vi.fn(() => Promise.resolve({ default: manhThat as unknown }));
    const [a, b] = await Promise.all([tts.napManhGiong(nap), tts.napManhGiong(nap)]);
    expect([a, b]).toEqual([true, true]);
    expect(await tts.napManhGiong(nap)).toBe(true);
    expect(nap).toHaveBeenCalledTimes(1);
  });

  it("CỔNG: tts.ts không import tĩnh danh mục mảnh (sẽ quay lại first-load 5 màn)", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/voice/tts.ts"), "utf8");
    expect(src).not.toMatch(/^\s*import\s+\w+\s+from\s+["']@\/data\/giong-sen-bien-manh\.json["']/m);
  });
});
// ttsSpeak câu đầu tiên khi chưa nạp: xem tts-voice.test.ts ("câu ĐẦU TIÊN của phiên…")
