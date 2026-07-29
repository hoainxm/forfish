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

import { fetchSeaPoint, seaPointFromGrid } from "../marine-weather";
import { haversineKm } from "../geofence";
import { saveForecast } from "../forecast-cache";
import {
  GRID_NS,
  GRID_SNAP_MAX_DEG,
  gridCacheId,
  type ForecastGrid,
  type GridHour,
} from "../forecast-grid";

/** Trả dữ liệu Open-Meteo tối thiểu để fetchSeaPointLive chạy được */
function fakeOk(url: string) {
  const marine = url.includes("marine-api");
  const body = marine
    ? {
        current: { wave_height: 1.2, wave_period: 6 },
        daily: { time: ["2026-07-25"], wave_height_max: [1.4] },
      }
    : {
        current: {
          wind_speed_10m: 18,
          wind_gusts_10m: 26,
          wind_direction_10m: 45,
        },
        daily: {
          time: ["2026-07-25"],
          wind_speed_10m_max: [20],
          wind_gusts_10m_max: [30],
          precipitation_sum: [0],
          weather_code: [1],
        },
      };
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

const online = () =>
  vi
    .fn()
    .mockImplementation((url: string) => fakeOk(url)) as unknown as typeof fetch;
const offline = () =>
  vi
    .fn()
    .mockRejectedValue(new Error("mất sóng")) as unknown as typeof fetch;

const CON_DAO = { lat: 8.68, lon: 106.6 };
// cùng ô lưới 0,25° với Côn Đảo (lệch vài km)
const SAT_BEN = { lat: 8.7, lon: 106.62 };
// cách rất xa — chỗ bà con chưa từng mở xem
const HOANG_SA = { lat: 16.5, lon: 112.0 };

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

/* LỖI đã sửa: mất sóng mà chạm điểm lạ thì app trả "bản lưu mới nhất của BẤT
   KỲ toạ độ nào" rồi dán nhãn theo chỗ vừa chạm — số của chỗ cách hàng trăm km
   hiện ra như số của chỗ đang đứng. */
describe("fetchSeaPoint offline — không mượn số của chỗ khác", () => {
  it("có sóng: lấy được số thật và lưu lại", async () => {
    globalThis.fetch = online();
    const c = await fetchSeaPoint(CON_DAO);
    expect(c.stale).toBe(false);
    expect(c.windKmh).toBe(18);
  });

  it("mất sóng, ĐÚNG chỗ đã xem → trả số cũ + cờ đã lưu", async () => {
    globalThis.fetch = online();
    await fetchSeaPoint(CON_DAO);
    globalThis.fetch = offline();
    const c = await fetchSeaPoint(CON_DAO);
    expect(c.stale).toBe(true);
    expect(c.savedAt).toBeTypeOf("number");
    expect(c.point).toEqual(CON_DAO);
  });

  it("mất sóng, chỗ sát bên (cùng ô ~0,25°) → vẫn dùng được, toạ độ theo chỗ vừa chạm", async () => {
    globalThis.fetch = online();
    await fetchSeaPoint(CON_DAO);
    globalThis.fetch = offline();
    const c = await fetchSeaPoint(SAT_BEN);
    expect(c.stale).toBe(true);
    expect(c.point).toEqual(SAT_BEN);
    // ô lưới nhỏ: sai lệch tối đa trong ô vẫn dưới ~30 km
    expect(haversineKm(CON_DAO.lat, CON_DAO.lon, SAT_BEN.lat, SAT_BEN.lon)).toBeLessThan(30);
  });

  it("mất sóng, chỗ CHƯA từng xem → KHÔNG trả số nào (thà không có còn hơn sai chỗ)", async () => {
    globalThis.fetch = online();
    await fetchSeaPoint(CON_DAO);
    globalThis.fetch = offline();
    await expect(fetchSeaPoint(HOANG_SA)).rejects.toThrow();
    // xác nhận đúng là chỗ rất xa — không phải sai số làm tròn lưới
    expect(
      haversineKm(CON_DAO.lat, CON_DAO.lon, HOANG_SA.lat, HOANG_SA.lon),
    ).toBeGreaterThan(50);
  });

  it("chưa từng lưu gì mà mất sóng → báo lỗi, không bịa số", async () => {
    globalThis.fetch = offline();
    await expect(fetchSeaPoint(CON_DAO)).rejects.toThrow();
  });
});

/* ---------------------------------------------------------------------------
   LẤY SỐ ĐIỂM TỪ LƯỚI ĐÃ LƯU (2026-07-25)

   Mâu thuẫn bà con thấy trên bản thật: bật chế độ máy bay, MŨI TÊN GIÓ vẫn vẽ
   đầy biển (lưới đã lưu) mà chạm vào thì sheet báo đỏ "chưa có số nào lưu trong
   máy". Nay chạm ô nào thì lấy số của ĐÚNG Ô ĐÓ — vẫn giữ bất biến "không mượn
   số của toạ độ khác": xa hơn nửa bước lưới là từ chối.
--------------------------------------------------------------------------- */

const h = (windKmh: number | null, waveM: number | null): GridHour => ({
  windKmh,
  windDirDeg: 90,
  waveM,
  waveDirDeg: 90,
});

/** Lưới một ô ở Hoàng Sa: 2 mốc giờ ngày 27, 1 mốc ngày 28 */
function gridAt(lat: number, lon: number): ForecastGrid {
  return {
    cells: [
      {
        lat,
        lon,
        hours: [h(10, 1.0), h(30, 2.2), h(20, 1.5)],
      },
    ],
    times: ["2026-07-27T00:00", "2026-07-27T12:00", "2026-07-28T00:00"],
  };
}

describe("seaPointFromGrid — dựng số điểm từ lưới đã lưu", () => {
  it("gộp theo NGÀY, mỗi ngày lấy gió lớn nhất + sóng cao nhất", () => {
    const c = seaPointFromGrid(gridAt(16.5, 112.0), HOANG_SA, 111)!;
    expect(c).not.toBeNull();
    expect(c.days.map((d) => d.date)).toEqual(["2026-07-27", "2026-07-28"]);
    expect(c.days[0].windMaxKmh).toBe(30);
    expect(c.days[0].waveMaxM).toBe(2.2);
    expect(c.days[1].windMaxKmh).toBe(20);
    expect(c.days[1].waveMaxM).toBe(1.5);
  });

  it("KHÔNG bịa mưa/dông/điểm đi biển — để trống hết", () => {
    const c = seaPointFromGrid(gridAt(16.5, 112.0), HOANG_SA, 111)!;
    for (const d of c.days) {
      expect(d.precipMm).toBeNull();
      expect(d.wmoCode).toBeNull();
      expect(d.score).toBeNull();
      expect(d.level).toBeNull();
    }
    // không có số đo "lúc này" trong lưới → để null, UI phải ẩn
    expect(c.windKmh).toBeNull();
    expect(c.waveM).toBeNull();
    expect(c.gustKmh).toBeNull();
  });

  it("nói rõ gốc gác: cờ đã lưu + mốc lưu + nguồn là lưới", () => {
    const c = seaPointFromGrid(gridAt(16.5, 112.0), HOANG_SA, 111)!;
    expect(c.stale).toBe(true);
    expect(c.savedAt).toBe(111);
    expect(c.source).toBe("saved-grid");
  });

  it("toạ độ trả về là CHỖ VỪA CHẠM, không phải tâm ô lưới", () => {
    const tap = { lat: 16.5 + 0.5, lon: 112.0 + 0.5 };
    const c = seaPointFromGrid(gridAt(16.5, 112.0), tap, 111)!;
    expect(c).not.toBeNull();
    expect(c.point).toEqual(tap);
  });

  it("xa hơn nửa bước lưới → KHÔNG dùng (giữ bất biến không mượn chỗ khác)", () => {
    const grid = gridAt(16.5, 112.0);
    // ngay trong ô → dùng được
    expect(
      seaPointFromGrid(grid, { lat: 16.5, lon: 112.0 + GRID_SNAP_MAX_DEG - 0.05 }, 1),
    ).not.toBeNull();
    // quá nửa bước lưới một chút → từ chối
    expect(
      seaPointFromGrid(grid, { lat: 16.5, lon: 112.0 + GRID_SNAP_MAX_DEG + 0.05 }, 1),
    ).toBeNull();
    // cách hàng trăm km → chắc chắn từ chối
    expect(seaPointFromGrid(grid, CON_DAO, 1)).toBeNull();
  });

  it("ô lưới không có số sóng nào (điểm trên đất liền) → onSea = false", () => {
    const g: ForecastGrid = {
      cells: [{ lat: 16.5, lon: 112.0, hours: [h(12, null), h(15, null)] }],
      times: ["2026-07-27T00:00", "2026-07-27T12:00"],
    };
    const c = seaPointFromGrid(g, HOANG_SA, 1)!;
    expect(c.onSea).toBe(false);
    expect(c.days[0].windMaxKmh).toBe(15);
    expect(c.days[0].waveMaxM).toBe(0); // 0 = "chưa có số", UI hiện "—"
  });

  it("lưới rỗng → null", () => {
    expect(seaPointFromGrid({ cells: [], times: [] }, HOANG_SA, 1)).toBeNull();
  });
});

describe("fetchSeaPoint offline — lùi về LƯỚI đã lưu khi chưa từng xem chỗ đó", () => {
  it("chỗ lạ nhưng nằm trong lưới đã lưu → có gió/sóng, đúng toạ độ vừa chạm", async () => {
    saveForecast(GRID_NS, gridCacheId(16), gridAt(16.5, 112.0));
    globalThis.fetch = offline();
    const c = await fetchSeaPoint(HOANG_SA);
    expect(c.source).toBe("saved-grid");
    expect(c.point).toEqual(HOANG_SA);
    expect(c.days[0].windMaxKmh).toBe(30);
  });

  it("chọn khung DÀI NGÀY NHẤT đang có (d16 hơn d3)", async () => {
    saveForecast(GRID_NS, gridCacheId(3), {
      cells: [{ lat: 16.5, lon: 112.0, hours: [h(5, 0.4)] }],
      times: ["2026-07-27T00:00"],
    } satisfies ForecastGrid);
    saveForecast(GRID_NS, gridCacheId(16), gridAt(16.5, 112.0));
    globalThis.fetch = offline();
    const c = await fetchSeaPoint(HOANG_SA);
    // d16 có 2 ngày, d3 chỉ 1 ngày → phải là d16
    expect(c.days).toHaveLength(2);
    expect(c.days[0].windMaxKmh).toBe(30);
  });

  it("có lưới nhưng chạm NGOÀI vùng lưới → vẫn nói thật là chưa có số", async () => {
    saveForecast(GRID_NS, gridCacheId(16), gridAt(16.5, 112.0));
    globalThis.fetch = offline();
    await expect(fetchSeaPoint(CON_DAO)).rejects.toThrow();
  });

  it("bản ĐẦY ĐỦ của đúng chỗ đó vẫn được ưu tiên hơn lưới", async () => {
    globalThis.fetch = online();
    await fetchSeaPoint(CON_DAO);
    saveForecast(GRID_NS, gridCacheId(16), gridAt(8.68, 106.6));
    globalThis.fetch = offline();
    const c = await fetchSeaPoint(CON_DAO);
    expect(c.source).toBe("saved-point");
  });
});

/* ---------------------------------------------------------------------------
   NẤC CUỐI: SNAPSHOT SERVER (2026-07-29) — bản web Safari mở lần đầu có kho
   localStorage TÁCH RIÊNG với PWA (trống trơn); Open-Meteo 429 theo IP → mọi
   nấc trong máy đều trượt. /api/weather-snapshot (same-origin, cron tính sẵn)
   là chỗ dựa cuối. Khung premium bị route chặn → tự rơi về d3.
--------------------------------------------------------------------------- */

describe("fetchSeaPoint — nấc cuối lùi về SNAPSHOT server", () => {
  const snapMock = (grids: Record<string, ForecastGrid>) =>
    vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("/api/weather-snapshot")) {
        const id = /id=grid%3Ad(\d+)|id=grid:d(\d+)/.exec(u);
        const d = id?.[1] ?? id?.[2];
        const g = d ? grids[d] : undefined;
        return Promise.resolve(
          g
            ? { ok: true, json: () => Promise.resolve(g) }
            : { ok: false },
        );
      }
      return Promise.reject(new Error("429"));
    }) as unknown as typeof fetch;

  it("máy trống trơn + live lỗi → dùng snapshot, nguồn saved-grid, savedAt null", async () => {
    globalThis.fetch = snapMock({ "16": gridAt(16.5, 112.0) });
    const c = await fetchSeaPoint(HOANG_SA);
    expect(c.source).toBe("saved-grid");
    expect(c.savedAt).toBeNull();
    expect(c.point).toEqual(HOANG_SA);
    expect(c.days[0].windMaxKmh).toBe(30);
  });

  it("khung premium bị chặn (d16 không trả) → rơi về snapshot d3", async () => {
    globalThis.fetch = snapMock({ "3": gridAt(16.5, 112.0) });
    const c = await fetchSeaPoint(HOANG_SA);
    expect(c.source).toBe("saved-grid");
    expect(c.days.length).toBeGreaterThan(0);
  });

  it("snapshot không phủ chỗ chạm → vẫn nói thật là chưa có số", async () => {
    globalThis.fetch = snapMock({ "16": gridAt(16.5, 112.0) });
    await expect(fetchSeaPoint(CON_DAO)).rejects.toThrow();
  });
});
