// Trục 1 — Đánh bắt. Dự báo biển + điểm đi biển 1–100.
// Nguồn dữ liệu THẬT: Open-Meteo (miễn phí, không cần key, gọi thẳng từ trình duyệt).
//   · marine-api.open-meteo.com  → sóng (wave_height_max)
//   · api.open-meteo.com         → gió, mưa
// Điểm số chỉ để tham khảo — UI phải luôn kèm lời nhắc nghe đài duyên hải.

import type { FishingPort } from "@/data/ports";

export interface SeaDay {
  date: string; // ISO yyyy-mm-dd
  waveMaxM: number;
  windMaxKmh: number;
  gustMaxKmh: number;
  precipMm: number;
}

export type SeaLevel = "good" | "caution" | "bad";

export interface ScoredSeaDay extends SeaDay {
  score: number; // 1–100, càng cao càng êm
  level: SeaLevel;
}

const FORECAST_DAYS = 10;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 giờ — dự báo ngày không đổi nhanh hơn

export function scoreDay(d: SeaDay): number {
  let score = 100;
  // Sóng là yếu tố nặng nhất với tàu cá nhỏ.
  if (d.waveMaxM > 0.8) score -= (d.waveMaxM - 0.8) * 35;
  if (d.windMaxKmh > 20) score -= (d.windMaxKmh - 20) * 1.2;
  if (d.gustMaxKmh > 50) score -= (d.gustMaxKmh - 50) * 0.5;
  if (d.precipMm > 10) score -= (d.precipMm - 10) * 0.8;
  return Math.max(5, Math.min(100, Math.round(score)));
}

export function levelOf(score: number): SeaLevel {
  if (score >= 75) return "good";
  if (score >= 50) return "caution";
  return "bad";
}

export const LEVEL_LABEL: Record<SeaLevel, string> = {
  good: "Biển êm, đi được",
  caution: "Đi được, cần cẩn thận",
  bad: "Không nên ra khơi",
};

export async function fetchSeaForecast(
  port: FishingPort,
): Promise<ScoredSeaDay[]> {
  const cached = readCache(port.id);
  if (cached) return cached;

  const common = `latitude=${port.lat}&longitude=${port.lon}&timezone=Asia%2FHo_Chi_Minh&forecast_days=${FORECAST_DAYS}`;
  const [marineRes, weatherRes] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&daily=wave_height_max`,
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?${common}&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum`,
    ),
  ]);
  if (!marineRes.ok || !weatherRes.ok) {
    throw new Error("Không lấy được dự báo");
  }
  const marine = await marineRes.json();
  const weather = await weatherRes.json();

  const dates: string[] = weather.daily?.time ?? [];
  const days: ScoredSeaDay[] = dates.map((date, i) => {
    const d: SeaDay = {
      date,
      waveMaxM: marine.daily?.wave_height_max?.[i] ?? 0,
      windMaxKmh: weather.daily?.wind_speed_10m_max?.[i] ?? 0,
      gustMaxKmh: weather.daily?.wind_gusts_10m_max?.[i] ?? 0,
      precipMm: weather.daily?.precipitation_sum?.[i] ?? 0,
    };
    const score = scoreDay(d);
    return { ...d, score, level: levelOf(score) };
  });

  if (days.length === 0) throw new Error("Dự báo trống");
  writeCache(port.id, days);
  return days;
}

// ── cache trên máy, đỡ gọi mạng mỗi lần mở app ──────────────────────────
function cacheKey(portId: string) {
  return `forfish.sea.${portId}.v1`;
}

function readCache(portId: string): ScoredSeaDay[] | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(portId));
    if (!raw) return null;
    const { ts, days } = JSON.parse(raw) as {
      ts: number;
      days: ScoredSeaDay[];
    };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return days;
  } catch {
    return null;
  }
}

function writeCache(portId: string, days: ScoredSeaDay[]) {
  try {
    window.localStorage.setItem(
      cacheKey(portId),
      JSON.stringify({ ts: Date.now(), days }),
    );
  } catch {
    // storage đầy — bỏ qua, lần sau gọi lại mạng
  }
}
