import { describe, expect, it } from "vitest";
import { gridPoints, GRID_N_LAT, GRID_N_LON } from "../forecast-grid";
import {
  scalarColor,
  scalarGradientCss,
  scalarFieldFeatures,
  scalarValueAt,
  fillCoastalGaps,
  SCALAR_RAMP,
  type ScalarGrid,
  type ScalarKind,
} from "../scalar-field";

// Lưới giả: mọi ô cùng thứ tự gridPoints(), một mốc giờ, giá trị = tham số
function makeGrid(kind: ScalarKind, valueOf: (i: number) => number | null): ScalarGrid {
  const pts = gridPoints();
  return {
    kind,
    times: ["2026-06-12T12:00"],
    cells: pts.map((p, i) => ({ lat: p.lat, lon: p.lon, values: [valueOf(i)] })),
  };
}

describe("scalarColor", () => {
  it("kẹp hai đầu + nội suy giữa hai chặng", () => {
    // cloud: 0 → alpha 0 (trong suốt); 100 → xám chì đục
    expect(scalarColor("cloud", -5)).toBe("rgba(255,255,255,0)");
    expect(scalarColor("cloud", 200)).toBe("rgba(104,105,108,0.86)");
    // mây thưa (dưới chặng 25) → alpha nhỏ: vẫn thấy rõ địa hình
    const mid = scalarColor("cloud", 20);
    expect(mid).toMatch(/^rgba\(/);
    const alpha = Number(mid.split(",")[3].replace(")", ""));
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(0.16);
  });

  it("mây: PHÂN BIỆT MẬT ĐỘ bằng sắc độ — thưa sáng, dày xám đậm (độ sáng giảm dần)", () => {
    // độ sáng (lấy kênh R vì xám trung tính R≈G≈B) phải GIẢM khi mây dày hơn
    const lum = (v: number) =>
      Number(scalarColor("cloud", v).match(/rgba?\(([^,]+)/)![1]);
    for (const [lo, hi] of [[25, 50], [50, 70], [70, 85], [85, 100]]) {
      expect(lum(hi)).toBeLessThan(lum(lo));
    }
  });

  it("mây TRUNG TÍNH — không ánh lam (b−r nhỏ để khỏi tô đậm biển lam)", () => {
    for (const v of [25, 50, 70, 85, 100]) {
      const [r, g, b] = scalarColor("cloud", v)
        .match(/rgba?\(([^)]+)\)/)![1]
        .split(",")
        .map(Number);
      expect(b - r).toBeLessThanOrEqual(4);
    }
  });
});

describe("scalarGradientCss", () => {
  it("chặng đầu 0%, chặng cuối 100%, bỏ alpha (rgb)", () => {
    const css = scalarGradientCss("rain");
    expect(css.startsWith("linear-gradient(90deg,")).toBe(true);
    expect(css).toContain("0%");
    expect(css).toContain("100%");
    expect(css).toContain("rgb(");
  });
});

describe("scalarFieldFeatures", () => {
  it("nội suy lên lưới mịn gấp factor, mọi ô có màu", () => {
    const grid = makeGrid("airtemp", () => 28);
    const fc = scalarFieldFeatures(grid, 0, 3);
    // (N_LAT-1)*3+1 × (N_LON-1)*3+1 ô
    const expected = ((GRID_N_LAT - 1) * 3 + 1) * ((GRID_N_LON - 1) * 3 + 1);
    expect(fc.features).toHaveLength(expected);
    for (const f of fc.features) {
      expect(f.geometry.type).toBe("Polygon");
      expect((f.properties as { color: string }).color).toMatch(/^rgba\(/);
    }
  });

  it("ô null: LAN màu 2 vòng quanh ô có số (2026-07-29 — hết thủng sát bờ), xa hơn vẫn bỏ", () => {
    // đúng 1 điểm có số, còn lại null → chỉ vùng LÂN CẬN (≤2 ô lưới) được tô,
    // phần biển xa vẫn trống — không tô bừa cả bản đồ
    const grid = makeGrid("cloud", (i) => (i === 0 ? 80 : null));
    const fc = scalarFieldFeatures(grid, 0, 3);
    expect(fc.features.length).toBeGreaterThan(0);
    const total = ((GRID_N_LAT - 1) * 3 + 1) * ((GRID_N_LON - 1) * 3 + 1);
    expect(fc.features.length).toBeLessThan(total * 0.1);
  });

  it("lưới sai kích thước → rỗng, không ném", () => {
    const bad: ScalarGrid = {
      kind: "cloud",
      times: ["2026-06-12T12:00"],
      cells: [{ lat: 6, lon: 102, values: [50] }],
    };
    expect(scalarFieldFeatures(bad, 0).features).toEqual([]);
  });
});

/* 2026-07-29 (ảnh user): nền màu dòng chảy/sóng thủng lỗ ở ô gần đất — ô đất
   null giết cả nửa ô biển kề. Lan màu CHỈ cho nền (đất bị lớp bờ vẽ đè); số
   đọc ra (scalarValueAt) vẫn từ lưới gốc. */
describe("fillCoastalGaps", () => {
  it("ô null cạnh ô có số → nhận TRUNG BÌNH các ô kề; 2 vòng lan được 2 ô", () => {
    // lưới 1×5: [4, null, null, null, 8]
    const out = fillCoastalGaps([4, null, null, null, 8], 1, 5, 2);
    expect(out[1]).toBe(4); // vòng 1
    expect(out[3]).toBe(8);
    expect(out[2]).toBe(6); // vòng 2: trung bình 2 phía đã lan (4+8)/2
    expect(out[0]).toBe(4); // ô có số KHÔNG bị đổi
    expect(out[4]).toBe(8);
  });

  it("xa quá số vòng lan → vẫn null; toàn null → giữ nguyên, không ném", () => {
    const out = fillCoastalGaps([1, null, null, null, null, null], 1, 6, 2);
    expect(out[1]).toBe(1); // vòng 1
    expect(out[2]).toBe(1); // vòng 2
    expect(out[3]).toBeNull(); // quá 2 vòng — không lan nữa
    expect(out[4]).toBeNull();
    expect(fillCoastalGaps([null, null], 1, 2)).toEqual([null, null]);
  });

  it("scalarValueAt KHÔNG bị ảnh hưởng — số đọc ra vẫn là số thật (null là null)", () => {
    const grid = makeGrid("cloud", (i) => (i === 0 ? 80 : null));
    const pts = gridPoints();
    expect(scalarValueAt(grid, 0, pts[5].lat, pts[5].lon)).toBeNull();
  });
});

describe("scalarValueAt", () => {
  it("lấy ô gần nhất", () => {
    const grid = makeGrid("cloud", (i) => i);
    const pts = gridPoints();
    // đúng toạ độ điểm số 5 → trả về 5
    expect(scalarValueAt(grid, 0, pts[5].lat, pts[5].lon)).toBe(5);
  });
});

describe("SCALAR_RAMP hợp lệ", () => {
  it("mỗi thang tăng dần theo value", () => {
    for (const kind of Object.keys(SCALAR_RAMP) as ScalarKind[]) {
      const stops = SCALAR_RAMP[kind];
      for (let i = 1; i < stops.length; i++) {
        expect(stops[i].value).toBeGreaterThan(stops[i - 1].value);
      }
    }
  });
});
