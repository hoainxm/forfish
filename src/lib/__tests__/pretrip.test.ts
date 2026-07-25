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
  doneLine,
  pretripSteps,
  savedLine,
  savedSummary,
  PRETRIP_GRID_DAYS,
} from "../pretrip";

const NOW = Date.parse("2026-07-25T03:00:00Z"); // 10:00 ngày 25/7 giờ VN

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
  it("mỗi chỗ một việc + bản đồ cá + các khung lưới gió/sóng", () => {
    const steps = pretripSteps([
      { lat: 8.68, lon: 106.6, name: "Cảng nhà" },
      { lat: 16.5, lon: 112.0, name: "Hoàng Sa" },
    ]);
    expect(steps).toHaveLength(2 + 1 + PRETRIP_GRID_DAYS.length);
    expect(steps[0].label).toBe("Gió sóng — Cảng nhà");
    expect(steps[2].label).toBe("Bản đồ cá");
    expect(steps[3].label).toBe("Gió sóng cả vùng biển — 3 ngày");
  });

  it("không chỗ nào ghim → vẫn tải bản đồ cá + lưới (không rỗng)", () => {
    expect(pretripSteps([]).length).toBe(1 + PRETRIP_GRID_DAYS.length);
  });
});

describe("savedSummary + savedLine — 'trong máy đang có gì'", () => {
  it("chưa có gì → nói thẳng", () => {
    expect(savedLine(savedSummary(), NOW)).toBe("Trong máy: chưa có dự báo nào");
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
    expect(savedLine(s, NOW)).toBe("Trong máy: dự báo tới 9/8 · 2 chỗ");
  });

  it("bản lưu đã qua ngày hết → KHÔNG khoe ngày cũ như thể còn dùng được", () => {
    saveForecast("point", "a", cond(["2026-07-10", "2026-07-20"]), 1000);
    expect(savedLine(savedSummary(), NOW)).toBe(
      "Trong máy: dự báo đã qua ngày hết",
    );
  });
});

describe("doneLine — câu kết sau khi bấm Chuẩn bị đi biển", () => {
  const saved = { places: 6, untilIso: "2026-08-09", gridDays: [3, 7, 16] };

  it("xong xuôi: nói giữ tới ngày nào, cho mấy chỗ", () => {
    expect(doneLine({ ok: 10, failed: 0, full: false, saved })).toBe(
      "Xong. Máy giữ dự báo tới ngày 9/8 cho 6 chỗ.",
    );
  });

  it("có phần hỏng → nói thật còn thiếu bao nhiêu", () => {
    expect(doneLine({ ok: 8, failed: 2, full: false, saved })).toContain(
      "Còn 2 phần chưa tải được",
    );
  });

  it("máy hết chỗ → báo hết chỗ, KHÔNG báo xong", () => {
    expect(doneLine({ ok: 5, failed: 0, full: true, saved })).toBe(
      "Máy hết chỗ nhớ — xoá bớt điểm đã lưu rồi làm lại.",
    );
  });

  it("chẳng tải được gì → không hứa suông", () => {
    expect(
      doneLine({
        ok: 0,
        failed: 9,
        full: false,
        saved: { places: 0, untilIso: null, gridDays: [] },
      }),
    ).toBe("Chưa tải được gì — kiểm tra sóng rồi làm lại.");
  });
});
