import { describe, expect, it } from "vitest";
import { bangTheoTroi, cauCpa, doCaoMatTroi, MAU_NONG, mauDaiToNong, nhomTheoMuc } from "../hai-do/lop";
import { tuongPhan } from "../hai-do/bang-mau";
import { DEPTH_BANDS } from "../ocean-map";
import type { MucTieu } from "../ais-cpa";

describe("mức hiển thị", () => {
  it("Cơ bản tắt báo hiệu; Chuẩn có báo hiệu + cáp/ống/giàn/cấm (tàu cá); Đủ thêm luồng", () => {
    expect(nhomTheoMuc("co-ban")).toEqual({ baoHieu: false, luong: false, camCap: false });
    expect(nhomTheoMuc("chuan")).toEqual({ baoHieu: true, luong: false, camCap: true });
    expect(nhomTheoMuc("du")).toEqual({ baoHieu: true, luong: true, camCap: true });
  });
});

describe("tô nông theo đường an toàn", () => {
  it("an toàn 10 m: chỉ dải 0–10 tô nông", () => {
    const m = mauDaiToNong(10);
    expect(m["sea-bg"]).toBe(MAU_NONG);
    expect(m["isobath-du-nuoc"]).toBe(DEPTH_BANDS[1].color);
  });
  it("an toàn 20 / 50 m: thêm dải tương ứng", () => {
    expect(mauDaiToNong(20)["isobath-du-nuoc"]).toBe(MAU_NONG);
    expect(mauDaiToNong(20)["isobath-dai-2"]).toBe(DEPTH_BANDS[2].color);
    expect(mauDaiToNong(50)["isobath-dai-2"]).toBe(MAU_NONG);
    expect(mauDaiToNong(50)["isobath-dai-3"]).toBe(DEPTH_BANDS[3].color);
  });
  it("nét đẳng sâu (#3d6e96) trên màu nông vẫn ≥ 3:1", () => {
    expect(tuongPhan(MAU_NONG, "#3d6e96")).toBeGreaterThanOrEqual(3);
  });
});

describe("mặt trời", () => {
  it("trưa Vũng Tàu cao, nửa đêm âm, lúc hoàng hôn quanh 0", () => {
    const trua = Date.parse("2026-11-04T05:00:00Z"); // 12h VN
    const dem = Date.parse("2026-11-04T17:00:00Z"); // 0h VN
    const chieu = Date.parse("2026-11-04T10:30:00Z"); // 17h30 VN
    expect(doCaoMatTroi(10.35, 107.08, trua)).toBeGreaterThan(55);
    expect(doCaoMatTroi(10.35, 107.08, dem)).toBeLessThan(-40);
    expect(Math.abs(doCaoMatTroi(10.35, 107.08, chieu))).toBeLessThan(8);
  });
  it("ngưỡng ngày/chiều/đêm", () => {
    expect(bangTheoTroi(30)).toBe("ngay");
    expect(bangTheoTroi(0)).toBe("chieu");
    expect(bangTheoTroi(-10)).toBe("dem");
  });
});

describe("báo va chạm AIS", () => {
  const mt = (o: Partial<MucTieu>): MucTieu =>
    ({
      tau: { id: "x", ten: "BĐ 1234", loai: 2, co: null, lat: 0, lon: 0, kn: 5, huong: 0, mui: null, phut: 0, dai: null, dich: null },
      pos: { lat: 0, lon: 0 },
      cachNm: 2,
      phuongVi: 0,
      cpaNm: 0.2,
      tcpaPhut: 8,
      muc: "nguy",
      tuoiPhut: 1,
      tinCu: false,
      cpaMinh: null,
      cpaTau: null,
      ...o,
    }) as MucTieu;
  const hl = (nm: number) => `${nm.toFixed(1)} hl`;
  it("tàu sẽ gần dưới ngưỡng trong 12 phút ⇒ câu báo", () => {
    expect(cauCpa([mt({})], hl)).toBe("Tàu BĐ 1234 sẽ cách 0.2 hl sau 8 phút");
  });
  it("xa, đã qua, quá lâu, tin cũ ⇒ im", () => {
    expect(cauCpa([mt({ cpaNm: 0.9 })], hl)).toBeNull();
    expect(cauCpa([mt({ tcpaPhut: -2 })], hl)).toBeNull();
    expect(cauCpa([mt({ tcpaPhut: 30 })], hl)).toBeNull();
    expect(cauCpa([mt({ tinCu: true })], hl)).toBeNull();
  });
  it("nhiều tàu: báo tàu sắp gần SỚM nhất", () => {
    const r = cauCpa([mt({ tcpaPhut: 10 }), mt({ tcpaPhut: 3, tau: { ...mt({}).tau, ten: null } })], hl);
    expect(r).toBe("Một tàu sẽ cách 0.2 hl sau 3 phút");
  });
});

import { canDanCongTrinh, canhBaoCongTrinh, loaiCongTrinh } from "../hai-do/lop";
import { diemTheoPhuongVi } from "../hai-do/an-toan";

describe("cáp · ống · giàn", () => {
  it("xếp loại theo kind + loai", () => {
    expect(loaiCongTrinh("cap", "quang")).toBe("cap-quang");
    expect(loaiCongTrinh("cap", "dien")).toBe("cap-dien");
    expect(loaiCongTrinh("cap", "chua-ro")).toBe("cap");
    expect(loaiCongTrinh("ong", "khi")).toBe("ong-dau-khi");
    expect(loaiCongTrinh("ong", "xa-thai")).toBe("ong-xa");
    expect(loaiCongTrinh("giankhoan")).toBe("gian");
    expect(loaiCongTrinh("luong")).toBeNull();
    expect(canDanCongTrinh("cap-quang")).toContain("neo");
    expect(canDanCongTrinh("gian")).toContain("500 m");
  });
  const goc = { lat: 10, lon: 108 };
  const tren = diemTheoPhuongVi(goc, 0, 0.3); // 300 m về Bắc
  const cap = { type: "Feature" as const, properties: { kind: "cap", loai: "quang" }, geometry: { type: "LineString" as const, coordinates: [[107.9, 10], [108.1, 10]] } };
  const gian = { type: "Feature" as const, properties: { kind: "giankhoan" }, geometry: { type: "Point" as const, coordinates: [108, 10] } };
  it("neo cách cáp 300 m ⇒ báo; neo xa ⇒ im; chưa neo ⇒ im", () => {
    expect(canhBaoCongTrinh([cap], null, tren)).toBe("Neo cách cáp quang ngầm 300 m — dễ móc");
    expect(canhBaoCongTrinh([cap], null, diemTheoPhuongVi(goc, 0, 2))).toBeNull();
    expect(canhBaoCongTrinh([cap], tren, null)).toBeNull();
  });
  it("tàu trong vòng 500 m quanh giàn ⇒ báo; ngoài ⇒ im", () => {
    expect(canhBaoCongTrinh([gian], tren, null)).toBe("Đang trong vòng 500 m quanh giàn khoan");
    expect(canhBaoCongTrinh([gian], diemTheoPhuongVi(goc, 90, 0.8), null)).toBeNull();
  });
  it("neo gần cáp được ưu tiên hơn vòng giàn", () => {
    expect(canhBaoCongTrinh([gian, cap], tren, tren)).toContain("Neo cách");
  });
});

import { khungHienTai, luoiDaQua, sapMucTieu } from "../hai-do/lop";
describe("danh sách tàu AIS — xếp", () => {
  const mt = (id: string, o: Partial<MucTieu>): MucTieu =>
    ({
      tau: { id, ten: id, loai: 2, co: null, lat: 0, lon: 0, kn: 5, huong: 0, mui: null, phut: 0, dai: null, dich: null },
      pos: { lat: 0, lon: 0 },
      cachNm: 2,
      phuongVi: 0,
      cpaNm: 1,
      tcpaPhut: 10,
      muc: "an",
      tuoiPhut: 1,
      tinCu: false,
      cpaMinh: null,
      cpaTau: null,
      ...o,
    }) as MucTieu;
  const ds = [
    mt("xa-toi-som", { cachNm: 8, tcpaPhut: 4 }),
    mt("gan-da-qua", { cachNm: 0.5, tcpaPhut: -3 }),
    mt("vua-toi-muon", { cachNm: 3, tcpaPhut: 25 }),
    mt("tin-cu", { cachNm: 1, tcpaPhut: 1, tinCu: true }),
    mt("dung-yen", { cachNm: 2, tcpaPhut: null, cpaNm: null }),
  ];
  const ten = (x: MucTieu[]) => x.map((m) => m.tau.id);
  it("Sắp gặp: tàu đang tới theo TCPA trước, còn lại theo cự ly", () => {
    expect(ten(sapMucTieu(ds, "tcpa"))).toEqual(["xa-toi-som", "vua-toi-muon", "gan-da-qua", "tin-cu", "dung-yen"]);
  });
  it("Tên: theo vần, số trong tên xếp như số; tàu chưa rõ tên xuống cuối", () => {
    const d = [mt("BĐ 9", { cachNm: 3 }), mt("x", { cachNm: 1, tau: { ...mt("x", {}).tau, ten: null } }), mt("BĐ 10", { cachNm: 2 }), mt("An Phú", { cachNm: 5 })];
    expect(ten(sapMucTieu(d, "ten"))).toEqual(["An Phú", "BĐ 9", "BĐ 10", "x"]);
  });
  it("Gần nhất: chỉ theo cự ly; không đổi mảng gốc", () => {
    expect(ten(sapMucTieu(ds, "cach"))).toEqual(["gan-da-qua", "tin-cu", "dung-yen", "vua-toi-muon", "xa-toi-som"]);
    expect(ds[0].tau.id).toBe("xa-toi-som");
  });
});

describe("lớp gió sóng — khung bây giờ", () => {
  const times = ["2026-11-04T06:00", "2026-11-04T09:00", "2026-11-04T12:00", "2026-11-04T15:00"];
  it("chọn khung gần giờ VN hiện tại nhất", () => {
    // 10:20 giờ VN = 03:20Z
    expect(khungHienTai(times, Date.parse("2026-11-04T03:20:00Z"))).toBe(1);
    // 11:00 VN ⇒ 12h gần hơn 9h? (1h vs 2h) ⇒ 12h
    expect(khungHienTai(times, Date.parse("2026-11-04T04:00:00Z"))).toBe(2);
  });
  it("ngoài tầm ⇒ mép gần nhất; rỗng ⇒ 0", () => {
    expect(khungHienTai(times, Date.parse("2026-11-05T00:00:00Z"))).toBe(3);
    expect(khungHienTai(times, Date.parse("2026-11-03T00:00:00Z"))).toBe(0);
    expect(khungHienTai([], Date.now())).toBe(0);
  });
});

describe("lớp gió sóng — lưới đã qua", () => {
  const times = ["2026-10-26T00:00", "2026-10-27T00:00"];
  it("bản lưu tuần trước ⇒ đã qua; lưới hôm nay ⇒ chưa; rỗng ⇒ chưa", () => {
    expect(luoiDaQua(times, Date.parse("2026-11-04T03:00:00Z"))).toBe(true);
    expect(luoiDaQua(["2026-11-04T00:00", "2026-11-05T00:00"], Date.parse("2026-11-04T03:00:00Z"))).toBe(false);
    expect(luoiDaQua([], Date.now())).toBe(false);
  });
});
