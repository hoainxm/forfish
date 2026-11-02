import { describe, it, expect } from "vitest";
import { parseOneCoord, parseCoordPair } from "@/lib/parse-coord";

describe("parseOneCoord", () => {
  it("độ thập phân, phẩy hoặc chấm", () => {
    expect(parseOneCoord("8,5", "lat")).toBeCloseTo(8.5, 6);
    expect(parseOneCoord("109.3", "lon")).toBeCloseTo(109.3, 6);
  });

  it("bỏ trống hướng → mặc định Bắc/Đông (dương)", () => {
    expect(parseOneCoord("8 30", "lat")).toBeCloseTo(8.5, 6);
    expect(parseOneCoord("109 18", "lon")).toBeCloseTo(109.3, 6);
  });

  it("độ-phút-giây", () => {
    expect(parseOneCoord("8 30 00", "lat")).toBeCloseTo(8.5, 6);
    expect(parseOneCoord("8 30 15", "lat")).toBeCloseTo(8 + 30 / 60 + 15 / 3600, 6);
  });

  it("có ký hiệu °′″", () => {
    expect(parseOneCoord("8°30′00″N", "lat")).toBeCloseTo(8.5, 6);
    expect(parseOneCoord("109°18′00″E", "lon")).toBeCloseTo(109.3, 6);
  });

  it("hướng Nam/Tây → âm (chữ quốc tế lẫn chữ Việt)", () => {
    expect(parseOneCoord("8 30 S", "lat")).toBeCloseTo(-8.5, 6);
    expect(parseOneCoord("8,5 Nam", "lat")).toBeCloseTo(-8.5, 6);
    expect(parseOneCoord("120 W", "lon")).toBeCloseTo(-120, 6);
    expect(parseOneCoord("120 Tây", "lon")).toBeCloseTo(-120, 6);
  });

  it("hướng Bắc/Đông → dương; Đông nhận cả D/Đ", () => {
    expect(parseOneCoord("8 30 N", "lat")).toBeCloseTo(8.5, 6);
    expect(parseOneCoord("109 D", "lon")).toBeCloseTo(109, 6);
    expect(parseOneCoord("109 Đông", "lon")).toBeCloseTo(109, 6);
  });

  it("dấu trừ = Nam/Tây", () => {
    expect(parseOneCoord("-8.5", "lat")).toBeCloseTo(-8.5, 6);
  });

  it("từ chối chữ hướng sai trục (E trong ô vĩ độ)", () => {
    expect(parseOneCoord("8 30 E", "lat")).toBeNull();
    expect(parseOneCoord("8 30 N", "lon")).toBeNull();
  });

  it("từ chối phút/giây ≥ 60", () => {
    expect(parseOneCoord("8 60", "lat")).toBeNull();
    expect(parseOneCoord("8 30 75", "lat")).toBeNull();
  });

  it("từ chối vượt khung (|vĩ|≤90, |kinh|≤180)", () => {
    expect(parseOneCoord("95", "lat")).toBeNull();
    expect(parseOneCoord("200", "lon")).toBeNull();
  });

  it("từ chối rỗng / rác / hai chữ hướng", () => {
    expect(parseOneCoord("", "lat")).toBeNull();
    expect(parseOneCoord("abc", "lat")).toBeNull();
    expect(parseOneCoord("8 N S", "lat")).toBeNull();
    expect(parseOneCoord("8 30 15 20", "lat")).toBeNull();
  });
});

describe("parseCoordPair", () => {
  it("cả hai ô hợp lệ → cặp toạ độ", () => {
    expect(parseCoordPair("8 30", "109 18")).toEqual({
      lat: expect.closeTo(8.5, 6),
      lon: expect.closeTo(109.3, 6),
    });
  });

  it("một ô sai → null", () => {
    expect(parseCoordPair("8 30", "abc")).toBeNull();
    expect(parseCoordPair("95", "109")).toBeNull();
  });
});

describe("kiểu dính liền độ-phút DDMM.m (máy GPS / VMS, rà 2026-11-02)", () => {
  it("vĩ 4 chữ số, kinh 4–5 chữ số", () => {
    expect(parseOneCoord("1507.2", "lat")).toBeCloseTo(15.12, 6);
    expect(parseOneCoord("1507.2N", "lat")).toBeCloseTo(15.12, 6);
    expect(parseOneCoord("10857.0", "lon")).toBeCloseTo(108.95, 6);
    expect(parseOneCoord("9930.5E", "lon")).toBeCloseTo(99.508333, 5);
    expect(parseOneCoord("0830.0S", "lat")).toBeNull(); // "0830" → 830 (3 chữ số) — không đoán
  });
  it("phút ≥60 hoặc số dài lạ ⇒ không đoán", () => {
    expect(parseOneCoord("1575.0", "lat")).toBeNull();
    expect(parseOneCoord("123456", "lat")).toBeNull();
    expect(parseOneCoord("95", "lat")).toBeNull();
  });
  it("độ thập phân thường không bị đọc nhầm thành dính liền", () => {
    expect(parseOneCoord("15.12", "lat")).toBe(15.12);
    expect(parseOneCoord("108.95", "lon")).toBe(108.95);
  });
});
