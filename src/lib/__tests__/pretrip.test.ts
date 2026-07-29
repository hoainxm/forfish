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
  savedLayers,
  savedCoverage,
  PRETRIP_GRID_DAYS,
  PRETRIP_SCALAR_DAYS,
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

describe("savedLayers / savedCoverage — độ phủ TỪNG lớp", () => {
  // seed đủ mọi lớp offline vào localStorage giả
  const seedAll = () => {
    saveForecast("point", "8.50_106.50", cond(["2026-08-10", "2026-08-13"]));
    saveForecast("grid", "d3", { x: 1 });
    saveForecast("grid", "d16", { x: 1 });
    saveForecast("scalar", "cloud.d3", { x: 1 });
    saveForecast("scalar", "salinity.d4", { x: 1 });
    saveForecast("seascalar", "ssha", { ok: true });
    saveForecast("curdepth", "t50.d10", { x: 1 });
    saveForecast("fishmark", "latest", { targetDate: "2026-08-01" });
  };

  it("đủ mọi lớp → allSaved, missing 0, untilIso theo điểm gió sóng", () => {
    seedAll();
    const cov = savedCoverage({ fishLocked: false });
    expect(cov.allSaved).toBe(true);
    expect(cov.missing).toBe(0);
    expect(cov.untilIso).toBe("2026-08-13");
    expect(cov.layers.find((l) => l.id === "fish")?.saved).toBe(true);
  });

  it("thiếu lớp màu → allSaved=false, missing đếm đúng, dòng scalar 'chưa lưu'", () => {
    seedAll();
    localStorage.removeItem("forfish.fc.scalar.cloud.d3");
    const cov = savedCoverage({ fishLocked: false });
    expect(cov.allSaved).toBe(false);
    expect(cov.missing).toBe(1);
    const scalar = cov.layers.find((l) => l.id === "scalar");
    expect(scalar?.saved).toBe(false);
  });

  it("bản đồ cá KHOÁ premium → không tính là thiếu (retriable=false), vẫn allSaved", () => {
    seedAll();
    localStorage.removeItem("forfish.fc.fishmark.latest"); // premium chưa tải cá
    const cov = savedCoverage({ fishLocked: true });
    const fish = cov.layers.find((l) => l.id === "fish");
    expect(fish?.retriable).toBe(false);
    expect(fish?.saved).toBe(false);
    expect(cov.allSaved).toBe(true); // cá khoá không kéo tụt độ phủ
  });

  it("máy trống → mọi lớp chưa lưu, allSaved=false", () => {
    const layers = savedLayers({ fishLocked: false });
    expect(layers.every((l) => !l.saved)).toBe(true);
    expect(savedCoverage({ fishLocked: false }).allSaved).toBe(false);
  });
});

describe("pretripSteps", () => {
  // 2026-07-29: + lớp dải màu (2 khung) + độ mặn + nước dâng/xoáy + dòng chảy tầng
  const EXTRA = PRETRIP_SCALAR_DAYS.length + 1 + 1 + 1;

  it("mỗi chỗ một việc + bản đồ cá + lưới gió/sóng + lớp màu + độ mặn + mùa vụ", () => {
    const steps = pretripSteps([
      { lat: 8.68, lon: 106.6, name: "Cảng nhà" },
      { lat: 16.5, lon: 112.0, name: "Hoàng Sa" },
    ]);
    expect(steps).toHaveLength(2 + 1 + PRETRIP_GRID_DAYS.length + EXTRA + 1);
    expect(steps[0].label).toBe("Gió sóng — Cảng nhà");
    expect(steps[2].label).toBe("Bản đồ cá");
    expect(steps[3].label).toBe("Gió sóng cả vùng biển — 3 ngày");
    expect(
      steps.some((s) => s.label === "Lớp mây mưa nhiệt — 16 ngày"),
    ).toBe(true);
    expect(steps.some((s) => s.label === "Độ mặn")).toBe(true);
    // mùa vụ đi CUỐI: nhẹ nhất, và không được chiếm sóng của dự báo thật
    expect(steps[steps.length - 1].label).toBe("Bản đồ mùa vụ");
  });

  it("không chỗ nào ghim → vẫn tải bản đồ cá + lưới + lớp màu + mùa vụ (không rỗng)", () => {
    expect(pretripSteps([]).length).toBe(
      1 + PRETRIP_GRID_DAYS.length + EXTRA + 1,
    );
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
