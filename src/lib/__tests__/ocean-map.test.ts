import { describe, expect, it } from "vitest";
import {
  buildMapStyle,
  formatDateVN,
  latestAvailableDate,
  OCEAN_LAYERS,
  OFFLINE_COAST_BEFORE_ID,
  SEA_MASK_COLOR,
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

  it("không có lớp dữ liệu → nền VECTOR pmtiles + mask chủ quyền + phao đèn", () => {
    const style = buildMapStyle(null, now);
    expect(Object.keys(style.sources)).toEqual([
      "basemap",
      "sea-mask",
      "seamarks",
    ]);
    // nền nay là VECTOR pmtiles same-origin (không key CARTO, không host ngoài)
    const bm = style.sources.basemap as { type: string; url?: string };
    expect(bm.type).toBe("vector");
    expect(bm.url).toContain("pmtiles://");
    expect(JSON.stringify(style.sources)).not.toContain("cartocdn");
    // khung sườn giữ nguyên + nền Protomaps thêm nhiều lớp HÌNH HỌC
    const ids = (style.layers as { id: string }[]).map((l) => l.id);
    expect(ids[0]).toBe("sea-bg");
    expect(ids).toContain("sea-mask");
    expect(ids).toContain(OFFLINE_COAST_BEFORE_ID);
    expect(ids).toContain("seamarks");
    expect(style.layers.length).toBeGreaterThan(20);
  });

  it("CHỐT CHỦ QUYỀN: nền KHÔNG lớp symbol nào (không nhãn OSM → KHÔNG THỂ lọt chữ Trung)", () => {
    for (const l of ["bathymetry", "sst", null] as const) {
      const layers = buildMapStyle(l, now).layers as {
        type: string;
        source?: string;
      }[];
      const basemapSymbols = layers.filter(
        (x) => x.source === "basemap" && x.type === "symbol",
      );
      expect(basemapSymbols).toEqual([]);
    }
  });

  it("mốc chèn bờ offline nằm SAU mask, TRƯỚC mọi lớp nội dung", () => {
    // Chèn dưới sea-mask = xoá Hoàng Sa/Trường Sa lúc mất sóng (mask tô kín ô
    // biển ở mức toàn cảnh) — mốc phải nằm ngay TRÊN mask.
    const ids = (buildMapStyle("sst", now).layers as { id: string }[]).map(
      (l) => l.id,
    );
    expect(ids.indexOf(OFFLINE_COAST_BEFORE_ID)).toBeGreaterThan(
      ids.indexOf("sea-mask"),
    );
    expect(ids.indexOf(OFFLINE_COAST_BEFORE_ID)).toBeLessThan(
      ids.indexOf("ocean-data"),
    );
  });

  it("lớp NỀN NƯỚC vẽ đầu tiên — mất sóng không được ra màn hình trắng", () => {
    const layers = buildMapStyle(null, now).layers as {
      id: string;
      type: string;
      paint?: Record<string, unknown>;
    }[];
    expect(layers[0].id).toBe("sea-bg");
    expect(layers[0].type).toBe("background");
    expect(layers[0].paint?.["background-color"]).toBe(SEA_MASK_COLOR);
  });

  it("font chữ bản đồ TỰ HOST (same-origin) — mất sóng vẫn còn số mét", () => {
    const style = buildMapStyle("bathymetry", now) as unknown as {
      glyphs: string;
    };
    expect(style.glyphs.startsWith("/fonts/")).toBe(true);
    expect(style.glyphs).not.toContain("://");
  });

  it("hải đồ + phao đèn đi qua cầu same-origin (service worker giữ được)", () => {
    const style = buildMapStyle("bathymetry", now);
    const chart = style.sources["ocean-data"] as { tiles: string[] };
    const marks = style.sources["seamarks"] as { tiles: string[] };
    expect(chart.tiles[0]).toBe("/api/tiles/chart/{z}/{x}/{y}");
    expect(marks.tiles[0]).toBe("/api/tiles/seamark/{z}/{x}/{y}");
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

/*
  CỔNG STYLE HỢP LỆ — chạy CHÍNH bộ kiểm của MapLibre trên style app dựng ra.

  Vì sao cần (2026-08-29): lớp đẳng sâu nay lọc bằng biểu thức có `["zoom"]`
  ĐẶT TRONG `filter`. Đó là chỗ MapLibre có luật riêng (chỉ tính lại ở mức zoom
  NGUYÊN, và không phải ngữ cảnh nào cũng cho phép) — viết sai thì style KHÔNG
  ném lỗi ồn ào, nó chỉ lặng lẽ BỎ QUA cả lớp: bản đồ mất sạch đường đẳng sâu
  giữa biển mà không một dòng lỗi nào. Test bằng mắt không bắt được vì ở zoom
  thấp lớp vốn đã ẩn theo thiết kế.

  `validateStyleMin` là bộ kiểm của chính thư viện, nên nó biết luật thật —
  không phải bản chép tay của mình đoán lại.
*/
describe("style dựng ra phải HỢP LỆ với chính MapLibre", () => {
  it("không lỗi ở mọi tổ hợp lớp", async () => {
    const { validateStyleMin } = await import(
      "@maplibre/maplibre-gl-style-spec"
    );
    const now = new Date("2026-06-10T12:00:00Z");
    for (const layerId of ["bathymetry", "sst", "chlorophyll", null] as const) {
      for (const seamarks of [true, false]) {
        const style = buildMapStyle(layerId, now, { seamarks });
        const errs = validateStyleMin(
          style as Parameters<typeof validateStyleMin>[0],
        );
        expect(
          errs.map((e) => `${e.message}`),
          `style lỗi ở layerId=${layerId} seamarks=${seamarks}`,
        ).toEqual([]);
      }
    }
  });

  it("ĐẲNG SÂU: mức càng nông càng đòi zoom gần — số mét hiện sau đường", () => {
    const style = buildMapStyle("bathymetry", new Date("2026-06-10T12:00:00Z"));
    const layers = style.layers as { id: string; filter?: unknown }[];
    const line = layers.find((l) => l.id === "isobath-lines");
    const label = layers.find((l) => l.id === "isobath-labels");
    // đường và nhãn phải CÙNG luật, chỉ lệch một nấc — lệch luật là nhãn
    // treo lơ lửng ở mức không còn đường
    const zooms = (f: unknown) =>
      JSON.stringify(f).match(/\d+(?=[,\]])/g)?.map(Number) ?? [];
    expect(zooms(line?.filter)).toEqual([10, 10, 20, 9, 100, 7, 5]);
    expect(zooms(label?.filter)).toEqual([10, 11, 20, 10, 100, 8, 6]);
  });
});
