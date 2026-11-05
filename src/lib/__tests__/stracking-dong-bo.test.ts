import { describe, expect, it } from "vitest";
import {
  banGuiCanhBao,
  banGuiThietBi,
  chuanSdt,
  docBang,
  docCanhBao,
  docHetHan,
  docPhuongTien,
  docTongCong,
  gopThietBi,
  homNayVn,
  kiemGoiNhap,
  laDuongDoc,
  laTrangDangNhap,
  lucIso,
  ngayIso,
  thanCanhBao,
  thanHetHan,
  thanPhuongTien,
  trangThaiHan,
  dauNgayVnIso,
} from "@/lib/stracking/dong-bo.mjs";

describe("thân yêu cầu", () => {
  it("form Phương tiện đủ 14 điều kiện, trang + cỡ", () => {
    const p = new URLSearchParams(thanPhuongTien(3, 1000));
    expect(p.get("page")).toBe("3");
    expect(p.get("pageSize")).toBe("1000");
    expect(p.get("conditionList[6].fieldName")).toBe("phoneShipowner1");
    expect(p.get("conditionList[13].fieldValue")).toBe("any");
    expect([...p.keys()].filter((k) => k.endsWith(".fieldName"))).toHaveLength(14);
  });
  it("form Cảnh báo mới trước, mọi kiểu", () => {
    const p = new URLSearchParams(thanCanhBao(1));
    expect(p.get("sortFieldName")).toBe("logDate");
    expect(p.get("isDesc")).toBe("true");
    expect(p.get("conditionList[4].fieldValue")).toBe("any");
  });
  it("JSON báo cáo dịch vụ lấy cả trong bờ lẫn ngoài khơi", () => {
    const j = JSON.parse(thanHetHan(2, 500));
    expect(j).toMatchObject({ page: "2", pageSize: "500", data: { isLand: "", isExpired: "" } });
  });
});

// Bảng mẫu dựng theo cấu trúc thật của trang /deviceAisList (dò 2026-11-05): một <thead>, ô chữ trơn,
// cột Thao tác có <a><i>. Dữ liệu là số giả.
const TIEU_DE_PT = [
  "STT", "Tên phương tiện", "IMEI", "Serial", "MMSI", "Tên thuyền trưởng", "SĐT thuyền trưởng", "ĐC thuyền trưởng",
  "Tên chủ tàu", "SĐT chủ tàu", "Địa chỉ chủ tàu", "SĐT người thân", "SĐT quản lý", "Số niêm phong",
  "Thời gian niêm phong", "Thời gian đăng ký", "Thời gian hết hạn", "Bắt đầu tạm ngưng", "Kết thúc tạm ngưng",
  "Đồng bộ Tổng cục", "Nhóm", "Ngày tạo", "Ngày cập nhật", "Trong bờ", "Thao tác",
];
function hangPT(o: Partial<Record<string, string>>) {
  return TIEU_DE_PT.map((t) => (t === "Thao tác" ? `<td class="x"><a href="#"><i class="fa"></i></a></td>` : `<td>${o[t] ?? ""}</td>`)).join("");
}
function bangHtml(tieuDe: string[], hang: string[]) {
  return `<html><body><p>Tổng cộng: 16.055</p><table class="tb" id="myTable">
    <thead><tr>${tieuDe.map((t) => `<th data-field="x">\n  ${t}\n</th>`).join("")}</tr></thead>
    <tbody>${hang.map((h) => `<tr>${h}</tr>`).join("\n")}</tbody></table></body></html>`;
}

describe("chuẩn hoá", () => {
  it("SĐT: 9 số mất số 0, 84…, có dấu cách; số sai ⇒ null", () => {
    expect(chuanSdt("967214151")).toBe("0967214151");
    expect(chuanSdt("0967214151")).toBe("0967214151");
    expect(chuanSdt("84967214151")).toBe("0967214151");
    expect(chuanSdt("+84 967 214 151")).toBe("0967214151");
    expect(chuanSdt("")).toBeNull();
    expect(chuanSdt(null)).toBeNull();
    expect(chuanSdt("12345")).toBeNull();
    expect(chuanSdt("00967214151")).toBeNull();
  });
  it("ngày dd/mm/yyyy ⇒ yyyy-mm-dd, ngày không có thật ⇒ null", () => {
    expect(ngayIso("18/11/2026")).toBe("2026-11-18");
    expect(ngayIso("5/1/2027 10:00:00")).toBe("2027-01-05");
    expect(ngayIso("31/02/2026")).toBeNull();
    expect(ngayIso("")).toBeNull();
  });
  it("giờ VN ⇒ ISO UTC", () => {
    expect(lucIso("05/11/2026 15:47:45")).toBe("2026-11-05T08:47:45.000Z");
    expect(lucIso("05/11/2026")).toBe("2026-11-04T17:00:00.000Z");
    expect(lucIso("05/11/2026 25:00:00")).toBeNull();
  });
  it("hôm nay theo giờ VN (UTC 18:00 đã là ngày hôm sau)", () => {
    expect(homNayVn(Date.parse("2026-11-05T18:00:00Z"))).toBe("2026-11-06");
    expect(homNayVn(Date.parse("2026-11-05T16:59:00Z"))).toBe("2026-11-05");
  });
});

describe("đường gọi", () => {
  it("chỉ ba đường đọc — form xoá thiết bị bị chặn", () => {
    expect(laDuongDoc("/deviceAisList")).toBe(true);
    expect(laDuongDoc("/report/expiredDevice")).toBe(true);
    expect(laDuongDoc("/report/eventAlarmList")).toBe(true);
    expect(laDuongDoc("/delDeviceAis")).toBe(false);
    expect(laDuongDoc("/deviceAisList/../delDeviceAis")).toBe(false);
  });
  it("nhận ra trang đăng nhập (phiên hết)", () => {
    const login = `<form action="/login" method="post"><input name="login"><input type="password" name="password"></form>`;
    expect(laTrangDangNhap(login)).toBe(true);
    expect(laTrangDangNhap(bangHtml(TIEU_DE_PT, []))).toBe(false);
  });
});

describe("đọc bảng Phương tiện", () => {
  const html = bangHtml(TIEU_DE_PT, [
    hangPT({
      STT: "1", "Tên phương tiện": "BV-92858-TS", IMEI: "301434060586560", Serial: "MTR032026D006069",
      "Tên chủ tàu": "Nguyễn Văn A", "SĐT chủ tàu": "967214151", "SĐT thuyền trưởng": "0911222333",
      "Địa chỉ chủ tàu": "Bà Rịa &amp; Vũng Tàu", "Thời gian đăng ký": "01/03/2026", "Thời gian hết hạn": "18/11/2026",
      "Ngày cập nhật": "05/11/2026 15:00:54", "Trong bờ": "Trong bờ",
    }),
    hangPT({ STT: "2", "Tên phương tiện": "KG-1-TS", IMEI: "1", Serial: "", "Trong bờ": "Ngoài khơi" }),
    hangPT({ STT: "3", "Tên phương tiện": "KG-2-TS", IMEI: "2", Serial: "S2", "Trong bờ": "Ngoài khơi" }),
  ]);

  it("đọc theo TÊN cột, giải thực thể, bỏ hàng không serial", () => {
    const b = docBang(html);
    expect(b?.tieuDe).toHaveLength(25);
    const ds = docPhuongTien(b);
    expect(ds).toHaveLength(2);
    expect(ds[0]).toMatchObject({
      serial: "MTR032026D006069", imei: "301434060586560", tenTau: "BV-92858-TS", chuTau: "Nguyễn Văn A",
      sdtChuTau: "0967214151", sdtThuyenTruong: "0911222333", diaChiChuTau: "Bà Rịa & Vũng Tàu",
      dangKyLuc: "2026-03-01", hetHan: "2026-11-18", capNhatNguon: "2026-11-05T08:00:54.000Z", trongBo: true,
    });
    expect(ds[1]).toMatchObject({ serial: "S2", hetHan: null, sdtChuTau: null, trongBo: false });
    expect(docTongCong(html)).toBe(16055);
  });

  it("cột đổi thứ tự vẫn đúng ô", () => {
    const dao = [...TIEU_DE_PT].reverse();
    const h = dao.map((t) => `<td>${({ Serial: "S9", IMEI: "9", "Tên phương tiện": "T9", "SĐT chủ tàu": "0909000111", "Thời gian hết hạn": "01/01/2027" } as Record<string, string>)[t] ?? ""}</td>`).join("");
    const ds = docPhuongTien(docBang(bangHtml(dao, [h])));
    expect(ds[0]).toMatchObject({ serial: "S9", sdtChuTau: "0909000111", hetHan: "2027-01-01" });
  });

  it("thiếu cột bắt buộc ⇒ ném lỗi (không ghi rác)", () => {
    const thieu = TIEU_DE_PT.filter((t) => t !== "SĐT chủ tàu");
    expect(() => docPhuongTien(docBang(bangHtml(thieu, [])))).toThrow(/SĐT chủ tàu|sdtChuTau/);
  });

  it("không có bảng ⇒ null / rỗng", () => {
    expect(docBang("<html></html>")).toBeNull();
    expect(docPhuongTien(null)).toEqual([]);
  });
});

describe("báo cáo dịch vụ + gộp", () => {
  const bc = docHetHan({
    serial: "MTR032026D006069", imei: "301434060586560", vin: "BV-92858-TS", deviceName: "BV-92858-TS",
    dateExpried: "20/11/2026", expried: "false", shipowner: "Nguyễn Văn A", phoneShipowner: "0967214151",
    land: "false", dateStartSuspend: null, dateEndSuspend: null,
  });

  it("đọc dòng JSON", () => {
    expect(bc).toMatchObject({ serial: "MTR032026D006069", hetHan: "2026-11-20", sdtChuTau: "0967214151", trongBo: false });
    expect(docHetHan(null)).toBeNull();
    expect(docHetHan({ serial: "" })).toBeNull();
  });

  it("hạn từ báo cáo THẮNG; SĐT danh sách giữ; máy chỉ có ở báo cáo vẫn vào", () => {
    const pt = [{ serial: "MTR032026D006069", tenTau: "BV-92858-TS", hetHan: "2026-11-18", sdtChuTau: null, trongBo: true }];
    const chiBc = docHetHan({ serial: "S-X", vin: "AG-1-TS", dateExpried: "01/12/2026", phoneShipowner: "0973484935" });
    const gop = gopThietBi(pt, [bc, chiBc]);
    expect(gop).toHaveLength(2);
    expect(gop[0]).toMatchObject({ hetHan: "2026-11-20", sdtChuTau: "0967214151", trongBo: true });
    expect(gop[1]).toMatchObject({ serial: "S-X", tenTau: "AG-1-TS", hetHan: "2026-12-01" });
  });
});

describe("cảnh báo", () => {
  const TD = ["STT", "IMEI", "Serial", "VIN", "Tên phương tiện", "Kiểu", "Trạng thái", "Thời gian cập nhật"];
  const html = bangHtml(TD, [
    `<td>1</td><td>301434060586560</td><td>S1</td><td>BV-1-TS</td><td>BV-1-TS</td><td>Báo động</td><td>SOS</td><td>05/11/2026 15:47:45</td>`,
    `<td>2</td><td></td><td>S2</td><td></td><td></td><td>Báo động</td><td>Mất GPS</td><td>05/11/2026 15:00:00</td>`,
  ]);
  it("đọc + bỏ hàng thiếu imei", () => {
    const ds = docCanhBao(docBang(html));
    expect(ds).toEqual([{ imei: "301434060586560", serial: "S1", vin: "BV-1-TS", tenTau: "BV-1-TS", muc: "Báo động", loai: "SOS", luc: "2026-11-05T08:47:45.000Z" }]);
    expect(banGuiCanhBao(ds[0])).toEqual({ imei: "301434060586560", serial: "S1", ten_tau: "BV-1-TS", muc: "Báo động", loai: "SOS", luc: "2026-11-05T08:47:45.000Z" });
  });
});

describe("trạng thái hạn", () => {
  it("theo ngày lịch VN", () => {
    expect(trangThaiHan("2026-11-18", "2026-11-05")).toEqual({ loai: "sap-het", soNgay: 13 });
    expect(trangThaiHan("2026-11-05", "2026-11-05")).toEqual({ loai: "sap-het", soNgay: 0 });
    expect(trangThaiHan("2026-11-04", "2026-11-05")).toEqual({ loai: "het-han", soNgay: -1 });
    expect(trangThaiHan("2026-12-06", "2026-11-05")).toEqual({ loai: "con-han", soNgay: 31 });
    expect(trangThaiHan("2026-12-05", "2026-11-05")).toEqual({ loai: "sap-het", soNgay: 30 });
    expect(trangThaiHan(null, "2026-11-05")).toEqual({ loai: "chua-ro", soNgay: null });
  });
});

describe("gói gửi + máy chủ kiểm lại", () => {
  const t = {
    serial: "S1", imei: "1", tenTau: "BV-1-TS", chuTau: "A", sdtChuTau: "0967214151", sdtThuyenTruong: null,
    diaChiChuTau: "KHÔNG GỬI", sdtQuanLy: "0900000000", hetHan: "2026-11-18", dangKyLuc: null, trongBo: true,
  };
  it("bản gửi bỏ địa chỉ / SĐT quản lý; máy không SĐT ⇒ không gửi", () => {
    const g = banGuiThietBi(t);
    expect(g).not.toHaveProperty("dia_chi_chu_tau");
    expect(JSON.stringify(g)).not.toContain("KHÔNG GỬI");
    expect(JSON.stringify(g)).not.toContain("0900000000");
    expect(banGuiThietBi({ ...t, sdtChuTau: null })).toBeNull();
  });
  it("kiểm gói: hàng hỏng bị bỏ, trùng serial bị bỏ, trạng thái lạ ⇒ từ chối", () => {
    const g = banGuiThietBi(t);
    const r = kiemGoiNhap({
      luc: "2026-11-05T08:00:00Z", trangThai: "ok", tong: { phuongTien: 16055, hetHan: 4078, canhBao: 4104 },
      thietBi: [g, g, { ...g, serial: "S2", het_han: "18/11/2026" }, { ...g, serial: "S3", sdt_chu_tau: "123" }],
      canhBao: [{ imei: "1", loai: "SOS", luc: "2026-11-05T08:47:45Z" }, { imei: "1", loai: "SOS", luc: "2026-11-05T08:47:45.000Z" }, { imei: "", loai: "x", luc: "x" }],
    }, Date.parse("2026-11-05T10:00:00Z"));
    expect(r.ok).toBe(true);
    expect(r.goi?.thietBi.map((x: { serial: string }) => x.serial)).toEqual(["S1"]);
    expect(r.goi?.canhBao).toHaveLength(1);
    expect(r.boQua).toBe(5);
    expect(r.goi?.tong).toEqual({ phuongTien: 16055, hetHan: 4078, canhBao: 4104 });
    expect(kiemGoiNhap({ luc: "2026-11-05T08:00:00Z", trangThai: "xoa" }).ok).toBe(false);
    expect(kiemGoiNhap({ luc: "x", trangThai: "ok" }).ok).toBe(false);
    expect(kiemGoiNhap({ luc: "2026-11-05T08:00:00Z", trangThai: "het-phien", loi: "phiên hết" }).ok).toBe(true);
  });
  it("bỏ ký tự NUL/điều khiển — Postgres từ chối \\u0000 (dính thật 05/11, cả lô hỏng)", () => {
    const r = kiemGoiNhap({
      luc: "2026-11-05T08:00:00Z", trangThai: "ok",
      canhBao: [{ imei: "1", loai: "Mất\u0000 GPS", luc: "2026-11-05T08:47:45Z", ten_tau: "BV\u0000-1" }],
    }, Date.parse("2026-11-05T10:00:00Z"));
    expect(JSON.stringify(r.goi?.canhBao)).not.toMatch(/\\u0000/);
    expect(r.goi?.canhBao[0].loai).toBe("Mất  GPS");
  });
});

describe("4 trường trạng thái máy (anh Long 05/11: \"quan trọng\") — migration 0081", () => {
  const pt = {
    serial: "S1", imei: "1", tenTau: "BV-1-TS", sdtChuTau: "0967214151", hetHan: "2026-11-18", trongBo: false,
    dongBoTcts: "Thất bại", nhom: "Nhóm Vũng Tàu", taoLuc: "2026-03-01T01:00:00.000Z", capNhatNguon: "2026-11-05T08:00:54.000Z",
  };
  it("bản gửi mang đủ 4 trường + trong bờ; máy chủ giữ nguyên", () => {
    const g = banGuiThietBi(pt);
    expect(g).toMatchObject({ dong_bo_tcts: "Thất bại", nhom: "Nhóm Vũng Tàu", tao_luc: pt.taoLuc, cap_nhat_nguon: pt.capNhatNguon, trong_bo: false });
    const r = kiemGoiNhap({ luc: "2026-11-05T08:00:00Z", trangThai: "ok", thietBi: [g] });
    expect(r.goi?.thietBi[0]).toMatchObject({ dong_bo_tcts: "Thất bại", nhom: "Nhóm Vũng Tàu", tao_luc: pt.taoLuc, cap_nhat_nguon: pt.capNhatNguon });
  });
  it("hồ sơ đời cũ không có 4 trường vẫn qua (null); giờ sai ⇒ bỏ hồ sơ", () => {
    const g = banGuiThietBi({ serial: "S2", sdtChuTau: "0967214151" });
    expect(kiemGoiNhap({ luc: "2026-11-05T08:00:00Z", trangThai: "ok", thietBi: [g] }).goi?.thietBi[0]).toMatchObject({ dong_bo_tcts: null, nhom: null, tao_luc: null, cap_nhat_nguon: null });
    const r = kiemGoiNhap({ luc: "2026-11-05T08:00:00Z", trangThai: "ok", thietBi: [{ ...g, tao_luc: "không phải giờ" }] });
    expect(r.goi?.thietBi).toHaveLength(0);
  });
  it("báo cáo dịch vụ bù nhóm + ngày cập nhật (logDate ms) khi danh sách thiếu", () => {
    const bc = docHetHan({ serial: "S1", dateExpried: "20/11/2026", groupName: "Nhóm B", logDate: 1793867826525 });
    expect(bc).toMatchObject({ nhom: "Nhóm B", capNhatNguon: new Date(1793867826525).toISOString() });
    const gop = gopThietBi([{ serial: "S1", nhom: null, capNhatNguon: null, dongBoTcts: "Thành công" }], [bc]);
    expect(gop[0]).toMatchObject({ nhom: "Nhóm B", dongBoTcts: "Thành công", hetHan: "2026-11-20" });
    const giu = gopThietBi([{ serial: "S1", nhom: "Nhóm A" }], [bc]);
    expect(giu[0].nhom).toBe("Nhóm A");
  });
});

describe("cảnh báo CHỈ TRONG NGÀY giờ VN (anh Long 05/11: \"xóa đi, cái nào trong ngày thôi\")", () => {
  it("00:00 hôm nay giờ VN", () => {
    expect(dauNgayVnIso(Date.parse("2026-11-05T10:00:00Z"))).toBe("2026-11-04T17:00:00.000Z");
    expect(dauNgayVnIso(Date.parse("2026-11-05T18:30:00Z"))).toBe("2026-11-05T17:00:00.000Z");
  });
  it("cảnh báo trước 00:00 VN bị bỏ (boCu), trong ngày giữ", () => {
    const now = Date.parse("2026-11-05T10:00:00Z"); // 17:00 VN
    const r = kiemGoiNhap({
      luc: "2026-11-05T10:00:00Z", trangThai: "ok",
      canhBao: [
        { imei: "1", loai: "SOS", luc: "2026-11-04T16:59:59Z" }, // 23:59:59 hôm qua VN
        { imei: "1", loai: "SOS", luc: "2026-11-04T17:00:00Z" }, // 00:00 hôm nay VN
        { imei: "2", loai: "Vượt biên", luc: "2018-10-20T08:34:53Z" },
      ],
    }, now);
    expect(r.goi?.canhBao.map((c: { luc: string }) => c.luc)).toEqual(["2026-11-04T17:00:00.000Z"]);
    expect(r.boCu).toBe(2);
    expect(r.boQua).toBe(0);
  });
});
