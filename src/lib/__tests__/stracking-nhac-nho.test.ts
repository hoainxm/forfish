import { describe, expect, it } from "vitest";
import { doiMay, docMkn, nhacTheoNguoi, tuanVn, viecNhac } from "@/lib/stracking/nhac-nho.mjs";
import { kiemGoiNhap, kiemNhac, laDuongDoc, thanMkn } from "@/lib/stracking/dong-bo.mjs";

// 05/11/2026 17:00 giờ VN
const NOW = Date.parse("2026-11-05T10:00:00Z");
const gioTruoc = (h: number) => NOW - h * 3600_000;
const tau = (o: Record<string, unknown> = {}) => ({
  serial: "S1", tenTau: "BV-1-TS", sdtChuTau: "0967214151", sdtThuyenTruong: "0911222333",
  hetHan: "2027-06-01", dongBoTcts: "Thành công", trongBo: false, ...o,
});
const mkn = (h: number, o: Record<string, unknown> = {}) =>
  docMkn({ report: { serial: "S1", imei: "1", deviceName: "BV-1-TS", dateTracking: gioTruoc(h), dateOnline: null, inShore: 2, ...o } });

describe("đọc đợt mất kết nối", () => {
  it("đang mất / đã có lại / trong bờ", () => {
    expect(mkn(7)).toMatchObject({ serial: "S1", dangMat: true, ngoaiKhoi: true, batDau: new Date(gioTruoc(7)).toISOString() });
    expect(mkn(7, { dateOnline: NOW })?.dangMat).toBe(false);
    expect(mkn(7, { inShore: 1 })?.ngoaiKhoi).toBe(false);
    expect(docMkn({ report: { serial: "", dateTracking: 1 } })).toBeNull();
  });
});

describe("nhắc mất kết nối ngoài khơi — mốc 6 giờ (anh Long: \"mkn >6h là họ sẽ bị phạt\")", () => {
  it("<4 giờ: chưa nhắc · 4–6 giờ: sắp · ≥6 giờ: quá, nhắc lại mỗi 6 giờ", () => {
    expect(viecNhac({ thietBi: [tau()], mkn: [mkn(3)], now: NOW })).toEqual([]);
    const sap = viecNhac({ thietBi: [tau()], mkn: [mkn(5)], now: NOW });
    expect(sap).toHaveLength(1);
    expect(sap[0]).toMatchObject({ loai: "mkn-sap-6h", day: true, nguoi: ["0967214151", "0911222333"] });
    expect(sap[0].dong).toMatch(/trước mốc 6 giờ/);
    // CÙNG một đợt (bắt đầu 7 giờ trước NOW), đồng hồ trôi thêm 4 giờ rồi 6 giờ.
    const dot = [mkn(7)];
    const qua7 = viecNhac({ thietBi: [tau()], mkn: dot, now: NOW })[0];
    const qua11 = viecNhac({ thietBi: [tau()], mkn: dot, now: NOW + 4 * 3600_000 })[0];
    const qua13 = viecNhac({ thietBi: [tau()], mkn: dot, now: NOW + 6 * 3600_000 })[0];
    expect(qua7.loai).toBe("mkn-qua-6h");
    expect(qua7.khoa).toBe(qua11.khoa); // cùng đợt 6–12 giờ ⇒ cùng khoá ⇒ không nhắc lại
    expect(qua13.khoa).not.toBe(qua7.khoa); // sang mốc 12 giờ ⇒ nhắc lại
    expect(viecNhac({ thietBi: [tau()], mkn: [mkn(50)], now: NOW })[0].dong).toMatch(/2 ngày/);
  });
  it("trong bờ / đã có kết nối lại / máy không có trong kho / không SĐT ⇒ không nhắc", () => {
    expect(viecNhac({ thietBi: [tau()], mkn: [mkn(8, { inShore: 1 })], now: NOW })).toEqual([]);
    expect(viecNhac({ thietBi: [tau()], mkn: [mkn(8, { dateOnline: NOW })], now: NOW })).toEqual([]);
    expect(viecNhac({ thietBi: [tau({ serial: "KHAC" })], mkn: [mkn(8)], now: NOW })).toEqual([]);
    expect(viecNhac({ thietBi: [tau({ sdtChuTau: null, sdtThuyenTruong: null })], mkn: [mkn(8)], now: NOW })).toEqual([]);
  });
});

describe("đồng bộ Tổng cục thất bại — 1 lần/ngày", () => {
  it("ngoài khơi ⇒ đẩy; trong bờ ⇒ chỉ hộp thư; khoá theo ngày VN", () => {
    const ngoai = viecNhac({ thietBi: [tau({ dongBoTcts: "Thất bại" })], now: NOW });
    expect(ngoai).toHaveLength(1);
    expect(ngoai[0]).toMatchObject({ loai: "tcts-that-bai", day: true, khoa: "tcts|S1|2026-11-05" });
    expect(viecNhac({ thietBi: [tau({ dongBoTcts: "Thất bại", trongBo: true })], now: NOW })[0].day).toBe(false);
    expect(viecNhac({ thietBi: [tau({ dongBoTcts: "Thành công" })], now: NOW })).toEqual([]);
  });
});

describe("hạn cước — đúng mốc", () => {
  it("còn 15/7/3/1/0 ngày, quá 1/7/30 ngày; ngày khác không nhắc", () => {
    const m = (hetHan: string) => viecNhac({ thietBi: [tau({ hetHan })], now: NOW });
    expect(m("2026-11-20")[0]).toMatchObject({ loai: "han-sap-het", day: false, khoa: "han|S1|2026-11-20|con15" });
    expect(m("2026-11-08")[0]).toMatchObject({ loai: "han-sap-het", day: true });
    expect(m("2026-11-05")[0].dong).toMatch(/hết hạn hôm nay/);
    expect(m("2026-11-10")).toEqual([]); // còn 5 ngày — không phải mốc
    expect(m("2026-11-04")[0]).toMatchObject({ loai: "han-qua-han", khoa: "han|S1|2026-11-04|qua1" });
    expect(m("2026-11-03")).toEqual([]); // quá 2 ngày
    expect(m("2026-10-06")[0].khoa).toBe("han|S1|2026-10-06|qua30");
  });
});

describe("gửi máy chủ", () => {
  it("bung theo người; máy chủ kiểm lại — SĐT/loại lạ bị bỏ, ký tự điều khiển bị lọc", () => {
    const v = viecNhac({ thietBi: [tau({ dongBoTcts: "Thất bại" })], mkn: [mkn(7)], now: NOW });
    const ds = nhacTheoNguoi(v);
    expect(ds).toHaveLength(4); // 2 việc × 2 người
    expect(kiemNhac([...ds, { sdt: "123", loai: "mkn-qua-6h", dong: "x" }, { sdt: "0967214151", loai: "la", dong: "x" }])).toHaveLength(4);
    expect(kiemNhac([{ sdt: "0967214151", loai: "tcts-that-bai", tau: "A\u0000B", dong: "d\u0000ong", day: true }])[0]).toEqual({ sdt: "0967214151", serial: null, tau: "A B", loai: "tcts-that-bai", day: true, dong: "d ong" });
    const r = kiemGoiNhap({ luc: "2026-11-05T10:00:00Z", trangThai: "ok", nhac: ds }, NOW);
    expect(r.goi?.nhac).toHaveLength(4);
    expect(kiemGoiNhap({ luc: "2026-11-05T10:00:00Z", trangThai: "ok" }, NOW).goi?.nhac).toEqual([]);
  });
});

describe("gọi báo cáo mất kết nối", () => {
  it("trang đầu đủ tham số con trỏ (thiếu ⇒ máy chủ 500), chỉ ngoài khơi; đường nằm trong danh sách đọc", () => {
    const j = JSON.parse(thanMkn(1000));
    expect(j).toMatchObject({ page: "1", pageSkip: "0", pageSize: "1000", direction: "0", isFirstPage: "true", isLastPage: "false", data: { inOutShore: "2" } });
    expect(laDuongDoc("/getListDeviceDisconnect")).toBe(true);
  });
});

describe("máy lắp trước mốc NĐ 37/2024 (19/5/2024) ⇒ nhắc nâng cấp theo NĐ 41/2026, 1 lần/tuần", () => {
  const nd41 = (o: Record<string, unknown>, now = NOW) => viecNhac({ thietBi: [tau({ ...o })], now }).filter((v) => v.loai === "nd41-nang-cap");
  it("ngày lắp = ngày đăng ký (thiếu thì ngày tạo); trước mốc mới nhắc", () => {
    expect(nd41({ dangKyLuc: "2024-05-18" })).toHaveLength(1);
    expect(nd41({ dangKyLuc: "2024-05-19" })).toEqual([]);
    expect(nd41({ dangKyLuc: "2025-01-01", taoLuc: "2019-06-01T00:00:00Z" })).toEqual([]); // đăng ký thắng ngày tạo
    expect(nd41({ dangKyLuc: null, taoLuc: "2020-03-01T03:00:00Z" })).toHaveLength(1);
    expect(nd41({ dangKyLuc: null, taoLuc: null })).toEqual([]);
    const v = nd41({ dangKyLuc: "2021-03-12" })[0];
    expect(v.dong).toMatch(/lắp từ 12\/03\/2021, trước mốc 19\/5\/2024/);
    expect(v.dong).toMatch(/gọi SDVICO/);
    expect(v.day).toBe(false); // máy GPU bật đẩy cho lần đầu
  });
  it("khoá theo tuần: cùng tuần ⇒ cùng khoá, tuần sau ⇒ khoá mới", () => {
    const thu5 = Date.parse("2026-11-05T10:00:00Z"); // thứ Năm
    const cn = Date.parse("2026-11-08T10:00:00Z"); // Chủ nhật cùng tuần
    const thu2 = Date.parse("2026-11-09T01:00:00Z"); // thứ Hai tuần sau (08:00 VN)
    expect(tuanVn(thu5)).toBe(tuanVn(cn));
    expect(tuanVn(thu2)).toBe(tuanVn(thu5) + 1);
    expect(nd41({ dangKyLuc: "2021-03-12" }, thu5)[0].khoa).toBe(nd41({ dangKyLuc: "2021-03-12" }, cn)[0].khoa);
    expect(nd41({ dangKyLuc: "2021-03-12" }, thu2)[0].khoa).not.toBe(nd41({ dangKyLuc: "2021-03-12" }, thu5)[0].khoa);
  });
  it("máy chủ nhận loại nd41-nang-cap", () => {
    expect(kiemNhac([{ sdt: "0967214151", loai: "nd41-nang-cap", tau: "BV-1-TS", dong: "x", day: true }])).toHaveLength(1);
  });
});

describe("máy đã huỷ / thu hồi ⇒ không nhắc gì (báo Zalo 05/11)", () => {
  it("tên DE…/Thu… hoặc nhóm DELETE: không hạn, không Tổng cục, không mất kết nối, không NĐ 41", () => {
    const huy = [
      tau({ serial: "S1", tenTau: "DEKG-93388-TS", hetHan: "2026-11-04", dongBoTcts: "Thất bại", dangKyLuc: "2021-01-01" }),
      tau({ serial: "S1", tenTau: "ThuhoiCM-1-TS", hetHan: "2026-11-04" }),
      tau({ serial: "S1", tenTau: "KG-1-TS", nhom: "04.DELETE", hetHan: "2026-11-04" }),
    ];
    for (const t of huy) expect(viecNhac({ thietBi: [t], mkn: [mkn(8)], now: NOW })).toEqual([]);
    expect(viecNhac({ thietBi: [tau({ hetHan: "2026-11-04" })], now: NOW }).length).toBeGreaterThan(0); // máy thật vẫn nhắc
  });
});

describe("đời máy chắc chắn phải nâng cấp NĐ 41 (anh Long: \"K2019 va D2019\")", () => {
  it("đọc đời máy từ serial (tháng + năm + chữ dòng)", () => {
    expect(doiMay("MTR032019D006069")).toBe("D2019");
    expect(doiMay("MTR112019K000001")).toBe("K2019");
    expect(doiMay("MTR032026D006069")).toBe("D2026");
    expect(doiMay("MTR132019D000001")).toBeNull(); // tháng 13 ⇒ không phải dạng tháng/năm
    expect(doiMay("HONG1")).toBeNull();
  });
  it("D2019 ⇒ nhắc chắc chắn dù đăng ký SAU mốc 19/5/2024; D2026 đăng ký sau mốc ⇒ không nhắc", () => {
    const d19 = viecNhac({ thietBi: [tau({ serial: "MTR032019D006069", dangKyLuc: "2025-01-01" })], now: NOW }).filter((v) => v.loai === "nd41-nang-cap");
    expect(d19).toHaveLength(1);
    expect(d19[0].dong).toMatch(/đời D 2019 cần nâng cấp để đáp ứng Nghị định 41\/2026/);
    expect(d19[0].dong).toMatch(/gọi SDVICO/);
    expect(viecNhac({ thietBi: [tau({ serial: "MTR032026D006069", dangKyLuc: "2026-04-01" })], now: NOW }).filter((v) => v.loai === "nd41-nang-cap")).toEqual([]);
  });
  it("khớp cả đời máy lẫn mốc ngày ⇒ vẫn MỘT dòng (câu chắc chắn)", () => {
    const v = viecNhac({ thietBi: [tau({ serial: "MTR032019D006069", dangKyLuc: "2021-01-01" })], now: NOW }).filter((x) => x.loai === "nd41-nang-cap");
    expect(v).toHaveLength(1);
    expect(v[0].dong).toMatch(/đời D 2019/);
  });
});

describe("giọng nhắc — cho bà con thấy mình đang giúp họ (anh Long 05/11)", () => {
  it("không chữ in hoa hét; câu nào cũng có việc bà con làm + SDVICO/app giúp", () => {
    const ds = viecNhac({
      thietBi: [
        tau({ serial: "A", dongBoTcts: "Thất bại", hetHan: "2026-11-04" }),
        tau({ serial: "B", hetHan: "2026-11-05" }),
        tau({ serial: "MTR032019D000001", dangKyLuc: "2021-01-01" }),
      ],
      mkn: [docMkn({ report: { serial: "A", dateTracking: NOW - 5 * 3600_000, dateOnline: null, inShore: 2 } }), docMkn({ report: { serial: "B", dateTracking: NOW - 9 * 3600_000, dateOnline: null, inShore: 2 } })],
      now: NOW,
    });
    expect(ds.length).toBeGreaterThanOrEqual(5);
    for (const v of ds) {
      expect(v.dong.replace(/SDVICO/g, "")).not.toMatch(/\b[A-ZĐ]{4,}\b/); // không "CHƯA", "HẾT HẠN"… in hoa (trừ tên tàu kiểu BV-1-TS)
      expect(v.dong).toMatch(/bà con/i);
      expect(v.dong).toMatch(/SDVICO|trong app/);
    }
  });
});

describe("M2019 thêm vào đời phải nâng cấp (anh Long 05/11: \"ok bổ sung thêm m2019 đi\")", () => {
  it("M2019 đăng ký sau mốc vẫn được nhắc chắc chắn; M2020 / K2018 đăng ký sau mốc thì không", () => {
    const nd = (serial: string) => viecNhac({ thietBi: [tau({ serial, dangKyLuc: "2025-03-01" })], now: NOW }).filter((v) => v.loai === "nd41-nang-cap");
    expect(nd("MTR052019M001234")).toHaveLength(1);
    expect(nd("MTR052019M001234")[0].dong).toMatch(/đời M 2019 cần nâng cấp/);
    expect(nd("MTR052020M001234")).toEqual([]);
    expect(nd("MTR052018K001234")).toEqual([]);
  });
});

describe("nhắc mang serial — máy chủ bỏ nhắc của máy khách đã tự xoá (0083)", () => {
  it("nhacTheoNguoi gắn serial; kiemNhac giữ serial hợp lệ, sai/dài ⇒ null", () => {
    const ds = nhacTheoNguoi(viecNhac({ thietBi: [tau({ dongBoTcts: "Thất bại" })], now: NOW }));
    expect(ds.length).toBeGreaterThan(0);
    expect(ds.every((x) => x.serial === "S1")).toBe(true);
    expect(kiemNhac(ds)[0].serial).toBe("S1");
    expect(kiemNhac([{ ...ds[0], serial: "x".repeat(65) }])[0].serial).toBeNull();
    expect(kiemNhac([{ ...ds[0], serial: 5 }])[0].serial).toBeNull();
  });
});
