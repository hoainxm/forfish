import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "@/lib/push-client";

describe("urlBase64ToUint8Array", () => {
  it("giải mã đúng chuỗi base64url không padding", () => {
    // "hello" base64url không padding = "aGVsbG8"
    const bytes = urlBase64ToUint8Array("aGVsbG8");
    const text = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join("");
    expect(text).toBe("hello");
  });

  it("chấp nhận ký tự - và _ (base64url) thay vì + và /", () => {
    // base64 chuẩn "surface" (chứa +) → base64url "surface"-hoá thủ công để test roundtrip
    const std = btoa("sub?jects>");
    const urlSafe = std.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const bytes = urlBase64ToUint8Array(urlSafe);
    const text = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join("");
    expect(text).toBe("sub?jects>");
  });

  it("độ dài mảng khớp độ dài chuỗi gốc", () => {
    const bytes = urlBase64ToUint8Array("aGVsbG8");
    expect(bytes.length).toBe(5);
  });
});

import { decideRekey, sameServerKey } from "@/lib/push-client";

describe("sameServerKey — đăng ký có dùng đúng khoá server không", () => {
  const key = "BA7gxuKUApzkQIdGEDwnTC"; // base64url bất kỳ, đủ để so byte
  const bytes = (s: string) => urlBase64ToUint8Array(s).buffer as ArrayBuffer;

  it("trùng byte → true; khác → false", () => {
    expect(sameServerKey(bytes(key), key)).toBe(true);
    expect(sameServerKey(bytes("ZZ7gxuKUApzkQIdGEDwnTC"), key)).toBe(false);
    expect(sameServerKey(bytes("BA7g"), key)).toBe(false); // khác độ dài
  });

  it("trình duyệt cũ không cho biết khoá (null) → null = KHÔNG BIẾT, không phải lệch", () => {
    expect(sameServerKey(null, key)).toBeNull();
    expect(sameServerKey(undefined, key)).toBeNull();
  });

  it("khoá server sai dạng → null, không ném", () => {
    expect(sameServerKey(bytes(key), "%%%không-phải-base64%%%")).toBeNull();
  });
});

describe("decideRekey", () => {
  const base = {
    permission: "granted" as const,
    hasSubscription: true,
    pending: false,
    serverKey: true,
    keyMatch: true as boolean | null,
  };

  it("khoá lệch chắc chắn → rotate", () => {
    expect(decideRekey({ ...base, keyMatch: false })).toBe("rotate");
  });

  it("khoá khớp / không biết → keep (trình duyệt cũ giữ nguyên)", () => {
    expect(decideRekey(base)).toBe("keep");
    expect(decideRekey({ ...base, keyMatch: null })).toBe("keep");
  });

  it("chưa cấp quyền / không hỏi được khoá (mất sóng) → keep", () => {
    expect(decideRekey({ ...base, keyMatch: false, permission: "default" })).toBe("keep");
    expect(decideRekey({ ...base, keyMatch: false, permission: "denied" })).toBe("keep");
    expect(decideRekey({ ...base, keyMatch: false, permission: "unsupported" })).toBe("keep");
    expect(decideRekey({ ...base, keyMatch: false, serverKey: false })).toBe("keep");
  });

  it("không có đăng ký: có dấu đổi dở → resubscribe; không dấu (tự tắt) → keep", () => {
    expect(decideRekey({ ...base, hasSubscription: false, pending: true, keyMatch: null })).toBe("resubscribe");
    expect(decideRekey({ ...base, hasSubscription: false, pending: false, keyMatch: null })).toBe("keep");
  });
});
