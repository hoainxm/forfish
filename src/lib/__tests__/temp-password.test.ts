import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOMER_PASSWORD,
  randomTempPassword,
  resetPasswordFor,
} from "../temp-password";

describe("randomTempPassword", () => {
  it("đạt tối thiểu 6 ký tự của Supabase Auth, khuôn sd + 6 số", () => {
    const p = randomTempPassword();
    expect(p.length).toBeGreaterThanOrEqual(6);
    expect(p).toMatch(/^sd\d{6}$/);
  });

  it("đệm số 0 đầu cho giá trị nhỏ", () => {
    expect(randomTempPassword(() => 42)).toBe("sd000042");
    expect(randomTempPassword(() => 1_234_567)).toBe("sd234567");
  });

  it("KHÔNG còn là mật khẩu cố định ai cũng biết (sd123456)", () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomTempPassword()));
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe("resetPasswordFor — khách về mặc định, nhân sự ngẫu nhiên (2026-10-06)", () => {
  it("mật khẩu mặc định của khách là sd123456 (trùng webhook SDWork)", () => {
    expect(DEFAULT_CUSTOMER_PASSWORD).toBe("sd123456");
  });

  it("khách ⇒ luôn sd123456, không phụ thuộc số ngẫu nhiên", () => {
    expect(resetPasswordFor(false)).toBe("sd123456");
    expect(resetPasswordFor(false, () => 42)).toBe("sd123456");
  });

  it("nhân sự ⇒ ngẫu nhiên, KHÔNG BAO GIỜ là mật khẩu chung", () => {
    expect(resetPasswordFor(true, () => 42)).toBe("sd000042");
    const seen = new Set(Array.from({ length: 50 }, () => resetPasswordFor(true)));
    expect(seen.size).toBeGreaterThan(40);
  });
});
