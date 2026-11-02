import { describe, expect, it } from "vitest";
import { ghepToaDo, laDauNgan, locSo, nenNhay, tachToaDo } from "@/lib/o-toa-do";
import { parseOneCoord } from "@/lib/parse-coord";

describe("nenNhay — gõ đủ thì sang ô kế", () => {
  it("vĩ độ: 2 chữ số, hoặc chữ số đầu đã chắc vượt trần", () => {
    expect(nenNhay("1", "d", "lat")).toBe(false);
    expect(nenNhay("15", "d", "lat")).toBe(true);
    expect(nenNhay("8", "d", "lat")).toBe(false); // còn gõ 80–89 được — chờ, hoặc gõ dấu ngăn
  });
  it("kinh độ: 3 chữ số", () => {
    expect(nenNhay("10", "d", "lon")).toBe(false);
    expect(nenNhay("108", "d", "lon")).toBe(true);
  });
  it("phút/giây: 2 chữ số, hoặc 6–9 ở đầu (6x > 59)", () => {
    expect(nenNhay("0", "m", "lat")).toBe(false);
    expect(nenNhay("07", "m", "lat")).toBe(true);
    expect(nenNhay("7", "m", "lat")).toBe(true);
    expect(nenNhay("5", "s", "lat")).toBe(false);
  });
  it("giây có phần lẻ ⇒ không tự nhảy", () => {
    expect(nenNhay("12,", "s", "lat")).toBe(false);
  });
});

describe("locSo · laDauNgan", () => {
  it("chỉ giữ số; giây cho một dấu phẩy", () => {
    expect(locSo("1a5°", "d")).toBe("15");
    expect(locSo("12.5.3", "s")).toBe("12,53");
  });
  it("dấu ngăn thường gặp", () => {
    for (const c of [" ", ".", ",", "°", "'", "″", "-"]) expect(laDauNgan(c)).toBe(true);
    expect(laDauNgan("5")).toBe(false);
  });
});

describe("ghep ⇄ tach — khớp luật đọc chung parseOneCoord", () => {
  it("ba ô ⇒ chuỗi đọc được, đúng hướng", () => {
    const s = ghepToaDo({ d: "15", m: "07", s: "12", am: false }, "lat");
    expect(parseOneCoord(s, "lat")).toBeCloseTo(15.12, 6);
    expect(parseOneCoord(ghepToaDo({ d: "8", m: "30", s: "", am: true }, "lat"), "lat")).toBeCloseTo(-8.5, 6);
    expect(parseOneCoord(ghepToaDo({ d: "108", m: "57", s: "", am: false }, "lon"), "lon")).toBeCloseTo(108.95, 6);
    expect(ghepToaDo({ d: "", m: "", s: "", am: false }, "lat")).toBe("");
  });
  it("tách chuỗi điền sẵn (độ thập phân hoặc độ-phút-giây)", () => {
    expect(tachToaDo("15,12", "lat")).toEqual({ d: "15", m: "07", s: "12", am: false });
    expect(tachToaDo(`108°57'00"E`, "lon")).toEqual({ d: "108", m: "57", s: "00", am: false });
    expect(tachToaDo("", "lat")).toEqual({ d: "", m: "", s: "", am: false });
    expect(tachToaDo("abc", "lat")).toBeNull();
  });
});
