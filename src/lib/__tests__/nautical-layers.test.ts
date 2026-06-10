import { describe, expect, it } from "vitest";
import {
  bboxString,
  openseamapContourGetMapUrl,
  tileToBbox3857,
} from "../nautical-layers";

describe("tileToBbox3857", () => {
  it("z=0 tile=0,0 phủ toàn thế giới (±ORIGIN)", () => {
    const b = tileToBbox3857(0, 0, 0);
    expect(b.minX).toBeCloseTo(-20037508.34, -2);
    expect(b.maxX).toBeCloseTo(20037508.34, -2);
    expect(b.minY).toBeCloseTo(-20037508.34, -2);
    expect(b.maxY).toBeCloseTo(20037508.34, -2);
  });
  it("z=1 chia thế giới thành 4 ô — top-left dương Y", () => {
    const tl = tileToBbox3857(1, 0, 0);
    expect(tl.maxY).toBeCloseTo(20037508.34, -2);
    expect(tl.minY).toBeCloseTo(0, -2);
    expect(tl.minX).toBeCloseTo(-20037508.34, -2);
    expect(tl.maxX).toBeCloseTo(0, -2);
  });
  it("z=5 quanh tile vịnh Bắc Bộ → BBOX nằm trong vùng Biển Đông", () => {
    // tile (26,14) ở z=5 rơi vào quanh kinh độ 112°E, vĩ độ ~22°N
    const b = tileToBbox3857(5, 26, 14);
    // chuyển ngược về độ để kiểm tra (Web Mercator)
    const ORIGIN = 20037508.342789244;
    const lonW = (b.minX / ORIGIN) * 180;
    const lonE = (b.maxX / ORIGIN) * 180;
    expect(lonW).toBeGreaterThan(100);
    expect(lonE).toBeLessThan(125);
  });
});

describe("openseamapContourGetMapUrl", () => {
  const url = openseamapContourGetMapUrl(5, 26, 14);
  it("đúng host + path WMS", () => {
    expect(url).toMatch(/^https:\/\/depth\.openseamap\.org\/geoserver\/openseamap\/wms/);
  });
  it("layer = openseamap:contour", () => {
    expect(url).toContain("LAYERS=openseamap%3Acontour");
  });
  it("CRS = EPSG:3857 + WIDTH/HEIGHT = 256", () => {
    expect(url).toContain("CRS=EPSG%3A3857");
    expect(url).toContain("WIDTH=256");
    expect(url).toContain("HEIGHT=256");
  });
});

describe("bboxString", () => {
  it("ghép minLat,minLng,maxLat,maxLng — kiểu Overpass", () => {
    expect(
      bboxString({ minLat: 6, minLng: 102, maxLat: 24, maxLng: 118 }),
    ).toBe("6,102,24,118");
  });
});
