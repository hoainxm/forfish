// Nạp lib/voice/tts.ts ở máy chủ (prerender) KHÔNG được ném (2026-10-26): gói
// @capacitor-community/text-to-speech đụng `window` ngay lúc nạp ⇒ trước đây import
// tĩnh làm chết build `/cho/gio`, `/tien` (boat-switcher → hoi-tung-cau → tts).
// Môi trường node mặc định của vitest = không có window, đúng như lúc prerender.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tts.ts nạp được khi không có window", () => {
  it("import không ném, gói plugin native không bị kéo vào", async () => {
    expect(typeof window).toBe("undefined");
    const tts = await import("@/lib/voice/tts");
    expect(typeof tts.ttsSpeak).toBe("function");
    // không phải native ⇒ huỷ / mở màn cài là no-op, không nạp plugin, không ném
    expect(() => tts.ttsCancel()).not.toThrow();
    await expect(tts.ttsOpenInstall()).resolves.toBeUndefined();
  });

  // CỔNG: vitest nạp bản CJS của gói (không ném lúc import) còn Next dùng bản ESM
  // (`module`, có `'speechSynthesis' in window` lúc nạp) ⇒ test trên KHÔNG bắt được
  // việc ai đó import tĩnh trở lại. Soi thẳng mã nguồn: chỉ được `typeof import(…)`
  // (kiểu) và `import(…)` động.
  it("tts.ts không import giá trị tĩnh từ gói text-to-speech", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/voice/tts.ts"), "utf8");
    const tinh = src.match(/^\s*import\s+(?!type\b)[^;]*["']@capacitor-community\/text-to-speech["']/gm) ?? [];
    expect(tinh).toEqual([]);
  });
});
