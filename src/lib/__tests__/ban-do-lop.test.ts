import { describe, expect, it } from "vitest";

import { cheDoBanDo, lopHien, LOP_THEO_CHE_DO } from "@/lib/ban-do-lop";

describe("cheDoBanDo — một trạng thái cho cả bản đồ (kiểu Vietmap)", () => {
  const tat = { dan: false, tuyen: false, tim: false, bang: false };
  it("ưu tiên dẫn > tuyến > tìm > bảng > rảnh", () => {
    expect(cheDoBanDo(tat)).toBe("ranh");
    expect(cheDoBanDo({ ...tat, bang: true })).toBe("bang");
    expect(cheDoBanDo({ ...tat, bang: true, tim: true })).toBe("tim");
    expect(cheDoBanDo({ ...tat, tim: true, tuyen: true })).toBe("tuyen");
    expect(cheDoBanDo({ dan: true, tuyen: true, tim: true, bang: true })).toBe("dan");
  });
});

describe("LOP_THEO_CHE_DO", () => {
  it("rảnh hiện đủ", () => {
    expect(LOP_THEO_CHE_DO.ranh.size).toBe(10);
  });
  it("đang tìm: chỉ còn ô tìm (không dock, không nút nổi)", () => {
    expect([...LOP_THEO_CHE_DO.tim]).toEqual(["oTim"]);
  });
  it("dẫn đường: không dock, không rail, không ô toạ độ — còn Sen Biển + về tàu", () => {
    for (const l of ["dock", "rail", "toaDo", "oTim", "nutLoa", "ngan"] as const) expect(lopHien("dan", l)).toBe(false);
    expect(lopHien("dan", "senBien")).toBe(true);
    expect(lopHien("dan", "nutViTri")).toBe(true);
  });
  it("xem tuyến: không dock (bảng Lộ trình là việc chính), còn Lớp", () => {
    expect(lopHien("tuyen", "dock")).toBe(false);
    expect(lopHien("tuyen", "rail")).toBe(true);
  });
  it("đang mở bảng: nút nổi bên phải + tốc độ + ô toạ độ nhường chỗ, dock còn", () => {
    for (const l of ["nutLoa", "nutViTri", "tocDo", "toaDo", "senBien"] as const) expect(lopHien("bang", l)).toBe(false);
    expect(lopHien("bang", "dock")).toBe(true);
  });
});
