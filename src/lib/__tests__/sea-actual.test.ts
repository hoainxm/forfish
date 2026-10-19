import { describe, it, expect } from "vitest";
import { actualWindow, actualUrls, portActualByDay, buildActualDayFiles, actualFileHasData } from "@/lib/sea-actual";

describe("sea-actual — thực tế ERA5 theo ngày cho 10 cảng", () => {
  it("cửa sổ = [hôm nay−9, hôm nay−5] (ERA5 trễ 5 ngày, lấy 5 ngày để tự lấp lỗ)", () => {
    expect(actualWindow("2026-10-19")).toEqual({ start: "2026-10-10", end: "2026-10-14" });
    expect(actualWindow("2026-01-03")).toEqual({ start: "2025-12-25", end: "2025-12-29" }); // qua năm
    expect(() => actualWindow("19/10/2026")).toThrow();
  });

  it("URL đúng hai endpoint đã xác minh (archive-api gió · marine-api sóng), timezone GMT", () => {
    const u = actualUrls({ lat: 10.34, lon: 107.09 }, { start: "2026-10-10", end: "2026-10-14" });
    expect(u.wind).toContain("archive-api.open-meteo.com/v1/archive?latitude=10.34&longitude=107.09&start_date=2026-10-10&end_date=2026-10-14&timezone=GMT");
    expect(u.wind).toContain("daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum");
    expect(u.wave).toContain("marine-api.open-meteo.com/v1/marine?");
    expect(u.wave).toContain("daily=wave_height_max");
  });

  const win = { start: "2026-10-10", end: "2026-10-12" };
  const wind = {
    daily: {
      time: ["2026-10-10", "2026-10-11", "2026-10-12"],
      wind_speed_10m_max: [20.5, null, 33],
      wind_gusts_10m_max: [40, 41, 42],
      precipitation_sum: [0, 12.3, 1],
    },
  };
  const wave = { daily: { time: ["2026-10-10", "2026-10-11"], wave_height_max: [0.8, 1.9] } };

  it("ghép gió + sóng theo ngày; thiếu giá trị ⇒ null, không bịa", () => {
    const m = portActualByDay(wind, wave, win);
    expect(m.get("2026-10-10")).toEqual({ windMaxKmh: 20.5, gustMaxKmh: 40, rainMm: 0, waveMaxM: 0.8 });
    expect(m.get("2026-10-11")).toEqual({ windMaxKmh: null, gustMaxKmh: 41, rainMm: 12.3, waveMaxM: 1.9 });
    expect(m.get("2026-10-12")).toEqual({ windMaxKmh: 33, gustMaxKmh: 42, rainMm: 1, waveMaxM: null }); // sóng chưa có ngày đó
  });

  it("cả hai nguồn hỏng ⇒ cảng null mọi ngày; một nguồn hỏng ⇒ chỉ trường đó null", () => {
    expect([...portActualByDay(null, null, win).values()]).toEqual([null, null, null]);
    const onlyWave = portActualByDay(null, wave, win);
    expect(onlyWave.get("2026-10-10")).toEqual({ windMaxKmh: null, gustMaxKmh: null, rainMm: null, waveMaxM: 0.8 });
    expect(onlyWave.get("2026-10-12")).toBeNull();
  });

  it("mỗi ngày một file đủ mọi cảng; file không có số nào thì bị loại", () => {
    const a = portActualByDay(wind, wave, win);
    const b = portActualByDay(null, null, win);
    const files = buildActualDayFiles([{ id: "vung-tau", byDay: a }, { id: "rach-gia", byDay: b }], win, "2026-10-19T03:35:00.000Z");
    expect(files.map((f) => f.date)).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(files[0].ports["rach-gia"]).toBeNull();
    expect(files[0].ports["vung-tau"]?.waveMaxM).toBe(0.8);
    expect(files[0].source).toBe("open-meteo-archive-era5");
    expect(files.every(actualFileHasData)).toBe(true);
    const empty = buildActualDayFiles([{ id: "rach-gia", byDay: b }], win, "x");
    expect(empty.some(actualFileHasData)).toBe(false);
  });
});
