// Khuyến mãi SDVICO (2026-10-26, sứ định vị 500k giảm 200k ⇒ 300k — sửa 2026-10-27): danh mục, lời nhắn phiếu, tin Zalo cho Quân.
import { describe, expect, it } from "vitest";
import { chonMotKhuyenMai, conHieuLuc, doDaiClip, xepLuot, KHUYEN_MAI, nenChayClipNgan, KM_AC_QUY, KM_LOC_DAU, KM_LOC_NUOC, KM_SU_DINH_VI, khuyenMaiCuaPhieu, loiNhanDangKy, soLuongTuLoiNhan, tienVn, timBienThe, timKhuyenMai } from "@/data/khuyen-mai";
import { CHAT_KD, chatCuaPhieu, kiemPhieu, phieuDonCho, tinNhanKd } from "@/lib/sdvico/khach-hoi";

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
    expect(KHUYEN_MAI.map((k) => k.id)).toEqual(["su-dinh-vi-gps", "loc-dau-sf", "loc-nuoc-bien", "ac-quy-tau-ca"]);
  });
  it("phiếu lọc dầu đi nhóm Zalo 'Triển Khai Kinh Doanh', sứ vẫn về chat mặc định (Quân); clip có file thật", async () => {
    expect(KM_LOC_DAU.guiToi).toBe("Triển Khai Kinh Doanh");
    expect(KM_SU_DINH_VI.guiToi).toBeUndefined();
    expect(khuyenMaiCuaPhieu(KM_LOC_DAU.tenPhieu)?.guiToi).toBe("Triển Khai Kinh Doanh");
    const { existsSync, statSync } = await import("node:fs");
    for (const f of [KM_LOC_DAU.video!.src, KM_LOC_DAU.video!.poster]) {
      expect(existsSync(`public${f.split("?")[0]}`), f).toBe(true);
    }
    // clip không phình repo: dưới 8 MB (git giữ mọi bản vĩnh viễn — CLAUDE.md "chống phình")
    expect(statSync(`public${KM_LOC_DAU.video!.src.split("?")[0]}`).size).toBeLessThan(8 * 1024 * 1024);
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

describe("máy lọc nước + ắc quy (31/10)", () => {
  it("giá theo bảng: lọc nước cơ từ 38tr / điện từ 49,5tr (giá từ); ắc quy 4,2tr; đều đi nhóm KD", () => {
    expect(KM_LOC_NUOC.bienThe?.map((b) => b.gia)).toEqual([38_000_000, 49_500_000]);
    expect(KM_LOC_NUOC.giaTu).toBe(true);
    expect(KM_AC_QUY.giaApp).toBe(4_200_000);
    expect(KM_AC_QUY.video?.src.split("?")[0]).toBe("/sdvico/ac-quy.mp4"); // anh Long "làm cả video cho accu đi"
    for (const k of [KM_LOC_NUOC, KM_AC_QUY]) expect(k.guiToi).toBe("Triển Khai Kinh Doanh");
  });
  it("mọi clip có file thật, dưới 8 MB; tên phiếu không trùng", async () => {
    const { existsSync, statSync } = await import("node:fs");
    const { createHash } = await import("node:crypto");
    const { readFileSync } = await import("node:fs");
    for (const k of KHUYEN_MAI.filter((x) => x.video)) {
      for (const f of [k.video!.src, k.video!.poster, ...(k.video!.ngan ? [k.video!.ngan] : [])]) {
        const [duong, q] = f.split("?v=");
        expect(existsSync(`public${duong}`), f).toBe(true);
        // mã phiên bản PHẢI khớp file: dựng lại clip mà quên đổi ⇒ máy bà con giữ clip cũ trong kho SW mãi
        expect(q, f).toBe(createHash("sha1").update(readFileSync(`public${duong}`)).digest("hex").slice(0, 8));
      }
      expect(statSync(`public${k.video!.src.split("?")[0]}`).size, k.id).toBeLessThan(8 * 1024 * 1024);
    }
    expect(new Set(KHUYEN_MAI.map((k) => k.tenPhieu)).size).toBe(KHUYEN_MAI.length);
  });
});

describe("nhãn linh hoạt (31/10)", () => {
  it("mỗi món có 2+ nhãn, mỗi nhãn ≤4 chữ", () => {
    for (const k of KHUYEN_MAI) {
      expect(k.nhan?.length ?? 0, k.id).toBeGreaterThanOrEqual(2);
      for (const n of k.nhan!) expect(n.split(" ").length, n).toBeLessThanOrEqual(4);
    }
  });
});

describe("xoay quảng cáo — một món mỗi lần (31/10)", () => {
  const ids = (k: { id: string } | null) => k?.id ?? null;
  it("bỏ món vừa hiện, ưu tiên món chưa đăng ký, r chia đều", () => {
    const ds = KHUYEN_MAI;
    expect(chonMotKhuyenMai([], null, new Set(), 0.5)).toBeNull();
    for (let r = 0; r < 1; r += 0.07) expect(ids(chonMotKhuyenMai(ds, "loc-dau-sf", new Set(), r))).not.toBe("loc-dau-sf");
    const daDK = new Set(["su-dinh-vi-gps", "loc-dau-sf", "loc-nuoc-bien"]);
    expect(ids(chonMotKhuyenMai(ds, null, daDK, 0.3))).toBe("ac-quy-tau-ca");
    // đăng ký hết ⇒ vẫn xoay trong cả danh sách
    expect(chonMotKhuyenMai(ds, null, new Set(ds.map((k) => k.id)), 0.99)).not.toBeNull();
    // một món duy nhất ⇒ vẫn hiện dù vừa hiện
    expect(ids(chonMotKhuyenMai([KM_AC_QUY], "ac-quy-tau-ca", new Set(), 0.1))).toBe("ac-quy-tau-ca");
    const thay = new Set([0, 0.26, 0.51, 0.76].map((r) => ids(chonMotKhuyenMai(ds, null, new Set(), r))));
    expect(thay.size).toBe(4);
  });
});

describe("đơn chợ gian hàng SDVICO ⇒ phiếu ⇒ nhóm Zalo KD (31/10, hàng SDVICO đã có giá trong chợ)", () => {
  const don = {
    code: "SD261031ABCD",
    buyerPhone: "0905123456",
    items: [
      { title: "Máy lọc dầu diesel SF50 / SF300B", variantLabel: "Bản điện SF300B (bơm 12V)", qty: 1, lineTotalVnd: 9_900_000 },
      { title: "Điện thoại vệ tinh Thuraya MarineStar", variantLabel: "SIM VNPT", qty: 2, lineTotalVnd: 1_000_000 },
    ],
    totalVnd: 10_900_000,
    paymentMethod: "cod",
    address: { name: "Anh Tư", phone: "0905123456", province: "Bình Thuận", detail: "cảng Phan Thiết" },
    buyerNote: "tàu về thứ 7",
  };
  it("dòng phiếu đúng ràng buộc cột 0072 + đi nhóm KD", () => {
    const r = phieuDonCho(don)!;
    expect(r.san_pham).toBe("Đơn chợ SDVICO SD261031ABCD");
    expect(r.so_tau.length).toBeGreaterThanOrEqual(3);
    expect(r.cang).toBe("cảng Phan Thiết, Bình Thuận");
    expect(r.loi_nhan).toBe(
      "1 × Máy lọc dầu diesel SF50 / SF300B (Bản điện SF300B (bơm 12V)) 9.900.000đ; 2 × Điện thoại vệ tinh Thuraya MarineStar (SIM VNPT) 1.000.000đ · Tổng 10.900.000đ · trả khi nhận · khách ghi: tàu về thứ 7",
    );
    expect(chatCuaPhieu(r.san_pham)).toBe(CHAT_KD);
    expect(chatCuaPhieu(KM_LOC_DAU.tenPhieu)).toBe(CHAT_KD);
    expect(chatCuaPhieu(KM_SU_DINH_VI.tenPhieu)).toBeNull();
    expect(phieuDonCho({ ...don, buyerPhone: "x", address: { ...don.address, phone: "y" } })).toBeNull();
  });
  it("tin Zalo: đầu tin ĐƠN CHỢ SDVICO + mã, giao tới, hàng", () => {
    const r = phieuDonCho(don)!;
    const tin = tinNhanKd(
      { nguon: "san-pham", sanPham: r.san_pham, ten: r.ten, phone: r.phone, soTau: r.so_tau, cang: r.cang, loiNhan: r.loi_nhan, kairosPostId: null, kairosCommentId: null, createdAt: "2026-10-31T03:00:00Z" },
      null,
    );
    expect(tin.split("\n")[0]).toBe("[SDFish] ĐƠN CHỢ SDVICO SD261031ABCD — gọi xác nhận, hẹn lắp");
    expect(tin).toContain("- Giao tới: cảng Phan Thiết, Bình Thuận");
    expect(tin).toContain("- Hàng: 1 × Máy lọc dầu");
    expect(tin).not.toContain("Số tàu");
  });
});

describe("thẻ Hôm nay (31/10)", () => {
  it("mọi món có clip đều có clip ngắn ≤400 KB (tự chạy trên Trang chủ, không làm nặng 4G yếu)", async () => {
    const { statSync } = await import("node:fs");
    for (const k of KHUYEN_MAI.filter((x) => x.video)) {
      expect(k.video!.ngan, k.id).toBeTruthy();
      expect(statSync(`public${k.video!.ngan!.split("?")[0]}`).size, k.id).toBeLessThanOrEqual(400 * 1024);
    }
  });
  it("chỉ tự chạy khi sóng tốt, không giảm chuyển động, không tin bão mới", () => {
    expect(nenChayClipNgan({ songTot: true, giamChuyenDong: false, coBao: false })).toBe(true);
    expect(nenChayClipNgan({ songTot: false, giamChuyenDong: false, coBao: false })).toBe(false);
    expect(nenChayClipNgan({ songTot: true, giamChuyenDong: true, coBao: false })).toBe(false);
    expect(nenChayClipNgan({ songTot: true, giamChuyenDong: false, coBao: true })).toBe(false);
  });
  it("băng vuốt: món xoay đứng đầu, đủ mọi món, không lặp", () => {
    const ds = xepLuot(KM_LOC_NUOC, KHUYEN_MAI);
    expect(ds[0].id).toBe(KM_LOC_NUOC.id);
    expect(ds.length).toBe(KHUYEN_MAI.length);
    expect(new Set(ds.map((k) => k.id)).size).toBe(ds.length);
    expect(xepLuot(KM_SU_DINH_VI, [KM_SU_DINH_VI]).map((k) => k.id)).toEqual([KM_SU_DINH_VI.id]);
  });
  it("độ dài clip: 63 ⇒ 1:03, 46 ⇒ 0:46, số lạ không âm", () => {
    expect(doDaiClip(63)).toBe("1:03");
    expect(doDaiClip(46)).toBe("0:46");
    expect(doDaiClip(-5)).toBe("0:00");
  });
});
