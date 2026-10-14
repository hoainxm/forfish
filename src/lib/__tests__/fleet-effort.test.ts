import { describe, expect, it } from "vitest";
import {
  fleetPresenceGrid,
  fleetPresenceLookup,
  FLEET_FULL_HOURS,
  type FleetEffortGrid,
} from "../fleet-effort";
import { buildFishForecast, type ScalarGrid } from "../fish-predict";
import fleetJson from "../../data/fleet-effort-025.v1.json";

/** Lưới đội tàu tí hon 5×5 quanh 12,775N 115,525E (trục y như lưới thật). */
function tiny(over: Partial<FleetEffortGrid> = {}): FleetEffortGrid {
  return {
    v: 1,
    axis: { lat0: 12.275, lon0: 115.025, step: 0.25, nLat: 5, nLon: 5 },
    gears: ["vay", "cau"],
    months: ["2026-10"],
    days: { "2026-10": 30 },
    speciesGears: { "ngừ vằn": ["vay"], "mực lá": ["cau"] },
    effort: { "2026-10": { vay: [[2, 2, 120]] } },
    ...over,
  };
}

describe("fleetPresence — kênh đội tàu", () => {
  it("không lưới / loài không nghề / nghề không có giờ ⇒ 0 (không bao giờ bịa)", () => {
    expect(fleetPresenceLookup(null, 10)("ngừ vằn", 12.775, 115.525)).toBe(0);
    const look = fleetPresenceLookup(tiny(), 10);
    expect(look("cá lạ", 12.775, 115.525)).toBe(0);
    expect(look("mực lá", 12.775, 115.525)).toBe(0);
    expect(look("ngừ vằn", 30, 130)).toBe(0); // ngoài trục
  });

  it("ô có tàu làm đều ⇒ x lớn, ô kề nhận phần làm mượt, ô xa = 0", () => {
    const look = fleetPresenceLookup(tiny(), 10);
    const center = look("ngừ vằn", 12.775, 115.525);
    const edge = look("ngừ vằn", 13.025, 115.525);
    const far = look("ngừ vằn", 12.275, 115.025);
    // 120 giờ/30 ngày, nhân tâm 2/8 ⇒ 30 giờ ⇒ 1 − e^(−30/60)
    expect(center).toBeCloseTo(1 - Math.exp(-30 / FLEET_FULL_HOURS), 5);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(center);
    expect(far).toBe(0);
  });

  it("tháng chưa trọn chia theo NGÀY phủ: 6 ngày × 24 giờ = 30 ngày × 120 giờ", () => {
    const full = fleetPresenceGrid(tiny(), ["vay"], 10)!;
    const part = fleetPresenceGrid(
      tiny({ days: { "2026-10": 6 }, effort: { "2026-10": { vay: [[2, 2, 24]] } } }),
      ["vay"],
      10,
    )!;
    expect(part[2 * 5 + 2]).toBeCloseTo(full[2 * 5 + 2], 5);
  });

  it("cửa sổ vụ: tháng kề góp nửa; tháng xa không góp; không tháng nào ⇒ null", () => {
    const g = tiny({ months: ["2026-09"], days: { "2026-09": 30 }, effort: { "2026-09": { vay: [[2, 2, 120]] } } });
    expect(fleetPresenceGrid(g, ["vay"], 10)).not.toBeNull();
    expect(fleetPresenceGrid(g, ["vay"], 12)).toBeNull();
    // chỉ tháng kề ⇒ trung bình có trọng số chỉ gồm chính nó ⇒ cùng giá trị, không thổi phồng
    const own = fleetPresenceGrid(tiny(), ["vay"], 10)!;
    expect(fleetPresenceGrid(g, ["vay"], 10)![12]).toBeCloseTo(own[12], 5);
  });

  it("tháng 12 ↔ 1 nối vòng", () => {
    const g = tiny({ months: ["2025-12"], days: { "2025-12": 31 }, effort: { "2025-12": { vay: [[2, 2, 100]] } } });
    expect(fleetPresenceGrid(g, ["vay"], 1)![12]).toBeGreaterThan(0);
  });
});

describe("buildFishForecast + đội tàu", () => {
  // nước đều 30,9 °C, mồi nghèo, sâu 4.000 m — đúng ô tàu BĐ-95532-TS 11/10/2026
  const lats = [12.525, 12.775, 13.025];
  const lons = [115.275, 115.525, 115.775];
  const g = (v: number, unit: ScalarGrid["unit"]): ScalarGrid => ({
    lats,
    lons,
    values: lats.map(() => lons.map(() => v)),
    date: "2026-10-09",
    unit,
  });
  const run = (fleet?: FleetEffortGrid) =>
    buildFishForecast(g(30.9, "degC"), g(0.24, "mg/m3"), null, 10, { depth: g(4000, "m"), fleet });
  const at = (out: ReturnType<typeof run>, sp: string) =>
    out.cells.find((c) => c.lat === 12.78 && c.lon === 115.53)?.sp[sp] ?? 0;

  it("có tàu làm đều ⇒ điểm TĂNG; không lưới ⇒ y như cũ (chỉ cộng, không trừ)", () => {
    const base = run();
    const same = run(tiny({ effort: {} }));
    expect(same.cells).toEqual(base.cells);
    // đội tàu làm dày (≈ 500 giờ/tháng sau làm mượt ⇒ x ≈ 1) — nước đều không cơ chế nào
    // thì vệ tinh cho 0; kênh đội tàu đưa ô lên được payload
    const withFleet = run(tiny({ effort: { "2026-10": { vay: [[2, 2, 2000]] } } }));
    expect(at(withFleet, "ngừ vằn")).toBeGreaterThan(at(base, "ngừ vằn"));
    // mọi ô × loài: không ô nào tụt
    for (const c of base.cells) {
      const w = withFleet.cells.find((x) => x.lat === c.lat && x.lon === c.lon)!;
      for (const [sp, v] of Object.entries(c.sp)) expect(w.sp[sp] ?? 0).toBeGreaterThanOrEqual(v);
    }
  });
});

describe("lưới thật src/data/fleet-effort-025.v1.json", () => {
  const f = fleetJson as unknown as FleetEffortGrid;
  it("cùng trục lưới cá, có ngày phủ cho mọi tháng, chỉ số tổng (không định danh tàu)", () => {
    expect(f.axis).toEqual({ lat0: 5.025, lon0: 102.025, step: 0.25, nLat: 69, nLon: 65 });
    for (const m of f.months) expect(f.days[m]).toBeGreaterThan(0);
    const s = JSON.stringify(f);
    expect(s).not.toMatch(/-TS"|vesselId|owner|phone/i);
    for (const m of f.months)
      for (const rows of Object.values(f.effort[m]))
        for (const r of rows) expect(r.length).toBe(3);
  });

  it("loài nổi lớn có nghề vây (ngừ vằn) — nối đúng ca thực địa", () => {
    expect(f.speciesGears["ngừ vằn"]).toContain("vay");
  });
});
