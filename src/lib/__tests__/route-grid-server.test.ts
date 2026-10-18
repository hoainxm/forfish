import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Kho snapshot giả trong RAM
const kho = new Map<string, unknown>();
vi.mock("@/lib/weather-snapshot", () => ({
  loadWeatherSnapshot: vi.fn(async (id: string) => ({ payload: kho.get(id) ?? null, unreachable: false })),
  saveWeatherSnapshot: vi.fn(async (id: string, p: unknown) => {
    kho.set(id, p);
    return true;
  }),
}));

import { getRouteTile } from "../route-grid-server";
import { ROUTE_GRID_FRESH_MS, ROUTE_TILE_N, vnDate, type RouteTile } from "../route-grid";

const N = ROUTE_TILE_N * ROUTE_TILE_N;
const NOW = new Date("2026-10-16T10:00:00+07:00");

/** Open-Meteo giả: 64 vị trí, 96 giờ, mọi mắt là biển */
function omOk() {
  const H = 96;
  const time = Array.from({ length: H }, (_, t) => `2026-10-16T${String(t % 24).padStart(2, "0")}:00`);
  const arr = (v: number) => Array.from({ length: H }, () => v);
  return vi.fn(async (url: unknown) => {
    const marine = String(url).includes("marine-api");
    const loc = marine
      ? { hourly: { time, wave_height: arr(1.5), wave_direction: arr(90), wave_period: arr(7), ocean_current_velocity: arr(0.5), ocean_current_direction: arr(10) } }
      : { hourly: { time, wind_speed_10m: arr(20), wind_direction_10m: arr(45) } };
    return { ok: true, status: 200, json: async () => Array.from({ length: N }, () => loc) } as unknown as Response;
  });
}

function storedTile(id: string, builtAt: Date, start = vnDate(builtAt)): RouteTile {
  const [, r, c] = id.split(":").map(Number);
  return { v: 1, r, c, start, builtAt: builtAt.toISOString(), cells: Array.from({ length: N }, () => null) };
}

let seq = 0;
/** Mỗi test một id riêng — bộ nhớ RAM của module không lẫn giữa các test */
const nextId = () => {
  seq += 1;
  return `routegrid:${Math.floor(seq / 6) % 6}:${seq % 6}`;
};

beforeEach(() => {
  kho.clear();
  vi.unstubAllGlobals();
});

describe("getRouteTile — server giữ ô lưới dẫn đường", () => {
  it("id sai → không đụng nguồn", async () => {
    const f = omOk();
    vi.stubGlobal("fetch", f);
    expect(await getRouteTile("routegrid:9:9", NOW)).toEqual({ payload: null, unreachable: false });
    expect(f).not.toHaveBeenCalled();
  });

  it("chưa có ô → lấy nguồn, LƯU vào kho, trả ô hợp lệ", async () => {
    const id = nextId();
    const f = omOk();
    vi.stubGlobal("fetch", f);
    const { payload } = await getRouteTile(id, NOW);
    expect(f).toHaveBeenCalledTimes(2); // gió + sóng
    expect(payload?.start).toBe("2026-10-16");
    expect(payload?.cells.every((c) => c !== null)).toBe(true);
    expect(kho.get(id)).toEqual(payload);
  });

  it("ô trong kho còn tươi → KHÔNG gọi nguồn", async () => {
    const id = nextId();
    kho.set(id, storedTile(id, new Date(NOW.getTime() - 60_000)));
    const f = omOk();
    vi.stubGlobal("fetch", f);
    const { payload } = await getRouteTile(id, NOW);
    expect(f).not.toHaveBeenCalled();
    expect(payload).toEqual(kho.get(id));
  });

  it("ô cũ + nguồn lỗi/429 → vẫn trả bản cũ (cũ còn hơn không)", async () => {
    const id = nextId();
    const cu = storedTile(id, new Date(NOW.getTime() - ROUTE_GRID_FRESH_MS - 60_000));
    kho.set(id, cu);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response));
    expect(await getRouteTile(id, NOW)).toEqual({ payload: cu, unreachable: false });
  });

  it("không có bản nào + nguồn sập → unreachable (route trả 503 cho SW cứu)", async () => {
    const id = nextId();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("mất mạng");
    }));
    expect(await getRouteTile(id, NOW)).toEqual({ payload: null, unreachable: true });
  });

  it("nguồn trả thiếu vị trí → không nhận (không lưu ô hỏng)", async () => {
    const id = nextId();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => [{}] }) as unknown as Response));
    const r = await getRouteTile(id, NOW);
    expect(r.payload).toBeNull();
    expect(kho.has(id)).toBe(false);
  });
});
