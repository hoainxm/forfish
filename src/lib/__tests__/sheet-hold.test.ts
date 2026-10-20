import { describe, expect, it } from "vitest";
import { canAutoHide, canForceHide, heldAfterSize, mustOpenForBorder } from "@/lib/sheet-hold";

describe("luật thu ngăn gió sóng", () => {
  it("không khoá: đồng hồ thu được, lớp khác ép ẩn được", () => {
    expect(canAutoHide({ border: false, held: false })).toBe(true);
    expect(canForceHide({ border: false, held: false })).toBe(true);
  });
  it("'Giữ mở' chỉ chặn ĐỒNG HỒ — lớp nổi khác vẫn ép ẩn để không chồng bảng", () => {
    expect(canAutoHide({ border: false, held: true })).toBe(false);
    expect(canForceHide({ border: false, held: true })).toBe(true);
  });
  it("rất gần ranh giới chặn CẢ đồng hồ lẫn ép ẩn (không giấu cảnh báo)", () => {
    expect(canAutoHide({ border: true, held: false })).toBe(false);
    expect(canForceHide({ border: true, held: false })).toBe(false);
  });
  it("thu ngăn bằng bất cứ đường nào là bỏ ghim", () => {
    expect(heldAfterSize(true, "half")).toBe(true);
    expect(heldAfterSize(true, "hidden")).toBe(false);
    expect(heldAfterSize(true, "peek")).toBe(false);
    expect(heldAfterSize(false, "half")).toBe(false);
  });
});

describe("mustOpenForBorder", () => {
  it("sát ranh giới mà chỉ là viên → phải mở; đã mở / người dùng thu → không ép", () => {
    expect(mustOpenForBorder({ border: true, held: false }, "peek")).toBe(true);
    expect(mustOpenForBorder({ border: true, held: false }, "half")).toBe(false);
    expect(mustOpenForBorder({ border: true, held: false }, "hidden")).toBe(false);
    expect(mustOpenForBorder({ border: false, held: false }, "peek")).toBe(false);
  });
});
