// CHẾ ĐỘ ĐANG CHẠY — BÃO THEO GPS (thuần).
//
// Màn bản đồ đã biết "có bão" (`stormStatus`), nhưng lúc đang chạy bà con cần
// câu khác: con bão đó CÁCH TÀU bao xa, đang đi hướng nào, tin cũ mấy giờ.
// Chỉ ĐỌC bản tin đã có trong máy — không gọi mạng (làm mới do use-storm-check).
//
// Luật (doc 15 §5A/B + Assumptions 5, chủ dự án chốt ngưỡng 2026-10-13):
//  · Đường bão (tâm + đường dự báo + vùng ảnh hưởng) cách tàu ≤ 200 km ⇒ ĐỎ,
//    còn hiệu lực (nhắc lại khi chưa "Đã nghe"); gần thêm mỗi 50 km nói lại.
//  · Xa hơn 200 km ⇒ VÀNG, nói một lần cho mỗi cơn.
//  · Câu LUÔN có tuổi tin + "Nghe đài duyên hải". KHÔNG BAO GIỜ "an toàn".

import type { StormAlert, StormStatus } from "@/lib/storms";
import { forecastTrack, routeStormConflict } from "@/lib/route-storm";
import { bearingDeg, haversineKm, type LatLon } from "@/lib/route-plan";
import { ageSpeech, dirSpeech, distSpeech, type SpeechUnit } from "@/lib/nav-voice/phrases";

export const STORM_NEAR_KM = 200;
export const STORM_STEP_KM = 50;
/** băng "xa" — mọi khoảng cách > 200 km */
export const STORM_FAR_BAND = 99;

export type StormObservation = {
  id: string;
  /** băng khoảng cách hiện tại: 0..3 (≤200 km, mỗi 50 km) hoặc STORM_FAR_BAND */
  band: number;
  near: boolean;
  distCenterKm: number;
  distPathKm: number;
  text: string;
};

/** Hướng bão đang đi: từ tâm tới điểm dự báo kế tiếp cách ≥ 20 km. null = nguồn không có. */
export function stormHeadingDeg(s: StormAlert): number | null {
  const fc = forecastTrack(s);
  const c = { lat: s.lat, lon: s.lon };
  for (const p of fc) {
    if (haversineKm(c, p) >= 20) return bearingDeg(c, p);
  }
  return null;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function stormName(s: StormAlert): string {
  return [s.kindLabel || "Bão", s.name].filter(Boolean).join(" ");
}

/** Cơn bão GẦN TÀU NHẤT (theo đường đi) + câu đọc. null khi không có bão hoặc chưa có vị trí. */
export function stormObservation(
  status: StormStatus,
  pos: LatLon | null,
  nowMs: number,
  unit: SpeechUnit,
): StormObservation | null {
  if (status.kind !== "co-bao" || !pos || status.storms.length === 0) return null;
  let best: { s: StormAlert; path: number; center: number } | null = null;
  for (const s of status.storms) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
    const center = haversineKm(pos, { lat: s.lat, lon: s.lon });
    const hit = routeStormConflict([pos], [s], Number.POSITIVE_INFINITY);
    const path = Math.min(center, hit?.distKm ?? center);
    if (!best || path < best.path) best = { s, path, center };
  }
  if (!best) return null;
  const near = best.path <= STORM_NEAR_KM;
  const band = near ? Math.min(3, Math.floor(best.path / STORM_STEP_KM)) : STORM_FAR_BAND;
  const hdg = stormHeadingDeg(best.s);
  const parts = [
    `${stormName(best.s)} cách tàu chừng ${distSpeech(best.center, unit)}${
      hdg != null ? `, đang đi hướng ${dirSpeech(hdg)}` : ""
    }.`,
  ];
  if (near && best.center - best.path > 30) parts.push("Đường đi dự báo qua gần tàu.");
  parts.push(`${cap(ageSpeech(status.checkedAt, nowMs))}.`);
  parts.push("Nghe đài duyên hải.");
  return {
    id: best.s.id,
    band,
    near,
    distCenterKm: best.center,
    distPathKm: best.path,
    text: parts.join(" "),
  };
}

/**
 * Câu bão cho BẢN TIN MỞ ĐẦU — nói đúng một trong bốn trạng thái, không bao
 * giờ đội "chưa hỏi được" thành "không có bão". "" = chưa có trả lời (đang hỏi).
 */
export function stormBulletin(
  status: StormStatus,
  obs: StormObservation | null,
  nowMs: number,
): string {
  switch (status.kind) {
    case "dang-hoi":
      return "";
    case "co-bao": {
      if (obs) return obs.text;
      const s = status.storms[0];
      return `Có ${stormName(s)} trên Biển Đông. ${cap(ageSpeech(status.checkedAt, nowMs))}. Nghe đài duyên hải.`;
    }
    case "khong-co":
      return `Bản ${ageSpeech(status.checkedAt, nowMs)} chưa thấy bão trên Biển Đông.`;
    case "khong-hoi-duoc":
      return status.checkedAt != null
        ? `Chưa hỏi được tin bão mới, ${ageSpeech(status.checkedAt, nowMs)}. Nghe đài duyên hải.`
        : "Máy chưa có tin bão. Nghe đài duyên hải.";
  }
}
