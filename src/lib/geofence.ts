// Geofence ranh giới biển — tính khoảng cách từ vị trí tàu tới đường ranh giới
// biển VN và mức cảnh báo. Logic thuần, không phụ thuộc bản đồ (test được).
//
// Mục tiêu: chống lỗi IUU nặng nhất — vượt ranh giới sang vùng biển nước ngoài.
// Ta KHÔNG khẳng định "đã vượt" (cần đa giác kín + bên chính xác); chỉ báo
// KHOẢNG CÁCH tới ranh giới + cảnh báo khi tới gần. Trung thực hơn, an toàn hơn.

import { type LngLat } from "@/data/vn-maritime-border";
import vmsZonesJson from "@/data/vms-zones.json";

/*  BIÊN THẬT = MÉP NGOÀI CỦA VÙNG VMS (chủ dự án chốt 2026-08-25: *"mép ngoài
    của 3 vùng"*).
    ÁN LỆ — vì sao phải đổi: 2026-07-28 đường 75 điểm `VN_MARITIME_BORDER` bị GỠ
    KHỎI BẢN ĐỒ (biên mới = 3 vùng VMS), nhưng `borderProximity` vẫn đo theo nó.
    Chú thích lúc đó ghi "cảnh báo khoảng cách tới ranh giới không bị ảnh hưởng"
    — SAI. Suốt gần một tháng app đo tới một đường KHÔNG CÒN VẼ Ở ĐÂU, nên số
    hải lý không khớp đường bà con nhìn thấy. Bà con bắt được ngay khi đường đo
    được vẽ ra: *"cái tính khoảng cách đang ko gắn vào đường ranh nè"*.
    Bài học: gỡ phần VẼ của một dữ liệu thì phải soi lại MỌI phép tính đang dùng
    dữ liệu đó — không được kết luận "không ảnh hưởng" bằng cảm giác.

    · `VN_OUTER_BORDER`  — cung ngoài khơi (200 điểm) ĐANG ĐƯỢC VẼ đỏ nét đứt
      (`allowedOffshore`, zone `default-allowed-offshore`). Đây là thứ bà con
      NHÌN THẤY, nên là thứ phải đo tới.
    · `VN_ALLOWED_POLYS` — đa giác vùng được phép (`allowed`), dùng để biết điểm
      nằm TRONG hay NGOÀI biên. Có đa giác kín rồi thì mới dám nói "đã ra ngoài";
      trước đây cố ý không nói vì chỉ có một đường hở. */
export const VN_OUTER_BORDER: LngLat[] = (
  vmsZonesJson.allowedOffshore.features[0].geometry.coordinates as number[][]
).map((c) => [c[0], c[1]] as LngLat);

/** Các vòng (ring) của vùng được phép — gộp mọi polygon, kể cả lỗ đảo. */
export const VN_ALLOWED_RINGS: LngLat[][] = (
  vmsZonesJson.allowed.features[0].geometry.coordinates as number[][][][]
).flatMap((poly) => poly.map((ring) => ring.map((c) => [c[0], c[1]] as LngLat)));

const NM_PER_KM = 1 / 1.852;

export type BorderLevel = "ok" | "near" | "very_near";

export interface BorderProximity {
  /** điểm này nằm NGOÀI vùng được phép chưa (true = đã qua biên) */
  outside: boolean;
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

/**
 * MỐC NÓI LẠI khi đang DẪN ĐƯỜNG theo GPS (2026-08-18, audit M3): vào 15 hải
 * lý nói một lần, rồi CHỈ nói lại khi vượt sang mốc gần hơn (10 → 6 → 3), không
 * lặp mỗi giây theo nhịp GPS. Từ 6 hải lý trở vào (VERY_NEAR_NM) dòng cảnh báo
 * không thu được.
 */
export const BORDER_STEPS_NM = [NEAR_NM, 10, VERY_NEAR_NM, 3] as const;

/**
 * Mốc hiện tại theo khoảng cách: mốc NHỎ NHẤT mà distance ≤ mốc; null khi còn
 * xa hơn 15 hải lý. THUẦN, có test.
 */
export function borderStepFor(distanceNm: number): number | null {
  if (!Number.isFinite(distanceNm)) return null;
  let step: number | null = null;
  for (const s of BORDER_STEPS_NM) if (distanceNm <= s) step = s;
  return step;
}

/**
 * Có phải vừa VƯỢT SANG MỐC GẦN HƠN không — chỗ duy nhất quyết "nói lại".
 * `prev` = mốc đã nói lần trước (null = chưa nói / đang ở ngoài 15 hải lý).
 * Trả về mốc mới nếu đáng nói, null nếu im (đứng yên trong mốc, hoặc đang đi
 * ra xa — đi ra xa thì caller cập nhật prev = borderStepFor(d) trong im lặng để
 * lần quay lại gần vẫn được nhắc).
 */
export function borderStepCrossed(
  distanceNm: number,
  prev: number | null,
): number | null {
  const step = borderStepFor(distanceNm);
  if (step == null) return null;
  if (prev == null || step < prev) return step;
  return null;
}

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

/**
 * Điểm có nằm trong một vòng kín không — ray casting chẵn-lẻ trên mặt phẳng
 * lng/lat. Ở quy mô vùng biển VN sai số chiếu không đổi được kết quả trong/ngoài
 * (chỉ mấp mé đúng trên đường biên, mà sát biên thì đằng nào cũng đang cảnh báo).
 */
function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses =
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * TRONG vùng được phép hay chưa. Chẵn-lẻ trên TẤT CẢ các vòng: vòng ngoài đưa
 * vào, lỗ đảo lật ngược ra — đúng quy ước GeoJZON polygon-có-lỗ mà không cần
 * phân biệt vòng nào là lỗ.
 */
export function insideAllowed(
  lat: number,
  lng: number,
  rings: LngLat[][] = VN_ALLOWED_RINGS,
): boolean {
  let inside = false;
  for (const ring of rings) if (pointInRing([lng, lat], ring)) inside = !inside;
  return inside;
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
  border: LngLat[] = VN_OUTER_BORDER,
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
  const outside = !insideAllowed(lat, lng);

  /*  ĐÃ RA NGOÀI thì nói thẳng là RA NGOÀI, đừng nói "cách biên bao xa" (bà con
      qua VSS Quân 2026-08-25: *"trỏ qua biên thì báo vượt biên, chứ sao báo cách
      biên"*). Nói "cách ranh giới 30 hải lý" cho một chỗ NGOÀI vùng được phép là
      câu đúng-số nhưng sai-nghĩa: bà con đọc ra "còn 30 hải lý nữa mới tới biên".
      Nay có đa giác kín (`VN_ALLOWED_RINGS`) nên khẳng định được bên nào.
      Câu chữ nói về CHỖ ĐANG XEM, không phải về tàu — app không kết tội ai. */
  let level: BorderLevel = "ok";
  let label = `Cách ranh giới biển khoảng ${Math.round(distanceNm)} hải lý`;
  if (outside) {
    level = "very_near";
    label = `Chỗ này ĐÃ NGOÀI ranh giới — vào trong ~${
      distanceNm < 10 ? distanceNm.toFixed(1) : Math.round(distanceNm)
    } hải lý`;
  } else if (distanceNm <= VERY_NEAR_NM) {
    level = "very_near";
    label = `Rất gần ranh giới — còn ~${distanceNm.toFixed(1)} hải lý`;
  } else if (distanceNm <= NEAR_NM) {
    level = "near";
    label = `Gần ranh giới — còn ~${Math.round(distanceNm)} hải lý`;
  }

  return { distanceNm, level, label, nearest: bestNearest, outside };
}
