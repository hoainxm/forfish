import { describe, expect, it } from "vitest";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";

describe("parseAdminPhones", () => {
  it("tách phẩy + chuẩn hoá 84→0 + bỏ khoảng trắng", () => {
    expect(parseAdminPhones("0901234567, 84912345678")).toEqual([
      "0901234567",
      "0912345678",
    ]);
  });
  it("env trống / undefined / toàn rác → []", () => {
    expect(parseAdminPhones(undefined)).toEqual([]);
    expect(parseAdminPhones("")).toEqual([]);
    expect(parseAdminPhones("abc, ,x")).toEqual([]);
  });
});

describe("isAdminPhone", () => {
  const admins = parseAdminPhones("0901234567");
  it("khớp SĐT thường và email ảo", () => {
    expect(isAdminPhone("0901234567", admins)).toBe(true);
    expect(isAdminPhone("0901234567@sdvico.local", admins)).toBe(true);
    expect(isAdminPhone("84901234567", admins)).toBe(true);
  });
  it("không khớp / null / danh sách rỗng → false", () => {
    expect(isAdminPhone("0999999999", admins)).toBe(false);
    expect(isAdminPhone(null, admins)).toBe(false);
    expect(isAdminPhone("0901234567", [])).toBe(false);
  });
});
