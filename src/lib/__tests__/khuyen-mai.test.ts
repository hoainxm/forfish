// Khuyến mãi SDVICO (2026-10-26, sứ định vị 500k giảm 200k ⇒ 300k — sửa 2026-10-27): danh mục, lời nhắn phiếu, tin Zalo cho Quân.
import { describe, expect, it } from "vitest";
import { conHieuLuc, KHUYEN_MAI, KHUYEN_MAI_TRANG_CHU, KM_GSHT_VIETTEL, KM_GSHT_VIFISH, KM_LOC_DAU, KM_LOC_NUOC, KM_SU_DINH_VI, KM_THURAYA, khuyenMaiCuaMonCho, khuyenMaiCuaPhieu, loiNhanDangKy, soLuongTuLoiNhan, tienVn, timBienThe, timKhuyenMai } from "@/data/khuyen-mai";
import { kiemPhieu, tinNhanKd } from "@/lib/sdvico/khach-hoi";

describe("danh mục khuyến mãi", () => {
  it("sứ định vị: 500k giảm 200k ⇒ 300k, tên phiếu ≤120, id không trùng", () => {
    expect(KM_SU_DINH_VI.giaThiTruong).toBe(500_000);
    expect(KM_SU_DINH_VI.giaApp).toBe(300_000);
    expect((KM_SU_DINH_VI.giaThiTruong ?? 0) - KM_SU_DINH_VI.giaApp).toBe(200_000);
    for (const k of KHUYEN_MAI) {
      expect(k.tenPhieu.length).toBeLessThanOrEqual(120);
      if (k.giaThiTruong != null) expect(k.giaApp).toBeLessThan(k.giaThiTruong);
      expect(k.giaApp).toBeGreaterThan(0);
      expect(k.qtyMax).toBeGreaterThanOrEqual(1);
    }
    expect(new Set(KHUYEN_MAI.map((k) => k.id)).size).toBe(KHUYEN_MAI.length);
    expect(timKhuyenMai("su-dinh-vi-gps")?.ten).toBe("Sứ định vị GPS");
    expect(timKhuyenMai("x")).toBeNull();
  });
  it("hiệu lực: hetHan null = còn; có hạn thì so ngày", () => {
    expect(conHieuLuc(KM_SU_DINH_VI, "2027-01-01")).toBe(true);
    const k = { ...KM_SU_DINH_VI, hetHan: "2026-11-30" };
    expect(conHieuLuc(k, "2026-11-30")).toBe(true);
    expect(conHieuLuc(k, "2026-12-01")).toBe(false);
  });
  it("tiền kiểu bà con", () => {
    expect(tienVn(200_000)).toBe("200.000đ");
    expect(tienVn(1_500_000)).toBe("1.500.000đ");
  });
  it("lời nhắn phiếu ⇄ số lượng", () => {
    const l = loiNhanDangKy({ qty: 2, noiNhan: " cảng Quy Nhơn ", ghiChu: "máy Haiyang" });
    expect(l).toBe("Đăng ký mua 2 cái · nhận tại cảng Quy Nhơn · ghi chú: máy Haiyang");
    expect(soLuongTuLoiNhan(l)).toBe(2);
    expect(soLuongTuLoiNhan("khách hỏi giá")).toBeNull();
    expect(loiNhanDangKy({ qty: 1, noiNhan: "Sa Huỳnh" })).toBe("Đăng ký mua 1 cái · nhận tại Sa Huỳnh");
  });
});

describe("máy lọc dầu SF50 / SF300B (2026-10-31, Tiến KD báo: cơ 7,9tr, điện 9,9tr — không giảm)", () => {
  it("hai bản cơ/điện đúng giá, giaApp = bản rẻ nhất, không giá gạch, nằm ngay sau sứ", () => {
    expect(KM_LOC_DAU.giaThiTruong).toBeNull();
    expect(KM_LOC_DAU.bienThe?.map((b) => [b.id, b.gia])).toEqual([["co", 7_900_000], ["dien", 9_900_000], ["tui", 190_000]]);
    // thẻ ghi "Từ <giá máy rẻ nhất>" — túi lọc là phụ kiện, không kéo giá thẻ xuống
    expect(KM_LOC_DAU.giaApp).toBe(KM_LOC_DAU.bienThe![0].gia);
    expect(KM_LOC_DAU.giaTu).toBe(true);
    for (const b of KM_LOC_DAU.bienThe!) expect(b.nhan.split(" ").length).toBeLessThanOrEqual(2);
    expect(KHUYEN_MAI_TRANG_CHU.map((k) => k.id)).toEqual(["su-dinh-vi-gps", "loc-dau-sf"]);
  });
  it("phiếu lọc dầu đi nhóm Zalo 'Triển Khai Kinh Doanh', sứ vẫn về chat mặc định (Quân); clip có file thật", async () => {
    expect(KM_LOC_DAU.guiToi).toBe("Triển Khai Kinh Doanh");
    expect(KM_SU_DINH_VI.guiToi).toBeUndefined();
    expect(khuyenMaiCuaPhieu(KM_LOC_DAU.tenPhieu)?.guiToi).toBe("Triển Khai Kinh Doanh");
    const { existsSync, statSync } = await import("node:fs");
    for (const f of [KM_LOC_DAU.video!.src, KM_LOC_DAU.video!.poster]) {
      expect(existsSync(`public${f}`), f).toBe(true);
    }
    // clip không phình repo: dưới 8 MB (git giữ mọi bản vĩnh viễn — CLAUDE.md "chống phình")
    expect(statSync(`public${KM_LOC_DAU.video!.src}`).size).toBeLessThan(8 * 1024 * 1024);
  });
  it("timBienThe: có bản ⇒ id đúng mới nhận; ưu đãi không bản ⇒ undefined", () => {
    expect(timBienThe(KM_LOC_DAU, "dien")?.gia).toBe(9_900_000);
    expect(timBienThe(KM_LOC_DAU, "x")).toBeNull();
    expect(timBienThe(KM_LOC_DAU, undefined)).toBeNull();
    expect(timBienThe(KM_SU_DINH_VI, "dien")).toBeUndefined();
  });
  it("lời nhắn ghi bản + giá, số lượng vẫn đọc ngược được; tin Zalo 'ĐĂNG KÝ MUA' không giá gạch", () => {
    const l = loiNhanDangKy({ qty: 1, noiNhan: "Quy Nhơn", bienThe: timBienThe(KM_LOC_DAU, "dien") });
    expect(l).toBe("Đăng ký mua 1 cái · bản điện SF300B 9.900.000đ · nhận tại Quy Nhơn");
    expect(soLuongTuLoiNhan(l)).toBe(1);
    const r = kiemPhieu({ nguon: "san-pham", sanPham: KM_LOC_DAU.tenPhieu, ten: "Anh Tư", phone: "0905123456", soTau: "BĐ-91234-TS", cang: "Quy Nhơn", loiNhan: l });
    if (!r.ok) throw new Error(r.code);
    const tin = tinNhanKd({ ...r.value, createdAt: "2026-10-31T03:00:00Z" }, null);
    expect(tin.split("\n")[0]).toBe("[SDFish] ĐĂNG KÝ MUA: Máy lọc dầu SF50 / SF300B");
    expect(tin).toContain("bản điện SF300B 9.900.000đ");
    expect(tin).not.toContain("giá thị trường");
  });
});

describe("bảng giá SDVICO 31/10 (ảnh anh Long gửi) — món chợ ⇒ giá + Đăng ký ⇒ nhóm KD", () => {
  it("giá đúng bảng, đã gồm VAT", () => {
    expect(KM_GSHT_VIETTEL.giaApp).toBe(23_601_000);
    expect(KM_GSHT_VIFISH.giaApp).toBe(24_000_000);
    expect(KM_LOC_NUOC.bienThe?.map((b) => [b.id, b.gia, b.tu])).toEqual([["co", 38_000_000, true], ["dien", 49_500_000, true]]);
    expect(KM_THURAYA.bienThe?.map((b) => b.gia)).toEqual([37_800_000, 28_080_000, 9_900_000, 1_400_000, 500_000, 250_000, 200_000]);
    expect(KM_THURAYA.giaApp).toBe(37_800_000);
  });
  it("mọi món trừ sứ đi nhóm 'Triển Khai Kinh Doanh'; tên phiếu không trùng; chip ≤2 chữ, mỗi bản có câu khác nhau", () => {
    for (const k of KHUYEN_MAI) {
      expect(k.guiToi, k.id).toBe(k.id === "su-dinh-vi-gps" ? undefined : "Triển Khai Kinh Doanh");
      for (const b of k.bienThe ?? []) {
        expect(b.nhan.split(" ").length, b.nhan).toBeLessThanOrEqual(2);
        expect(b.khac, `${k.id}/${b.id}`).toBeTruthy();
      }
    }
    expect(new Set(KHUYEN_MAI.map((k) => k.tenPhieu)).size).toBe(KHUYEN_MAI.length);
  });
  it("khớp món chợ theo id prod hoặc theo tên; món khác ⇒ null", () => {
    expect(khuyenMaiCuaMonCho({ id: "411149d5-212f-4d3c-984e-b07dccb5b24f", title: "x" })?.id).toBe("gsht-s-tracking");
    expect(khuyenMaiCuaMonCho({ id: "dev-1", title: "Điện thoại vệ tinh Thuraya MarineStar" })?.id).toBe("thuraya-marinestar");
    expect(khuyenMaiCuaMonCho({ id: "x", title: "Sơn tàu biển PV Paint" })).toBeNull();
  });
  it("lời nhắn ghi giá 'từ' cho bản giá theo cấu hình", () => {
    expect(loiNhanDangKy({ qty: 1, noiNhan: "Phan Thiết", bienThe: timBienThe(KM_LOC_NUOC, "dien") })).toBe(
      "Đăng ký mua 1 cái · bản điện từ 49.500.000đ · nhận tại Phan Thiết",
    );
  });
});

describe("phiếu đăng ký KM đi qua kiemPhieu + tinNhanKd", () => {
  const raw = {
    nguon: "san-pham", sanPham: KM_SU_DINH_VI.tenPhieu, ten: "Anh Tư", phone: "0905123456", soTau: "BĐ-91234-TS", cang: "Quy Nhơn",
    loiNhan: loiNhanDangKy({ qty: 2, noiNhan: "Quy Nhơn" }),
  };
  it("kiemPhieu giữ nguyên tên phiếu KM (không phải tên showcase)", () => {
    const r = kiemPhieu(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sanPham).toBe(KM_SU_DINH_VI.tenPhieu);
    expect(khuyenMaiCuaPhieu(KM_SU_DINH_VI.tenPhieu)?.id).toBe("su-dinh-vi-gps");
    expect(khuyenMaiCuaPhieu("Thuraya")).toBeNull();
  });
  it("tin Zalo cho Quân: đầu tin ĐĂNG KÝ MUA KM + giá + số lượng + nhận tại", () => {
    const r = kiemPhieu(raw);
    if (!r.ok) throw new Error(r.code);
    const tin = tinNhanKd({ ...r.value, createdAt: "2026-10-26T03:00:00Z" }, null);
    expect(tin.split("\n")[0]).toBe("[SDFish] ĐĂNG KÝ MUA KM: Sứ định vị GPS 300.000đ (giá thị trường 500.000đ)");
    expect(tin).toContain("- SĐT: 0905123456");
    expect(tin).toContain("- Số tàu: BĐ-91234-TS");
    expect(tin).toContain("- Nhận tại: Quy Nhơn");
    expect(tin).toContain("- Số lượng: 2");
    expect(tin).toContain("thẻ khuyến mãi trong app");
    expect(tin).not.toContain("Cảng lắp");
  });
  it("phiếu thường vẫn là 'Khách hỏi …' như cũ", () => {
    const r = kiemPhieu({ ...raw, sanPham: "gsht-viettel-s-tracking", loiNhan: null });
    if (!r.ok) throw new Error(r.code);
    expect(tinNhanKd({ ...r.value, createdAt: "2026-10-26T03:00:00Z" }, null).split("\n")[0]).toMatch(/^\[SDFish\] Khách hỏi /);
  });
});
