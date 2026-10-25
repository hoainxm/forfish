// Camera bám tàu (anh Long 2026-10-25: "bản đồ đang hay tự kéo về vị trí hiện tại trong khi người dùng đang muốn xem
// thông tin ở chỗ khác").
import { describe, expect, it } from "vitest";
import { bamSau, laThaoTacTay, nenBayTheoFix } from "@/lib/bam-tau";

describe("bamSau", () => {
  it("bấm dẫn đường / Chạy tàu ⇒ bám; kéo tay hoặc dừng ⇒ thôi", () => {
    expect(bamSau(false, "bat-dan-duong", true)).toBe(true);
    expect(bamSau(true, "keo-tay", true)).toBe(false);
    expect(bamSau(true, "dung", false)).toBe(false);
  });
  it("chạm vòng ngắm: đang chạy thì bám lại, không chạy thì chỉ bay tới một lần", () => {
    expect(bamSau(false, "ve-tau", true)).toBe(true);
    expect(bamSau(false, "ve-tau", false)).toBe(false);
  });
});

describe("nenBayTheoFix", () => {
  it("Đang chạy TỰ BẬT lúc mở bản đồ (chưa bám) ⇒ KHÔNG kéo camera — gốc lỗi", () => {
    expect(nenBayTheoFix(true, false, "tracking", true)).toBe(false);
  });
  it("đang chạy + bám + định vị tốt ⇒ bay; mất định vị ⇒ giữ khung", () => {
    expect(nenBayTheoFix(true, true, "tracking", true)).toBe(true);
    expect(nenBayTheoFix(true, true, "lost", true)).toBe(false);
    expect(nenBayTheoFix(false, true, "tracking", true)).toBe(false);
    expect(nenBayTheoFix(true, true, "tracking", false)).toBe(false);
  });
});

describe("laThaoTacTay", () => {
  it("có originalEvent = tay bà con; flyTo của app thì không", () => {
    expect(laThaoTacTay({ originalEvent: {} })).toBe(true);
    expect(laThaoTacTay({})).toBe(false);
    expect(laThaoTacTay(undefined)).toBe(false);
  });
});
