import { describe, expect, it } from "vitest";
import {
  buildResetRequest,
  resetEndpoint,
  resetHeaders,
  resetRequestMessage,
  validateResetInput,
} from "@/lib/password-reset";
import { isValidVnPhone } from "@/lib/phone";

describe("buildResetRequest", () => {
  it("đưa SĐT vào CẢ username lẫn phone — CRM dò login_phone ở nhánh đầu", () => {
    expect(buildResetRequest("0907905359", " Trương Minh Tuấn ")).toEqual({
      username: "0907905359",
      phone: "0907905359",
      full_name: "Trương Minh Tuấn",
    });
  });

  it("chuẩn hoá SĐT dạng +84/84 về 0xxxxxxxxx", () => {
    expect(buildResetRequest("+84 907 905 359", "Nguyễn Văn Ba").phone).toBe("0907905359");
    expect(buildResetRequest("84907905359", "Nguyễn Văn Ba").username).toBe("0907905359");
  });
});

describe("validateResetInput", () => {
  it("SĐT sai → nhắc đủ 10 số", () => {
    expect(validateResetInput("090790", "Nguyễn Văn Ba", isValidVnPhone)).toMatch(/10 số/);
  });

  it("thiếu họ tên → nhắc nhập", () => {
    expect(validateResetInput("0907905359", " ", isValidVnPhone)).toMatch(/họ tên/i);
  });

  it("chỉ có tên, thiếu họ → nhắc nhập cả họ (CRM đối chiếu theo từng từ)", () => {
    expect(validateResetInput("0907905359", "Ba", isValidVnPhone)).toMatch(/CẢ họ và tên/);
  });

  it("hợp lệ → null", () => {
    expect(validateResetInput("0907905359", "Nguyễn Văn Ba", isValidVnPhone)).toBeNull();
  });
});

describe("resetRequestMessage", () => {
  it("gửi được → báo sẽ có người gọi lại trong 24h", () => {
    const r = resetRequestMessage(200, { success: true, message: "..." });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/24 giờ/);
  });

  it("đã có yêu cầu đang chờ → nói rõ, không tạo cảm giác hỏng", () => {
    const r = resetRequestMessage(200, {
      success: true,
      message: "Bạn đã có một yêu cầu đang chờ xử lý. Vui lòng liên hệ quản trị viên.",
    });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/đang xử lý/);
  });

  it("quá tần suất (429) → bảo chờ, kèm lối thoát gọi SDVICO", () => {
    const r = resetRequestMessage(429, { error: "..." });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/một tiếng/);
    expect(r.message).toMatch(/SDVICO/);
  });

  it("thiếu trường (400) → dùng câu CRM trả về", () => {
    const r = resetRequestMessage(400, { error: "Vui lòng điền đầy đủ..." });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Vui lòng điền đầy đủ/);
  });

  it("401/403 = lỗi cấu hình phía ta → đẩy thẳng sang hotline, không bảo thử lại", () => {
    const r = resetRequestMessage(401, { message: "Invalid API key" });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/gọi SDVICO/i);
    expect(r.message).not.toMatch(/thử lại/i);
  });

  it("lỗi máy chủ / mất mạng → gợi ý thử lại + gọi SDVICO", () => {
    expect(resetRequestMessage(500, null).ok).toBe(false);
    expect(resetRequestMessage(0, null).message).toMatch(/mạng|SDVICO/);
  });

  it("KHÔNG tiết lộ số nào có tài khoản (giữ nguyên tinh thần chống dò của CRM)", () => {
    const all = [
      resetRequestMessage(200, { success: true }),
      resetRequestMessage(429, null),
      resetRequestMessage(500, null),
    ];
    all.forEach((r) => {
      expect(r.message).not.toMatch(/không tìm thấy|chưa có tài khoản|không tồn tại/i);
    });
  });
});

describe("resetEndpoint", () => {
  it("ghép đúng đường dẫn, bỏ dấu / thừa", () => {
    expect(resetEndpoint("https://x.supabase.co/functions/v1/", "key")).toEqual({
      url: "https://x.supabase.co/functions/v1/request-password-reset",
      anonKey: "key",
    });
  });

  it("KHÔNG có khoá vẫn chạy — function CRM deploy công khai", () => {
    expect(resetEndpoint("https://x/functions/v1", undefined)).toEqual({
      url: "https://x/functions/v1/request-password-reset",
      anonKey: null,
    });
  });

  it("thiếu URL → null (màn chỉ hiện hướng dẫn gọi hotline)", () => {
    expect(resetEndpoint(undefined, "key")).toBeNull();
    expect(resetEndpoint("  ", "key")).toBeNull();
  });
});

describe("resetHeaders", () => {
  it("không khoá → CHỈ content-type (gửi khoá sai bị cổng Supabase chặn 401)", () => {
    expect(resetHeaders(null)).toEqual({ "content-type": "application/json" });
  });

  it("có khoá → đính cả authorization lẫn apikey", () => {
    expect(resetHeaders("k")).toEqual({
      "content-type": "application/json",
      authorization: "Bearer k",
      apikey: "k",
    });
  });
});
