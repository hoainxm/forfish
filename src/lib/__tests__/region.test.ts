import { describe, expect, it } from "vitest";
import { provinceKey, regionOf, relevanceRank } from "../region";

describe("provinceKey — chuẩn hóa tên tỉnh lệch nhau", () => {
  it("gộp các biến thể HCM về một khóa", () => {
    const k = provinceKey("Thành phố Hồ Chí Minh");
    expect(provinceKey("TP.HCM")).toBe(k);
    expect(provinceKey("tphcm")).toBe(k);
    expect(k).toBe("hochiminh");
  });
  it("bỏ 'Thành phố/Tỉnh' và dấu", () => {
    expect(provinceKey("Thành phố Đà Nẵng")).toBe(provinceKey("Đà Nẵng"));
    expect(provinceKey("Thành phố Hải Phòng")).toBe(provinceKey("Hải Phòng"));
    expect(provinceKey("Thành phố Cần Thơ")).toBe(provinceKey("Cần Thơ"));
  });
});

describe("regionOf", () => {
  it("xếp đúng miền", () => {
    expect(regionOf("Quảng Ninh")).toBe("bac");
    expect(regionOf("Khánh Hòa")).toBe("trung");
    expect(regionOf("TP.HCM")).toBe("nam");
    expect(regionOf("Cà Mau")).toBe("nam");
  });
  it("không rõ → null", () => {
    expect(regionOf("Hà Nội")).toBeNull();
    expect(regionOf(undefined)).toBeNull();
  });
});

describe("relevanceRank — tàu HCM không lôi vựa Bắc ra", () => {
  it("đúng tỉnh nhà = 0", () => {
    expect(relevanceRank("TP.HCM", "Thành phố Hồ Chí Minh")).toBe(0);
  });
  it("cùng miền = 1", () => {
    expect(relevanceRank("Cà Mau", "TP.HCM")).toBe(1); // cùng Nam
  });
  it("miền khác = 2", () => {
    expect(relevanceRank("Quảng Ninh", "TP.HCM")).toBe(2); // Bắc vs Nam
  });
  it("chưa đặt nhà = 2 (hiện tất cả)", () => {
    expect(relevanceRank("Cà Mau", undefined)).toBe(2);
  });
});
