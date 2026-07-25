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

import { fetchSeaPoint } from "../marine-weather";
import { haversineKm } from "../geofence";

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
