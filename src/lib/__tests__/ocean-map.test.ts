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

  it("có lớp dữ liệu → thêm source ocean-data với ngày đã trừ độ trễ", () => {
    const style = buildMapStyle("sst", now);
    const src = style.sources["ocean-data"] as { tiles: string[] };
    expect(src.tiles[0]).toContain("/2026-06-08/");
    // thứ tự: mask < lớp dữ liệu < phao đèn
    const ids = (style.layers as { id: string }[]).map((l) => l.id);
    expect(ids.indexOf("ocean-data")).toBeGreaterThan(ids.indexOf("sea-mask"));
    expect(ids.indexOf("seamarks")).toBeGreaterThan(ids.indexOf("ocean-data"));
  });
});
