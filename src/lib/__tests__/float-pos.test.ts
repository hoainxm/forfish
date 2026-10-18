import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLOAT_POS,
  FLOAT_POS_KEY,
  loadFloatPos,
  normalizeFloatPos,
  saveFloatPos,
  settleDrop,
} from "../float-pos";

/** localStorage giả — không cần jsdom, và ép được ca "máy hết chỗ". */
function fakeStorage(opts: { full?: boolean } = {}): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.full) throw new DOMException("QuotaExceededError");
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe("normalizeFloatPos — sổ cũ/rác về vị trí hợp lệ", () => {
  it("rỗng / không phải object → mặc định (góc dưới-phải, không ẩn)", () => {
    expect(normalizeFloatPos(undefined)).toEqual(DEFAULT_FLOAT_POS);
    expect(normalizeFloatPos("x")).toEqual(DEFAULT_FLOAT_POS);
    expect(normalizeFloatPos(3)).toEqual(DEFAULT_FLOAT_POS);
  });

  it("side lạ → right; dy âm/NaN/khổng lồ → kẹp; tucked chỉ nhận đúng true", () => {
    expect(normalizeFloatPos({ side: "up", dy: -5, tucked: "yes" })).toEqual({
      side: "right",
      dy: 0,
      tucked: false,
    });
    expect(normalizeFloatPos({ side: "left", dy: Number.NaN, tucked: true })).toEqual({
      side: "left",
      dy: 0,
      tucked: true,
    });
    expect(normalizeFloatPos({ side: "left", dy: 99999 }).dy).toBe(4000);
    expect(normalizeFloatPos({ dy: 12.6 }).dy).toBe(13);
  });
});

describe("load/save — mỗi nút một ngăn trong một khoá", () => {
  it("chưa lưu → mặc định; lưu rồi đọc lại đúng; nút khác không đụng nhau", () => {
    const s = fakeStorage();
    expect(loadFloatPos("sen-bien", s)).toEqual(DEFAULT_FLOAT_POS);
    expect(saveFloatPos("sen-bien", { side: "left", dy: 120, tucked: true }, s)).toBe(true);
    expect(saveFloatPos("gio-hang", { side: "right", dy: 40, tucked: false }, s)).toBe(true);
    expect(loadFloatPos("sen-bien", s)).toEqual({ side: "left", dy: 120, tucked: true });
    expect(loadFloatPos("gio-hang", s)).toEqual({ side: "right", dy: 40, tucked: false });
    expect(JSON.parse(s.getItem(FLOAT_POS_KEY)!)).toEqual({
      "sen-bien": { side: "left", dy: 120, tucked: true },
      "gio-hang": { side: "right", dy: 40, tucked: false },
    });
  });

  it("khoá hỏng (không phải JSON / là mảng) → mặc định, và ghi đè được", () => {
    const s = fakeStorage();
    s.setItem(FLOAT_POS_KEY, "{oops");
    expect(loadFloatPos("sen-bien", s)).toEqual(DEFAULT_FLOAT_POS);
    s.setItem(FLOAT_POS_KEY, "[1,2]");
    expect(loadFloatPos("sen-bien", s)).toEqual(DEFAULT_FLOAT_POS);
    expect(saveFloatPos("sen-bien", { side: "left", dy: 1, tucked: false }, s)).toBe(true);
    expect(loadFloatPos("sen-bien", s).side).toBe("left");
  });

  it("máy hết chỗ → trả false, không ném; không có storage → false", () => {
    expect(saveFloatPos("sen-bien", DEFAULT_FLOAT_POS, fakeStorage({ full: true }))).toBe(false);
    expect(saveFloatPos("sen-bien", DEFAULT_FLOAT_POS, undefined)).toBe(false);
    expect(loadFloatPos("sen-bien", undefined)).toEqual(DEFAULT_FLOAT_POS);
  });
});

describe("settleDrop — thả là nép mép, giữ độ cao, đẩy sát mép là ẩn", () => {
  const frame = { frameWidth: 480, btnWidth: 64, maxDy: 600 };

  it("thả bên nào thì nép bên đó", () => {
    expect(settleDrop({ ...frame, centerX: 100, dyBefore: 0, deltaY: 0 }).side).toBe("left");
    expect(settleDrop({ ...frame, centerX: 300, dyBefore: 0, deltaY: 0 }).side).toBe("right");
  });

  it("kéo LÊN 80px → dy tăng 80; kéo xuống quá đáy → dy 0; lên quá đỉnh → maxDy", () => {
    expect(settleDrop({ ...frame, centerX: 400, dyBefore: 50, deltaY: -80 }).dy).toBe(130);
    expect(settleDrop({ ...frame, centerX: 400, dyBefore: 50, deltaY: 300 }).dy).toBe(0);
    expect(settleDrop({ ...frame, centerX: 400, dyBefore: 50, deltaY: -2000 }).dy).toBe(600);
  });

  it("chỗ nghỉ bình thường (tâm cách mép 48px) KHÔNG bị coi là ẩn", () => {
    const p = settleDrop({ ...frame, centerX: 480 - 48, dyBefore: 0, deltaY: 0 });
    expect(p).toEqual({ side: "right", dy: 0, tucked: false });
  });

  it("tâm nút đẩy sát ra ngoài mép (<40% bề rộng nút) → ẩn, cả hai bên", () => {
    expect(settleDrop({ ...frame, centerX: 479, dyBefore: 0, deltaY: 0 }).tucked).toBe(true);
    expect(settleDrop({ ...frame, centerX: 10, dyBefore: 0, deltaY: 0 }).tucked).toBe(true);
    expect(settleDrop({ ...frame, centerX: 30, dyBefore: 0, deltaY: 0 }).tucked).toBe(false);
  });
});
