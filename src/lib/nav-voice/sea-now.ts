// CHẾ ĐỘ ĐANG CHẠY — SÓNG GIÓ GIỜ TỚI TẠI CHỖ TÀU (thuần).
//
// Đọc từ lưới gió/sóng ĐÃ LƯU trong máy (`loadLongestSavedGrid` → nơi gọi đổi
// sang WeatherField bằng `gridToWeatherField`) — không gọi mạng, chạy được giữa
// biển nhiều ngày. Câu luôn kèm giờ tải số (doc 15 §6.7, 07 §10.1: số cũ không
// được trông như số mới).
//
// Ngưỡng (doc 15 Assumptions 5 — chủ dự án chốt 2026-10-13):
//  · tàu < 15 m (hoặc chưa khai chiều dài): sóng ≥ 2 m HOẶC gió ≥ cấp 6
//  · tàu ≥ 15 m: sóng ≥ 3 m HOẶC gió ≥ cấp 7
//  · mức 2 ("rất xấu"): sóng ≥ ngưỡng + 1,5 m HOẶC gió ≥ ngưỡng + 2 cấp

import { beaufort } from "@/lib/marine-weather";
import { sampleField, vnHourIndex, type WeatherField } from "@/lib/route-plan";
import type { LatLon } from "@/lib/route-plan";
import { clockSpeech, waveSpeech } from "@/lib/nav-voice/phrases";

export const SEA_LOOKAHEAD_H = 6;
export const SEA_BIG_BOAT_M = 15;

export type SeaLevel = 0 | 1 | 2;

export type SeaObservation = {
  level: SeaLevel;
  /** "gió cấp 4, sóng chừng 1 mét" — giờ hiện tại */
  summary: string;
  /** câu cảnh báo khi level ≥ 1, null khi biển chưa xấu */
  warn: string | null;
  savedAt: number | null;
};

export function seaThresholds(lengthM: number | null | undefined): { waveM: number; cap: number } {
  return lengthM != null && lengthM >= SEA_BIG_BOAT_M ? { waveM: 3, cap: 7 } : { waveM: 2, cap: 6 };
}

export function seaLevelOf(waveM: number | null, windKmh: number | null, lengthM: number | null | undefined): SeaLevel {
  const t = seaThresholds(lengthM);
  const c = windKmh != null && Number.isFinite(windKmh) ? beaufort(windKmh) : 0;
  const w = waveM != null && Number.isFinite(waveM) ? waveM : 0;
  if (w >= t.waveM + 1.5 || c >= t.cap + 2) return 2;
  if (w >= t.waveM || c >= t.cap) return 1;
  return 0;
}

function savedLine(savedAt: number | null, nowMs: number): string {
  if (savedAt == null || !Number.isFinite(savedAt)) return "Số dự báo đã lưu trong máy.";
  const age = nowMs - savedAt;
  if (age < 12 * 3600_000) return `Số dự báo tải lúc ${clockSpeech(savedAt)}.`;
  const h = Math.round(age / 3600_000);
  return h < 48 ? `Số dự báo tải cách đây ${h} giờ.` : `Số dự báo tải cách đây ${Math.round(h / 24)} ngày.`;
}

/**
 * Quan sát sóng gió 6 giờ tới tại `pos`. null khi lưới không phủ chỗ này / giờ
 * này (không bịa số — câu bản tin sẽ nói "máy chưa có dự báo").
 */
export function seaObservation(
  field: WeatherField | null,
  pos: LatLon | null,
  now: Date,
  lengthM: number | null | undefined,
): SeaObservation | null {
  if (!field || !pos) return null;
  const h0 = vnHourIndex(now);
  const rows: { k: number; waveM: number | null; windKmh: number | null }[] = [];
  for (let k = 0; k <= SEA_LOOKAHEAD_H; k++) {
    const smp = sampleField(field, pos.lat, pos.lon, h0 + k);
    if (!smp) continue;
    const hasWave = smp.waveM != null && Number.isFinite(smp.waveM);
    const hasWind = Number.isFinite(smp.windKmh) && smp.windKmh > 0;
    if (!hasWave && !hasWind) continue;
    rows.push({ k, waveM: hasWave ? smp.waveM : null, windKmh: hasWind ? smp.windKmh : null });
  }
  if (rows.length === 0) return null;
  const savedAt = field.source === "grid" ? (field.savedAt ?? null) : null;
  const nowMs = now.getTime();

  const r0 = rows[0];
  const sumParts: string[] = [];
  if (r0.windKmh != null) sumParts.push(`gió cấp ${beaufort(r0.windKmh)}`);
  if (r0.waveM != null) sumParts.push(`sóng chừng ${waveSpeech(r0.waveM)}`);
  const summary = sumParts.join(", ");

  let worst: { level: SeaLevel; row: (typeof rows)[number] } | null = null;
  for (const r of rows) {
    const level = seaLevelOf(r.waveM, r.windKmh, lengthM);
    if (level > 0 && (!worst || level > worst.level)) worst = { level, row: r };
  }
  if (!worst) return { level: 0, summary, warn: null, savedAt };
  const r = worst.row;
  const when = r.k === 0 ? "Bây giờ" : `${r.k} giờ nữa`;
  const what: string[] = [];
  if (r.windKmh != null) what.push(`gió cấp ${beaufort(r.windKmh)}`);
  if (r.waveM != null) what.push(`sóng chừng ${waveSpeech(r.waveM)}`);
  return {
    level: worst.level,
    summary,
    warn: `${when} ${what.join(", ")}. ${savedLine(savedAt, nowMs)}`,
    savedAt,
  };
}

export { savedLine as seaSavedLine };
