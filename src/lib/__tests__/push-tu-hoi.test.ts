import { describe, expect, it } from "vitest";
import { nenTuHoiQuyen, TU_HOI_GAP_MS, type TrangThaiTuHoi } from "@/lib/push-tu-hoi";

const NOW = 1_800_000_000_000;
const base: TrangThaiTuHoi = { hoTro: true, quyen: "default", userOff: false, online: true, lanHoiTruoc: null, now: NOW, path: "/" };

describe("nenTuHoiQuyen", () => {
  it("máy chưa được hỏi, có sóng ⇒ hỏi", () => {
    expect(nenTuHoiQuyen(base)).toBe(true);
    expect(nenTuHoiQuyen({ ...base, path: "/tau" })).toBe(true);
  });
  it("đã cho phép / đã chặn / không hỗ trợ ⇒ không hỏi", () => {
    expect(nenTuHoiQuyen({ ...base, quyen: "granted" })).toBe(false);
    expect(nenTuHoiQuyen({ ...base, quyen: "denied" })).toBe(false);
    expect(nenTuHoiQuyen({ ...base, quyen: undefined })).toBe(false);
    expect(nenTuHoiQuyen({ ...base, hoTro: false })).toBe(false);
  });
  it("bà con tự tắt / mất sóng / web quản trị ⇒ không hỏi", () => {
    expect(nenTuHoiQuyen({ ...base, userOff: true })).toBe(false);
    expect(nenTuHoiQuyen({ ...base, online: false })).toBe(false);
    expect(nenTuHoiQuyen({ ...base, path: "/quan-tri" })).toBe(false);
  });
  it("vừa hỏi (đóng hộp không chọn) ⇒ đợi đủ 3 ngày", () => {
    expect(nenTuHoiQuyen({ ...base, lanHoiTruoc: NOW - TU_HOI_GAP_MS + 1 })).toBe(false);
    expect(nenTuHoiQuyen({ ...base, lanHoiTruoc: NOW - TU_HOI_GAP_MS })).toBe(true);
  });
});
