import { describe, expect, it } from "vitest";
import { phienPhat } from "@/lib/voice/tts";

// Mở micro đổi phiên sang "play-and-record" (sen-bien/nghe phienThuAm); iPhone phát tiếng ra loa nghe gọi ⇒
// mỗi lượt đọc phải trả về "playback" (anh Long 2026-10-22: "sao ko nói được").
describe("phienPhat — trả phiên âm thanh về playback trước khi đọc", () => {
  it("play-and-record (vừa nghe xong) ⇒ playback", () => {
    const nav = { audioSession: { type: "play-and-record" } };
    phienPhat(nav);
    expect(nav.audioSession.type).toBe("playback");
  });
  it("auto ⇒ playback (loa không theo nút gạt im lặng)", () => {
    const nav = { audioSession: { type: "auto" } };
    phienPhat(nav);
    expect(nav.audioSession.type).toBe("playback");
  });
  it("không có Audio Session API ⇒ không ném", () => {
    expect(() => phienPhat({})).not.toThrow();
    expect(() => phienPhat(undefined)).not.toThrow();
  });
});
