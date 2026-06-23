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

  it("dms: độ-phút, phút 2 chữ số", () => {
    expect(fmtLat(8.5, "dms")).toBe("8°30′B");
    expect(fmtLon(109.25, "dms")).toBe("109°15′Đ");
    // 8,999° → 8°59,94′ ≈ 60′ tràn thành 9°00′
    expect(fmtLat(8.999, "dms")).toBe("9°00′B");
  });

  it("fmtCoordPair ghép B · Đ", () => {
    expect(fmtCoordPair(8.5, 109.3, "dd")).toBe("8,50°B · 109,30°Đ");
  });
});
