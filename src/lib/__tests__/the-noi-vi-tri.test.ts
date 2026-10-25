import { describe, it, expect } from "vitest";
import { viTriNeoNut, viTriTheNoi } from "@/lib/the-noi-vi-tri";

const khung = { w: 240, h: 160, pw: 375, ph: 700 };

describe("viTriTheNoi — thẻ nổi bản đồ kẹp theo khung bản đồ thật", () => {
  it("giữa khung: canh giữa điểm chạm, nằm dưới 12px", () => {
    expect(viTriTheNoi({ ...khung, x: 187, y: 200 })).toEqual({ left: 67, top: 212, tren: false });
  });
  it("sát mép phải/trái: kẹp cách mép 8px, không tràn khỏi khung", () => {
    expect(viTriTheNoi({ ...khung, x: 370, y: 200 }).left).toBe(375 - 240 - 8);
    expect(viTriTheNoi({ ...khung, x: 5, y: 200 }).left).toBe(8);
  });
  it("khung rộng 480 (máy tính) chứ không theo cửa sổ 1440 — mép phải là khung", () => {
    expect(viTriTheNoi({ ...khung, pw: 480, x: 470, y: 100 }).left).toBe(480 - 240 - 8);
  });
  it("sát đáy: lật lên trên điểm chạm", () => {
    expect(viTriTheNoi({ ...khung, x: 187, y: 650 })).toEqual({ left: 67, top: 650 - 12 - 160, tren: true });
  });
  it("thẻ cao hơn cả trên lẫn dưới: kẹp trong khung", () => {
    const v = viTriTheNoi({ ...khung, h: 600, x: 187, y: 350 });
    expect(v.top).toBeGreaterThanOrEqual(8);
    expect(v.top + 600).toBeLessThanOrEqual(700 - 8);
  });
  it("thẻ rộng hơn khung: dính lề trái, không âm", () => {
    expect(viTriTheNoi({ ...khung, w: 400, x: 187, y: 100 }).left).toBe(8);
  });
});

describe("viTriNeoNut — lớp nổi mở từ nút nằm NGAY CẠNH nút (03 §6 mục 9)", () => {
  const khung = { pw: 375, ph: 740 };
  it("nút góc trên-phải (Lớp bản đồ): hiện NGAY DƯỚI, mép phải thẳng mép phải nút", () => {
    const v = viTriNeoNut({ ...khung, nut: { left: 323, top: 8, right: 367, bottom: 52 }, w: 240, h: 300 });
    expect(v).toMatchObject({ top: 58, tren: false, canhPhai: true });
    expect(v.left).toBe(367 - 240);
  });
  it("nút góc trên-trái: canh mép trái nút", () => {
    const v = viTriNeoNut({ ...khung, nut: { left: 16, top: 8, right: 140, bottom: 52 }, w: 220, h: 200 });
    expect(v.left).toBe(16);
    expect(v.canhPhai).toBe(false);
  });
  it("nút sát đáy: lật LÊN trên nút", () => {
    const v = viTriNeoNut({ ...khung, nut: { left: 200, top: 650, right: 300, bottom: 694 }, w: 200, h: 180 });
    expect(v.tren).toBe(true);
    expect(v.top).toBe(650 - 6 - 180);
  });
  it("cả hai phía đều chật: chọn phía rộng hơn, trả maxH để cuộn, không tràn khung", () => {
    const v = viTriNeoNut({ ...khung, nut: { left: 100, top: 300, right: 200, bottom: 344 }, w: 200, h: 900 });
    expect(v.tren).toBe(false); // dưới 390px > trên 286px
    expect(v.maxH).toBe(740 - 8 - 350);
    expect(v.top + Math.min(900, v.maxH)).toBeLessThanOrEqual(740 - 8);
  });
  it("lớp nổi rộng hơn chỗ trống bên trái nút: kẹp cách mép 8px", () => {
    const v = viTriNeoNut({ ...khung, nut: { left: 330, top: 8, right: 370, bottom: 52 }, w: 360, h: 100 });
    expect(v.left).toBe(8);
  });
});
