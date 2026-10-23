import { describe, it, expect } from "vitest";
import { viTriTheNoi } from "@/lib/the-noi-vi-tri";

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
