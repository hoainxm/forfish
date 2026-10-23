import { describe, expect, it } from "vitest";
import { phienThuAm } from "@/lib/sen-bien/nghe";

// iOS 16.4+: phiên "playback" (loa đọc) cấm thu micro ⇒ mở mic phải chuyển sang "play-and-record"
// (anh Long 2026-10-22: "có mic mà vừa đọc vừa nghe lỗi hay sao").
describe("phienThuAm — phiên âm thanh cho phép thu trước khi mở micro", () => {
  it("đang playback (loa vừa đọc) ⇒ đổi sang play-and-record", () => {
    const nav = { audioSession: { type: "playback" } };
    phienThuAm(nav);
    expect(nav.audioSession.type).toBe("play-and-record");
  });

  it("auto / play-and-record giữ nguyên — đã thu được, không động vào", () => {
    for (const type of ["auto", "play-and-record"]) {
      const nav = { audioSession: { type } };
      phienThuAm(nav);
      expect(nav.audioSession.type).toBe(type);
    }
  });

  it("máy không có Audio Session API (Android, iOS cũ) ⇒ không ném", () => {
    expect(() => phienThuAm({})).not.toThrow();
    expect(() => phienThuAm(undefined)).not.toThrow();
  });

  it("trình duyệt từ chối đổi (setter ném) ⇒ nuốt, để bộ nghe tự báo lỗi", () => {
    const nav = {
      audioSession: {
        get type() {
          return "playback";
        },
        set type(_v: string) {
          throw new Error("NotSupported");
        },
      },
    };
    expect(() => phienThuAm(nav)).not.toThrow();
  });
});
