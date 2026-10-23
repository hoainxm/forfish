import { describe, expect, it } from "vitest";
import { demChu, NHAN, NHAN_CHIP_KAIROS, NHAN_TOI_DA_CHU, nhanHopLe } from "@/lib/labels";
import { CHIPS } from "@/lib/kairos/thoi-quen";

describe("labels — bảng nhãn chuẩn ≤2 chữ (anh Long 2026-10-19)", () => {
  it("mọi nhãn trong bảng ≤2 chữ, không rỗng, không trùng", () => {
    const vals = Object.values(NHAN);
    for (const v of vals) {
      expect(v.trim(), v).toBe(v);
      expect(demChu(v), `"${v}" quá ${NHAN_TOI_DA_CHU} chữ`).toBeLessThanOrEqual(NHAN_TOI_DA_CHU);
    }
    expect(new Set(vals).size).toBe(vals.length);
  });

  it("đếm chữ: số và dấu không tính, 'Sen Biển' là một tên", () => {
    expect(demChu("Xem thêm")).toBe(2);
    expect(demChu("Xem thêm 19")).toBe(2);
    expect(demChu("Tin mua/bán")).toBe(3);
    expect(demChu("Gọi Sen Biển")).toBe(2);
    expect(demChu("Yêu cầu gia hạn của tôi")).toBe(6);
    expect(nhanHopLe("Đăng nhập")).toBe(true);
    expect(nhanHopLe("Tạo tài khoản")).toBe(false);
  });

  it("chip Kairos: đủ mã chip, mỗi nhãn ≤2 chữ, không trùng (AC03)", () => {
    expect(Object.keys(NHAN_CHIP_KAIROS).sort()).toEqual([...CHIPS].sort());
    const vals = Object.values(NHAN_CHIP_KAIROS);
    for (const v of vals) expect(nhanHopLe(v), v).toBe(true);
    expect(new Set(vals).size).toBe(vals.length);
  });
});
