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
  it("dạng nội địa 0xxxxxxxxx chặn đúng 10 số", () => {
    expect(sanitizePhoneInput("0901234567890123")).toBe("0901234567");
  });
  it("dạng quốc tế 84xxxxxxxxx cho tới 11 số (+84 vẫn gõ được)", () => {
    expect(sanitizePhoneInput("+84 901 234 567 89")).toBe("84901234567");
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
  it("nhận ĐÚNG 10 số (0+9) và dạng 84/+84, chối số rác", () => {
    expect(isValidVnPhone("0901234567")).toBe(true); // 10 số nội địa
    expect(isValidVnPhone("+84901234567")).toBe(true); // quốc tế = 10 số
    expect(isValidVnPhone("84901234567")).toBe(true);
    expect(isValidVnPhone("12345")).toBe(false);
    expect(isValidVnPhone("abc")).toBe(false);
  });
  it("chối SĐT thừa số — 0 + 10 = 11 số", () => {
    expect(isValidVnPhone("09012345678")).toBe(false);
    expect(isValidVnPhone("0901234567890")).toBe(false);
  });
  it("chối SĐT thiếu số — 0 + 8 = 9 số", () => {
    expect(isValidVnPhone("090123456")).toBe(false);
  });
});
