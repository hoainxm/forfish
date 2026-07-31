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
  it("dd: độ thập phân + bán cầu N/S/E/W quốc tế", () => {
    expect(fmtLat(8.5, "dd")).toBe("8,50°N");
    expect(fmtLat(-8.5, "dd")).toBe("8,50°S");
    expect(fmtLon(109.3, "dd")).toBe("109,30°E");
    expect(fmtLon(-109.3, "dd")).toBe("109,30°W");
  });

  it("dms: độ-phút-giây, phút/giây 2 chữ số", () => {
    expect(fmtLat(8.5, "dms")).toBe("8°30′00″N");
    expect(fmtLon(109.25, "dms")).toBe("109°15′00″E");
    // phút/giây <10 vẫn 2 chữ số
    expect(fmtLat(10.09, "dms")).toBe("10°05′24″N");
    // âm → bán cầu S/W
    expect(fmtLat(-8.5, "dms")).toBe("8°30′00″S");
    expect(fmtLon(-109.25, "dms")).toBe("109°15′00″W");
    // tràn: 8,999999° → 59′59,996″ làm tròn lên phải thành 9°00′00″, KHÔNG 8°59′60″
    expect(fmtLat(8.999999, "dms")).toBe("9°00′00″N");
    // tràn giây trong phút: 8,50999° → 30′35,96″ → 30′36″
    expect(fmtLat(8.50999, "dms")).toBe("8°30′36″N");
  });

  it("fmtCoordPair ghép vĩ · kinh", () => {
    expect(fmtCoordPair(8.5, 109.3, "dd")).toBe("8,50°N · 109,30°E");
    expect(fmtCoordPair(8.5, 109.3, "dms")).toBe("8°30′00″N · 109°18′00″E");
  });
});
