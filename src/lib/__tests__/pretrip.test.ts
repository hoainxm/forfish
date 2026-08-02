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
  pretripTimedOut,
  savedSummary,
  savedLayers,
  savedCoverage,
  CURDEPTH_STEP_MAX_MS,
  PRETRIP_GRID_DAYS,
  PRETRIP_MAX_MS,
  PRETRIP_SCALAR_DAYS,
} from "../pretrip";
import { coverageChipOk, coverageChipText } from "../pretrip-auto";

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
    // 2026-08-01: tin bão + giá cá/dầu nay cũng nằm trong máy (trước chỉ sống
    // trong kho service worker, không ai tải sẵn và không ai kiểm)
    saveForecast("storm", "latest", { ok: true, storms: [], checkedAt: "x" });
    saveForecast("price", "port", { ok: true, prices: [] });
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

  /* BANNER "ĐÃ CŨ" HIỆN HOÀI MÀ BẤM KHÔNG ĐƯỢC GÌ (lỗi thật, sửa 2026-08-02).
     Bản đồ cá đo tuổi bằng `generatedAt` (lúc CRON tính) nhưng lại đem so với
     nhịp Open-Meteo (4 mốc/ngày, trần 12 giờ) — trong khi `/api/fish-forecast`
     CHỈ tính bản mới khi snapshot quá 30 giờ. Client khắt khe hơn máy chủ ⇒ cứ
     vài giờ sau mỗi lần cron chạy là chip đỏ "Dự báo trong máy đã cũ — chạm tải
     mới", mà chạm "Tải mới" thì route trả lại ĐÚNG bản đang có ⇒ bấm bao nhiêu
     lần cũng không đổi. BẤT BIẾN: ngưỡng "còn mới" phía client KHÔNG được chặt
     hơn ngưỡng route thật sự đi tính bản mới. */
  describe("lớp bản đồ cá — 'còn mới' theo NHỊP SNAPSHOT, không theo nhịp Open-Meteo", () => {
    const seedFish = (agoMs: number) => {
      saveForecast("fishmark", "latest", {
        targetDate: "2026-08-01",
        generatedAt: new Date(Date.now() - agoMs).toISOString(),
      });
      return savedLayers({ fishLocked: false }).find((l) => l.id === "fish")!;
    };

    it("cron tính 8 giờ trước → CÒN MỚI (route chưa tính lại, chạm 'Tải mới' cũng chỉ nhận đúng bản này)", () => {
      const fish = seedFish(8 * 3600_000);
      expect(fish.saved).toBe(true);
      expect(fish.fresh).toBe(true);
    });

    it("13 giờ — quá trần 12 giờ của nhịp Open-Meteo — vẫn CÒN MỚI", () => {
      expect(seedFish(13 * 3600_000).fresh).toBe(true);
    });

    it("cron ĐỨNG hơn 30 giờ → ĐÃ CŨ (đúng lúc đó route tự tính live nên nút có tác dụng thật)", () => {
      expect(seedFish(31 * 3600_000).fresh).toBe(false);
    });

    it("chưa lưu / đang khoá premium → không bao giờ nhận là 'còn mới'", () => {
      expect(
        savedLayers({ fishLocked: false }).find((l) => l.id === "fish")!.fresh,
      ).toBe(false);
      seedFish(1000);
      expect(
        savedLayers({ fishLocked: true }).find((l) => l.id === "fish")!.fresh,
      ).toBe(false);
    });

    it("đủ lớp + bản cá 8 giờ trước → chip XANH, KHÔNG hiện banner 'đã cũ'", () => {
      seedAll();
      seedFish(8 * 3600_000);
      const cov = savedCoverage({ fishLocked: false });
      expect(cov.allSaved).toBe(true);
      expect(coverageChipOk(cov, "2026-08-02")).toBe(true);
      expect(coverageChipText("idle", cov, "2026-08-02")).not.toContain("đã cũ");
    });

    it("đủ lớp nhưng cron đứng 31 giờ → VẪN phải nói thật là đã cũ", () => {
      seedAll();
      seedFish(31 * 3600_000);
      const cov = savedCoverage({ fishLocked: false });
      expect(coverageChipText("idle", cov, "2026-08-02")).toBe(
        "Dự báo trong máy đã cũ — chạm tải mới",
      );
    });
  });
});

describe("pretripSteps", () => {
  // 2026-07-29: + lớp dải màu (2 khung) + độ mặn + nước dâng/xoáy + dòng chảy tầng
  // 2026-08-01: + tin bão + giá cá/dầu (2 bước), đứng TRƯỚC bản đồ cá
  const EXTRA = PRETRIP_SCALAR_DAYS.length + 1 + 1 + 1 + 2;

  it("mỗi chỗ một việc + bản đồ cá + lưới gió/sóng + lớp màu + độ mặn + mùa vụ", () => {
    const steps = pretripSteps([
      { lat: 8.68, lon: 106.6, name: "Cảng nhà" },
      { lat: 16.5, lon: 112.0, name: "Hoàng Sa" },
    ]);
    expect(steps).toHaveLength(2 + 1 + PRETRIP_GRID_DAYS.length + EXTRA + 1);
    expect(steps[0].label).toBe("Gió sóng — Cảng nhà");
    // tin bão đứng TRƯỚC bản đồ cá: thứ duy nhất dính tính mạng
    expect(steps[2].label).toBe("Tin bão");
    expect(steps[3].label).toBe("Giá cá, giá dầu");
    expect(steps[4].label).toBe("Bản đồ cá");
    expect(steps[5].label).toBe("Gió sóng cả vùng biển — 3 ngày");
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

/*
  TRẦN THỜI GIAN CẢ MẺ (D-PH3, 2026-08-02). Chuỗi 12–14 bước chạy tuần tự, mỗi
  bước ôm đồng hồ riêng 20–55 giây ⇒ ca sóng "sống mà chết" đo ra ~13 phút, suốt
  thời gian đó cờ `running` khoá mọi lần thử khác và rời màn cũng không dừng.
  ĐI KÈM shouldMarkPretripRun đọc `gained`: cắt sớm mà cửa chặn còn đọc KHO thì
  mẻ bị cắt cũng khoá 6 giờ.
*/
describe("pretripTimedOut — trần thời gian cả mẻ", () => {
  it("chưa tới trần → chạy tiếp", () => {
    expect(pretripTimedOut(1000, 1000 + PRETRIP_MAX_MS - 1)).toBe(false);
  });

  it("đúng trần / quá trần → dừng, đừng vắt kiệt từng đồng hồ một", () => {
    expect(pretripTimedOut(1000, 1000 + PRETRIP_MAX_MS)).toBe(true);
    expect(pretripTimedOut(1000, 1000 + 13 * 60_000)).toBe(true);
  });

  it("đồng hồ máy chỉnh LÙI giữa mẻ → không cắt oan", () => {
    expect(pretripTimedOut(1000, 500)).toBe(false);
  });

  it("trần cả mẻ 4 phút, riêng bước dòng chảy tầng 90 giây (đang chiếm 330s)", () => {
    expect(PRETRIP_MAX_MS).toBe(240_000);
    expect(CURDEPTH_STEP_MAX_MS).toBeLessThan(PRETRIP_MAX_MS / 2);
  });
});
