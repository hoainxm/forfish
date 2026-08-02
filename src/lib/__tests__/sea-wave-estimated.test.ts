import { describe, expect, it, beforeEach, vi } from "vitest";

// localStorage mock (env node — không jsdom), khớp mẫu sea-snapshot-first
const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import {
  allWavesEstimated,
  fetchSeaForecast,
  estimateWaveFromWind,
  type ScoredSeaDay,
} from "../sea";
import type { FishingPort } from "@/data/ports";

const PORT = {
  id: "wave-test",
  name: "Cảng test",
  lat: 12.2,
  lon: 109.2,
} as FishingPort;
const CACHE_KEY = "forfish.sea.wave-test.v3";

const day = (date: string, waveEstimated = false): ScoredSeaDay => ({
  date,
  waveMaxM: 1.4,
  windMaxKmh: 15,
  gustMaxKmh: 20,
  precipMm: 0,
  wmoCode: 1,
  waveEstimated,
  score: 90,
  level: "good",
});

/** Nguồn sóng CHẾT, nguồn gió/mưa sống → mẻ toàn sóng ước */
function mockMarineDown() {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes("/api/weather-snapshot"))
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    if (u.includes("marine-api")) return Promise.reject(new Error("503"));
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          daily: {
            time: ["2026-08-02", "2026-08-03"],
            wind_speed_10m_max: [12, 20],
            wind_gusts_10m_max: [18, 30],
            precipitation_sum: [0, 0],
            weather_code: [1, 1],
          },
        }),
    });
  }) as unknown as typeof fetch;
}

describe("allWavesEstimated", () => {
  it("mảng rỗng → false (không có gì để nói là 'toàn ước')", () => {
    expect(allWavesEstimated([])).toBe(false);
  });

  it("còn MỘT ngày có sóng đo thật → chưa phải mẻ toàn ước", () => {
    expect(allWavesEstimated([day("2026-08-02"), day("2026-08-03", true)])).toBe(
      false,
    );
  });

  it("mọi ngày đều ước → true", () => {
    expect(
      allWavesEstimated([day("2026-08-02", true), day("2026-08-03", true)]),
    ).toBe(true);
  });

  it("bản lưu đời cũ (không có trường waveEstimated) coi như sóng THẬT", () => {
    // undefined ≠ true — bản cũ là số lấy từ nguồn sóng, không được hạ cấp
    expect(allWavesEstimated([day("2026-08-02")])).toBe(false);
  });
});

/* LỖI 2b (soát chéo 2026-08-02) — AN TOÀN TÍNH MẠNG.
   Từ lúc nhánh live thôi ném khi nguồn sóng hỏng, mẻ "gió thật + sóng ước"
   cũng được lưu ĐÈ lên bản có sóng đo thật. Ra biển mất sóng, thứ duy nhất
   còn trong máy là con số máy tự đoán từ gió — không biết sóng lừng từ bão xa,
   đúng thứ lật tàu nhỏ lúc trời quang. */
describe("fetchSeaForecast — mẻ toàn sóng ước không đè bản có sóng thật", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("nguồn sóng chết → vẫn dựng được ngày, sóng ước từ gió + gắn cờ", async () => {
    mockMarineDown();
    const days = await fetchSeaForecast(PORT);
    expect(days).toHaveLength(2);
    expect(days.every((d) => d.waveEstimated === true)).toBe(true);
    expect(days[0].waveMaxM).toBe(estimateWaveFromWind(12));
    // KHÔNG được để 0 giả thành "biển êm"
    expect(days[0].waveMaxM).toBeGreaterThan(0);
  });

  it("trong máy đang có bản sóng THẬT (đã quá hạn) → KHÔNG bị đè", async () => {
    const old = {
      ts: Date.now() - 3 * 60 * 60 * 1000, // quá TTL 1 giờ → không đi đường tắt
      days: [day("2026-08-01")],
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(old));
    mockMarineDown();

    const days = await fetchSeaForecast(PORT);
    // cái ĐANG hiện vẫn là bản vừa lấy (gió/mưa/dông trong đó là số thật)
    expect(days.every((d) => d.waveEstimated === true)).toBe(true);
    // …nhưng thứ bà con sẽ đọc lúc GIỮA BIỂN thì giữ nguyên sóng đo thật
    const kept = JSON.parse(localStorage.getItem(CACHE_KEY)!) as {
      ts: number;
      days: ScoredSeaDay[];
    };
    expect(kept.ts).toBe(old.ts);
    expect(allWavesEstimated(kept.days)).toBe(false);
    expect(kept.days[0].date).toBe("2026-08-01");
  });

  it("trong máy chưa có gì → mẻ toàn ước VẪN được lưu (trống còn tệ hơn)", async () => {
    mockMarineDown();
    await fetchSeaForecast(PORT);
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY)!) as {
      days: ScoredSeaDay[];
    };
    expect(saved.days).toHaveLength(2);
    expect(allWavesEstimated(saved.days)).toBe(true);
  });

  it("bản trong máy cũng toàn ước → cho ghi đè (bản mới ít ra mới hơn)", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ts: Date.now() - 3 * 60 * 60 * 1000,
        days: [day("2026-08-01", true)],
      }),
    );
    mockMarineDown();
    await fetchSeaForecast(PORT);
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY)!) as {
      days: ScoredSeaDay[];
    };
    expect(saved.days).toHaveLength(2);
    expect(saved.days[0].date).toBe("2026-08-02");
  });

  it("mẻ CÓ sóng thật thì ghi đè như thường (không đóng băng bản cũ)", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ts: Date.now() - 3 * 60 * 60 * 1000,
        days: [day("2026-08-01")],
      }),
    );
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("/api/weather-snapshot"))
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      const time = ["2026-08-02"];
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            u.includes("marine-api")
              ? { daily: { time, wave_height_max: [1.9] } }
              : {
                  daily: {
                    time,
                    wind_speed_10m_max: [12],
                    wind_gusts_10m_max: [18],
                    precipitation_sum: [0],
                    weather_code: [1],
                  },
                },
          ),
      });
    }) as unknown as typeof fetch;

    const days = await fetchSeaForecast(PORT);
    expect(days[0].waveMaxM).toBe(1.9);
    expect(days[0].waveEstimated).toBe(false);
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY)!) as {
      days: ScoredSeaDay[];
    };
    expect(saved.days[0].date).toBe("2026-08-02");
  });
});
