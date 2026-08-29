// Trục 1 — CHIA TUYẾN THEO CHẶNG: mỗi chặng (chỗ ghé N → chỗ ghé N+1) được
// chấm một mức lưu ý riêng, và khi đang chạy thì chặng đã đi qua chuyển xám.
// THUẦN LOGIC (test được, không mạng, không React, không MapLibre).
//
// Vì sao cần: `mergeLegPlans` gộp cờ nguy hiểm bằng OR để CẢ TUYẾN phải nói
// khi MỘT chặng có vấn đề — đúng cho câu cảnh báo, nhưng gộp xong thì mất chỗ:
// tuyến 4 chặng chỉ chặng 3 đè bãi cạn vẫn hiện một dải đỏ suốt từ bến. Bà con
// đọc thành "cả đường này dữ" rồi bỏ luôn tuyến, hoặc tệ hơn là quen mắt với
// đỏ rồi thôi không nhìn nữa. Chấm theo CHẶNG để cảnh báo trỏ đúng khúc.

import type { LatLon, RoutePlan } from "@/lib/route-plan";
import {
  CAUTION_WAVE_M,
  CAUTION_WIND_KMH,
  DANGER_WAVE_M,
  DANGER_WIND_KMH,
  haversineKm,
} from "@/lib/route-plan";

/** đỏ = phải lưu ý · cam = chú ý vừa · xanh = không có gì · xám = đã đi qua */
export type LegRisk = "red" | "amber" | "blue";

export interface LegSummary {
  distKm: number;
  hours: number;
  risk: LegRisk;
  /** câu NGẮN nói vì sao đỏ/cam — null khi xanh. Không bịa khi không có cớ. */
  reason: string | null;
}

/*  NGƯỠNG DÙNG LẠI HẰNG CỦA `route-plan`, KHÔNG ĐẶT SỐ MỚI (nguyên tắc 3).
    Thuật toán tìm đường đã phạt theo đúng hai mốc này; màu mà lệch mốc thì
    tuyến "máy né rồi" lại hiện đỏ, hoặc ngược lại. Một nghĩa, một con số. */

/**
 * Chấm mức lưu ý cho MỘT chặng. Đỏ nặng hơn cam; cớ nào nặng nhất thì nói cớ
 * đó (một câu, không liệt kê hết — thẻ không có chỗ và bà con không đọc hết).
 */
export function legRisk(p: RoutePlan): { risk: LegRisk; reason: string | null } {
  // ĐỎ — thứ có thể làm hỏng chuyến hoặc hỏng tàu
  if (p.hasVeryShallowLeg)
    return { risk: "red", reason: "đè bãi rất cạn (dưới 4 m)" };
  if (p.hasNearLandLeg)
    return { risk: "red", reason: "sát đất liền, máy chưa bảo đảm được" };
  if (p.maxWaveM >= DANGER_WAVE_M)
    return { risk: "red", reason: `sóng tới ${p.maxWaveM.toFixed(1)} m` };
  if (p.maxWindKmh >= DANGER_WIND_KMH)
    return { risk: "red", reason: `gió tới ${Math.round(p.maxWindKmh)} km/giờ` };
  if (p.hasRoughLeg) return { risk: "red", reason: "có khúc sóng gió dữ" };

  // CAM — đi được, nhưng phải để mắt
  if (!p.depthChecked)
    return { risk: "amber", reason: "chưa kiểm được độ sâu" };
  if (p.hasShallowLeg) return { risk: "amber", reason: "qua vùng nước nông" };
  if (p.hasFollowingSeaRisk)
    return { risk: "amber", reason: "sóng đuôi — dễ trượt sóng" };
  if (p.maxWaveM >= CAUTION_WAVE_M)
    return { risk: "amber", reason: `sóng ${p.maxWaveM.toFixed(1)} m` };
  if (p.maxWindKmh >= CAUTION_WIND_KMH)
    return { risk: "amber", reason: `gió ${Math.round(p.maxWindKmh)} km/giờ` };

  return { risk: "blue", reason: null };
}

/** Chấm cả dãy chặng theo đúng thứ tự đã tính. */
export function summarizeLegs(plans: RoutePlan[]): LegSummary[] {
  return plans.map((p) => {
    const { risk, reason } = legRisk(p);
    return { distKm: p.distKm, hours: p.hours, risk, reason };
  });
}

/**
 * Quãng dọc-tuyến (km) tại từng waypoint mốc. Đo TRÊN CHÍNH `waypoints` chứ
 * không cộng `distKm` của các chặng: `alongKm` mà `projectOntoRoute` trả về
 * cũng đo trên waypoints, hai bên phải cùng một thước thì so mới đúng.
 */
export function cumulativeKmAt(waypoints: LatLon[], idxs: number[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < waypoints.length; i++) {
    cum.push(cum[i - 1] + haversineKm(waypoints[i - 1], waypoints[i]));
  }
  return idxs.map((i) => cum[Math.min(Math.max(i, 0), cum.length - 1)]);
}

export interface LegProgress {
  /** chặng đang chạy (0-based); = số chặng khi đã qua hết */
  currentLeg: number;
  /** chặng nào đã đi qua HẲN (mốc cuối chặng đã ở sau lưng) */
  passed: boolean[];
  /** còn bao xa tới chỗ ghé kế tiếp (km) — null khi đã qua hết */
  toNextKm: number | null;
  /** còn mấy giờ tới chỗ ghé kế — null khi chưa biết tốc độ hoặc đã qua hết */
  toNextH: number | null;
}

/**
 * Tàu đang ở đâu trên chuỗi chặng.
 *
 * `boundsKm[i]` = quãng dọc-tuyến tại mốc CUỐI của chặng i (tức chỗ ghé i+1).
 * `speedKmh` null ⇒ không đoán giờ (thà không nói còn hơn nói sai giờ về bến).
 */
export function legProgressAt(
  boundsKm: number[],
  alongKm: number,
  speedKmh: number | null,
): LegProgress {
  const passed = boundsKm.map((b) => alongKm >= b);
  let currentLeg = passed.findIndex((p) => !p);
  if (currentLeg < 0) currentLeg = boundsKm.length;
  const toNextKm =
    currentLeg < boundsKm.length
      ? Math.max(0, boundsKm[currentLeg] - alongKm)
      : null;
  return {
    currentLeg,
    passed,
    toNextKm,
    toNextH:
      toNextKm != null && speedKmh != null && speedKmh > 0
        ? toNextKm / speedKmh
        : null,
  };
}
