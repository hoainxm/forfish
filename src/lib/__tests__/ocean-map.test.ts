import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as oceanMap from "../ocean-map";
import {
  buildMapStyle,
  formatDateVN,
  latestAvailableDate,
  OCEAN_LAYERS,
  OFFLINE_COAST_BEFORE_ID,
  SEA_MASK_COLOR,
  SEA_CABLE_COLOR,
  SEA_CABLE_OPACITY,
  SEA_RESTRICTED_COLOR,
  SEA_RESTRICTED_OPACITY,
  PIPELINE_COLOR,
  PIPELINE_OPACITY,
  PIPELINE_DASH,
  SEA_CABLE_DASH,
  RESTRICTED_FILL_COLOR,
  RESTRICTED_FILL_OPACITY,
  RESTRICTED_LABEL_COLOR,
  REEF_SHAPE_FILL,
  REEF_SHAPE_FILL_OPACITY,
  REEF_SHAPE_LINE,
  REEF_SHAPE_LINE_OPACITY,
  CHAT_DAY_COLORS,
  CHAT_DAY_OPACITY,
  DEPTH_BANDS,
  SAFETY_CONTOUR_M,
  SAFETY_CONTOUR_STYLE,
  SEA_CABLE_MINZOOM,
  SEA_PIPELINE_MINZOOM,
  CABLE_LANDING_MINZOOM,
  SEA_RESTRICTED_MINZOOM,
  SEA_FAIRWAY_MINZOOM,
  KHU_TRU_BAO_MINZOOM,
  WRECK_LAYER,
  LIGHTHOUSE_LAYER,
} from "../ocean-map";
import { CHART_ICON_BASE_PX, CHART_ICON_MIN_PX } from "../chart-symbols";

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
    /*  ĐỔI PHÉP ĐO (2026-08-30): trước đây khẳng định "> 20 lớp" — lấy SỐ LƯỢNG
        làm bằng chứng cho "nền còn hình học". Phép đo đó sai bản chất, và sau
        khi cắt 30 lớp chết + 10 lớp `landuse` (0 pixel đổi) thì nó đỏ oan.
        Nay kiểm ĐÚNG THỨ CẦN: các lớp hình học sống-còn phải có mặt, và những
        lớp đã cố ý cắt phải KHÔNG có. Cắt nhầm `earth` là mất hình đất/đảo —
        đó mới là thứ đáng canh, không phải con số 20. */
    const baseLayers = (
      style.layers as { id: string; "source-layer"?: string }[]
    ).filter((l) => !!l["source-layer"]);
    for (const need of ["earth", "water"]) {
      expect(
        baseLayers.some((l) => l["source-layer"] === need),
        `nền thiếu lớp hình học '${need}' — mất hình đất/nước`,
      ).toBe(true);
    }
    expect(
      baseLayers.filter((l) => l.id.startsWith("landuse_")),
      "landuse đã cố ý cắt (chủ quyền + tốc độ) — xem BASEMAP_DEAD_LAYERS",
    ).toEqual([]);
    expect(
      baseLayers.filter((l) => /roads_(tunnels|bridges)/.test(l.id)),
      "lớp cầu/hầm chết ở nền z0–9 — đã cắt",
    ).toEqual([]);
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

/*
  CỔNG TƯƠNG PHẢN — nét hải đồ phải đọc được dưới NẮNG CHÓI trên tàu lắc.

  Vì sao cần cổng máy chứ không phải quy ước trong comment (2026-08-29): lỗi
  vừa bắt được KHÔNG nằm ở màu. `#3d6e96` đặc trên nền nước đạt 4,28:1, thừa
  chuẩn. Thủ phạm là `line-opacity` — pha 0,55 thì 45% nền nước trộn vào nét,
  màu THỰC TẾ rơi xuống 2,06:1, dưới ngưỡng 3:1 của WCAG cho nét đồ hoạ.

  Kiểu lỗi này vô hình với mọi cách soát thông thường: đọc code thấy màu đẹp,
  nhìn màn hình trong phòng máy lạnh thấy ổn, chỉ ra biển nắng mới thấy mất
  nét. Nên phải TÍNH, và phải tính SAU KHI pha độ mờ.
*/
describe("tương phản nét hải đồ (tính sau khi pha độ mờ)", () => {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c: number[]) => {
    const s = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const ratio = (a: number[], b: number[]) => {
    const [l1, l2] = [lum(a), lum(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const blend = (fg: number[], bg: number[], a: number) =>
    fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));

  it("đường đẳng sâu đạt ≥3:1 SAU KHI pha độ mờ", () => {
    const style = buildMapStyle("bathymetry", new Date("2026-06-10T12:00:00Z"));
    const line = (style.layers as { id: string; paint?: Record<string, unknown> }[]).find(
      (l) => l.id === "isobath-lines",
    );
    const color = line?.paint?.["line-color"] as string;
    const opacity = line?.paint?.["line-opacity"] as number;
    expect(typeof color, "line-color phải là hex đơn, không phải biểu thức").toBe("string");
    expect(typeof opacity, "line-opacity phải là số đơn").toBe("number");
    const effective = ratio(blend(hex(color), hex(SEA_MASK_COLOR), opacity), hex(SEA_MASK_COLOR));
    expect(
      effective,
      `nét đẳng sâu chỉ đạt ${effective.toFixed(2)}:1 sau khi pha ${opacity} — dưới sàn 3:1. ` +
        `ĐỪNG đổi màu: ${color} đặc đã đủ tương phản, hãy nâng line-opacity.`,
    ).toBeGreaterThanOrEqual(3);
  });

  it("phép đo không rỗng — bắt được đúng cấu hình đã gây lỗi", () => {
    // 0,55 là giá trị CŨ đã gây lỗi; nếu phép tính này không kêu thì cổng vô dụng
    const bad = ratio(blend(hex("#3d6e96"), hex(SEA_MASK_COLOR), 0.55), hex(SEA_MASK_COLOR));
    expect(bad).toBeLessThan(3);
    const good = ratio(blend(hex("#3d6e96"), hex(SEA_MASK_COLOR), 0.85), hex(SEA_MASK_COLOR));
    expect(good).toBeGreaterThanOrEqual(3);
  });
});

/*
  CỔNG VAI `k` CỦA NGUỒN ĐẲNG SÂU (2026-09-01).

  `isobaths.v1.json` nay mang HAI VAI trong cùng một nguồn: `k:"duong"`
  (MultiLineString, 9 mức — nét và nhãn) và `k:"vung"` (MultiPolygon, 8 mức —
  dành cho dải tô). Lớp nào đọc nguồn này mà KHÔNG lọc `k` thì vẽ luôn cả biên
  đa giác, trong đó có ~201° (~22.000 km) đoạn mép khung ⇒ những nét "2000 m"
  thẳng băng dọc 102°Đ / 118°Đ / 5°B.

  Cổng cũ KHÔNG bắt được: nó soi spec layer, không soi dữ liệu. Đúng khuôn
  "trên bàn xanh, ngoài biển hỏng" mà sw.js tự ghi.
*/
describe("nguồn đẳng sâu hai vai — lớp nào cũng phải lọc theo `k`", () => {
  it("mọi lớp đọc source 'isobaths' đều mang bộ lọc vai", () => {
    const style = buildMapStyle("bathymetry", new Date("2026-06-10T12:00:00Z"));
    const layers = (
      style.layers as { id: string; source?: string; filter?: unknown }[]
    ).filter((l) => l.source === "isobaths");
    expect(layers.length, "không còn lớp nào đọc nguồn đẳng sâu?").toBeGreaterThan(0);
    for (const l of layers)
      expect(
        JSON.stringify(l.filter ?? null),
        `lớp ${l.id} đọc nguồn hai vai mà KHÔNG lọc \`k\` — sẽ vẽ cả mép khung`,
      ).toContain('"k"');
  });

  it("file thật đúng là hai vai — cổng trên vô nghĩa nếu dữ liệu chỉ một vai", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public/data/isobaths.v1.json"), "utf8"),
    );
    const vai = new Set(raw.features.map((f: { properties: { k: string } }) => f.properties.k));
    expect(vai).toEqual(new Set(["duong", "vung"]));
  });
});

/*
  VÌ SAO CHƯA BẬT DẢI TÔ — có số, để người sau khỏi thử lại mù (2026-09-01).

  Dữ liệu vùng đã sẵn (8 mức từ 10 m). Chưa vẽ vì ĐO ĐƯỢC là mọi dải tô đủ đậm
  để nhìn thấy đều kéo nét đẳng sâu xuống DƯỚI sàn 3:1 — tức là đổi một thứ
  trang trí lấy chính con số bà con cần đọc. Ở độ mờ 0,6, màu tô đậm nhất còn
  giữ được nét là ~#bcd9e4, gần như không phân biệt nổi với nền biển #d5e8eb
  qua tám mức.

  Muốn bật thì phải giải bài toán nét TRƯỚC (đổi màu/độ đậm nét đẳng sâu, hoặc
  tách tô và nét theo nấc zoom) — không phải cứ thêm lớp `fill` là xong.
*/
describe("dải tô: nếu ai bật thì nét đẳng sâu vẫn phải đọc được", () => {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c: number[]) => {
    const s = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const ratio = (a: number[], b: number[]) => {
    const [l1, l2] = [lum(a), lum(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const blend = (fg: number[], bg: number[], a: number) =>
    fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));

  it("phép đo tái lập được: bảng màu cũ của legend làm nét tụt còn ~1,1:1", () => {
    const sea = hex(SEA_MASK_COLOR);
    const line = blend(hex("#3d6e96"), sea, 0.85);
    const duoiDaiTo = blend(hex("#0b2d59"), sea, 0.6);
    expect(ratio(line, duoiDaiTo)).toBeLessThan(1.5);
  });

  /*  CỔNG NGỦ ĐÃ THỨC (2026-09-02): dải "đủ nước" được bật — bằng chiều
      NGƯỢC với chiều đã bị đo chết. Tô đậm phía nông kéo nét xuống 1,09:1;
      tô SÁNG phía sâu (#f2f8fa @0,65) thì nét nằm trên nền sáng hơn và
      tương phản TĂNG. Cổng nay đo THẬT cả ba: nét trên nền sâu mới · nét
      trên nền nông giữ nguyên · nhãn số mét. */
  it("dải đủ-nước: nét đẳng sâu ĐẠT sàn trên CẢ HAI nền, nhãn đạt 4,5:1", () => {
    const style = buildMapStyle("bathymetry", new Date("2026-06-10T12:00:00Z"));
    const fill = (style.layers as {
      source?: string; type: string; paint?: Record<string, unknown>;
    }[]).find((l) => l.source === "isobaths" && l.type === "fill");
    expect(fill, "dải đủ-nước phải tồn tại — quen mắt như hải đồ giấy").toBeTruthy();

    const mauTo = fill?.paint?.["fill-color"] as string;
    const moTo = fill?.paint?.["fill-opacity"] as number;
    expect(typeof mauTo).toBe("string");
    expect(typeof moTo).toBe("number");

    const nenSau = blend(hex(mauTo), hex(SEA_MASK_COLOR), moTo);
    const net = blend(hex("#3d6e96"), hex(SEA_MASK_COLOR), 0.85);
    // nét trên nền SÂU (mới) và nền NÔNG (màu biển gốc) đều phải đạt sàn
    expect(ratio(net, nenSau)).toBeGreaterThanOrEqual(3);
    expect(ratio(net, hex(SEA_MASK_COLOR))).toBeGreaterThanOrEqual(3);
    // nhãn số mét trên nền sâu — chữ nhỏ, sàn 4,5:1
    expect(ratio(hex("#14324f"), nenSau)).toBeGreaterThanOrEqual(4.5);
    // bước nông–sâu phải NHẬN RA được nhưng không được chói thành hai bản đồ
    const buoc = ratio(hex(SEA_MASK_COLOR), nenSau);
    expect(buoc).toBeGreaterThan(1.05);
    expect(buoc).toBeLessThan(1.5);
  });
});

/*
  CỔNG TƯƠNG PHẢN MỞ RỘNG (2026-09-03) — soi CẢ hằng số mà lớp JSX dùng.

  Reviewer hải đồ đo: cổng cũ chỉ soi lớp trong `buildMapStyle`; mọi lớp viết
  trong JSX (cáp, vùng cấm, rạn, chất đáy) đứng ngoài cổng và TẤT CẢ rơi dưới
  sàn (2,44 · 2,43 · 1,89 · 1,11 · 1,4–2,1). Nay màu + ĐỘ MỜ đều xuất từ
  ocean-map.ts, và cổng đo đúng cặp (màu, độ mờ) sẽ chạy — pha mờ TRƯỚC khi đo,
  cùng phép với đẳng sâu.
*/
describe("tương phản HẰNG SỐ lớp hải đồ (cáp · ống · vùng cấm · rạn · chất đáy)", () => {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c: number[]) => {
    const s = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const ratio = (a: number[], b: number[]) => {
    const [l1, l2] = [lum(a), lum(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const blend = (fg: number[], bg: number[], a: number) =>
    fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));
  const sea = hex(SEA_MASK_COLOR);
  const onSea = (color: string, opacity: number) => blend(hex(color), sea, opacity);
  const vsSea = (color: string, opacity: number) => ratio(onSea(color, opacity), sea);

  const NET: [string, string, number][] = [
    ["cáp quang", SEA_CABLE_COLOR, SEA_CABLE_OPACITY],
    ["ống dẫn", PIPELINE_COLOR, PIPELINE_OPACITY],
    ["vùng cấm (viền)", SEA_RESTRICTED_COLOR, SEA_RESTRICTED_OPACITY],
    ["viền rạn", REEF_SHAPE_LINE, REEF_SHAPE_LINE_OPACITY],
    ["đường an toàn", SAFETY_CONTOUR_STYLE.color, SAFETY_CONTOUR_STYLE.opacity],
    ...Object.entries(CHAT_DAY_COLORS).map(
      ([k, c]) => [`chất đáy ${k}`, c, CHAT_DAY_OPACITY] as [string, string, number],
    ),
  ];

  it.each(NET)("%s đạt ≥3:1 trên nền biển SAU khi pha độ mờ", (_ten, color, opacity) => {
    expect(color, "màu phải là hex đơn để đo được").toMatch(/^#[0-9a-f]{6}$/);
    const r = vsSea(color, opacity);
    expect(
      r,
      `${color} @${opacity} chỉ đạt ${r.toFixed(2)}:1 — dưới sàn 3:1 cho nét/icon`,
    ).toBeGreaterThanOrEqual(3);
  });

  it("cáp · ống · vùng cấm KHÁC NHAU về ĐỘ SÁNG (mù màu / nắng chói vẫn phân biệt)", () => {
    const cap = onSea(SEA_CABLE_COLOR, SEA_CABLE_OPACITY);
    const ong = onSea(PIPELINE_COLOR, PIPELINE_OPACITY);
    const cam = onSea(SEA_RESTRICTED_COLOR, SEA_RESTRICTED_OPACITY);
    // cặp cũ (#7c3aed@0,6 vs #c2620c@0,75) là 1,00:1 — chỉ khác hue
    const cu = ratio(onSea("#7c3aed", 0.6), onSea("#c2620c", 0.75));
    expect(cu).toBeLessThan(1.1);
    for (const [ten, a, b] of [
      ["cáp–vùng cấm", cap, cam],
      ["cáp–ống", cap, ong],
      ["vùng cấm–ống", cam, ong],
    ] as const) {
      expect(ratio(a, b), `${ten} gần nhau về độ sáng`).toBeGreaterThanOrEqual(1.4);
    }
    // và khác NÉT, không chỉ khác màu
    expect(SEA_CABLE_DASH).not.toEqual(PIPELINE_DASH);
    expect(PIPELINE_DASH.length).toBeGreaterThanOrEqual(2);
  });

  it("fill rạn: được dưới sàn nét, nhưng phải NHẬN RA được", () => {
    const r = vsSea(REEF_SHAPE_FILL, REEF_SHAPE_FILL_OPACITY);
    expect(r, "fill rạn mờ tới mức không thấy").toBeGreaterThanOrEqual(1.15);
    expect(r, "fill rạn đậm tới mức che số đo sâu").toBeLessThan(1.5);
  });

  it("vùng cấm tô nền: nhãn đọc được (≥4,5) và nét đẳng sâu đè lên vẫn ≥3", () => {
    const nen = onSea(RESTRICTED_FILL_COLOR, RESTRICTED_FILL_OPACITY);
    expect(ratio(nen, sea), "nền vùng cấm không khác nền biển").toBeGreaterThan(1.05);
    expect(ratio(hex(RESTRICTED_LABEL_COLOR), nen)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(blend(hex("#3d6e96"), nen, 0.85), nen)).toBeGreaterThanOrEqual(3);
  });

  it("DẢI ĐỘ SÂU: nông→sâu SÁNG DẦN, mỗi bước nhận ra được, nét/an toàn/nhãn đạt sàn trên MỌI nấc", () => {
    expect(DEPTH_BANDS.length).toBeGreaterThanOrEqual(4);
    expect(DEPTH_BANDS[0].color).toBe(SEA_MASK_COLOR);
    expect(DEPTH_BANDS[DEPTH_BANDS.length - 1].toM).toBe(Infinity);
    for (let i = 0; i < DEPTH_BANDS.length; i++) {
      const { toM, color } = DEPTH_BANDS[i];
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
      const bg = hex(color);
      if (i > 0) {
        const prev = DEPTH_BANDS[i - 1];
        expect(toM, "nấc phải tăng dần").toBeGreaterThan(prev.toM);
        expect(lum(bg), `nấc ${toM} phải SÁNG hơn nấc ${prev.toM}`).toBeGreaterThan(
          lum(hex(prev.color)),
        );
        const buoc = ratio(bg, hex(prev.color));
        expect(buoc, `bước ${prev.toM}→${toM} không nhận ra`).toBeGreaterThan(1.05);
        expect(buoc, "bước quá gắt thành hai bản đồ").toBeLessThan(1.5);
      }
      // nét đẳng sâu thường (#3d6e96@0,85 — xem isobath-lines) trên nấc này
      expect(ratio(blend(hex("#3d6e96"), bg, 0.85), bg)).toBeGreaterThanOrEqual(3);
      // đường an toàn phải đậm HƠN nét thường
      const anToan = ratio(
        blend(hex(SAFETY_CONTOUR_STYLE.color), bg, SAFETY_CONTOUR_STYLE.opacity),
        bg,
      );
      expect(anToan).toBeGreaterThan(ratio(blend(hex("#3d6e96"), bg, 0.85), bg));
      // nhãn số mét — chữ nhỏ, sàn 4,5
      expect(ratio(hex("#14324f"), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("đường an toàn = mức 10 m, có trong dữ liệu vai `duong`, nét dày hơn đẳng sâu thường", () => {
    expect(SAFETY_CONTOUR_M).toBe(10);
    // isobaths.v1.json có mức 10 ở cả hai vai — không thì lớp vẽ trống
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public/data/isobaths.v1.json"), "utf8"),
    );
    const mucDuong = raw.features
      .filter((f: { properties: { k: string } }) => f.properties.k === "duong")
      .map((f: { properties: { d: number } }) => f.properties.d);
    expect(mucDuong).toContain(SAFETY_CONTOUR_M);
    // mọi nấc bề rộng ≥ 1,4 px (đẳng sâu thường 0,5–1,1 px)
    const stops = (SAFETY_CONTOUR_STYLE.width as readonly unknown[])
      .slice(3)
      .filter((_, i) => i % 2 === 1) as number[];
    expect(stops.length).toBeGreaterThan(0);
    for (const w of stops) expect(w).toBeGreaterThanOrEqual(1.4);
  });
});

/*
  SÀN 16 px CHO MỌI KÝ HIỆU (2026-09-03) — quét MỌI spec symbol xuất từ
  ocean-map, không chỉ CHART_ICON_SIZE. Reviewer bắt: WRECK_LAYER 0,6×24 =
  14,4 px và LIGHTHOUSE_LAYER 0,55×24 = 13,2 px — đúng nấc hai lớp này được
  cho hiện sớm "vì quan trọng" lại là nấc chúng nhỏ hơn sàn CHART_ICON_MIN_PX.
*/
describe("sàn cỡ icon: mọi nấc icon-size của mọi spec symbol ≥ CHART_ICON_MIN_PX", () => {
  type Spec = { id: string; type: string; layout?: Record<string, unknown> };
  const specs = Object.entries(oceanMap)
    .filter(
      ([, v]) =>
        !!v && typeof v === "object" && (v as Spec).type === "symbol" && !!(v as Spec).layout,
    )
    .map(([name, v]) => [name, v as Spec] as const);

  it("có bắt được đúng hai spec reviewer chỉ đích danh", () => {
    const names = specs.map(([n]) => n);
    expect(names).toContain("WRECK_LAYER");
    expect(names).toContain("LIGHTHOUSE_LAYER");
    expect(WRECK_LAYER.layout["icon-size"][4]).toBeGreaterThanOrEqual(0.67);
    expect(LIGHTHOUSE_LAYER.layout["icon-size"][4]).toBeGreaterThanOrEqual(0.67);
  });

  it.each(specs)("%s", (_name, spec) => {
    const size = spec.layout?.["icon-size"];
    if (size === undefined) return; // lớp chỉ có chữ (vd nhãn đèn) — không có icon
    const stops: number[] =
      typeof size === "number"
        ? [size]
        : ((size as unknown[]).slice(3).filter((_, i) => i % 2 === 1) as number[]);
    expect(stops.length, "không đọc được nấc icon-size").toBeGreaterThan(0);
    for (const s of stops) {
      const px = s * CHART_ICON_BASE_PX;
      expect(
        px,
        `${spec.id}: icon-size ${s} = ${px.toFixed(1)} px, dưới sàn ${CHART_ICON_MIN_PX}`,
      ).toBeGreaterThanOrEqual(CHART_ICON_MIN_PX);
    }
  });
});

describe("sprite của style PHẢI là URL tuyệt đối (sự cố 2026-09-01→03: không một icon nào vẽ)", () => {
  it("buildMapStyle().sprite có scheme + host + đúng đường dẫn sprite", async () => {
    const { CHART_SPRITE_URL, chartSpriteUrl } = await import("../chart-symbols");
    const style = buildMapStyle("bathymetry", new Date("2026-09-03T00:00:00Z"));
    expect(style.sprite).toBe(chartSpriteUrl());
    // MapLibre v5 kiểm bằng "có scheme://host" — tương đối là im lặng bỏ mọi icon
    expect(String(style.sprite)).toMatch(/^[a-z][a-z0-9+.-]*:\/\/[^/]+\/icons\/chart-sprite$/i);
    expect(String(style.sprite).endsWith(CHART_SPRITE_URL)).toBe(true);
  });
  it("ngoài trình duyệt (không window) vẫn trả URL tuyệt đối hợp lệ", async () => {
    const { chartSpriteUrl } = await import("../chart-symbols");
    const w = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = undefined;
    try {
      expect(chartSpriteUrl()).toBe("http://localhost/icons/chart-sprite");
    } finally {
      (globalThis as { window?: unknown }).window = w;
    }
  });
});

describe("dải glyph: mọi ký tự trong nhãn bản đồ phải có file .pbf + nằm trong SW (2026-09-03c)", () => {
  const ROOT = path.resolve(__dirname, "../../..");
  const FONTS = ["Noto Sans Regular", "Noto Sans Bold"];
  /** Dải 256 ký tự chứa mã `cp` theo cách MapLibre chia (0-255, 256-511, …). */
  const dai = (cp: number) => `${Math.floor(cp / 256) * 256}-${Math.floor(cp / 256) * 256 + 255}`;

  it("ký tự thật trong data nhãn (tuyến, địa danh ngầm, rạn, đảo, đèn) đều thuộc dải đã host", () => {
    const files = ["vn-sea-lanes.v1.json", "dia-danh-ngam.v1.json", "coral-reefs.v1.json", "vn-islands.v1.json", "den-bien.v1.json", "khu-tru-bao.v1.json"];
    const can = new Set<string>();
    for (const f of files) {
      const t = fs.readFileSync(path.join(ROOT, "public/data", f), "utf8");
      for (const ch of t) can.add(dai(ch.codePointAt(0) ?? 0));
    }
    for (const font of FONTS) {
      const co = new Set(fs.readdirSync(path.join(ROOT, "public/fonts", font)).map((n) => n.replace(/\.pbf$/, "")));
      const thieu = [...can].filter((d) => !co.has(d));
      expect(thieu, `${font} thiếu dải: ${thieu.join(", ")} — MapLibre sẽ 404 rồi bỏ nguyên nhãn`).toEqual([]);
    }
  });

  it("mọi file .pbf đang host đều nằm trong CRITICAL_SHELL của sw.js (mất sóng vẫn có chữ)", () => {
    const sw = fs.readFileSync(path.join(ROOT, "public/sw.js"), "utf8");
    for (const font of FONTS) {
      for (const n of fs.readdirSync(path.join(ROOT, "public/fonts", font))) {
        const url = `/fonts/${encodeURIComponent(font)}/${n}`;
        expect(sw, `sw.js thiếu ${url}`).toContain(`"${url}"`);
      }
    }
  });
});

describe("BA TẦNG HIỆN — SCAMIN kiểu Navionics (2026-09-03c)", () => {
  it("bốn mốc có tên tăng dần, cách nhau đúng 2 nấc: LUON < XA < VUA < SAT", async () => {
    const { CHART_TIER } = await import("@/lib/ocean-map");
    expect(CHART_TIER.LUON).toBe(5);
    expect(CHART_TIER.XA - CHART_TIER.LUON).toBe(2);
    expect(CHART_TIER.VUA - CHART_TIER.XA).toBe(2);
    expect(CHART_TIER.SAT - CHART_TIER.VUA).toBe(2);
  });

  it("MỌI hằng *_MINZOOM trong ocean-map.ts trỏ về CHART_TIER — không lớp nào tự đặt số", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("../ocean-map.ts", import.meta.url)), "utf8");
    const rows = [...src.matchAll(/export const (\w+_MINZOOM)\s*=\s*([^;]+);/g)];
    expect(rows.length).toBeGreaterThanOrEqual(16);
    const MOC = /^CHART_TIER\.(LUON|XA|VUA|SAT)$/;
    for (const [, ten, gia] of rows) {
      if (ten === "SOUNDING_LABEL_MINZOOM") continue; // số trần 12,5 = SÁT + 1,5, canh ở dưới
      const g = gia.trim();
      if (g.startsWith("{")) {
        // bảng nhiều tầng (vd SEAMARK_TIER_MINZOOM): từng giá trị bên trong phải là mốc
        const cac = [...g.matchAll(/\w+\s*:\s*([^,}]+)/g)].map((m) => m[1].trim());
        expect(cac.length, `${ten} rỗng`).toBeGreaterThan(0);
        for (const v of cac) expect(v, `${ten} → ${v}`).toMatch(MOC);
        continue;
      }
      expect(g, `${ten} = ${gia}`).toMatch(MOC);
    }
  });

  it("từng lớp đúng tầng: XA đèn/xác tàu/đá/giàn/trú bão · VỪA phao/cáp/luồng/rạn ven bờ · SÁT số đo/chất đáy", async () => {
    const m = await import("@/lib/ocean-map");
    const T = m.CHART_TIER;
    expect(m.LIGHTHOUSE_MINZOOM).toBe(T.XA);
    expect(m.WRECK_MINZOOM).toBe(T.XA);
    expect(m.REEF_HAZARD_MINZOOM).toBe(T.XA);
    expect(m.REEF_OFFSHORE_MINZOOM).toBe(T.XA);
    expect(m.RIG_MINZOOM).toBe(T.XA);
    expect(KHU_TRU_BAO_MINZOOM).toBe(T.XA);
    expect(m.SEAMARK_TIER_MINZOOM.far).toBe(T.XA);
    expect(SEA_CABLE_MINZOOM).toBe(T.VUA);
    expect(SEA_PIPELINE_MINZOOM).toBe(T.VUA);
    expect(CABLE_LANDING_MINZOOM).toBe(T.VUA);
    expect(SEA_RESTRICTED_MINZOOM).toBe(T.VUA);
    expect(SEA_FAIRWAY_MINZOOM).toBe(T.VUA);
    expect(m.FAIRWAY_DEPTH_MINZOOM).toBe(T.VUA);
    expect(m.LIGHTHOUSE_LABEL_MINZOOM).toBe(T.VUA);
    expect(m.WRECK_DEPTH_MINZOOM).toBe(T.VUA);
    expect(m.REEF_VENBO_MINZOOM).toBe(T.VUA);
    expect(m.VN_AID_MINZOOM).toBe(T.VUA);
    expect(m.SEAMARK_TIER_MINZOOM.mid).toBe(T.VUA);
    expect(m.SOUNDING_DOT_MINZOOM).toBe(T.SAT);
    expect(m.CHAT_DAY_MINZOOM).toBe(T.SAT);
    expect(m.SEAMARK_TIER_MINZOOM.near).toBe(T.SAT);
    expect(m.SOUNDING_LABEL_MINZOOM).toBe(T.SAT + 1.5);
    expect(m.DIA_DANH_NGAM_MINZOOM).toBe(T.LUON);
  });

  it("cụm +N tan đúng lúc tầng kế hiện: VỪA gom tới SÁT−1, SÁT gom tới SÁT+1", async () => {
    const m = await import("@/lib/ocean-map");
    expect(m.SEAMARK_CLUSTER_MAXZOOM.mid).toBe(m.CHART_TIER.SAT - 1);
    expect(m.SEAMARK_CLUSTER_MAXZOOM.near).toBe(m.CHART_TIER.SAT + 1);
    expect(m.SEAMARK_CLUSTER_RADIUS).toBeGreaterThanOrEqual(24); // hai icon 17 px chạm mép mới gom
    expect(m.CLUSTER_BADGE.radius * 2).toBeGreaterThanOrEqual(24);
  });

  it("số độ sâu trên xác tàu hiện muộn hơn HÌNH một tầng (step theo zoom tại WRECK_DEPTH_MINZOOM)", async () => {
    const m = await import("@/lib/ocean-map");
    expect(m.WRECK_LAYER.layout["text-field"]).toEqual(["step", ["zoom"], "", m.WRECK_DEPTH_MINZOOM, ["get", "nhan"]]);
    expect(m.WRECK_DEPTH_MINZOOM).toBeGreaterThan(m.WRECK_MINZOOM);
  });

  it("fishing-map-view.tsx KHÔNG có minzoom viết số — mọi lớp JSX trỏ về hằng, và ba nguồn báo hiệu có gom cụm", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("../../components/fishing-map-view.tsx", import.meta.url)), "utf8");
    expect(src.match(/minzoom=\{\s*[0-9]/g)).toBeNull();
    for (const id of ["seamarks-mid", "seamarks-near", "vn-aids"]) expect(src).toContain(`id="${id}"`);
    expect(src.match(/clusterRadius=\{SEAMARK_CLUSTER_RADIUS\}/g)?.length).toBe(3);
    // lớp icon trên nguồn có cluster PHẢI lọc bỏ cụm, nếu không cụm vẽ icon rỗng
    expect(src.match(/filter=\{KHONG_PHAI_CUM\}/g)?.length).toBe(3);
  });
});
