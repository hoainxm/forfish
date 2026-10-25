import { describe, expect, it } from "vitest";
import { hienCauPhu, pillTaiMangDi, toastTaiMangDi } from "@/lib/kairos/dau-man";

describe("kairos dau-man — câu phụ (E K3-03)", () => {
  it("khách chưa đăng nhập ⇒ hiện, bất kể dòng tin", () => {
    expect(hienCauPhu({ authReady: true, signedIn: false, trong: false })).toBe(true);
    expect(hienCauPhu({ authReady: true, signedIn: false, trong: null })).toBe(true);
  });
  it("đã đăng nhập: chỉ khi dòng tin TRỐNG", () => {
    expect(hienCauPhu({ authReady: true, signedIn: true, trong: true })).toBe(true);
    expect(hienCauPhu({ authReady: true, signedIn: true, trong: false })).toBe(false);
  });
  it("chưa biết (auth chưa sẵn / dòng tin chưa đọc máy) ⇒ KHÔNG hiện — header không nhảy", () => {
    expect(hienCauPhu({ authReady: false, signedIn: false, trong: null })).toBe(false);
    expect(hienCauPhu({ authReady: true, signedIn: true, trong: null })).toBe(false);
    expect(hienCauPhu({ authReady: false, signedIn: false, trong: true })).toBe(true);
  });
});

describe("kairos dau-man — pill Tải tin mang đi", () => {
  it("an ⇒ không vẽ", () => {
    expect(pillTaiMangDi("an")).toBeNull();
  });
  it("hien: chữ ngắn + Tải + ×; nhãn ≤2 chữ", () => {
    const p = pillTaiMangDi("hien")!;
    expect(p.chu).toBe("Tải bài đọc trên biển");
    expect(p.nut).toBe("Tải");
    expect(p.x).toBe(true);
    expect(p.dangTai).toBe(false);
  });
  it("dang: không nút, không × (không huỷ giữa chừng), có chấm nhịp", () => {
    const p = pillTaiMangDi("dang")!;
    expect(p.nut).toBeNull();
    expect(p.x).toBe(false);
    expect(p.dangTai).toBe(true);
  });
  it("loi: Thử lại + ×", () => {
    const p = pillTaiMangDi("loi")!;
    expect(p.nut).toBe("Thử lại");
    expect(p.x).toBe(true);
  });
  it("toast xong/đầy theo 14 §19", () => {
    expect(toastTaiMangDi({ kind: "xong", n: 87 })).toEqual({ text: "Đã tải 87 bài — mất sóng vẫn đọc được", loai: "tot" });
    expect(toastTaiMangDi({ kind: "xong", n: 0 }).loai).toBe("xau");
    expect(toastTaiMangDi({ kind: "day" })).toEqual({ text: "Máy đầy, chưa lưu được bài mang đi.", loai: "xau" });
  });
});
