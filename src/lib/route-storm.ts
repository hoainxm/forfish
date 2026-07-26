// Trục 1 — dẫn đường × tin bão. THUẦN LOGIC (test được, không fetch).
//
// Lỗ hổng team review 2026-07-26: compute() dẫn đường chỉ nhìn Open-Meteo GFS
// lưới thô — bão dự báo 24–72h có thể lọt dưới ngưỡng chặn số (sóng <4 m,
// gió <62 km/h sau nội suy song tuyến; GFS ước non cường độ bão) → tuyến vẽ
// bình thường, không một chữ "bão"; storm-banner lại tự ẩn đúng lúc sheet
// dẫn đường mở. Nay đối chiếu tuyến với tin bão GDACS: tuyến đi vào vùng bão
// → CHẶN HẲN, không vẽ (chốt với chủ dự án 2026-07-26: chặn MỌI trường hợp,
// kể cả áp thấp mức watch; bán kính an toàn 200 km).
//
// GDACS không cho mốc GIỜ từng điểm track → không so được ETA từng chặng với
// vị trí bão theo thời gian. Dùng phép kiểm KHÔNG-thời-gian bảo thủ (thà báo
// thừa — an toàn tính mạng): tuyến PHẠM khi có điểm nào trên tuyến
//   · cách TÂM bão hiện tại dưới bán kính an toàn, hoặc
//   · cách HÀNH LANG TRACK DỰ BÁO (đoạn track từ tâm hiện tại về sau) dưới
//     bán kính an toàn — track QUÁ KHỨ không chặn, bão đã đi qua rồi, hoặc
//   · nằm TRONG polygon vùng ảnh hưởng (bán kính gió) nguồn vẽ.

import { haversineKm, type LatLon } from "@/lib/route-plan";
import type { StormAlert } from "@/lib/storms";

/** Đệm quanh tâm bão + hành lang track dự báo (chốt chủ dự án 2026-07-26) */
export const STORM_SAFE_RADIUS_KM = 200;

/** Waypoints sau smoothing có thể cách nhau xa — chêm điểm để không lọt khe */
const SAMPLE_STEP_KM = 25;

export type RouteStormConflict = {
  storm: StormAlert;
  /** khoảng cách gần nhất tuyến↔bão; 0 = có điểm nằm trong vùng ảnh hưởng */
  distKm: number;
};

/**
 * Khoảng cách điểm→đoạn thẳng, km — chiếu phẳng equirectangular quanh vĩ độ
 * giữa đoạn. Vùng quan tâm 3–27°N / 99–132°E nên sai số chiếu không đáng kể
 * so với đệm 200 km, và không có chuyện vòng qua kinh tuyến 180°.
 */
export function distToSegmentKm(p: LatLon, a: LatLon, b: LatLon): number {
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const kx = 111.32 * Math.cos(midLat);
  const ky = 111.32;
  const ax = a.lon * kx, ay = a.lat * ky;
  const bx = b.lon * kx, by = b.lat * ky;
  const px = p.lon * kx, py = p.lat * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ray-casting điểm-trong-ring; ring theo GeoJSON [lon,lat][] */
export function pointInRing(p: LatLon, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > p.lat !== yj > p.lat &&
      p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Phần DỰ BÁO của track: từ điểm track gần tâm bão hiện tại nhất trở về sau.
 * GDACS trả track quá khứ→dự báo liền một mảng không mốc giờ — cắt tại tâm
 * hiện tại là cách duy nhất tách "bão sắp tới đâu" khỏi "bão đã qua đâu".
 */
export function forecastTrack(storm: StormAlert): LatLon[] {
  const pts: LatLon[] = [];
  for (const c of storm.track) {
    if (
      Array.isArray(c) &&
      typeof c[0] === "number" &&
      typeof c[1] === "number"
    ) {
      pts.push({ lat: c[1], lon: c[0] });
    }
  }
  if (pts.length === 0) return [];
  const center = { lat: storm.lat, lon: storm.lon };
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = haversineKm(pts[i], center);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return pts.slice(best);
}

/** Chêm điểm dọc tuyến mỗi ~stepKm để chặng dài không lọt khe kiểm tra */
export function sampleRoute(
  waypoints: LatLon[],
  stepKm: number = SAMPLE_STEP_KM,
): LatLon[] {
  const out: LatLon[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    if (i > 0) {
      const a = waypoints[i - 1];
      const b = waypoints[i];
      const n = Math.floor(haversineKm(a, b) / stepKm);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1);
        out.push({
          lat: a.lat + (b.lat - a.lat) * t,
          lon: a.lon + (b.lon - a.lon) * t,
        });
      }
    }
    out.push(waypoints[i]);
  }
  return out;
}

/**
 * Tuyến có đi vào vùng bão không? Trả bão VI PHẠM GẦN NHẤT (nhiều bão cùng
 * lúc thì báo con sát tuyến nhất) hoặc null khi tuyến sạch / không có bão.
 * Không có tin bão (mất sóng) → caller truyền mảng rỗng → KHÔNG chặn; các
 * lời dặn nghe đài sẵn có của UI làm việc của nó.
 */
export function routeStormConflict(
  waypoints: LatLon[],
  storms: StormAlert[],
  safeKm: number = STORM_SAFE_RADIUS_KM,
): RouteStormConflict | null {
  if (waypoints.length === 0 || storms.length === 0) return null;
  const pts = sampleRoute(waypoints);
  let best: RouteStormConflict | null = null;
  for (const storm of storms) {
    const center = { lat: storm.lat, lon: storm.lon };
    const fc = forecastTrack(storm);
    let minD = Infinity;
    for (const p of pts) {
      let d = haversineKm(p, center);
      if (fc.length === 1) d = Math.min(d, haversineKm(p, fc[0]));
      for (let i = 0; i + 1 < fc.length; i++) {
        d = Math.min(d, distToSegmentKm(p, fc[i], fc[i + 1]));
      }
      if (
        d > 0 &&
        storm.areas.some((poly) => poly.length > 0 && pointInRing(p, poly[0]))
      ) {
        d = 0;
      }
      if (d < minD) minD = d;
      if (minD === 0) break;
    }
    if (minD <= safeKm && (best === null || minD < best.distKm)) {
      best = { storm, distKm: minD };
    }
  }
  return best;
}
