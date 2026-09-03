/**
 * SỐ ĐO SÂU TỪ TRANG CẢNG VỤ TỈNH — cổng cho dataset `soundings-cangvu.v1.json`.
 *
 * Đây là kho BỔ SUNG cho kho trung ương (vmsa.vn), sinh bởi
 * `scripts/fetch-soundings-cangvu.mjs`. Nó lấy từ 16 trang cảng vụ còn sống,
 * mỗi trang một kiểu bày trang, nên chỗ sai nhiều hơn — và mọi chỗ sai đều
 * KHÔNG tự lộ ra: số vẫn hợp lý, file vẫn ghi được, không ai biết.
 *
 * Bộ test này canh đúng năm chỗ đó:
 *  1. cột độ sâu bị lẫn với TÊN ĐIỂM ("DHN - 0 6" → 6 m) — ca thật, lấy nguyên
 *     dòng từ thông báo Bến cảng Vietsovpetro
 *  2. khoảng trắng trong bảng nuốt cột ("7,5 10°44'" → 510 độ)
 *  3. GÁN SAI CẢNG VỤ — tên miền không phải bằng chứng, số hiệu mới là
 *  4. điểm/tuyến không mang ngày → bà con không biết số này đo hồi nào
 *  5. độ sâu KHỐNG CHẾ của cả một vùng bị gắn vào từng góc vùng như thể là
 *     phép đo tại điểm
 *
 * Hai ca ĐỐI CHỨNG chép tay từ hai thông báo thật (§CA ĐỐI CHỨNG) — không có
 * chúng thì cả bộ test chỉ chứng minh "code chạy", không chứng minh "đọc đúng".
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  areaFromNotice,
  decodeSoundingRoutes,
  decodeSoundings,
  inVietnamSea,
  isPlausibleDepth,
  isPlausibleRouteDepth,
  noticeAuthorityCode,
  parseSoundingRow,
  type SoundingsFile,
} from "../soundings";

const FILE = join(process.cwd(), "public", "data", "soundings-cangvu.v1.json");
const rawText = readFileSync(FILE, "utf8");
const data = JSON.parse(rawText) as SoundingsFile;
const soundings = decodeSoundings(data);
const routes = decodeSoundingRoutes(data);

/** Mọi chuỗi người đọc thấy trong file — dùng cho cổng chủ quyền. */
const allStrings = [
  data.nguon,
  data.nhan,
  ...data.luong.flatMap((l) => [l.ma, l.ten]),
  ...data.thongBao.flatMap((t) => [t.so, t.tieuDe, t.url, t.pdf]),
  ...(data.tuyen ?? []).map((t) => t.ten ?? ""),
  ...data.boSot.flatMap((b) => [b.so, b.url, b.lyDo]),
];

describe("dataset cảng vụ tỉnh — hình dạng file", () => {
  it("có đủ các khoá của SoundingsFile và không rỗng", () => {
    expect(data.v).toBe(1);
    expect(Array.isArray(data.luong)).toBe(true);
    expect(Array.isArray(data.thongBao)).toBe(true);
    expect(Array.isArray(data.diem)).toBe(true);
    expect(Array.isArray(data.boSot)).toBe(true);
    // Kho này tồn tại để BỔ SUNG. Rỗng nghĩa là đường ống hỏng chứ không phải
    // "nguồn hết dữ liệu" — vẫn phải đỏ.
    expect(data.thongBao.length).toBeGreaterThan(0);
    expect(soundings.length + routes.length).toBeGreaterThan(0);
  });

  it("nhãn cảnh báo nói rõ đây là số THAM KHẢO, không thay hải đồ", () => {
    expect(data.nhan).toMatch(/tham kh[ảa]o/i);
    expect(data.nhan).toMatch(/kh[ôo]ng thay h[ải]i [đd][ồo]/i);
  });
});

describe("cổng chủ quyền — 0 ký tự Hán/CJK", () => {
  // Nguồn là văn bản nhà nước Việt Nam; một ký tự Hán lọt vào là dấu hiệu bóc
  // nhầm nguồn hoặc font hỏng, và nó sẽ hiện lên bản đồ của bà con.
  const CJK =
    /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/;

  it("không chuỗi nào trong file chứa ký tự Hán/CJK", () => {
    const dirty = allStrings.filter((s) => CJK.test(s));
    expect(dirty).toEqual([]);
  });
});

describe("cổng toạ độ + độ sâu", () => {
  it("mọi điểm nằm trong khung biển Việt Nam", () => {
    const out = soundings.filter((s) => !inVietnamSea(s.lat, s.lon));
    expect(out).toEqual([]);
  });

  it("mọi độ sâu nằm trong dải hợp lý của nguồn luồng/vũng cảng", () => {
    const out = soundings.filter((s) => !isPlausibleDepth(s.depthM));
    expect(out).toEqual([]);
  });

  it("mọi đỉnh tuyến nằm trong khung biển VN và độ sâu khống chế hợp lý", () => {
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(r.points.length).toBeGreaterThanOrEqual(2);
      for (const p of r.points) expect(inVietnamSea(p.lat, p.lon)).toBe(true);
      if (r.sauM !== null) expect(isPlausibleRouteDepth(r.sauM)).toBe(true);
    }
  });
});

describe("cổng ngày + lý lịch nguồn", () => {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const HOM_NAY = data.layNgay;

  it("mọi điểm mang NGÀY của thông báo", () => {
    const out = soundings.filter((s) => !ISO.test(s.at));
    expect(out).toEqual([]);
  });

  it("mọi thông báo mang lý lịch nguồn truy được (số hiệu + URL PDF)", () => {
    for (const t of data.thongBao) {
      expect(t.prov?.origin?.source).toBeTruthy();
      expect(ISO.test(t.prov.origin.at)).toBe(true);
      expect(t.prov.origin.version).toBe(t.so);
      expect(t.prov.origin.url).toMatch(/^https:\/\//);
      expect(t.pdf).toMatch(/\.pdf$/i);
    }
  });

  it("ngày nằm trong khoảng có nghĩa — chặn ca vớ nhầm ngày của Nghị định", () => {
    // Bản ký số hay để TRỐNG ngày ("ngày tháng 6 năm 2025"). Bộ đọc từng lùi về
    // chuỗi dd/mm/yyyy đầu tiên gặp được và vớ phải "Nghị định 58/2017/NĐ-CP
    // ngày 10/5/2017" — một khảo sát 2025 bị ghi là đo năm 2017. Sai tuổi cũng
    // nguy hiểm như sai số.
    for (const t of data.thongBao) {
      expect(t.ngay >= "2005-01-01").toBe(true);
      expect(t.ngay <= HOM_NAY).toBe(true);
    }
  });
});

describe("BẪY 3 — vùng đọc từ SỐ HIỆU, không đọc từ tên miền", () => {
  it("mỗi thông báo được gán đúng cảng vụ mà số hiệu của nó chỉ tới", () => {
    // Vị trí dùng để tách hai cảng vụ viết tắt trùng nhau (Đà Nẵng/Đồng Nai).
    const viTri = new Map<number, number>();
    for (const [, lat, , ti] of data.diem) if (!viTri.has(ti)) viTri.set(ti, lat);
    for (const t of data.tuyen ?? []) if (!viTri.has(t.tb)) viTri.set(t.tb, t.diem[0][1]);

    for (const [i, t] of data.thongBao.entries()) {
      const area = areaFromNotice(t.so, viTri.get(i) ?? null);
      expect(area, `số hiệu lạ: ${t.so}`).not.toBeNull();
      expect(data.luong[t.luong]?.ma).toBe(area!.ma);
    }
  });

  it("mã cơ quan trong `luong[].ma` đúng là mã cắt từ số hiệu", () => {
    for (const t of data.thongBao) {
      expect(noticeAuthorityCode(t.so)).toBe(data.luong[t.luong]?.ma);
    }
  });

  it("một số hiệu chỉ xuất hiện MỘT lần — trang cảng vụ đăng lại của nhau", () => {
    // `969/TBHH-CVHHKG` lấy được ở CẢ trang Kiên Giang lẫn trang Hải Phòng.
    // Không gộp thì cùng một khúc luồng có hai đường chồng lên nhau.
    const so = data.thongBao.map((t) => t.so.toUpperCase());
    expect(so.length).toBe(new Set(so).size);
  });
});

describe("CA ĐỐI CHỨNG — chép tay từ hai thông báo thật", () => {
  /**
   * Không có phần này thì cả bộ test chỉ chứng minh "code chạy trơn", không
   * chứng minh "đọc đúng cái đang in trên giấy". Bốn số dưới đây đọc bằng mắt
   * từ bảng trong PDF, đổi độ-phút-giây sang độ thập phân bằng tay.
   */
  const tim = (lon: number, lat: number) =>
    soundings.find((s) => Math.abs(s.lon - lon) < 2e-5 && Math.abs(s.lat - lat) < 2e-5);

  it("1810/TBHH-CVHHTPHCM (17/7/2026) — hai điểm cạn Vịnh Gành Rái", () => {
    // Giấy ghi:  10,6  …  10˚24'22,7" N   107˚1'41,3" E   (cột WGS-84)
    //   10 + 24/60 + 22,7/3600 = 10,406306 ; 107 + 1/60 + 41,3/3600 = 107,028139
    const a = tim(107.02814, 10.40631);
    expect(a, "không thấy điểm 10,6 m của 1810/TBHH-CVHHTPHCM").toBeTruthy();
    expect(a!.depthM).toBe(10.6);
    expect(a!.notice.so).toBe("1810/TBHH-CVHHTPHCM");
    expect(a!.at).toBe("2026-07-17");
    expect(a!.area?.ma).toBe("CVHHTPHCM");

    // Giấy ghi:  10,8  …  10˚24'23,9" N   107˚1'42,0" E
    const b = tim(107.02833, 10.40664);
    expect(b, "không thấy điểm 10,8 m của 1810/TBHH-CVHHTPHCM").toBeTruthy();
    expect(b!.depthM).toBe(10.8);
  });

  it("813/TBHH-CVHHNT — bãi đá ngầm luồng Ba Ngòi", () => {
    // Giấy ghi:  10,7  …  11˚52'44,6" N   109˚11'37,6" E   (cột WGS-84)
    //   11 + 52/60 + 44,6/3600 = 11,879056 ; 109 + 11/60 + 37,6/3600 = 109,193778
    const a = tim(109.19378, 11.87906);
    expect(a, "không thấy điểm 10,7 m của 813/TBHH-CVHHNT").toBeTruthy();
    expect(a!.depthM).toBe(10.7);
    expect(a!.notice.so).toBe("813/TBHH-CVHHNT");
    expect(a!.area?.ma).toBe("CVHHNT");

    // Giấy ghi:  12,8  …  11˚52'45,5" N   109˚11'24,0" E
    const b = tim(109.19, 11.87931);
    expect(b, "không thấy điểm 12,8 m của 813/TBHH-CVHHNT").toBeTruthy();
    expect(b!.depthM).toBe(12.8);
  });
});

describe("CỔNG ĐỎ trên dữ liệu bẩn cố ý chèn", () => {
  it("BẪY 1 — tên điểm 'DHN - 0 6' KHÔNG được đọc thành độ sâu 6 m", () => {
    // Dòng thật, chép nguyên từ 2139/KCHT Bến cảng Vietsovpetro: cột đầu là TÊN
    // ĐIỂM, không phải độ sâu. Đọc thành 6 m là bịa ra một phép đo hợp lý ở
    // đúng một toạ độ thật — không cổng thông thường nào chặn được.
    const row = parseSoundingRow(
      `DHN - 0 6 10˚23 ’ 22 , 83 ” N 107˚05 ’ 23 , 28 ” E 10˚23 ’ 1 9 , 16 ” N 107˚05 ’ 2 9 , 70 ” E`,
    );
    expect(row).not.toBeNull();
    expect(row!.depthM).toBeNull();
    expect(row!.pairs.length).toBe(2);
  });

  it("BẪY 1 — mọi tên điểm kiểu chữ-số đều không lọt thành độ sâu", () => {
    for (const ten of ["B14", "SR3", "T2 - 1", "A 5", "S1", "DHN - 11"]) {
      const row = parseSoundingRow(`${ten} 10˚23'22,83"N 107˚05'23,28"E`);
      expect(row?.depthM, `"${ten}" bị đọc thành độ sâu`).toBeNull();
    }
  });

  it("BẪY 2 — khoảng trắng nuốt cột: '7,5 10°44' KHÔNG ra 510 độ", () => {
    const row = parseSoundingRow(
      `7,5 10˚44 ’ 39,04 ” N 106˚44 ’ 42,29 ” E 10 ˚ 44 ’ 35,4 ’’ N 106 ˚ 44 ’ 48,7 ’’ E`,
    );
    expect(row).not.toBeNull();
    expect(row!.depthM).toBe(7.5);
    expect(row!.pairs[0].lat).toBeCloseTo(10 + 44 / 60 + 39.04 / 3600, 6);
    expect(row!.pairs[0].lat).toBeLessThan(90); // 510 sẽ vượt cả dải vĩ độ
  });

  it("BẪY 5 — độ sâu khống chế của cả vùng không được nằm trong `diem`", () => {
    // Khuôn phổ biến nhất ở trang cảng vụ tỉnh: bảng BỐN GÓC vùng khảo sát,
    // không có cột độ sâu, rồi câu "…đạt 14,46 m" ở văn xuôi. Bốn góc đó KHÔNG
    // phải bốn phép đo. Chúng phải nằm ở `tuyen`, không ở `diem`.
    const row = parseSoundingRow(`S1 11˚18'21,68"N 108˚48'04,53"E 11˚18'17,97"N 108˚48'10,94"E`);
    expect(row!.depthM).toBeNull();
  });

  it("decodeSoundings loại sạch hàng bẩn thay vì ném hoặc cho lọt", () => {
    const ban = {
      v: 1,
      nguon: "thử",
      nhan: "thử",
      layNgay: "2026-08-31",
      luong: [{ ma: "CVHHKG", ten: "Cảng vụ Hàng hải Kiên Giang" }],
      thongBao: [
        {
          so: "1/TBHH-CVHHKG",
          ngay: "2026-08-01",
          tieuDe: "thử",
          url: "https://x/",
          pdf: "https://x/a.pdf",
          luong: 0,
          prov: { origin: { source: "tbhh", at: "2026-08-31", version: "1", url: "https://x/a.pdf" } },
        },
        // thông báo KHÔNG có lý lịch — mọi điểm trỏ vào đây phải rơi
        {
          so: "2/TBHH-CVHHKG",
          ngay: "2026-08-02",
          tieuDe: "thử",
          url: "https://x/",
          pdf: "https://x/b.pdf",
          luong: 0,
        },
      ],
      diem: [
        [105.2, 8.7, 106, 0], // hợp lệ — 10,6 m
        [3.93, 10.23, 80, 0], // BẪY 2: kinh độ 3,93 (nuốt cột) → ngoài khung VN
        [105.2, 8.71, 0, 0], // độ sâu 0 → bóc nhầm
        [105.2, 8.72, 3000, 0], // 300 m → vượt trần nguồn luồng
        [105.2, 8.73, 100, 1], // thông báo không lý lịch
        [105.2, 8.74, 100, 9], // chỉ số thông báo không tồn tại
      ],
      boSot: [],
    };
    const ra = decodeSoundings(ban);
    expect(ra.length).toBe(1);
    expect(ra[0].depthM).toBe(10.6);
    expect(ra[0].area?.ma).toBe("CVHHKG");
  });
});
