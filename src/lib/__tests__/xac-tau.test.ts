/**
 * LỚP XÁC TÀU + CHƯỚNG NGẠI VẬT — kiểm trên FILE THẬT + cổng của script sinh.
 *
 * `public/data/xac-tau.v1.json` do `scripts/generate-xac-tau.mjs` đọc từ kho
 * Thông báo hàng hải. Script có cổng tự kiểm, nhưng cổng chỉ chạy KHI ai đó
 * chạy script — file thì nằm trong repo và đi thẳng ra máy bà con. Bộ test
 * này chạy mỗi `npm test`, kiểm đúng cái file sắp phát.
 *
 * Bộ test NHẬP THẲNG các cổng của script (`capToaDo`, `viecCuaTin`,
 * `tenPhuongTien`, `docDongNtM`…) thay vì chép một bản thứ hai — chép lại là
 * cách chắc chắn nhất để hai bản trôi khỏi nhau rồi test xanh trong khi dữ
 * liệu hỏng. Script chỉ chạy khi được gọi thẳng, nhập vào KHÔNG đọc kho.
 *
 * Các ca bẫy dưới đây đều là ÁN LỆ đã cắn dự án thật (ghi ở đầu script):
 * toạ độ tách chữ · cột tên thành số · độ sâu nơi-vật-nằm đội lốt độ sâu
 * vượt qua · tin phao đội lốt tin chướng ngại.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  decodeXacTau,
  moTaXacTau,
  xacTauLabel,
  XAC_TAU_LABEL,
  type XacTauFile,
} from "@/lib/xac-tau";
import { trongKhungBienVN } from "@/lib/den-bien";
import { DEPTH_META } from "@/lib/depth-grid";
import { LICENSES, SOURCES, isCleanLicense } from "@/lib/provenance";

import {
  capToaDo,
  capToaDoKhongDo,
  chonViTri,
  viecCuaTin,
  loaiCuaTin,
  laVatTroi,
  tenPhuongTien,
  khoaTen,
  docDoSauVuotQua,
  docBanKinh,
  docDongNtM,
  docXacTauTheoPhao,
  soDanChieu,
  coordsInLine,
  docBanTin,
  DEPTH_META as DEPTH_META_SCRIPT,
} from "../../../scripts/generate-xac-tau.mjs";

const FILE = path.join(process.cwd(), "public", "data", "xac-tau.v1.json");
const RAW = readFileSync(FILE, "utf8");
const DATA = JSON.parse(RAW) as XacTauFile;
const ITEMS = decodeXacTau(DATA);

/** Chữ Hán/CJK — cùng lớp ký tự với cổng trong `scripts/audit-names.mjs`. */
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;

/* ══ 1. FILE THẬT trong repo ═══════════════════════════════════════════════ */

describe("xac-tau.v1.json — file thật sắp phát cho bà con", () => {
  it("giải mã được và không rỗng (sàn 40 sau đợt gộp bản tin tuần 2026-09)", () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(40);
  });

  it("có mục mang ĐỐI CHỨNG hai nguồn độc lập (tin TBHH + bản tin chỉnh lý)", () => {
    const notices = DATA.notices as Array<{ doiChung?: string[]; duong: string }>;
    expect(notices.some((n) => (n.doiChung?.length ?? 0) > 0)).toBe(true);
    expect(notices.some((n) => n.duong === "ban-tin")).toBe(true);
  });

  it("mọi mục nằm trong khung biển VN", () => {
    for (const x of ITEMS) expect(trongKhungBienVN(x.lon, x.lat)).toBe(true);
  });

  it("không một ký tự Hán/CJK nào (chủ quyền)", () => {
    expect(CJK.test(RAW)).toBe(false);
  });

  it("nhãn tham khảo + giấy phép vn-official còn nguyên", () => {
    expect(DATA.nhan).toMatch(/tham kh[ảa]o/i);
    expect(DATA.giayPhep.giayPhepId).toBe("vn-official");
  });

  it("ngân sách dung lượng: dưới 40 KB (bà con tải qua sóng 3G)", () => {
    expect(RAW.length / 1024).toBeLessThan(40);
  });

  it("mỗi mục tra ngược được: có số hiệu thông báo hoặc URL bản công bố", () => {
    for (const x of ITEMS) {
      const coDuong = Boolean(x.soThongBao) || Boolean(x.prov.origin.url);
      expect(coDuong, `${x.ten ?? "(không tên)"} @${x.lat},${x.lon}`).toBe(true);
    }
  });

  it("độ sâu vượt qua khi có phải là số hợp lý (0–100 m)", () => {
    for (const x of ITEMS) {
      if (x.doSauVuotQua === undefined) continue;
      expect(x.doSauVuotQua).toBeGreaterThan(0);
      expect(x.doSauVuotQua).toBeLessThan(100);
    }
  });

  it("hai vật KHÁC TÊN không trùng khít toạ độ (chuỗi toạ độ tái dùng)", () => {
    const thay = new Map<string, string>();
    for (const x of ITEMS) {
      const k = `${x.lon},${x.lat}`;
      const ten = x.ten ?? "";
      if (thay.has(k)) expect(thay.get(k)).toBe(ten);
      thay.set(k, ten);
    }
  });

  it("tên không dính số hiệu thông báo (cột tên thành số — án lệ BL.1)", () => {
    for (const x of ITEMS) {
      if (!x.ten) continue;
      expect(x.ten).not.toMatch(/TBHH|CVHH/i);
      expect(x.ten).not.toMatch(/[°′″]/);
    }
  });

  it("giấy phép tbhh là nguồn sạch — vào được gói bán", () => {
    expect(LICENSES[SOURCES.tbhh.license].redistributable).toBe(true);
    const coTbhh = ITEMS.find((x) => x.prov.origin.source === "tbhh");
    expect(coTbhh).toBeDefined();
    if (coTbhh) expect(isCleanLicense(coTbhh.prov)).toBe(true);
  });
});

/* ══ 2. CỔNG TOẠ ĐỘ của script — các ca bẫy đã thành án lệ ═════════════════ */

describe("capToaDo — bộ đọc toạ độ", () => {
  it("độ-phút-giây chuẩn, chọn đúng vị trí bắt đầu", () => {
    const caps = capToaDo(`Phao 5 10°38'50,5"N 106°45'42,4"E`);
    expect(caps).toHaveLength(1);
    expect(caps[0].lat).toBeCloseTo(10.64736, 4);
    expect(caps[0].lon).toBeCloseTo(106.76178, 4);
  });

  it("độ-phút LẺ THẬP PHÂN của Thông báo người đi biển", () => {
    const caps = capToaDo(`MINH KHÁNH 01 10°19.314' N 107°02.494' E`);
    expect(caps).toHaveLength(1);
    expect(caps[0].lat).toBeCloseTo(10.3219, 3);
    expect(caps[0].lon).toBeCloseTo(107.04157, 3);
  });

  it("BẮT BUỘC dấu độ thật — OCR đọc ° thành 0 thì BỎ, không đoán", () => {
    // "105016'12,7"" có thể là 105°16' mà cũng có thể là 10°50'16" — mập mờ.
    expect(capToaDo(`105016'12,7" 106045'42"`)).toHaveLength(0);
  });

  it("chữ số bị chẻ mà còn HAI cách đọc trong khung ⇒ bỏ hàng (đếm mập mờ)", () => {
    // "1 1 7°..." đọc được 117° lẫn 17° — cả hai đều lọt khung biển VN? 17°Đ
    // ngoài khung (102–118 chỉ cho kinh độ)… dựng ca thật: vĩ độ "1 2°30'"
    // đọc được 12° (trong khung) và 2° ngoài khung ⇒ MỘT cách đọc, nhận.
    const mot = capToaDo(`1 2°30'00" 109°00'00"`);
    expect(mot).toHaveLength(1);
    expect(mot[0].lat).toBeCloseTo(12.5, 5);
  });

  it("đường lùi vỡ-cột: dấu ° bay mất nhưng còn đủ dấu phút + giây", () => {
    const caps = capToaDoKhongDo(`11 03'49.0" 108 56'57.0"`);
    expect(caps).toHaveLength(1);
    expect(caps[0].lat).toBeCloseTo(11.0636, 3);
    expect(caps[0].lon).toBeCloseTo(108.9492, 3);
  });
});

describe("chonViTri — trung vị chống hàng OCR trộn cột", () => {
  it("≥3 hàng: hàng loạn giữa biển khơi không kéo nổi trung vị", () => {
    const log = { xaCum: 0 };
    const caps = [
      { lon: 109.38961, lat: 10.09153, at: 0 }, // hàng OCR trộn cột (án lệ 4570/TBHH)
      { lon: 107.09164, lat: 10.39059, at: 0 },
      { lon: 107.09224, lat: 10.39106, at: 0 },
      { lon: 107.09285, lat: 10.39028, at: 0 },
    ];
    const vt = chonViTri(caps, log);
    expect(vt).not.toBeNull();
    expect(vt!.lon).toBeCloseTo(107.092, 2);
    expect(log.xaCum).toBe(1);
  });

  it("≤2 hàng: lấy hàng ĐẦU — trung vị hai hàng chỉ là bốc thăm", () => {
    const caps = [
      { lon: 103.8181, lat: 10.3587, at: 0 },
      { lon: 103.8533, lat: 10.8194, at: 0 },
    ];
    expect(chonViTri(caps, null)).toEqual(caps[0]);
  });
});

/* ══ 3. PHÂN LOẠI TIN ══════════════════════════════════════════════════════ */

describe("viecCuaTin — LẬP/GỠ, thứ tự xét có ý nghĩa", () => {
  it("tin 'hoàn thành trục vớt xác tàu X bị chìm' chứa CẢ HAI động từ → GỠ", () => {
    expect(
      viecCuaTin("Về việc hoàn thành trục vớt và di dời xác tàu Thành Đạt 01-BLC bị chìm"),
    ).toBe("GỠ");
  });

  it("chướng ngại vật đã được khắc phục → GỠ; mới phát hiện → LẬP", () => {
    expect(viecCuaTin("Về chướng ngại vật nguy hiểm đã được khắc phục")).toBe("GỠ");
    expect(viecCuaTin("Về chướng ngại vật nguy hiểm mới phát hiện: xác tàu Việt Anh 26")).toBe(
      "LẬP",
    );
  });

  it("chịu được chữ bị chẻ của kho lớp-chữ ('chư ớ ng ng ạ i v ậ t')", () => {
    expect(viecCuaTin("V ề chư ớ ng ng ạ i v ậ t nguy hi ể m m ớ i phát hi ệ n")).toBe("LẬP");
  });

  it("tin không thuộc lớp này → null", () => {
    expect(viecCuaTin("Về thông số kỹ thuật độ sâu vùng nước trước bến")).toBeNull();
  });
});

describe("loaiCuaTin + laVatTroi", () => {
  it("tàu/sà lan chìm-đắm → xac-tau; còn lại → chuong-ngai", () => {
    expect(loaiCuaTin("xác tàu Việt Anh 26")).toBe("xac-tau");
    expect(loaiCuaTin("sà lan SG 7190 bị chìm")).toBe("xac-tau");
    expect(loaiCuaTin("chướng ngại vật nguy hiểm mới phát hiện là dải đá ngầm")).toBe(
      "chuong-ngai",
    );
    expect(loaiCuaTin("vật thể chìm tại khu neo")).toBe("vat-chim");
  });

  it("container TRÔI NỔI không phải vật đứng yên — phải bị loại", () => {
    expect(laVatTroi("20 container trôi nổi trên biển, chưa xác định được vị trí")).toBe(true);
    expect(laVatTroi("tàu chìm tại vị trí có tọa độ")).toBe(false);
  });
});

/* ══ 4. TÊN PHƯƠNG TIỆN — định danh, không bịa ═════════════════════════════ */

describe("tenPhuongTien", () => {
  it("ưu tiên số hiệu đăng ký", () => {
    expect(tenPhuongTien("phương tiện tàu kéo mang số hiệu HP-3605 bị chìm")).toBe("HP-3605");
  });

  it("tên sau từ khoá loại tàu, cắt tại động từ", () => {
    expect(tenPhuongTien("xác tàu Việt Anh 26 bị chìm tại khu vực")).toBe("Việt Anh 26");
    expect(tenPhuongTien("sà lan SG 7190 và sà lan SG 7191 bị chìm")).toBe("SG 7190");
  });

  it("chịu được chữ có dấu bị chẻ ('Đ ạ i H ả i Phát 17', 'b ị chìm')", () => {
    expect(tenPhuongTien("tàu Đ ạ i H ả i Phát 17 b ị chìm")).toBe("Đại Hải Phát 17");
  });

  it("gạch nối tách rời vẫn ghép lại được ('BĐ - 83019 TS')", () => {
    expect(tenPhuongTien("tàu cá BĐ - 83019 TS bị chìm")).toBe("BĐ-83019 TS");
  });

  it("số hiệu THÔNG BÁO không được đội lốt tên tàu", () => {
    expect(tenPhuongTien("tàu 159/TBHH-TCTBĐATHHMN đã hết hiệu lực")).toBeNull();
  });

  it("mảnh toạ độ không phải tên", () => {
    expect(tenPhuongTien(`tàu 109°23'22 chìm`)).toBeNull();
  });

  it("khoaTen: 'TG - 14319' và 'TG-14319' là MỘT vật", () => {
    expect(khoaTen("TG - 14319")).toBe(khoaTen("TG-14319"));
  });
});

/* ══ 5. ĐỘ SÂU VƯỢT QUA — chỉ khi nguồn nói thẳng ══════════════════════════ */

describe("docDoSauVuotQua", () => {
  it("'điểm cạn nhất trên xác tàu đắm có độ sâu 6.8m' → 6.8", () => {
    expect(
      docDoSauVuotQua("vị trí xác tàu đắm nằm trong luồng, điểm cạn nhất trên xác tàu đắm có độ sâu 6.8m."),
    ).toBe(6.8);
  });

  it("'nằm ở độ sâu khoảng 40 mét' là CHỖ VẬT NẰM, không phải nước bên trên → null", () => {
    expect(
      docDoSauVuotQua("vị trí chướng ngại vật nằm ở độ sâu khoảng 40 mét dưới mực nước biển"),
    ).toBeNull();
  });

  it("độ sâu luồng trong tin thông số KHÔNG bị vớ nhầm", () => {
    expect(docDoSauVuotQua("độ sâu được xác định bằng máy hồi âm đạt: 7.0m")).toBeNull();
  });

  it("'ĐỘ SÂU NHỎ NHẤT đạt X m' của luồng ≠ độ sâu vượt qua vật → null (rà 2026-09-03)", () => {
    // Rà lại toàn kho chữ 2026-09-03: "độ sâu nhỏ nhất" xuất hiện ~60 tin, ĐỀU là
    // độ sâu ĐÁY LUỒNG khảo sát ("thông số kỹ thuật độ sâu luồng"), KHÔNG phải
    // nước còn lại trên đỉnh xác tàu. Đọc nhầm nó thành "độ sâu vượt qua" là bịa
    // một con số an toàn — cấm tuyệt đối (luật cứng của hạng mục #6).
    expect(docDoSauVuotQua("Độ sâu nhỏ nhất bằng mét tính từ mực nước số 0 Hải đồ đạt 7,3m")).toBeNull();
    expect(docDoSauVuotQua("Độ sâu nhỏ nhất đạt 2,0m")).toBeNull();
  });

  it("'điểm cạn nhất CỦA CHƯỚNG NGẠI VẬT có độ sâu 1,1 m' → 1.1 (Cửa Gianh, vật thứ hai)", () => {
    // Cùng tin Cửa Gianh tả HAI vật: xác tàu (6,8 m) + chướng ngại vật (1,1 m).
    // Cổng phải đọc được con số của TỪNG vật, không lẫn (án lệ §8 nghiên cứu).
    expect(
      docDoSauVuotQua("chướng ngại vật nằm trong luồng, điểm cạn nhất của chướng ngại vật có độ sâu 1.1m."),
    ).toBe(1.1);
  });
});

describe("docBanKinh", () => {
  it("mét giữ nguyên, hải lý đổi ra mét", () => {
    expect(docBanKinh("cấm neo đậu trong bán kính 200 m quanh vị trí")).toBe(200);
    expect(docBanKinh("bán kính 0,5 hải lý")).toBe(926);
  });
  it("không có chữ 'bán kính' → null (không vớ số lạ)", () => {
    expect(docBanKinh("cách bờ khoảng 200 m về phía Đông")).toBeNull();
  });
});

/* ══ 6. THÔNG BÁO NGƯỜI ĐI BIỂN — dòng Chèn/Xóa Wk ═════════════════════════ */

describe("docDongNtM", () => {
  it("Chèn Wk có tên + toạ độ → sự kiện LẬP", () => {
    const ev = docDongNtM(`Chèn Wk VL - 11311 10°38'50.5" N 106°45'42.4" E`, false);
    expect(ev).toMatchObject({ viec: "LẬP", ten: "VL-11311" });
    expect(ev!.lat).toBeCloseTo(10.64736, 3);
  });

  it("Xóa Wk không tên vẫn là sự kiện GỠ (khớp theo toạ độ)", () => {
    const ev = docDongNtM(`Xóa Wk 10°40'05.16" N 106°47'34.86" E`, false);
    expect(ev).toMatchObject({ viec: "GỠ", ten: null });
  });

  it("mã Wk nằm ở dòng KỀ vẫn nhận (wkGan)", () => {
    const ev = docDongNtM(`Chèn MINH KHÁNH 01 10°19.314' N 107°02.494' E`, true);
    expect(ev).toMatchObject({ viec: "LẬP", ten: "MINH KHÁNH 01" });
  });

  it("không có dấu Wk nào → null; Độ sâu/Cọc là lớp khác → null", () => {
    expect(docDongNtM(`Chèn BV - 1984 10°25'58.08"N 106°46'50.40"E`, false)).toBeNull();
    expect(docDongNtM(`Chèn Độ sâu 10 5 10°23'58.20"N 107°06'11.04"E`, true)).toBeNull();
    expect(docDongNtM(`Chèn Cọc bê tông, 10°23'55.75"N 107°06'11.78"E`, true)).toBeNull();
  });
});

describe("soDanChieu — bản GỠ dẫn chiếu tin cũ", () => {
  it("bắt được số hiệu để xoá đúng mục", () => {
    expect(
      soDanChieu("Thông báo hàng hải số 159/TBHH-TCTBĐATHHMN ngày 10/8/2016 hết hiệu lực"),
    ).toEqual(["159/TBHH-TCTBĐATHHMN"]);
  });
});

/* ══ 7. XÁC TÀU NEO THEO PHAO — mục duy nhất mang độ sâu vượt qua ══════════ */

describe("docXacTauTheoPhao", () => {
  const tin = [
    "THÔNG BÁO HÀNG HẢI",
    "Về thông số kỹ thuật của luồng hàng hải Cửa Gianh",
    "Tên luồng: Cửa Gianh",
    "Căn cứ Nghị định số 58/2017/NĐ-CP…",
    "Lưu ý: Tại khu vực thượng lưu phao số 5 khoảng 10m tồn tại chướng ngại",
    "vật là xác tàu QNg 98087 TS đắm; vị trí xác tàu đắm nằm trong luồng hàng hải",
    "cách biên phải luồng khoảng 17m, điểm cạn nhất trên xác tàu đắm có độ sâu 6.8m.",
  ].join("\n");

  it("bắt đủ: tên · luồng · phao NEO (không vớ phao của câu mô tả đoạn luồng) · độ sâu", () => {
    const neo = docXacTauTheoPhao(tin);
    expect(neo).toMatchObject({ ten: "QNg 98087 TS", luong: "Cửa Gianh", phaoSo: 5, doSau: 6.8 });
  });

  it("tin không có khối 'tồn tại chướng ngại vật là tàu…' → null", () => {
    expect(docXacTauTheoPhao("Về thông số kỹ thuật luồng, độ sâu đạt 7.0m")).toBeNull();
  });
});

/* ══ 7b. BẢN TIN CHỈNH LÝ HẢI ĐỒ TUẦN — độ + phút thập phân ═══════════════ */

describe("coordsInLine — ba dạng OCR thật của bản tin tuần", () => {
  it("ký tự độ thành 9/0 + chữ số nhiễu dính sau dấu phút", () => {
    const p = coordsInLine("26 17942.52'1 106929.90'5");
    expect(p).toHaveLength(1);
    expect(p[0].lat).toBeCloseTo(17.70867, 4);
    expect(p[0].lon).toBeCloseTo(106.49833, 4);
  });

  it("RỚT dấu phút (34/2025: `107902.395`)", () => {
    const p = coordsInLine("Insert 20942.76'1 107902.395");
    expect(p).toHaveLength(1);
    expect(p[0].lat).toBeCloseTo(20.71267, 4);
    expect(p[0].lon).toBeCloseTo(107.03983, 4);
  });

  it("chữ bán cầu thay dấu phút (71(T)/2025)", () => {
    const p = coordsInLine("1.A wreck exists in position 18947.83N, 105945.67E");
    expect(p).toHaveLength(1);
    expect(p[0].lat).toBeCloseTo(18.79717, 4);
    expect(p[0].lon).toBeCloseTo(105.76117, 4);
  });
});

describe("docBanTin — mục bản tin thành sự kiện LẬP/GỠ", () => {
  it("động từ dòng trên + toạ độ dòng dưới; Replace depth là của soundings; hai nửa Anh–Việt đếm MỘT", () => {
    const log = { banTinWkThay: 0, banTinMauThuan: [] };
    const evs = docBanTin(
      [
        "40/2025 VIET NAM NORTH CENTRAL COAST QUANG BINH CUA GIANH Obstruction, depth.",
        "Source: Ha Tinh Maritime Port Authority; Notice No. 398/TBHH CVHHHT",
        "Insert Obstn",
        "17942.52'1 106029.90'5",
        "Replace depth; 15 with depth; 16 17942.70'1 106930.17'5",
        "40/2025 VIỆT NAM BỜ BIỂN BẮC TRUNG BỘ - QUẢNG BÌNH - CỬA GIANH ~ Chướng ngại vật độ sâu.",
        "Chèn Obstn",
        "17942.52'1 106929.90'5",
      ],
      "x.json",
      log,
    );
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ viec: "LẬP", loai: "chuong-ngai", so: "398/TBHH-CVHHHT" });
    expect(evs[0].lat).toBeCloseTo(17.70867, 4);
  });

  it("nửa Anh nói Delete, nửa Việt nói Chèn CÙNG CHỖ ⇒ mâu thuẫn OCR: bỏ cả hai chiều (án lệ 106/2025)", () => {
    const log = { banTinWkThay: 0, banTinMauThuan: [] as string[] };
    const evs = docBanTin(
      [
        "106/2025 VIET NAM QUANG TRI - CUA GIANH Obstruction, depths.",
        "Delete Obstn",
        "26 17942.52'1 106929.90'5",
        "106/2025 VIỆT NAM QUẢNG TRỊ - CỬA GIANH - Chướng ngại vật, độ sâu.",
        "Chèn Obstn",
        "26 17942.52'1 106029.90'5",
      ],
      "x.json",
      log,
    );
    expect(evs).toHaveLength(0);
    expect(log.banTinMauThuan).toHaveLength(1);
  });

  it("'A wreck exists in position' / 'Tàu đắm được xác định' → LẬP", () => {
    const evs = docBanTin(
      [
        "41/2025 VIET NAM - NORTH CENTRAL COAST - HA TINH -Wreck",
        "1.A wreck exists in position 18906.88'N, 106930.50'E",
      ],
      "x.json",
      { banTinWkThay: 0, banTinMauThuan: [] },
    );
    expect(evs).toHaveLength(1);
    expect(evs[0].viec).toBe("LẬP");
    expect(evs[0].lat).toBeCloseTo(18.11467, 4);
  });

  it("'Replace Wk with Wk' là cập nhật ký hiệu sẵn có — đối chứng, KHÔNG đẻ mục", () => {
    const log = { banTinWkThay: 0, banTinMauThuan: [] };
    const evs = docBanTin(
      [
        "40/2025 VIET NAM CUA GIANH Obstruction, depth.",
        "Wk Wk",
        "with 6",
        "17042.26'1 106929.41'5",
      ],
      "x.json",
      log,
    );
    expect(evs).toHaveLength(0);
    expect(log.banTinWkThay).toBe(1);
  });

  it("mục không phải xác tàu/chướng ngại (phao, độ sâu) không sinh sự kiện", () => {
    const evs = docBanTin(
      [
        "50/2025 VIET NAM HAI PHONG Buoy.",
        "Insert 20942.76'1 107902.395",
      ],
      "x.json",
      { banTinWkThay: 0, banTinMauThuan: [] },
    );
    expect(evs).toHaveLength(0);
  });
});

describe("docXacTauTheoPhao — độ sâu neo vào câu 'trên xác tàu'", () => {
  it("tin tả HAI vật: chướng ngại 1,1 m đứng trước KHÔNG được dán lên xác tàu (án lệ 2026-09-02)", () => {
    const tin = [
      "THÔNG BÁO HÀNG HẢI",
      "Về thông số kỹ thuật của luồng hàng hải Cửa Gianh",
      "Tên luồng: Cửa Gianh",
      "chướng ngại vật nằm trong luồng, điểm cạn nhất của chướng ngại vật có độ sâu 1.1m.",
      "Tại khu vực thượng lưu phao số 5 khoảng 10m tồn tại chướng ngại vật là xác tàu QNg 98087 TS đắm,",
      "điểm cạn nhất trên xác tàu đắm có độ sâu 6.8m.",
    ].join("\n");
    expect(docXacTauTheoPhao(tin)?.doSau).toBe(6.8);
  });
});

/* ══ 8. KHÔNG TRÔI GIỮA HAI BẢN SỰ THẬT ════════════════════════════════════ */

describe("đồng bộ hằng số", () => {
  it("DEPTH_META của script sinh khớp DEPTH_META của src/lib/depth-grid", () => {
    expect(DEPTH_META_SCRIPT).toEqual({
      lat0: DEPTH_META.lat0,
      lon0: DEPTH_META.lon0,
      step: DEPTH_META.step,
      nLat: DEPTH_META.nLat,
      nLon: DEPTH_META.nLon,
    });
  });

  it("loais của file khớp từ vựng XAC_TAU_LABEL", () => {
    for (const l of DATA.loais) expect(Object.keys(XAC_TAU_LABEL)).toContain(l);
  });
});

/* ══ 9. GIẢI MÃ + CÂU MÔ TẢ ════════════════════════════════════════════════ */

describe("decodeXacTau — bỏ hàng hỏng, không ném", () => {
  const khung = {
    v: 1,
    layNgay: "2026-09-02",
    loais: ["xac-tau", "chuong-ngai", "vat-chim"],
    names: ["MINH KHÁNH 01"],
    notices: [{ so: "143/TBHH-TCTBĐATHHMN", nam: 2020, thang: 7, duong: "lop-chu" }],
  };

  it("hàng ngoài khung biển VN bị bỏ (toạ độ tách chữ)", () => {
    const ra = decodeXacTau({
      ...khung,
      items: [
        [107.04157, 10.3219, 0, 0, -1, -1, 0, 0],
        [5.3, 10.3, 0, -1, -1, -1, 0, 0], // kinh độ 5,3° = độ bị tách chữ
      ],
    });
    expect(ra).toHaveLength(1);
    expect(ra[0].ten).toBe("MINH KHÁNH 01");
    expect(ra[0].soThongBao).toBe("143/TBHH-TCTBĐATHHMN");
    expect(ra[0].prov.origin.source).toBe("tbhh");
  });

  it("-1 nghĩa là nguồn không công bố — KHÔNG thành số 0", () => {
    const ra = decodeXacTau({ ...khung, items: [[107.0, 10.3, 0, -1, -1, -1, 0, 0]] });
    expect(ra[0].doSauVuotQua).toBeUndefined();
    expect(ra[0].banKinhCamM).toBeUndefined();
    expect(ra[0].ten).toBeUndefined();
  });

  it("loại lạ rơi về chướng ngại vật — giữ điểm, không lộ mã thô", () => {
    const ra = decodeXacTau({
      ...khung,
      loais: ["kieu-la"],
      items: [[107.0, 10.3, 0, -1, -1, -1, 0, 0]],
    });
    expect(ra[0].loai).toBe("chuong-ngai");
    expect(xacTauLabel("kieu-la")).toBe("Chướng ngại vật");
  });

  it("không tra được tin gốc → prov sdfish (cleanPackage tự chặn), vẫn giữ vật", () => {
    const ra = decodeXacTau({ ...khung, notices: [], items: [[107.0, 10.3, 0, -1, -1, -1, 0, 0]] });
    expect(ra).toHaveLength(1);
    expect(ra[0].prov.origin.source).toBe("sdfish");
  });

  it("dữ liệu rác không ném", () => {
    expect(decodeXacTau(null)).toEqual([]);
    expect(decodeXacTau({})).toEqual([]);
    expect(decodeXacTau({ items: [["x"], null, 5] })).toEqual([]);
  });
});

describe("moTaXacTau — câu cho bà con, không jargon, không bịa", () => {
  it("đủ phần khi có đủ, số kiểu Việt", () => {
    const cau = moTaXacTau({
      lon: 106.49464,
      lat: 17.71042,
      loai: "xac-tau",
      ten: "QNg 98087 TS",
      doSauVuotQua: 1.1,
      soThongBao: "173/TBHH-CVHHQT",
      nam: 2026,
      thang: 2,
      prov: { origin: { source: "tbhh", at: "2026-09-02" } },
    });
    expect(cau).toContain("Xác tàu chìm QNg 98087 TS");
    expect(cau).toContain("còn 1,1 m");
    expect(cau).toContain("tin tháng 2/2026");
    expect(cau).not.toMatch(/số 0 hải đồ|wreck|Wk/i);
  });

  it("KHÔNG in số hiệu thông báo — thẻ chạm đã in riêng dòng đó (review 2026-09-03: in hai lần)", () => {
    const cau = moTaXacTau({
      lon: 106.49464,
      lat: 17.71042,
      loai: "xac-tau",
      ten: "QNg 98087 TS",
      soThongBao: "173/TBHH-CVHHQT",
      nam: 2026,
      prov: { origin: { source: "tbhh", at: "2026-09-02" } },
    });
    expect(cau).not.toContain("173/TBHH-CVHHQT");
    expect(cau).not.toMatch(/Thông báo hàng hải/);
    expect(cau).toContain("tin năm 2026"); // thiếu tháng thì chỉ nói năm
  });

  it("thiếu phần nào bỏ phần đó — không ước chừng độ sâu", () => {
    const cau = moTaXacTau({
      lon: 107,
      lat: 10.3,
      loai: "chuong-ngai",
      prov: { origin: { source: "tbhh", at: "2026-09-02" } },
    });
    expect(cau).toBe("Chướng ngại vật");
  });
});

/*
  ĐÃ NỐI VÀO BẢN ĐỒ CHƯA (2026-09-02) — cổng ba-mảnh, chuẩn bắt buộc cho mọi
  lớp dữ liệu sau bốn lần tái phát bệnh "sinh xong không nối".
*/
import { readFileSync as _rf2 } from "node:fs";
import { join as _j2 } from "node:path";

describe("lớp xác tàu phải được NỐI, không chỉ nằm trong repo", () => {
  const strip = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const doc = (p: string) => strip(_rf2(_j2(process.cwd(), p), "utf8"));

  it("component nạp, vẽ và cho chạm", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa gọi fetchXacTau").toContain("fetchXacTau(");
    expect(v, "chưa vẽ WRECK_LAYER").toContain("WRECK_LAYER");
    expect(v, "chưa vào danh sách chạm").toContain('ids.push("xac-tau")');
    expect(v, "thẻ chưa dùng moTaXacTau").toContain("moTaXacTau(");
  });

  it("nằm trong vỏ SỐNG-CÒN — 8 KB cho thông tin mất-lưới-thủng-vỏ", () => {
    const sw = _rf2(_j2(process.cwd(), "public/sw.js"), "utf8");
    const critical = sw.slice(sw.indexOf("const CRITICAL_SHELL"), sw.indexOf("const SHELL"));
    expect(critical).toContain("/data/xac-tau.v1.json");
  });

  it("bộ tự kiểm đếm được lớp này — trọng tài không được mù lớp mới", () => {
    const kb = _rf2(_j2(process.cwd(), "scripts/kiem-ban-do.mjs"), "utf8");
    expect(kb).toContain("xac-tau.v1.json");
    expect(kb).toContain("WRECK_MINZOOM");
  });
});
