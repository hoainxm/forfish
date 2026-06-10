// Geofence ranh giới biển — tính khoảng cách từ vị trí tàu tới đường ranh giới
// biển VN và mức cảnh báo. Logic thuần, không phụ thuộc bản đồ (test được).
//
// Mục tiêu: chống lỗi IUU nặng nhất — vượt ranh giới sang vùng biển nước ngoài.
// Ta KHÔNG khẳng định "đã vượt" (cần đa giác kín + bên chính xác); chỉ báo
// KHOẢNG CÁCH tới ranh giới + cảnh báo khi tới gần. Trung thực hơn, an toàn hơn.

import { VN_MARITIME_BORDER, type LngLat } from "@/data/vn-maritime-border";

const NM_PER_KM = 1 / 1.852;

export type BorderLevel = "ok" | "near" | "very_near";

export interface BorderProximity {
  /** khoảng cách ngắn nhất tới ranh giới, hải lý */
  distanceNm: number;
  level: BorderLevel;
  label: string;
  /** điểm gần nhất trên ranh giới [lng, lat] — để vẽ/định hướng */
  nearest: LngLat;
}

// Ngưỡng cảnh báo (hải lý). Tàu cá chạy ~7–10 hải lý/giờ → 6 hải lý ~ 40 phút.
const VERY_NEAR_NM = 6;
const NEAR_NM = 15;

/** Haversine — km giữa hai điểm (lat,lng độ). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Khoảng cách ngắn nhất (km) từ điểm tới đoạn thẳng [a,b], xấp xỉ mặt phẳng
 * tiếp tuyến quanh điểm (đủ chính xác ở quy mô vài chục hải lý).
 * a,b,p là [lng, lat].
 */
function pointToSegmentKm(p: LngLat, a: LngLat, b: LngLat): number {
  const lat0 = (p[1] + a[1] + b[1]) / 3;
  const kx = (Math.cos((lat0 * Math.PI) / 180) * 111.32); // km / độ lng
  const ky = 110.574; // km / độ lat
  const px = p[0] * kx,
    py = p[1] * ky;
  const ax = a[0] * kx,
    ay = a[1] * ky;
  const bx = b[0] * kx,
    by = b[1] * ky;
  const dx = bx - ax,
    dy = by - ay;
  const segLen2 = dx * dx + dy * dy;
  let t = segLen2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / segLen2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx,
    cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Nội suy điểm trên đoạn [a,b] theo tham số t∈[0,1]. */
function lerp(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Tính khoảng cách từ vị trí (lat,lng) tới đường ranh giới biển VN.
 * Trả về khoảng cách hải lý, mức cảnh báo, và điểm gần nhất trên ranh giới.
 */
export function borderProximity(
  lat: number,
  lng: number,
  border: LngLat[] = VN_MARITIME_BORDER,
): BorderProximity {
  const p: LngLat = [lng, lat];
  let bestKm = Infinity;
  let bestNearest: LngLat = border[0];

  for (let i = 0; i < border.length - 1; i++) {
    const a = border[i];
    const b = border[i + 1];
    const d = pointToSegmentKm(p, a, b);
    if (d < bestKm) {
      bestKm = d;
      // tìm lại điểm chiếu để hiển thị (xấp xỉ bằng t trên mặt phẳng)
      const lat0 = (p[1] + a[1] + b[1]) / 3;
      const kx = Math.cos((lat0 * Math.PI) / 180) * 111.32;
      const ky = 110.574;
      const ax = a[0] * kx,
        ay = a[1] * ky;
      const bx = b[0] * kx,
        by = b[1] * ky;
      const dx = bx - ax,
        dy = by - ay;
      const segLen2 = dx * dx + dy * dy;
      let t =
        segLen2 === 0
          ? 0
          : ((p[0] * kx - ax) * dx + (p[1] * ky - ay) * dy) / segLen2;
      t = Math.max(0, Math.min(1, t));
      bestNearest = lerp(a, b, t);
    }
  }

  const distanceNm = bestKm * NM_PER_KM;
  let level: BorderLevel = "ok";
  let label = `Cách ranh giới biển khoảng ${Math.round(distanceNm)} hải lý`;
  if (distanceNm <= VERY_NEAR_NM) {
    level = "very_near";
    label = `Rất gần ranh giới — còn ~${distanceNm.toFixed(1)} hải lý`;
  } else if (distanceNm <= NEAR_NM) {
    level = "near";
    label = `Gần ranh giới — còn ~${Math.round(distanceNm)} hải lý`;
  }

  return { distanceNm, level, label, nearest: bestNearest };
}
