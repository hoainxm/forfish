// Lưu lịch sử dữ liệu Ra khơi (yêu cầu 2026-07-02: tích luỹ để predict).
// THUẦN — biến dữ liệu dự báo đang có thành hàng bảng Supabase (migration
// 0005_sea_history.sql). Cron gọi route /api/collect/sea-daily mỗi ngày.

import type { ScoredSeaDay } from "@/lib/sea";
import type { FishForecast } from "@/lib/fish-predict";
import type { StormAlert } from "@/lib/storms";

/** Ô cá đạt ngưỡng HOTSPOT mới đáng lưu (trùng ngưỡng chi tiết UI s ≥ 60) —
 *  lưới đầy ~nghìn ô/ngày, phần dưới ngưỡng không có giá trị predict. */
export const FISH_STORE_MIN_SCORE = 60;

export interface SeaDailyRow {
  collected_on: string;
  port_id: string;
  date: string;
  lead_days: number;
  wave_max_m: number | null;
  wind_max_kmh: number | null;
  gust_max_kmh: number | null;
  precip_mm: number | null;
  wmo_code: number | null;
  score: number | null;
}

export interface FishDailyRow {
  collected_on: string;
  source_date: string;
  lat: number;
  lon: number;
  score: number;
  top_species: string[];
  species_scores: Record<string, number>;
  sst_c: number | null;
  chl_mg_m3: number | null;
}

export interface StormRow {
  collected_on: string;
  storm_id: string;
  name: string;
  kind_label: string;
  wind_kmh: number | null;
  lat: number;
  lon: number;
  alert: string;
  updated_src: string | null;
}

/** Số ngày giữa 2 ISO date (yyyy-mm-dd), date - collectedOn. */
function daysBetween(collectedOn: string, date: string): number {
  const a = Date.UTC(
    Number(collectedOn.slice(0, 4)),
    Number(collectedOn.slice(5, 7)) - 1,
    Number(collectedOn.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}

const finite = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Dải dự báo 10 ngày của MỘT cảng → hàng sea_daily (kèm lead_days). Ngày
 *  lệch quá khứ (nguồn trả thừa) bị bỏ — lead_days luôn ≥ 0. */
export function toSeaDailyRows(
  collectedOn: string,
  portId: string,
  days: ScoredSeaDay[],
): SeaDailyRow[] {
  const rows: SeaDailyRow[] = [];
  for (const d of days) {
    const lead = daysBetween(collectedOn, d.date);
    if (lead < 0 || !Number.isFinite(lead)) continue;
    rows.push({
      collected_on: collectedOn,
      port_id: portId,
      date: d.date,
      lead_days: lead,
      wave_max_m: finite(d.waveMaxM),
      wind_max_kmh: finite(d.windMaxKmh),
      gust_max_kmh: finite(d.gustMaxKmh),
      precip_mm: finite(d.precipMm),
      wmo_code: finite(d.wmoCode ?? null),
      score: finite(d.score),
    });
  }
  return rows;
}

/** Dự báo cá → hàng hotspot (s ≥ FISH_STORE_MIN_SCORE). */
export function toFishDailyRows(
  collectedOn: string,
  forecast: FishForecast,
): FishDailyRow[] {
  return forecast.cells
    .filter((c) => c.s >= FISH_STORE_MIN_SCORE)
    .map((c) => ({
      collected_on: collectedOn,
      source_date: forecast.date,
      lat: c.lat,
      lon: c.lon,
      score: c.s,
      top_species: c.top,
      species_scores: c.sp,
      sst_c: finite(c.t),
      chl_mg_m3: finite(c.c),
    }));
}

/** Bão đang hoạt động → hàng storm_events. */
export function toStormRows(
  collectedOn: string,
  storms: StormAlert[],
): StormRow[] {
  return storms.map((s) => ({
    collected_on: collectedOn,
    storm_id: s.id,
    name: s.name,
    kind_label: s.kindLabel,
    wind_kmh: finite(s.windKmh),
    lat: s.lat,
    lon: s.lon,
    alert: s.alert,
    updated_src: s.updated || null,
  }));
}

/** Ngày hiện tại theo giờ VN (UTC+7) — cron chạy giờ UTC, không được lệch ngày. */
export function vnToday(now: Date): string {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  return vn.toISOString().slice(0, 10);
}
