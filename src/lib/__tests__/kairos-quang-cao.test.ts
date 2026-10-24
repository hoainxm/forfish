// Bài Tài trợ Kairos (anh Long 2026-10-24: "t muốn kairos có ads") — 14 §20.
import { describe, expect, it } from "vitest";
import {
  dangChay, docOCauHinh, docTheTaiTro, kiemDanhSach, maMoi, QC_MOI, QC_NUT_MAC_DINH, QC_TRAN, raApp, theSauBai, xoayVong,
  type QuangCao,
} from "@/lib/kairos/quang-cao";

const qc = (o: Partial<QuangCao> = {}): QuangCao => ({
  id: "tt-abcd", nhaTaiTro: "Ngư cụ Sa Huỳnh", tieuDe: "Lưới cước giảm 10%", noiDung: "", anh: null,
  link: "https://shopee.vn/x", nut: "Xem ngay", bat: true, tu: null, den: null, ...o,
});

describe("kiemDanhSach — ranh giới quản trị", () => {
  it("bài đúng qua, chữ thừa khoảng trắng được gọn, nút trống ⇒ mặc định", () => {
    const r = kiemDanhSach([{ ...qc(), tieuDe: "  Lưới   cước ", nut: "" }]);
    expect(r.ok && r.value[0].tieuDe).toBe("Lưới cước");
    expect(r.ok && r.value[0].nut).toBe(QC_NUT_MAC_DINH);
  });
  it("link phải https; ảnh nếu có cũng https", () => {
    expect(kiemDanhSach([qc({ link: "http://shopee.vn" })]).ok).toBe(false);
    expect(kiemDanhSach([qc({ link: "javascript:alert(1)" })]).ok).toBe(false);
    expect(kiemDanhSach([qc({ anh: "http://x.vn/a.jpg" })]).ok).toBe(false);
  });
  it("thiếu nhà tài trợ / tiêu đề, nút > 2 chữ, mã trùng, quá 20 bài ⇒ từ chối CẢ lượt kèm số dòng", () => {
    expect(kiemDanhSach([qc({ nhaTaiTro: " " })])).toMatchObject({ ok: false, loi: expect.stringContaining("Bài 1") });
    expect(kiemDanhSach([qc({ tieuDe: "" })]).ok).toBe(false);
    expect(kiemDanhSach([qc({ nut: "Mua ngay đi" })]).ok).toBe(false);
    expect(kiemDanhSach([qc(), qc()])).toMatchObject({ ok: false, loi: expect.stringContaining("Bài 2") });
    expect(kiemDanhSach(Array.from({ length: QC_TRAN.soLuong + 1 }, (_, i) => qc({ id: `tt-${1000 + i}` }))).ok).toBe(false);
  });
  it("ngày kết thúc phải sau ngày bắt đầu", () => {
    expect(kiemDanhSach([qc({ tu: "2026-10-24T00:00:00Z", den: "2026-10-23T00:00:00Z" })]).ok).toBe(false);
  });
});

describe("đọc ô cấu hình", () => {
  it("hỏng / trống ⇒ [] (quảng cáo không làm hỏng dòng tin)", () => {
    expect(docOCauHinh(null)).toEqual([]);
    expect(docOCauHinh("{không phải json")).toEqual([]);
    expect(docOCauHinh(JSON.stringify([qc({ link: "ftp://x" })]))).toEqual([]);
    expect(docOCauHinh(JSON.stringify([qc()]))).toHaveLength(1);
  });
});

describe("đang chạy + xoay vòng", () => {
  const NOW = Date.parse("2026-10-24T05:00:00Z");
  it("chỉ bài bật và trong khoảng ngày", () => {
    const l = [
      qc({ id: "tt-a1" }),
      qc({ id: "tt-a2", bat: false }),
      qc({ id: "tt-a3", tu: "2026-10-25T00:00:00Z" }),
      qc({ id: "tt-a4", den: "2026-10-24T04:00:00Z" }),
    ];
    expect(dangChay(l, NOW).map((x) => x.id)).toEqual(["tt-a1"]);
  });
  it("xoay vòng theo hạt, cùng hạt cùng thứ tự; không hạt ⇒ thứ tự gốc", () => {
    expect(xoayVong([1, 2, 3], 4)).toEqual([2, 3, 1]);
    expect(xoayVong([1, 2, 3], 4)).toEqual(xoayVong([1, 2, 3], 4));
    expect(xoayVong([1, 2, 3], undefined)).toEqual([1, 2, 3]);
  });
});

describe("chèn vào dòng tin — 1 thẻ / 20 bài", () => {
  it("sau bài thứ 5 của mỗi khối 20, thẻ lần lượt", () => {
    const vi = Array.from({ length: 60 }, (_, i) => theSauBai(i, 2)).map((x, i) => (x == null ? null : [i, x]));
    expect(vi.filter(Boolean)).toEqual([[4, 0], [24, 1], [44, 0]]);
    expect(Array.from({ length: QC_MOI }, (_, i) => theSauBai(i, 0)).every((x) => x == null)).toBe(true);
  });
});

describe("app đọc thẻ từ máy chủ", () => {
  it("bỏ cờ quản trị; hình dạng sai ⇒ []", () => {
    expect(raApp(qc())).not.toHaveProperty("bat");
    expect(docTheTaiTro([raApp(qc())])).toHaveLength(1);
    expect(docTheTaiTro([{ id: "x" }])).toEqual([]);
    expect(docTheTaiTro("rác")).toEqual([]);
  });
  it("mã mới hợp lệ", () => {
    expect(kiemDanhSach([qc({ id: maMoi(Date.now(), 0.5) })]).ok).toBe(true);
  });
});
