import { describe, expect, it } from "vitest";
import {
  isValidVnPhone,
  normalizeVnPhone,
  phoneToEmail,
  sanitizePhoneInput,
} from "@/components/auth-form";

/*
  User hỏi 2026-06-11: "đăng nhập có phải nhập đuôi @ mail không?"
  → KHÔNG. Bà con chỉ gõ SĐT; app tự ghép đuôi. Test này khóa hành vi đó.
*/

describe("sanitizePhoneInput — ô SĐT chỉ nhận số", () => {
  it("gõ chữ/ký hiệu tự rơi", () => {
    expect(sanitizePhoneInput("09o1 234-567a")).toBe("091234567");
    expect(sanitizePhoneInput("0901234567@sdvico.local")).toBe("0901234567");
    expect(sanitizePhoneInput("+84 901 234 567")).toBe("84901234567");
  });
  it("chặn dài quá 11 số", () => {
    expect(sanitizePhoneInput("0901234567890123")).toBe("09012345678");
  });
});

describe("phoneToEmail — đuôi email ảo TỰ ghép, mọi kiểu gõ về một mối", () => {
  it.each([
    ["0901234567"],
    ["84901234567"],
    ["+84 901 234 567"],
    ["0901 234 567"],
  ])("%s → 0901234567@sdvico.local", (raw) => {
    expect(phoneToEmail(raw)).toBe("0901234567@sdvico.local");
  });
});

describe("normalizeVnPhone + isValidVnPhone", () => {
  it("chuẩn về đầu 0", () => {
    expect(normalizeVnPhone("84901234567")).toBe("0901234567");
    expect(normalizeVnPhone("901234567")).toBe("0901234567");
  });
  it("nhận 10–11 số, chối số rác", () => {
    expect(isValidVnPhone("0901234567")).toBe(true);
    expect(isValidVnPhone("+84901234567")).toBe(true);
    expect(isValidVnPhone("12345")).toBe(false);
    expect(isValidVnPhone("abc")).toBe(false);
  });
});
