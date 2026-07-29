import { describe, expect, it, beforeEach, vi } from "vitest";

// localStorage mock (env node — không jsdom), khớp mẫu forecast-grid-offline
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

import { fetchSeaForecast, type ScoredSeaDay } from "../sea";
import type { FishingPort } from "@/data/ports";

const PORT = { id: "test-port", name: "Cảng test", lat: 12.2, lon: 109.2 } as FishingPort;

const day = (date: string): ScoredSeaDay => ({
  date,
  waveMaxM: 1,
  windMaxKmh: 15,
  gustMaxKmh: 20,
  precipMm: 0,
  wmoCode: 1,
  score: 90,
  level: "good",
});

/* 2026-07-29 (user): "luôn ưu tiên snapshot" — dự báo cảng cũng hỏi snapshot
   server trước live. Payload snapshot đổi dạng { savedAt, days } (cron nhét
   savedAt); reader phải nhận CẢ dạng cũ (mảng trần) trong lúc chuyển tiếp. */
describe("fetchSeaForecast — ưu tiên snapshot trước live", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("snapshot TƯƠI (dạng mới {savedAt, days}) → dùng luôn, KHÔNG gọi Open-Meteo", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      calls.push(String(url));
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ savedAt: Date.now(), days: [day("2026-07-29")] }),
        });
      return Promise.reject(new Error("không được gọi nguồn"));
    }) as unknown as typeof fetch;
    const days = await fetchSeaForecast(PORT);
    expect(days).toHaveLength(1);
    expect(calls.some((u) => u.includes("open-meteo"))).toBe(false);
  });

  it("snapshot dạng CŨ (mảng trần, không savedAt) → coi như không rõ tuổi: đi live, live hỏng mới dùng nó", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([day("2026-07-28")]),
        });
      return Promise.reject(new Error("429"));
    }) as unknown as typeof fetch;
    const days = await fetchSeaForecast(PORT);
    expect(days[0].date).toBe("2026-07-28"); // live hỏng → lùi về snapshot cũ
  });

  it("snapshot hỏng/không có → live như cũ", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      const marine = String(url).includes("marine-api");
      const time = ["2026-07-29"];
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            marine
              ? { daily: { time, wave_height_max: [1.1] } }
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
    expect(days[0].waveMaxM).toBe(1.1);
  });
});
