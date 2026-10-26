import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildFishForecast, FISH_ALGO_REV, fishModelSignature, type ScalarGrid } from "../fish-predict";
import type { FleetEffortGrid } from "../fleet-effort";
import { BASE_LAT_BINS, type BaseParams } from "../fish-base";

// NỐI NỀN "bãi cá theo mùa" vào buildFishForecast (đợt 2A, 2026-10-19). Số đo: ops/fish-train-review-2026-10-18 §7.9.
// Đọc file bằng readFileSync (không import JSON): cùng lý do với fish-blend.test.ts — build Vercel chạy TS trên file test.
const fileBase = JSON.parse(readFileSync(join(process.cwd(), "src", "data", "fish-base.v1.json"), "utf8")) as BaseParams;

/**
 * Số đo production mới trên nhãn v2 (§7.9, B = 500 — logs-v3d "Bảng E", 2026-10-19) — ghi để đổi nền mà tụt dưới
 * mức này thì test nhắc phải đo lại. Biến thể chủ dự án chọn = `base_irls` (nền logistic ≤5 hệ số/nhóm): 0,810 trên
 * MỌI ô lưới đo; app chỉ vẽ ô trong tầm `REGION_REACH_DEG` của vùng biển VN + sàn `KEEP_MIN` ⇒ 0,802 (đo tách:
 * bỏ KEEP_MIN 0,803, bỏ giới hạn vùng 0,809 — chênh là ô ngoài vùng biển VN, KHÔNG phải khác mô hình).
 */
const MEASURED = { withinGear: 0.802, baseIrlsWithinGear: 0.81, hotShare: 0.115, topOverMid: 2.3, fleetStaticWithinGear: 0.793 };

const KEEP_MIN = 25; // sàn payload (fish-predict KEEP_MIN, không export)
const lats = [12.525, 12.775, 13.025];
const lons = [115.275, 115.525, 115.775];
const g = (v: number, unit: ScalarGrid["unit"]): ScalarGrid => ({ lats, lons, values: lats.map(() => lons.map(() => v)), date: "2026-10-09", unit });
const tinyCatch = (kg: number): FleetEffortGrid => ({
  v: 1,
  axis: { lat0: 12.275, lon0: 115.025, step: 0.25, nLat: 5, nLon: 5 },
  gears: ["ngừ vằn"],
  months: ["2026-10"],
  days: { "2026-10": 30 },
  speciesGears: { "ngừ vằn": ["ngừ vằn"] },
  effort: { "2026-10": kg > 0 ? { "ngừ vằn": [[2, 2, kg]] } : {} },
});
const zeros = { depth: Array(11).fill(0), coast: Array(9).fill(0), lat: Array(BASE_LAT_BINS).fill(0) };
/** nền tay: chỉ ngừ vằn, chỉ kênh sản lượng (hệ số xc = 3) */
const handBase = (sameMonth = true): BaseParams => ({
  v: 1,
  builtAt: "test",
  mode: "irls",
  hotShare: 0.3,
  ksKg: { "ngừ vằn": 1000 },
  coef: { "pelagic-large": [-1, 3, 0, 0, 0] },
  coefNoCatch: { "pelagic-large": [-1, 0, 0, 0] },
  staticLift: { "ngừ vằn": zeros },
  fleetOnly: [],
  catchMonths: ["2026-10"],
  catchSameMonth: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), sameMonth])),
});
const run = (o: { chl?: number; sst?: number; month?: number; base?: BaseParams | null; catchKg?: number }) =>
  buildFishForecast(g(o.sst ?? 29.5, "degC"), g(o.chl ?? 0.3, "mg/m3"), null, o.month ?? 10, {
    depth: g(4000, "m"),
    catchGrid: tinyCatch(o.catchKg ?? 200000),
    base: o.base === undefined ? handBase() : o.base,
  });
const center = (f: ReturnType<typeof run>) => f.cells.find((c) => c.lat === 12.78 && c.lon === 115.53);

describe("tệp nền src/data/fish-base.v1.json", () => {
  it("hình dạng: 4 nhóm × 5 hệ số, ≤1 MB, ghi nguồn + ngày fit, tháng 11–12 thiếu kg", () => {
    expect(Object.keys(fileBase.coef).sort()).toEqual(["cephalopod", "other", "pelagic-large", "pelagic-small"]);
    for (const c of Object.values(fileBase.coef)) expect(c).toHaveLength(5);
    for (const c of Object.values(fileBase.coefNoCatch)) expect(c).toHaveLength(4);
    expect(readFileSync(join(process.cwd(), "src", "data", "fish-base.v1.json")).length).toBeLessThan(1024 * 1024);
    expect((fileBase.builtFrom as { fitDate?: string }).fitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fileBase.catchSameMonth["10"]).toBe(true);
    expect(fileBase.catchSameMonth["11"]).toBe(false);
    expect(fileBase.catchSameMonth["12"]).toBe(false);
    expect(fileBase.hotShare).toBeGreaterThan(0.05);
    expect(fileBase.hotShare).toBeLessThan(0.4);
    for (const t of Object.values(fileBase.staticLift)) {
      expect(t.depth).toHaveLength(11);
      expect(t.coast).toHaveLength(9);
      expect(t.lat).toHaveLength(BASE_LAT_BINS);
    }
  });

  it("biến thể production = base_irls (chủ dự án chọn 2026-10-19): mode irls, 4 nhóm có hệ số logistic thật", () => {
    // rank-combine (base_rank 0,778) thua tĩnh −0,027 ⇒ không được làm production; đổi mode là đổi mô hình ⇒ đo lại
    expect(fileBase.mode).toBe("irls");
    for (const c of [...Object.values(fileBase.coef), ...Object.values(fileBase.coefNoCatch)]) {
      expect(c.every(Number.isFinite)).toBe(true);
      expect(c.slice(1).some((v) => v !== 0)).toBe(true); // không phải hệ số rỗng (fit hỏng ⇒ mọi ô bằng nhau)
    }
    // phần chênh base_irls ↔ production chỉ là miền vẽ (vùng biển VN) + sàn payload, không vượt 0,01
    expect(MEASURED.baseIrlsWithinGear - MEASURED.withinGear).toBeLessThan(0.01);
  });

  it("số đo ghi lại thoả cổng 2A (bậc ≥75 ≥ 2× bậc dưới, ô ≥50 ≈ bản chốt 11,5 %)", () => {
    expect(MEASURED.topOverMid).toBeGreaterThanOrEqual(2);
    expect(Math.abs(MEASURED.hotShare - 0.115)).toBeLessThan(0.02);
    expect(MEASURED.withinGear).toBeGreaterThan(0.726 + 0.05);
    expect(MEASURED.fleetStaticWithinGear).toBeGreaterThan(0.726 + 0.05);
  });
});

describe("buildFishForecast với extra.base", () => {
  it("điểm nền đọc từ file: ô có sản lượng ngừ vằn xếp trên ô không có", () => {
    const f = run({});
    expect(f.baseMode).toBe("catch-fleet-static");
    const c = center(f)!;
    const others = f.cells.filter((x) => x !== c);
    expect(c.sp["ngừ vằn"]).toBeGreaterThanOrEqual(KEEP_MIN);
    for (const o of others) expect(c.sp["ngừ vằn"]).toBeGreaterThanOrEqual(o.sp["ngừ vằn"] ?? 0);
    expect(c.s).toBe(c.sp["ngừ vằn"]);
  });

  it("tháng chưa có kg loài (11–12) ⇒ baseMode fleet-static, KHÔNG dùng kg dù lưới có", () => {
    const f = run({ base: handBase(false), month: 11 });
    expect(f.baseMode).toBe("fleet-static");
    const vals = new Set(f.cells.map((x) => x.sp["ngừ vằn"] ?? 0));
    expect(vals.size).toBeLessThanOrEqual(1); // hệ số kênh sản lượng = 0 trong coefNoCatch ⇒ mọi ô bằng nhau
  });

  it("hint không ảnh hưởng s/sp: đổi phù du (đầu vào HSI) → s, sp y nguyên; hint luôn có why[] và sat ∈ [0,100] | null", () => {
    const a = run({ chl: 0.05, sst: 28 });
    const b = run({ chl: 1.5, sst: 28 });
    expect(b.cells.map((x) => [x.s, x.sp])).toEqual(a.cells.map((x) => [x.s, x.sp]));
    expect(a.cells.every((x) => x.hint !== undefined)).toBe(true);
    for (const x of [...a.cells, ...b.cells]) {
      expect(Array.isArray(x.hint?.why)).toBe(true);
      expect(x.hint?.sat === null || (x.hint!.sat >= 0 && x.hint!.sat <= 100)).toBe(true);
    }
  });

  it("cổng nhiệt GIỮ: nước ngoài dải chịu đựng ⇒ không vẽ loài, dù sản lượng lớn", () => {
    const cold = run({ sst: 18, catchKg: 10_000_000 });
    expect(cold.cells.some((c) => (c.sp["ngừ vằn"] ?? 0) > 0)).toBe(false);
  });

  it("mất nguồn chỉ GIẢM: bỏ lưới sản lượng ⇒ điểm ngừ vằn ô giữa không tăng", () => {
    const withCatch = center(run({}))!.sp["ngừ vằn"];
    const without = run({ catchKg: 0 });
    expect(center(without)?.sp["ngừ vằn"] ?? 0).toBeLessThanOrEqual(withCatch);
  });

  it("không truyền base ⇒ hành vi cũ (không baseMode, không hint)", () => {
    const f = run({ base: null });
    expect(f.baseMode).toBeUndefined();
    expect(f.cells.every((c) => c.hint === undefined)).toBe(true);
  });

  it("đổi cách tính ⇒ dấu vân tay mô hình đổi (FISH_ALGO_REV ≥ 2, có cờ cổng lịch mùa nền)", () => {
    expect(FISH_ALGO_REV).toBeGreaterThanOrEqual(2);
    expect(fishModelSignature()).toContain("BASE_SEASON_LIST_GATE");
  });
});
