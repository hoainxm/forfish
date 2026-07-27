import { describe, expect, it, beforeEach, vi } from "vitest";

// localStorage mock (env node — không jsdom), khớp mẫu forecast-cache.test
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

import { fetchForecastGrid, savedGridDays } from "../forecast-grid";

/** Open-Meteo giả: trả đủ giờ cho `hours` mốc, 80 điểm lưới */
function fakeOk(hours: number) {
  return (url: string) => {
    const marine = String(url).includes("marine-api");
    const time = Array.from(
      { length: hours },
      (_, i) => `2026-07-25T${String(i % 24).padStart(2, "0")}:00`,
    );
    const one = marine
      ? {
          hourly: {
            time,
            wave_height: time.map(() => 1.2),
            wave_direction: time.map(() => 90),
          },
        }
      : {
          hourly: {
            time,
            wind_speed_10m: time.map(() => 20),
            wind_direction_10m: time.map(() => 45),
          },
        };
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(Array.from({ length: 80 }, () => one)),
    });
  };
}

const online = (hours: number) =>
  vi.fn().mockImplementation(fakeOk(hours)) as unknown as typeof fetch;
const offline = () =>
  vi.fn().mockRejectedValue(new Error("mất sóng")) as unknown as typeof fetch;

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

/*
  LỖI đã sửa (2026-07-25): mất sóng mà chưa lưu khung đang xin thì code lấy đại
  "bản gần nhất" của namespace — xin 16 ngày, nhận lưới 3 ngày đã lưu, chip khung
  ngày vẫn sáng "16 ngày". Bà con kéo thanh giờ tưởng đang xem nửa tháng tới.
*/
describe("fetchForecastGrid offline — đúng khung ngày đã xin", () => {
  it("mất sóng, ĐÚNG khung đã lưu → trả bản lưu + cờ đã lưu", async () => {
    globalThis.fetch = online(96);
    await fetchForecastGrid(3);
    globalThis.fetch = offline();
    const g = await fetchForecastGrid(3);
    expect(g.stale).toBe(true);
    expect(g.savedAt).toBeTypeOf("number");
    expect(g.cells).toHaveLength(80);
  });

  it("mất sóng, xin khung KHÁC với khung đã lưu → BÁO LỖI, không đưa lưới khung khác", async () => {
    globalThis.fetch = online(96);
    const near = await fetchForecastGrid(3);
    globalThis.fetch = offline();
    await expect(fetchForecastGrid(16)).rejects.toThrow();
    // xác nhận đúng là hai khung khác nhau về số mốc giờ (không phải trùng ngẫu nhiên)
    expect(near.times.length).toBe(25);
  });

  it("bản lưu khung 3 ngày KHÔNG bị dùng cho khung 16 ngày dù lưu sau", async () => {
    globalThis.fetch = online(400);
    const far = await fetchForecastGrid(16);
    await fetchForecastGrid(3); // lưu sau → trước đây sẽ chiếm chỗ "bản mới nhất"
    globalThis.fetch = offline();
    const g = await fetchForecastGrid(16);
    expect(g.times.length).toBe(far.times.length);
    expect(g.times.length).toBeGreaterThan(25);
  });

  it("savedGridDays: nói đúng khung nào THẬT SỰ có trong máy", async () => {
    globalThis.fetch = online(400);
    await fetchForecastGrid(16);
    await fetchForecastGrid(3);
    expect(savedGridDays()).toEqual([3, 16]);
  });

  it("chưa lưu gì mà mất sóng → báo lỗi, không bịa lưới", async () => {
    globalThis.fetch = offline();
    await expect(fetchForecastGrid(7)).rejects.toThrow();
    expect(savedGridDays()).toEqual([]);
  });
});
