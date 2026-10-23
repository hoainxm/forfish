import { describe, it, expect } from "vitest";
import { anKhiCuon } from "@/lib/sen-bien/an-khi-cuon";

describe("anKhiCuon — icon Sen Biển lùi khi cuộn xuống, về khi cuộn lên", () => {
  it("cuộn xuống quá 8px (không ở đầu trang) → ẩn", () => {
    expect(anKhiCuon(200, 260, false)).toBe(true);
  });
  it("cuộn lên quá 8px → hiện", () => {
    expect(anKhiCuon(400, 380, true)).toBe(false);
  });
  it("rung tay dưới 8px → giữ nguyên trạng thái", () => {
    expect(anKhiCuon(300, 305, true)).toBe(true);
    expect(anKhiCuon(300, 296, false)).toBe(false);
  });
  it("về gần đầu trang → luôn hiện", () => {
    expect(anKhiCuon(120, 30, true)).toBe(false);
    expect(anKhiCuon(0, 40, true)).toBe(false);
  });
});
