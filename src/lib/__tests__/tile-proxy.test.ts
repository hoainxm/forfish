import { describe, expect, it } from "vitest";
import {
  isTileProxySource,
  proxyTileTemplate,
  TILE_PROXY,
  upstreamTileUrl,
  upstreamTileUrls,
  isPlaceholderTile,
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

  it("ảnh NASA GIBS: ngày `default` (không nhúng ngày), thứ tự WMTS {z}/{y}/{x}, trần z7", () => {
    for (const src of ["sst", "chlorophyll"] as const) {
      const u = upstreamTileUrl(src, 6, 51, 28)!;
      expect(u).toContain("gibs.earthdata.nasa.gov");
      expect(u).toContain("/default/default/");
      expect(u).not.toMatch(/\/\d{4}-\d{2}-\d{2}\//);
      expect(u.endsWith("/6/28/51.png")).toBe(true);
      expect(upstreamTileUrl(src, 8, 1, 1)).toBeNull();
      expect(TILE_PROXY[src].daily).toBe(true);
    }
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

describe("upstreamTileUrls — ngày dự phòng cho ảnh NASA (2026-11-04, bản đồ vuông loang lổ)", () => {
  const now = new Date("2026-11-04T13:00:00Z");

  it("nguồn tĩnh: đúng một URL, không đụng ngày", () => {
    expect(upstreamTileUrls("chart", 6, 51, 28, now)).toEqual([upstreamTileUrl("chart", 6, 51, 28)]);
    expect(upstreamTileUrls("seamark", 9, 411, 229, now)).toHaveLength(1);
  });

  it("phù du: BỎ `default` (= hôm nay chưa xử lý ⇒ ô giả xám), lùi từ hôm qua theo ngày UTC", () => {
    const u = upstreamTileUrls("chlorophyll", 5, 25, 14, now)!;
    expect(u.some((x) => x.includes("/default/default/"))).toBe(false);
    expect(u[0]).toContain("/default/2026-11-03/GoogleMapsCompatible_Level7/5/14/25.png");
    expect(u.at(-1)).toContain("/2026-10-28/");
    expect(u).toHaveLength(TILE_PROXY.chlorophyll.dates!.backDays);
  });

  it("nước nóng lạnh: `default` trước, rồi lùi ngày làm dự phòng", () => {
    const u = upstreamTileUrls("sst", 5, 25, 14, now)!;
    expect(u[0]).toContain("/default/default/");
    expect(u[1]).toContain("/default/2026-11-03/");
  });

  it("ngày lấy theo UTC, không theo giờ máy (01:00 giờ VN vẫn là ngày UTC hôm trước)", () => {
    const u = upstreamTileUrls("chlorophyll", 5, 25, 14, new Date("2026-11-04T18:30:00Z"))!;
    expect(u[0]).toContain("/2026-11-03/");
  });

  it("ô vô lý / nguồn lạ → null như upstreamTileUrl", () => {
    expect(upstreamTileUrls("chlorophyll", 8, 1, 1, now)).toBeNull();
    expect(upstreamTileUrls("evil", 5, 1, 1, now)).toBeNull();
  });

  it("nhận ra ô giả GIBS qua etag (cả dạng có ngoặc kép / W/)", () => {
    expect(isPlaceholderTile("1000000000000")).toBe(true);
    expect(isPlaceholderTile('"1000000000000"')).toBe(true);
    expect(isPlaceholderTile('W/"1000000000000"')).toBe(true);
    expect(isPlaceholderTile("k0h51krhsb020")).toBe(false);
    expect(isPlaceholderTile(null)).toBe(false);
  });
});

describe("SW tileFirst — không tự đục lỗ vuông", () => {
  it("không trả 204 khi chậm/lỗi mà máy chưa có ô (MapLibre giữ 204 như ô đã tải, không xin lại)", async () => {
    const { readFileSync } = await import("node:fs");
    const sw = readFileSync("public/sw.js", "utf8");
    const body = sw.slice(sw.indexOf("function tileFirst("), sw.indexOf("ĐIỀU HƯỚNG: đua MẠNG"));
    expect(body.length).toBeGreaterThan(100);
    expect(body).not.toMatch(/status:\s*204/);
    expect(body).toMatch(/cachedOr\(\(\) => net\)/);
  });
});
