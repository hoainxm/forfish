/**
 * LỚP ĐÈN BIỂN VIỆT NAM — kiểm trên FILE THẬT.
 *
 * `public/data/den-bien.v1.json` do `scripts/generate-den-bien.mjs` kéo từ ba
 * nguồn nhà nước công bố công khai. Script đó có cổng tự kiểm, nhưng cổng chỉ
 * chạy KHI ai đó chạy script — mà file thì nằm trong repo và đi thẳng ra máy
 * bà con. Bộ test này chạy mỗi `npm test`, kiểm đúng cái file sắp phát.
 *
 * Bộ test cũng NHẬP THẲNG các cổng của script sinh dữ liệu (`docDiem`,
 * `laTenDenBien`, `docDacTinh`) thay vì chép lại một bản thứ hai: chép lại là
 * cách chắc chắn nhất để hai bản trôi khỏi nhau, rồi test xanh trong khi dữ
 * liệu hỏng. Script chỉ chạy khi được gọi thẳng, nhập vào KHÔNG kéo mạng.
 *
 * Đọc file bằng `node:fs` chứ không `fetch`: test phải soi đúng byte trong
 * repo, không phụ thuộc server hay mạng.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  decodeDenBien,
  laTenDenBien,
  moTaDenBien,
  tenDayDu,
  trongKhungBienVN,
  KHUNG_BIEN_VN,
  type DenBienFile,
} from "@/lib/den-bien";
import { decodeSeamarks, describeLight } from "@/lib/seamarks";
import { chartSymbolId, CHART_FALLBACK_ICON } from "@/lib/chart-symbols";
import {
  LICENSES,
  validateProvenance,
  isCleanLicense,
  type LicenseId,
} from "@/lib/provenance";

import {
  docDiem,
  docMoiDMS,
  docDacTinh,
  laTenDenBien as laTenDenBienScript,
} from "../../../scripts/generate-den-bien.mjs";
import {
  bocBanGhiPub112,
  ghepDoiChieu,
  sachChuQuyen,
  KHOP_TOI_DA_M,
  DEN_KHONG_TEN_PUB112,
} from "../../../scripts/fetch-nga-lights.mjs";

const FILE = path.join(process.cwd(), "public", "data", "den-bien.v1.json");
const RAW = readFileSync(FILE, "utf8");
const DATA = JSON.parse(RAW) as DenBienFile;
const DEN = decodeDenBien(DATA);

/** Chữ Hán/CJK — cùng lớp ký tự với cổng trong `scripts/audit-names.mjs`. */
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;

/** Khoảng cách hai điểm, mét — chỉ dùng cho ca đối chứng. */
function metGiua(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la = (aLat * Math.PI) / 180;
  const lb = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const tim = (ten: string) => DEN.find((d) => d.ten === ten);

/* ══ CHỦ QUYỀN ═══════════════════════════════════════════════════════════ */

describe("đèn biển: cổng chủ quyền", () => {
  it("không một ký tự Hán/CJK nào trong toàn bộ file", () => {
    const hit = RAW.match(new RegExp(CJK.source, "g"));
    expect(hit, `còn ký tự Hán: ${[...new Set(hit ?? [])].join("")}`).toBeNull();
  });

  it("cổng CJK của test này KHÔNG rỗng — nhận ra chữ Hán mẫu", () => {
    // Một regex viết hỏng vẫn "xanh" mọi lần và im lặng cho mọi thứ lọt. Ký tự
    // thử dựng từ mã điểm để bản thân file test không chứa chữ Hán.
    expect(CJK.test(String.fromCodePoint(0x6d77))).toBe(true);
    expect(CJK.test("Đèn biển Song Tử Tây")).toBe(false);
  });

  it("không tên nước ngoài của thực thể Việt Nam trong bảng tên", () => {
    // Cùng nhóm cấm với `scripts/audit-names.mjs`: nguồn quốc tế mặc định gọi
    // Trường Sa là "Spratly", Hoàng Sa là "Paracel". Lớp này lấy tên từ trang
    // công bố của Việt Nam nên phải sạch — kiểm để không tụt về sau.
    const cam = /\b(spratly|paracel|south\s+china\s+sea|nansha|xisha|sansha)\b/i;
    const dinh = DATA.names.filter((n) => cam.test(n));
    expect(dinh, `tên sai chủ quyền: ${dinh.join(", ")}`).toEqual([]);
  });
});

/* ══ HÌNH DẠNG FILE ══════════════════════════════════════════════════════ */

describe("đèn biển: hình dạng file", () => {
  it("có đủ bảng tra và một số lượng đèn hợp lý", () => {
    expect(DATA.v).toBe(1);
    for (const key of [
      "types", "chars", "groups", "colours", "names", "places", "years",
      "provs", "thieu", "lights",
    ] as const) {
      expect(Array.isArray(DATA[key]), `thiếu bảng ${key}`).toBe(true);
    }
    // Việt Nam có khoảng 94 đèn biển đang hoạt động (lớp này đo được đúng 94
    // sau khi gộp sổ AtoN 2016). Dưới 90 nghĩa là một nguồn không trả lời
    // lúc sinh file — chặn ở đây chứ đừng để bà con phát hiện ngoài biển.
    expect(DATA.lights.length).toBeGreaterThanOrEqual(90);
  });

  it("mang nhãn 'tham khảo, đối chiếu Thông báo hàng hải'", () => {
    // Không nguồn nào ghi ngày cập nhật. Bỏ nhãn này đi là app ngầm hứa một
    // mức chính xác mà nguồn không bảo đảm — điều dự án cấm.
    expect(DATA.nhan).toMatch(/tham khảo/i);
    expect(DATA.nhan).toMatch(/thông báo hàng hải/i);
  });

  it("ghi đúng giấy phép: số liệu nhà nước công bố công khai", () => {
    expect(DATA.giayPhep.giayPhepId).toBe("vn-official");
    const terms = LICENSES[DATA.giayPhep.giayPhepId as LicenseId];
    expect(terms.redistributable).toBe(true);
    expect(terms.shareAlike).toBe(false);
  });

  it("nằm dưới trần dung lượng 200 KB", () => {
    expect(Buffer.byteLength(RAW) / 1024).toBeLessThanOrEqual(200);
  });

  it("chín cột đầu đúng khuôn seamarks — `decodeSeamarks()` đọc được", () => {
    // Bằng chứng file KHÔNG đẻ kiểu dữ liệu mới: bộ giải mã có sẵn của lớp báo
    // hiệu đọc thẳng được nó, nên ký hiệu hải đồ và ô chạm xem chạy không sửa.
    const nhu = decodeSeamarks({ ...DATA, marks: DATA.lights });
    expect(nhu.length).toBe(DATA.lights.length);
    expect(nhu.every((m) => String(m.type).startsWith("light_"))).toBe(true);
  });
});

/* ══ TOẠ ĐỘ ══════════════════════════════════════════════════════════════ */

describe("đèn biển: mọi toạ độ trong khung biển VN", () => {
  it("từng hàng trong file nằm trong khung", () => {
    const ngoai = DATA.lights
      .map((r) => [r[0], r[1]] as const)
      .filter(([lon, lat]) => !trongKhungBienVN(lon, lat));
    expect(ngoai, `điểm ngoài khung: ${JSON.stringify(ngoai)}`).toEqual([]);
  });

  it("bộ giải mã trả về đúng số đèn — không hàng nào bị cổng loại", () => {
    // Lệch nghĩa là file mang hàng mà chính bộ giải mã của app từ chối; hoặc
    // file hỏng, hoặc cổng quá tay. Cả hai đều phải biết ngay.
    expect(DEN.length).toBe(DATA.lights.length);
  });

  it("cổng khung tự nó KHÔNG rỗng", () => {
    expect(trongKhungBienVN(107.99, 10.69)).toBe(true);
    expect(trongKhungBienVN(KHUNG_BIEN_VN.w - 1, 10)).toBe(false);
    expect(trongKhungBienVN(110, KHUNG_BIEN_VN.n + 1)).toBe(false);
    expect(trongKhungBienVN(Number.NaN, 10)).toBe(false);
  });
});

/*  CỔNG ĐỎ KHI CHÈN TAY MỘT TOẠ ĐỘ BỊ TÁCH CHỮ.

    Đây là kiểu sai đã cắn dự án nhiều lần và là kiểu KHÓ THẤY NHẤT: kết quả
    trông hoàn toàn hợp lệ (đúng định dạng, đúng dải, đúng dấu) mà nằm cách chỗ
    thật hàng trăm km. Nguồn ghi dấu độ bằng `<sup>o</sup>` — chữ cái, không
    phải ký tự `°` — nên chỉ cần gỡ thẻ HTML sớm một bước là `105°16'` thành
    `10 5 16` rồi thành 10,5°.

    Hai tầng cổng, test cả hai:
      (1) bộ đọc văn bản của script — không có `°` THẬT thì KHÔNG đọc;
      (2) bộ giải mã của app — số ra ngoài khung biển VN thì bỏ hàng.  */
describe("đèn biển: cổng bắt toạ độ bị tách chữ", () => {
  it("chuỗi không có dấu độ THẬT thì không đọc ra giá trị nào", () => {
    // `<sup>o</sup>` gỡ thẻ ngây thơ ra đúng chuỗi này.
    expect(docMoiDMS("10 o 41' 42.7\" N 107 o 59' 29.6\" E")).toEqual([]);
    expect(docMoiDMS("105016'12,7\"N")).toEqual([]);
    // dựng lại dấu độ rồi thì đọc được — cổng không chặn oan
    expect(docMoiDMS("10°41'42.7\"N 107°59'29.6\"E")).toHaveLength(2);
  });

  it("chữ số bị tách khỏi phần độ → điểm rơi ra ngoài khung, bị loại", () => {
    // "105°16'" vỡ thành "10 5°16'": bộ đọc thấy 5°16' — đúng định dạng, đúng
    // dấu độ, mà là kinh độ 5,3°Đ (giữa Đại Tây Dương).
    expect(docDiem('10°41\'42.7"N 10 5°16\'12.7"E')).toBeNull();
    // cùng chuỗi đó khi KHÔNG bị tách thì đọc ra bình thường
    const d = docDiem('10°41\'42.7"N 105°16\'12.7"E') as { lon: number; lat: number };
    expect(d).not.toBeNull();
    expect(d.lat).toBeCloseTo(10.695, 2);
    expect(d.lon).toBeCloseTo(105.27, 2);
  });

  it("phút hoặc giây ≥ 60 là lỗi chép, không phải toạ độ", () => {
    expect(docMoiDMS("10°71'42\"N")).toEqual([]);
    expect(docMoiDMS("10°41'72\"N")).toEqual([]);
  });

  it("hai hệ toạ độ trên cùng trang mà lệch quá 2 km thì bỏ cả điểm", () => {
    // Bảng nhà nước in VN-2000 cạnh WGS-84 — CÙNG MỘT ĐIỂM, lệch thật chỉ cỡ
    // trăm mét. Lệch hơn nghĩa là đọc lộn cột, và điểm lộn cột trông hợp lệ
    // hoàn toàn: không có cổng này thì nó lọt hết mọi phép kiểm khác.
    const gan =
      'Hệ VN2000 Hệ WGS84 15°23\'15.2"N 109°08\'24.2"E 15°23\'11.5"N 109°08\'30.8"E';
    expect(docDiem(gan)).not.toBeNull();
    const xa =
      'Hệ VN2000 Hệ WGS84 15°23\'15.2"N 109°08\'24.2"E 16°23\'11.5"N 109°08\'30.8"E';
    expect(docDiem(xa)).toBeNull();
  });

  it("hàng bị chèn tay một toạ độ tách chữ thì bộ giải mã của app loại nó", () => {
    const hong = JSON.parse(JSON.stringify(DATA)) as DenBienFile;
    // 105,27°Đ đọc hỏng thành 5,27°Đ — đúng cách chữ số bị tách sinh ra.
    hong.lights[0] = [...hong.lights[0]];
    hong.lights[0][0] = 5.27;
    expect(decodeDenBien(hong).length).toBe(DATA.lights.length - 1);
  });
});

/* ══ TÊN ═════════════════════════════════════════════════════════════════ */

describe("đèn biển: tên tiếng Việt, không lẫn số hiệu phao", () => {
  it("mọi tên trong file qua được cổng tên đèn biển", () => {
    const hong = DATA.names.filter((n) => !laTenDenBien(n));
    expect(hong, `tên không phải tên đèn biển: ${hong.join(" | ")}`).toEqual([]);
  });

  it("cổng của thư viện và cổng của bộ sinh dữ liệu nói giống nhau", () => {
    // Hai bản cùng một luật ở hai nơi là cách chắc chắn nhất để chúng trôi
    // khỏi nhau. Kiểm bằng chính dữ liệu thật + các ca biên.
    const ca = [
      ...DATA.names,
      "Phao số 6", "NC1", "TC-02", "26A", "10,9", "105°16'",
      "Kê Gà", "Hòn Khoai", "Song Tử Tây",
      "Thành phố Hồ Chí Minh và vùng biển lân cận nữa",
    ];
    for (const t of ca) {
      expect(laTenDenBien(t), `lệch ở "${t}"`).toBe(laTenDenBienScript(t));
    }
  });

  it("cổng tên KHÔNG rỗng — loại đúng thứ phải loại", () => {
    expect(laTenDenBien("Kê Gà")).toBe(true);
    expect(laTenDenBien("Hòn Khoai")).toBe(true);
    expect(laTenDenBien("Phao số 6")).toBe(false); // số hiệu phao
    expect(laTenDenBien("Tiêu HN1")).toBe(false); // đăng tiêu
    expect(laTenDenBien("NC1")).toBe(false);
    expect(laTenDenBien("TC-02")).toBe(false);
    expect(laTenDenBien("1092649,8")).toBe(false); // mảnh toạ độ vỡ
    expect(laTenDenBien("10°41'")).toBe(false);
    expect(laTenDenBien("15,4")).toBe(false);
  });

  it("không tên nào trùng nhau — mỗi đèn một chỗ", () => {
    const trung = DATA.names.filter((n, i) => DATA.names.indexOf(n) !== i);
    expect(trung, `tên trùng: ${trung.join(", ")}`).toEqual([]);
  });

  it("tên hiển thị luôn có tiền tố 'Đèn biển'", () => {
    // Dataset cố ý giữ tên TRẦN ("Kê Gà") để dùng lại được ở nhiều chỗ; chữ
    // "Đèn biển" do `tenDayDu()` thêm. Bỏ bước đó là bà con thấy mỗi "Kê Gà"
    // trên bản đồ và không biết đó là cái gì. Mục CỐ-Ý-KHÔNG-TÊN (quyết định
    // 2026-09-02) hiện đúng "Đèn biển" trần — không đuôi thừa, không undefined.
    expect(tenDayDu({ ten: "Kê Gà" })).toBe("Đèn biển Kê Gà");
    expect(tenDayDu({ ten: "" })).toBe("Đèn biển");
    for (const d of DEN) {
      expect(tenDayDu(d)).toBe(d.ten ? `Đèn biển ${d.ten}` : "Đèn biển");
    }
  });
});

/* ══ ĐẶC TÍNH ĐÈN ════════════════════════════════════════════════════════ */

describe("đèn biển: đặc tính đèn dịch được sang tiếng Việt", () => {
  it("phần lớn đèn có đủ kiểu chớp + chu kỳ", () => {
    const du = DEN.filter((d) => d.light?.character && d.light?.period);
    // Nguồn để trống rất nhiều ô, nhưng kiểu chớp là thứ hầu như luôn có —
    // dưới 2/3 nghĩa là bộ dịch tiếng Việt đọc trượt, không phải nguồn thiếu.
    expect(du.length / DEN.length).toBeGreaterThan(0.66);
  });

  it("mọi đặc tính đèn ra được CÂU TIẾNG VIỆT, không lộ mã hải đồ", () => {
    for (const d of DEN) {
      if (!d.light?.character) continue;
      const cau = describeLight(d.light);
      expect(cau, `${d.ten}: không dịch được ${JSON.stringify(d.light)}`).not.toBe("");
      // Hai đường rò duy nhất ra chữ nước ngoài: `colour` mang từ tiếng Anh mà
      // `colourLabel()` không dịch được, và `character` mang mã hải đồ lạ.
      expect(cau, `${d.ten}: "${cau}" lộ từ màu tiếng Anh`).not.toMatch(
        /\b(white|red|green|yellow|black|grey|gray|blue|orange)\b/i,
      );
      expect(cau, `${d.ten}: "${cau}" lộ mã hải đồ`).not.toMatch(
        /\b(Fl|LFl|FFl|Oc|Iso|VQ|UQ|IQ|Mo|Al)\b/,
      );
      // Rơi mất nửa đầu thì câu bắt đầu bằng "ánh …" — bà con đọc được màu mà
      // không biết đèn chớp kiểu gì, tức là mất đúng thứ để nhận ra cái đèn.
      expect(cau, `${d.ten}: "${cau}" mất phần kiểu chớp`).not.toMatch(/^ánh /);
    }
  });

  it("mã `character` trong file đều là khoá `describeLight()` hiểu", () => {
    for (const ch of DATA.chars) {
      expect(describeLight({ character: ch }), `mã lạ: "${ch}"`).not.toBe("");
    }
  });

  it("bộ dịch tiếng Việt → LightInfo của script đọc đúng các câu nguồn thật", () => {
    // Bốn câu chép nguyên từ trang công bố — mỗi câu một kiểu gõ.
    expect(docDacTinh("Ánh sáng trắng, chớp nhóm (3+1) chu kỳ 20 giây")).toEqual({
      character: "Fl", group: "3+1", period: 20, colour: "white",
    });
    expect(docDacTinh("Chớp nhóm 2, chu kỳ 10s")).toMatchObject({
      character: "Fl", group: "2", period: 10,
    });
    expect(docDacTinh("Chớp đơn, chu kỳ 5s")).toMatchObject({
      character: "Fl", period: 5,
    });
    expect(docDacTinh("Chớp đơn, chu kỳ 5s")).not.toHaveProperty("group");
    expect(docDacTinh("Ánh sáng trắng, chớp nhóm (2+1) chu kỳ 12 giây - Ch.Tr.Nh(2+1).12s"))
      .toMatchObject({ character: "Fl", group: "2+1", period: 12, colour: "white" });
  });

  it("câu mô tả một đèn nổi tiếng đọc được từ đầu tới cuối", () => {
    const keGa = tim("Kê Gà");
    expect(keGa, "thiếu đèn Kê Gà").toBeTruthy();
    const cau = moTaDenBien(keGa!);
    expect(cau).toContain("Đèn biển Kê Gà");
    expect(cau).toMatch(/Chớp/);
    expect(cau).toMatch(/giây một vòng/);
    expect(cau).not.toMatch(/undefined|NaN|\[object/);
  });
});

/* ══ CA ĐỐI CHỨNG — CHÉP TAY TỪ TRANG CÔNG BỐ ════════════════════════════ */

/*  Toạ độ dưới đây chép TAY từ trang công bố của cơ quan quản lý, đổi sang độ
    thập phân bằng máy tính chứ không bằng chính bộ đọc đang kiểm — nếu dùng
    lại bộ đọc thì test chỉ đang so nó với chính nó. Dung sai 2 km: đủ rộng để
    ôm chênh lệch VN-2000 ↔ WGS-84 (~200 m) và việc nguồn làm tròn giây, đủ
    chặt để bắt mọi kiểu đọc lộn cột hay tách chữ số.  */
const DOI_CHUNG: [string, number, number][] = [
  ["Kê Gà", 10 + 41 / 60 + 42.7 / 3600, 107 + 59 / 60 + 29.6 / 3600],
  ["Hòn Khoai", 8 + 25 / 60 + 36 / 3600, 104 + 50 / 60 + 6 / 3600],
  ["Đại Lãnh", 12 + 53 / 60 + 47.5 / 3600, 109 + 27 / 60 + 25.6 / 3600],
  ["Long Châu", 20 + 37 / 60 + 24 / 3600, 107 + 9 / 60 + 16 / 3600],
  ["Song Tử Tây", 11 + 25 / 60 + 43 / 3600, 114 + 19 / 60 + 50 / 3600],
];

describe("đèn biển: ca đối chứng chép tay", () => {
  for (const [ten, lat, lon] of DOI_CHUNG) {
    it(`${ten} đúng chỗ`, () => {
      const d = tim(ten);
      expect(d, `thiếu đèn ${ten}`).toBeTruthy();
      const lech = metGiua(d!.lon, d!.lat, lon, lat);
      expect(lech, `${ten} lệch ${Math.round(lech)} m so với bản chép tay`)
        .toBeLessThan(2000);
    });
  }

  it("có đèn ở cả hai nửa nước — không tái diễn 'nửa nam trống'", () => {
    // Lần trước lớp báo hiệu có 437 điểm mà KHÔNG MỘT CÁI NÀO dưới 15°B. Đây
    // là cổng để chuyện đó không lặp lại im lặng.
    // Sàn nâng 2026-09-02 sau khi gộp sổ AtoN 2016 (đo được 54 nam / 22 cực
    // nam / 40 bắc) — sàn là mốc KHÔNG ĐƯỢC TỤT, không phải con số đúng.
    expect(DEN.filter((d) => d.lat < 15).length).toBeGreaterThanOrEqual(50);
    expect(DEN.filter((d) => d.lat < 10).length).toBeGreaterThanOrEqual(20);
    expect(DEN.filter((d) => d.lat >= 15).length).toBeGreaterThanOrEqual(25);
  });

  it("có đèn trên quần đảo Trường Sa", () => {
    // Chủ quyền: các đèn Việt Nam dựng trên Trường Sa phải có mặt, mang tên
    // tiếng Việt. Đây cũng là vùng Navionics có mà ta từng thiếu.
    const truongSa = DEN.filter((d) => d.lon > 111 && d.lat < 13);
    expect(truongSa.length, "không có đèn nào ở Trường Sa").toBeGreaterThanOrEqual(4);
  });
});

/* ══ LÝ LỊCH NGUỒN ═══════════════════════════════════════════════════════ */

describe("đèn biển: lý lịch nguồn", () => {
  it("mỗi đèn có lý lịch hợp lệ theo provenance.ts", () => {
    for (const d of DEN) {
      const loi = validateProvenance(d.prov);
      expect(loi, `${d.ten}: ${loi.join("; ")}`).toEqual([]);
    }
  });

  it("mọi đèn nằm trong gói phát hành lại được (không dính share-alike)", () => {
    const ban = DEN.filter((d) => !isCleanLicense(d.prov));
    expect(ban.map((d) => d.ten), "đèn dính giấy phép share-alike").toEqual([]);
  });

  it("nguồn gốc chỉ nằm trong các cơ quan nhà nước đã đăng ký", () => {
    // KHÔNG đòi có ĐỦ mọi nguồn: các nguồn phủ chồng nhau, và khi vmsa.vn (ưu
    // tiên cao hơn vì công bố thẳng cột WGS-84) có đủ phần Bắc thì cổng ENC
    // chỉ còn vai trò ĐỐI CHIẾU. Điều phải giữ là không nguồn lạ nào lọt vào.
    // `vms-south-aton-list` = sổ "List of AtoN System" 2016 (NXB GTVT) — nguồn
    // gốc của các đèn khôi phục từ sổ (Hòn Hải, Ba Kiềm, Ba Kè, Quế Đường).
    // `nga-msi` (public domain, Mỹ) được thêm CÓ CHỦ ĐÍCH 2026-09-02: gốc của
    // 11 đèn không tên trên thực thể bị chiếm đóng — VN không vận hành các
    // đèn đó nên không cơ quan VN nào công bố; số liệu lấy từ Pub 112, tên
    // thì KHÔNG lấy (xem khối "đèn cố-ý-không-tên").
    const HOP_LE = new Set(["tbhh", "vinamarine", "vms-south-aton-list", "nga-msi"]);
    const nguon = [...new Set(DEN.map((d) => d.prov.origin.source))];
    expect(nguon.filter((n) => !HOP_LE.has(n))).toEqual([]);
    expect(nguon.length).toBeGreaterThan(0);
  });

  it("Hòn Hải — điểm cơ sở A6 — đã khôi phục từ sổ AtoN 2016, đúng chỗ", () => {
    /* Bản lưu vms-south chép NHẦM cùng một toạ độ cho hai trang Ba Kiềm và
       Hòn Hải, cổng trùng-chỗ phải bỏ cả hai — mất luôn ngọn đèn trên điểm
       cơ sở A6 của đường cơ sở lãnh hải. Sổ giấy 2016 cho mỗi ngọn MỘT toạ
       độ riêng, khớp địa lý thật → khôi phục cả bốn (thêm Ba Kè, Quế Đường).
       Toạ độ đối chứng chép TAY từ sổ: 09°58'26,5"B 109°05'04"Đ. */
    const honHai = tim("Hòn Hải");
    expect(honHai, "thiếu đèn Hòn Hải").toBeTruthy();
    const lech = metGiua(
      honHai!.lon,
      honHai!.lat,
      109 + 5 / 60 + 4 / 3600,
      9 + 58 / 60 + 26.5 / 3600,
    );
    expect(lech, `Hòn Hải lệch ${Math.round(lech)} m`).toBeLessThan(2000);
    for (const ten of ["Ba Kiềm", "Ba Kè", "Quế Đường"]) {
      expect(tim(ten), `thiếu đèn ${ten}`).toBeTruthy();
    }
    // Ba Kè và Quế Đường là hai nhà giàn DK1 KHÁC NHAU — chính vụ chép nhầm
    // đã dí chúng vào một chỗ. Giữ khoảng cách thật (~137 km) làm cổng lùi.
    const baKe = tim("Ba Kè")!;
    const queDuong = tim("Quế Đường")!;
    expect(
      metGiua(baKe.lon, baKe.lat, queDuong.lon, queDuong.lat),
    ).toBeGreaterThan(50000);
  });

  it("có đèn được nguồn thứ hai xác nhận vị trí", () => {
    // Hai cơ quan độc lập cùng nói có đèn ở đó là bằng chứng mạnh nhất trong
    // thang `confidenceOf()`. Không có cái nào nghĩa là bước đối chiếu chéo đã
    // im lặng chết — dữ liệu vẫn "xanh" mà mất hẳn một tầng kiểm.
    const coDoiChieu = DEN.filter((d) => (d.prov.crossChecks ?? []).length > 0);
    expect(coDoiChieu.length).toBeGreaterThanOrEqual(10);
  });

  it("mỗi đèn có đường dẫn tra ngược tận gốc", () => {
    // Ta KHÔNG phải nguồn cuối cùng và không giả vờ là. Bà con hoặc cán bộ
    // cảng vụ phải mở lại được đúng trang đã lấy số.
    const thieuUrl = DEN.filter((d) => !d.prov.origin.url);
    expect(thieuUrl.map((d) => d.ten), "thiếu URL nguồn").toEqual([]);
  });
});

/* ══ KÝ HIỆU HẢI ĐỒ ══════════════════════════════════════════════════════ */

describe("đèn biển: ra được ký hiệu hải đồ", () => {
  it("không đèn nào rơi về ký hiệu 'chưa rõ'", () => {
    const roi = DEN.filter((d) => chartSymbolId(d) === CHART_FALLBACK_ICON);
    expect(roi.map((d) => `${d.ten} (${d.type})`)).toEqual([]);
  });

  it("chỉ dùng loại đèn biển — không loại báo hiệu lạ nào lọt vào", () => {
    // Lớp này CHỈ chứa đèn biển. Một `buoy_*` xuất hiện ở đây nghĩa là bộ bóc
    // đã kéo nhầm một cái phao vào — đúng cái bẫy `laTenDenBien()` canh.
    const la = DATA.types.filter((t) => t !== "light_major" && t !== "light_minor");
    expect(la, `loại lạ: ${la.join(", ")}`).toEqual([]);
    expect(DATA.types.length).toBeGreaterThan(0);
  });
});

/* ══ MẤT SÓNG ════════════════════════════════════════════════════════════ */

/*  Ngoài khơi mất sóng nhiều ngày. Nhớ luôn cả LẦN HỎNG là khoá vĩnh viễn lớp
    đèn: sóng về rồi mà bản đồ vẫn trống, và không có cách nào bắt app thử lại
    ngoài việc đóng hẳn ứng dụng. Cùng án lệ với `fetchSeamarks`.  */
describe("đèn biển: hỏng thì lần sóng về sau thử lại được", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lần 1 lỗi, lần 2 gọi lại mạng chứ không trả lỗi cũ", async () => {
    vi.resetModules();
    const { fetchDenBien } = await import("@/lib/den-bien");
    const spy = vi
      .fn()
      .mockRejectedValueOnce(new Error("mat song"))
      .mockResolvedValueOnce({ ok: true, json: async () => DATA });
    vi.stubGlobal("fetch", spy);

    await expect(fetchDenBien()).rejects.toThrow();
    await expect(fetchDenBien()).resolves.toHaveLength(DATA.lights.length);
    expect(
      spy,
      "lần 2 phải gọi lại mạng — nhớ cả lần hỏng là khoá vĩnh viễn",
    ).toHaveBeenCalledTimes(2);
  });

  it("HTTP 404 cũng phải cho thử lại", async () => {
    vi.resetModules();
    const { fetchDenBien } = await import("@/lib/den-bien");
    const spy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => DATA });
    vi.stubGlobal("fetch", spy);
    await expect(fetchDenBien()).rejects.toThrow(/404/);
    await expect(fetchDenBien()).resolves.toHaveLength(DATA.lights.length);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("thành công thì NHỚ, không gọi mạng lần nữa", async () => {
    vi.resetModules();
    const { fetchDenBien } = await import("@/lib/den-bien");
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => DATA });
    vi.stubGlobal("fetch", spy);
    await fetchDenBien();
    await fetchDenBien();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("file hỏng thì trả mảng rỗng, KHÔNG ném — một dòng lỗi không xoá cả lớp", () => {
    expect(decodeDenBien(null)).toEqual([]);
    expect(decodeDenBien({})).toEqual([]);
    expect(decodeDenBien({ lights: [[1]] })).toEqual([]);
  });
});

/*
  ĐÃ NỐI VÀO BẢN ĐỒ CHƯA (2026-09-02).

  Mọi ca phía trên chứng minh dữ liệu ĐÚNG. Không ca nào chứng minh nó được
  DÙNG — và đó đúng là căn bệnh đã tái phát BA LẦN trong dự án này (lớp độ sâu ·
  bộ ký hiệu · kết quả đối chiếu): sinh xong, test xong, không nối.
*/
describe("lớp đèn biển phải được NỐI, không chỉ nằm trong repo", () => {
  const doc = (p: string) =>
    readFileSync(path.join(process.cwd(), p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");

  it("component nạp và vẽ lớp đèn", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa gọi fetchDenBien").toContain("fetchDenBien(");
    expect(v, "chưa dựng nguồn geojson").toContain("denBienGeo");
    expect(v, "chưa vẽ ký hiệu đèn").toContain("LIGHTHOUSE_LAYER");
  });

  it("chạm được — ban đêm câu hỏi là ĐÈN NÀO, không chạm thì không trả lời được", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "lớp đèn chưa vào danh sách bắt chạm").toContain('ids.push("den-bien")');
    expect(v, "chưa có thẻ mô tả đèn").toContain("moTaDenBien(");
  });

  /*  CỔNG SỐNG-CÒN. Đèn biển có tầm hiệu lực 15–25 hải lý và là thứ bà con
      định hướng BAN ĐÊM khi mọi thứ khác tắt. Mất sóng ngoài khơi mà mất luôn
      vị trí đèn là mất đúng cái cuối cùng còn dẫn được đường vào bờ. 5 KB. */
  it("nằm trong vỏ SỐNG-CÒN — mất sóng vẫn còn đèn", () => {
    const sw = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
    const critical = sw.slice(sw.indexOf("const CRITICAL_SHELL"), sw.indexOf("const SHELL"));
    expect(critical).toContain("/data/den-bien.v1.json");
  });

  it("hiện SỚM hơn phao — tầm 25 hải lý thì phải thấy từ ngoài khơi", async () => {
    const { LIGHTHOUSE_MINZOOM, LIGHTHOUSE_LABEL_MINZOOM } = await import("@/lib/ocean-map");
    expect(LIGHTHOUSE_MINZOOM).toBeLessThan(9); // phao/tiêu từ z9
    expect(LIGHTHOUSE_MINZOOM).toBeLessThan(LIGHTHOUSE_LABEL_MINZOOM);
  });
});

/* ══ ĐỐI CHỨNG NGA PUB 112 ═══════════════════════════════════════════════ */

/*  `scripts/fetch-nga-lights.mjs` đối chiếu 94 đèn với NGA Pub 112 (List of
    Lights — public domain, chính phủ Mỹ) — nguồn đối chứng ĐỘC LẬP đầu tiên
    nằm ngoài hệ cơ quan VN. Test nhập THẲNG các cổng của script (cùng lý do
    với generate-den-bien: chép lại là hai bản trôi khỏi nhau), và soi file
    thật xem kết quả đối chiếu có còn nguyên không.  */

type BanGhiNGA = {
  soMy: string;
  vung: string;
  soQT?: string;
  lat?: number;
  lon?: number;
  ch?: string;
  grp?: string;
  lc?: string;
  per?: number;
};

describe("NGA Pub 112: bộ bóc bản ghi", () => {
  // Dòng chép NGUYÊN VĂN từ bản bóc chữ Pub 112 (trang Việt Nam) — mỗi ca một
  // kiểu trình bày: số quốc tế nằm cùng dòng toạ độ, và nằm dòng riêng.
  const TRANG_MAU = [
    "(1) (2) (3) (4) (5) (6) (7) (8)",
    "No. Name and Location Position Characteristic Height Range Structure Remarks",
    "VIETNAM",
    "20213.8 Dao Co To. 21° 00.0´ N Fl.(2+1)W. 381 15 Yellow quadrangular concrete",
    "F 3314.8 107° 45.4´ E period 12s 116 tower, building; 52.",
    "20412 Mui Ke Ga. 10° 41.6´ N Fl.(3+1)W. 72 18 Hexagonal granite tower; 69.",
    "F 3116",
    "107° 59.4´ E period 20s 22",
    "342",
  ];

  it("đọc đúng số hiệu, toạ độ phút thập phân và đặc tính chớp", () => {
    const ra = bocBanGhiPub112([TRANG_MAU]) as BanGhiNGA[];
    expect(ra).toHaveLength(2);
    const [coTo, keGa] = ra;
    expect(coTo.soQT).toBe("F3314.8");
    expect(coTo.lat).toBeCloseTo(21.0, 4);
    expect(coTo.lon).toBeCloseTo(107 + 45.4 / 60, 4);
    expect(coTo.ch).toBe("Fl");
    expect(coTo.grp).toBe("2+1");
    expect(coTo.per).toBe(12);
    expect(coTo.lc).toBe("white");
    // số quốc tế dòng riêng + toạ độ kinh độ rơi xuống dòng thứ ba
    expect(keGa.soQT).toBe("F3116");
    expect(keGa.lat).toBeCloseTo(10 + 41.6 / 60, 4);
    expect(keGa.grp).toBe("3+1");
    expect(keGa.per).toBe(20);
  });

  it("trang KHÔNG có đầu bảng đèn thì không sinh bản ghi nào", () => {
    // Trang chỉ mục in "F2825.1 . . . 20290" — đọc nhầm nó là chế toạ độ ảo.
    expect(bocBanGhiPub112([["F2825.1 . . . . . . 20290"]])).toEqual([]);
    // Mục RADIOBEACON cuối sách cũng đánh cột "(1) (2)…" nhưng đầu cột khác
    // ("No. Name Position … Frequency") — đài Ba Lạt từng lọt qua thật.
    const trangDai = [
      "(1) (2) (3) (4) (5) (6) (7) (8)",
      "No. Name Position Characteristic Range Sequence Frequency Remarks",
      "VIETNAM",
      "1070 Ba Lat 20° 18.0´ N AG 100 475 Transmits continuously during periods",
      "106° 34.0´ E (    ).",
    ];
    expect(bocBanGhiPub112([trangDai])).toEqual([]);
  });

  it("toạ độ phút ≥ 60 hoặc thiếu chữ N/E thì bỏ trống, không đoán", () => {
    const trang = [
      "(1) (2) (3) (4) (5) (6) (7) (8)",
      "No. Name and Location Position Characteristic Height Range Structure Remarks",
      "20999 Thu. 21° 75.0´ N Fl.W. 10 5 Tower.",
      "107 45.4 E period 5s",
    ];
    const [r] = bocBanGhiPub112([trang]) as BanGhiNGA[];
    expect(r.lat).toBeUndefined();
    expect(r.lon).toBeUndefined();
  });
});

describe("NGA Pub 112: ghép đối chiếu", () => {
  // ~0,001° ≈ 130 m — trong ngưỡng; 0,05° ≈ 5,5 km — ngoài ngưỡng.
  const den = (ten: string, lon: number, lat: number) => ({
    ten, lon, lat, ch: "Fl", grp: "4", per: 15, pv: 0,
  });

  it("trong 2 km thì khớp, ngoài thì vào danh sách không khớp", () => {
    const banGhi = [{ soMy: "1", vung: "VIETNAM", lon: 107.001, lat: 10.001 }];
    const gan = ghepDoiChieu([den("Gần", 107, 10)], banGhi);
    expect(gan.khop).toHaveLength(1);
    const xa = ghepDoiChieu([den("Xa", 107.05, 10.05)], banGhi);
    expect(xa.khop).toHaveLength(0);
    expect(xa.khongKhop).toHaveLength(1);
  });

  it("một bản ghi NGA chỉ xác nhận MỘT đèn — đèn gần hơn thắng", () => {
    // Hai đèn cùng ôm một bản ghi là đếm trùng bằng chứng (đã gặp thật:
    // An Hòa và Kỳ Hà cách nhau ~300 m, NGA chỉ có một ngọn ở đó).
    const banGhi = [{ soMy: "1", vung: "VIETNAM", lon: 107.001, lat: 10.001 }];
    const ra = ghepDoiChieu(
      [den("Gần hơn", 107.001, 10.0012), den("Xa hơn", 107, 10)],
      banGhi,
    ) as { khop: { den: { ten: string } }[]; khongKhop: unknown[] };
    expect(ra.khop).toHaveLength(1);
    expect(ra.khop[0].den.ten).toBe("Gần hơn");
    expect(ra.khongKhop).toHaveLength(1);
  });

  it("khớp vị trí mà lệch đặc tính thì BÁO, không im", () => {
    const banGhi = [
      { soMy: "1", vung: "VIETNAM", lon: 107.001, lat: 10.001, ch: "Fl", grp: "2", per: 10 },
    ];
    const ra = ghepDoiChieu([den("Lệch", 107, 10)], banGhi) as {
      lechDacTinh: { lech: string[] }[];
    };
    expect(ra.lechDacTinh).toHaveLength(1);
    expect(ra.lechDacTinh[0].lech.join("; ")).toMatch(/nhóm/);
    expect(ra.lechDacTinh[0].lech.join("; ")).toMatch(/chu kỳ/);
  });
});

describe("NGA Pub 112: kết quả trong file thật", () => {
  const nga = DATA.provs.flatMap((p) =>
    (p.crossChecks ?? []).filter((c) => c.source === "nga-msi"),
  );

  it("ít nhất 60 ngọn được NGA xác nhận vị trí (đo 2026-09-02: 67)", () => {
    // Sàn KHÔNG ĐƯỢC TỤT, không phải con số đúng — chạy lại script chỉ được
    // thêm chứ không được rơi mất đối chứng đã ghi.
    expect(nga.length).toBeGreaterThanOrEqual(60);
  });

  it("mọi bản ghi nga-msi qua cổng chủ quyền — đúng bốn khoá số liệu", () => {
    // Pub 112 dùng tên "South China Sea"/tên nước ngoài của đảo VN. Cổng này
    // bảo đảm KHÔNG một chuỗi chữ nào của NGA lọt vào file phát cho bà con:
    // chỉ {source, agreed, offsetM ≤ 2 km, at}.
    for (const c of nga) {
      expect(sachChuQuyen(c), JSON.stringify(c)).toBe(true);
    }
  });

  it("cổng chủ quyền tự nó KHÔNG rỗng", () => {
    const chuan = { source: "nga-msi", agreed: true, offsetM: 519, at: "2026-09-02" };
    expect(sachChuQuyen(chuan)).toBe(true);
    expect(sachChuQuyen({ ...chuan, name: "Dao Tran" })).toBe(false); // lọt chữ
    expect(sachChuQuyen({ ...chuan, agreed: false })).toBe(false);
    expect(sachChuQuyen({ ...chuan, offsetM: KHOP_TOI_DA_M + 1 })).toBe(false);
    expect(sachChuQuyen({ ...chuan, source: "osm" })).toBe(false);
  });

  it("sàn đèn có ≥2 nguồn độc lập xác nhận: 85 (đo 2026-09-02: 86/94)", () => {
    // Trước đối chứng NGA là 70. NGA nâng lên 86 — lần đầu có nguồn NGOÀI hệ
    // cơ quan VN xác nhận. Tụt dưới sàn nghĩa là ai đó làm rơi crossChecks.
    const haiNguon = DEN.filter((d) => {
      const s = new Set([
        d.prov.origin.source,
        ...(d.prov.crossChecks ?? []).filter((c) => c.agreed).map((c) => c.source),
      ]);
      return s.size >= 2;
    });
    expect(haiNguon.length).toBeGreaterThanOrEqual(85);
  });
});

/* ══ ĐÈN CỐ-Ý-KHÔNG-TÊN ══════════════════════════════════════════════════ */

/*  Quyết định chủ dự án 2026-09-02 cho các đèn trên thực thể VN bị nước khác
    chiếm đóng (+ một ngọn phía TQ vịnh Bắc Bộ sát đường phân định): "nếu
    không có info chính xác thì chỉ ghi gọn là đèn thôi, đừng để tên." Số
    liệu (toạ độ, đặc tính, tầm) lấy từ Pub 112; TÊN thì không lấy một chữ
    nào. Hàng mang cờ cột 17 — đường DUY NHẤT qua cổng tên, và phải phân biệt
    được với "thiếu tên do lỗi" (hàng lỗi vẫn bị loại như trước).  */

describe("đèn cố-ý-không-tên (quyết định chủ dự án 2026-09-02)", () => {
  const hangCo = DATA.lights.filter((l) => l[16] === 1);
  const denKhongTen = DEN.filter((d) => d.khongTen);

  it("file có đúng số hàng mang cờ như danh sách đã chốt, không hàng nào mang tên", () => {
    expect(hangCo.length).toBe(DEN_KHONG_TEN_PUB112.length); // 11
    // cột tên = -1: không trỏ vào bảng tên, và bảng tên KHÔNG phình thêm
    // một cái tên nước ngoài nào (94 tên tiếng Việt như cũ).
    expect(hangCo.every((l) => l[9] === -1)).toBe(true);
    expect(DATA.names.length).toBe(94);
  });

  it("bộ giải mã nhận đủ, gắn cờ, tên rỗng — không mục nào lộ 'undefined'", () => {
    expect(denKhongTen.length).toBe(DEN_KHONG_TEN_PUB112.length);
    for (const d of denKhongTen) {
      expect(d.ten).toBe("");
      expect(tenDayDu(d)).toBe("Đèn biển");
      const cau = moTaDenBien(d);
      expect(cau.startsWith("Đèn biển")).toBe(true);
      expect(cau).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it("mỗi ngọn có đặc tính chớp + chu kỳ — không tên nhưng không mù thông tin", () => {
    // Thẻ chạm phải trả lời được "đèn này chớp kiểu gì" — đó là toàn bộ giá
    // trị của một ngọn đèn không tên giữa biển đêm.
    for (const d of denKhongTen) {
      expect(d.light?.character, `thiếu kiểu chớp ở ${d.lon},${d.lat}`).toBeTruthy();
      expect(d.light?.period, `thiếu chu kỳ ở ${d.lon},${d.lat}`).toBeTruthy();
    }
  });

  it("gốc là nga-msi (public domain), có đường tra ngược, giấy phép sạch", () => {
    for (const d of denKhongTen) {
      expect(d.prov.origin.source).toBe("nga-msi");
      expect(d.prov.origin.url).toBeTruthy();
      expect(d.prov.origin.version).toMatch(/Pub 112/);
      expect(isCleanLicense(d.prov)).toBe(true);
    }
  });

  it("cờ là đường DUY NHẤT qua cổng tên — hàng thiếu tên KHÔNG cờ vẫn bị loại", () => {
    const hong = JSON.parse(JSON.stringify(DATA)) as DenBienFile;
    // hàng hợp lệ nhưng cột tên -1 và KHÔNG mang cờ = "thiếu tên do lỗi"
    const khongCo = [...hong.lights[0]];
    khongCo[9] = -1;
    khongCo[16] = 0;
    hong.lights.push(khongCo);
    expect(decodeDenBien(hong).length).toBe(DATA.lights.length); // bị loại
    // đúng hàng đó mang cờ 1 thì được nhận
    const co = [...khongCo];
    co[16] = 1;
    hong.lights.push(co);
    expect(decodeDenBien(hong).length).toBe(DATA.lights.length + 1);
  });

  it("CHỦ QUYỀN: không một tên nào của NGA cho 11 thực thể lọt vào file", () => {
    // Cổng bắt thẳng trên byte file phát hành — tên NGA/Anh/Trung của đúng
    // các thực thể này (và mọi biến thể đã thấy trong Pub 112).
    expect(RAW).not.toMatch(
      /Woody|Bombay|North\s+Reef|Northeast\s+Cay|Thitu|Pagasa|Subi|Itu\s+Aba|Yongshu|Cuarteron|Johnson|Baisu|Sin\s+Cowe|Spratl|Paracel/i,
    );
  });

  it("toạ độ cả 11 nằm trong khung biển VN và đúng vùng đã chốt", () => {
    for (const l of hangCo) {
      expect(trongKhungBienVN(l[0], l[1])).toBe(true);
    }
    // 3 ngọn vùng Hoàng Sa (111–113°Đ, 16–17,1°B) · 7 ngọn vùng Trường Sa
    // (112–115°Đ, dưới 12°B) · 1 ngọn vịnh Bắc Bộ (trên 21°B)
    expect(hangCo.filter((l) => l[1] >= 15.5 && l[1] < 17.5).length).toBe(3);
    expect(hangCo.filter((l) => l[1] < 12).length).toBe(7);
    expect(hangCo.filter((l) => l[1] > 21).length).toBe(1);
  });
});

/* ══ BA KIỀM — Ô ĐẶC TÍNH ĐÃ ĐIỀN TỪ SỔ ATON 2016 ═══════════════════════ */

describe("Ba Kiềm (F3115): đặc tính điền từ đúng dòng sổ AtoN 2016", () => {
  /*  Đợt gộp sổ trước, bộ bóc không đọc ra ô AS của dòng F3115 nên Ba Kiềm
      vào lớp với ô đặc tính TRỐNG. 2026-09-02 đọc lại bản chữ của sổ (kho
      ngoài repo) — dòng F3115 ĐỦ: "Fl (3) W 10s · 87.1 · 19 · Yellow tower
      on yellow building · 12.5". Giá trị dưới đây chép TAY từ đúng dòng đó
      (không qua bộ bóc — cùng triết lý bộ ca đối chứng chép tay ở trên);
      nguồn = chính origin hiện tại của ngọn này (vms-south-aton-list).
      Pub 112 (cả bản 2019 lẫn 2021) KHÔNG có F3115 — NGA không giúp được.  */
  it("đủ kiểu chớp, chu kỳ, tầm, chiều cao — đúng số trong sổ", () => {
    const bk = tim("Ba Kiềm");
    expect(bk, "thiếu đèn Ba Kiềm").toBeTruthy();
    expect(bk!.light?.character).toBe("Fl");
    expect(bk!.light?.group).toBe("3");
    expect(bk!.light?.colour).toBe("white");
    expect(bk!.light?.period).toBe(10);
    expect(bk!.light?.range).toBe(19);
    expect(bk!.colour).toBe("yellow"); // tháp vàng trên nhà vàng
    expect(bk!.chieuCaoThap).toBeCloseTo(12.5, 5);
    expect(bk!.chieuCaoTamSang).toBeCloseTo(87.1, 5);
    expect(bk!.prov.origin.source).toBe("vms-south-aton-list");
  });

  it("câu tiếng Việt của Ba Kiềm đọc trọn, không lộ mã", () => {
    const cau = moTaDenBien(tim("Ba Kiềm")!);
    expect(cau).toContain("Đèn biển Ba Kiềm");
    expect(cau).toMatch(/Chớp/);
    expect(cau).not.toMatch(/undefined|NaN|\bFl\b/);
  });
});
