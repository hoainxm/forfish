import { describe, expect, it } from "vitest";
import { dbErrorDetail } from "@/lib/db-error";

describe("dbErrorDetail", () => {
  it("trùng khoá duy nhất → nói rõ nghĩa nghiệp vụ (ca thật 2026-07-21)", () => {
    const d = dbErrorDetail({
      code: "23505",
      message: 'duplicate key value violates unique constraint "customers_phone_key"',
      details: "Key (phone)=(0901234567) already exists.",
    });
    expect(d).toMatch(/23505/);
    expect(d).toMatch(/chung SĐT/);
    expect(d).toMatch(/customers_phone_key/);
  });

  it("gộp code + message + details, ngăn bằng dấu —", () => {
    const d = dbErrorDetail({ code: "23502", message: "null value", details: "cột name" });
    expect(d).toBe("23502 (thiếu cột bắt buộc) — null value — cột name");
  });

  it("bỏ phần trùng lặp giữa message và details", () => {
    const d = dbErrorDetail({ code: "22P02", message: "trùng", details: "trùng" });
    expect(d).toBe("22P02 (sai định dạng dữ liệu) — trùng");
  });

  it("mã lạ vẫn trả code trần, không nuốt", () => {
    expect(dbErrorDetail({ code: "XX999", message: "lỗi lạ" })).toBe("XX999 — lỗi lạ");
  });

  it("chỉ có message, không code", () => {
    expect(dbErrorDetail({ message: "mất kết nối" })).toBe("mất kết nối");
  });

  it("rỗng / null → undefined để bỏ hẳn field khỏi response", () => {
    expect(dbErrorDetail(null)).toBeUndefined();
    expect(dbErrorDetail({})).toBeUndefined();
    expect(dbErrorDetail({ code: "  ", message: "" })).toBeUndefined();
  });

  it("cắt ngắn chuỗi quá dài (không làm phình log worker)", () => {
    const d = dbErrorDetail({ message: "x".repeat(500) });
    expect(d!.length).toBeLessThanOrEqual(200);
    expect(d!.endsWith("…")).toBe(true);
  });
});
