// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  Lớp giọng đọc (lib/voice/tts.ts) — nhánh TRÌNH DUYỆT (jsdom = không phải
  native). Luật sống còn: máy KHÔNG có giọng Việt thì IM, tuyệt đối không đọc
  bằng giọng khác; `onEnd` luôn được gọi đúng một lần để hàng đợi không kẹt.
*/

type FakeUtter = { text: string; lang: string; voice: unknown; rate: number; onstart?: () => void; onend?: () => void; onerror?: () => void };

function installSynth(voices: { lang: string; localService: boolean; name: string }[]) {
  const spoken: FakeUtter[] = [];
  const synth = {
    getVoices: () => voices,
    addEventListener: () => {},
    cancel: vi.fn(),
    speak: (u: FakeUtter) => {
      spoken.push(u);
      if (u.text) {
        setTimeout(() => u.onstart?.(), 10);
        setTimeout(() => u.onend?.(), 50);
      }
    },
  };
  class Utter {
    text: string;
    lang = "";
    voice: unknown = null;
    rate = 1;
    onstart?: () => void;
    onend?: () => void;
    onerror?: () => void;
    constructor(t: string) {
      this.text = t;
    }
  }
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = Utter;
  // mp3 Sen Biển: không tải được trong test ⇒ đi giọng máy (đường mp3 có test riêng ở tts-voice.test)
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")));
  return { spoken, synth };
}

describe("tts — nhánh trình duyệt", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("không có giọng Việt: KHÔNG đọc giọng máy (kể cả có giọng Anh), onEnd gọi đúng 1 lần", async () => {
    const { spoken } = installSynth([{ lang: "en-US", localService: true, name: "Samantha" }]);
    const tts = await import("@/lib/voice/tts");
    const check = tts.ttsCheck();
    await vi.advanceTimersByTimeAsync(2000);
    // từ 2026-10-18 `ok` tính cả mp3 Mỹ Duyên — ở đây chỉ khẳng định KHÔNG có giọng máy
    expect((await check).giongMay).toBe(false);
    const onEnd = vi.fn();
    tts.ttsSpeak("Phía trước có xác tàu.", { onEnd });
    await vi.advanceTimersByTimeAsync(100);
    expect(spoken.filter((u) => u.text)).toHaveLength(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("có giọng Việt: đọc vi-VN bằng giọng Việt cài trong máy, tốc độ tự nhiên", async () => {
    const { spoken } = installSynth([
      { lang: "en-US", localService: true, name: "Samantha" },
      { lang: "vi-VN", localService: false, name: "Google tiếng Việt" },
      { lang: "vi_VN", localService: true, name: "Linh" },
    ]);
    const tts = await import("@/lib/voice/tts");
    expect((await tts.ttsCheck()).ok).toBe(true);
    const onEnd = vi.fn();
    tts.ttsSpeak("Phía trước có xác tàu.", { onEnd });
    await vi.advanceTimersByTimeAsync(100);
    const u = spoken.find((x) => x.text)!;
    expect(u.lang).toBe("vi-VN");
    expect((u.voice as { name: string }).name).toBe("Linh");
    expect(u.rate).toBe(tts.TTS_RATE);
    expect(tts.TTS_RATE).toBeLessThanOrEqual(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("engine im (không onstart; chỉ một giọng thì chờ 4 s): bỏ câu, onEnd vẫn gọi — hàng đợi không kẹt", async () => {
    const { synth } = installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    synth.speak = () => {}; // không bao giờ phát
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Còn chừng 6 hải lý tới ranh giới.", { onEnd });
    await vi.advanceTimersByTimeAsync(1600);
    expect(onEnd).not.toHaveBeenCalled(); // giọng duy nhất: cho khởi động lâu hơn (lỗi 2026-10-18)
    await vi.advanceTimersByTimeAsync(2500);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("huỷ giữa chừng: onEnd đúng 1 lần dù engine còn bắn onend sau", async () => {
    installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    const cancel = tts.ttsSpeak("Mất định vị. Máy đang tìm lại.", { onEnd });
    await vi.advanceTimersByTimeAsync(20);
    cancel();
    await vi.advanceTimersByTimeAsync(200);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("không có Web Speech (Android WebView): không có giọng máy, vẫn đọc được bằng mp3; không ném", async () => {
    Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
    delete (window as unknown as Record<string, unknown>).speechSynthesis;
    const tts = await import("@/lib/voice/tts");
    const a = await tts.ttsCheck();
    expect(a).toMatchObject({ giongMay: false, native: false, canInstall: false });
    expect(a.ok).toBe(typeof Audio !== "undefined");
    const onEnd = vi.fn();
    expect(() => tts.ttsSpeak("x", { onEnd })).not.toThrow();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
