import { describe, expect, it, beforeEach } from "vitest";

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

import { saveForecast } from "../forecast-cache";
import {
  dedupePoints,
  pretripSteps,
  savedSummary,
  PRETRIP_GRID_DAYS,
} from "../pretrip";

/** Bản dự báo điểm rút gọn — chỉ cần mảng `days` để tính "giữ tới ngày nào" */
const cond = (dates: string[]) => ({ days: dates.map((date) => ({ date })) });

beforeEach(() => localStorage.clear());

describe("dedupePoints", () => {
  it("gộp các chỗ cùng ô lưới ~0,25° (chạm mấy lần quanh một chỗ)", () => {
    const out = dedupePoints([
      { lat: 8.68, lon: 106.6, name: "Cảng nhà" },
      { lat: 8.7, lon: 106.62, name: "Chỗ đang xem" },
      { lat: 16.5, lon: 112.0, name: "Hoàng Sa" },
    ]);
    expect(out.map((p) => p.name)).toEqual(["Cảng nhà", "Hoàng Sa"]);
  });
});

describe("pretripSteps", () => {
  it("mỗi chỗ một việc + bản đồ cá + các khung lưới gió/sóng + bản đồ mùa vụ", () => {
    const steps = pretripSteps([
      { lat: 8.68, lon: 106.6, name: "Cảng nhà" },
      { lat: 16.5, lon: 112.0, name: "Hoàng Sa" },
    ]);
    expect(steps).toHaveLength(2 + 1 + PRETRIP_GRID_DAYS.length + 1);
    expect(steps[0].label).toBe("Gió sóng — Cảng nhà");
    expect(steps[2].label).toBe("Bản đồ cá");
    expect(steps[3].label).toBe("Gió sóng cả vùng biển — 3 ngày");
    // mùa vụ đi CUỐI: nhẹ nhất, và không được chiếm sóng của dự báo thật
    expect(steps[steps.length - 1].label).toBe("Bản đồ mùa vụ");
  });

  it("không chỗ nào ghim → vẫn tải bản đồ cá + lưới + mùa vụ (không rỗng)", () => {
    expect(pretripSteps([]).length).toBe(1 + PRETRIP_GRID_DAYS.length + 1);
  });
});

describe("savedSummary — 'trong máy đang có gì'", () => {
  it("chưa có gì → không chỗ nào, không ngày nào", () => {
    expect(savedSummary()).toEqual({
      places: 0,
      untilIso: null,
      gridDays: [],
    });
  });

  it("đếm số chỗ và lấy ngày XA NHẤT còn dự báo", () => {
    saveForecast("point", "a", cond(["2026-07-25", "2026-08-09"]), 1000);
    saveForecast("point", "b", cond(["2026-07-25", "2026-08-02"]), 2000);
    saveForecast("grid", "d3", { times: [] }, 3000);
    saveForecast("grid", "d16", { times: [] }, 4000);
    const s = savedSummary();
    expect(s.places).toBe(2);
    expect(s.untilIso).toBe("2026-08-09");
    expect(s.gridDays).toEqual([3, 16]);
  });
});
