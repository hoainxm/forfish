import { describe, expect, it } from "vitest";
import {
  featureAccessDecision,
  readPremiumMark,
  shouldClearPremiumMark,
  type FeatureAccessInput,
  type PremiumMark,
} from "@/lib/tier";

/* Ba lỗi CHẶN của biên bản ops/audit-offline-2026-08-02 nằm gọn trong ba hàm
   thuần dưới đây: C-7 (auth-js tự xoá phiên) · C-8 (navigator.onLine là lá chắn
   duy nhất) · E5 (dấu hạng chỉ có hai trạng thái). Test canh đúng chỗ dây nối
   từng đứt (K7). */

describe("readPremiumMark — 'chưa biết' KHÁC 'hạng thường' (E5)", () => {
  it('"1" → premium, "0" → basic', () => {
    expect(readPremiumMark("1")).toBe("premium");
    expect(readPremiumMark("0")).toBe("basic");
  });

  it("khoá KHÔNG tồn tại → unknown, KHÔNG phải basic", () => {
    expect(readPremiumMark(null)).toBe("unknown");
    expect(readPremiumMark(undefined)).toBe("unknown");
  });

  it("giá trị lạ (tệp hỏng / sửa tay) → unknown", () => {
    expect(readPremiumMark("")).toBe("unknown");
    expect(readPremiumMark("true")).toBe("unknown");
    expect(readPremiumMark("premium")).toBe("unknown");
  });
});

describe("shouldClearPremiumMark — CHỈ đăng xuất thật mới được xoá quyền", () => {
  const base = {
    authReady: true,
    authErrored: false,
    hasUser: false,
    hasOfflineIdentity: false,
  };

  it("đăng xuất thật (kiểm xong, không lỗi, không user, máy đã quên ai) → XOÁ", () => {
    expect(shouldClearPremiumMark(base)).toBe(true);
  });

  it("C-8: onLine=true + kiểm xong + không lỗi + không user NHƯNG CÒN danh tính → KHÔNG xoá", () => {
    // đây đúng ca bác Tư premium giữa biển: auth-js đã tự xoá phiên nên
    // getUser() trả AuthSessionMissingError (400 — không phải lỗi mạng) ⇒
    // authErrored=false; tàu có router wifi nên onLine=true suốt chuyến.
    expect(
      shouldClearPremiumMark({ ...base, hasOfflineIdentity: true }),
    ).toBe(false);
  });

  it("auth HỎNG (mất sóng 'sống mà chết') → KHÔNG xoá", () => {
    expect(shouldClearPremiumMark({ ...base, authErrored: true })).toBe(false);
  });

  it("chưa kiểm xong phiên → KHÔNG xoá", () => {
    expect(shouldClearPremiumMark({ ...base, authReady: false })).toBe(false);
  });

  it("đang có user → KHÔNG xoá", () => {
    expect(shouldClearPremiumMark({ ...base, hasUser: true })).toBe(false);
  });

  it("navigator.onLine KHÔNG còn là một vế của điều kiện", () => {
    // hàm không nhận `online` — mất sóng hay có sóng đều ra cùng kết quả
    expect(Object.keys(base)).not.toContain("online");
  });
});

describe("featureAccessDecision × dấu hạng ba trạng thái", () => {
  /*  VIẾT LẠI 2026-09-02 theo luật MECE ba đầu vào. Mấy ca cũ phân biệt "mất
      sóng" / "sóng sống mà chết" / "đã tra xong hạng" — nay KHÔNG còn phân
      biệt được, vì luật mới không nhận `online`/`authErrored`/`premium` làm
      đầu vào nữa. Đó KHÔNG phải mất bảo đảm mà là bảo đảm MẠNH HƠN: ba cảnh đó
      trước đây đi ba nhánh khác nhau và mỗi nhánh là một chỗ để lọt; nay chúng
      là CÙNG MỘT đầu vào, nên không thể cho ra kết quả khác nhau.

      Ba luật CỐT LÕI của dấu ba trạng thái thì giữ nguyên và vẫn phải đúng. */
  const may = (mark: PremiumMark): FeatureAccessInput => ({
    configured: true,
    hasToken: true,
    mark,
  });

  it("CHƯA BAO GIỜ tra được hạng → checking (IM LẶNG, KHÔNG khẳng định 'thường')", () => {
    const a = featureAccessDecision(may("unknown"));
    expect(a).toBe("checking");
    // luật E5: thà không nói gì còn hơn nói "Tài khoản thường" với người vừa trả tiền
    expect(a).not.toBe("upgrade");
  });

  it("đã tra được, ĐÚNG LÀ hạng thường → upgrade (nói thật)", () => {
    expect(featureAccessDecision(may("basic"))).toBe("upgrade");
  });

  it("đã từng xác nhận premium → open (xem tiếp bản đã tải)", () => {
    expect(featureAccessDecision(may("premium"))).toBe("open");
  });

  it("MẤT SÓNG hay CÓ SÓNG đều CÙNG kết quả — không còn nhánh nào để lọt", () => {
    /*  Chốt bằng KIỂU: luật mới không có trường `online`/`authErrored`, nên
        không ai lén thêm một nhánh phụ thuộc mạng vào đây được nữa. */
    expect(Object.keys(may("premium")).sort()).toEqual([
      "configured",
      "hasToken",
      "mark",
    ]);
  });
});
