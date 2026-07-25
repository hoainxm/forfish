// Trục 1 — gió/sóng tại MỘT ĐIỂM bất kỳ trên biển (chạm vào bản đồ ngư trường).
// Bổ trợ cho src/lib/sea.ts (dự báo theo cảng): dùng chung cách chấm điểm
// scoreDay/levelOf để cả trang nói một giọng — KHÔNG tự chế thang điểm riêng.
// Nguồn: Open-Meteo (miễn phí, không key) — đổi nguồn chỉ sửa fetchSeaPoint.

import {
  scoreDay,
  levelOf,
  estimateWaveFromWind,
  type ScoredSeaDay,
} from "@/lib/sea";
import { saveForecast, loadForecast, coordId } from "@/lib/forecast-cache";

export type SeaPoint = { lat: number; lon: number };

export type SeaPointConditions = {
  point: SeaPoint;
  /** false = nguồn sóng không có số nào cho điểm này → gần như chắc là đất liền */
  onSea: boolean;
  /** Lúc này tại điểm đó — gió luôn có, sóng có thể thiếu nếu điểm sát bờ */
  windKmh: number;
  gustKmh: number | null;
  windDirDeg: number | null;
  waveM: number | null;
  wavePeriodS: number | null;
  /** FORECAST_MAX_DAYS ngày đã chấm điểm, phần tử đầu là hôm nay */
  days: ScoredSeaDay[];
  /** true = đang xem bản ĐÃ LƯU (offline/mất mạng), không phải bản mới */
  stale: boolean;
  /** epoch ms lúc bản này được lưu (chỉ có ý nghĩa khi stale) */
  savedAt: number | null;
};

/** Namespace localStorage cho dự báo điểm-chạm (offline) */
export const POINT_NS = "point";

/**
 * Tầm dự báo tối đa = TRẦN của nguồn: gió/mưa best-match (GFS 16 ngày) và SÓNG
 * từ NCEP GFS-Wave 0.25° (`WAVE_MODEL`) cũng phủ đủ 16 ngày. Best-match sóng chỉ
 * ~8 ngày nên phải chỉ định model. Ngày càng xa skill càng thấp — độ tin (bên
 * dưới) + ensemble spread nói thật, KHÔNG để mọi ngày trông chắc như nhau.
 * Đổi nguồn thì sửa số này + WAVE_MODEL tại đây, UI tự theo.
 */
export const FORECAST_MAX_DAYS = 16;
/** Model sóng phủ đủ 16 ngày (best-match chỉ ~8). */
const WAVE_MODEL = "ncep_gfswave025";

export type ForecastConfidence = {
  label: string;
  tone: "ok" | "warn";
};

/**
 * Độ tin của dự báo theo số ngày nhìn trước (0 = hôm nay) — nói thật với bà
 * con thay vì để mọi ngày trông chắc chắn như nhau. Mở tới 16 ngày.
 *
 * `dataConf` (0–1, tuỳ chọn) là độ tin ĐO ĐƯỢC từ dữ liệu — ensemble spread
 * (các thành viên mô hình lệch nhau nhiều = kém chắc) hoặc bảng skill backtest.
 * Có thì nó ưu tiên hạ nhãn xuống khi mô hình đang "cãi nhau", kể cả ngày gần.
 */
export function forecastConfidence(
  daysAhead: number,
  dataConf?: number | null,
): ForecastConfidence {
  // Nhãn nền theo tầm ngày (skill khí tượng giảm dần là quy luật, không cãi được)
  let base: ForecastConfidence;
  if (daysAhead <= 2) base = { label: "Dự báo gần — khá sát", tone: "ok" };
  else if (daysAhead <= 6)
    base = {
      label: "Dự báo 4–7 ngày — để tham khảo, gần ngày xem lại",
      tone: "warn",
    };
  else if (daysAhead <= 9)
    base = {
      label: "Dự báo xa 8–10 ngày — chỉ để liệu đường, sát ngày phải xem lại",
      tone: "warn",
    };
  else
    base = {
      label: "Dự báo rất xa 11–16 ngày — hướng chung thôi, chắc chắn xem lại",
      tone: "warn",
    };

  // Có tín hiệu đo được: mô hình lệch nhiều (conf thấp) thì kéo tone/nhãn xuống,
  // kể cả ngày gần — thời tiết đang khó đoán thì phải nói.
  if (dataConf != null && Number.isFinite(dataConf)) {
    if (dataConf < 0.4) {
      return {
        label: "Các mô hình đang lệch nhau — kém chắc, xem lại sát ngày",
        tone: "warn",
      };
    }
    if (dataConf >= 0.8 && base.tone === "warn" && daysAhead <= 6) {
      // các mô hình đồng thuận cao ở tầm vừa → bớt gắt hơn nhãn nền
      return { label: "Dự báo tham khảo — mô hình khá đồng thuận", tone: "ok" };
    }
  }
  return base;
}

/** km/h → cấp gió Beaufort (0–12), thang bà con quen nghe trên đài */
export function beaufort(kmh: number): number {
  const limits = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
  for (let i = 0; i < limits.length; i++) {
    if (kmh < limits[i]) return i;
  }
  return 12;
}

/** Hướng gió 0–360° → tên hướng tiếng Việt (8 hướng) */
export function windDirectionVN(deg: number): string {
  const names = [
    "Bắc",
    "Đông Bắc",
    "Đông",
    "Đông Nam",
    "Nam",
    "Tây Nam",
    "Tây",
    "Tây Bắc",
  ];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Số kiểu Việt: 1.2 → "1,2" */
export function formatNumberVN(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Gió + sóng cho một điểm chạm trên bản đồ. Sóng fail (điểm trên đất liền,
 * mạng chập chờn) không kéo sập cả dự báo — trả null, UI chạy bằng gió.
 */
export async function fetchSeaPoint(p: SeaPoint): Promise<SeaPointConditions> {
  const id = coordId(p.lat, p.lon);
  try {
    const cond = await fetchSeaPointLive(p);
    // LƯU bản mới nhất để ra biển mất mạng vẫn coi được 16 ngày
    saveForecast(POINT_NS, id, cond);
    return cond;
  } catch (err) {
    // Mất mạng / nguồn treo → CHỈ lùi về bản đã lưu ĐÚNG CHỖ NÀY (cùng ô lưới
    // ~0,25°). TUYỆT ĐỐI không mượn bản của chỗ khác: dán số của chỗ cách hàng
    // trăm km vào chỗ bà con vừa chạm còn nguy hiểm hơn là không có số.
    const hit = loadForecast<SeaPointConditions>(POINT_NS, id);
    if (hit) return { ...hit.data, point: p, stale: true, savedAt: hit.savedAt };
    throw err; // chỗ này chưa từng lưu → để UI báo "chưa có số nào trong máy"
  }
}

/** Gọi Open-Meteo THẬT (không cache) — tách ra để fetchSeaPoint bọc offline. */
async function fetchSeaPointLive(p: SeaPoint): Promise<SeaPointConditions> {
  const common = `latitude=${p.lat}&longitude=${p.lon}&timezone=Asia%2FHo_Chi_Minh&forecast_days=${FORECAST_MAX_DAYS}`;
  const windUrl =
    `https://api.open-meteo.com/v1/forecast?${common}` +
    `&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
    `&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,weather_code`;
  const waveUrl =
    `https://marine-api.open-meteo.com/v1/marine?${common}` +
    `&current=wave_height,wave_period&daily=wave_height_max&models=${WAVE_MODEL}`;

  const [wind, wave] = await Promise.all([
    fetch(windUrl, { signal: AbortSignal.timeout(15000) }).then((r) => {
      if (!r.ok) throw new Error(`wind ${r.status}`);
      return r.json();
    }),
    fetch(waveUrl, { signal: AbortSignal.timeout(15000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const days: ScoredSeaDay[] = (wind.daily?.time ?? []).map(
    (date: string, i: number) => {
      const windMaxKmh = num(wind.daily?.wind_speed_10m_max?.[i]) ?? 0;
      const rawWave = num(wave?.daily?.wave_height_max?.[i]);
      const waveMissing = rawWave == null;
      const d = {
        date,
        waveMaxM: waveMissing ? estimateWaveFromWind(windMaxKmh) : rawWave,
        windMaxKmh,
        gustMaxKmh: num(wind.daily?.wind_gusts_10m_max?.[i]) ?? 0,
        precipMm: num(wind.daily?.precipitation_sum?.[i]) ?? 0,
        wmoCode: num(wind.daily?.weather_code?.[i]),
        waveEstimated: waveMissing,
      };
      const score = scoreDay(d);
      return { ...d, score, level: levelOf(score) };
    },
  );
  if (days.length === 0) throw new Error("Dự báo trống");

  const waveDaily: unknown[] = wave?.daily?.wave_height_max ?? [];
  const onSea =
    num(wave?.current?.wave_height) != null ||
    waveDaily.some((v) => num(v) != null);

  return {
    point: p,
    onSea,
    windKmh: num(wind.current?.wind_speed_10m) ?? 0,
    gustKmh: num(wind.current?.wind_gusts_10m),
    windDirDeg: num(wind.current?.wind_direction_10m),
    waveM: num(wave?.current?.wave_height),
    wavePeriodS: num(wave?.current?.wave_period),
    days,
    stale: false,
    savedAt: null,
  };
}
