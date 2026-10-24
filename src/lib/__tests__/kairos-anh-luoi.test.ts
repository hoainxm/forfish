import { describe, expect, it } from "vitest";
import { boCucAnh } from "@/lib/kairos/anh-luoi";

describe("boCucAnh — lưới ảnh kiểu FB", () => {
  it("0 ảnh ⇒ không ô, không kiểu", () => {
    expect(boCucAnh(0)).toEqual({ so: 0, them: 0, kieu: null });
  });
  it("1 / 2 / 3 / 4 ảnh ⇒ đủ ô, không +N", () => {
    expect(boCucAnh(1)).toEqual({ so: 1, them: 0, kieu: "mot" });
    expect(boCucAnh(2)).toEqual({ so: 2, them: 0, kieu: "hai" });
    expect(boCucAnh(3)).toEqual({ so: 3, them: 0, kieu: "ba" });
    expect(boCucAnh(4)).toEqual({ so: 4, them: 0, kieu: "bon" });
  });
  it("7 ảnh ⇒ 4 ô, ô cuối +3", () => {
    expect(boCucAnh(7)).toEqual({ so: 4, them: 3, kieu: "bon" });
  });
  it("số hỏng (âm, NaN, lẻ) ⇒ an toàn", () => {
    expect(boCucAnh(-2).so).toBe(0);
    expect(boCucAnh(Number.NaN).kieu).toBeNull();
    expect(boCucAnh(2.7)).toEqual({ so: 2, them: 0, kieu: "hai" });
  });
});
