import { describe, it, expect } from "vitest";
import { COASTAL_PROVINCES, provinceKey, tenTinhGon } from "@/lib/region";

describe("tenTinhGon — tên tỉnh gọn chỉ để hiển thị trên thẻ món", () => {
  it("TP.HCM ở mọi cách viết", () => {
    for (const s of ["Thành phố Hồ Chí Minh", "TP. Hồ Chí Minh", "tp hồ chí minh", "TP.HCM", "Sài Gòn"]) {
      expect(tenTinhGon(s), s).toBe("TP.HCM");
    }
  });
  it("Thành phố … → TP. …", () => {
    expect(tenTinhGon("Thành phố Đà Nẵng")).toBe("TP. Đà Nẵng");
    expect(tenTinhGon("thành phố  Hải Phòng")).toBe("TP. Hải Phòng");
    expect(tenTinhGon("TP Cần Thơ")).toBe("TP. Cần Thơ");
  });
  it("tỉnh thường giữ nguyên; rỗng ra rỗng", () => {
    expect(tenTinhGon("Khánh Hòa")).toBe("Khánh Hòa");
    expect(tenTinhGon("Gia Lai")).toBe("Gia Lai");
    expect(tenTinhGon("")).toBe("");
    expect(tenTinhGon(null)).toBe("");
    expect(tenTinhGon(undefined)).toBe("");
  });
  it("tên gọn vẫn chỉ về đúng tỉnh chuẩn (không làm lệch bộ lọc nếu lỡ dùng)", () => {
    for (const p of COASTAL_PROVINCES) {
      expect(provinceKey(tenTinhGon(p.name)), p.name).toBe(provinceKey(p.name));
    }
  });
});
