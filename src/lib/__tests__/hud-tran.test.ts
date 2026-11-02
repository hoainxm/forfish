import { describe, expect, it } from "vitest";
import { xepDongHud } from "@/lib/hud-tran";

const d = (id: string, red = false) => ({ id, red });

describe("xepDongHud — trần 2 dòng, đỏ luôn hiện", () => {
  it("ít hơn trần ⇒ hiện hết", () => {
    expect(xepDongHud([d("a")], false)).toEqual({ hien: new Set(["a"]), an: 0 });
  });
  it("thừa ⇒ giữ 2 dòng đầu, còn lại đếm vào +N", () => {
    const r = xepDongHud([d("a"), d("b"), d("c"), d("e")], false);
    expect([...r.hien]).toEqual(["a", "b"]);
    expect(r.an).toBe(2);
  });
  it("dòng đỏ nằm cuối vẫn được hiện trước dòng thường", () => {
    const r = xepDongHud([d("a"), d("b"), d("c", true)], false);
    expect(r.hien.has("c")).toBe(true);
    expect(r.hien.size).toBe(2);
    expect(r.an).toBe(1);
  });
  it("ba dòng đỏ ⇒ hiện cả ba, không giấu dòng đỏ nào", () => {
    const r = xepDongHud([d("a", true), d("b", true), d("c", true), d("x")], false);
    expect(r.hien.size).toBe(3);
    expect(r.an).toBe(1);
  });
  it("mở rộng ⇒ hiện hết", () => {
    expect(xepDongHud([d("a"), d("b"), d("c")], true).an).toBe(0);
  });
});
