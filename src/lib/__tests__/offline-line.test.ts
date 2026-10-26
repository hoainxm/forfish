import { describe, expect, it } from "vitest";
import { cauMatSong, gioLuu } from "@/lib/offline-line";

describe("offline-line — một câu mất sóng", () => {
  const luc = new Date(2026, 9, 25, 7, 5).getTime(); // 07:05 25/10 giờ máy
  const now = luc + 3600_000;

  it("có bản lưu ⇒ 'Mất sóng — bản lúc HH:MM dd/MM' (số ms hoặc ISO)", () => {
    expect(gioLuu(luc)).toBe("07:05 25/10");
    expect(cauMatSong(luc, now)).toBe("Mất sóng — bản lúc 07:05 25/10");
    expect(cauMatSong(new Date(luc).toISOString(), now)).toBe("Mất sóng — bản lúc 07:05 25/10");
  });

  it("không bản lưu / hỏng / tương lai ⇒ 'có sóng sẽ tải'", () => {
    expect(cauMatSong(undefined, now)).toBe("Mất sóng — có sóng sẽ tải");
    expect(cauMatSong(null, now)).toBe("Mất sóng — có sóng sẽ tải");
    expect(cauMatSong(0, now)).toBe("Mất sóng — có sóng sẽ tải");
    expect(cauMatSong(NaN, now)).toBe("Mất sóng — có sóng sẽ tải");
    expect(cauMatSong("hôm qua", now)).toBe("Mất sóng — có sóng sẽ tải");
    expect(cauMatSong(now + 60_000, now)).toBe("Mất sóng — có sóng sẽ tải");
  });
});

describe("cauMatSong — máy vẫn báo có mạng ⇒ MẠNG YẾU, không nói dối là mất sóng (2026-10-26)", () => {
  const now = new Date(2026, 9, 25, 9, 0).getTime();
  const luc = new Date(2026, 9, 25, 7, 5).getTime();
  it("có bản lưu / không bản lưu", () => {
    expect(cauMatSong(luc, now, true)).toBe("Mạng yếu — đang xem bản lúc 07:05 25/10");
    expect(cauMatSong(null, now, true)).toBe("Mạng yếu — chưa tải được, thử lại sau");
    expect(cauMatSong(luc, now, true)).not.toMatch(/Mất sóng/);
  });
  it("mặc định (không cờ) giữ câu mất sóng cũ", () => {
    expect(cauMatSong(luc, now)).toBe("Mất sóng — bản lúc 07:05 25/10");
  });
});
