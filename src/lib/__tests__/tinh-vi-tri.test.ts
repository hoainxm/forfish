// 14 §21c (sửa 2026-11-06): tỉnh theo vị trí máy cho tab Chính sách — cảng cá gần nhất, không mạng.
import { describe, expect, it } from "vitest";
import { provinceIdOf } from "@/lib/kairos/khu-vuc.mjs";
import { NEVER_BACKUP_PREFIXES } from "@/lib/offline-backup";
import { chonTinhTuDong, docTinhViTri, ghiTinhViTri, TINH_HET_HAN_MS, TINH_VI_TRI_KEY, tinhTuToaDo } from "@/lib/tinh-vi-tri";

const NOW = Date.parse("2026-11-06T08:00:00Z");

function khoGia(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
}

describe("toạ độ ⇒ tỉnh (danh bạ cảng cá thật)", () => {
  it("Vũng Tàu, Cần Giờ ⇒ TP HCM; mã tỉnh Kairos khớp", () => {
    const vt = tinhTuToaDo(10.346, 107.084);
    expect(vt).toBe("Thành phố Hồ Chí Minh");
    expect(provinceIdOf(vt)).toBe("ho-chi-minh");
    expect(tinhTuToaDo(10.41, 106.95)).toBe("Thành phố Hồ Chí Minh");
  });
  it("Quy Nhơn ⇒ Gia Lai; Nha Trang ⇒ Khánh Hòa; Hạ Long ⇒ Quảng Ninh", () => {
    expect(tinhTuToaDo(13.77, 109.23)).toBe("Gia Lai");
    expect(tinhTuToaDo(12.24, 109.19)).toBe("Khánh Hòa");
    expect(tinhTuToaDo(20.95, 107.08)).toBe("Quảng Ninh");
  });
  it("giữa Biển Đông (xa bờ > 150 km) / toạ độ hỏng ⇒ null (lùi về cảng nhà)", () => {
    expect(tinhTuToaDo(12.0, 113.5)).toBeNull();
    expect(tinhTuToaDo(NaN, 107)).toBeNull();
    expect(tinhTuToaDo(95, 107)).toBeNull();
  });
  it("chọn cảng GẦN NHẤT, bỏ cảng thiếu toạ độ / tỉnh lạ", () => {
    const cang = [
      { province: "Khánh Hòa", lat: 12.2, lng: 109.2 },
      { province: "Gia Lai", lat: 13.8, lng: 109.2 },
      { province: "Không có", lat: 12.21, lng: 109.2 },
      { province: "Đà Nẵng" },
    ];
    expect(tinhTuToaDo(12.25, 109.2, cang)).toBe("Khánh Hòa");
    expect(tinhTuToaDo(12.25, 109.2, cang, 1)).toBeNull();
  });
  it("bỏ cảng toạ độ sai rõ (PORT_COORD_SAI) — 'Phường 6 Thắng Nhì' Vũng Tàu ghi toạ độ Nha Trang", () => {
    expect(tinhTuToaDo(12.2517, 109.1962)).toBe("Khánh Hòa");
  });
});

describe("tự chọn tỉnh — không bắt bà con thao tác (anh Long 06/11)", () => {
  it("vị trí máy > tỉnh tàu > cảng nhà; tên lệch dạng vẫn ra tên chuẩn", () => {
    expect(chonTinhTuDong({ viTri: "Thành phố Hồ Chí Minh", tinhTau: "Gia Lai", tinhCangNha: "Khánh Hòa" })).toEqual({ province: "Thành phố Hồ Chí Minh", nguon: "vi-tri" });
    expect(chonTinhTuDong({ viTri: null, tinhTau: "Gia Lai", tinhCangNha: "Khánh Hòa" })).toEqual({ province: "Gia Lai", nguon: "tau" });
    expect(chonTinhTuDong({ tinhCangNha: "TP.HCM" })).toEqual({ province: "Thành phố Hồ Chí Minh", nguon: "cang-nha" });
  });
  it("nguồn rác / không có gì ⇒ null (Cả nước); nguồn rác không chặn nguồn sau", () => {
    expect(chonTinhTuDong({})).toBeNull();
    expect(chonTinhTuDong({ viTri: "Sao Hỏa", tinhTau: "", tinhCangNha: "Cà Mau" })).toEqual({ province: "Cà Mau", nguon: "cang-nha" });
  });
});

describe("kho tỉnh đã đo", () => {
  it("ghi rồi đọc lại; hết hạn 7 ngày / giờ tương lai / tỉnh lạ / JSON hỏng ⇒ null", () => {
    const k = khoGia();
    expect(ghiTinhViTri("Gia Lai", NOW, k)).toBe(true);
    expect(docTinhViTri(NOW + 3600_000, k)).toEqual({ province: "Gia Lai", at: NOW });
    expect(docTinhViTri(NOW + TINH_HET_HAN_MS + 1, k)).toBeNull();
    expect(docTinhViTri(NOW - 3600_000, k)).toBeNull();
    expect(docTinhViTri(NOW, khoGia({ [TINH_VI_TRI_KEY]: JSON.stringify({ province: "Sao Hỏa", at: NOW }) }))).toBeNull();
    expect(docTinhViTri(NOW, khoGia({ [TINH_VI_TRI_KEY]: "{hỏng" }))).toBeNull();
    expect(docTinhViTri(NOW, null)).toBeNull();
  });
  it("máy không ghi được ⇒ false, không ném", () => {
    const k = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); } };
    expect(ghiTinhViTri("Gia Lai", NOW, k)).toBe(false);
    expect(ghiTinhViTri("Gia Lai", NOW, null)).toBe(false);
  });
  it("khoá đúng quy ước forfish.* và KHÔNG chép sang máy khác (sao lưu bỏ qua)", () => {
    expect(TINH_VI_TRI_KEY).toMatch(/^forfish\.[a-z.]+\.v1$/);
    expect(NEVER_BACKUP_PREFIXES.some((p) => TINH_VI_TRI_KEY.startsWith(p))).toBe(true);
  });
});
