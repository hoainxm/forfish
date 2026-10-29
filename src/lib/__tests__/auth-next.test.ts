import { describe, expect, it } from "vitest";
import { readNextParam, safeNext, withNext } from "@/lib/auth-next";

describe("safeNext — chỉ nhận đường dẫn trong app", () => {
  it("đường dẫn trong app ⇒ giữ nguyên (kèm query)", () => {
    expect(safeNext("/cho/gio")).toBe("/cho/gio");
    expect(safeNext("/ngu-truong?lop=gio")).toBe("/ngu-truong?lop=gio");
  });
  it("link ra ngoài / trick ⇒ về Trang chủ", () => {
    for (const bad of ["https://evil.vn", "//evil.vn", "/\\evil.vn", "javascript:alert(1)", "cho/gio", "/a\nb", ""]) {
      expect(safeNext(bad), bad).toBe("/");
    }
    expect(safeNext(null)).toBe("/");
    expect(safeNext("/" + "a".repeat(600))).toBe("/");
  });
  it("trang tài khoản ⇒ không quay về (tránh vòng lặp)", () => {
    expect(safeNext("/login")).toBe("/");
    expect(safeNext("/login?tao=xong")).toBe("/");
    expect(safeNext("/dang-ky")).toBe("/");
    expect(safeNext("/doi-mat-khau")).toBe("/");
  });
});

describe("withNext / readNextParam", () => {
  it("gắn next đã mã hoá; Trang chủ thì để link gọn", () => {
    expect(withNext("/login", "/cho/gio")).toBe("/login?next=%2Fcho%2Fgio");
    expect(withNext("/dang-ky", "/")).toBe("/dang-ky");
    expect(withNext("/login", "https://evil.vn")).toBe("/login");
  });
  it("đọc lại đúng từ query, sai thì về Trang chủ", () => {
    expect(readNextParam("?next=%2Fcho%2Fgio&tao=xong")).toBe("/cho/gio");
    expect(readNextParam("?next=https%3A%2F%2Fevil.vn")).toBe("/");
    expect(readNextParam("")).toBe("/");
  });
});
