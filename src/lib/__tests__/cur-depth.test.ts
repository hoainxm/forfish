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

import { fetchCurDepthGridClient } from "../cur-depth";
import {
  pickElevationIndex,
  sliceCurDepthDays,
  type CurDepthGrid,
} from "../copernicus-cur-depth";

function fakeGrid(nDays: number, savedAt?: number) {
  return {
    ok: true,
    savedAt,
    tier: 150,
    depthM: 155.9,
    times: Array.from({ length: nDays }, (_, d) => `2026-07-${29 + d}T12:00`),
    cells: [
      {
        lat: 13,
        lon: 111,
        hours: Array.from({ length: nDays }, () => ({
          windKmh: null,
          windDirDeg: null,
          waveM: null,
          waveDirDeg: null,
          curKmh: 0.4,
          curDirDeg: 220,
        })),
      },
    ],
  };
}

describe("fetchCurDepthGridClient — snapshot trước, live sau", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("snapshot TƯƠI → dùng luôn, KHÔNG gọi route live", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      calls.push(String(url));
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(fakeGrid(10, Date.now())),
        });
      return Promise.reject(new Error("không được gọi live"));
    }) as unknown as typeof fetch;
    const g = await fetchCurDepthGridClient(150, 10);
    expect(g.times).toHaveLength(10);
    expect(calls.some((u) => u.includes("/api/currents-depth"))).toBe(false);
  });

  it("snapshot chưa có → route live; live cũng chết → bản cũ trong máy + stale", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(fakeGrid(10)),
      });
    }) as unknown as typeof fetch;
    const live = await fetchCurDepthGridClient(150, 10);
    expect(live.cells[0].hours[0].curKmh).toBe(0.4);

    // giờ mọi nguồn chết → bản vừa lưu quay lại với cờ stale (bản cache đã quá
    // trần isCacheCurrent thì mới rơi nấc này — giả lập bằng savedAt cũ)
    const { saveForecast } = await import("../forecast-cache");
    saveForecast("curdepth", "t150.d10", live, Date.now() - 20 * 60 * 60 * 1000);
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("mất sóng")) as unknown as typeof fetch;
    const stale = await fetchCurDepthGridClient(150, 10);
    expect(stale.stale).toBe(true);
  });

  it("không nguồn nào → ném lỗi, UI nói thật", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }) as unknown as typeof fetch;
    await expect(fetchCurDepthGridClient(300, 3)).rejects.toThrow();
  });
});

describe("copernicus-cur-depth — phần thuần", () => {
  it("pickElevationIndex: chọn tầng |elev| gần độ sâu danh nghĩa nhất (trục âm, mặt ở cuối)", () => {
    // trục kiểu Copernicus: sâu → nông
    const elev = [-5727.9, -318.1, -155.9, -47.4, -0.5];
    expect(pickElevationIndex(elev, 0)).toBe(4); // mặt
    expect(pickElevationIndex(elev, 50)).toBe(3);
    expect(pickElevationIndex(elev, 150)).toBe(2);
    expect(pickElevationIndex(elev, 300)).toBe(1);
  });

  it("sliceCurDepthDays: cắt đúng số ngày cả times lẫn hours", () => {
    const g = fakeGrid(10) as unknown as CurDepthGrid;
    const d3 = sliceCurDepthDays(g, 3);
    expect(d3.times).toHaveLength(3);
    expect(d3.cells[0].hours).toHaveLength(3);
    expect(d3.depthM).toBe(155.9);
    // không cắt quá đà
    expect(sliceCurDepthDays(g, 99).times).toHaveLength(10);
  });
});
