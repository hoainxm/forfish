import { describe, it, expect } from "vitest";
import {
  kmToUnit,
  distUnitLabel,
  fmtDist,
  fmtLat,
  fmtLon,
  fmtCoordPair,
} from "@/lib/map-prefs";

describe("map-prefs đơn vị khoảng cách", () => {
  it("kmToUnit: km giữ nguyên, nm chia 1.852", () => {
    expect(kmToUnit(1.852, "km")).toBeCloseTo(1.852, 6);
    expect(kmToUnit(1.852, "nm")).toBeCloseTo(1, 6);
    expect(kmToUnit(100, "nm")).toBeCloseTo(53.9957, 3);
  });

  it("distUnitLabel + fmtDist", () => {
    expect(distUnitLabel("nm")).toBe("hải lý");
    expect(distUnitLabel("km")).toBe("km");
    expect(fmtDist(1.852, "nm")).toBe("1 hải lý");
    expect(fmtDist(100, "km")).toBe("100 km");
  });
});

describe("map-prefs hệ toạ độ", () => {
  it("dd: độ thập phân + bán cầu", () => {
    expect(fmtLat(8.5, "dd")).toBe("8,50°B");
    expect(fmtLat(-8.5, "dd")).toBe("8,50°N");
    expect(fmtLon(109.3, "dd")).toBe("109,30°Đ");
    expect(fmtLon(-109.3, "dd")).toBe("109,30°T");
  });

  it("dms: độ-phút lẻ 1 số, phần nguyên phút 2 chữ số", () => {
    expect(fmtLat(8.5, "dms")).toBe("8°30,0′B");
    expect(fmtLon(109.25, "dms")).toBe("109°15,0′Đ");
    // phút <10 vẫn 2 chữ số phần nguyên
    expect(fmtLat(10.09, "dms")).toBe("10°05,4′B");
    // âm → bán cầu Nam/Tây
    expect(fmtLat(-8.5, "dms")).toBe("8°30,0′N");
    expect(fmtLon(-109.25, "dms")).toBe("109°15,0′T");
    // 8,99999° → 59,99′ làm tròn 60,0′ tràn thành 9°00,0′
    expect(fmtLat(8.99999, "dms")).toBe("9°00,0′B");
  });

  it("fmtCoordPair ghép B · Đ", () => {
    expect(fmtCoordPair(8.5, 109.3, "dd")).toBe("8,50°B · 109,30°Đ");
    expect(fmtCoordPair(8.5, 109.3, "dms")).toBe("8°30,0′B · 109°18,0′Đ");
  });
});
