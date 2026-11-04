import { describe, expect, it } from "vitest";
import { BoGhepAis, docCau, doPhut, giaiMaAis, kiemTong, loaiTuMaAis } from "../hai-do/nmea";

/** Gắn checksum đúng cho câu tự soạn. */
const cs = (than: string) => {
  let x = 0;
  for (let i = 1; i < than.length; i++) x ^= than.charCodeAt(i);
  return `${than}*${x.toString(16).toUpperCase().padStart(2, "0")}`;
};

describe("NMEA — checksum + toạ độ", () => {
  it("câu mẫu chuẩn đúng; sửa một ký tự ⇒ sai; không có * ⇒ chấp nhận", () => {
    expect(kiemTong("$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47")).toBe(true);
    expect(kiemTong("$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*48")).toBe(false);
    expect(kiemTong("$GPHDT,90.0,T")).toBe(true);
  });
  it("độ-phút ⇒ độ, bán cầu Nam/Tây âm", () => {
    expect(doPhut("1050.0000", "N")).toBeCloseTo(10.8333, 4);
    expect(doPhut("10630.00", "E")).toBeCloseTo(106.5, 4);
    expect(doPhut("0130.00", "S")).toBeCloseTo(-1.5, 4);
    expect(doPhut("1075.0", "N")).toBeNull(); // phút ≥ 60
    expect(doPhut("", "N")).toBeNull();
  });
});

describe("NMEA — GPS, hướng, mũi, độ sâu", () => {
  const g = new BoGhepAis();
  it("GGA có fix ⇒ vị trí; chưa fix ⇒ null", () => {
    const c = docCau("$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47", g);
    expect(c).toMatchObject({ loai: "vi-tri", nguon: "GGA", soVeTinh: 8, hdop: 0.9 });
    if (c?.loai === "vi-tri") {
      expect(c.lat).toBeCloseTo(48.1173, 4);
      expect(c.lon).toBeCloseTo(11.5167, 4);
    }
    expect(docCau(cs("$GPGGA,123519,4807.038,N,01131.000,E,0,00,,,M,,M,,"), g)).toBeNull();
  });
  it("RMC hợp lệ ⇒ tốc độ, hướng, giờ UTC; cờ V ⇒ null", () => {
    const c = docCau("$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A", g);
    expect(c).toMatchObject({ loai: "vi-tri", nguon: "RMC", kn: 22.4, huong: 84.4, lucMs: Date.UTC(1994, 2, 23, 12, 35, 19) });
    expect(docCau(cs("$GPRMC,123519,V,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W"), g)).toBeNull();
  });
  it("VTG, HDT, DBT, DPT", () => {
    expect(docCau("$GPVTG,054.7,T,034.4,M,005.5,N,010.2,K*48", g)).toEqual({ loai: "huong-di", huong: 54.7, kn: 5.5 });
    expect(docCau(cs("$HEHDT,274.1,T"), g)).toEqual({ loai: "mui-tau", mui: 274.1 });
    expect(docCau(cs("$SDDBT,39.4,f,12.0,M,6.6,F"), g)).toEqual({ loai: "do-sau", doSauM: 12 });
    expect(docCau(cs("$SDDBT,32.8,f,,M,,F"), g)).toEqual({ loai: "do-sau", doSauM: 10 });
    expect(docCau(cs("$SDDPT,8.4,0.6"), g)).toEqual({ loai: "do-sau", doSauM: 9 });
  });
  it("câu lạ / hỏng / sai checksum ⇒ null, không ném", () => {
    expect(docCau("rác", g)).toBeNull();
    expect(docCau("$GPXYZ,1,2*00", g)).toBeNull();
    expect(docCau(cs("$GPZDA,123519,04,11,2026,,"), g)).toBeNull();
    expect(docCau("$GPVTG,054.7,T,034.4,M,005.5,N,010.2,K*00", g)).toBeNull();
  });
});

describe("NMEA — AIS (VDM/VDO)", () => {
  it("kiểu 1 (Class A): MMSI, vị trí, hướng đi, mũi", () => {
    const c = docCau("!AIVDM,1,1,,B,177KQJ5000G?tO`K>RA1wUbN0TKH,0*5C", new BoGhepAis());
    expect(c?.loai).toBe("ais");
    if (c?.loai !== "ais") return;
    expect(c.tin).toMatchObject({ kieu: 1, mmsi: 477553000, kn: 0, huong: 51, mui: 181, cuaMinh: false });
    expect(c.tin.lat).toBeCloseTo(47.582833, 4);
    expect(c.tin.lon).toBeCloseTo(-122.345833, 4);
  });
  it("kiểu 18 (Class B): mũi 511 = không có", () => {
    const c = docCau(cs("!AIVDM,1,1,,B,B52K>;h00Fc>jpUlNV@ikwpUoP06,0"), new BoGhepAis());
    if (c?.loai !== "ais") throw new Error("không đọc được kiểu 18");
    expect(c.tin).toMatchObject({ kieu: 18, mmsi: 338087471, kn: 0.1, mui: null });
    expect(c.tin.lat).toBeCloseTo(40.68454, 4);
    expect(c.tin.lon).toBeCloseTo(-74.072132, 4);
    expect(c.tin.huong).toBeCloseTo(79.6, 1);
  });
  it("kiểu 5 hai mảnh: ghép đủ mới ra tên, hô hiệu, IMO, loại", () => {
    const g = new BoGhepAis();
    expect(docCau("!AIVDM,2,1,1,A,55?MbV02;H;s<HtKR20EHE:0@T4@Dn2222222216L961O5Gf0NSQEp6ClRp8,0*1C", g, 1000)).toBeNull();
    const c = docCau("!AIVDM,2,2,1,A,88888888880,2*25", g, 1500);
    if (c?.loai !== "ais") throw new Error("không ghép được kiểu 5");
    expect(c.tin).toMatchObject({ kieu: 5, mmsi: 351759000, imo: 9134270, hoHieu: "3FOF8", ten: "EVER DIADEM", loai: 7 });
  });
  it("mảnh 2 tới sau quá hạn ⇒ không ghép bừa", () => {
    const g = new BoGhepAis();
    docCau("!AIVDM,2,1,1,A,55?MbV02;H;s<HtKR20EHE:0@T4@Dn2222222216L961O5Gf0NSQEp6ClRp8,0*1C", g, 0);
    // một tin khác làm dọn mảnh cũ
    docCau("!AIVDM,2,1,2,A,55?MbV02;H;s<HtKR20EHE:0@T4@Dn2222222216L961O5Gf0NSQEp6ClRp8,0*1F", g, 20_000);
    expect(docCau("!AIVDM,2,2,1,A,88888888880,2*25", g, 20_001)).toBeNull();
  });
  it("VDO = tàu mình; payload hỏng ⇒ null", () => {
    expect(giaiMaAis("177KQJ5000G?tO`K>RA1wUbN0TKH", 0, true)?.cuaMinh).toBe(true);
    expect(giaiMaAis("~~~", 0)).toBeNull();
  });
  it("mã loại ITU ⇒ mã app (30 = tàu cá)", () => {
    expect(loaiTuMaAis(30)).toBe(2);
    expect(loaiTuMaAis(70)).toBe(7);
    expect(loaiTuMaAis(84)).toBe(8);
    expect(loaiTuMaAis(52)).toBe(3);
    expect(loaiTuMaAis(null)).toBe(0);
  });
});
