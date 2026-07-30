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

import { fetchScalarField, type ScalarGrid } from "../scalar-field";
import { gridPoints, GRID_N_LAT, GRID_N_LON } from "../forecast-grid";

/** Snapshot dải màu giả — đủ ô khớp kích thước khai, kèm savedAt cron nhét */
function snapScalar(savedAt: number): ScalarGrid & { savedAt: number } {
  return {
    kind: "cloud",
    times: ["2026-07-29T00:00"],
    nLat: GRID_N_LAT,
    nLon: GRID_N_LON,
    cells: gridPoints().map((p) => ({ lat: p.lat, lon: p.lon, values: [50] })),
    savedAt,
  };
}

/** Open-Meteo live giả: một request ra cả 5 biến, `hours` mốc giờ */
function liveOk(hours: number) {
  const time = Array.from(
    { length: hours },
    (_, i) => `2026-07-29T${String(i % 24).padStart(2, "0")}:00`,
  );
  const one = {
    hourly: {
      time,
      cloud_cover: time.map(() => 40),
      precipitation: time.map(() => 0),
      temperature_2m: time.map(() => 29),
      cape: time.map(() => 100),
      pressure_msl: time.map(() => 1010),
    },
  };
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(Array.from({ length: 156 }, () => one)),
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

/* 2026-07-29 (user): "luôn ưu tiên snapshot để hạn chế bị lock do IP tải
   nhiều" — cùng luật với forecast-grid: máy không có bản tươi thì hỏi snapshot
   server TRƯỚC, chỉ nhận khi còn HIỆN HÀNH theo nhịp phát hành. */
describe("fetchScalarField — ưu tiên snapshot trước live", () => {
  it("máy trống + snapshot TƯƠI → dùng snapshot, KHÔNG gọi Open-Meteo", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      calls.push(String(url));
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(snapScalar(Date.now())),
        });
      return Promise.reject(new Error("không được gọi nguồn"));
    }) as unknown as typeof fetch;
    const g = await fetchScalarField("cloud", 3);
    expect(g.stale).toBeUndefined();
    expect(g.cells).toHaveLength(156);
    expect(calls.some((u) => u.includes("open-meteo"))).toBe(false);
  });

  it("snapshot CŨ (quá trần cache) → bỏ qua, đi live", async () => {
    const old = snapScalar(Date.now() - 20 * 60 * 60 * 1000);
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve(old) });
      return liveOk(96);
    }) as unknown as typeof fetch;
    const g = await fetchScalarField("cloud", 3);
    // live 3 ngày = 25 mốc; snapshot giả chỉ 1 mốc → chứng tỏ đã đi live
    expect(g.times.length).toBe(25);
    expect(g.stale).toBeUndefined();
  });

  it("live lỗi + snapshot CŨ → vẫn nhận snapshot nhưng gắn stale + savedAt thật", async () => {
    const oldAt = Date.now() - 20 * 60 * 60 * 1000;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(snapScalar(oldAt)),
        });
      return Promise.reject(new Error("429"));
    }) as unknown as typeof fetch;
    const g = await fetchScalarField("cloud", 3);
    expect(g.stale).toBe(true);
    expect(g.savedAt).toBe(oldAt);
  });
});
