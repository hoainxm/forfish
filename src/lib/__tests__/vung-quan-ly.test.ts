/**
 * LỚP KHU BẢO TỒN · VÙNG CẤM KHAI THÁC CÓ THỜI HẠN · KHU BẢO VỆ NGUỒN LỢI —
 * kiểm trên FILE THẬT `public/data/vung-quan-ly.v1.json` (sinh bằng
 * `scripts/build-vung-quan-ly.mjs`) + luật mùa cấm + hình học thuần.
 *
 * File đi thẳng ra máy bà con, nên bộ test này chạy mỗi `npm test`, kiểm đúng
 * cái file sắp phát: toạ độ trong khung biển VN, không tên sai chủ quyền, đủ
 * 27 khu bảo tồn, mùa cấm đọc được, điểm-trong-vùng đúng.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  decodeVungQuanLy,
  parseMuaCam,
  hopMuaCam,
  dangCam,
  dangVung,
  canhBaoDanDuong,
  trongVung,
  tenNoi,
  moTaVung,
  trangThaiText,
  muaCamText,
  type VungQuanLyFile,
  type VungQuanLy,
} from "@/lib/vung-quan-ly";
import { trongKhungBienVN } from "@/lib/den-bien";
import { LICENSES, type LicenseId } from "@/lib/provenance";

const FILE = path.join(process.cwd(), "public", "data", "vung-quan-ly.v1.json");
const RAW = readFileSync(FILE, "utf8");
const DATA = JSON.parse(RAW) as VungQuanLyFile;
const VUNG = decodeVungQuanLy(DATA);

const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;
/** Ngày cố định — test không được đổi kết quả theo lịch máy. */
const T5 = new Date(2026, 4, 15); // 15/5: trong mùa cấm 01/4–30/6
const T9 = new Date(2026, 8, 15); // 15/9: ngoài mùa

/* ══ CHỦ QUYỀN + HÌNH DẠNG FILE ══════════════════════════════════════════ */

describe("vùng quản lý: cổng chủ quyền + hình dạng file", () => {
  it("không ký tự Hán/CJK, không tên nước ngoài của thực thể Việt Nam", () => {
    expect(RAW.match(new RegExp(CJK.source, "g"))).toBeNull();
    expect(/\b(spratly|paracel|south\s+china\s+sea|nansha|xisha|sansha)\b/i.test(RAW)).toBe(false);
  });

  it("v=1, mang nhãn 'tham khảo', giấy phép nhà nước, nguồn nêu rõ", () => {
    expect(DATA.v).toBe(1);
    expect(DATA.nhan).toMatch(/tham khảo/i);
    expect(DATA.giayPhep.giayPhepId).toBe("vn-official");
    const terms = LICENSES[DATA.giayPhep.giayPhepId as LicenseId];
    expect(terms.redistributable).toBe(true);
    expect(terms.shareAlike).toBe(false);
    expect(DATA.nguon).toMatch(/19\/2018/);
    expect(DATA.nguon).toMatch(/bảo tồn/i);
    expect(DATA.layNgay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("nằm xa dưới trần 20 MB (chống phình: ≤ 400 KB)", () => {
    expect(Buffer.byteLength(RAW) / 1024).toBeLessThanOrEqual(400);
  });
});

/* ══ GIẢI MÃ + BẤT BIẾN ══════════════════════════════════════════════════ */

describe("vùng quản lý: giải mã file thật", () => {
  it("đủ 27 khu bảo tồn, ≥ 25 vùng cấm TT 19, ≥ 50 khu bảo vệ nguồn lợi; không hàng rác", () => {
    const dem = (l: VungQuanLy["loai"]) => VUNG.filter((v) => v.loai === l).length;
    expect(dem("bao-ton")).toBe(27);
    expect(dem("cam-thoi-han")).toBeGreaterThanOrEqual(25);
    expect(dem("bao-ve-nguon-loi")).toBeGreaterThanOrEqual(50);
    expect(VUNG.length).toBe(DATA.vung.length);
  });

  it("MỌI vùng có tâm trong khung biển VN và mọi đỉnh ranh giới cũng vậy", () => {
    for (const v of VUNG) {
      expect(trongKhungBienVN(v.lon, v.lat), v.ma).toBe(true);
      for (const poly of v.polys ?? []) for (const ring of poly) for (const [lon, lat] of ring)
        expect(trongKhungBienVN(lon, lat), `${v.ma} có đỉnh ngoài khung`).toBe(true);
    }
  });

  it("mã duy nhất, tên không rỗng, tỉnh là tên 2025 (không phải mã)", () => {
    expect(new Set(VUNG.map((v) => v.ma)).size).toBe(VUNG.length);
    expect(VUNG.every((v) => v.ten.length >= 3)).toBe(true);
    expect(VUNG.every((v) => /^[A-ZĐ][^A-Z]*/.test(v.tinh) && !/^[A-Z]{3,6}$/.test(v.tinh))).toBe(true);
  });

  it("khu bảo tồn: ai cũng có ranh giới, cấp, phân hạng, trạng thái; ba khu Trường Sa mang tên Việt", () => {
    const bt = VUNG.filter((v) => v.loai === "bao-ton");
    expect(bt.every((v) => v.polys && v.cap && v.phanHang && v.trangThai)).toBe(true);
    for (const ten of ["Song Tử", "Nam Yết", "Thuyền Chài"]) expect(bt.some((v) => v.ten.includes(ten)), ten).toBe(true);
    // chữ mã hoá hai lần đã sửa — không còn "báº£o"
    expect(bt.every((v) => !/[ÃÄÆ]|áº/.test(v.ten + v.tinh + (v.phanHang ?? "")))).toBe(true);
  });

  it("vùng cấm TT 19: có ranh giới thì có mùa cấm đọc được; 10 vùng lệch bảng giữ cả hai chuỗi", () => {
    const cam = VUNG.filter((v) => v.loai === "cam-thoi-han");
    expect(cam.filter((v) => v.polys).every((v) => v.mua.length > 0)).toBe(true);
    const lech = cam.filter((v) => v.thoiGianKhac);
    expect(lech.length).toBeGreaterThanOrEqual(5);
    // hợp hai bảng ⇒ số khoảng ≥ số khoảng của riêng bảng vùng
    for (const v of lech) expect(v.mua.length).toBeGreaterThanOrEqual(parseMuaCam(v.thoiGian).length);
  });

  it("hàng hỏng bị BỎ, không làm mất cả lớp", () => {
    const xau = decodeVungQuanLy({
      v: 1,
      vung: [
        null,
        { ma: "X1", loai: "bao-ton", lon: 999, lat: 0 }, // ngoài khung
        { ma: "", loai: "bao-ton", lon: 108, lat: 12 }, // thiếu mã
        { ma: "X3", loai: "la-lam", lon: 108, lat: 12 }, // loại lạ
        { ma: "OK", loai: "bao-ve-nguon-loi", lon: 108, lat: 12, diem: true, doiTuong: "Sá sùng (Sipunculus nudus)" },
      ],
    });
    expect(xau.map((v) => v.ma)).toEqual(["OK"]);
    expect(xau[0].ten).toBe("Khu bảo vệ sá sùng");
    expect(decodeVungQuanLy(null)).toEqual([]);
    expect(decodeVungQuanLy({ vung: "rác" })).toEqual([]);
  });
});

/* ══ MÙA CẤM ═════════════════════════════════════════════════════════════ */

describe("mùa cấm", () => {
  it("đọc nhiều khoảng, bỏ phần rác, nhận gạch ngang dài", () => {
    expect(parseMuaCam("01/4-30/6; 01/11-30/11")).toEqual([
      { tuThang: 4, tuNgay: 1, denThang: 6, denNgay: 30 },
      { tuThang: 11, tuNgay: 1, denThang: 11, denNgay: 30 },
    ]);
    expect(parseMuaCam("01/02–31/5; tháng 8")).toEqual([{ tuThang: 2, tuNgay: 1, denThang: 5, denNgay: 31 }]);
    expect(parseMuaCam("quanh năm")).toEqual([]);
    expect(parseMuaCam(null)).toEqual([]);
    expect(parseMuaCam("01/13-30/6")).toEqual([]); // tháng 13 không có
  });

  it("hợp hai bảng bỏ khoảng trùng", () => {
    const hop = hopMuaCam("01/4-30/6; 01/11-30/11", "01/4-30/6; 01/8-31/8; 01/11-30/11");
    expect(hop).toHaveLength(3);
    expect(muaCamText(hop)).toBe("1/4–30/6 và 1/8–31/8 và 1/11–30/11"); // xếp theo năm, không theo bảng
  });

  it("đang cấm / ngoài mùa, kể cả khoảng vắt năm, bao gồm hai đầu", () => {
    const mua = parseMuaCam("01/4-30/6; 01/11-30/11");
    expect(dangCam(mua, T5)).toBe(true);
    expect(dangCam(mua, T9)).toBe(false);
    expect(dangCam(mua, new Date(2026, 3, 1))).toBe(true); // 1/4
    expect(dangCam(mua, new Date(2026, 5, 30))).toBe(true); // 30/6
    expect(dangCam(mua, new Date(2026, 6, 1))).toBe(false); // 1/7
    const vat = parseMuaCam("01/11-28/2");
    expect(dangCam(vat, new Date(2026, 0, 10))).toBe(true);
    expect(dangCam(vat, new Date(2026, 11, 10))).toBe(true);
    expect(dangCam(vat, new Date(2026, 5, 10))).toBe(false);
    expect(dangCam([], T5)).toBe(false);
    expect(muaCamText(mua)).toBe("1/4–30/6 và 1/11–30/11");
  });

  it("dạng vùng theo ngày: cấm có thời hạn đổi theo mùa, bảo tồn theo trạng thái, BVNL luôn quy hoạch", () => {
    const cam = VUNG.find((v) => v.loai === "cam-thoi-han" && v.polys && v.thoiGian?.includes("01/4-30/6"))!;
    expect(dangVung(cam, T5)).toBe("dang-cam");
    expect(dangVung(cam, T9)).toBe("ngoai-mua");
    const daLap = VUNG.find((v) => v.loai === "bao-ton" && v.trangThai === "da_thanh_lap")!;
    const moi = VUNG.find((v) => v.loai === "bao-ton" && v.trangThai === "thanh_lap_moi")!;
    expect(dangVung(daLap, T5)).toBe("hieu-luc");
    expect(dangVung(moi, T5)).toBe("quy-hoach");
    expect(dangVung(VUNG.find((v) => v.loai === "bao-ve-nguon-loi")!, T5)).toBe("quy-hoach");
    expect(trangThaiText(cam, T5)).toMatch(/^ĐANG MÙA CẤM/);
    expect(trangThaiText(cam, T9)).toMatch(/^ngoài mùa cấm/);
  });

  it("chỉ khu bảo tồn đã có hiệu lực và vùng cấm có mùa đọc được mới vào kho dẫn đường", () => {
    const vao = VUNG.filter(canhBaoDanDuong);
    expect(vao.length).toBeGreaterThanOrEqual(30);
    expect(vao.every((v) => v.polys && v.loai !== "bao-ve-nguon-loi")).toBe(true);
    expect(vao.some((v) => v.trangThai === "thanh_lap_moi")).toBe(false);
  });
});

/* ══ HÌNH HỌC ════════════════════════════════════════════════════════════ */

describe("điểm trong vùng", () => {
  it("tâm khu bảo tồn Cù Lao Chàm nằm trong khu; giữa Biển Đông thì không; điểm không có vòng thì không", () => {
    const clc = VUNG.find((v) => v.ten.includes("Cù Lao Chàm"))!;
    expect(trongVung(clc, clc.lon, clc.lat)).toBe(true);
    expect(trongVung(clc, 113.5, 13.5)).toBe(false);
    expect(trongVung({ polys: null }, clc.lon, clc.lat)).toBe(false);
    expect(trongVung(clc, NaN, 1)).toBe(false);
  });

  it("lỗ (đảo trong khu) là NGOÀI khu — luật chẵn-lẻ", () => {
    const v = {
      polys: [[
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
      ]],
    };
    expect(trongVung(v, 2, 2)).toBe(true);
    expect(trongVung(v, 5, 5)).toBe(false);
    expect(trongVung(v, 11, 5)).toBe(false);
  });
});

/* ══ CÂU CHỮ ═════════════════════════════════════════════════════════════ */

describe("câu cho bà con", () => {
  it("tên ghép vào câu dẫn đường: chữ thường đầu câu, nói rõ 'theo mùa' với vùng cấm", () => {
    expect(tenNoi({ loai: "bao-ton", ten: "Khu bảo tồn biển Cù Lao Chàm" })).toBe("khu bảo tồn biển Cù Lao Chàm");
    expect(tenNoi({ loai: "bao-ton", ten: "Cồn Cỏ" })).toBe("khu bảo tồn biển Cồn Cỏ");
    expect(tenNoi({ loai: "cam-thoi-han", ten: "Vùng biển Long Châu - Hạ Mai" })).toBe(
      "vùng cấm khai thác theo mùa (vùng biển Long Châu - Hạ Mai)",
    );
  });

  it("mô tả: tên · tỉnh · diện tích kiểu Việt · trạng thái; không bịa phần thiếu", () => {
    const clc = VUNG.find((v) => v.ten.includes("Cù Lao Chàm"))!;
    const s = moTaVung(clc, T5);
    expect(s).toMatch(/^Khu bảo tồn biển Cù Lao Chàm · Đà Nẵng · 23\.488 ha/);
    expect(s).toMatch(/chuyển tiếp/);
    const diem = VUNG.find((v) => v.loai === "bao-ve-nguon-loi" && v.diem && !v.dienTichHa);
    if (diem) expect(moTaVung(diem, T5)).not.toMatch(/ ha/);
  });
});
