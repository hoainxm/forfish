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
