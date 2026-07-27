import { describe, expect, it } from "vitest";
import {
  isTileProxySource,
  proxyTileTemplate,
  TILE_PROXY,
  upstreamTileUrl,
} from "../tile-proxy";

describe("upstreamTileUrl — danh sách trắng", () => {
  it("nguồn hợp lệ → URL đúng nhà cung cấp", () => {
    expect(upstreamTileUrl("chart", 6, 51, 28)).toBe(
      "https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/6/51/28.png",
    );
    expect(upstreamTileUrl("seamark", 9, 411, 229)).toBe(
      "https://tiles.openseamap.org/seamark/9/411/229.png",
    );
  });

  it("KHÔNG thành proxy mở: tên nguồn lạ / URL nhét vào đều bị chặn", () => {
    expect(upstreamTileUrl("evil", 6, 1, 1)).toBeNull();
    expect(upstreamTileUrl("https://evil.example/a.png", 6, 1, 1)).toBeNull();
    expect(upstreamTileUrl("__proto__", 6, 1, 1)).toBeNull();
    expect(upstreamTileUrl("constructor", 6, 1, 1)).toBeNull();
  });

  it("chặn z/x/y vô lý (âm, vượt số ô của mức zoom, không nguyên)", () => {
    expect(upstreamTileUrl("chart", 6, -1, 1)).toBeNull();
    expect(upstreamTileUrl("chart", 6, 64, 1)).toBeNull(); // z6 chỉ có 0..63
    expect(upstreamTileUrl("chart", 6, 1, 64)).toBeNull();
    expect(upstreamTileUrl("chart", 6.5, 1, 1)).toBeNull();
    expect(upstreamTileUrl("chart", Number.NaN, 1, 1)).toBeNull();
  });

  it("ngoài dải zoom của nguồn → null (đỡ gọi vô ích)", () => {
    expect(upstreamTileUrl("chart", 13, 1, 1)).toBeNull();
    expect(upstreamTileUrl("seamark", 7, 1, 1)).toBeNull();
    expect(upstreamTileUrl("seamark", 8, 1, 1)).not.toBeNull();
  });
});

describe("proxyTileTemplate", () => {
  it("mẫu XYZ same-origin cho MapLibre", () => {
    expect(proxyTileTemplate("chart")).toBe("/api/tiles/chart/{z}/{x}/{y}");
    expect(proxyTileTemplate("seamark")).toBe("/api/tiles/seamark/{z}/{x}/{y}");
  });
});

describe("TILE_PROXY", () => {
  it("chỉ nguồn MỞ cho phép cache lại — không có nền Carto", () => {
    for (const def of Object.values(TILE_PROXY)) {
      expect(def.upstream(1, 1, 1)).not.toContain("cartocdn");
      expect(def.sMaxAge).toBeGreaterThan(0);
    }
    expect(isTileProxySource("basemap")).toBe(false);
  });
});
