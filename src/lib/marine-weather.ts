// Trục 1 — gió/sóng tại MỘT ĐIỂM bất kỳ trên biển (chạm vào bản đồ ngư trường).
// Bổ trợ cho src/lib/sea.ts (dự báo theo cảng): dùng chung cách chấm điểm
// scoreDay/levelOf để cả trang nói một giọng — KHÔNG tự chế thang điểm riêng.
// Nguồn: Open-Meteo (miễn phí, không key) — đổi nguồn chỉ sửa fetchSeaPoint.

import { scoreDay, levelOf, type ScoredSeaDay } from "@/lib/sea";

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
};

/**
 * Tầm dự báo tối đa theo nguồn hiện tại: mô hình gió cho tới 16 ngày nhưng
 * mô hình sóng chỉ chắc tới 10 — lấy 10 để mọi ngày đều đủ cả gió lẫn sóng.
 * Đổi nguồn thì sửa số này tại đây, UI tự theo.
 */
export const FORECAST_MAX_DAYS = 10;

export type ForecastConfidence = {
  label: string;
  tone: "ok" | "warn";
};

/**
 * Độ tin của dự báo theo số ngày nhìn trước — nói thật với bà con thay vì
 * để mọi ngày trông chắc chắn như nhau.
 */
export function forecastConfidence(daysAhead: number): ForecastConfidence {
  if (daysAhead <= 2) {
    return { label: "Dự báo gần — khá sát", tone: "ok" };
  }
  if (daysAhead <= 6) {
    return {
      label: "Dự báo 4–7 ngày — để tham khảo, gần ngày xem lại",
      tone: "warn",
    };
  }
  return {
    label: "Dự báo xa — chỉ để liệu đường, sát ngày phải xem lại",
    tone: "warn",
  };
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
  const common = `latitude=${p.lat}&longitude=${p.lon}&timezone=Asia%2FHo_Chi_Minh&forecast_days=${FORECAST_MAX_DAYS}`;
  const windUrl =
    `https://api.open-meteo.com/v1/forecast?${common}` +
    `&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
    `&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,weather_code`;
  const waveUrl =
    `https://marine-api.open-meteo.com/v1/marine?${common}` +
    `&current=wave_height,wave_period&daily=wave_height_max`;

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
      const d = {
        date,
        waveMaxM: num(wave?.daily?.wave_height_max?.[i]) ?? 0,
        windMaxKmh: num(wind.daily?.wind_speed_10m_max?.[i]) ?? 0,
        gustMaxKmh: num(wind.daily?.wind_gusts_10m_max?.[i]) ?? 0,
        precipMm: num(wind.daily?.precipitation_sum?.[i]) ?? 0,
        wmoCode: num(wind.daily?.weather_code?.[i]),
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
  };
}
