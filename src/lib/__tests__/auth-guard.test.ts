import { describe, expect, it } from "vitest";
import { mustForcePasswordChange } from "@/lib/auth-guard";

const FLAG = { must_change_password: true };

describe("mustForcePasswordChange", () => {
  it("còn cờ + trang thường → ép về đổi MK", () => {
    expect(mustForcePasswordChange("/", FLAG)).toBe(true);
    expect(mustForcePasswordChange("/ngu-truong", FLAG)).toBe(true);
    expect(mustForcePasswordChange("/tien", FLAG)).toBe(true);
    expect(mustForcePasswordChange("/nguoi", FLAG)).toBe(true);
  });

  it("còn cờ nhưng đang ở trang được phép → KHÔNG ép (không loop)", () => {
    expect(mustForcePasswordChange("/doi-mat-khau", FLAG)).toBe(false);
    expect(mustForcePasswordChange("/login", FLAG)).toBe(false);
    expect(mustForcePasswordChange("/dang-ky", FLAG)).toBe(false);
    expect(mustForcePasswordChange("/quen-mat-khau", FLAG)).toBe(false);
    expect(mustForcePasswordChange("/api/sdwork/password-sync", FLAG)).toBe(
      false,
    );
    expect(mustForcePasswordChange("/api/me/sdvico", FLAG)).toBe(false);
  });

  it("không có cờ (đã đổi hoặc user thường) → KHÔNG ép", () => {
    expect(mustForcePasswordChange("/", { must_change_password: false })).toBe(
      false,
    );
    expect(mustForcePasswordChange("/", {})).toBe(false);
    expect(mustForcePasswordChange("/", null)).toBe(false);
    expect(mustForcePasswordChange("/", undefined)).toBe(false);
  });

  it("khách chưa đăng nhập (không metadata) → app vẫn công khai", () => {
    expect(mustForcePasswordChange("/ngu-truong", null)).toBe(false);
  });

  it("không nhầm tiền tố (vd /loginabc là trang thường nếu có)", () => {
    expect(mustForcePasswordChange("/logind", FLAG)).toBe(true);
  });
});
