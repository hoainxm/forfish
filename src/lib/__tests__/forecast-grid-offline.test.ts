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

import {
  fetchForecastGrid,
  savedGridDays,
  savedCurrentGridDays,
  gridIsCurrent,
  gridHasCurrent,
  gridPoints,
  GRID_NS,
  type ForecastGrid,
} from "../forecast-grid";
import { saveForecast } from "../forecast-cache";

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
      json: () => Promise.resolve(Array.from({ length: 156 }, () => one)),
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
  /* 2026-07-29: bản VỪA TẢI là bản HIỆN HÀNH (nguồn chưa ra bản mới) → dùng lại
     KHÔNG gọi nguồn và KHÔNG gắn "số cũ" — xem lib/source-cadence. */
  it("vừa tải xong, gọi lại → dùng cache, KHÔNG gọi nguồn, không gắn số cũ", async () => {
    globalThis.fetch = online(96);
    await fetchForecastGrid(3);
    const spy = vi.fn().mockRejectedValue(new Error("không được gọi"));
    globalThis.fetch = spy as unknown as typeof fetch;
    const g = await fetchForecastGrid(3);
    expect(spy).not.toHaveBeenCalled();
    expect(g.stale).toBeUndefined();
    expect(g.cells).toHaveLength(156);
  });

  it("mất sóng + bản lưu ĐÃ CŨ (qua mốc bản tin) → trả bản lưu + cờ đã lưu", async () => {
    globalThis.fetch = online(96);
    const g0 = await fetchForecastGrid(3);
    // ghi đè mốc lưu về 20 giờ trước (quá MAX_CACHE_MS) để ra đường "số cũ"
    saveForecast(GRID_NS, "d3", g0, Date.now() - 20 * 60 * 60 * 1000);
    globalThis.fetch = offline();
    const g = await fetchForecastGrid(3);
    expect(g.stale).toBe(true);
    expect(g.savedAt).toBeTypeOf("number");
    expect(g.cells).toHaveLength(156);
  });

  /*
    2026-07-29 ĐỔI LUẬT (trước: xin khung khác → luôn báo lỗi): từ khi BỎ chip
    chọn khung, thanh ngày vẽ theo times[] THẬT nên đưa lưới ngắn hơn KHÔNG còn
    nói dối (trước đây chip vẫn sáng "16 ngày" mới là dối). Thà 3 ngày thật còn
    hơn màn trắng khi Open-Meteo 429. Nhưng CHỈ mượn khung NGẮN HƠN.
  */
  it("mất sóng, xin khung DÀI mà chỉ có khung NGẮN → mượn khung ngắn (thà ít còn hơn trắng)", async () => {
    globalThis.fetch = online(96);
    const near = await fetchForecastGrid(3);
    globalThis.fetch = offline();
    const g = await fetchForecastGrid(16);
    expect(g.stale).toBe(true);
    expect(g.times.length).toBe(near.times.length); // đúng là bản d3
    expect(near.times.length).toBe(25);
  });

  /*  ⚠️ ĐỔI LUẬT 2026-08-02j — MƯỢN KHUNG DÀI ĐƯỢC, NHƯNG PHẢI **CẮT**.

      Luật cũ cấm hẳn, lý do ghi là "kẻo lộ tầm premium cho tài khoản thường".
      Với `truncateGrid` thì lo đó không còn: người xin 3 ngày nhận đúng 3 ngày,
      không thêm một mốc nào. Chốt quyền thật vẫn ở máy chủ (middleware chặn
      `/api/fish-forecast`, snapshot khung 16 trả 403 cho hạng thường) — đây chỉ
      là đường ĐỌC bản đã tải hợp lệ.

      Vì sao BẮT BUỘC phải có: từ 2026-08-02j, ghi được `d16` là `d3`/`d7` bị dọn
      ("một lớp một bản"). Mà khách PREMIUM lúc đang kiểm tra hạng
      (`premiumUnsure`) vẫn xin `FREE_FORECAST_DAYS = 3` ⇒ không có đường cắt từ
      `d16` xuống thì họ nhận màn trắng dù dữ liệu nằm ngay đó. */
  it("mượn khung DÀI cho khung ngắn — nhưng CẮT đúng số ngày đã xin", async () => {
    globalThis.fetch = online(400);
    const far = await fetchForecastGrid(16);
    globalThis.fetch = offline();
    const g = await fetchForecastGrid(3);
    expect(g.stale, "phải nói thật là bản đã lưu").toBe(true);
    expect(
      g.times.length,
      "trả nguyên khung 16 ⇒ lộ tầm premium cho hạng thường",
    ).toBeLessThan(far.times.length);
    // và đúng bằng khung 3 ngày thật
    expect(g.times.length).toBe(25);
    // nội dung phải là TIỀN TỐ của bản dài, không phải bản khác
    expect(g.times).toEqual(far.times.slice(0, g.times.length));
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

/*
  2026-07-29 (user): "luôn ưu tiên snapshot để hạn chế bị lock do IP tải nhiều"
  — máy không có bản tươi thì hỏi SNAPSHOT server (same-origin, không đụng hạn
  ngạch Open-Meteo theo IP) TRƯỚC khi gọi live; chỉ nhận khi snapshot còn HIỆN
  HÀNH theo nhịp phát hành (savedAt cron nhét vào payload).
*/
describe("ƯU TIÊN SNAPSHOT trước live", () => {
  const snapGrid = (savedAt: number, withCur = false): ForecastGrid & { savedAt: number } => ({
    cells: gridPoints().map((p) => ({
      lat: p.lat,
      lon: p.lon,
      hours: [
        {
          windKmh: 5,
          windDirDeg: 0,
          waveM: 1,
          waveDirDeg: 0,
          ...(withCur ? { curKmh: 1.2, curDirDeg: 45 } : {}),
        },
      ],
    })),
    times: ["2026-07-29T00:00"],
    savedAt,
  });

  it("máy trống + snapshot TƯƠI → dùng snapshot, KHÔNG gọi Open-Meteo, không gắn số cũ", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      calls.push(String(url));
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(snapGrid(Date.now())),
        });
      return Promise.reject(new Error("không được gọi nguồn"));
    }) as unknown as typeof fetch;
    const g = await fetchForecastGrid(3);
    expect(g.stale).toBeUndefined();
    expect(g.cells).toHaveLength(156);
    expect(calls.some((u) => u.includes("open-meteo"))).toBe(false);
  });

  it("snapshot CŨ (quá trần cache) → bỏ qua, đi live như cũ", async () => {
    const old = snapGrid(Date.now() - 20 * 60 * 60 * 1000);
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve(old) });
      return fakeOk(96)(String(url));
    }) as unknown as typeof fetch;
    const g = await fetchForecastGrid(3);
    // bản live 3 ngày có 25 mốc; snapshot giả chỉ 1 mốc → chứng tỏ đã đi live
    expect(g.times.length).toBe(25);
    expect(g.stale).toBeUndefined();
  });

  it("khung KHÔNG nằm trong bộ snapshot (d7) → không hỏi snapshot, đi live thẳng", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      calls.push(String(url));
      return fakeOk(96)(String(url));
    }) as unknown as typeof fetch;
    await fetchForecastGrid(7);
    expect(calls.some((u) => u.includes("/api/weather-snapshot"))).toBe(false);
  });

  it("lớp DÒNG CHẢY: bản tươi trong máy KHÔNG có số dòng chảy → bỏ nấc đó, kéo bản có", async () => {
    globalThis.fetch = online(96); // fakeOk không có ocean_current → bản lưu thiếu cur
    await fetchForecastGrid(3);
    // giờ snapshot có cur — needCurrent phải vượt qua cache tươi (thiếu cur) mà lấy nó
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/weather-snapshot"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(snapGrid(Date.now(), true)),
        });
      return Promise.reject(new Error("nguồn hỏng"));
    }) as unknown as typeof fetch;
    const g = await fetchForecastGrid(3, { needCurrent: true });
    expect(gridHasCurrent(g)).toBe(true);
    // snapshot vừa nhận được LƯU ĐÈ vào máy (đúng tuổi thật) → lớp GIÓ sau đó
    // cũng đọc được bản có dòng chảy, khỏi tải lại
    globalThis.fetch = offline();
    const g2 = await fetchForecastGrid(3);
    expect(gridHasCurrent(g2)).toBe(true);
    expect(g2.stale).toBeUndefined(); // bản hiện hành, không phải "số cũ"
  });
});

/*
  2026-07-29: mở lưới 80→156 điểm phủ vùng RỘNG hơn. Bản lưu ĐỜI CŨ chỉ phủ
  "cửa sổ nhỏ" cũ — 429/mất sóng mà nhận nó thì lớp màu/hạt co cụm một góc.
*/
describe("gridIsCurrent — loại bản lưu đời cũ (vùng phủ nhỏ)", () => {
  /** lưới đời cũ 8×10 = 80 ô, bbox 102,5–117,25 / 6–21,3 */
  function oldGrid(): ForecastGrid {
    const cells = [];
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 8; j++) {
        cells.push({
          lat: Math.round((6 + (i * (21.3 - 6)) / 9) * 100) / 100,
          lon: Math.round((102.5 + (j * (117.25 - 102.5)) / 7) * 100) / 100,
          hours: [{ windKmh: 20, windDirDeg: 45, waveM: 1, waveDirDeg: 90 }],
        });
      }
    }
    return { cells, times: ["2026-07-20T00:00"] };
  }

  it("lưới hiện tại → true; lưới cũ 80 ô (bbox NHỎ) → false", () => {
    const current: ForecastGrid = {
      cells: gridPoints().map((p) => ({ lat: p.lat, lon: p.lon, hours: [] })),
      times: [],
    };
    expect(gridIsCurrent(current)).toBe(true);
    expect(gridIsCurrent(oldGrid())).toBe(false);
  });

  it("bản THƯA HƠN nhưng CÙNG VÙNG PHỦ (110 ô) → vẫn dùng được", () => {
    // 11×10 phủ đúng 98–123°Đ / 1–24°B như lưới hiện tại, chỉ thưa hơn
    const cells = [];
    for (let i = 0; i < 11; i++) {
      for (let j = 0; j < 10; j++) {
        cells.push({
          lat: Math.round((1 + (i * 23) / 10) * 100) / 100,
          lon: Math.round((98 + (j * 25) / 9) * 100) / 100,
          hours: [],
        });
      }
    }
    expect(gridIsCurrent({ cells, times: [] })).toBe(true);
  });

  it("mất sóng + máy chỉ có bản ĐỜI CŨ → LỚP VẼ coi như không có (báo lỗi, không co cụm)", async () => {
    saveForecast(GRID_NS, "d16", oldGrid());
    globalThis.fetch = offline();
    await expect(fetchForecastGrid(16)).rejects.toThrow();
    // chip khung của LỚP VẼ không mời sang bản cũ…
    expect(savedCurrentGridDays()).toEqual([]);
    // …nhưng tra ĐIỂM/tuyến vẫn biết trong máy còn bản d16 (nearestGridCell tự chặn vùng)
    expect(savedGridDays()).toEqual([16]);
  });
});
