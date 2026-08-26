import { describe, it, expect } from "vitest";
import { classifySendFailure, sendFailureText } from "@/lib/send-error";

/*  Audit thông báo 2026-08-18 G2: SĐT sai / mất sóng / máy chủ lỗi trước đây
    chung một câu "Nhập đúng số điện thoại rồi thử lại" — đổ tội sai cho người
    đang mất sóng. Luật phân loại phải THUẦN và có test. */

describe("classifySendFailure — vì sao chưa gửi được", () => {
  it("SĐT dưới 9 số → 'sdt' (chưa gửi đi, xét trước mọi thứ)", () => {
    expect(
      classifySendFailure({ phoneDigits: "0901", threw: true, offline: true, ok: false }),
    ).toBe("sdt");
    expect(
      classifySendFailure({ phoneDigits: "09 0123 45", threw: false, offline: false, ok: true }),
    ).toBe("sdt");
  });

  it("fetch ném (mất sóng / hết giờ) → 'mang', KHÔNG phải lỗi SĐT", () => {
    expect(
      classifySendFailure({ phoneDigits: "0901234567", threw: true, offline: false, ok: false }),
    ).toBe("mang");
  });

  it("máy khẳng định mất sóng → 'mang' dù có phản hồi lạ", () => {
    expect(
      classifySendFailure({ phoneDigits: "0901234567", threw: false, offline: true, ok: false }),
    ).toBe("mang");
  });

  it("có phản hồi nhưng không ok → 'may-chu'", () => {
    expect(
      classifySendFailure({ phoneDigits: "0901234567", threw: false, offline: false, ok: false }),
    ).toBe("may-chu");
  });

  it("gửi ok → null", () => {
    expect(
      classifySendFailure({ phoneDigits: "0901234567", threw: false, offline: false, ok: true }),
    ).toBeNull();
  });
});

describe("sendFailureText — câu nói đúng tên đơn vị", () => {
  it("đơn vị ngoài thì gọi đúng tên, không đổ hết cho SDVICO", () => {
    expect(sendFailureText("mang", "Vựa cô Ba")).toContain("gọi thẳng Vựa cô Ba");
    expect(sendFailureText("may-chu", "Vựa cô Ba")).toContain("Vựa cô Ba");
    expect(sendFailureText("mang", "Vựa cô Ba")).not.toContain("SDVICO");
  });
  it("mất sóng nói rõ 'chưa có sóng', không nói 'nhập đúng số'", () => {
    const t = sendFailureText("mang", "SDVICO 0939 243 222");
    expect(t).toContain("chưa có sóng");
    expect(t).not.toContain("Nhập đúng số");
  });
  it("SĐT sai mới nói về số điện thoại", () => {
    expect(sendFailureText("sdt", "X")).toContain("số điện thoại");
  });
});
