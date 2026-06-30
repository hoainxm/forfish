import { describe, expect, it } from "vitest";
import { normalizePassword } from "@/lib/password";

describe("normalizePassword", () => {
  it("bỏ khoảng trắng đầu/cuối", () => {
    expect(normalizePassword("  123456  ")).toBe("123456");
    expect(normalizePassword("abc \t\n")).toBe("abc");
    expect(normalizePassword("\n  matkhau")).toBe("matkhau");
  });

  it("giữ khoảng trắng giữa (mật khẩu cụm từ)", () => {
    expect(normalizePassword("hai ba bon")).toBe("hai ba bon");
    expect(normalizePassword("  cau ca bien  ")).toBe("cau ca bien");
  });

  it("không đổi mật khẩu sạch", () => {
    expect(normalizePassword("123456")).toBe("123456");
  });

  it("chuỗi rỗng / toàn khoảng trắng → rỗng", () => {
    expect(normalizePassword("")).toBe("");
    expect(normalizePassword("    ")).toBe("");
  });
});
