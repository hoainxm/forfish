/**
 * CỔNG CHO THƯỚC ĐO PHỦ (2026-09-02, mở rộng 2026-09-03 cho trục 3).
 *
 * `scripts/kiem-phu-hai-do.mjs` là cái thước cho yêu cầu "hoàn thiện tới khi
 * 100% vượt qua các hải đồ thương mại": nó so lớp báo hiệu của ta với CON SỐ
 * NHÀ NƯỚC TỰ CÔNG BỐ (trục 1), với số đếm tay trên ảnh Navionics trong khung
 * đối chiếu (trục 2), và với 15 hạng mục IHO S-52 một hải đồ điện tử thương
 * mại hiển thị (trục 3 — xem docs/research/thuoc-vuot-hai-do-2026-09.md).
 * File này canh bốn điều:
 *
 *   1. THƯỚC PHẢI CHẠY — một cái thước gãy mà không ai biết thì tệ hơn không
 *      có thước;
 *   2. MỌI CON SỐ CHUẨN PHẢI CÓ NGUỒN GHI KÈM — con số không nguồn là con số
 *      bịa, và thước chấm bằng số bịa thì đo được đúng một thứ: sự tự tin;
 *   3. SÀN KHÔNG ĐƯỢC TỤT — % phủ đo được NGAY SAU đợt gộp sổ AtoN 2016 ghi
 *      cứng ở đây; lần sinh lại nào làm rơi nguồn là cổng này đỏ;
 *   4. TRỤC 3 KHÔNG ĐƯỢC TỤT DƯỚI SỐ ĐÃ ĐẠT — mỗi hạng mục có dữ liệu phải
 *      đếm ra >0, và tổng số hạng mục VƯỢT có một cái SÀN riêng.
 */
import { describe, it, expect } from "vitest";
import {
  doTrucNhaNuoc,
  doKhungNavionics,
  hangMucChuan,
  tongKet,
  CONG_BO_TUYEN,
  CONG_BO_DEN_BIEN,
  KHUNG_NAVIONICS,
} from "../../../scripts/kiem-phu-hai-do.mjs";

type HangTuyen = {
  encId: number | null;
  ten: string;
  congBo: number | null;
  nghi?: boolean;
  khoa: string[];
  ghi?: string;
  nguon: string;
  ta: number;
  phanTram: number | null;
};
type Truc1 = {
  hang: HangTuyen[];
  denBien: { ten: string; congBo: number; ta: number; phanTram: number; nguon: string };
  tong: { congBo: number; ta: number; phanTram: number; soHangTinh: number };
};
type LopNav = { ten: string; ho: number; hoGhi: string; ta: number; vuot: boolean };
type KhungNav = { noi: string; nguon: string; lop: LopNav[] };
type HangMucRow = {
  id: number;
  ten: string;
  taCo: string;
  ketLuan: "VƯỢT" | "ĐẠT" | "CHƯA";
  ghi: string;
};
type HangMucChuan = { hang: HangMucRow[]; tongVuot: number; tongDat: number; tongChua: number };

/*  Script là `.mjs` nên không mang kiểu — khai hình dạng ngay tại chỗ dùng
    (cùng lối với kiem-ban-do.test.ts) và đổi kiểu qua `unknown`. */
const t1 = doTrucNhaNuoc() as unknown as Truc1;
const t2 = doKhungNavionics() as unknown as KhungNav[];
const hm = hangMucChuan() as unknown as HangMucChuan;

describe("thước chạy được và ra đủ ba trục", () => {
  it("trục 1 có bảng tuyến + hàng đèn biển + dòng tổng", () => {
    expect(t1.hang.length).toBeGreaterThanOrEqual(20);
    expect(t1.tong.congBo).toBeGreaterThan(0);
    expect(t1.denBien.ta).toBeGreaterThan(0);
  });

  it("trục 2 có khung đối chiếu với đủ ba lớp", () => {
    expect(t2.length).toBeGreaterThanOrEqual(1);
    for (const kh of t2) {
      expect(kh.lop).toHaveLength(3);
      for (const l of kh.lop) expect(l.ta).toBeGreaterThanOrEqual(0);
    }
  });

  it("trục 3 có đủ 15 hạng mục, mỗi hạng mục có kết luận hợp lệ", () => {
    expect(hm.hang).toHaveLength(15);
    // id 1..15, không trùng, không thiếu — một hạng mục lạc số là dấu hiệu
    // sao chép/xoá nhầm khi sửa file.
    expect(hm.hang.map((h) => h.id)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    for (const h of hm.hang) {
      expect(["VƯỢT", "ĐẠT", "CHƯA"]).toContain(h.ketLuan);
      expect(h.ten.length).toBeGreaterThan(0);
      expect(h.ghi.length).toBeGreaterThan(10);
    }
    expect(hm.tongVuot + hm.tongDat + hm.tongChua).toBe(15);
  });

  it("câu tổng kết một dòng dựng được, có cả ba trục", () => {
    const { cau } = tongKet() as { cau: string };
    expect(cau).toMatch(/phủ \d+(\.\d+)?% sổ nhà nước/);
    expect(cau).toMatch(/vượt Navionics ở \d+\/\d+ lớp/);
    expect(cau).toMatch(/15 hạng mục hải đồ thương mại: VƯỢT \d+ · ĐẠT \d+ · CHƯA \d+/);
  });
});

describe("trục 3 — mỗi hạng mục CÓ dữ liệu phải đếm ra >0, không giấu số 0 sau chữ", () => {
  /*  2026-09-02: hạng mục 9 (Chất đáy) từng là khoảng trống thật (taCo="0").
      2026-09-03: Lead nối chat-day.v1.json (ACA benthic, 362k+ điểm) — hạng
      mục 9 nay CÓ dữ liệu như 14 hạng mục kia, nên bài kiểm ĐẶC CÁCH cho nó
      đã bỏ. Test dưới bắt lỗi kiểu đọc nhầm khoá JSON khiến một lớp có hàng
      trăm nghìn đối tượng báo cáo "0" (án lệ: hôm 2026-09-01 lớp đèn biển
      từng bị đọc nhầm khoá, xem kiem-ban-do.mjs) — CẢ 15/15 hạng mục giờ phải
      qua được cổng này, không còn ngoại lệ. */
  it("15/15 hạng mục có ít nhất một con số dương trong 'taCo'", () => {
    for (const h of hm.hang) {
      const soTrongTaCo = (h.taCo.match(/\d+/g) ?? []).map(Number);
      expect(soTrongTaCo.some((n) => n > 0), `hạng mục ${h.id} "${h.ten}": taCo="${h.taCo}"`).toBe(
        true,
      );
    }
  });
});

describe("trục 3 — honesty: verdict không được tô hồng quá giới hạn thật của dữ liệu", () => {
  /*  Ba lớp mới ngày 2026-09-03 sáng (chat-day, khu-tru-bao, dia-danh-ngam) +
      ba nhóm nguồn thay thế chiều cùng ngày (tên ven bờ NỔI, cáp quang biển,
      trạm triều EOT20) đều có giới hạn phủ rõ ràng — verdict/ghi PHẢI nói ra
      giới hạn đó, không phải chỉ khoe con số lớn. Đây là cổng chống "tô hồng"
      Lead yêu cầu, và PHẢI khớp với chính `ketLuan` — một note nói ngược
      verdict (vd "0 ven bờ" trong khi verdict đã VƯỢT nhờ ven bờ) là lỗi
      nặng hơn thiếu honesty: nó tự mâu thuẫn. */
  const layHang = (id: number) => hm.hang.find((h) => h.id === id)!;

  it("hạng mục 9 (Chất đáy) là ĐẠT chứ không VƯỢT, và ghi rõ không phủ đáy bùn/cát ven bờ", () => {
    const h = layHang(9);
    expect(h.ketLuan).toBe("ĐẠT");
    expect(h.ghi).toMatch(/rạn\/đảo|nước trong/);
    expect(h.ghi).toMatch(/không|0%/);
    expect(h.ghi).toMatch(/bùn|cát/);
  });

  it("hạng mục 8 (Tên bãi/đá/rạn) là VƯỢT nhờ 1.225 tên ven bờ NỔI — note KHÔNG được nói ngược verdict bằng câu '0 ven bờ'", () => {
    const h = layHang(8);
    expect(h.ketLuan).toBe("VƯỢT");
    expect(h.taCo).toMatch(/1225/);
    expect(h.taCo).toMatch(/184/);
    // Vẫn phải phân biệt NGẦM (Mục III) vs NỔI (Mục A.I) — hai bộ khác nguồn.
    expect(h.ghi).toMatch(/NGẦM|ngầm/);
    expect(h.ghi).toMatch(/nổi|NỔI/);
    // Cấm còn sót câu phủ nhận cũ ("0 ... ven bờ ... có tên") — đó là note
    // lạc hậu đã tự đá verdict VƯỢT hiện tại.
    expect(h.ghi).not.toMatch(/0 rạn ven bờ|0 tên Việt ở ta|chưa soạn/);
  });

  it("hạng mục 12 (Cáp/ống ngầm) là VƯỢT nhờ 10 tuyến cáp quang biển thật; gate không VƯỢT nếu 0 cáp VN", () => {
    const h = layHang(12);
    expect(h.ketLuan).toBe("VƯỢT");
    expect(h.taCo).toMatch(/10/);
    expect(h.ghi).toMatch(/TeleGeography/);
    expect(h.ghi).toMatch(/manh mối|không chép|CC BY-NC-SA/);
    expect(h.ghi).not.toMatch(/gần như trắng|chưa tìm được nguồn mở/);
  });

  it("hạng mục 13 (Khu neo đậu) là VƯỢT nhờ khu-tru-bao thật, ghi rõ 51/160 và phần OSM", () => {
    const h = layHang(13);
    expect(h.ketLuan).toBe("VƯỢT");
    expect(h.taCo).toMatch(/51/);
    expect(h.ghi).toMatch(/160/);
    expect(h.ghi).toMatch(/OSM/);
  });

  it("hạng mục 14 (Thuỷ triều) là VƯỢT, nhưng ghi KHÔNG được đếm trạm mô hình EOT20 như trạm đo", () => {
    const h = layHang(14);
    expect(h.ketLuan).toBe("VƯỢT");
    expect(h.taCo).toMatch(/4 trạm ĐO/);
    expect(h.taCo).toMatch(/7 trạm MÔ HÌNH/);
    expect(h.ghi).toMatch(/EOT20/);
    expect(h.ghi).toMatch(/Rạch Giá|Cà Mau|vịnh Thái Lan/);
    // "11 trạm đo" (gộp mô hình vào đo) là câu nói ngược nguồn — cấm.
    expect(h.taCo).not.toMatch(/11 trạm đo/);
  });

  it("hạng mục 6 (Xác tàu) giữ CHƯA — ghi rõ đây là giới hạn NGUỒN, không phải việc chưa làm, và từ chối bịa số", () => {
    const h = layHang(6);
    expect(h.ketLuan).toBe("CHƯA");
    expect(h.ghi).toMatch(/giới hạn NGUỒN/);
    expect(h.ghi).toMatch(/hông bịa/);
  });

  it("hạng mục 11 (Vùng cấm): vòng cấm neo an-toàn nâng lên ĐẠT, ghi rõ chỉ phủ vịnh Bắc Bộ", () => {
    const h = layHang(11);
    expect(h.ketLuan).toBe("ĐẠT");
    expect(h.taCo).toMatch(/AN TOÀN/);
    expect(h.ghi).toMatch(/vịnh Bắc Bộ|hẹp/);
  });
});

describe("mọi con số chuẩn phải có nguồn ghi kèm — không bịa", () => {
  it("từng hàng tuyến có công bố đều mang câu nguồn tra lại được", () => {
    for (const r of t1.hang) {
      if (r.congBo == null) continue;
      expect(r.nguon, `${r.ten}: thiếu nguồn`).toBeTruthy();
      expect(r.nguon.length, `${r.ten}: nguồn quá cụt`).toBeGreaterThan(20);
    }
  });

  it("hàng tuyến mang mã ENC thì nguồn trỏ đúng trang ENC đó", () => {
    for (const r of t1.hang) {
      if (r.encId == null || r.congBo == null) continue;
      expect(r.nguon).toContain(`ChiTietTuyenLuong.aspx?ID=${r.encId}`);
    }
  });

  it("con số đèn biển 94 ghi rõ xuất xứ VÀ trạng thái chưa-tra-được-văn-bản", () => {
    // 94 là con số chủ dự án cung cấp, chưa đối chiếu được văn bản gốc — thước
    // được dùng nó nhưng KHÔNG được trình bày như trích dẫn văn bản pháp lý.
    expect(CONG_BO_DEN_BIEN.nguon).toMatch(/chưa tra được văn bản gốc/);
    expect(CONG_BO_DEN_BIEN.nguon).toMatch(/gop-so-aton-2026-09/);
  });

  it("số đếm Navionics ghi nguồn ảnh + nơi lưu số đếm tay", () => {
    for (const kh of KHUNG_NAVIONICS as KhungNav[]) {
      expect(kh.nguon).toMatch(/Navionics/);
      expect(kh.nguon).toMatch(/gop-so-aton-2026-09/);
    }
  });

  it("con số công bố bị nghi sai phải bị LOẠI khỏi % tổng, kèm lý do", () => {
    // Quy Nhơn "300 phao" cho luồng 6 km — chấm điểm theo cột chuẩn sai còn
    // tệ hơn không chấm. Hàng nghi sai vẫn in ra bảng nhưng không vào %.
    const quyNhon = (CONG_BO_TUYEN as unknown as HangTuyen[]).find((r) =>
      /Quy Nhơn/.test(r.ten),
    );
    expect(quyNhon?.nghi).toBe(true);
    expect(quyNhon?.ghi).toMatch(/lỗi nhập liệu/);
    const tinh = t1.hang.filter((r) => r.congBo != null && !r.nghi);
    expect(t1.tong.soHangTinh).toBe(tinh.length);
  });
});

describe("SÀN — đo ngay sau đợt gộp sổ AtoN 2016, không được tụt", () => {
  /*  Số thật đo 2026-09-02. Sau gộp ba tầng sổ AtoN: 760/817 = 93%
      (TRƯỚC gộp: 25,6%). Sau đợt PHÂN XỬ trùng-tên/trùng-chỗ (quyết định chủ
      dự án 2026-09-02, bảng ở docs/research/gop-so-aton-2026-09.md §9):
        · tổng: 783/817 = 95,8% — 46 mục sổ được thả sau phân xử từng ca
        · Định An – Cần Thơ: 142 báo hiệu (công bố 118) — trước gộp: 29
        · đèn biển: ≥94 (94 khi đo; nhóm đèn còn bổ song song)
      Sàn đặt 95 (không phải 95,8): trừ hao trang ENC sống đổi vài hàng giữa
      hai lần đọc (đã dính: ĐT Hòn Miều mất toạ độ) — tụt dưới 95 là RƠI NGUỒN,
      không phải dao động. */

  it("phủ tổng sổ nhà nước ≥ 95%", () => {
    expect(t1.tong.phanTram).toBeGreaterThanOrEqual(95);
  });

  it("Định An – Cần Thơ — ô 'vài chục/118' ngày trước — nay phủ đủ", () => {
    const r = t1.hang.find((h) => /Định An/.test(h.ten))!;
    expect(r.ta).toBeGreaterThanOrEqual(100);
    expect(r.phanTram).toBe(100);
  });

  it("đèn biển 94/94", () => {
    expect(t1.denBien.ta).toBeGreaterThanOrEqual(94);
    expect(t1.denBien.phanTram).toBe(100);
  });

  it("khung Vũng Tàu: giữ thế VƯỢT Navionics ở số đo sâu và báo hiệu", () => {
    const vt = t2.find((k) => k.noi === "vung-tau")!;
    const lay = (ten: RegExp) => vt.lop.find((l) => ten.test(l.ten))!;
    expect(lay(/số đo sâu/).vuot).toBe(true);
    expect(lay(/phao/).vuot).toBe(true);
    // Xác tàu trong khung này ta đang 1/2 (xac-tau.v1.json, nối 2026-09-02 —
    // trước đó thước đọc nhầm lớp reef-shapes cũ và báo 0) — thước phải NÓI ra
    // chỗ thua, không giấu. Khi lớp xác tàu có nguồn chính thức (NGA MSI đang
    // 503) thì hàng này đổi trạng thái và test này cập nhật theo.
    expect(lay(/xác tàu/).ta).toBeGreaterThanOrEqual(1);
    expect(lay(/xác tàu/).vuot).toBe(false);
  });

  it("trục 3: tổng số hạng mục VƯỢT+ĐẠT không được tụt dưới số đã đạt 2026-09-03", () => {
    // Lịch sử sàn trong ngày 2026-09-03 (chi tiết + lý lẽ từng hạng mục:
    // docs/research/thuoc-vuot-hai-do-2026-09.md):
    //   sáng      VƯỢT 6/15 · ĐẠT 2/15 · CHƯA 7/15
    //   sau đợt 1 VƯỢT 8/15 · ĐẠT 4/15 · CHƯA 3/15 — chat-day, khu-tru-bao,
    //             dia-danh-ngam, vòng cấm an-toàn, + 41 luồng vn-aids (phát
    //             hiện khi đo lại, không phải việc chủ ý của đợt đó)
    //   sau đợt 2 VƯỢT 11/15 · ĐẠT 3/15 · CHƯA 1/15 — 1.225 tên ven bờ nổi
    //             (hạng mục 8: ĐẠT→VƯỢT), 10 cáp quang biển (12: CHƯA→VƯỢT),
    //             11 trạm triều/4 đo+7 mô hình (14: CHƯA→VƯỢT); 6 giữ CHƯA
    // Sàn nâng theo NGUYÊN TẮC 4 (không được tụt dưới số đã đạt): VƯỢT ≥10,
    // VƯỢT+ĐẠT ≥13 — lỏng hơn số đo được (11, 14) một khấc để chừa chỗ biến
    // động nhỏ giữa hai lần đọc (vd. trang ENC sống đổi vài hàng) mà không đỏ
    // oan, nhưng tụt dưới sàn này là RƠI NGUỒN thật, không phải dao động.
    expect(hm.tongVuot).toBeGreaterThanOrEqual(10);
    expect(hm.tongVuot + hm.tongDat).toBeGreaterThanOrEqual(13);
  });
});
