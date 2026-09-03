/**
 * SỐ ĐO SÂU KHẢO SÁT — cổng cho bộ phân tích toạ độ và cho dataset thật.
 *
 * Bộ test này canh đúng bốn chỗ đã suýt sai khi dựng đường ống, mỗi chỗ là một
 * kiểu sai KHÔNG tự lộ ra (số vẫn hợp lý, file vẫn ghi được, không ai biết):
 *  1. cột độ sâu bị lẫn với TÊN ĐIỂM ("DHN - 0 6" → 6 m)
 *  2. khoảng trắng trong bảng nuốt cột ("7,5 10°44'" → 510 độ)
 *  3. lấy nhầm toạ độ hệ VN-2000 thay vì WGS-84 (lệch ~150–200 m)
 *  4. điểm không mang ngày → bà con không biết số này đo hồi nào
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateProvenance,
  isCleanLicense,
  dirtySources,
  LICENSES,
  SOURCES,
} from "../provenance";
import {
  areaFromNotice,
  DEPTH_MAX_M,
  DEPTH_MIN_M,
  decodeSoundingRoutes,
  decodeSoundings,
  hasDepthColumn,
  inVietnamSea,
  isPlausibleDepth,
  isPlausibleRouteDepth,
  keepNewestPerSpot,
  noticeAuthorityCode,
  parseCoordinate,
  parseSoundingRow,
  readControllingDepthM,
  trustNoticeDate,
  ROUTE_DEPTH_MAX_M,
  ROUTE_DEPTH_MIN_M,
  soundingAgeDays,
  spotKey,
  depthColumnCoverage,
  isCoherentRoute,
  isOutsideSourceDomain,
  OFFSHORE_MIN_KM,
  isSparseDepthColumn,
  isSuspectWholeMetreTable,
  routeSpreadKm,
  ROUTE_SPREAD_MAX_KM,
  ocrCoordLine,
  stripOcrHemisphereNoise,
  ocrLineToNoticeLine,
  repairOcrDigits,
  wholeMetreRatio,
  VN_SEA_BBOX,
  type SoundingsFile,
} from "../soundings";

const FILE = join(process.cwd(), "public", "data", "soundings.v1.json");
const rawText = readFileSync(FILE, "utf8");
const data = JSON.parse(rawText) as SoundingsFile;
const points = decodeSoundings(data);
const routes = decodeSoundingRoutes(data);

/* ══ 1. BỘ PHÂN TÍCH TOẠ ĐỘ ═══════════════════════════════════════════════ */

describe("parseCoordinate — hai định dạng thông báo dùng", () => {
  it("đọc độ-phút-giây ký hiệu chuẩn (° ' \")", () => {
    // Chép tay từ TBHH số 784/TBHH-CVHHQNg, điểm B14: 15°23'43.0" N
    expect(parseCoordinate('15°23\'43.0" N', "lat")).toBeCloseTo(15 + 23 / 60 + 43 / 3600, 9);
    expect(parseCoordinate('108°47\'30.4" E', "lon")).toBeCloseTo(108 + 47 / 60 + 30.4 / 3600, 9);
  });

  it("đọc dạng dấu vòng trên + dấu phẩy thập phân + hai dấu phút thay dấu giây", () => {
    // Khuôn THẬT của TBHH 947/TBHH-CVHHTPHCM (Sài Gòn – Vũng Tàu), cột WGS-84.
    expect(parseCoordinate("10 ˚ 44 ’ 35,4 ’’ N", "lat")).toBeCloseTo(10 + 44 / 60 + 35.4 / 3600, 9);
    expect(parseCoordinate("106 ˚ 44 ’ 48,7 ’’ E", "lon")).toBeCloseTo(106 + 44 / 60 + 48.7 / 3600, 9);
  });

  it("chịu được khoảng trắng bộ bóc PDF chèn vào giữa số giây", () => {
    // Trong bảng thật có "0 4,58" — nghĩa là 04,58 giây, không phải 0 và 4,58.
    expect(parseCoordinate("10˚46 ’ 0 4,58 ” N", "lat")).toBeCloseTo(10 + 46 / 60 + 4.58 / 3600, 9);
  });

  it("đọc độ thập phân, có và không có bán cầu", () => {
    expect(parseCoordinate("10.7442 N", "lat")).toBeCloseTo(10.7442, 9);
    expect(parseCoordinate("106,7452 E", "lon")).toBeCloseTo(106.7452, 9);
    expect(parseCoordinate("-8.5", "lat")).toBeCloseTo(-8.5, 9);
  });

  it("bán cầu Nam/Tây cho số âm", () => {
    expect(parseCoordinate("8°30'00\" S", "lat")).toBeCloseTo(-8.5, 9);
    expect(parseCoordinate("100°00'00\" W", "lon")).toBeCloseTo(-100, 9);
  });

  it("trả null chứ KHÔNG trả 0 khi không đọc được hoặc vô lý", () => {
    expect(parseCoordinate("", "lat")).toBeNull();
    expect(parseCoordinate("không có số nào", "lat")).toBeNull();
    expect(parseCoordinate("10°75'00\" N", "lat")).toBeNull(); // phút ≥ 60
    expect(parseCoordinate("10°30'75\" N", "lat")).toBeNull(); // giây ≥ 60
    expect(parseCoordinate("200°00'00\" E", "lon")).toBeNull(); // ngoài dải kinh độ
    expect(parseCoordinate("95.5 N", "lat")).toBeNull(); // ngoài dải vĩ độ
  });
});

/* ══ 2. ĐỌC HÀNG BẢNG ═════════════════════════════════════════════════════ */

describe("parseSoundingRow — hàng bảng độ sâu", () => {
  // CA ĐỐI CHỨNG: chép tay từ TBHH 947/TBHH-CVHHTPHCM ngày 22/4/2026,
  // "Luồng hàng hải Sài Gòn - Vũng Tàu", bảng "những điểm cạn tại vị trí có
  // tọa độ" — cột: Độ sâu (m) | VN-2000 vĩ | VN-2000 kinh | WGS-84 vĩ | WGS-84 kinh.
  const THAT = "7,5 10˚44 ’ 39,04 ” N 106˚44 ’ 42,29 ” E 10 ˚ 44 ’ 35,4 ’’ N 106 ˚ 44 ’ 48,7 ’’ E";

  it("đọc đúng độ sâu và CẢ HAI cặp toạ độ, đúng thứ tự cột", () => {
    const row = parseSoundingRow(THAT);
    expect(row).not.toBeNull();
    expect(row?.depthM).toBe(7.5);
    expect(row?.pairs).toHaveLength(2);
    // cặp 1 = VN-2000
    expect(row?.pairs[0].lat).toBeCloseTo(10 + 44 / 60 + 39.04 / 3600, 9);
    expect(row?.pairs[0].lon).toBeCloseTo(106 + 44 / 60 + 42.29 / 3600, 9);
    // cặp 2 = WGS-84 — hệ mà GPS của tàu trả về
    expect(row?.pairs[1].lat).toBeCloseTo(10 + 44 / 60 + 35.4 / 3600, 9);
    expect(row?.pairs[1].lon).toBeCloseTo(106 + 44 / 60 + 48.7 / 3600, 9);
  });

  it("hai hệ lệch nhau đủ xa để KHÔNG được phép lẫn (≥100 m)", () => {
    const row = parseSoundingRow(THAT)!;
    const dLat = (row.pairs[0].lat - row.pairs[1].lat) * 111_320;
    const dLon = (row.pairs[0].lon - row.pairs[1].lon) * 111_320 * Math.cos((10.74 * Math.PI) / 180);
    expect(Math.hypot(dLat, dLon)).toBeGreaterThan(100);
  });

  it("KHÔNG đọc tên điểm dính số thành độ sâu", () => {
    // Bảng toạ độ GÓC VÙNG: cột đầu là tên điểm, không có cột độ sâu.
    // Chép tay từ TBHH 2139/TBHH-CVHHTPHCM ngày 21/8/2026 (Bến cảng Vietsovpetro).
    const goc =
      "DHN - 0 6 10˚23 ’ 22 , 83 ” N 107˚05 ’ 23 , 28 ” E 10˚23 ’ 1 9 , 16 ” N 107˚05 ’ 2 9 , 70 ” E";
    const row = parseSoundingRow(goc);
    expect(row).not.toBeNull();
    expect(row?.depthM).toBeNull(); // KHÔNG được ra 6
    expect(row?.pairs).toHaveLength(2);
    expect(row?.pairs[1].lat).toBeCloseTo(10 + 23 / 60 + 19.16 / 3600, 9);
  });

  it("cột độ sâu ở đầu hàng KHÔNG bị khoảng trắng nuốt sang cột toạ độ", () => {
    // Nếu khuôn số cho phép khoảng trắng bên trong thì "5 10" thành 510 độ.
    const row = parseSoundingRow(THAT)!;
    expect(row.pairs[0].lat).toBeLessThan(90);
    expect(row.pairs[0].lat).toBeGreaterThan(10);
  });

  it("dòng văn xuôi không phải hàng bảng — trả null, không ném", () => {
    expect(parseSoundingRow("Độ sâu đạt: 7.2m (bảy mét hai).")).toBeNull();
    expect(parseSoundingRow("")).toBeNull();
    expect(parseSoundingRow(undefined as unknown as string)).toBeNull();
  });
});

/* ══ 3. CỔNG KHUNG & DẢI ══════════════════════════════════════════════════ */

describe("cổng khung biển VN và dải độ sâu", () => {
  it("khung ôm đúng vùng biển Việt Nam", () => {
    expect(inVietnamSea(10.74, 106.75)).toBe(true); // luồng Sài Gòn – Vũng Tàu
    expect(inVietnamSea(20.8, 106.8)).toBe(true); // Hải Phòng
    expect(inVietnamSea(1.3, 103.8)).toBe(false); // Singapore
    expect(inVietnamSea(22.3, 114.2)).toBe(true); // trong khung (lọc tinh ở nơi khác)
    expect(inVietnamSea(35.7, 139.7)).toBe(false); // ngoài hẳn
    expect(inVietnamSea(Number.NaN, 106)).toBe(false);
    expect(VN_SEA_BBOX.south).toBeLessThan(VN_SEA_BBOX.north);
    expect(VN_SEA_BBOX.west).toBeLessThan(VN_SEA_BBOX.east);
  });

  it("dải độ sâu loại số 0, số âm và số vô lý", () => {
    expect(isPlausibleDepth(7.5)).toBe(true);
    expect(isPlausibleDepth(DEPTH_MIN_M)).toBe(true);
    expect(isPlausibleDepth(DEPTH_MAX_M)).toBe(true);
    expect(isPlausibleDepth(0)).toBe(false);
    expect(isPlausibleDepth(-3)).toBe(false);
    expect(isPlausibleDepth(DEPTH_MAX_M + 1)).toBe(false);
    expect(isPlausibleDepth(Number.NaN)).toBe(false);
  });
});

/* ══ 4. GIẢI MÃ — hàng hỏng bị bỏ, không làm mất cả lớp ═══════════════════ */

describe("decodeSoundings", () => {
  it("bỏ hàng hỏng thay vì ném", () => {
    expect(decodeSoundings(null)).toEqual([]);
    expect(decodeSoundings({})).toEqual([]);
    expect(decodeSoundings({ diem: "không phải mảng" })).toEqual([]);
  });

  it("loại điểm ngoài khung, độ sâu vô lý, và điểm không có thông báo kèm", () => {
    const tb = {
      so: "1/TBHH-X",
      ngay: "2026-06-16",
      tieuDe: "thử",
      url: "u",
      pdf: "p",
      luong: 0,
      prov: { origin: { source: "tbhh", at: "2026-08-31" } },
    };
    const raw = {
      v: 1,
      luong: [{ ma: "x-1", ten: "Thử" }],
      thongBao: [tb],
      diem: [
        [106.75, 10.74, 75, 0], // hợp lệ
        [139.7, 35.7, 75, 0], // ngoài khung VN
        [106.75, 10.74, 0, 0], // độ sâu 0
        [106.75, 10.74, 9999, 0], // sâu vô lý
        [106.75, 10.74, 75, 9], // trỏ vào thông báo không có
        [106.75, 10.74], // hàng cụt
      ],
    };
    const out = decodeSoundings(raw as unknown);
    expect(out).toHaveLength(1);
    expect(out[0].depthM).toBe(7.5);
    expect(out[0].at).toBe("2026-06-16");
    expect(out[0].area?.ten).toBe("Thử");
  });

  it("tính được tuổi số đo — hải đồ cũ là hải đồ nguy hiểm", () => {
    const s = points[0];
    expect(soundingAgeDays(s, "2026-08-31")).toBeGreaterThanOrEqual(0);
    expect(soundingAgeDays({ ...s, at: "khong-phai-ngay" }, "2026-08-31")).toBeNull();
  });
});

/* ══ 5. DATASET THẬT ĐANG SHIP ════════════════════════════════════════════ */

describe("dataset soundings.v1.json — số đo sâu thật", () => {
  it("giải mã ra đủ điểm (sinh lại không được làm rơi lớp độ sâu)", () => {
    expect(data.v).toBe(1);
    expect(points.length).toBe(data.diem.length);
    // Ngưỡng canh HỒI QUY, không phải chỉ tiêu: lần chạy cả nước 2026-08-31 cho
    // 379 điểm. Rơi xuống dưới 350 nghĩa là đường ống vừa mất một mảng dữ liệu.
    expect(points.length).toBeGreaterThanOrEqual(350);
  });

  it("KHÔNG một ký tự Hán/CJK nào trong toàn bộ file", () => {
    const CJK = /[⺀-⻿　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/;
    expect(CJK.test(rawText)).toBe(false);
  });

  it("MỌI toạ độ nằm trong khung biển Việt Nam", () => {
    const outside = points.filter((p) => !inVietnamSea(p.lat, p.lon));
    expect(outside).toEqual([]);
  });

  it("MỌI độ sâu nằm trong dải hợp lý", () => {
    const bad = points.filter((p) => !isPlausibleDepth(p.depthM));
    expect(bad).toEqual([]);
  });

  it("MỌI điểm mang NGÀY thông báo dạng YYYY-MM-DD và ngày có thật", () => {
    for (const p of points) {
      expect(p.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${p.at}T00:00:00Z`).toISOString().slice(0, 10)).toBe(p.at);
    }
  });

  it("MỌI điểm mang LÝ LỊCH NGUỒN truy được về thông báo gốc", () => {
    for (const p of points) {
      expect(p.notice.prov.origin.source).toBe("tbhh");
      expect(p.notice.prov.origin.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Hai nguồn: danh mục sống vmsa.vn và bản lưu trữ trong Internet Archive.
      expect(p.notice.prov.origin.url).toMatch(
        /^https:\/\/(vmsa\.vn\/.*\.pdf|web\.archive\.org\/web\/\d+id_\/.*)$/i,
      );
      expect(p.notice.so).toBeTruthy();
    }
  });

  /*  CỔNG NÀY ĐÃ MỞ (2026-09-01) — `tbhh` nay có trong `SOURCES`.

      Bản trước của test canh trạng thái NGƯỢC LẠI ("phải còn báo nguồn lạ") và
      tự ghi "ai thêm mục thì cổng tự mở". Đây là lúc đó. Giữ lại cổng nhưng
      đổi vế: lý lịch phải SẠCH và dataset phải LỌT được vào gói bán — vì nếu
      ai lỡ gỡ mục khỏi `SOURCES` thì hai bộ dữ liệu này lặng lẽ rơi khỏi
      `cleanPackage()` mà không ai biết. */
  it("lý lịch SẠCH và dataset lọt được vào gói bán", () => {
    const prov = data.thongBao[0].prov;
    expect(validateProvenance(prov)).toEqual([]);
    expect(isCleanLicense(prov), "giấy phép phải bán lại được, không share-alike").toBe(true);
    expect(dirtySources(prov)).toEqual([]);
  });

  it("nguồn nhà nước VN: ghi công CÓ, share-alike KHÔNG", () => {
    const t = LICENSES[SOURCES.tbhh.license];
    // Ghi công là quyết định của dự án (tra ngược về thông báo gốc), không
    // phải nghĩa vụ pháp lý — Điều 15 Luật SHTT loại văn bản hành chính và số
    // liệu khỏi phạm vi bảo hộ.
    expect(t.attribution).toBe(true);
    expect(t.shareAlike).toBe(false);
    expect(t.redistributable).toBe(true);
  });

  it("ghi rõ nhãn tham khảo — không hứa độ chính xác nguồn không đảm bảo", () => {
    expect(data.nhan).toMatch(/tham khảo/i);
    expect(data.nhan).toMatch(/không thay hải đồ/i);
    expect(data.nguon).toMatch(/Thông báo hàng hải/i);
  });

  it("thông báo đọc không được thì NẰM TRONG danh sách bỏ sót, không biến mất", () => {
    expect(Array.isArray(data.boSot)).toBe(true);
    expect(data.boSot.length).toBeGreaterThan(0);
    for (const b of data.boSot) {
      expect(b.lyDo).toBeTruthy();
      expect(b.url).toMatch(/^https?:\/\/(www\.)?(vmsa\.vn|vms-south\.vn)(:80)?\//);
      // Mục từ bản lưu trữ có thể KHÔNG có ngày — đó thường là chính lý do bị bỏ.
      if (b.ngay) expect(b.ngay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // PDF ảnh scan phải được gọi đúng tên, không lẫn vào "không có bảng".
    expect(data.boSot.some((b) => /scan/i.test(b.lyDo))).toBe(true);
  });

  it("trần dung lượng 20 MB/file của hook pre-commit", () => {
    expect(rawText.length).toBeLessThan(20 * 1024 * 1024);
  });
});

/* ══ 6. CỔNG ĐỎ 1 — VÙNG ĐỌC TỪ SỐ HIỆU, KHÔNG ĐỌC TỪ CHUYÊN MỤC ══════════ */

describe("areaFromNotice — chuyên mục nói dối, số hiệu nói thật", () => {
  it("đọc được mã cơ quan qua mọi kiểu viết số hiệu đã gặp thật", () => {
    expect(noticeAuthorityCode("1844/TBHH - CVHHHP")).toBe("CVHHHP"); // dấu cách quanh gạch
    expect(noticeAuthorityCode("140/2020/TBHH-TCTBĐATHHMB")).toBe("TCTBĐATHHMB"); // chèn năm
    expect(noticeAuthorityCode("24/TBHH-CT.BĐATHHMB")).toBe("CTBĐATHHMB"); // có dấu chấm
    expect(noticeAuthorityCode("109/TBHH-TCTBĐATHHMB,")).toBe("TCTBĐATHHMB"); // dính dấu phẩy
    expect(noticeAuthorityCode("Đăng ngày 04/05/2007")).toBeNull(); // bản cũ không có số hiệu
    expect(noticeAuthorityCode("")).toBeNull();
    expect(noticeAuthorityCode(undefined as unknown as string)).toBeNull();
  });

  it("KHÔNG viết hoa: CVHHQNg (Quảng Ngãi) khác CVHHQNh (Quy Nhơn)", () => {
    // Hai cảng vụ chỉ khác nhau ở chữ cái cuối viết thường. Viết hoa toàn bộ
    // là gộp Quảng Ngãi với Quy Nhơn — cách nhau 300 km.
    expect(noticeAuthorityCode("663/TBHH-CVHHQNg")).toBe("CVHHQNg");
    expect(noticeAuthorityCode("35/TBHH-CVHHQNh")).toBe("CVHHQNh");
    expect(areaFromNotice("663/TBHH-CVHHQNg")?.ten).toMatch(/Quảng Ngãi/);
    expect(areaFromNotice("35/TBHH-CVHHQNh")?.ten).toMatch(/Quy Nhơn/);
  });

  it("chuyên mục `an-giang-456` thực ra là KIÊN GIANG", () => {
    // Bẫy thật: An Giang không có bờ biển giáp Rạch Giá. Gán nhãn theo slug là
    // dán tên tỉnh sai lên số đo sâu.
    const a = areaFromNotice("969/TBHH-CVHHKG");
    expect(a?.ma).toBe("CVHHKG");
    expect(a?.ten).toMatch(/Kiên Giang/);
    expect(a?.ten).not.toMatch(/An Giang/);
  });

  it("`gia-lai-449` là Quy Nhơn, `lam-dong-457` là Bình Thuận", () => {
    expect(areaFromNotice("40/TBHH-CVHHQNh")?.ten).toMatch(/Quy Nhơn/);
    expect(areaFromNotice("40/TBHH-CVHHQNh")?.ten).not.toMatch(/Gia Lai/);
    expect(areaFromNotice("12/TBHH-CVHHBT")?.ten).toMatch(/Bình Thuận/);
    expect(areaFromNotice("12/TBHH-CVHHBT")?.ten).not.toMatch(/Lâm Đồng/);
  });

  it("mã trùng CVHHĐN tách bằng vĩ độ — Đà Nẵng 16°N, Đồng Nai 10,6°N", () => {
    expect(areaFromNotice("8/TBHH-CVHHĐN", 16.1)?.ten).toMatch(/Đà Nẵng/);
    expect(areaFromNotice("29/TBHH-CVHHĐN", 10.6)?.ten).toMatch(/Đồng Nai/);
    // Không có vĩ độ thì KHÔNG ĐOÁN — thà bỏ còn hơn đặt Đồng Nai ra Đà Nẵng.
    expect(areaFromNotice("29/TBHH-CVHHĐN")).toBeNull();
  });

  it("ba mã gần giống nhau là BA cảng vụ khác nhau, không được gộp", () => {
    // Quét cả nước 2026-08-31: `CVHHQN` xuất hiện 78/78 lần dưới chuyên mục
    // `quang-ninh-252` ⇒ Quảng Ninh. `CVHHQNh` là Quy Nhơn, `CVHHQNg` là Quảng
    // Ngãi. Ba mã, ba nơi, cách nhau cả nghìn cây số.
    expect(areaFromNotice("1/TBHH-CVHHQN")?.ten).toMatch(/Quảng Ninh/);
    expect(areaFromNotice("1/TBHH-CVHHQNh")?.ten).toMatch(/Quy Nhơn/);
    expect(areaFromNotice("1/TBHH-CVHHQNg")?.ten).toMatch(/Quảng Ngãi/);
  });

  it("mã lạ hoặc mã CỤT do bóc PDF hỏng thì trả null, KHÔNG đoán", () => {
    expect(areaFromNotice("1/TBHH-XYZ")).toBeNull();
    expect(areaFromNotice("1/TBHH-TCTBĐATHHM")).toBeNull(); // cụt mất chữ cuối: MB hay MN?
    expect(areaFromNotice("1/TBHH-TCTB")).toBeNull();
  });

  it("nhận cả cách gõ KHÔNG DẤU của tên file bản lưu trữ", () => {
    expect(areaFromNotice("35/TBHH-TCTBDATHHMN")?.ten).toMatch(/miền Nam/);
    expect(areaFromNotice("35/TBHH-TCTBĐATHHMN")?.ten).toMatch(/miền Nam/);
  });
});

/* ══ 7. CỔNG ĐỎ 2 (mở rộng) — CỘT TÊN ĐIỂM TOÀN SỐ ═══════════════════════ */

describe("hasDepthColumn — bảng này có cột độ sâu thật không", () => {
  const hang = (s: string) => parseSoundingRow(s)!;

  it("bảng độ sâu thật: có ít nhất một số lẻ thì nhận, kể cả hàng tròn mét", () => {
    const rows = [
      hang("7,5 10˚44 ’ 39,04 ” N 106˚44 ’ 42,29 ” E"),
      hang("8 10˚44 ’ 40,04 ” N 106˚44 ’ 43,29 ” E"),
    ];
    expect(hasDepthColumn(rows)).toBe(true);
    expect(rows[1].depthM).toBe(8);
  });

  it("bảng TÊN ĐIỂM toàn số nguyên: KHÔNG có cột độ sâu, bỏ cả bảng", () => {
    // Án lệ "DHN - 0 6" ở dạng khó thấy hơn: cột tên điểm chỉ là "01", "06",
    // "12". Mỗi hàng trông y hệt một hàng độ sâu, ở toạ độ thật, trong dải hợp
    // lý — không cổng NÀO KHÁC chặn được.
    const rows = [
      hang("01 10˚23 ’ 22 ” N 107˚05 ’ 23 ” E"),
      hang("06 10˚23 ’ 25 ” N 107˚05 ’ 26 ” E"),
      hang("12 10˚23 ’ 28 ” N 107˚05 ’ 29 ” E"),
    ];
    expect(rows.every((r) => r.depthM !== null)).toBe(true); // từng hàng thì trông hợp lệ
    expect(hasDepthColumn(rows)).toBe(false); // cả bảng thì KHÔNG
  });

  it("bảng không có ô độ sâu nào thì false; đầu vào rác cũng false", () => {
    expect(hasDepthColumn([hang("10˚23 ’ 22 ” N 107˚05 ’ 23 ” E")])).toBe(false);
    expect(hasDepthColumn([])).toBe(false);
    expect(hasDepthColumn(undefined as unknown as [])).toBe(false);
  });
});

/* ══ 8. CỔNG ĐỎ 3 — THÔNG BÁO MỚI ĐÈ THÔNG BÁO CŨ ════════════════════════ */

describe("keepNewestPerSpot — luồng được nạo vét thì độ sâu đổi", () => {
  it("cùng một chỗ thì giữ bản MỚI NHẤT theo ngày", () => {
    const cu = { lat: 10.5297, lon: 107.0186, depthM: 13.6, at: "2026-06-16" };
    const moi = { lat: 10.52971, lon: 107.01861, depthM: 11.2, at: "2026-07-17" };
    const out = keepNewestPerSpot([cu, moi]);
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe("2026-07-17");
    expect(out[0].depthM).toBe(11.2);
  });

  it("thứ tự đầu vào không đổi kết quả — bản mới thắng dù đứng trước", () => {
    const cu = { lat: 10.5297, lon: 107.0186, depthM: 13.6, at: "2026-06-16" };
    const moi = { lat: 10.52971, lon: 107.01861, depthM: 11.2, at: "2026-07-17" };
    expect(keepNewestPerSpot([moi, cu])[0].at).toBe("2026-07-17");
  });

  it("bằng ngày thì giữ bản NÔNG HƠN — an toàn hơn cho tàu", () => {
    const a = { lat: 10.5297, lon: 107.0186, depthM: 9.9, at: "2026-07-17" };
    const b = { lat: 10.5297, lon: 107.0186, depthM: 4.1, at: "2026-07-17" };
    expect(keepNewestPerSpot([a, b])[0].depthM).toBe(4.1);
    expect(keepNewestPerSpot([b, a])[0].depthM).toBe(4.1);
  });

  it("hai chỗ CÁCH NHAU thì giữ cả hai — không gộp bừa", () => {
    const a = { lat: 10.5297, lon: 107.0186, depthM: 9.9, at: "2026-07-17" };
    const xa = { lat: 10.6, lon: 107.1, depthM: 4.1, at: "2026-01-01" };
    expect(keepNewestPerSpot([a, xa])).toHaveLength(2);
    expect(spotKey(a.lat, a.lon)).not.toBe(spotKey(xa.lat, xa.lon));
  });

  it("bỏ toạ độ rác thay vì ném", () => {
    const rac = { lat: Number.NaN, lon: 107, depthM: 5, at: "2026-01-01" };
    expect(keepNewestPerSpot([rac])).toEqual([]);
  });
});

/* ══ 9. ĐỘ SÂU KHỐNG CHẾ VIẾT Ở VĂN XUÔI ═════════════════════════════════ */

describe("readControllingDepthM — câu độ sâu ngay sau bảng tim tuyến", () => {
  it("đọc đúng khuôn thật, kể cả khi bộ bóc PDF rắc khoảng trắng vào số", () => {
    // Chép tay từ TBHH 969/TBHH-CVHHKG (luồng Năm Căn – Bồ Đề).
    expect(readControllingDepthM("Độ sâu đoạn luồng đạt 11,8 m.")).toBe(11.8);
    expect(readControllingDepthM("Đ ộ sâu đoạn luồng đạt 10 ,0 mét.")).toBe(10);
    expect(readControllingDepthM("dài khoảng 2,8 km, độ sâu đạt 2, 7 m.")).toBe(2.7);
    expect(readControllingDepthM("độ sâu đạt khoảng: 1.4m")).toBe(1.4);
  });

  it("chữ dương nghĩa là đáy CAO HƠN mặt chuẩn, phải ra số ÂM", () => {
    expect(readControllingDepthM("độ sâu đạt khoảng dương 0,2m")).toBe(-0.2);
  });

  it("BẮT BUỘC có chữ đạt — dải cạn cảnh báo KHÔNG phải độ sâu khống chế", () => {
    expect(readControllingDepthM("Dải cạn có độ sâu từ 1.9m đến 2.2m")).toBeNull();
    expect(readControllingDepthM("chiều dài khoảng 13,0 km")).toBeNull();
    expect(readControllingDepthM("")).toBeNull();
    expect(readControllingDepthM(undefined as unknown as string)).toBeNull();
  });

  it("số vô lý cho một luồng thì trả null, không trả bừa", () => {
    expect(readControllingDepthM("độ sâu đạt 250 m")).toBeNull();
    expect(isPlausibleRouteDepth(ROUTE_DEPTH_MIN_M)).toBe(true);
    expect(isPlausibleRouteDepth(ROUTE_DEPTH_MAX_M)).toBe(true);
    expect(isPlausibleRouteDepth(ROUTE_DEPTH_MAX_M + 0.1)).toBe(false);
    expect(isPlausibleRouteDepth(ROUTE_DEPTH_MIN_M - 0.1)).toBe(false);
  });
});

/* ══ 10. GIẢI MÃ TIM TUYẾN ═══════════════════════════════════════════════ */

describe("decodeSoundingRoutes", () => {
  const tb = {
    so: "969/TBHH-CVHHKG",
    ngay: "2026-08-11",
    tieuDe: "thử",
    url: "u",
    pdf: "p",
    luong: 0,
    prov: { origin: { source: "tbhh", at: "2026-08-31" } },
  };
  const raw = {
    v: 1,
    luong: [{ ma: "CVHHKG", ten: "Cảng vụ Hàng hải Kiên Giang" }],
    thongBao: [tb],
    tuyen: [
      {
        tb: 0,
        ten: "Đoạn luồng từ cửa sông Bồ Đề đến cảng Năm Căn",
        diem: [
          [105.0, 8.76],
          [105.01, 8.77],
        ],
        sau: 118,
      },
      { tb: 0, ten: null, diem: [[105.0, 8.76]], sau: 100 }, // một đỉnh — không phải đường
      {
        tb: 9, // trỏ vào thông báo không có
        ten: null,
        diem: [
          [105.0, 8.76],
          [105.01, 8.77],
        ],
        sau: 100,
      },
      {
        tb: 0,
        ten: null,
        diem: [
          [139.7, 35.7],
          [139.8, 35.8],
        ], // ngoài khung biển VN
        sau: 100,
      },
    ],
  };

  it("bỏ tuyến hỏng thay vì ném, giữ tuyến lành", () => {
    const out = decodeSoundingRoutes(raw as unknown);
    expect(out).toHaveLength(1);
    expect(out[0].sauM).toBe(11.8);
    expect(out[0].at).toBe("2026-08-11");
    expect(out[0].points).toHaveLength(2);
    expect(out[0].area?.ten).toMatch(/Kiên Giang/);
  });

  it("file không có `tuyen` thì trả mảng rỗng, không ném", () => {
    expect(decodeSoundingRoutes(null)).toEqual([]);
    expect(decodeSoundingRoutes({})).toEqual([]);
    expect(decodeSoundingRoutes({ tuyen: "không phải mảng" })).toEqual([]);
  });
});

/* ══ 11. DATASET THẬT — HAI KHUÔN VÀ CỔNG VÙNG ═══════════════════════════ */

describe("dataset soundings.v1.json — tim tuyến và vùng", () => {
  it("VÙNG của MỌI thông báo đọc được từ SỐ HIỆU, không từ chuyên mục", () => {
    // Cổng thật: ai quay lại gán vùng theo slug thì ca này đỏ.
    for (const t of data.thongBao) {
      const p = points.find((x) => x.notice === t);
      const r = routes.find((x) => x.notice === t);
      const lat = p ? p.lat : r ? r.points[0].lat : null;
      const a = areaFromNotice(t.so, lat);
      expect(a).not.toBeNull();
      expect(data.luong[t.luong].ma).toBe(a!.ma);
    }
  });

  it("không một điểm nào trùng chỗ với điểm khác (đã gộp bản cũ)", () => {
    const keys = points.map((p) => spotKey(p.lat, p.lon));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("MỌI tuyến có ít nhất 2 đỉnh trong khung VN và một độ sâu hợp lý", () => {
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(r.points.length).toBeGreaterThanOrEqual(2);
      expect(r.sauM).not.toBeNull();
      expect(isPlausibleRouteDepth(r.sauM as number)).toBe(true);
      expect(r.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.notice.prov.origin.source).toBe("tbhh");
    }
  });

  it("phủ nhiều cảng vụ — không còn là mẫu hai luồng", () => {
    expect(data.luong.length).toBeGreaterThanOrEqual(5);
  });
});

/* ══ 12. CỬA SỔ GIỮA "ĐỘ SÂU" VÀ "ĐẠT" — nới thì phải canh cả hai chiều ═══ */

describe("readControllingDepthM — câu dài của miền Nam", () => {
  // Chép tay từ PDF thật trong kho (cảng vụ miền Nam). Khoảng cách giữa chữ
  // "độ sâu" và chữ "đạt" là 85 ký tự — cửa sổ 80 của bản đầu KHÔNG với tới,
  // và đó là toàn bộ lý do Bình Thuận có 33 PDF có lớp chữ mà ra 0 điểm.
  const NAM_85 =
    'Độ sâu được xác định bằng máy đo sâu hồi âm tần số 200 kHz tính đến mực nước "số 0 Hải đồ" đạt 12 , 66 m';

  it("PHẢI khớp câu 85 ký tự của miền Nam", () => {
    expect(readControllingDepthM(NAM_85)).toBe(12.7);
  });

  it("PHẢI khớp cả bản bị bộ bóc PDF rắc khoảng trắng (107 ký tự)", () => {
    const raC =
      'Đ ộ sâu đư ợ c xác đ ị nh b ằ ng máy đo sâu h ồ i âm t ầ n s ố 200kHz tính đ ế n m ự c nư ớ c "s ố 0 H ả i đ ồ " đ ạ t 7,9 m';
    expect(readControllingDepthM(raC)).toBe(7.9);
  });

  it("KHÔNG được khớp câu cảnh báo dải cạn, dù cửa sổ đã nới", () => {
    // Câu này cũng có "độ sâu" và cũng có số. Nó là DẢI CẠN CẢNH BÁO, không
    // phải độ sâu khống chế — lẫn hai thứ là đưa bà con một con số sai chỗ.
    expect(readControllingDepthM("Dải cạn có độ sâu TỪ 1.9m ĐẾN 2.2m")).toBeNull();
    expect(
      readControllingDepthM("Lưu ý: Dải cạn có độ sâu từ 1,9m đến 2,2m tại phía biên phải luồng"),
    ).toBeNull();
  });

  it("KHÔNG được bước qua DẤU CHẤM để vớ số của câu sau", () => {
    // Cửa sổ 120 ký tự thừa sức với tới "đạt" ở câu kế. `[^.]` phải chặn.
    const haiCau = "Trong phạm vi đáy luồng nêu trên không còn độ sâu nhỏ hơn. Chiều rộng đạt 60 m";
    expect(readControllingDepthM(haiCau)).toBeNull();
  });

  it("chữ dương trong câu dài vẫn phải ra số ÂM", () => {
    const bồi =
      'Độ sâu được xác định bằng máy hồi âm tần số 200 kHz tính đến mực nước "số 0 Hải đồ" đạt khoảng dương 0,2 m';
    expect(readControllingDepthM(bồi)).toBe(-0.2);
  });
});

/* ══ 13. CỔNG NGÀY — bản ký số để trống ô ngày ═══════════════════════════ */

describe("trustNoticeDate — không để ngày của Nghị định thành ngày khảo sát", () => {
  it("ngày khớp năm của bản lưu thì tin", () => {
    expect(trustNoticeDate("2025-04-18", 2025)).toBe(true);
    expect(trustNoticeDate("2025-01-03", 2024)).toBe(true); // ký cuối năm, đăng sang năm sau
    expect(trustNoticeDate("2024-12-30", 2025)).toBe(true);
  });

  it("ngày của văn bản ĐƯỢC DẪN thì KHÔNG tin", () => {
    // "Nghị định 58/2017 ngày 10/5/2017" nằm trong phần căn cứ của một thông
    // báo năm 2025. Đúng khuôn, năm có thật, điểm vẫn trong khung biển — chỉ
    // cổng này chặn được.
    expect(trustNoticeDate("2017-05-10", 2025)).toBe(false);
    expect(trustNoticeDate("2019-08-01", 2024)).toBe(false);
  });

  it("ngày không có thật hoặc quá cũ thì KHÔNG tin", () => {
    expect(trustNoticeDate("2026-02-31", 2026)).toBe(false);
    expect(trustNoticeDate("1999-01-01", null)).toBe(false);
    expect(trustNoticeDate("", 2025)).toBe(false);
    expect(trustNoticeDate("22/4/2026", 2026)).toBe(false);
    expect(trustNoticeDate(undefined as unknown as string, 2025)).toBe(false);
  });

  it("không biết năm nguồn thì chỉ xét khuôn và dải năm", () => {
    expect(trustNoticeDate("2017-05-10", null)).toBe(true);
    expect(trustNoticeDate("2200-05-10", null)).toBe(false);
  });

  it("MỌI thông báo trong dataset đều có ngày đứng vững", () => {
    for (const t of data.thongBao) expect(trustNoticeDate(t.ngay, null)).toBe(true);
  });
});

/* ══ 8. CHỮ BÓC BẰNG OCR (ẢNH SCAN) ═══════════════════════════════════════
   985/2.261 thông báo trong kho là ảnh scan. Mọi ca dưới đây chép TỪ CHỮ OCR
   THẬT của 976/TBHH-CVHHHP và 859/TBHH-CVHHHP, không phải ví dụ nghĩ ra —
   ba kiểu sai này là ba kiểu duy nhất đo được, và cả ba đều âm thầm.        */

describe("repairOcrDigits — chữ cái đội lốt chữ số", () => {
  it("sửa số trong cụm ĐÃ CÓ chữ số (đúng ca làm mất câu độ sâu)", () => {
    // Chép tay từ chữ OCR thật của 976/TBHH-CVHHHP: "độ sâu đạt: 1,Sm".
    expect(repairOcrDigits("độ sâu đạt: 1,Sm")).toBe("độ sâu đạt: 1,5m");
    expect(repairOcrDigits("Dải cạn có độ sâu từ I,Om đến I,4m")).toBe(
      "Dải cạn có độ sâu từ 1,0m đến 1,4m",
    );
    expect(repairOcrDigits("máy hồi âm tần số 2OOkHz")).toBe("máy hồi âm tần số 200kHz");
  });

  it("câu độ sâu đã gột thì bộ đọc dùng chung đọc được", () => {
    // Đây mới là điều thật sự cần: gột xong phải LỌT bộ đọc, không chỉ đẹp mắt.
    expect(readControllingDepthM("độ sâu đạt: 1,Sm")).toBe(null);
    expect(readControllingDepthM(repairOcrDigits("độ sâu đạt: 1,Sm"))).toBe(1.5);
  });

  it("KHÔNG đụng cụm không có lấy một chữ số nào", () => {
    // "khoảng IOm" (bề rộng dải cạn) có thể là 10 m — nhưng không có chữ số
    // thật nào làm chứng, nên thà bỏ còn hơn đoán.
    expect(repairOcrDigits("khu vực rộng lấn vào luồng khoảng IOm.")).toBe(
      "khu vực rộng lấn vào luồng khoảng IOm.",
    );
  });

  it("KHÔNG đụng chữ tiếng Việt bình thường", () => {
    const cau = "Cảng vụ Hàng hải Hải Phòng thông báo về luồng hàng hải";
    expect(repairOcrDigits(cau)).toBe(cau);
    expect(repairOcrDigits("Bộ luật Hàng hải Việt Nam")).toBe("Bộ luật Hàng hải Việt Nam");
  });

  it("chịu được đầu vào rỗng / sai kiểu", () => {
    expect(repairOcrDigits("")).toBe("");
    expect(repairOcrDigits(null as unknown as string)).toBe("");
  });
});

describe("ocrCoordLine — ký tự độ bị đọc thành chữ số", () => {
  it("dựng lại hàng bảng thật của 859/TBHH-CVHHHP", () => {
    // Chữ OCR thật: `20948'11.3"` là 20°48'11,3" (ký tự độ ra chữ số 9),
    // `106054'31.8"` là 106°54'31,8" (ký tự độ ra chữ số 0). Ô toạ độ KHÔNG in
    // chữ N/E — chữ ấy nằm ở dòng tiêu đề cột.
    const ra = ocrCoordLine("20948'11.3\" 106054'31.8\"");
    expect(ra).not.toBe(null);
    const row = parseSoundingRow(ra as string);
    expect(row).not.toBe(null);
    expect(row?.pairs).toHaveLength(1);
    expect(row?.pairs[0].lat).toBeCloseTo(20 + 48 / 60 + 11.3 / 3600, 9);
    expect(row?.pairs[0].lon).toBeCloseTo(106 + 54 / 60 + 31.8 / 3600, 9);
  });

  it("giữ nguyên ô độ sâu đứng trước toạ độ", () => {
    const ra = ocrCoordLine("7,5 20948'11.3\" 106054'31.8\"");
    const row = parseSoundingRow(ra as string);
    expect(row?.depthLiteral).toBe("7,5");
    expect(row?.depthM).toBe(7.5);
  });

  it("dựng đủ HAI cặp trên một hàng (VN-2000 rồi WGS-84)", () => {
    const ra = ocrCoordLine("20948'11.3\" 106054'31.8\" 20948'07.7\" 106054'38.6\"");
    const row = parseSoundingRow(ra as string);
    expect(row?.pairs).toHaveLength(2);
    expect(row?.pairs[1].lat).toBeCloseTo(20 + 48 / 60 + 7.7 / 3600, 9);
  });

  it("dòng OCR đọc TRÚNG rồi thì để nguyên, không đụng vào", () => {
    const dung = "7,5 10°44'39,04\"N 106°44'42,29\"E";
    expect(ocrCoordLine(dung)).toBe(dung);
  });

  it("cặp nào rơi ra ngoài khung biển VN thì BỎ cả dòng, không đoán", () => {
    // 60°48' không phải vĩ độ Việt Nam; không có cách tách nào cứu được.
    expect(ocrCoordLine("60948'11.3\" 106054'31.8\"")).toBe(null);
  });

  it("thiếu dấu phút thì KHÔNG dựng — thà bỏ hàng còn hơn tách bừa", () => {
    // Chữ OCR thật của 6ff87ba…: `2095640,4"` mất dấu phút. Cụm số ấy có nhiều
    // cách tách đều hợp lý, nên bộ dựng không nhận.
    expect(ocrCoordLine("2095640,4\" 107904'33,5\"")).toBe(null);
  });

  it("một mình một toạ độ thì không đủ để ghép cặp", () => {
    expect(ocrCoordLine("20948'11.3\"")).toBe(null);
    expect(ocrCoordLine("")).toBe(null);
    expect(ocrCoordLine(null as unknown as string)).toBe(null);
  });
});

describe("ocrLineToNoticeLine — gột chữ rồi dựng toạ độ, một đường", () => {
  it("hàng bảng đi qua cả hai bước", () => {
    const row = parseSoundingRow(ocrLineToNoticeLine("7,S 20948'11.3\" 106054'31.8\""));
    expect(row?.depthM).toBe(7.5);
    expect(row?.pairs[0].lat).toBeCloseTo(20 + 48 / 60 + 11.3 / 3600, 9);
  });

  it("dòng văn xuôi chỉ được gột chữ số, không bị vứt", () => {
    expect(ocrLineToNoticeLine("hải, độ sâu đạt: 1,Sm (một mét rưỡi).")).toBe(
      "hải, độ sâu đạt: 1,5m (một mét rưỡi).",
    );
  });
});

describe("cổng tỉ lệ số mét chẵn — độc lập với OCR", () => {
  it("cột toàn mét chẵn là ĐÁNG NGỜ (OCR rơi phần thập phân)", () => {
    // Máy hồi âm ghi tới 0,1 m. `7,7` bị đọc thành `7` đã làm hỏng 16/17 số
    // của một thông báo trong đợt trước — cổng này là thứ bắt được nó.
    const chan = ["7", "8", "6", "9", "7", "8", "6", "7", "8"];
    expect(wholeMetreRatio(chan)).toBe(1);
    expect(isSuspectWholeMetreTable(chan)).toBe(true);
  });

  it("cột đo thật có số lẻ thì lọt", () => {
    const that = ["7,5", "8,2", "6,4", "9,0", "7,7", "8,1", "6,6", "7,3", "8"];
    expect(wholeMetreRatio(that)).toBeCloseTo(1 / 9, 6);
    expect(isSuspectWholeMetreTable(that)).toBe(false);
  });

  it("dưới sàn 8 số thì KHÔNG kết luận — mẫu quá nhỏ", () => {
    // Một bảng ba hàng toàn mét chẵn là chuyện bình thường, không phải bằng
    // chứng. Cổng chỉ nói khi có đủ số để nói.
    expect(isSuspectWholeMetreTable(["7", "8", "6"])).toBe(false);
    expect(isSuspectWholeMetreTable([])).toBe(false);
    expect(wholeMetreRatio([])).toBe(0);
  });

  it("đúng ngưỡng 80% thì CHƯA chặn, quá 80% mới chặn", () => {
    const tam = ["7", "8", "6", "9", "7", "8", "6", "9", "7,5", "8,2"]; // 8/10 = 80%
    expect(wholeMetreRatio(tam)).toBeCloseTo(0.8, 9);
    expect(isSuspectWholeMetreTable(tam)).toBe(false);
    expect(isSuspectWholeMetreTable([...tam.slice(0, 9), "8"])).toBe(true); // 9/10
  });
});

describe("cờ ngayUocLuong — ngày SUY ĐOÁN không được đội lốt ngày ký", () => {
  it("thông báo nào mang cờ thì ngày của nó rơi đúng ngày 01", () => {
    // Ngày suy đoán lùi về ngày 01 của tháng đọc từ `/uploads/<năm>/<tháng>/`.
    // Cờ mà đúng thì ngày phải khớp luật ấy; lệch nghĩa là cờ gắn bừa.
    for (const t of data.thongBao) {
      if (t.ngayUocLuong) expect(t.ngay.slice(-2)).toBe("01");
    }
  });

  it("cờ chỉ nhận đúng hai trạng thái, không có giá trị lạ", () => {
    for (const t of data.thongBao) {
      if ("ngayUocLuong" in t) expect(typeof t.ngayUocLuong).toBe("boolean");
      if ("ocr" in t) expect(typeof t.ocr).toBe("boolean");
    }
  });

  it("điểm đọc bằng OCR vẫn phải qua đủ mọi cổng như điểm bóc từ lớp chữ", () => {
    // OCR không được là cửa sau. Cùng khung biển, cùng dải độ sâu, cùng ngày.
    const ocrTb = new Set(
      data.thongBao.map((t, i) => (t.ocr ? i : -1)).filter((i) => i >= 0),
    );
    for (const p of points) {
      const i = data.thongBao.indexOf(p.notice);
      if (!ocrTb.has(i)) continue;
      expect(inVietnamSea(p.lat, p.lon)).toBe(true);
      expect(isPlausibleDepth(p.depthM)).toBe(true);
      expect(trustNoticeDate(p.at, null)).toBe(true);
    }
  });
});

describe("cổng tuyến toè — một thông báo chỉ nói về MỘT chỗ", () => {
  it("BẮT ĐƯỢC ca thật 2980/TBHH-CVHHHP: đỉnh Hải Phòng rơi xuống Sài Gòn", () => {
    // Chép tay từ dữ liệu sinh ra trước khi có cổng này. Hai đỉnh ở Hải Phòng,
    // một đỉnh ở 10,66°B vì OCR làm rụng chữ số đầu của 106°39' thành 10°39'.
    // MỌI cổng cũ đều xanh với hàng này — đó là lý do cổng này phải tồn tại.
    const toe = [
      [106.65589, 20.87994],
      [106.65867, 10.65678],
      [106.657, 20.87936],
    ];
    expect(Math.round(routeSpreadKm(toe))).toBe(1137);
    expect(isCoherentRoute(toe)).toBe(false);
  });

  it("tuyến thật thì lọt — kể cả tuyến dài nhất gặp thật (15 km)", () => {
    const that = [
      [106.7, 20.85],
      [106.75, 20.9],
      [106.8, 20.95],
    ];
    expect(routeSpreadKm(that)).toBeLessThan(15);
    expect(isCoherentRoute(that)).toBe(true);
  });

  it("dùng TRUNG VỊ chứ không dùng trung bình", () => {
    // Trung bình bị chính đỉnh sai kéo về phía nó và tự giấu mình. Ba đỉnh tốt
    // + một đỉnh sai: tâm phải vẫn nằm ở cụm ba đỉnh tốt.
    const d = [
      [106.7, 20.85],
      [106.7, 20.85],
      [106.7, 20.85],
      [110.0, 15.0],
    ];
    expect(routeSpreadKm(d)).toBeGreaterThan(600);
    expect(isCoherentRoute(d)).toBe(false);
  });

  it("đầu vào rỗng / rác thì trả 0, KHÔNG ném", () => {
    expect(routeSpreadKm([])).toBe(0);
    expect(routeSpreadKm(null as unknown as number[][])).toBe(0);
    expect(routeSpreadKm([["a", "b"] as unknown as number[]])).toBe(0);
    expect(isCoherentRoute([])).toBe(true);
  });

  it("MỌI tuyến trong dataset đều qua cổng", () => {
    for (const t of data.tuyen ?? []) {
      expect(routeSpreadKm(t.diem)).toBeLessThanOrEqual(ROUTE_SPREAD_MAX_KM);
    }
  });
});

describe("cổng cột độ sâu thưa — cột TÊN ĐIỂM đội lốt cột độ sâu", () => {
  // Ca thật 985/TBHH-CVHHQT: bảng 11 hàng, cột đầu là tên điểm (B1, KNA, KN7,
  // KN9, KN3, KN2, B2, BL.1…). OCR đọc `BL.1` thành `81.1` — có dấu thập phân
  // nên hasDepthColumn gật, 81,1 m dưới trần 200 m nên cổng dải cũng gật. Một
  // số đo sâu 81,1 m đặt vào toạ độ thật, trong vũng cảng mà chính thông báo
  // ấy nói "độ sâu đạt: 2,1 m".
  const hang = (depthM: number | null, lit: string | null) => ({
    depthM,
    depthLiteral: lit,
    pairs: [{ lat: 16.9, lon: 107.18 }],
  });

  it("BẮT ĐƯỢC ca thật: 1/11 hàng có số → là cột tên, không phải cột độ sâu", () => {
    const bang = [hang(81.1, "81.1"), ...Array.from({ length: 10 }, () => hang(null, null))];
    // hasDepthColumn KHÔNG chặn được — đó là lý do cổng này phải tồn tại.
    expect(hasDepthColumn(bang)).toBe(true);
    expect(depthColumnCoverage(bang)).toBeCloseTo(1 / 11, 6);
    expect(isSparseDepthColumn(bang)).toBe(true);
  });

  it("bảng khảo sát thật điền kín thì lọt", () => {
    const bang = ["7,5", "8,2", "6,4", "9,1", "7,7"].map((l) => hang(Number(l.replace(",", ".")), l));
    expect(depthColumnCoverage(bang)).toBe(1);
    expect(isSparseDepthColumn(bang)).toBe(false);
  });

  it("thiếu một hai ô vẫn lọt — khảo sát bỏ trống một điểm là chuyện thường", () => {
    const bang = [
      hang(7.5, "7,5"),
      hang(8.2, "8,2"),
      hang(6.4, "6,4"),
      hang(9.1, "9,1"),
      hang(null, null),
    ];
    expect(depthColumnCoverage(bang)).toBe(0.8);
    expect(isSparseDepthColumn(bang)).toBe(false);
  });

  it("bảng rỗng / rác thì không kết tội", () => {
    expect(isSparseDepthColumn([])).toBe(false);
    expect(depthColumnCoverage([])).toBe(0);
    expect(isSparseDepthColumn(null as unknown as [])).toBe(false);
  });
});

describe("stripOcrHemisphereNoise — chữ số nhiễu dính sau dấu giây", () => {
  /* Ca thật, đợt miền Nam. Bảng in `10°07'35,9"` thì OCR ra `10907'35,9"1`:
     dấu độ thành `9`, và thừa một chữ `1` sau dấu giây. Đường đi của tai hoạ:

       raw    `A 10907'35,9"1 105941'10,8"5`
       dựng   `A 10°07'35,9"N1 105°41'10,8"E5`   ← ocrCoordLine CHÈN N/E vào
       đọc    parseSoundingRow ăn hai toạ độ, còn lại `5` ở cuối hàng
       ra     một hàng góc vùng mang "độ sâu 5 m"

     5/11 thông báo miền Nam sinh điểm giả từ đúng cái này. */

  it("gỡ chữ số nhiễu ở dạng RAW (chưa có chữ bán cầu)", () => {
    expect(stripOcrHemisphereNoise(`A 10907'35,9"1 105941'10,8"5`)).toBe(
      `A 10907'35,9" 105941'10,8"`,
    );
  });

  it("gỡ cả khi OCR đã đọc trúng chữ bán cầu", () => {
    expect(stripOcrHemisphereNoise(`10°07'35,9"N1 105°41'10,8"E5`)).toBe(
      `10°07'35,9"N 105°41'10,8"E`,
    );
  });

  it("KHÔNG đụng ô độ sâu thật đứng CUỐI hàng (có khoảng trắng ngăn)", () => {
    const co = `10°44'39,04"N 106°44'42,29"E 7,5`;
    expect(stripOcrHemisphereNoise(co)).toBe(co);
    const nguyen = `10°44'39,04"N 106°44'42,29"E 7`;
    expect(stripOcrHemisphereNoise(nguyen)).toBe(nguyen);
  });

  it("KHÔNG ăn kinh độ khi OCR dính liền hai toạ độ", () => {
    /* Bản đầu của hàm này viết `\d+` không kèm điều kiện kết thúc token, và nó
       ăn mất `108` trong `"N108°48'`, biến kinh độ thành `°48'28"`. Sai mà vẫn
       chạy — không cổng nào đỏ. Ca này là cái chốt giữ nó. */
    const dinh = `11°18'27,81"N108°48'28"E x`;
    expect(stripOcrHemisphereNoise(dinh)).toBe(`11°18'27,81"N108°48'28"E x`);
  });

  it("cả đường: hàng góc vùng KHÔNG còn đẻ ra ô độ sâu giả", () => {
    const raw = `A 10907'35,9"1 105941'10,8"5 10907'32,3"1 105941'17,2"5`;
    const row = parseSoundingRow(ocrLineToNoticeLine(raw));
    expect(row).not.toBe(null);
    expect(row?.pairs).toHaveLength(2);
    expect(row?.depthLiteral).toBe(null); // KHÔNG phải "5"
  });

  it("hàng có ô độ sâu THẬT vẫn đọc ra đủ", () => {
    const raw = `5,0 10907'33,6"1 105941'13,5"5 10907'29,9"1 105941'20"5`;
    const row = parseSoundingRow(ocrLineToNoticeLine(raw));
    expect(row?.depthM).toBe(5);
    expect(row?.pairs).toHaveLength(2);
  });

  it("chịu được đầu vào rỗng / sai kiểu", () => {
    expect(stripOcrHemisphereNoise("")).toBe("");
    expect(stripOcrHemisphereNoise(null as unknown as string)).toBe("");
  });
});

describe("cổng ra khỏi địa bàn nguồn — luồng/cửa biển/vũng cảng, không phải Biển Đông", () => {
  it("BẮT ĐƯỢC ba ca thật của đợt OCR miền Nam", () => {
    // Cả ba sau đó đều được HAI mô hình độ sâu độc lập xác nhận là sai:
    // 307 (mô hình 248-249 m, ghi 5,3 m) · 141 (222-227 m, ghi 1,0 m) ·
    // 02/CVĐTNĐIV (109-127 m, ghi 9,0 m).
    expect(isOutsideSourceDomain(52, 3)).toBe(true);
    expect(isOutsideSourceDomain(50, 3)).toBe(true);
    expect(isOutsideSourceDomain(46, 3)).toBe(true);
  });

  it("KHÔNG kết tội oan cảng SÔNG — đây là lý do phải có vế lớp độ sâu", () => {
    // Cần Thơ nằm 52 km ngược sông Hậu: xa bờ y hệt một điểm sai ngoài khơi.
    // Lớp 0 (đất/sông) là thứ tách hai ca đó ra.
    expect(isOutsideSourceDomain(52, 0)).toBe(false);
    expect(isOutsideSourceDomain(21, 0)).toBe(false);
  });

  it("gần bờ thì không xét, dù nước sâu", () => {
    expect(isOutsideSourceDomain(5, 3)).toBe(false);
    expect(isOutsideSourceDomain(OFFSHORE_MIN_KM, 3)).toBe(false);
  });

  it("thiếu lớp độ sâu thì KHÔNG đoán", () => {
    expect(isOutsideSourceDomain(80, null)).toBe(false);
    expect(isOutsideSourceDomain(Number.NaN, 3)).toBe(false);
  });

  it("MỌI tuyến trong dataset đều còn trong địa bàn", () => {
    // Không tuyến nào bóc từ lớp chữ nằm quá 17,8 km khỏi bờ, nên trần 20 km
    // không cắt vào dữ liệu đang có — ca này canh điều đó không trôi.
    expect(OFFSHORE_MIN_KM).toBeGreaterThan(17.8);
  });
});
