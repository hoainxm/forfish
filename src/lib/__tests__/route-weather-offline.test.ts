import { describe, expect, it, beforeEach, vi } from "vitest";

// localStorage mock (env node — không jsdom), khớp mẫu forecast-grid-offline.test
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
  gridToWeatherField,
  gridHourOffsetFromToday,
  fetchWeatherField,
} from "../route-weather";
import {
  gridPoints,
  gridCacheId,
  GRID_NS,
  GRID_N_LAT,
  GRID_N_LON,
  type ForecastGrid,
  type GridHour,
} from "../forecast-grid";
import { saveForecast } from "../forecast-cache";
import { sampleField } from "../route-plan";

/** ISO giờ VN "YYYY-MM-DDTHH:00" cách `dateVN` 00:00 đúng `addH` giờ (dùng
    UTC THUẦN như bộ lịch — chỉ để dựng chuỗi, không dính múi giờ thật). */
function isoFrom(dateVN: string, addH: number): string {
  const [y, m, d] = dateVN.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 0) + addH * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:00`;
}

/** Lưới Windy giả: mọi ô cùng gió/sóng, mốc giờ từ `startVN` 00:00, bước `stepH`. */
function makeGrid(
  startVN: string,
  nSteps: number,
  stepH: number,
  hourOverride?: Partial<GridHour>,
): ForecastGrid {
  const times = Array.from({ length: nSteps }, (_, i) => isoFrom(startVN, i * stepH));
  const hours: GridHour[] = times.map(() => ({
    windKmh: 20,
    windDirDeg: 45,
    waveM: 1.2,
    waveDirDeg: 90,
    ...hourOverride,
  }));
  const cells = gridPoints().map((p) => ({ lat: p.lat, lon: p.lon, hours }));
  return { times, cells };
}

// "hôm nay" cố định = 28/07/2026, 05h giờ VN
const NOW = new Date("2026-07-28T05:00:00+07:00");

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("gridHourOffsetFromToday", () => {
  const today = { y: 2026, m: 7, d: 28 };
  it("hôm nay 00:00 → 0; hôm nay 05:00 → 5", () => {
    expect(gridHourOffsetFromToday("2026-07-28T00:00", today)).toBe(0);
    expect(gridHourOffsetFromToday("2026-07-28T05:00", today)).toBe(5);
  });
  it("ngày mai 03:00 → 27; hôm qua 22:00 → -2 (bị loại sau đó)", () => {
    expect(gridHourOffsetFromToday("2026-07-29T03:00", today)).toBe(27);
    expect(gridHourOffsetFromToday("2026-07-27T22:00", today)).toBe(-2);
  });
  it("chuỗi hỏng → null", () => {
    expect(gridHourOffsetFromToday("rác", today)).toBeNull();
  });
});

describe("gridToWeatherField — dựng WeatherField offline từ lưới đã lưu", () => {
  it("đúng kích thước lưới + cờ nguồn 'grid' + savedAt", () => {
    const f = gridToWeatherField(makeGrid("2026-07-28", 24, 1), NOW, 1720000000000);
    expect(f).not.toBeNull();
    expect(f!.nLat).toBe(GRID_N_LAT);
    expect(f!.nLon).toBe(GRID_N_LON);
    expect(f!.source).toBe("grid");
    expect(f!.savedAt).toBe(1720000000000);
  });

  it("trục giờ đặt về HÔM NAY: sample tại nút lưới trả đúng gió/sóng, không dòng chảy/chu kỳ", () => {
    const f = gridToWeatherField(makeGrid("2026-07-28", 24, 1), NOW)!;
    // chọn một nút lưới nội bộ (không mép) để nội suy rơi trọn vào một ô
    const node = gridPoints()[GRID_N_LON * 3 + 3];
    const h = sampleField(f, node.lat, node.lon, 5);
    expect(h).not.toBeNull();
    expect(h!.windKmh).toBeCloseTo(20, 5);
    expect(h!.waveM).toBeCloseTo(1.2, 5);
    expect(h!.wavePeriodS).toBeNull(); // lưới Windy không có chu kỳ sóng
    expect(h!.currentKmh).toBe(0); // không có dòng chảy offline
    expect(h!.currentToDeg).toBeNull();
  });

  it("bản lưu từ HÔM QUA vẫn ghép đúng: mốc quá khứ bị loại, hours[0] = 0h hôm nay", () => {
    // 48 mốc 1h từ hôm qua 00:00 → nửa đầu là quá khứ
    const f = gridToWeatherField(makeGrid("2026-07-27", 48, 1), NOW)!;
    expect(f).not.toBeNull();
    // chỉ còn hôm nay trở đi: 24 giờ (0..23)
    const cell = f.cells.find((c) => c.onSea)!;
    expect(cell.hours).toHaveLength(24);
  });

  it("lưới TOÀN quá khứ → null (không dẫn theo bản cũ đội lốt mới)", () => {
    expect(gridToWeatherField(makeGrid("2026-07-25", 24, 1), NOW)).toBeNull();
  });

  it("times/cells rỗng → null", () => {
    expect(gridToWeatherField({ times: [], cells: [] }, NOW)).toBeNull();
  });

  it("ô không có số sóng (đất liền) → onSea=false, hours rỗng", () => {
    const f = gridToWeatherField(
      makeGrid("2026-07-28", 24, 1, { waveM: null }),
      NOW,
    )!;
    expect(f.cells.every((c) => !c.onSea)).toBe(true);
    expect(f.cells.every((c) => c.hours.length === 0)).toBe(true);
  });
});

describe("fetchWeatherField — mất sóng lùi về lưới đã lưu", () => {
  const bbox = { latMin: 8, latMax: 14, lonMin: 106, lonMax: 113 };

  it("có lưới trong máy + offline → trả field source='grid'", async () => {
    saveForecast(GRID_NS, gridCacheId(3), makeGrid("2026-07-28", 24, 1));
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("mất sóng")) as unknown as typeof fetch;
    const f = await fetchWeatherField(bbox, NOW);
    expect(f.source).toBe("grid");
    expect(f.savedAt).toBeTypeOf("number");
  });

  it("KHÔNG có lưới trong máy + offline → ném lỗi (UI báo thiếu)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("mất sóng")) as unknown as typeof fetch;
    // bbox khác để tránh cache RAM của test trên
    await expect(
      fetchWeatherField({ latMin: 9, latMax: 15, lonMin: 107, lonMax: 114 }, NOW),
    ).rejects.toThrow();
  });
});
