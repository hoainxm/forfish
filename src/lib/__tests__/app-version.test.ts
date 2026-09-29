import { describe, it, expect } from "vitest";
import { isNewBuild, dueForCheck, VERSION_CHECK_EVERY_MS } from "@/lib/app-version";

describe("isNewBuild", () => {
  it("mã máy chủ khác mã đang chạy ⇒ có bản mới", () => {
    expect(isNewBuild("abc123", "def456")).toBe(true);
  });

  it("trùng mã ⇒ không báo", () => {
    expect(isNewBuild("abc123", "abc123")).toBe(false);
    expect(isNewBuild("abc123", " abc123 ")).toBe(false);
  });

  it("mã nào rỗng/sai kiểu ⇒ KHÔNG báo (dev, tự host, route hỏng)", () => {
    expect(isNewBuild("", "def456")).toBe(false);
    expect(isNewBuild("abc123", "")).toBe(false);
    expect(isNewBuild("abc123", null)).toBe(false);
    expect(isNewBuild("abc123", 42)).toBe(false);
  });
});

describe("dueForCheck", () => {
  it("lần đầu luôn hỏi; sau đó giãn đúng khoảng", () => {
    expect(dueForCheck(null, 0)).toBe(true);
    expect(dueForCheck(1000, 1000 + VERSION_CHECK_EVERY_MS - 1)).toBe(false);
    expect(dueForCheck(1000, 1000 + VERSION_CHECK_EVERY_MS)).toBe(true);
  });
});
