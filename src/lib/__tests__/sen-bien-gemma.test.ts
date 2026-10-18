import { describe, expect, it } from "vitest";

import { SPECIES_META } from "@/lib/fish-predict";
import { apDungGemma, canGemma, coGemma, docDap, hoiGemma, SYSTEM, userMsg } from "@/lib/sen-bien/gemma";
import type { SenDest, SenReply } from "@/lib/sen-bien/hieu-y";

const LOAI = Object.keys(SPECIES_META);
const DESTS: SenDest[] = [
  { name: "Cảng Sa Huỳnh", lat: 14.67, lon: 109.07, kind: "cang" },
  { name: "Hòn Mù", lat: 14.9, lon: 109.3, kind: "diem" },
];

describe("prompt khớp lúc train (chung.mjs)", () => {
  it("SYSTEM y chữ", () => expect(SYSTEM).toBe('Bộ hiểu ý Trợ lý Forfish. Đọc câu ngư dân nói, trả đúng một dòng JSON {"y":ý định,"s":tham số,"f":ý thứ hai,"r":lý do chặn}.'));
  it("userMsg hạ chữ thường, '-' khi rỗng", () =>
    expect(userMsg("DẪN VỀ CẢNG SA HUỲNH", { cang: ["sa huynh"], diem: [] })).toBe("xn=0 | cang=sa huynh | diem=- | tau=-\ncau: dẫn về cảng sa huỳnh"));
});

describe("docDap", () => {
  it("đọc JSON chuẩn", () => expect(docDap('{"y":"hoi_ca","s":{"species":"ngu van"}}')).toEqual({ y: "hoi_ca", s: { species: "ngu van" } }));
  it("thừa ngoặc cuối / rác quanh", () => expect(docDap('ok {"y":"mo_lop","s":{"lop":"song"}}}')).toMatchObject({ y: "mo_lop" }));
  it("ý lạ ⇒ null", () => expect(docDap('{"y":"bay_len_troi"}')).toBeNull());
  it("rác ⇒ null", () => expect(docDap("không biết")).toBeNull());
});

describe("apDungGemma — chỉ nhận tham số khi CÙNG việc", () => {
  const hoi: SenReply = { kind: "hoi", q: { loai: "ca", muonDi: false } };
  it("loài + đi luôn", () =>
    expect(apDungGemma(hoi, { y: "hoi_ca", s: { species: "ngu van", di: 1 } }, LOAI, DESTS)).toMatchObject({
      q: { loai: "ca", muonDi: true, loaiCa: { ds: ["ngừ vằn"] } },
    }));
  it("nhóm 'ca ngu' ⇒ mọi loài ngừ", () => {
    const r = apDungGemma(hoi, { y: "hoi_ca", s: { species: "ca ngu" } }, LOAI, DESTS);
    expect(r.kind === "hoi" && r.q.loaiCa?.ds).toContain("ngừ vây vàng");
  });
  it("hướng", () =>
    expect(apDungGemma({ kind: "hoi", q: { loai: "phia_truoc", muonDi: false } }, { y: "hoi_phia_truoc", s: { huong: "dong_bac" } }, LOAI, DESTS)).toMatchObject({ q: { huong: 45 } }));
  it("khác việc ⇒ giữ nguyên", () => expect(apDungGemma(hoi, { y: "gia_ca", s: { species: "ca thu" } }, LOAI, DESTS)).toBe(hoi));
  it("lệnh bản đồ: lớp + ngày giờ + tầng", () =>
    expect(
      apDungGemma({ kind: "map", lenh: { viec: "mo_lop", lop: "song" } }, { y: "mo_lop", s: { lop: "dong_chay", day: 1, gio: 15, tang: 150 } }, LOAI, DESTS),
    ).toEqual({ kind: "map", lenh: { viec: "mo_lop", lop: "dong_chay", luc: { ngay: 1, gio: 15 }, tang: 150 } }));
  it("giá trị ngoài tầm bị bỏ", () =>
    expect(apDungGemma({ kind: "map", lenh: { viec: "doi_thoi_diem", luc: { ngay: 1 } } }, { y: "doi_thoi_diem", s: { day: 99, gio: 40 } }, LOAI, DESTS)).toEqual({
      kind: "map",
      lenh: { viec: "doi_thoi_diem", luc: { ngay: 1 } },
    }));
  it("tên lệch giọng: luật không thấy, Gemma sửa về tên trong danh sách ⇒ đi", () =>
    expect(apDungGemma({ kind: "say", say: "chưa thấy", y: "dan_duong" }, { y: "dan_duong", s: { placeName: "sa huynh" } }, LOAI, DESTS)).toMatchObject({
      kind: "go",
      dest: { name: "Cảng Sa Huỳnh" },
    }));
  it("Gemma null ⇒ giữ nguyên", () => expect(apDungGemma(hoi, null, LOAI, DESTS)).toBe(hoi));
  it("canGemma", () => {
    expect(canGemma(hoi)).toBe(true);
    expect(canGemma({ kind: "say", say: "x" })).toBe(false);
  });
});

describe("web không có Gemma", () => {
  it("coGemma false, hoiGemma null không ném", async () => {
    expect(coGemma()).toBe(false);
    await expect(hoiGemma("xem sóng", {})).resolves.toBeNull();
  });
});
