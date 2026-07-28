import { describe, expect, it } from "vitest";
import { gridPoints, GRID_N_LAT, GRID_N_LON } from "../forecast-grid";
import {
  scalarColor,
  scalarGradientCss,
  scalarFieldFeatures,
  scalarValueAt,
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
    // cloud: 0 → alpha 0 (trong suốt); 100 → đục
    expect(scalarColor("cloud", -5)).toBe("rgba(255,255,255,0)");
    expect(scalarColor("cloud", 200)).toBe("rgba(247,250,253,0.9)");
    // giữa hai chặng đầu (0 và 40) → alpha nằm giữa 0 và 0.35
    const mid = scalarColor("cloud", 20);
    expect(mid).toMatch(/^rgba\(/);
    const alpha = Number(mid.split(",")[3].replace(")", ""));
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(0.35);
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

  it("ô null (thiếu số) làm cả ô mịn quanh đó bị bỏ — không tô bừa", () => {
    // đúng 1 điểm có số, còn lại null → mọi ô mịn đều thiếu góc → rỗng
    const grid = makeGrid("cloud", (i) => (i === 0 ? 80 : null));
    const fc = scalarFieldFeatures(grid, 0, 3);
    expect(fc.features).toHaveLength(0);
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
