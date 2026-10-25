import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DENSITY_MOONS,
  canSeeDensity,
  defaultDensityKey,
  densityCellAt,
  densitySpeciesAt,
  speciesAmountLabel,
  speciesKeyFor,
  seasonBase,
  moonFactors,
  windFactor,
  forecastFleetDensity,
  addDaysIso,
  FLEET_FORECAST_DAYS,
  densityCells,
  densityKeyLabel,
  densityKeys,
  densityLevel,
  moonBinOf,
  seasonOfMonth,
  type FleetDensity,
} from "../fleet-density";
import { moonPhase } from "../moon";

/** Lưới tí hon: trục thật, 2 ngày, 1 tháng, 1 mùa, 1 pha trăng. */
function tiny(): FleetDensity {
  return {
    v: 1,
    builtFrom: { months: ["2026-10"], from: "2026-10-01", to: "2026-10-02" },
    rule: { minVessels: 3 },
    axis: { lat0: 5.025, lon0: 102.025, step: 0.25, nLat: 69, nLon: 65 },
    gears: ["tat", "vay"],
    days: { day: { "2026-10-01": 1, "2026-10-02": 1 }, month: { "2026-10": 2 }, season: { bac: 2 }, moon: { "4": 2 } },
    day: {
      "2026-10-01": [[31, 54, 120, 5]], // 12 giờ · 5 tàu
      "2026-10-02": [[31, 54, 60, 3], [32, 54, 600, 12]],
    },
    month: { "2026-10": { tat: [[31, 54, 180, 6], [32, 54, 600, 12]], vay: [[32, 54, 600, 12]] } },
    season: { bac: { tat: [[31, 54, 180, 6]] } },
    moon: { "4": { tat: [[31, 54, 180, 6]] } },
    species: {
      tat: { "31,54": [["cá nục", 60], ["mực ống", 25]] },
      "10": { "31,54": [["cá nục", 80]] },
      bac: { "31,54": [["cá ngừ", 50], ["cá nục", 30]] },
    },
  };
}

describe("fleet-density — bãi tàu đánh theo ngày/tháng/mùa/trăng", () => {
  it("ô ra đúng toạ độ trục lưới cá, giờ chia theo ngày phủ, số tàu giữ nguyên", () => {
    const d = tiny();
    const [c] = densityCells(d, { mode: "day", key: "2026-10-01", gear: "tat" });
    expect(c.lat).toBeCloseTo(5.025 + 31 * 0.25, 6);
    expect(c.lon).toBeCloseTo(102.025 + 54 * 0.25, 6);
    expect(c.hoursPerDay).toBeCloseTo(12, 6);
    expect(c.vessels).toBe(5);
    // tháng: 18 giờ / 2 ngày phủ = 9 giờ/ngày
    const m = densityCells(d, { mode: "month", key: "2026-10", gear: "tat" });
    expect(m.find((x) => x.vessels === 6)?.hoursPerDay).toBeCloseTo(9, 6);
  });

  it("lát thiếu (ngày không có, nghề không có, mùa chưa có) ⇒ [] — không bịa", () => {
    const d = tiny();
    expect(densityCells(d, { mode: "day", key: "2026-09-30", gear: "tat" })).toEqual([]);
    expect(densityCells(d, { mode: "month", key: "2026-10", gear: "cau" })).toEqual([]);
    expect(densityCells(d, { mode: "season", key: "nam", gear: "tat" })).toEqual([]);
    expect(densityCells(d, { mode: "moon", key: "0", gear: "tat" })).toEqual([]);
  });

  it("mức theo phân vị TRONG lát: ô đông nhất = Đông, lát 1 ô = Thưa (không có gì để so)", () => {
    const d = tiny();
    const two = densityCells(d, { mode: "day", key: "2026-10-02", gear: "tat" });
    const lv = densityLevel(two);
    expect(lv.levelOf(two.find((c) => c.vessels === 12)!)).toBe(2);
    expect(lv.levelOf(two.find((c) => c.vessels === 3)!)).toBe(0);
    // 5 ô 1..5 giờ/ngày: p50 = 3 (Vừa từ 3), p85 = 4,4 (Đông chỉ ô 5)
    const five = [1, 2, 3, 4, 5].map((h) => ({ lat: 0, lon: 0, hoursPerDay: h, vessels: 3 }));
    expect(five.map((c) => densityLevel(five).levelOf(c))).toEqual([0, 0, 1, 1, 2]);
    const one = densityCells(d, { mode: "day", key: "2026-10-01", gear: "tat" });
    expect(densityLevel(one).levelOf(one[0])).toBe(0);
    expect(densityLevel([]).thresholds).toEqual([0, 0]);
  });

  it("khoá mặc định: ngày/tháng cuối có dữ liệu, mùa theo tháng hôm nay, trăng theo pha hôm nay", () => {
    const d = tiny();
    const today = new Date("2026-10-25T05:00:00Z");
    expect(defaultDensityKey(d, "day", today)).toBe("2026-10-02");
    expect(defaultDensityKey(d, "month", today)).toBe("2026-10");
    expect(defaultDensityKey(d, "season", today)).toBe("bac");
    expect(defaultDensityKey(d, "moon", today)).toBe(moonBinOf(today));
    expect(densityKeys(d, "day")).toEqual(["2026-10-01", "2026-10-02"]);
  });

  it("mùa: T4–T9 vụ Nam, còn lại vụ Bắc; pha trăng 0..7 khớp nhãn moon.ts (non ↔ non, rằm ↔ rằm)", () => {
    expect(seasonOfMonth(4)).toBe("nam");
    expect(seasonOfMonth(9)).toBe("nam");
    expect(seasonOfMonth(10)).toBe("bac");
    expect(seasonOfMonth(3)).toBe("bac");
    // quét 60 ngày: pha 0 chỉ khi moon.ts nói "Trăng non", pha 4 chỉ khi "Trăng rằm"
    for (let k = 0; k < 60; k++) {
      const dt = new Date(Date.UTC(2026, 0, 1 + k, 12));
      const bin = moonBinOf(dt);
      const label = moonPhase(dt).label;
      if (bin === "0") expect(label).toMatch(/Trăng non/);
      if (bin === "4") expect(label).toMatch(/rằm — sáng/);
      if (label.startsWith("Trăng non")) expect(bin).toBe("0");
      if (label.startsWith("Trăng rằm")) expect(bin).toBe("4");
    }
    expect(DENSITY_MOONS).toHaveLength(8);
  });

  it("xem trước nội bộ: chỉ số trong danh sách (chấp nhận +84), còn lại không thấy", () => {
    expect(canSeeDensity("0938635689")).toBe(true);
    expect(canSeeDensity("+84938635689")).toBe(true);
    expect(canSeeDensity("0900000777")).toBe(false);
    expect(canSeeDensity(null)).toBe(false);
    expect(canSeeDensity("")).toBe(false);
  });

  it("loài hay đánh theo ô: khoá theo lát (ngày/tháng → tháng, mùa → mùa, trăng → cả năm), lùi về cả năm khi trống", () => {
    const d = tiny();
    const lat = 5.025 + 31 * 0.25, lon = 102.025 + 54 * 0.25;
    expect(speciesKeyFor({ mode: "day", key: "2026-10-02", gear: "tat" })).toBe("10");
    expect(speciesKeyFor({ mode: "moon", key: "4", gear: "tat" })).toBe("tat");
    expect(densitySpeciesAt(d, { mode: "day", key: "2026-10-02", gear: "tat" }, lat, lon)).toEqual([["cá nục", 80]]);
    expect(densitySpeciesAt(d, { mode: "season", key: "bac", gear: "tat" }, lat, lon)[0]).toEqual(["cá ngừ", 50]);
    expect(densitySpeciesAt(d, { mode: "moon", key: "4", gear: "tat" }, lat, lon)).toHaveLength(2);
    expect(densitySpeciesAt(d, { mode: "month", key: "2026-09", gear: "tat" }, lat, lon)).toHaveLength(2); // tháng 9 trống → cả năm
    expect(densitySpeciesAt(d, { mode: "day", key: "2026-10-02", gear: "tat" }, lat + 0.2, lon)).toEqual([]); // ngoài nửa ô
    expect(densitySpeciesAt({ ...d, species: undefined }, { mode: "day", key: "2026-10-02", gear: "tat" }, lat, lon)).toEqual([]);
    const cells = densityCells(d, { mode: "day", key: "2026-10-02", gear: "tat" });
    expect(densityCellAt(cells, 0.25, lat + 0.1, lon - 0.1)?.vessels).toBe(3);
    expect(densityCellAt(cells, 0.25, lat + 0.25, lon)?.vessels).toBe(12);
    expect(densityCellAt(cells, 0.25, 20, 110)).toBeNull();
  });

  it("mức loài: ≥40 nhiều, ≥20 trung bình, còn lại ít", () => {
    expect(speciesAmountLabel(80)).toBe("nhiều");
    expect(speciesAmountLabel(40)).toBe("nhiều");
    expect(speciesAmountLabel(21)).toBe("trung bình");
    expect(speciesAmountLabel(5)).toBe("ít");
  });

  it("nhãn khoá đọc được", () => {
    expect(densityKeyLabel("day", "2026-10-02")).toBe("2/10/2026");
    expect(densityKeyLabel("month", "2026-10")).toBe("Tháng 10/2026");
    expect(densityKeyLabel("season", "nam")).toBe("Vụ Nam");
    expect(densityKeyLabel("moon", "4")).toBe("Rằm");
  });
});

describe("fleet-density — file thật public/data/fleet-density.v1.json (riêng tư + hình dạng)", () => {
  const file = path.join(process.cwd(), "public/data/fleet-density.v1.json");
  const d = JSON.parse(fs.readFileSync(file, "utf8")) as FleetDensity;

  it("cùng trục lưới cá, có đủ 4 chế độ, mọi ô ≥3 tàu, không có khoá định danh tàu", { timeout: 20000 }, () => {
    expect(d.v).toBe(1);
    expect(d.axis).toEqual({ lat0: 5.025, lon0: 102.025, step: 0.25, nLat: 69, nLon: 65 });
    expect(Object.keys(d.day).length).toBeGreaterThan(100);
    expect(Object.keys(d.month).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(d.season)).toEqual(expect.arrayContaining(["nam", "bac"]));
    expect(Object.keys(d.moon)).toHaveLength(8);
    const rows: number[][] = [
      ...Object.values(d.day).flat(),
      ...Object.values(d.month).flatMap((g) => Object.values(g).flat()),
      ...Object.values(d.season).flatMap((g) => Object.values(g!).flat()),
      ...Object.values(d.moon).flatMap((g) => Object.values(g).flat()),
    ];
    expect(rows.length).toBeGreaterThan(1000);
    let bad = 0;
    for (const r of rows) {
      if (r.length !== 4 || r[3] < d.rule.minVessels || r[0] < 0 || r[0] >= d.axis.nLat || r[1] < 0 || r[1] >= d.axis.nLon) bad++;
    }
    expect(bad).toBe(0);
    const raw = fs.readFileSync(file, "utf8");
    expect(raw).not.toMatch(/-TS"/); // số đăng ký kiểu "QNa-91579-TS"
    expect(raw).not.toMatch(/"VF[0-9A-F]{9}"/); // mã định danh tàu
    expect(raw).not.toMatch(/VMS|snapshot|carrier|gearMap|bands|IBTrACS/i); // file ra ngoài không mang dấu vết nguồn
  });

  it("bảng loài: có khoá mùa + cả năm, mỗi ô ≤3 loài, % 5..100, tên ngắn không rỗng", () => {
    const sp = d.species!;
    expect(sp.tat && sp.nam && sp.bac).toBeTruthy();
    let n = 0;
    for (const byCell of Object.values(sp)) for (const top of Object.values(byCell)) {
      n++;
      if (top.length > 3 || top.some(([name, p]) => !name || p < 5 || p > 100)) throw new Error(JSON.stringify(top));
    }
    expect(n).toBeGreaterThan(1000);
  });

  it("trăng chia đều 8 pha (không pha nào trống), tổng ngày phủ ≥ 10 tháng", () => {
    for (const k of DENSITY_MOONS) expect(d.days.moon[k.id]).toBeGreaterThan(20);
    expect(Object.values(d.days.month).reduce((a, b) => a + b, 0)).toBeGreaterThan(250);
  });

  it("ngày bão: có trong lát Ngày (ghi chú) nhưng ĐÃ LOẠI khỏi ngày phủ của tháng/mùa/trăng", () => {
    const storms = d.storms ?? {};
    const stormDaysWithData = Object.keys(storms).filter((k) => d.day[k]);
    expect(stormDaysWithData.length).toBeGreaterThan(5); // 9 cơn 12/2025–10/2026
    const dayCount = Object.keys(d.day).length;
    const monthDays = Object.values(d.days.month).reduce((a, b) => a + b, 0);
    expect(monthDays).toBe(dayCount - stormDaysWithData.length);
    expect(Object.values(d.days.season).reduce((a, b) => a + b, 0)).toBe(monthDays);
    // trăng: pha đổi giữa ngày ⇒ một ngày có thể đếm ở HAI pha ⇒ tổng ≥ tháng, nhưng không quá 1 ngày/lần đổi pha
    const moonDays = Object.values(d.days.moon).reduce((a, b) => a + b, 0);
    expect(moonDays).toBeGreaterThanOrEqual(monthDays);
    expect(moonDays).toBeLessThanOrEqual(monthDays + Math.ceil(monthDays / 3.5));
  });
});

describe("fleet-density — DỰ BÁO 16 ngày (mùa × trăng × gió × bão, theo nghề)", () => {
  function fx(): FleetDensity {
    const d = tiny();
    d.month = {
      "2026-10": { tat: [[31, 54, 200, 10], [32, 54, 400, 20]], vay: [[32, 54, 300, 15]] },
      "2026-09": { tat: [[31, 54, 100, 5]] },
    };
    d.days = { ...d.days, month: { "2026-10": 2, "2026-09": 1 }, moon: { "0": 1, "4": 1 } };
    d.moon = { "4": { tat: [[31, 54, 300, 6]] }, "0": { tat: [[31, 54, 100, 6]] } };
    d.species = { tat: { "31,54": [["cá nục", 50], ["mực ống", 50]] } };
    return d;
  }
  const today = "2026-10-25";

  it("nền tháng cùng tháng-trong-năm; tháng thiếu lấy hai tháng kề ×0,5", () => {
    const d = fx();
    const oct = seasonBase(d, "10");
    expect(oct.get(`${5.025 + 31 * 0.25},${102.025 + 54 * 0.25}`)?.hoursPerDay).toBeCloseTo(10, 6); // 200/10/2 ngày
    const nov = seasonBase(d, "11"); // không có 11 ⇒ 10 + 12 (12 trống) ⇒ chỉ 10 với w 0,5 / wSum 0,5
    expect(nov.get(`${5.025 + 31 * 0.25},${102.025 + 54 * 0.25}`)?.hoursPerDay).toBeCloseTo(10, 6);
    expect(seasonBase(d, "03").size).toBe(0);
  });

  it("trăng: pha rằm 30 giờ/ngày ÷ trung bình (30+10)/8 = 5 ⇒ kẹp trần 1,5; pha non 10/5 = 2 ⇒ 1,5; pha không số liệu ⇒ không có hệ số", () => {
    const d = fx();
    const id = `${5.025 + 31 * 0.25},${102.025 + 54 * 0.25}`;
    expect(moonFactors(d, "4").get(id)).toBe(1.5);
    expect(moonFactors(d, "0").get(id)).toBe(1.5);
    expect(moonFactors(d, "2").size).toBe(0);
  });

  it("gió theo ranh Beaufort, bão ×0,1, thiếu gió ⇒ 1 + cờ windMissing", () => {
    expect(windFactor(20)).toBe(1);
    expect(windFactor(39)).toBe(0.6);
    expect(windFactor(50)).toBe(0.3);
    expect(windFactor(62)).toBe(0.1);
    expect(windFactor(undefined)).toBe(1);
    const d = fx();
    const calm = forecastFleetDensity({ d, todayIso: today, dayOffset: 0, gear: "tat" });
    expect(calm.windMissing).toBe(true);
    expect(calm.storm).toBe(false);
    expect(calm.cells.length).toBe(2);
    const stormy = forecastFleetDensity({ d, todayIso: today, dayOffset: 0, gear: "tat", stormDays: new Set([today]) });
    expect(stormy.storm).toBe(true);
    for (const c of stormy.cells) expect(c.level).toBe(0); // rớt mức vì ngưỡng lấy từ nền
    const windy = forecastFleetDensity({
      d, todayIso: today, dayOffset: 1, gear: "tat",
      wind: [{ lat: 12.775, lon: 115.525, byDate: { "2026-10-26": 70 } }],
    });
    expect(windy.windMissing).toBe(false);
    expect(windy.dateIso).toBe("2026-10-26");
    for (const c of windy.cells) expect(c.value).toBeLessThanOrEqual(0.1 * c.hoursPerDay * 1.5 + 1e-9); // gió ≥ cấp 8 ⇒ ×0,1
  });

  it("lọc theo nghề: nền + trăng lấy đúng lát nghề đó; nghề không có số liệu ⇒ không ô", () => {
    const d = fx();
    const vay = forecastFleetDensity({ d, todayIso: today, dayOffset: 0, gear: "vay" });
    expect(vay.cells).toHaveLength(1);
    expect(vay.cells[0].lat).toBeCloseTo(5.025 + 32 * 0.25, 6);
    expect(vay.cells[0].hoursPerDay).toBeCloseTo(15, 6); // 300/10/2 ngày; trăng pha này không có số liệu nghề vây ⇒ 1
    expect(forecastFleetDensity({ d, todayIso: today, dayOffset: 0, gear: "cau" }).cells).toHaveLength(0);
    expect(seasonBase(d, "10", "vay").size).toBe(1);
  });

  it("16 ngày: addDaysIso qua tháng, mỗi ngày tự có pha trăng", () => {
    expect(addDaysIso("2026-10-25", 15)).toBe("2026-11-09");
    const d = fx();
    const bins = new Set<string>();
    for (let k = 0; k < FLEET_FORECAST_DAYS; k++) bins.add(forecastFleetDensity({ d, todayIso: today, dayOffset: k, gear: "tat" }).moonBin);
    expect(bins.size).toBeGreaterThan(2);
  });
});
