import "server-only";
import { timeoutSignal } from "@/lib/abort";
import { loadWeatherSnapshot, saveWeatherSnapshot } from "@/lib/weather-snapshot";
import { parseWeatherField } from "@/lib/route-weather";
import {
  encodeRouteTile,
  isRouteTile,
  parseRouteTileId,
  ROUTE_GRID_FORECAST_DAYS,
  routeTileIsFresh,
  routeTilePoints,
  type RouteTile,
} from "@/lib/route-grid";

/*
  Ô LƯỚI DẪN ĐƯỜNG phía server (xem lib/route-grid.ts). Lấy THEO NHU CẦU:
  có người tính tuyến qua ô nào thì server mới lấy ô đó, lưu `weather_snapshot`
  rồi mọi máy dùng chung tới khi cũ quá ROUTE_GRID_FRESH_MS. Nguồn lỗi/429 ⇒
  trả bản đã lưu (cũ vẫn hơn không — client tự dịch trục giờ theo `start`).

  Mỗi lượt làm mới một ô = 64 điểm × 2 lượt Open-Meteo, CHỈ ở server. Máy bà
  con không gọi nguồn ngoài nữa.
*/

/** Bản trong RAM của instance — chặn mỗi request lại đọc DB / gọi nguồn */
const memo = new Map<string, RouteTile>();
/** Lượt làm mới đang chạy theo id — nhiều máy hỏi cùng lúc chỉ gọi nguồn 1 lần */
const inflight = new Map<string, Promise<RouteTile | null>>();

async function fetchTileLive(r: number, c: number): Promise<RouteTile | null> {
  const { lats, lons } = routeTilePoints(r, c);
  const latList: number[] = [];
  const lonList: number[] = [];
  for (const la of lats)
    for (const lo of lons) {
      latList.push(la);
      lonList.push(lo);
    }
  const common =
    `latitude=${latList.join(",")}&longitude=${lonList.join(",")}` +
    `&timezone=Asia%2FHo_Chi_Minh&forecast_days=${ROUTE_GRID_FORECAST_DAYS}`;
  const [windRes, waveRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?${common}&hourly=wind_speed_10m,wind_direction_10m`,
      { signal: timeoutSignal(10000), cache: "no-store" },
    ),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction`,
      { signal: timeoutSignal(10000), cache: "no-store" },
    ),
  ]);
  if (!windRes.ok || !waveRes.ok) return null;
  const wind = await windRes.json();
  const wave = await waveRes.json();
  // nhiều vị trí ⇒ mảng; đủ đúng 64 vị trí mới nhận
  if (!Array.isArray(wind) || !Array.isArray(wave)) return null;
  if (wind.length !== latList.length || wave.length !== latList.length) return null;
  const firstTime: unknown = wind[0]?.hourly?.time?.[0];
  if (typeof firstTime !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(firstTime)) return null;
  const field = parseWeatherField(wind, wave, lats, lons);
  // ô toàn đất liền vẫn lưu (cells toàn null) để khỏi hỏi nguồn lại liên tục
  return encodeRouteTile(r, c, field, firstTime.slice(0, 10), new Date().toISOString());
}

/**
 * Lấy một ô theo id `routegrid:r:c`. `payload` null + `unreachable` false =
 * id sai / chưa từng có và nguồn không trả; `unreachable` true = không hỏi
 * được kho lẫn nguồn (route trả 503 để service worker cứu bằng bản trong máy).
 */
export async function getRouteTile(
  id: string,
  now: Date = new Date(),
): Promise<{ payload: RouteTile | null; unreachable: boolean }> {
  const rc = parseRouteTileId(id);
  if (!rc) return { payload: null, unreachable: false };

  let stored: RouteTile | null = memo.get(id) ?? null;
  if (!stored || !routeTileIsFresh(stored, now)) {
    const { payload } = await loadWeatherSnapshot(id, { noStore: true });
    if (isRouteTile(payload) && (!stored || payload.builtAt > stored.builtAt)) {
      stored = payload;
      memo.set(id, payload);
    }
  }
  if (stored && routeTileIsFresh(stored, now)) return { payload: stored, unreachable: false };

  let job = inflight.get(id);
  if (!job) {
    job = fetchTileLive(rc.r, rc.c)
      .catch(() => null)
      .finally(() => inflight.delete(id));
    inflight.set(id, job);
  }
  const fresh = await job;
  if (fresh) {
    memo.set(id, fresh);
    // lưu hỏng thì vẫn trả bản mới cho máy này — lượt sau server thử lưu lại
    await saveWeatherSnapshot(id, fresh).catch(() => false);
    return { payload: fresh, unreachable: false };
  }
  if (stored) return { payload: stored, unreachable: false };
  // không có bản lưu, nguồn cũng không trả ⇒ 503 (service worker cứu bằng bản trong máy)
  return { payload: null, unreachable: true };
}
