import { describe, expect, it } from "vitest";
import {
  LOGIN_FALLBACK_MESSAGE,
  loginErrorMessage,
} from "../login-error";

// Lỗi invalid_credentials chuẩn Supabase trả khi sai SĐT hoặc mật khẩu.
const invalidCreds = {
  code: "invalid_credentials",
  message: "Invalid login credentials",
  status: 400,
};

describe("loginErrorMessage — tách lỗi đăng nhập (2026-07-21)", () => {
  it("SĐT chưa có tài khoản → chỉ đường gọi SDVICO cấp tài khoản", () => {
    const msg = loginErrorMessage(invalidCreds, false);
    expect(msg).toContain("chưa có tài khoản");
    expect(msg).toContain("1900 23 23 49");
    // KHÔNG gợi ý mật khẩu cho số chưa đăng ký.
    expect(msg).not.toContain("sd123456");
  });

  it("SĐT có tài khoản → sai mật khẩu, gợi ý sd123456 + Quên mật khẩu", () => {
    const msg = loginErrorMessage(invalidCreds, true);
    expect(msg).toContain("mật khẩu chưa đúng");
    expect(msg).toContain("sd123456");
    expect(msg).toContain("Quên mật khẩu");
  });

  it("không kiểm được tài khoản (null) → quay về câu gộp cũ", () => {
    expect(loginErrorMessage(invalidCreds, null)).toBe(LOGIN_FALLBACK_MESSAGE);
  });

  it("tài khoản bị khóa → nói thẳng bị khóa, KHÔNG gợi ý mật khẩu", () => {
    const banned = { code: "user_banned", message: "User is banned", status: 403 };
    // Ưu tiên câu bị khóa kể cả khi exists=true.
    const msg = loginErrorMessage(banned, true);
    expect(msg).toContain("bị khóa");
    expect(msg).toContain("1900 23 23 49");
    expect(msg).not.toContain("sd123456");
  });

  it("bấm quá nhanh (429) → bảo chờ, không đổ lỗi sai mật khẩu", () => {
    const msg = loginErrorMessage({ status: 429, message: "rate limit exceeded" }, true);
    expect(msg).toContain("Chờ một chút");
    expect(msg).not.toContain("mật khẩu chưa đúng");
  });

  it("mất mạng → bảo kiểm tra sóng", () => {
    const msg = loginErrorMessage({ message: "Failed to fetch" }, null);
    expect(msg).toContain("sóng");
  });

  it("lỗi máy chủ 5xx → coi như mạng chập chờn, không phán sai mật khẩu", () => {
    const msg = loginErrorMessage({ status: 502, message: "Bad Gateway" }, true);
    expect(msg).toContain("chập chờn");
  });

  it("lỗi lạ không nhận diện được → câu gộp có lối đi, không rỗng", () => {
    expect(loginErrorMessage({ message: "weird" }, null)).toBe(LOGIN_FALLBACK_MESSAGE);
    expect(loginErrorMessage(null, null)).toBe(LOGIN_FALLBACK_MESSAGE);
  });
});
