// THỰC TẾ ERA5 THEO NGÀY cho 10 cảng (2026-10-19) — để đo skill dự báo LIÊN TỤC thay vì
// backtest tay mỗi quý (ops/forecast-accuracy.md). `sea_daily` đã giữ DỰ BÁO 10 ngày/cảng
// từ 07/07; thiếu vế "hôm đó thật ra sóng gió bao nhiêu". Nguồn: Open-Meteo archive
// (ERA5, gió) + marine archive (ERA5-Ocean, sóng) — cùng hai endpoint forecast-backtest.mjs
// đã xác minh 2026-07-25, miễn phí, không khoá. ERA5 trễ ~5 ngày ⇒ mỗi ngày lấy cửa sổ
// [hôm nay−9, hôm nay−5] (5 ngày, tự lấp ngày trước đó lỡ hỏng mạng), ghi mỗi ngày một
// file `actual/<YYYY>/<YYYY-MM-DD>/era5-ports.json.gz` vào kho `forecast-archive`
// (04 §0058). Không route nào đọc cho app — đọc bằng script offline. Không có PII.
//
// Chỉ phần thuần ở đây (dựng URL, cắt cửa sổ, ghép JSON) để test được; fetch + ghi kho ở
// route /api/collect/archive. Nguồn hỏng một cảng ⇒ cảng đó `null`, cảng khác vẫn ghi —
// KHÔNG bịa số.
import type { FishingPort } from "@/data/ports";

export const ACTUAL_LAG_DAYS = 5; // ERA5 có dữ liệu tới ~hôm nay−5
export const ACTUAL_WINDOW_DAYS = 5; // mỗi lượt lấy 5 ngày để tự lấp lỗ
export const ACTUAL_FILE = "era5-ports";
export const ACTUAL_FETCH_TIMEOUT_MS = 15_000;

export interface PortActual {
  windMaxKmh: number | null; // wind_speed_10m_max (ERA5, km/h)
  gustMaxKmh: number | null; // wind_gusts_10m_max
  rainMm: number | null; // precipitation_sum
  waveMaxM: number | null; // wave_height_max (ERA5-Ocean, m)
}

export interface ActualDayFile {
  date: string; // ngày thực tế (GMT — cùng quy ước forecast-backtest để khớp ERA5)
  source: "open-meteo-archive-era5";
  fetchedAt: string;
  ports: Record<string, PortActual | null>; // id cảng → số đo; null = không lấy được cảng đó
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Cửa sổ ngày thực tế cần lấy cho ngày chạy `todayIso`: [today−9, today−5]. */
export function actualWindow(todayIso: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) throw new Error(`actualWindow: ngày không hợp lệ "${todayIso}"`);
  const end = addDaysIso(todayIso, -ACTUAL_LAG_DAYS);
  return { start: addDaysIso(end, -(ACTUAL_WINDOW_DAYS - 1)), end };
}

/** Hai URL cho một cảng — gió (archive-api) và sóng (marine-api), timezone GMT để ngày khớp ERA5. */
export function actualUrls(port: Pick<FishingPort, "lat" | "lon">, win: { start: string; end: string }): { wind: string; wave: string } {
  const q = `latitude=${port.lat}&longitude=${port.lon}&start_date=${win.start}&end_date=${win.end}&timezone=GMT`;
  return {
    wind: `https://archive-api.open-meteo.com/v1/archive?${q}&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum`,
    wave: `https://marine-api.open-meteo.com/v1/marine?${q}&daily=wave_height_max`,
  };
}

interface DailyJson {
  daily?: { time?: unknown; [k: string]: unknown };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Đọc một biến daily của Open-Meteo thành map ngày → số (null khi thiếu/không phải số). */
function dailyMap(json: DailyJson | null, key: string): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const time = json?.daily?.time;
  const vals = json?.daily?.[key];
  if (!Array.isArray(time) || !Array.isArray(vals)) return out;
  time.forEach((t, i) => {
    if (typeof t === "string") out.set(t.slice(0, 10), num(vals[i]));
  });
  return out;
}

/**
 * Ghép JSON gió + sóng của MỘT cảng thành số đo theo ngày trong cửa sổ.
 * Thiếu cả hai nguồn ⇒ `null` cho cảng đó ở mọi ngày; thiếu một nguồn ⇒ trường đó null.
 */
export function portActualByDay(
  windJson: DailyJson | null,
  waveJson: DailyJson | null,
  win: { start: string; end: string },
): Map<string, PortActual | null> {
  const wind = dailyMap(windJson, "wind_speed_10m_max");
  const gust = dailyMap(windJson, "wind_gusts_10m_max");
  const rain = dailyMap(windJson, "precipitation_sum");
  const wave = dailyMap(waveJson, "wave_height_max");
  const out = new Map<string, PortActual | null>();
  for (let d = win.start; d <= win.end; d = addDaysIso(d, 1)) {
    const has = wind.has(d) || wave.has(d);
    out.set(
      d,
      has
        ? {
            windMaxKmh: wind.get(d) ?? null,
            gustMaxKmh: gust.get(d) ?? null,
            rainMm: rain.get(d) ?? null,
            waveMaxM: wave.get(d) ?? null,
          }
        : null,
    );
  }
  return out;
}

/** Gộp theo ngày: mỗi ngày một file có đủ 10 cảng (cảng hỏng = null). */
export function buildActualDayFiles(
  perPort: ReadonlyArray<{ id: string; byDay: Map<string, PortActual | null> }>,
  win: { start: string; end: string },
  fetchedAt: string,
): ActualDayFile[] {
  const files: ActualDayFile[] = [];
  for (let d = win.start; d <= win.end; d = addDaysIso(d, 1)) {
    const ports: Record<string, PortActual | null> = {};
    for (const p of perPort) ports[p.id] = p.byDay.get(d) ?? null;
    files.push({ date: d, source: "open-meteo-archive-era5", fetchedAt, ports });
  }
  return files;
}

/** Một file "có số" khi ít nhất một cảng có ít nhất một trường khác null — file rỗng không ghi. */
export function actualFileHasData(f: ActualDayFile): boolean {
  return Object.values(f.ports).some((p) => p && Object.values(p).some((v) => v !== null));
}
