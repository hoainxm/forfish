import { describe, expect, it } from "vitest";
import {
  FALLBACK_MESSAGE,
  passwordChangeErrorMessage,
} from "@/lib/auth-error";

describe("passwordChangeErrorMessage", () => {
  it("gõ lại mật khẩu cũ → nói THẲNG là trùng, bảo đặt mật khẩu khác", () => {
    const byCode = passwordChangeErrorMessage({ code: "same_password" });
    const byMessage = passwordChangeErrorMessage({
      message: "New password should be different from the old password.",
    });
    expect(byCode).toMatch(/trùng mật khẩu cũ/i);
    expect(byMessage).toBe(byCode);
  });

  it("mật khẩu yếu/ngắn → gợi ý đặt dài hơn", () => {
    expect(passwordChangeErrorMessage({ code: "weak_password" })).toMatch(
      /quá ngắn|dễ đoán/i,
    );
    expect(
      passwordChangeErrorMessage({
        message: "Password should be at least 6 characters.",
      }),
    ).toMatch(/quá ngắn|dễ đoán/i);
  });

  it("mật khẩu rò rỉ → bảo chọn mật khẩu khác", () => {
    expect(
      passwordChangeErrorMessage({ message: "This password is known to be pwned." }),
    ).toMatch(/phổ biến|dễ bị đoán/i);
  });

  it("phiên hết hạn → bảo đăng nhập lại", () => {
    expect(passwordChangeErrorMessage({ status: 401 })).toMatch(/đăng nhập lại/i);
    expect(
      passwordChangeErrorMessage({ code: "session_not_found" }),
    ).toMatch(/đăng nhập lại/i);
  });

  it("bấm quá nhanh → bảo chờ", () => {
    expect(passwordChangeErrorMessage({ status: 429 })).toMatch(/chờ/i);
    expect(
      passwordChangeErrorMessage({ code: "over_request_rate_limit" }),
    ).toMatch(/chờ/i);
  });

  it("mất mạng / máy chủ lỗi → bảo kiểm tra sóng", () => {
    expect(
      passwordChangeErrorMessage({ message: "Failed to fetch" }),
    ).toMatch(/sóng|mạng/i);
    expect(passwordChangeErrorMessage({ status: 503 })).toMatch(/sóng|mạng/i);
  });

  it("không rõ lỗi → câu chung CÓ lối thoát (gọi SDVICO), không cụt lủn", () => {
    expect(passwordChangeErrorMessage(null)).toBe(FALLBACK_MESSAGE);
    expect(passwordChangeErrorMessage({ message: "boom" })).toBe(FALLBACK_MESSAGE);
    expect(FALLBACK_MESSAGE).toMatch(/SDVICO/);
  });

  it("KHÔNG câu nào lộ mật khẩu mặc định", () => {
    const all = [
      passwordChangeErrorMessage({ code: "same_password" }),
      passwordChangeErrorMessage({ code: "weak_password" }),
      passwordChangeErrorMessage({ status: 401 }),
      passwordChangeErrorMessage(null),
    ];
    all.forEach((m) => expect(m).not.toMatch(/sd123456|123456/));
  });
});
