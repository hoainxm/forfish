import { describe, it, expect } from "vitest";
import { foldVn, maskPhone, productSearchText, toSlug } from "@/lib/market/text";

describe("foldVn", () => {
  it("bỏ dấu, đ→d, ký tự lạ thành khoảng trắng, gộp", () => {
    expect(foldVn("Dây thừng Ø12 — Đà Nẵng")).toBe("day thung 12 da nang");
    expect(foldVn("  Máy   Yanmar ")).toBe("may yanmar");
    expect(foldVn("")).toBe("");
    expect(foldVn("ĐẠI LÝ HẢI ĐĂNG")).toBe("dai ly hai dang");
  });
});

describe("toSlug", () => {
  it("dai-ly-hai-dang; rỗng ⇒ shop; không hậu tố", () => {
    expect(toSlug("Đại lý Hải Đăng")).toBe("dai-ly-hai-dang");
    expect(toSlug("SDVICO")).toBe("sdvico");
    expect(toSlug("   ")).toBe("shop");
    expect(toSlug("Đại Lý HẢI đăng")).toBe(toSlug("dai ly hai dang"));
  });
});

describe("productSearchText / maskPhone", () => {
  it("search_text = foldVn(title + description)", () => {
    expect(productSearchText({ title: "Đá cây 50kg", description: "Giao ra cảng" })).toBe("da cay 50kg giao ra cang");
    expect(productSearchText({ title: "Đá cây 50kg" })).toBe("da cay 50kg");
  });
  it("maskPhone 10 số ⇒ 0901***567; số ngắn không ném", () => {
    expect(maskPhone("0901234567")).toBe("0901***567");
    expect(maskPhone("84901234567")).toBe("8490***567");
    expect(maskPhone("12345")).toBe("12*45");
    expect(maskPhone("12")).toBe("**");
    expect(maskPhone("")).toBe("");
  });
});
