import { describe, expect, it } from "vitest";
import {
  CLIMO_EDGE_MARGIN_C,
  seasonalThermalBand,
  type SstClimatology,
  type ThermalBand,
} from "@/lib/thermal-band";
import { SPECIES_PROFILES, buildFishForecast, trapezoid, type ScalarGrid } from "@/lib/fish-predict";
import climoJson from "@/data/sst-climatology.v1.json";
import { FISH_REGIONS } from "@/data/fish-seasons";

const CLIMO = climoJson.regions as SstClimatology;
const m = CLIMO_EDGE_MARGIN_C;

describe("seasonalThermalBand — dải nhiệt lai (C3, 2026-10-03e)", () => {
  const prof: ThermalBand = [20, 25, 28, 31];
  const climo: SstClimatology = {
    "trung-bo": { "7": { p25: 29.5, p75: 30.4, n: 100 }, "1": { p25: 23.5, p75: 25, n: 100 } },
  };

  it("thiếu bảng / vùng / tháng ⇒ trả đúng dải hồ sơ (hành vi cũ)", () => {
    expect(seasonalThermalBand(prof, "trung-bo", 7, null)).toBe(prof);
    expect(seasonalThermalBand(prof, "trung-bo", 7, undefined)).toBe(prof);
    expect(seasonalThermalBand(prof, "hoang-sa", 7, climo)).toBe(prof);
    expect(seasonalThermalBand(prof, "trung-bo", 3, climo)).toBe(prof);
    expect(
      seasonalThermalBand(prof, "x", 7, { x: { "7": { p25: NaN, p75: 30, n: 1 } } }),
    ).toBe(prof);
  });

  it("nước mùa hè nóng hơn trần c ⇒ NỚI c lên p75, giữ a/d; sàn b không co lại", () => {
    // p25 = 29,5 > b = 25 ⇒ b giữ (chỉ nới, không co); p75 = 30,4 > c = 28 ⇒ c' = 30,4
    expect(seasonalThermalBand(prof, "trung-bo", 7, climo)).toEqual([20, 25, 30.4, 31]);
  });

  it("nước mùa đông lạnh hơn sàn b ⇒ HẠ b xuống p25; trần c giữ", () => {
    expect(seasonalThermalBand(prof, "trung-bo", 1, climo)).toEqual([20, 23.5, 28, 31]);
  });

  it("không bao giờ vượt [a+δ, d−δ] — biên chịu đựng sinh học là chốt cuối", () => {
    const hot: SstClimatology = { r: { "7": { p25: 10, p75: 40, n: 9 } } };
    expect(seasonalThermalBand(prof, "r", 7, hot)).toEqual([20, 20 + m, 31 - m, 31]);
  });

  it("CHỈ NỚI: với mọi hồ sơ × vùng × tháng của bảng thật, tFit lai ≥ tFit hồ sơ ở mọi nhiệt độ", () => {
    for (const p of SPECIES_PROFILES)
      for (const rg of FISH_REGIONS)
        for (let month = 1; month <= 12; month++) {
          const h = seasonalThermalBand(p.sst, rg.id, month, CLIMO);
          const [a, b, c, d] = p.sst;
          expect(h[0]).toBe(a);
          expect(h[3]).toBe(d);
          expect(h[1]).toBeLessThanOrEqual(b);
          expect(h[1]).toBeGreaterThanOrEqual(a);
          expect(h[2]).toBeGreaterThanOrEqual(c);
          expect(h[2]).toBeLessThanOrEqual(d);
          expect(h[1]).toBeLessThanOrEqual(h[2]);
          for (let t = 15; t <= 35; t += 0.25)
            expect(trapezoid(t, h[0], h[1], h[2], h[3])).toBeGreaterThanOrEqual(
              trapezoid(t, a, b, c, d) - 1e-12,
            );
        }
  });

  describe("nối vào buildFishForecast qua extra.climo", () => {
    // lưới 4×4 ven bờ Trung Bộ, nước 29,6–31,0 °C (nóng hơn trần c=29 của vài
    // loài) — đúng ca "phạt oan" tháng 9; đáy 60 m để loài ven bờ còn sống
    const la = [15.0, 15.25, 15.5, 15.75];
    const lo = [108.6, 108.85, 109.1, 109.35];
    const g4 = (f: (i: number, j: number) => number, unit: ScalarGrid["unit"]): ScalarGrid => ({
      lats: la,
      lons: lo,
      values: la.map((_, i) => lo.map((__, j) => f(i, j))),
      date: "2026-09-30",
      unit,
    });
    const sst = g4((i, j) => 29.6 + 0.3 * i + 0.15 * j, "degC");
    const chl = g4((i, j) => 0.3 + 0.1 * j + 0.05 * i, "mg/m3");
    const depth = g4(() => 60, "m");
    const bottomTemp = g4((i) => 24 + 0.5 * i, "degC");
    const table = (f: ReturnType<typeof buildFishForecast>) => {
      const t = new Map<string, number>();
      for (const c of f.cells) for (const [k, v] of Object.entries(c.sp)) t.set(`${c.lat},${c.lon}|${k}`, v);
      return t;
    };
    const without = table(buildFishForecast(sst, chl, null, 9, { depth, bottomTemp }));
    const withClimo = table(buildFishForecast(sst, chl, null, 9, { depth, bottomTemp, climo: CLIMO }));

    it("có bảng ≥ không bảng ở MỌI ô × loài (mất bảng không bao giờ làm điểm tăng)", () => {
      expect(without.size).toBeGreaterThan(10);
      const fell: string[] = [];
      for (const [k, v] of without) if ((withClimo.get(k) ?? 0) < v) fell.push(k);
      expect(fell).toEqual([]);
    });

    it("loài trần 29 °C trong nước 29,6–31 °C được GỠ phạt oan (điểm tăng ở ít nhất một ô)", () => {
      const rose = [...withClimo].filter(([k, v]) => v > (without.get(k) ?? 0));
      expect(rose.length).toBeGreaterThan(0);
      // cá sòng [23,25,29,31] đang vụ Trung Bộ tháng 9 là ca điển hình
      expect(rose.some(([k]) => k.endsWith("|cá sòng"))).toBe(true);
    });

    it("loài đáy đang chấm nhiệt ĐÁY HYCOM không bị khí hậu MẶT đụng vào", () => {
      const bottomSpecies = SPECIES_PROFILES.filter((p) => p.tempSource === "bottom").map((p) => p.short);
      for (const [k, v] of without) {
        const sp = k.split("|")[1];
        if (bottomSpecies.includes(sp)) expect(withClimo.get(k), k).toBe(v);
      }
    });
  });

  it("bảng thật đủ 7 vùng × 12 tháng, p25 ≤ p75, nằm trong nước nhiệt đới (15–35 °C)", () => {
    for (const rg of FISH_REGIONS)
      for (let month = 1; month <= 12; month++) {
        const c = CLIMO[rg.id]?.[String(month)];
        expect(c, `${rg.id} tháng ${month}`).toBeDefined();
        expect(c.p25).toBeLessThanOrEqual(c.p75);
        expect(c.p25).toBeGreaterThan(15);
        expect(c.p75).toBeLessThan(35);
        expect(c.n).toBeGreaterThan(100);
      }
  });
});
