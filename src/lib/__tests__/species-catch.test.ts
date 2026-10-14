import { describe, expect, it } from "vitest";
import { type FleetEffortGrid } from "../fleet-effort";
import {
  buildFishForecast,
  CATCH_SCALE,
  FISH_LEVEL_BANDS,
  SPECIES_PROFILES,
  type ScalarGrid,
} from "../fish-predict";
import catchJson from "../../data/species-catch-025.v1.json";

// KÊNH SẢN LƯỢNG LOÀI (2026-10-14): lưới kg từng loài × ô × tháng (eCDT × VMS), cùng shape lưới
// đội tàu với "nghề" = chính loài. Kiểm định: ops/fish-validate-positions §11.

/** Lưới sản lượng tí hon 5×5 quanh 12,775N 115,525E — ngừ vằn ra dày ở ô giữa tháng 10. */
function tinyCatch(kg: number): FleetEffortGrid {
  return {
    v: 1,
    axis: { lat0: 12.275, lon0: 115.025, step: 0.25, nLat: 5, nLon: 5 },
    gears: ["ngừ vằn"],
    months: ["2026-10"],
    days: { "2026-10": 30 },
    speciesGears: { "ngừ vằn": ["ngừ vằn"] },
    effort: { "2026-10": kg > 0 ? { "ngừ vằn": [[2, 2, kg]] } : {} },
  };
}

describe("buildFishForecast + sản lượng loài", () => {
  const lats = [12.525, 12.775, 13.025];
  const lons = [115.275, 115.525, 115.775];
  const g = (v: number, unit: ScalarGrid["unit"]): ScalarGrid => ({
    lats,
    lons,
    values: lats.map(() => lons.map(() => v)),
    date: "2026-10-09",
    unit,
  });
  const run = (catchGrid?: FleetEffortGrid) =>
    buildFishForecast(g(29.5, "degC"), g(0.3, "mg/m3"), null, 10, { depth: g(4000, "m"), catchGrid });
  const cell = (out: ReturnType<typeof run>) => out.cells.find((c) => c.lat === 12.78 && c.lon === 115.53);

  it("không lưới / lưới rỗng ⇒ y như cũ", () => {
    expect(run(tinyCatch(0)).cells).toEqual(run().cells);
  });

  it("loài có sản lượng ⇒ điểm loài đó TĂNG; loài khác không đổi; không ô nào tụt", () => {
    const base = run();
    const withCatch = run(tinyCatch(200000));
    const b = cell(base)?.sp ?? {};
    const w = cell(withCatch)?.sp ?? {};
    expect(w["ngừ vằn"] ?? 0).toBeGreaterThan(b["ngừ vằn"] ?? 0);
    for (const [sp, v] of Object.entries(b)) if (sp !== "ngừ vằn") expect(w[sp]).toBe(v);
    for (const c of base.cells) {
      const x = withCatch.cells.find((y) => y.lat === c.lat && y.lon === c.lon)!;
      for (const [sp, v] of Object.entries(c.sp)) expect(x.sp[sp] ?? 0).toBeGreaterThanOrEqual(v);
    }
  });

  it("sản lượng MỘT MÌNH không đưa lên mức Cao — lên đỏ phải có ảnh vệ tinh hôm nay", () => {
    const high = FISH_LEVEL_BANDS.find((b) => b.key === "high")!.min / 100;
    expect(CATCH_SCALE).toBeLessThan(high);
    // soft-OR có trần: mỗi ô × loài tăng không quá phần CATCH_SCALE của khoảng còn lại
    const base = run();
    const withCatch = run(tinyCatch(10_000_000));
    for (const c of withCatch.cells) {
      const before = base.cells.find((y) => y.lat === c.lat && y.lon === c.lon)?.sp ?? {};
      for (const [sp, v] of Object.entries(c.sp)) {
        const old = (before[sp] ?? 0) / 100;
        expect(v).toBeLessThanOrEqual(Math.round(100 * (1 - (1 - old) * (1 - CATCH_SCALE))) + 1);
      }
    }
  });

  it("nước ngoài dải chịu nhiệt của loài ⇒ không vẽ dù năm trước bắt nhiều", () => {
    const cold = (cg?: FleetEffortGrid) =>
      buildFishForecast(g(18, "degC"), g(0.3, "mg/m3"), null, 10, { depth: g(4000, "m"), catchGrid: cg });
    const sp = (out: ReturnType<typeof cold>) =>
      out.cells.find((c) => c.lat === 12.78 && c.lon === 115.53)?.sp["ngừ vằn"] ?? 0;
    expect(sp(cold(tinyCatch(10_000_000)))).toBe(sp(cold()));
  });
});

describe("lưới thật src/data/species-catch-025.v1.json", () => {
  const f = catchJson as unknown as FleetEffortGrid & { rule: { minVessels: number } };
  it("cùng trục lưới cá, có ngày phủ mọi tháng, chỉ số tổng (không định danh tàu)", () => {
    expect(f.axis).toEqual({ lat0: 5.025, lon0: 102.025, step: 0.25, nLat: 69, nLon: 65 });
    expect(f.rule.minVessels).toBeGreaterThanOrEqual(3);
    for (const m of f.months) expect(f.days[m]).toBeGreaterThan(0);
    expect(JSON.stringify(f)).not.toMatch(/-TS"|vesselId|owner|phone/i);
  });

  it("loài trong lưới nối được hồ sơ dự báo; loài sản lượng lớn có mặt", () => {
    const shorts = new Set(SPECIES_PROFILES.map((p) => p.short));
    for (const s of ["cá nục", "ngừ vằn", "ngừ ồ", "cá cơm"]) {
      expect(f.speciesGears[s]).toEqual([s]);
      expect(shorts.has(s)).toBe(true);
    }
  });
});
