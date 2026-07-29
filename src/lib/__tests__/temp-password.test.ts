import { describe, expect, it } from "vitest";
import { TEMP_RESET_PASSWORD } from "../temp-password";

describe("TEMP_RESET_PASSWORD", () => {
  it("đạt tối thiểu 6 ký tự của Supabase Auth", () => {
    expect(TEMP_RESET_PASSWORD.length).toBeGreaterThanOrEqual(6);
  });

  it("đúng giá trị user chốt 2026-07-29 — đổi là phải báo lại sale", () => {
    expect(TEMP_RESET_PASSWORD).toBe("sd123456");
  });
});
