import { describe, expect, it } from "vitest";
import {
  generateCode,
  hashCode,
  verifyCode,
  isExpired,
  inResendCooldown,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
} from "@/lib/otp/codes";

describe("generateCode", () => {
  it("6 chữ số", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashCode / verifyCode", () => {
  it("hash deterministic + verify đúng mã", () => {
    const h = hashCode("123456", "0901234567", "pep");
    expect(hashCode("123456", "0901234567", "pep")).toBe(h);
    expect(verifyCode("123456", "0901234567", h, "pep")).toBe(true);
  });
  it("sai mã / sai SĐT / sai pepper → false", () => {
    const h = hashCode("123456", "0901234567", "pep");
    expect(verifyCode("000000", "0901234567", h, "pep")).toBe(false);
    expect(verifyCode("123456", "0909999999", h, "pep")).toBe(false);
    expect(verifyCode("123456", "0901234567", h, "other")).toBe(false);
  });
  it("hash rác → false, không ném lỗi", () => {
    expect(verifyCode("123456", "0901234567", "zzz", "pep")).toBe(false);
  });
});

describe("isExpired", () => {
  it("đúng mốc hết hạn", () => {
    const now = 1_000_000;
    expect(isExpired(now + OTP_TTL_MS, now)).toBe(false);
    expect(isExpired(now - 1, now)).toBe(true);
  });
});

describe("inResendCooldown", () => {
  it("chặn gửi lại trong cooldown", () => {
    const now = 1_000_000;
    expect(inResendCooldown(now - 1000, now)).toBe(true);
    expect(inResendCooldown(now - OTP_RESEND_COOLDOWN_MS - 1, now)).toBe(false);
  });
});
