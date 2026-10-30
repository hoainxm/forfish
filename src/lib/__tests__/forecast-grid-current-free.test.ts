import { describe, expect, it, beforeEach, vi } from "vitest";

/*  LỚP DÒNG CHẢY HÔM NAY CỦA TÀI KHOẢN THƯỜNG TRẮNG CÂM (chủ dự án báo 2026-10-30, iPhone, production).

    Tài khoản thường xin khung HÔM NAY (`days = 1`). Snapshot `grid:d1` cũ (cron hỏng — xem
    server-client-boundary.test.ts) ⇒ đi live qua cầu /api/om. Request DÒNG CHẢY là request riêng kết bằng
    `.catch(() => null)`: nó hỏng mà gió vẫn về thì lưới vẫn "hợp lệ" với `curKmh` toàn null, và
    `fetchForecastGrid(…, { needCurrent: true })` trả thẳng lưới đó ⇒ thanh giờ "Dòng chảy · Hôm nay", không màu
    không hạt không một dòng lỗi. Luật mới: live thiếu dòng chảy cho lớp Dòng chảy = live HỎNG cho lớp đó ⇒ đi
    chuỗi lưới an toàn; hết đường thì ném `GridNoCurrentError` để màn hình nói thật. */

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
  fetchForecastGrid,
  gridHasCurrent,
  gridPoints,
  GridNoCurrentError,
  GRID_NS,
  type ForecastGrid,
} from "../forecast-grid";
import { saveForecast } from "../forecast-cache";

const TODAY = "2026-10-30";
const TIME = Array.from({ length: 24 }, (_, i) => `${TODAY}T${String(i).padStart(2, "0")}:00`);
const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

/** Nguồn giả qua cầu /api/om: gió + sóng về; dòng chảy về hay không tuỳ `cur`. Snapshot tuỳ `snap`. */
function nguon(opts: { cur: "ok" | "503" | "null"; snap?: ForecastGrid & { savedAt: number } }) {
  const calls: string[] = [];
  const fn = vi.fn().mockImplementation((u: string) => {
    const url = String(u);
    calls.push(url);
    if (url.includes("/api/weather-snapshot")) return opts.snap ? json(opts.snap) : json({ ok: false }, 404);
    if (url.includes("ocean_current")) {
      if (opts.cur === "503") return json({ ok: false, code: "source_down" }, 503);
      const v = opts.cur === "ok" ? 1.1 : null;
      return json(
        Array.from({ length: 156 }, () => ({
          hourly: { time: TIME, ocean_current_velocity: TIME.map(() => v), ocean_current_direction: TIME.map(() => 90) },
        })),
      );
    }
    if (url.includes("/api/om/marine"))
      return json(
        Array.from({ length: 156 }, () => ({
          hourly: { time: TIME, wave_height: TIME.map(() => 1), wave_direction: TIME.map(() => 45) },
        })),
      );
    return json(
      Array.from({ length: 156 }, () => ({
        hourly: { time: TIME, wind_speed_10m: TIME.map(() => 20), wind_direction_10m: TIME.map(() => 45) },
      })),
    );
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return calls;
}

/** Lưới hôm nay CÓ dòng chảy (đúng trục giờ lấy mẫu của khung 1 ngày: 0,3,…,21h). */
function luoiCoDongChay(savedAt: number): ForecastGrid & { savedAt: number } {
  const times = TIME.filter((_, i) => i % 3 === 0);
  return {
    times,
    savedAt,
    cells: gridPoints().map((p) => ({
      lat: p.lat,
      lon: p.lon,
      hours: times.map(() => ({ windKmh: 10, windDirDeg: 0, waveM: 1, waveDirDeg: 0, curKmh: 0.8, curDirDeg: 120 })),
    })),
  };
}

const CU = () => Date.now() - 20 * 60 * 60 * 1000; // quá trần cache ⇒ không còn "hiện hành"

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("lớp Dòng chảy khung HÔM NAY (tài khoản thường) — không bao giờ trắng câm", () => {
  it("live có dòng chảy ⇒ trả bản live, xin đúng 1 ngày qua cầu", async () => {
    const calls = nguon({ cur: "ok" });
    const g = await fetchForecastGrid(1, { needCurrent: true });
    expect(gridHasCurrent(g)).toBe(true);
    expect(g.stale).toBeUndefined();
    const cur = calls.find((u) => u.includes("ocean_current"))!;
    expect(cur).toContain("/api/om/marine");
    expect(cur).toContain("forecast_days=1");
  });

  it("dòng chảy 503, máy trống, snapshot không có ⇒ ném GridNoCurrentError (KHÔNG trả lưới thiếu dòng chảy)", async () => {
    nguon({ cur: "503" });
    await expect(fetchForecastGrid(1, { needCurrent: true })).rejects.toBeInstanceOf(GridNoCurrentError);
  });

  it("nguồn trả 200 nhưng dòng chảy toàn null ⇒ cũng là thiếu, cũng ném", async () => {
    nguon({ cur: "null" });
    await expect(fetchForecastGrid(1, { needCurrent: true })).rejects.toBeInstanceOf(GridNoCurrentError);
  });

  it("dòng chảy hỏng nhưng máy đã lưu bản CÓ dòng chảy ⇒ bản đó (gắn cờ đã lưu), dòng chảy cũ KHÔNG mất", async () => {
    saveForecast(GRID_NS, "d1", luoiCoDongChay(CU()), CU());
    nguon({ cur: "503" });
    const g = await fetchForecastGrid(1, { needCurrent: true });
    expect(gridHasCurrent(g)).toBe(true);
    expect(g.stale).toBe(true);
    // lớp Gió (không đòi dòng chảy) đọc lại kho vẫn thấy dòng chảy — bản live thiếu cur không đè mất
    nguon({ cur: "503" });
    const gio = await fetchForecastGrid(1);
    expect(gridHasCurrent(gio)).toBe(true);
  });

  it("dòng chảy hỏng, máy trống, snapshot CŨ nhưng có dòng chảy ⇒ dùng snapshot (cờ đã lưu)", async () => {
    nguon({ cur: "503", snap: luoiCoDongChay(CU()) });
    const g = await fetchForecastGrid(1, { needCurrent: true });
    expect(gridHasCurrent(g)).toBe(true);
    expect(g.stale).toBe(true);
  });

  it("lớp GIÓ không đổi luật: dòng chảy hỏng vẫn trả bản live tươi", async () => {
    nguon({ cur: "503" });
    const g = await fetchForecastGrid(1);
    expect(g.stale).toBeUndefined();
    expect(gridHasCurrent(g)).toBe(false);
    expect(g.cells[0].hours[0].windKmh).toBe(20);
  });
});
