import { describe, expect, it } from "vitest";
import {
  mergeForecastGrids,
  mergeScalarGrids,
  mergeSeaDays,
  mergedSavedAt,
  gridDaysMissing,
  SOURCE_MAX_AGE_MS,
  type GridSource,
  type SeaSource,
} from "../snapshot-merge";
import type { ForecastGrid, GridHour } from "../forecast-grid";
import type { ScalarGrid } from "../scalar-field";
import { scoreDay, levelOf, type ScoredSeaDay } from "../sea";

const NOW = Date.parse("2026-07-29T12:00:00Z");
const H6 = 6 * 60 * 60 * 1000;

/** Lưới 2 ô × 2 ngày (2 tick/ngày), giá trị gió = `wind`, sóng = `wave` theo ngày */
function grid(perDay: { wind?: number | null; wave?: number | null; cur?: number | null }[]): ForecastGrid {
  const times: string[] = [];
  perDay.forEach((_, d) => {
    times.push(`2026-07-${29 + d}T00:00`, `2026-07-${29 + d}T12:00`);
  });
  const hour = (d: number): GridHour => ({
    windKmh: perDay[d].wind ?? null,
    windDirDeg: perDay[d].wind != null ? 90 : null,
    waveM: perDay[d].wave ?? null,
    waveDirDeg: perDay[d].wave != null ? 180 : null,
    curKmh: perDay[d].cur ?? null,
    curDirDeg: perDay[d].cur != null ? 45 : null,
  });
  const hours = perDay.flatMap((_, d) => [hour(d), hour(d)]);
  return {
    cells: [
      { lat: 10, lon: 110, hours },
      { lat: 12, lon: 110, hours },
    ],
    times,
  };
}

describe("mergeForecastGrids — mới thắng, ngày thiếu lấy từ bản dài", () => {
  it("nguồn MỚI phủ ngày 1, ngày 2 chỉ bản CŨ dài hơn có → ghép đúng công thức final", () => {
    const fresh: GridSource = {
      id: "ecmwf",
      savedAt: NOW,
      grid: grid([{ wind: 20, wave: 1 }, { wind: null, wave: null }]),
    };
    const old: GridSource = {
      id: "om",
      savedAt: NOW - H6,
      grid: grid([{ wind: 30, wave: 2 }, { wind: 25, wave: 1.5 }]),
    };
    const m = mergeForecastGrids([old, fresh], NOW)!;
    // ngày 1: nguồn mới (20 km/h) thắng dù nguồn cũ có số
    expect(m.cells[0].hours[0].windKmh).toBe(20);
    // ngày 2: chỉ bản cũ có → lấy bản cũ (25 km/h)
    expect(m.cells[0].hours[2].windKmh).toBe(25);
    expect(m.cells[0].hours[2].waveM).toBe(1.5);
    // stamps nói thật nguồn nào ngày nào
    const ids = Object.fromEntries(m.sources.map((s) => [s.id, s.days]));
    expect(ids["ecmwf"]).toEqual(["2026-07-29"]);
    expect(ids["om"]).toEqual(["2026-07-30"]);
    expect(mergedSavedAt(m.sources)).toBe(NOW);
  });

  it("KHÔNG trộn trong một ngày: nguồn mới có số nửa ngày vẫn ăn CẢ ngày của nhóm", () => {
    // nguồn mới chỉ có tick 00h (tick 12h null) — vẫn được chọn cho cả ngày,
    // tick 12h ra null chứ KHÔNG vá bằng nguồn cũ (chống răng cưa trong ngày)
    const freshGrid = grid([{ wind: 20 }]);
    freshGrid.cells.forEach((c) => {
      c.hours[1] = { ...c.hours[1], windKmh: null, windDirDeg: null };
    });
    const fresh: GridSource = { id: "ecmwf", savedAt: NOW, grid: freshGrid };
    const old: GridSource = {
      id: "om",
      savedAt: NOW - H6,
      grid: grid([{ wind: 30 }]),
    };
    const m = mergeForecastGrids([old, fresh], NOW)!;
    expect(m.cells[0].hours[0].windKmh).toBe(20);
    expect(m.cells[0].hours[1].windKmh).toBeNull();
  });

  it("ghép theo NHÓM ĐỘC LẬP: gió của nguồn mới + sóng của nguồn cũ (mới không có sóng)", () => {
    const fresh: GridSource = {
      id: "ecmwf",
      savedAt: NOW,
      grid: grid([{ wind: 20, wave: null }]),
    };
    const old: GridSource = {
      id: "om",
      savedAt: NOW - H6,
      grid: grid([{ wind: 30, wave: 2 }]),
    };
    const m = mergeForecastGrids([old, fresh], NOW)!;
    expect(m.cells[0].hours[0].windKmh).toBe(20);
    expect(m.cells[0].hours[0].waveM).toBe(2);
  });

  it("nguồn lastResort (WAV) CHỈ được chọn khi không nguồn thường nào phủ", () => {
    const wav: GridSource = {
      id: "copernicus-wav",
      savedAt: NOW,
      lastResort: true,
      grid: grid([{ wave: 3 }, { wave: 2.5 }]),
    };
    const oldOm: GridSource = {
      id: "om",
      savedAt: NOW - H6,
      grid: grid([{ wave: 2 }, {}]),
    };
    const m = mergeForecastGrids([wav, oldOm], NOW)!;
    // ngày 1: OM cũ vẫn thắng WAV tươi (WAV là vét cuối)
    expect(m.cells[0].hours[0].waveM).toBe(2);
    // ngày 2: OM không phủ → WAV vào
    expect(m.cells[0].hours[2].waveM).toBe(2.5);
  });

  it("nguồn quá 48h bị loại; không còn nguồn nào → null", () => {
    const tooOld: GridSource = {
      id: "om",
      savedAt: NOW - SOURCE_MAX_AGE_MS - 1000,
      grid: grid([{ wind: 30 }]),
    };
    expect(mergeForecastGrids([tooOld], NOW)).toBeNull();
  });

  it("gridDaysMissing chỉ ra ngày trống của một nhóm", () => {
    const g = grid([{ wind: 20, cur: 1 }, { wind: 20, cur: null }]);
    expect(gridDaysMissing(g, "current")).toEqual(["2026-07-30"]);
    expect(gridDaysMissing(g, "wind")).toEqual([]);
  });
});

describe("mergeScalarGrids", () => {
  function sgrid(vals: (number | null)[]): ScalarGrid {
    return {
      kind: "cloud",
      times: vals.flatMap((_, d) => [`2026-07-${29 + d}T00:00`, `2026-07-${29 + d}T12:00`]),
      nLat: 1,
      nLon: 2,
      cells: [
        { lat: 10, lon: 110, values: vals.flatMap((v) => [v, v]) },
        { lat: 10, lon: 112, values: vals.flatMap((v) => [v, v]) },
      ],
    };
  }

  it("mới thắng theo ngày, ngày thiếu lấy bản cũ", () => {
    const m = mergeScalarGrids(
      [
        { id: "om", savedAt: NOW - H6, grid: sgrid([80, 60]) },
        { id: "ecmwf", savedAt: NOW, grid: sgrid([40, null]) },
      ],
      NOW,
    )!;
    expect(m.cells[0].values[0]).toBe(40); // ngày 1 nguồn mới
    expect(m.cells[0].values[2]).toBe(60); // ngày 2 chỉ nguồn cũ có
    expect(m.kind).toBe("cloud");
  });

  it("nguồn lệch cỡ lưới bị bỏ, không đoán ô", () => {
    const odd = sgrid([50]);
    odd.cells = odd.cells.slice(0, 1); // lệch số ô
    const m = mergeScalarGrids(
      [
        { id: "om", savedAt: NOW - H6, grid: sgrid([70]) },
        { id: "ecmwf", savedAt: NOW, grid: odd },
      ],
      NOW,
    )!;
    expect(m.cells[0].values[0]).toBe(70);
  });
});

describe("mergeSeaDays — chấm LẠI điểm sau ghép", () => {
  const day = (
    date: string,
    windMaxKmh: number,
    waveMaxM: number,
    waveEstimated = false,
  ): ScoredSeaDay => {
    const d = {
      date,
      waveMaxM,
      windMaxKmh,
      gustMaxKmh: windMaxKmh + 10,
      precipMm: 0,
      wmoCode: 1,
      waveEstimated,
    };
    const score = scoreDay(d);
    return { ...d, score, level: levelOf(score) };
  };

  it("gió lấy nguồn mới, sóng ƯU TIÊN nguồn có số THẬT (không phải ước) + điểm tính lại", () => {
    const fresh: SeaSource = {
      id: "ecmwf",
      savedAt: NOW,
      // nguồn mới: sóng chỉ là ƯỚC từ gió
      days: [day("2026-07-29", 18, 0.8, true)],
    };
    const old: SeaSource = {
      id: "om",
      savedAt: NOW - H6,
      days: [day("2026-07-29", 30, 2.4, false)],
    };
    const m = mergeSeaDays([old, fresh], NOW)!;
    const d0 = m.days[0];
    expect(d0.windMaxKmh).toBe(18); // gió nguồn mới
    expect(d0.waveMaxM).toBe(2.4); // sóng THẬT của nguồn cũ thắng sóng ước mới
    expect(d0.waveEstimated).toBe(false);
    // điểm phải là điểm của BỘ SỐ GHÉP, không phải điểm nguồn nào mang sang
    expect(d0.score).toBe(scoreDay(d0));
    expect(d0.level).toBe(levelOf(d0.score));
  });

  it("ngày đuôi chỉ bản dài cũ có → vẫn vào; không nguồn nào có sóng thật → ước từ gió", () => {
    const fresh: SeaSource = {
      id: "ecmwf",
      savedAt: NOW,
      days: [day("2026-07-29", 15, 1.0)],
    };
    const old: SeaSource = {
      id: "om",
      savedAt: NOW - H6,
      days: [day("2026-07-29", 20, 1.2), day("2026-08-12", 22, 0, true)],
    };
    const m = mergeSeaDays([old, fresh], NOW)!;
    expect(m.days.map((d) => d.date)).toEqual(["2026-07-29", "2026-08-12"]);
    const tail = m.days[1];
    expect(tail.windMaxKmh).toBe(22);
    expect(tail.waveEstimated).toBe(true); // không ai có sóng thật → ước
    expect(tail.waveMaxM).toBeGreaterThan(0);
  });

  it("mọi nguồn quá tuổi → null", () => {
    const old: SeaSource = {
      id: "om",
      savedAt: NOW - SOURCE_MAX_AGE_MS - 1,
      days: [day("2026-07-29", 20, 1.2)],
    };
    expect(mergeSeaDays([old], NOW)).toBeNull();
  });
});
