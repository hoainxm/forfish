import { describe, expect, it } from "vitest";
import {
  buildMapStyle,
  formatDateVN,
  latestAvailableDate,
  OCEAN_LAYERS,
} from "../ocean-map";

describe("latestAvailableDate", () => {
  it("lùi đúng số ngày theo UTC", () => {
    expect(latestAvailableDate(new Date("2026-06-10T12:00:00Z"), 2)).toBe(
      "2026-06-08",
    );
  });

  it("lùi qua đầu tháng / đầu năm", () => {
    expect(latestAvailableDate(new Date("2026-06-01T00:00:00Z"), 2)).toBe(
      "2026-05-30",
    );
    expect(latestAvailableDate(new Date("2026-01-01T05:00:00Z"), 3)).toBe(
      "2025-12-29",
    );
  });

  it("pad số 0 cho tháng/ngày một chữ số", () => {
    expect(latestAvailableDate(new Date("2026-03-05T00:00:00Z"), 1)).toBe(
      "2026-03-04",
    );
  });
});

describe("formatDateVN", () => {
  it("bỏ số 0 thừa: 2026-06-08 → 8/6", () => {
    expect(formatDateVN("2026-06-08")).toBe("8/6");
    expect(formatDateVN("2026-12-25")).toBe("25/12");
  });
});

describe("OCEAN_LAYERS", () => {
  it("lớp theo ngày chứa đúng ngày trong URL; mọi lớp đủ placeholder z/x/y", () => {
    for (const def of Object.values(OCEAN_LAYERS)) {
      const url = def.tiles("2026-06-08");
      if (def.dated) expect(url).toContain("/2026-06-08/");
      expect(url).toContain("{z}");
      expect(url).toContain("{y}");
      expect(url).toContain("{x}");
    }
  });

  it("lớp độ sâu là lớp tĩnh, vẽ đặc (tự đứng được)", () => {
    expect(OCEAN_LAYERS.bathymetry.dated).toBe(false);
    expect(OCEAN_LAYERS.bathymetry.opacity).toBe(1);
  });
});

describe("buildMapStyle", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("không có lớp dữ liệu → basemap + mask chủ quyền + phao đèn", () => {
    const style = buildMapStyle(null, now);
    expect(Object.keys(style.sources)).toEqual([
      "basemap",
      "sea-mask",
      "seamarks",
    ]);
    expect(style.layers).toHaveLength(3);
  });

  it("tắt phao đèn → không có source seamarks; ranh giới/nhãn không có công tắc", () => {
    const style = buildMapStyle("sst", now, { seamarks: false });
    expect(Object.keys(style.sources)).not.toContain("seamarks");
  });

  it("có lớp dữ liệu → thêm source ocean-data với ngày đã trừ độ trễ", () => {
    const style = buildMapStyle("sst", now);
    const src = style.sources["ocean-data"] as { tiles: string[] };
    expect(src.tiles[0]).toContain("/2026-06-08/");
    // thứ tự: mask < lớp dữ liệu < phao đèn
    const ids = (style.layers as { id: string }[]).map((l) => l.id);
    expect(ids.indexOf("ocean-data")).toBeGreaterThan(ids.indexOf("sea-mask"));
    expect(ids.indexOf("seamarks")).toBeGreaterThan(ids.indexOf("ocean-data"));
  });

  it("mask mờ dần rồi tắt khi zoom gần bờ (không che luồng lạch)", () => {
    const style = buildMapStyle("bathymetry", now);
    const mask = (style.layers as { id: string; paint?: Record<string, unknown> }[]).find(
      (l) => l.id === "sea-mask",
    )!;
    const op = mask.paint?.["fill-opacity"] as unknown[];
    // biểu thức interpolate: đặc ở z6, tắt ở z8
    expect(Array.isArray(op)).toBe(true);
    expect(op).toContain(6);
    expect(op).toContain(8);
  });

  it("nền hải đồ có đường đẳng sâu + nhãn số mét (style có glyphs)", () => {
    const style = buildMapStyle("bathymetry", now) as unknown as {
      glyphs?: string;
      sources: Record<string, unknown>;
      layers: { id: string; type: string }[];
    };
    expect(style.glyphs).toContain("fonts");
    expect(Object.keys(style.sources)).toContain("isobaths");
    expect(style.layers.some((l) => l.id === "isobath-lines")).toBe(true);
    expect(
      style.layers.find((l) => l.id === "isobath-labels")?.type,
    ).toBe("symbol");
    // nền vệ tinh thì KHÔNG vẽ đẳng sâu (rối)
    const sst = buildMapStyle("sst", now);
    expect(Object.keys(sst.sources)).not.toContain("isobaths");
  });

  it("lớp ảnh/độ sâu nhả ra khi zoom sâu (z>12); phao đèn hiện từ z8", () => {
    const style = buildMapStyle("bathymetry", now);
    const layers = style.layers as { id: string; maxzoom?: number; minzoom?: number }[];
    expect(layers.find((l) => l.id === "ocean-data")?.maxzoom).toBe(12);
    expect(layers.find((l) => l.id === "seamarks")?.minzoom).toBe(8);
    const src = style.sources["seamarks"] as { minzoom: number };
    expect(src.minzoom).toBe(8);
  });
});
