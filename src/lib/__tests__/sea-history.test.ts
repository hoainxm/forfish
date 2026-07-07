import { describe, expect, it } from "vitest";
import {
  FISH_STORE_MIN_SCORE,
  toFishDailyRows,
  toSeaDailyRows,
  toStormRows,
  vnToday,
} from "@/lib/sea-history";
import type { ScoredSeaDay } from "@/lib/sea";
import type { FishForecast } from "@/lib/fish-predict";
import type { StormAlert } from "@/lib/storms";

const day = (date: string, over: Partial<ScoredSeaDay> = {}): ScoredSeaDay => ({
  date,
  waveMaxM: 0.5,
  windMaxKmh: 15,
  gustMaxKmh: 30,
  precipMm: 2,
  wmoCode: 3,
  score: 88,
  level: "good",
  ...over,
});

describe("toSeaDailyRows", () => {
  it("tính lead_days theo ngày thu", () => {
    const rows = toSeaDailyRows("2026-07-02", "vung-tau", [
      day("2026-07-02"),
      day("2026-07-03"),
      day("2026-07-11"),
    ]);
    expect(rows.map((r) => r.lead_days)).toEqual([0, 1, 9]);
    expect(rows[0]).toMatchObject({
      collected_on: "2026-07-02",
      port_id: "vung-tau",
      wave_max_m: 0.5,
      score: 88,
    });
  });

  it("bỏ ngày quá khứ (lead âm), giữ null cho số thiếu", () => {
    const rows = toSeaDailyRows("2026-07-02", "cat-ba", [
      day("2026-07-01"),
      day("2026-07-02", { wmoCode: null, waveMaxM: NaN }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].wmo_code).toBe(null);
    expect(rows[0].wave_max_m).toBe(null);
  });

  it("lead_days qua tháng/năm đúng (không lệch múi giờ)", () => {
    const rows = toSeaDailyRows("2026-12-30", "sa-ky", [day("2027-01-02")]);
    expect(rows[0].lead_days).toBe(3);
  });
});

describe("toFishDailyRows", () => {
  const forecast: FishForecast = {
    ok: true,
    date: "2026-07-01",
    species: ["nục", "ngừ"],
    cells: [
      { lat: 12.5, lon: 110.0, s: 82, top: ["nục"], sp: { nục: 82 }, t: 28.4, c: 0.31 },
      { lat: 13.0, lon: 110.5, s: FISH_STORE_MIN_SCORE, top: ["ngừ"], sp: { ngừ: 60 }, t: 27.1, c: null },
      { lat: 13.5, lon: 111.0, s: FISH_STORE_MIN_SCORE - 1, top: [], sp: {}, t: 26.0, c: 0.2 },
    ],
  };

  it("chỉ giữ ô đạt ngưỡng hotspot", () => {
    const rows = toFishDailyRows("2026-07-02", forecast);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      collected_on: "2026-07-02",
      source_date: "2026-07-01",
      score: 82,
      top_species: ["nục"],
      sst_c: 28.4,
      chl_mg_m3: 0.31,
    });
    expect(rows[1].chl_mg_m3).toBe(null);
  });
});

describe("toStormRows", () => {
  it("map đủ trường, updated rỗng → null", () => {
    const storms: StormAlert[] = [
      {
        id: "GDACS-1",
        name: "WUTIP",
        kindLabel: "Bão",
        windKmh: 110,
        lat: 15.2,
        lon: 112.8,
        alert: "danger",
        updated: "",
      },
    ];
    const rows = toStormRows("2026-07-02", storms);
    expect(rows[0]).toMatchObject({
      storm_id: "GDACS-1",
      name: "WUTIP",
      alert: "danger",
      wind_kmh: 110,
      updated_src: null,
    });
  });
});

describe("vnToday", () => {
  it("giờ UTC tối muộn vẫn ra ngày hôm sau theo VN (UTC+7)", () => {
    expect(vnToday(new Date("2026-07-02T18:30:00Z"))).toBe("2026-07-03");
    expect(vnToday(new Date("2026-07-02T16:59:00Z"))).toBe("2026-07-02");
  });
});
