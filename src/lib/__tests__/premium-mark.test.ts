import { describe, expect, it } from "vitest";
import {
  featureAccessDecision,
  readPremiumMark,
  shouldClearPremiumMark,
  type FeatureAccessInput,
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
  const base: FeatureAccessInput = {
    configured: true,
    authReady: true,
    hasUser: true,
    premium: null,
    online: true,
    cachedMark: "unknown",
  };

  it("MẤT SÓNG + chưa bao giờ tra được hạng → checking (IM LẶNG, không 'upgrade')", () => {
    const a = featureAccessDecision({ ...base, online: false, cachedMark: "unknown" });
    expect(a).toBe("checking");
    expect(a).not.toBe("upgrade"); // không khẳng định "Tài khoản thường"
  });

  it("MẤT SÓNG + đã tra được, đúng là hạng thường → upgrade (nói thật)", () => {
    expect(
      featureAccessDecision({ ...base, online: false, cachedMark: "basic" }),
    ).toBe("upgrade");
  });

  it("MẤT SÓNG + đã từng premium → open (xem tiếp bản đã tải ở bờ)", () => {
    expect(
      featureAccessDecision({ ...base, online: false, cachedMark: "premium" }),
    ).toBe("open");
  });

  it("sóng 'sống mà chết' (authErrored) cũng đi đúng ba nhánh đó", () => {
    const errored = { ...base, online: true, authErrored: true };
    expect(featureAccessDecision({ ...errored, cachedMark: "unknown" })).toBe(
      "checking",
    );
    expect(featureAccessDecision({ ...errored, cachedMark: "basic" })).toBe(
      "upgrade",
    );
    expect(featureAccessDecision({ ...errored, cachedMark: "premium" })).toBe(
      "open",
    );
  });

  it("máy MỚI TINH (chưa ai đăng nhập) + mất sóng → login, không bắt nhìn vòng quay", () => {
    expect(
      featureAccessDecision({
        ...base,
        online: false,
        hasUser: false,
        cachedMark: "unknown",
      }),
    ).toBe("login");
  });

  it("đã tra XONG hạng thì kết quả tươi thắng dấu cũ (getUser hết giờ không kéo lùi)", () => {
    expect(
      featureAccessDecision({
        ...base,
        premium: true,
        authErrored: true,
        cachedMark: "unknown",
      }),
    ).toBe("open");
  });
});
