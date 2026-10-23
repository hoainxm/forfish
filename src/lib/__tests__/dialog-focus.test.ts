import { describe, it, expect } from "vitest";
import { vongFocus, vuotDeDong } from "@/lib/dialog-focus";

describe("vongFocus — Tab không chạy ra khỏi hộp thoại", () => {
  const a = { n: "a" }, b = { n: "b" }, c = { n: "c" };
  const items = [a, b, c];
  it("Tab ở phần tử cuối → về đầu; Shift+Tab ở đầu → về cuối", () => {
    expect(vongFocus(items, c, false)).toBe(a);
    expect(vongFocus(items, a, true)).toBe(c);
  });
  it("ở giữa → để trình duyệt tự đi (null)", () => {
    expect(vongFocus(items, b, false)).toBeNull();
    expect(vongFocus(items, b, true)).toBeNull();
  });
  it("focus đang ở NGOÀI hộp (trang dưới nền mờ) → kéo về trong hộp", () => {
    const ngoai = { n: "ngoai" };
    expect(vongFocus(items, ngoai, false)).toBe(a);
    expect(vongFocus(items, ngoai, true)).toBe(c);
  });
  it("hộp không có gì nhận focus → null", () => {
    expect(vongFocus([], a, false)).toBeNull();
  });
});

describe("vuotDeDong — vuốt xuống đóng ngăn đáy", () => {
  it("kéo chậm qua 80px → đóng; dưới 80px chậm → bật về", () => {
    expect(vuotDeDong(90, 2000)).toBe(true);
    expect(vuotDeDong(40, 2000)).toBe(false);
  });
  it("hất nhanh 30px trong 100ms (0,3 px/ms) → đóng", () => {
    expect(vuotDeDong(30, 100)).toBe(true);
  });
  it("kéo lên hoặc không nhúc nhích → không đóng", () => {
    expect(vuotDeDong(-120, 100)).toBe(false);
    expect(vuotDeDong(0, 0)).toBe(false);
  });
});
