import { describe, it, expect } from "vitest";
import { isNewBuild, dueForCheck, buildLabel, VERSION_CHECK_EVERY_MS } from "@/lib/app-version";

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

describe("buildLabel", () => {
  it("ngày + 7 ký tự mã đầu", () => {
    expect(buildLabel("2a59c1adfdabf983afa9ed65", "2026-10-05")).toBe("2026-10-05 · 2a59c1a");
  });

  it("mã rỗng ⇒ bản phát triển (bất kể ngày)", () => {
    expect(buildLabel("", "2026-10-05")).toBe("bản phát triển");
    expect(buildLabel("", "")).toBe("bản phát triển");
    expect(buildLabel("   ", "2026-10-05")).toBe("bản phát triển");
  });

  it("thiếu ngày ⇒ chỉ mã ngắn", () => {
    expect(buildLabel("2a59c1adfdabf983", "")).toBe("2a59c1a");
    expect(buildLabel("2a59c1adfdabf983", "  ")).toBe("2a59c1a");
  });

  it("mã ngắn hơn 7 ký tự ⇒ giữ nguyên", () => {
    expect(buildLabel("abc12", "2026-10-05")).toBe("2026-10-05 · abc12");
  });
});

describe("dueForCheck", () => {
  it("lần đầu luôn hỏi; sau đó giãn đúng khoảng", () => {
    expect(dueForCheck(null, 0)).toBe(true);
    expect(dueForCheck(1000, 1000 + VERSION_CHECK_EVERY_MS - 1)).toBe(false);
    expect(dueForCheck(1000, 1000 + VERSION_CHECK_EVERY_MS)).toBe(true);
  });
});
