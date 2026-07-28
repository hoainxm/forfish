// Trục 1 — DẪN ĐƯỜNG LIVE: tính tiến trình bám tuyến đã vẽ. THUẦN LOGIC
// (test được, không GPS, không side-effect). Vòng đời watchPosition + wake lock
// ở use-nav-tracking.ts; hiển thị ở components/nav-mode.tsx.
//
// Nguyên tắc: dẫn tới KHÚC RẼ kế tiếp TRÊN TUYẾN (tôn trọng đường vòng né
// sóng/bãi cạn mà route-plan đã tính — KHÔNG chim bay tới đích cắt ngang vùng
// vừa né), đồng thời báo tổng quãng + giờ còn lại tới đích. Trung thực: tàu
// chưa chạy thì KHÔNG bịa giờ tới; chưa có hướng thì KHÔNG vẽ mũi tên giả.

import {
  angleDiffDeg,
  bearingDeg,
  haversineKm,
  KMH_PER_KNOT,
  type LatLon,
} from "@/lib/route-plan";
import { windDirectionVN } from "@/lib/marine-weather";

/** Tới trong bán kính này coi như đã tới nơi (km) */
export const ARRIVE_KM = 0.4;
/** Lệch tuyến quá mức này thì cảnh báo (km) — khoảng vuông góc tới đường vẽ */
export const OFF_ROUTE_WARN_KM = 2;
/** Dưới tốc độ này coi như tàu CHƯA chạy → không tính giờ tới (km/h ≈ 0,5 hải lý) */
export const MIN_MOVING_KMH = 0.9;

/** Góc lệch ≤ ngưỡng này = "đi thẳng"; ≤ ngưỡng sau = "chếch"; hơn = "rẽ" */
const STRAIGHT_DEG = 12;
const SLIGHT_DEG = 45;

export type SteerSide = "straight" | "left" | "right";

export interface SteerCue {
  side: SteerSide;
  /** câu ngắn cho bà con: "Đi thẳng" | "Chếch phải" | "Rẽ trái" */
  label: string;
  /** góc cần bẻ, có dấu: >0 = phải, <0 = trái (để vẽ mũi tên) */
  turnDeg: number;
}

export interface NavProgress {
  /** quãng còn lại BÁM TUYẾN tới đích (km) */
  remainingKm: number;
  /** giờ tới ước tính — null khi tàu chưa chạy / chưa biết tốc độ */
  etaHours: number | null;
  /** waypoint (khúc rẽ) kế tiếp cần lái tới */
  nextWp: LatLon;
  /** hướng LA BÀN cần đi tới nextWp (0–360, 0=Bắc) */
  bearingToNextDeg: number;
  /** tên hướng tiếng Việt của bearingToNext ("Đông Bắc"…) */
  dirVN: string;
  /** gợi ý lái so với hướng ĐANG đi — null khi chưa có hướng tàu */
  steer: SteerCue | null;
  /** lệch tuyến bao xa (km, khoảng vuông góc tới đường vẽ) */
  offRouteKm: number;
  /** đang lệch tuyến quá ngưỡng cảnh báo */
  offRoute: boolean;
  /** đã tới gần đích (≤ ARRIVE_KM) */
  arrived: boolean;
}

// ── hình học phẳng cục bộ (km) ────────────────────────────────────────────
// Chiếu về mặt phẳng equirectangular quanh một điểm mốc: đủ chính xác cho
// vài km (tuyến biển gần), tránh lượng giác cầu trong phép chiếu điểm–đoạn.

type XY = { x: number; y: number };

const KM_PER_LAT = 111.32;
const kmPerLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

function toXY(p: LatLon, ref: LatLon): XY {
  return {
    x: (p.lon - ref.lon) * kmPerLon(ref.lat),
    y: (p.lat - ref.lat) * KM_PER_LAT,
  };
}

function toLatLon(xy: XY, ref: LatLon): LatLon {
  return {
    lat: ref.lat + xy.y / KM_PER_LAT,
    lon: ref.lon + xy.x / kmPerLon(ref.lat),
  };
}

export interface RouteProjection {
  /** chỉ số đoạn (waypoints[segIdx] → waypoints[segIdx+1]) gần nhất */
  segIdx: number;
  /** vị trí trên đoạn, 0..1 */
  tOnSeg: number;
  /** điểm chiếu (điểm gần nhất trên tuyến) */
  snapped: LatLon;
  /** khoảng vuông góc tới tuyến (km) = mức lệch tuyến */
  offRouteKm: number;
  /** quãng từ đầu tuyến tới điểm chiếu (km) */
  alongKm: number;
}

/**
 * Chiếu vị trí lên polyline tuyến — trả đoạn gần nhất, điểm chiếu, mức lệch,
 * và quãng dọc-tuyến tới điểm chiếu. waypoints cần ≥1 điểm; 1 điểm → chính nó.
 */
export function projectOntoRoute(
  pos: LatLon,
  waypoints: LatLon[],
): RouteProjection {
  if (waypoints.length === 0) {
    return { segIdx: 0, tOnSeg: 0, snapped: pos, offRouteKm: 0, alongKm: 0 };
  }
  if (waypoints.length === 1) {
    return {
      segIdx: 0,
      tOnSeg: 0,
      snapped: waypoints[0],
      offRouteKm: haversineKm(pos, waypoints[0]),
      alongKm: 0,
    };
  }
  const P = toXY(pos, pos); // = {0,0}, mốc là chính vị trí tàu
  let best: RouteProjection | null = null;
  let cum = 0; // quãng cộng dồn đầu tuyến → waypoints[i]
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const A = toXY(a, pos);
    const B = toXY(b, pos);
    const segLenKm = haversineKm(a, b);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 1e-12) {
      t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const cx = A.x + t * dx;
    const cy = A.y + t * dy;
    const dist = Math.hypot(P.x - cx, P.y - cy);
    if (!best || dist < best.offRouteKm) {
      best = {
        segIdx: i,
        tOnSeg: t,
        snapped: toLatLon({ x: cx, y: cy }, pos),
        offRouteKm: dist,
        alongKm: cum + t * segLenKm,
      };
    }
    cum += segLenKm;
  }
  return best!;
}

/** Tổng chiều dài tuyến (km) — cộng haversine từng đoạn */
export function routeLengthKm(waypoints: LatLon[]): number {
  let sum = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    sum += haversineKm(waypoints[i], waypoints[i + 1]);
  }
  return sum;
}

/**
 * Gợi ý lái: so hướng CẦN đi (tới nextWp) với hướng ĐANG đi. null khi chưa
 * biết hướng tàu (đứng yên / GPS chưa cho heading) — KHÔNG bịa mũi tên.
 */
export function steerCue(
  headingDeg: number | null,
  bearingToNextDeg: number,
): SteerCue | null {
  if (headingDeg == null) return null;
  const d = angleDiffDeg(bearingToNextDeg, headingDeg); // >0 = phải
  const mag = Math.abs(d);
  if (mag <= STRAIGHT_DEG) return { side: "straight", label: "Đi thẳng", turnDeg: d };
  const side: SteerSide = d > 0 ? "right" : "left";
  const dir = d > 0 ? "phải" : "trái";
  const verb = mag <= SLIGHT_DEG ? "Chếch" : "Rẽ";
  return { side, label: `${verb} ${dir}`, turnDeg: d };
}

/** Giờ tới ước tính — null nếu tàu chưa chạy (tốc độ dưới ngưỡng) */
export function etaHours(
  remainingKm: number,
  speedKmh: number | null,
): number | null {
  if (speedKmh == null || speedKmh < MIN_MOVING_KMH) return null;
  return remainingKm / speedKmh;
}

export interface NavInput {
  pos: LatLon;
  /** hướng tàu ĐANG đi (0–360) — null khi chưa xác định */
  headingDeg: number | null;
  /** tốc độ tàu (km/h) — null khi chưa biết */
  speedKmh: number | null;
  /** tuyến đã vẽ (route.plan.waypoints) — start … dest */
  waypoints: LatLon[];
}

/**
 * Tính tiến trình dẫn đường tại một fix GPS. Bám tuyến: nextWp là waypoint
 * đầu tiên NẰM PHÍA TRƯỚC điểm chiếu; quãng/giờ còn lại đo DỌC TUYẾN.
 */
export function computeNavProgress(input: NavInput): NavProgress {
  const { pos, headingDeg, speedKmh, waypoints } = input;
  // tuyến suy biến (0–1 điểm) → chim bay tới điểm đó
  if (waypoints.length < 2) {
    const dest = waypoints[0] ?? pos;
    const remainingKm = haversineKm(pos, dest);
    const bearingToNextDeg = bearingDeg(pos, dest);
    return {
      remainingKm,
      etaHours: etaHours(remainingKm, speedKmh),
      nextWp: dest,
      bearingToNextDeg,
      dirVN: windDirectionVN(bearingToNextDeg),
      steer: steerCue(headingDeg, bearingToNextDeg),
      offRouteKm: 0,
      offRoute: false,
      arrived: remainingKm <= ARRIVE_KM,
    };
  }

  const proj = projectOntoRoute(pos, waypoints);
  const totalKm = routeLengthKm(waypoints);
  const remainingKm = Math.max(0, totalKm - proj.alongKm);

  // nextWp = waypoint đầu tiên có quãng-dọc-tuyến VƯỢT điểm chiếu (bỏ qua khúc
  // đã đi và khúc đang đứng ngay trên). Không tìm được → đích cuối.
  const EPS_KM = 0.02;
  let cum = 0;
  let nextIdx = waypoints.length - 1;
  for (let i = 0; i < waypoints.length - 1; i++) {
    cum += haversineKm(waypoints[i], waypoints[i + 1]);
    if (cum > proj.alongKm + EPS_KM) {
      nextIdx = i + 1;
      break;
    }
  }
  const nextWp = waypoints[nextIdx];

  const bearingToNextDeg = bearingDeg(pos, nextWp);
  return {
    remainingKm,
    etaHours: etaHours(remainingKm, speedKmh),
    nextWp,
    bearingToNextDeg,
    dirVN: windDirectionVN(bearingToNextDeg),
    steer: steerCue(headingDeg, bearingToNextDeg),
    offRouteKm: proj.offRouteKm,
    offRoute: proj.offRouteKm > OFF_ROUTE_WARN_KM,
    arrived: remainingKm <= ARRIVE_KM,
  };
}

/** m/s (GPS coords.speed) → km/h; null/NaN/âm → null */
export function mpsToKmh(mps: number | null | undefined): number | null {
  if (mps == null || !Number.isFinite(mps) || mps < 0) return null;
  return mps * 3.6;
}

/** hải lý/giờ (hồ sơ tàu) → km/h */
export function knotToKmh(kn: number): number {
  return kn * KMH_PER_KNOT;
}
