// Tách `buildFishForecast` thành buildCellFeatures + scoreCell (rà pipeline 2026-10-18, mảnh 2B).
// Bất biến: kết quả y hệt bản trước khi tách. Fixture là lưới TỔNG HỢP tất định (không file) —
// 3 "ngày" khác tháng, đủ MỌI kênh (sla, anom, dòng chảy, D20, độ sâu, nhiệt đáy/250 m, rạn,
// front mịn, khí hậu, đội tàu, sản lượng) nên mọi nhánh của vòng ô đều chạy.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildCellFeatures,
  buildFishForecast,
  cellHabitat,
  scoreCell,
  seasonWeights,
  SPECIES_PROFILES,
  type ScalarGrid,
} from "../fish-predict";
import type { FleetEffortGrid } from "../fleet-effort";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const axis = (a: number, b: number, step: number) => {
  const o: number[] = [];
  for (let v = a; v <= b + 1e-9; v += step) o.push(+v.toFixed(4));
  return o;
};
const grid = (
  lats: number[],
  lons: number[],
  unit: ScalarGrid["unit"],
  f: (lat: number, lon: number) => number,
  date: string,
): ScalarGrid => ({ lats, lons, values: lats.map((la) => lons.map((lo) => f(la, lo))), date, unit });

/** Bộ lưới tổng hợp cho một "ngày" (seed khác ⇒ trường khác). */
export function fixtureDay(seed: number, date: string) {
  const r = rng(seed);
  const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
  const lats = axis(8, 20, 0.25);
  const lons = axis(104, 112, 0.25);
  const land = (la: number, lo: number) => lo < 105.2 + 0.3 * Math.sin(la) || (la > 16 && lo < 107);
  const noise = (k: number) => (r() - 0.5) * k;
  const wave = (la: number, lo: number, p: number) => Math.sin(la * 0.9 + p) * Math.cos(lo * 0.7 + p);
  const sst = grid(lats, lons, "degC", (la, lo) => (land(la, lo) ? NaN : 27 + 2 * wave(la, lo, ph[0]) + noise(0.4) - (la - 8) * 0.05), date);
  const chl = grid(lats, lons, "mg/m3", (la, lo) => (land(la, lo) ? NaN : Math.exp(-1.2 + 1.3 * wave(la, lo, ph[1]) + noise(0.5))), date);
  const sla = grid(lats, lons, "m", (la, lo) => (land(la, lo) ? NaN : 0.12 * wave(la, lo, ph[2]) + noise(0.02)), date);
  const anom = grid(lats, lons, "degC", (la, lo) => (land(la, lo) ? NaN : 0.8 * wave(la, lo, ph[3]) + noise(0.1)), date);
  const depth = grid(lats, lons, "m", (la, lo) => (land(la, lo) ? NaN : 20 + (lo - 104) ** 2 * 60 + noise(15)), date);
  const thermo = grid(lats, lons, "m", (la, lo) => (land(la, lo) ? NaN : 100 + 18 * wave(la, lo, ph[2] + 1) + noise(3)), date);
  const bottomTemp = grid(lats, lons, "degC", (la, lo) => (land(la, lo) ? NaN : 20 - (lo - 104) * 0.8 + noise(0.2)), date);
  const deepTemp = grid(lats, lons, "degC", (la, lo) => (land(la, lo) ? NaN : 12 + noise(0.3)), date);
  const reef = grid(lats, lons, "unknown", (la, lo) => (land(la, lo) ? NaN : r() < 0.15 ? 0.3 : 0), date);
  // dòng chảy 1/12° (mịn hơn ô cá 3×) + front mịn
  const cl = axis(8, 20, 1 / 12);
  const co = axis(104, 112, 1 / 12);
  const u = grid(cl, co, "m/s", (la, lo) => (land(la, lo) ? NaN : 0.3 * wave(la, lo, ph[0] + 2) + noise(0.05)), date);
  const v = grid(cl, co, "m/s", (la, lo) => (land(la, lo) ? NaN : 0.3 * wave(la, lo, ph[1] + 2) + noise(0.05)), date);
  const fl = axis(8, 20, 0.1);
  const fo = axis(104, 112, 0.1);
  const frontSstFine = grid(fl, fo, "degC", (la, lo) => (land(la, lo) ? NaN : 27 + 2 * wave(la, lo, ph[0]) + noise(0.3)), date);
  const cfl = axis(8, 20, 1 / 12);
  const frontChlFine = grid(cfl, co, "mg/m3", (la, lo) => (land(la, lo) ? NaN : Math.exp(-1.2 + 1.3 * wave(la, lo, ph[1]) + noise(0.4))), date);
  const climo = Object.fromEntries(
    ["vinh-bac-bo", "trung-bo", "hoang-sa", "nam-trung-bo", "truong-sa-dk1", "dong-nam-bo", "tay-nam-bo"].map((id, k) => [
      id,
      Object.fromEntries(Array.from({ length: 12 }, (_, m) => [String(m + 1), { p25: 24.5 + k * 0.3 + (m % 4) * 0.2, p75: 30.5 + k * 0.1 + (m % 3) * 0.2, n: 100 }])),
    ]),
  );
  return { sst, chl, sla, anom, depth, thermo, bottomTemp, deepTemp, reef, cur: { u, v }, frontSstFine, frontChlFine, climo };
}

/** Lưới đội tàu / sản lượng tổng hợp CÙNG trục lưới cá. */
export function fixtureEffort(kind: "fleet" | "catch"): FleetEffortGrid {
  const r = rng(kind === "fleet" ? 7 : 11);
  const nLat = 49, nLon = 33;
  const months = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-01"];
  const effort: FleetEffortGrid["effort"] = {};
  for (const ym of months) {
    effort[ym] = {};
    for (const gear of ["G1", "G2"]) {
      const rows: [number, number, number][] = [];
      for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) if (r() < 0.12) rows.push([i, j, +(r() * 40).toFixed(1)]);
      effort[ym][gear] = rows;
    }
  }
  const speciesGears: Record<string, string[]> = {};
  SPECIES_PROFILES.forEach((p, k) => {
    if (k % 3 !== 2) speciesGears[p.short] = k % 2 ? ["G1"] : ["G1", "G2"];
  });
  return {
    v: 1,
    axis: { lat0: 8, lon0: 104, step: 0.25, nLat, nLon },
    gears: ["G1", "G2"],
    months,
    days: Object.fromEntries(months.map((m) => [m, 30])),
    speciesGears,
    effort,
  };
}

export const FIXTURE_DAYS = [
  { seed: 101, date: "2026-01-15", month: 1 },
  { seed: 202, date: "2026-08-12", month: 8 },
  { seed: 303, date: "2026-10-03", month: 10 },
];

export function runDay(d: (typeof FIXTURE_DAYS)[number], extra: Record<string, unknown> = {}) {
  const f = fixtureDay(d.seed, d.date);
  return buildFishForecast(f.sst, f.chl, f.sla, d.month, {
    anom: f.anom, cur: f.cur, thermo: f.thermo, depth: f.depth, bottomTemp: f.bottomTemp,
    deepTemp: f.deepTemp, reef: f.reef, climo: f.climo as never,
    frontSstFine: f.frontSstFine, frontChlFine: f.frontChlFine,
    fleet: fixtureEffort("fleet"), catchGrid: fixtureEffort("catch"),
    ...extra,
  });
}

const digest = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

// Chụp từ bản CŨ (trước khi tách hàm) — đừng sửa tay; đổi công thức có chủ đích thì chụp lại và ghi lý do ở commit.
const EXPECT: Record<string, { cells: number; hot: number; species: number; sumSp: number; digest: string }> = {
  "2026-01-15": { cells: 1065, hot: 883, species: 15, sumSp: 250605, digest: "bfa28d752cf39b57" },
  "2026-08-12": { cells: 1101, hot: 901, species: 17, sumSp: 267785, digest: "a33c420964970f15" },
  "2026-10-03": { cells: 1099, hot: 943, species: 16, sumSp: 291799, digest: "ef3dd70893830b5a" },
};

describe("buildFishForecast — y hệt bản cũ sau khi tách buildCellFeatures/scoreCell", () => {
  for (const d of FIXTURE_DAYS) {
    it(`ngày ${d.date} (tháng ${d.month})`, () => {
      const fc = runDay(d);
      const sumSp = fc.cells.reduce((a, c) => a + Object.values(c.sp).reduce((x, y) => x + y, 0), 0);
      const got = {
        cells: fc.cells.length,
        hot: fc.cells.filter((c) => c.s >= 50).length,
        species: fc.species.length,
        sumSp,
        digest: digest(fc),
      };
      if (process.env.SNAP_PRINT) console.log(d.date, JSON.stringify(got));
      expect(got).toEqual(EXPECT[d.date]);
    });
  }
});

describe("buildCellFeatures + scoreCell — một nguồn công thức", () => {
  it("chấm lại từng ô bằng scoreCell cho cùng điểm với buildFishForecast", () => {
    const d = FIXTURE_DAYS[1];
    const f = fixtureDay(d.seed, d.date);
    const extra = {
      anom: f.anom, cur: f.cur, thermo: f.thermo, depth: f.depth, bottomTemp: f.bottomTemp,
      deepTemp: f.deepTemp, reef: f.reef, climo: f.climo as never,
      frontSstFine: f.frontSstFine, frontChlFine: f.frontChlFine,
    };
    const fc = buildFishForecast(f.sst, f.chl, f.sla, d.month, extra);
    const feats = buildCellFeatures(f.sst, f.chl, f.sla, d.month, extra);
    expect(feats.length).toBeGreaterThan(100);
    const byKey = new Map(fc.cells.map((c) => [`${c.lat},${c.lon}`, c]));
    const prof = new Map(SPECIES_PROFILES.map((p) => [p.species, p]));
    let checked = 0;
    for (const F of feats) {
      const cell = byKey.get(`${Math.round(F.lat * 100) / 100},${Math.round(F.lon * 100) / 100}`);
      for (const [name, sW] of seasonWeights(F.regionId, d.month)) {
        const p = prof.get(name);
        if (!p) continue;
        const k = { climo: f.climo as never, month: d.month };
        const fit = scoreCell(F, p, sW, 0, 0, k);
        // habitat tính sẵn (đường fit) cho CÙNG điểm
        expect(scoreCell(F, p, sW, 0, 0, k, cellHabitat(F, p, 0, k))).toBe(fit);
        const v = Math.round(fit * 100);
        if (v >= 25) {
          expect(cell?.sp[p.short]).toBe(v);
          checked++;
        } else expect(cell?.sp[p.short]).toBeUndefined();
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("rawScores: điểm liên tục, không làm tròn, không cắt KEEP_MIN", () => {
    const d = FIXTURE_DAYS[1];
    const base = runDay(d);
    const raw = runDay(d, { rawScores: true });
    expect(raw.cells.length).toBeGreaterThanOrEqual(base.cells.length);
    let frac = 0, below = 0;
    for (const c of raw.cells) for (const v of Object.values(c.sp)) {
      if (Math.abs(v - Math.round(v)) > 1e-6) frac++;
      if (v < 25) below++;
    }
    expect(frac).toBeGreaterThan(0);
    expect(below).toBeGreaterThan(0);
    // làm tròn điểm liên tục ⇒ ra đúng bản thường (ô còn trong bản thường)
    const rawMap = new Map(raw.cells.map((c) => [`${c.lat},${c.lon}`, c]));
    for (const c of base.cells) {
      const rc = rawMap.get(`${c.lat},${c.lon}`)!;
      for (const [k, v] of Object.entries(c.sp)) expect(Math.round(rc.sp[k])).toBe(v);
    }
  });
});
