import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DENSITY_MOONS,
  canSeeDensity,
  defaultDensityKey,
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
