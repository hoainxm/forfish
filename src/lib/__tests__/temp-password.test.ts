import { describe, expect, it } from "vitest";
import { randomTempPassword } from "../temp-password";

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
