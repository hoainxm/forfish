import { describe, expect, it } from "vitest";
import { docHomePhien, ghiHomePhien, HOME_PHIEN_KEY, provinceKey, regionOf, relevanceRank } from "../region";

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

describe("tỉnh tạm trong phiên — docHomePhien/ghiHomePhien (CC-09)", () => {
  function kho(init: Record<string, string> = {}) {
    const m = new Map(Object.entries(init));
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      m,
    };
  }
  it("ghi rồi đọc lại đúng tỉnh; xoá bằng null", () => {
    const k = kho();
    expect(ghiHomePhien("Khánh Hòa", k)).toBe(true);
    expect(k.m.get(HOME_PHIEN_KEY)).toBe(JSON.stringify({ province: "Khánh Hòa" }));
    expect(docHomePhien(k)).toBe("Khánh Hòa");
    expect(ghiHomePhien(null, k)).toBe(true);
    expect(docHomePhien(k)).toBeUndefined();
  });
  it("tên lệch (TP.HCM) quy về tên chuẩn; tỉnh lạ / JSON hỏng ⇒ undefined", () => {
    expect(docHomePhien(kho({ [HOME_PHIEN_KEY]: JSON.stringify({ province: "TP.HCM" }) }))).toBe(
      "Thành phố Hồ Chí Minh",
    );
    expect(docHomePhien(kho({ [HOME_PHIEN_KEY]: JSON.stringify({ province: "Hà Nội" }) }))).toBeUndefined();
    expect(docHomePhien(kho({ [HOME_PHIEN_KEY]: "{hỏng" }))).toBeUndefined();
    expect(docHomePhien(kho({ [HOME_PHIEN_KEY]: JSON.stringify({ province: 7 }) }))).toBeUndefined();
  });
  it("không có kho (SSR / bị chặn) ⇒ đọc undefined, ghi false — không ném", () => {
    expect(docHomePhien(null)).toBeUndefined();
    expect(ghiHomePhien("Cà Mau", null)).toBe(false);
    const hong = { getItem: () => null, setItem: () => { throw new Error("full"); }, removeItem: () => {} };
    expect(ghiHomePhien("Cà Mau", hong)).toBe(false);
  });
});
