// Đo Kairos — CDP nội bộ SDVICO (anh Long 2026-10-30) — 14 §22.
import { describe, expect, it } from "vitest";
import {
  cheSdt, chuDeChinh, docDemTaiTro, docDoTho, docKhoang, gopDemTaiTro, khachTrongNhom, nhomCua, phanTram, tongHop,
  TT_LO_TOI_DA, type DoKhach,
} from "@/lib/kairos/do-khach";

const k = (o: Partial<DoKhach> = {}): DoKhach => ({
  phone: "0912345678", name: null, tier: "basic", may: "android", lanMo: "2026-10-30T00:00:00Z", queTinh: null, cang: null,
  baiXem: 0, baiMo: 0, giayDoc: 0, chuDe: {}, ttXem: 0, ttBam: 0, ttBamIds: [], don: 0, ...o,
});

describe("đếm thẻ Tài trợ (hàng đợi trong máy + ranh giới route)", () => {
  it("gộp cùng bài thì cộng, trần 1000", () => {
    expect(gopDemTaiTro([{ id: "tt-aaaa", xem: 2, bam: 0 }], [{ id: "tt-aaaa", xem: 1, bam: 1 }, { id: "tt-bbbb", xem: 1, bam: 0 }]))
      .toEqual([{ id: "tt-aaaa", xem: 3, bam: 1 }, { id: "tt-bbbb", xem: 1, bam: 0 }]);
    expect(gopDemTaiTro([{ id: "tt-aaaa", xem: 999, bam: 0 }], [{ id: "tt-aaaa", xem: 5, bam: 0 }])[0].xem).toBe(1000);
  });
  it("mục hỏng bị bỏ, không làm hỏng cả lô; không phải mảng ⇒ rỗng", () => {
    expect(docDemTaiTro([{ id: "tt-aaaa", xem: 1, bam: 0 }, { id: "SAI ID", xem: 1 }, { id: "tt-cccc", xem: 0, bam: 0 }, null, { id: "tt-dddd", xem: 1.5, bam: 2 }]))
      .toEqual([{ id: "tt-aaaa", xem: 1, bam: 0 }, { id: "tt-dddd", xem: 0, bam: 2 }]);
    expect(docDemTaiTro("x")).toEqual([]);
    expect(docDemTaiTro(undefined)).toEqual([]);
    expect(docDemTaiTro(Array.from({ length: 30 }, (_, i) => ({ id: `tt-${1000 + i}`, xem: 1, bam: 0 })))).toHaveLength(TT_LO_TOI_DA);
  });
});

describe("đọc kết quả kairos_do", () => {
  it("đổi tên cột, bỏ dòng thiếu SĐT, số hỏng ⇒ 0, xếp chủ đề theo bài lướt", () => {
    const d = docDoTho({
      tong_khach: 958,
      khach: [{ phone: "0911", bai_xem: 3, bai_mo: "1", chu_de: { "nghe-ca": 4, x: "hỏng" }, tt_bam_ids: ["tt-aaaa", 1] }, { bai_xem: 9 }],
      chu_de: [{ topic: "nghe-ca", bai_xem: 5 }, { topic: "chinh-sach", bai_xem: 9 }],
      tai_tro: [{ id: "tt-aaaa", luot_xem: 4, luot_bam: 1 }, { luot_xem: 1 }],
    });
    expect(d.tongKhach).toBe(958);
    expect(d.khach).toHaveLength(1);
    expect(d.khach[0]).toMatchObject({ phone: "0911", baiXem: 3, baiMo: 1, chuDe: { "nghe-ca": 4 }, ttBamIds: ["tt-aaaa"], don: 0 });
    expect(d.chuDe.map((c) => c.topic)).toEqual(["chinh-sach", "nghe-ca"]);
    expect(d.taiTro).toEqual([{ id: "tt-aaaa", nguoiXem: 0, luotXem: 4, nguoiBam: 0, luotBam: 1 }]);
  });
  it("null / rác ⇒ rỗng, không ném", () => {
    expect(docDoTho(null)).toEqual({ tongKhach: 0, khach: [], chuDe: [], taiTro: [] });
    expect(docDoTho("x").khach).toEqual([]);
  });
  it("khoảng ngày chỉ nhận 7/30/90, còn lại 30", () => {
    expect(docKhoang("7")).toBe(7);
    expect(docKhoang("90")).toBe(90);
    expect(docKhoang("365")).toBe(30);
    expect(docKhoang(null)).toBe(30);
  });
});

describe("nhóm khách", () => {
  it("chủ đề chính: điểm cao nhất, hoà thì theo tên; chưa đọc ⇒ null", () => {
    expect(chuDeChinh({ "nghe-ca": 3, "chinh-sach": 5 })).toBe("chinh-sach");
    expect(chuDeChinh({ "thoi-su": 2, "nghe-ca": 2 })).toBe("nghe-ca");
    expect(chuDeChinh({})).toBeNull();
  });
  it("bấm tài trợ mà chưa có đơn ⇒ nhóm gọi chốt; có đơn ⇒ đã mua, không gọi chốt", () => {
    expect(nhomCua(k({ ttBam: 1, baiXem: 2 }))).toContain("bam-chua-mua");
    expect(nhomCua(k({ ttBam: 1, don: 1 }))).not.toContain("bam-chua-mua");
    expect(nhomCua(k({ ttBam: 1, don: 1 }))).toContain("da-mua");
  });
  it("lướt mà không mở ⇒ chỉ lướt; mở ≥2 bài hoặc đọc ≥2 phút ⇒ đọc kỹ; không lướt bài nào ⇒ không đọc", () => {
    expect(nhomCua(k({ baiXem: 10 }))).toContain("chi-luot");
    expect(nhomCua(k({ baiXem: 10, baiMo: 2 }))).toContain("doc-ky");
    expect(nhomCua(k({ baiXem: 10, baiMo: 1, giayDoc: 120 }))).toContain("doc-ky");
    expect(nhomCua(k({ baiXem: 10, baiMo: 1, giayDoc: 30 }))).not.toContain("doc-ky");
    expect(nhomCua(k())).toEqual(["khong-doc"]);
  });
  it("đọc chính sách: chủ đề chính là chính sách, hoặc điểm chính sách ≥ 10", () => {
    expect(nhomCua(k({ baiXem: 3, chuDe: { "chinh-sach": 3 } }))).toContain("chinh-sach");
    expect(nhomCua(k({ baiXem: 30, chuDe: { "nghe-ca": 40, "chinh-sach": 10 } }))).toContain("chinh-sach");
    expect(nhomCua(k({ baiXem: 30, chuDe: { "nghe-ca": 40, "chinh-sach": 9 } }))).not.toContain("chinh-sach");
  });
  it("danh sách nhóm: người bấm tài trợ nhiều lên trước, rồi mở bài nhiều", () => {
    const d = { tongKhach: 3, chuDe: [], taiTro: [], khach: [k({ phone: "a", ttBam: 1, baiMo: 0 }), k({ phone: "b", ttBam: 3 }), k({ phone: "c", ttBam: 1, baiMo: 4 })] };
    expect(khachTrongNhom(d, "bam-chua-mua").map((x) => x.phone)).toEqual(["b", "c", "a"]);
  });
});

describe("tổng hợp", () => {
  it("tỷ lệ đọc / mở / bấm và so mua giữa người đọc với người không đọc", () => {
    const t = tongHop({
      tongKhach: 100, chuDe: [], taiTro: [],
      khach: [
        k({ baiXem: 10, baiMo: 1, giayDoc: 90, ttXem: 4, ttBam: 1, don: 1 }),
        k({ baiXem: 10, baiMo: 1, giayDoc: 30 }),
        k({}),
        k({ don: 1 }),
      ],
    });
    expect(t).toMatchObject({ tongKhach: 100, hoatDong: 4, nguoiDoc: 2, tyLeDoc: 0.5, baiXem: 20, baiMo: 2, tyLeMo: 0.1, giayMoiBai: 60, muaCoDoc: 0.5, muaKhongDoc: 0.5, ctr: 0.25 });
    expect(t.nhom["khong-doc"]).toBe(2);
    expect(t.nhom["da-mua"]).toBe(2);
  });
  it("không có ai ⇒ tỷ lệ null (màn hiện —), không chia cho 0", () => {
    const t = tongHop({ tongKhach: 0, khach: [], chuDe: [], taiTro: [] });
    expect(t.tyLeDoc).toBeNull();
    expect(t.ctr).toBeNull();
    expect(t.giayMoiBai).toBeNull();
    expect(phanTram(null)).toBe("—");
  });
});

describe("hiển thị", () => {
  it("che SĐT cho quản lý", () => {
    expect(cheSdt("0912345678")).toBe("0912•••678");
    expect(cheSdt("12")).toBe("•••");
  });
  it("phần trăm một số lẻ kiểu Việt", () => {
    expect(phanTram(0.018)).toBe("1,8 %");
    expect(phanTram(0.5)).toBe("50 %");
  });
});
