// Trục 1 — dẫn đường tiết kiệm dầu. THUẦN LOGIC (test được, không fetch).
//
// Thuật toán theo các nghiên cứu đã công bố (chi tiết + nguồn:
// docs/research/06-weather-routing.md):
//   · VISIR-1/2 (Mannarini et al., Geosci. Model Dev. 2016, 2024 — mô hình
//     mã nguồn mở cho TÀU NHỎ kể cả tàu cá): đồ thị lưới phủ cả vùng biển,
//     tìm đường time-dependent, ràng buộc TĨNH (độ sâu, bờ) + ĐỘNG (an toàn
//     theo sóng). QUAN TRỌNG (audit 2026-06-10): VISIR coi an toàn là RÀNG
//     BUỘC CỨNG và tối ưu nhiên liệu THUẦN trong tập tuyến khả thi — tuyến
//     tối ưu của họ chỉ dài hơn chim bay ~3%, hiếm khi quá 10%. KHÔNG trộn
//     "độ sợ" vào chi phí bằng nhân tử lớn (bản cũ ×3 cho phép vòng tới
//     ~6,8× quãng đường để né sóng 2,5 m → ra tuyến 400 km cho chuyến
//     100 km — vô nghĩa với ngư dân).
//   · Giảm tốc trong sóng CÓ HƯỚNG theo hệ số Kwon/Townsin–Kwon 4 bậc góc
//     (mũi 1,0 / chếch mũi 0,8 / ngang 0,45 / đuôi 0,15 — sóng đuôi đẩy
//     tàu đi, ít cản).
//   · Ngưỡng an toàn đối chiếu thang gió–sóng KTTV VN (QĐ 18/2021):
//     cấp 6 / sóng 2–3 m = "cẩn thận" (phạt nhẹ 1,15) · cấp 7 / 3–4 m =
//     "không nên đi" (phạt 1,5 + cảnh báo đỏ) · cấp 8 / ≥4 m = chặn cứng.
//   · Sóng đuôi ≥2 m chu kỳ ngắn (<6 s): nguy cơ trượt sóng/broaching
//     (IMO MSC.1/Circ.1228) — phạt nhẹ + CẢNH BÁO; cách xử lý đúng là giảm
//     ga/đổi hướng tại chỗ, không phải vòng tuyến cả trăm km.
//   · TRẦN ĐƯỜNG VÒNG (bounded detour): tuyến dài hơn chim bay quá 30%
//     trong khi đường thẳng vẫn đi được vật lý → trả ĐƯỜNG THẲNG + cảnh báo
//     thật, để thuyền trưởng tự quyết — không bán đường vòng vô lý.
//
// Tìm đường: Dijkstra trên lưới ≤ ~7500 nút, trọng số đổi theo giờ dự báo
// (xấp xỉ time-dependent — nhãn là chi phí, giờ đi ké nhãn rẻ nhất; đủ tốt
// cho dự báo nội suy giờ, không tuyên bố "đúng nghiệm" tuyệt đối).
// Chi phí cạnh = lít dầu ước tính: máy ga cố định → dầu/giờ ≈ hằng số,
// sóng làm tàu CHẬM nên cùng quãng đường tốn nhiều giờ máy hơn; ngược gió
// thêm sức cản; dòng chảy cộng vector vào tốc độ (VISIR-2).
// Mô hình là ƯỚC LƯỢNG THAM KHẢO — UI luôn dặn dò hải đồ + nghe đài.

import { depthClassAt, type DepthGrid } from "@/lib/depth-grid";

export type LatLon = { lat: number; lon: number };

export type BoatProfile = {
  /** tốc độ lúc trời êm, hải lý/giờ */
  speedKn: number;
  /** máy ăn dầu, lít/giờ */
  litersPerHour: number;
};

export const DEFAULT_BOAT: BoatProfile = { speedKn: 7, litersPerHour: 20 };
export const KMH_PER_KNOT = 1.852;

// ── hình học ─────────────────────────────────────────────────────────────

const EARTH_R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(s));
}

/** Hướng chạy từ a tới b, 0–360° (0 = Bắc, 90 = Đông) */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function kmToNm(km: number): number {
  return km / KMH_PER_KNOT;
}

/** Góc lệch a−b chuẩn hoá về [−180, 180] */
export function angleDiffDeg(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

const lerp = (a: LatLon, b: LatLon, t: number): LatLon => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lon: a.lon + (b.lon - a.lon) * t,
});

// ── vùng tính toán ───────────────────────────────────────────────────────

export type BBox = {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
};

/** Khung chữ nhật quanh start–dest nở thêm marginKm mỗi phía */
export function bboxFor(start: LatLon, dest: LatLon, marginKm: number): BBox {
  const dLat = marginKm / 111.32;
  const midLat = (start.lat + dest.lat) / 2;
  const dLon = marginKm / (111.32 * Math.cos(rad(midLat)));
  return {
    latMin: Math.min(start.lat, dest.lat) - dLat,
    latMax: Math.max(start.lat, dest.lat) + dLat,
    lonMin: Math.min(start.lon, dest.lon) - dLon,
    lonMax: Math.max(start.lon, dest.lon) + dLon,
  };
}

// ── trường thời tiết: lưới thô + nội suy song tuyến ─────────────────────

/** Dự báo một giờ tại một ô thời tiết */
export type HourSample = {
  waveM: number | null;
  /** hướng sóng TỚI TỪ, độ — null khi nguồn không có */
  waveFromDeg: number | null;
  /** chu kỳ sóng, giây — phân biệt sóng gió ngắn với swell dài */
  wavePeriodS: number | null;
  windKmh: number;
  /** hướng gió THỔI TỪ, độ */
  windFromDeg: number;
  /** dòng chảy mặt biển, km/h (0 khi nguồn không có) */
  currentKmh: number;
  /** hướng dòng CHẢY TỚI, độ — QUY ƯỚC NGƯỢC với gió/sóng (chuẩn hải dương) */
  currentToDeg: number | null;
};

export type WeatherCellSeries = {
  /** false = nguồn sóng không có số nào → ô trên đất liền */
  onSea: boolean;
  hours: HourSample[];
};

/** Lưới thời tiết thô phủ bbox — nội suy xuống lưới tìm đường mịn hơn */
export type WeatherField = {
  lat0: number;
  lon0: number;
  dLat: number;
  dLon: number;
  nLat: number;
  nLon: number;
  /** row-major i*nLon+j, i theo vĩ độ tăng dần */
  cells: WeatherCellSeries[];
};

const EMPTY_HOUR: HourSample = {
  waveM: null,
  waveFromDeg: null,
  wavePeriodS: null,
  windKmh: 0,
  windFromDeg: 0,
  currentKmh: 0,
  currentToDeg: null,
};

function hourAt(c: WeatherCellSeries, hourIdx: number): HourSample {
  const idx = Math.max(0, Math.min(Math.round(hourIdx), c.hours.length - 1));
  return c.hours[idx] ?? EMPTY_HOUR;
}

/**
 * Nội suy song tuyến giữa 4 ô góc, bỏ ô đất liền khỏi phép nội suy (trọng số
 * chuẩn hoá lại theo ô biển). Hướng gió/sóng nội suy theo vector đơn vị;
 * DÒNG CHẢY nội suy theo vector u/v đầy đủ (hai ô chảy ngược nhau → giữa
 * gần đứng nước). Trả null khi cả 4 góc là đất/ngoài lưới.
 */
export function sampleField(
  f: WeatherField,
  lat: number,
  lon: number,
  hourIdx: number,
): HourSample | null {
  const x = (lon - f.lon0) / f.dLon;
  const y = (lat - f.lat0) / f.dLat;
  const j0 = Math.floor(x);
  const i0 = Math.floor(y);
  let wSum = 0;
  let wave = 0;
  let waveW = 0; // sóng có thể null riêng từng ô
  let period = 0;
  let periodW = 0;
  let wind = 0;
  let wvSin = 0,
    wvCos = 0,
    wdSin = 0,
    wdCos = 0;
  let curU = 0,
    curV = 0;
  for (const [di, dj] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]) {
    const i = i0 + di;
    const j = j0 + dj;
    if (i < 0 || i >= f.nLat || j < 0 || j >= f.nLon) continue;
    const cell = f.cells[i * f.nLon + j];
    if (!cell?.onSea) continue;
    const w =
      (di === 0 ? 1 - (y - i0) : y - i0) * (dj === 0 ? 1 - (x - j0) : x - j0);
    if (w <= 0) continue;
    const h = hourAt(cell, hourIdx);
    wSum += w;
    wind += w * h.windKmh;
    wdSin += w * Math.sin(rad(h.windFromDeg));
    wdCos += w * Math.cos(rad(h.windFromDeg));
    if (h.currentToDeg != null) {
      curU += w * h.currentKmh * Math.sin(rad(h.currentToDeg));
      curV += w * h.currentKmh * Math.cos(rad(h.currentToDeg));
    }
    if (h.waveM != null) {
      wave += w * h.waveM;
      waveW += w;
      if (h.waveFromDeg != null) {
        wvSin += w * Math.sin(rad(h.waveFromDeg));
        wvCos += w * Math.cos(rad(h.waveFromDeg));
      }
      if (h.wavePeriodS != null) {
        period += w * h.wavePeriodS;
        periodW += w;
      }
    }
  }
  if (wSum <= 0) return null;
  const curKmh = Math.hypot(curU, curV) / wSum;
  return {
    waveM: waveW > 0 ? wave / waveW : null,
    waveFromDeg:
      waveW > 0 && (wvSin !== 0 || wvCos !== 0)
        ? (deg(Math.atan2(wvSin, wvCos)) + 360) % 360
        : null,
    wavePeriodS: periodW > 0 ? period / periodW : null,
    windKmh: wind / wSum,
    windFromDeg: (deg(Math.atan2(wdSin, wdCos)) + 360) % 360,
    currentKmh: curKmh,
    currentToDeg:
      curKmh > 0.01 ? (deg(Math.atan2(curU, curV)) + 360) % 360 : null,
  };
}

// ── mô hình tàu trong sóng gió (Kwon) ────────────────────────────────────

/**
 * Hệ số hướng sóng so với hướng chạy — 4 bậc góc theo Kwon/Townsin–Kwon:
 * sóng mũi cản nặng nhất, sóng đuôi gần như đẩy tàu đi (audit 2026-06-10:
 * bản cũ cho sóng đuôi 0,4 là cao gấp ~2,5 lần văn liệu → phạt oan tuyến
 * xuôi sóng). Không có hướng sóng → coi như sóng mũi (ước tính tốn hơn).
 */
export function waveDirFactor(
  waveFromDeg: number | null,
  headingDeg: number,
): number {
  if (waveFromDeg == null) return 1;
  const d = Math.abs(angleDiffDeg(waveFromDeg, headingDeg));
  if (d <= 30) return 1; // sóng mũi
  if (d <= 60) return 0.8; // chếch mũi
  if (d <= 150) return 0.45; // sóng ngang
  return 0.15; // sóng đuôi
}

/** Tàu chậm đi bao nhiêu trong sóng: ~10%/m trên 0,5 m × hệ số hướng, sàn 55% */
export function speedFactor(waveM: number, dirFactor: number): number {
  return Math.max(0.55, 1 - 0.1 * dirFactor * Math.max(0, waveM - 0.5));
}

/** Sức cản gió theo hướng chạy: ngược gió tốn thêm tới 25%, xuôi gió đỡ tới 8% */
export function windDragFactor(
  windKmh: number,
  windFromDeg: number,
  headingDeg: number,
): number {
  const headwindKmh = windKmh * Math.cos(rad(windFromDeg - headingDeg));
  return Math.min(0.25, Math.max(-0.08, headwindKmh * 0.004));
}

/** Thành phần dòng chảy DỌC hướng chạy (>0 = nước đẩy đi) */
export function currentAlongKmh(
  h: Pick<HourSample, "currentKmh" | "currentToDeg">,
  headingDeg: number,
): number {
  if (h.currentToDeg == null) return 0;
  return h.currentKmh * Math.cos(rad(h.currentToDeg - headingDeg));
}

/** Thành phần dòng chảy NGANG hướng chạy (phải vát mũi bù) */
export function currentCrossKmh(
  h: Pick<HourSample, "currentKmh" | "currentToDeg">,
  headingDeg: number,
): number {
  if (h.currentToDeg == null) return 0;
  return h.currentKmh * Math.sin(rad(h.currentToDeg - headingDeg));
}

/**
 * Sóng đuôi ±45°, cao ≥2 m, CHU KỲ NGẮN (<6 s — sóng gió; swell dài tàu
 * cưỡi êm) — nguy cơ trượt sóng/broaching theo IMO MSC.1/Circ.1228 với tàu
 * chạy ~7 hải lý (đúng dải tốc độ tới hạn 1,8√L của tàu 15 m). Xử lý đúng
 * là GIẢM GA/đổi hướng tại chỗ → chỉ phạt nhẹ + cảnh báo, không vòng tuyến.
 */
export function followingSeaRisk(
  waveM: number,
  waveFromDeg: number | null,
  headingDeg: number,
  wavePeriodS: number | null,
): boolean {
  if (waveFromDeg == null || waveM < 2) return false;
  if (wavePeriodS != null && wavePeriodS >= 6) return false;
  return Math.abs(angleDiffDeg(waveFromDeg, headingDeg)) > 135;
}

// ── ngưỡng an toàn (thang KTTV VN, QĐ 18/2021) ──────────────────────────

/** ≥ cấp 8 / sóng ≥4 m: chặn cứng — không vẽ tuyến qua */
export const HARD_WAVE_M = 4;
export const HARD_WIND_KMH = 62;
/** cấp 7 / sóng 3–4 m: "không nên đi" — phạt 1,5 + cảnh báo đỏ */
export const DANGER_WAVE_M = 3;
export const DANGER_WIND_KMH = 50;
/** cấp 6 / sóng 2–3 m: "cẩn thận" — mùa gió Tây Nam đi thường xuyên */
export const CAUTION_WAVE_M = 2;
export const CAUTION_WIND_KMH = 39;

// Penalty nhỏ — chỉ để chọn giữa các tuyến gần bằng nhau. Penalty P cho
// phép vòng tối đa (P−1)×100% quãng đường: 1,15 = "đáng vòng ≤15% để né
// sóng cấp cẩn thận"; 1,5 = "đáng vòng ≤50% để né mức không-nên-đi".
const PEN_CAUTION = 1.15;
const PEN_DANGER = 1.5;
const PEN_BROACH = 1.2;
const SHALLOW_PENALTY = 1.15; // nước nông 4–12 m: đi được nhưng ưu tiên né

/**
 * TRẦN ĐƯỜNG VÒNG: đường thẳng vẫn đi được vật lý mà tuyến tối ưu dài hơn
 * chim bay quá mức này → trả đường thẳng + cảnh báo (VISIR ghi nhận tuyến
 * tối ưu điển hình chỉ dài hơn ~3%, hiếm khi quá 10%).
 */
export const MAX_DETOUR_RATIO = 1.3;

/** Quanh nơi xuất phát/điểm đến: nới chặn cạn (cảng sát bờ; tàu thuộc con nước nhà) */
const VICINITY_SHALLOW_KM = 12;
/** Nới chặn Ô ĐẤT chỉ trong bán kính nhỏ hơn — không cho tuyến cắt doi đất */
const VICINITY_LAND_KM = 5;

// ── lưới tìm đường + Dijkstra ────────────────────────────────────────────

const MAX_NODES = 7500;
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  // 8 ô kề + 8 nước "mã" — 16 hướng để tuyến không bị gãy bậc thang (VISIR
  // dùng connectivity bậc cao cùng lý do)
  [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1],
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

export type RoutePlan = {
  /** start … dest — vẽ thẳng lên bản đồ */
  waypoints: LatLon[];
  distKm: number;
  hours: number;
  fuelL: number;
  maxWaveM: number;
  maxWindKmh: number;
  /** có đoạn mức "không nên đi" (sóng ≥3 m / gió ≥cấp 7) — cảnh báo đỏ */
  hasRoughLeg: boolean;
  /** có đoạn nước nông 4–12 m */
  hasShallowLeg: boolean;
  /** có đoạn sóng đuôi ngắn ≥2 m (nguy cơ trượt sóng — giảm ga, đổi hướng nhẹ) */
  hasFollowingSeaRisk: boolean;
  /** false = thiếu dữ liệu độ sâu, tuyến CHƯA né vùng cạn */
  depthChecked: boolean;
  /**
   * true = tuyến tối ưu vòng quá trần MAX_DETOUR_RATIO trong khi đường
   * thẳng vẫn đi được → ĐÃ TRẢ đường thẳng kèm cảnh báo, không bán đường
   * vòng vô lý. UI phải nói rõ.
   */
  cappedToDirect: boolean;
  /** đường thẳng để so sánh — null khi đường thẳng vướng đất/cạn/sóng cấm */
  direct: {
    distKm: number;
    hours: number;
    fuelL: number;
    maxWaveM: number;
  } | null;
  /**
   * Chênh dầu CÓ DẤU so với chạy thẳng: âm = tuyến đỡ dầu hơn, dương =
   * tuyến tốn THÊM (đi vòng né sóng — người dùng phải được biết con số
   * thật, không cắt về 0). null khi không có direct để so.
   */
  fuelDeltaL: number | null;
};

type LegInfo = {
  feasible: boolean;
  distKm: number;
  hours: number;
  fuelL: number;
  cost: number;
  waveM: number;
  windKmh: number;
  rough: boolean;
  shallow: boolean;
  following: boolean;
};

type PlanArgs = {
  start: LatLon;
  dest: LatLon;
  boat: BoatProfile;
  /** giờ xuất phát tính từ 0h hôm nay giờ VN (trục giờ của WeatherField) */
  departHourIdx: number;
  field: WeatherField;
  /** null = nguồn độ sâu không tải được — vẫn tính, plan.depthChecked=false */
  depth: DepthGrid | null;
  bbox: BBox;
};

// hàng đợi ưu tiên nhị phân tối giản
class MinHeap {
  keys: number[] = [];
  vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(key: number, val: number) {
    const k = this.keys;
    const v = this.vals;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): number {
    const k = this.keys;
    const v = this.vals;
    const top = v[0];
    const lastK = k.pop()!;
    const lastV = v.pop()!;
    if (k.length > 0) {
      k[0] = lastK;
      v[0] = lastV;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

export function planRoute(args: PlanArgs): RoutePlan | null {
  const { start, dest, boat, departHourIdx, field, depth, bbox } = args;
  const midLat = (bbox.latMin + bbox.latMax) / 2;
  const spanLatKm = (bbox.latMax - bbox.latMin) * 111.32;
  const spanLonKm = (bbox.lonMax - bbox.lonMin) * 111.32 * Math.cos(rad(midLat));
  // bước lưới: mịn nhất 4 km, thô dần để tổng nút ≤ MAX_NODES
  let stepKm = Math.max(4, Math.max(spanLatKm, spanLonKm) / 90);
  for (;;) {
    const nI = Math.floor(spanLatKm / stepKm) + 1;
    const nJ = Math.floor(spanLonKm / stepKm) + 1;
    if (nI * nJ <= MAX_NODES) break;
    stepKm *= 1.2;
  }
  const dLat = stepKm / 111.32;
  const dLon = stepKm / (111.32 * Math.cos(rad(midLat)));
  const nI = Math.floor((bbox.latMax - bbox.latMin) / dLat) + 1;
  const nJ = Math.floor((bbox.lonMax - bbox.lonMin) / dLon) + 1;
  const n = nI * nJ;
  const pointOf = (idx: number): LatLon => ({
    lat: bbox.latMin + Math.floor(idx / nJ) * dLat,
    lon: bbox.lonMin + (idx % nJ) * dLon,
  });
  const snap = (p: LatLon): number => {
    const i = Math.max(0, Math.min(nI - 1, Math.round((p.lat - bbox.latMin) / dLat)));
    const j = Math.max(0, Math.min(nJ - 1, Math.round((p.lon - bbox.lonMin) / dLon)));
    return i * nJ + j;
  };
  const sIdx = snap(start);
  const dIdx = snap(dest);

  const nearEndpoints = (p: LatLon, radiusKm: number) =>
    haversineKm(p, start) <= radiusKm || haversineKm(p, dest) <= radiusKm;

  const calmKmh = boat.speedKn * KMH_PER_KNOT;

  /**
   * Chi phí chặng from→to. Thời tiết lấy tại TRUNG ĐIỂM chặng vào GIỮA
   * khoảng giờ chạy chặng (ước lượng bằng tốc độ êm — đủ tốt). Độ sâu kiểm
   * mẫu mỗi ≤5 km dọc chặng để rạn/đảo không lọt khe giữa hai đầu cạnh.
   * relaxed=true (chỉ dùng khi TÍNH LẠI số liệu tuyến đã chọn): không chặn
   * nữa nhưng vẫn đo đủ cờ/maxWave — tổng hiển thị luôn là CẢ tuyến.
   */
  const legCost = (
    from: LatLon,
    to: LatLon,
    atHour: number,
    relaxed: boolean,
  ): LegInfo => {
    const infeasible: LegInfo = {
      feasible: false, distKm: 0, hours: 0, fuelL: 0, cost: 0,
      waveM: 0, windKmh: 0, rough: false, shallow: false, following: false,
    };
    const distKm = haversineKm(from, to);
    const mid = lerp(from, to, 0.5);

    // ràng buộc tĩnh: độ sâu/bờ (VISIR static constraint) — mẫu dày dọc chặng
    let shallow = false;
    if (depth) {
      const nSamples = Math.max(2, Math.ceil(distKm / 5));
      for (let s = 1; s <= nSamples; s++) {
        const p = lerp(from, to, s / nSamples);
        const cls = depthClassAt(depth, p.lat, p.lon);
        if (cls === 0) {
          // đất liền: chỉ nới trong bán kính nhỏ sát cảng
          if (!relaxed && !nearEndpoints(p, VICINITY_LAND_KM)) return infeasible;
        } else if (cls === 1) {
          if (!relaxed && !nearEndpoints(p, VICINITY_SHALLOW_KM)) return infeasible;
        } else if (cls === 2) {
          shallow = true;
        }
      }
    }

    const h = sampleField(field, mid.lat, mid.lon, atHour + distKm / calmKmh / 2);
    if (!h) {
      // ngoài lưới thời tiết / cả 4 góc đất liền
      if (!relaxed && !nearEndpoints(to, VICINITY_SHALLOW_KM)) return infeasible;
      // sát cảng: chạy bằng số 0 an toàn (chặng ngắn)
      const hours0 = distKm / calmKmh;
      return {
        feasible: true, distKm, hours: hours0,
        fuelL: hours0 * boat.litersPerHour,
        cost: hours0 * boat.litersPerHour * (shallow ? SHALLOW_PENALTY : 1),
        waveM: 0, windKmh: 0, rough: false, shallow, following: false,
      };
    }

    const waveM = h.waveM ?? 0;
    const hard = waveM >= HARD_WAVE_M || h.windKmh >= HARD_WIND_KMH;
    if (hard && !relaxed) return infeasible; // ≥ cấp 8 — không vẽ tuyến qua

    const heading = bearingDeg(from, to);
    const dirF = waveDirFactor(h.waveFromDeg, heading);
    // tốc độ QUA NƯỚC sau khi sóng làm chậm
    const stwKmh = calmKmh * speedFactor(waveM, dirF);
    // cộng vector dòng chảy (VISIR-2): dọc cộng thẳng, ngang vát mũi bù;
    // dòng nguồn ≤ ~4 km/h, kẹp sàn 25% để không chia 0
    const speedKmh = Math.max(
      stwKmh * 0.25,
      currentAlongKmh(h, heading) +
        Math.sqrt(Math.max(stwKmh ** 2 - currentCrossKmh(h, heading) ** 2, 0)),
    );
    const hours = distKm / speedKmh;
    const fuelL =
      hours *
      boat.litersPerHour *
      (1 + windDragFactor(h.windKmh, h.windFromDeg, heading));

    const following = followingSeaRisk(waveM, h.waveFromDeg, heading, h.wavePeriodS);
    // sóng ≥3 m trên nền nước nông 4–12 m: sóng bạc đầu/vỡ — nguy hiểm hơn
    // hẳn cùng độ cao ngoài khơi → nâng lên mức "không nên đi"
    const danger =
      hard ||
      waveM >= DANGER_WAVE_M ||
      h.windKmh >= DANGER_WIND_KMH ||
      (shallow && waveM >= DANGER_WAVE_M - 0.5);
    const caution = waveM >= CAUTION_WAVE_M || h.windKmh >= CAUTION_WIND_KMH;
    let pen = danger ? PEN_DANGER : caution ? PEN_CAUTION : 1;
    if (following) pen *= PEN_BROACH;
    if (shallow) pen *= SHALLOW_PENALTY;

    return {
      feasible: true, distKm, hours, fuelL, cost: fuelL * pen,
      waveM, windKmh: h.windKmh, rough: danger, shallow, following,
    };
  };

  // Dijkstra: nhãn = chi phí (dầu × phạt nhẹ) tích luỹ; giờ ETA đi ké nhãn
  // rẻ nhất — xấp xỉ time-dependent, đủ tốt cho dự báo nội suy theo giờ
  const cost = new Float64Array(n).fill(Infinity);
  const hoursAcc = new Float64Array(n);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new MinHeap();
  cost[sIdx] = 0;
  heap.push(0, sIdx);

  while (heap.size > 0) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === dIdx) break;
    const pu = pointOf(u);
    const ui = Math.floor(u / nJ);
    const uj = u % nJ;
    for (const [di, dj] of NEIGHBORS) {
      const vi = ui + di;
      const vj = uj + dj;
      if (vi < 0 || vi >= nI || vj < 0 || vj >= nJ) continue;
      const v = vi * nJ + vj;
      if (done[v]) continue;
      const leg = legCost(pu, pointOf(v), departHourIdx + hoursAcc[u], false);
      if (!leg.feasible) continue;
      const c = cost[u] + leg.cost;
      if (c < cost[v]) {
        cost[v] = c;
        hoursAcc[v] = hoursAcc[u] + leg.hours;
        prev[v] = u;
        heap.push(c, v);
      }
    }
  }

  if (!Number.isFinite(cost[dIdx])) return null;

  // dựng lại tuyến node, thay hai đầu bằng toạ độ thật
  const nodePath: number[] = [];
  for (let v = dIdx; v !== -1; v = prev[v]) nodePath.unshift(v);
  let waypoints: LatLon[] = [
    start,
    ...nodePath.slice(1, -1).map(pointOf),
    dest,
  ];

  // kéo căng dây (string-pulling): bỏ nút trung gian nếu nối thẳng vẫn an
  // toàn — khử zigzag bậc thang của lưới trước khi đo quãng đường/vẽ
  const smoothed: LatLon[] = [waypoints[0]];
  let hoursEst = 0;
  let i = 0;
  while (i < waypoints.length - 1) {
    let j = Math.min(i + 6, waypoints.length - 1);
    for (; j > i + 1; j--) {
      if (legCost(waypoints[i], waypoints[j], departHourIdx + hoursEst, false).feasible)
        break;
    }
    hoursEst += haversineKm(waypoints[i], waypoints[j]) / calmKmh;
    smoothed.push(waypoints[j]);
    i = j;
  }
  waypoints = smoothed;

  /** Tính lại số liệu trọn tuyến theo đúng mô hình (relaxed → không bao giờ cụt giữa chừng) */
  const walk = (pts: LatLon[], relaxed: boolean) => {
    let hoursSum = 0,
      fuelSum = 0,
      distSum = 0,
      maxWave = 0,
      maxWind = 0;
    let rough = false,
      shallowFlag = false,
      following = false,
      ok = true;
    for (let k = 1; k < pts.length; k++) {
      const leg = legCost(pts[k - 1], pts[k], departHourIdx + hoursSum, relaxed);
      if (!leg.feasible) {
        ok = false;
        break;
      }
      hoursSum += leg.hours;
      fuelSum += leg.fuelL;
      distSum += leg.distKm;
      maxWave = Math.max(maxWave, leg.waveM);
      maxWind = Math.max(maxWind, leg.windKmh);
      rough = rough || leg.rough;
      shallowFlag = shallowFlag || leg.shallow;
      following = following || leg.following;
    }
    return { ok, hoursSum, fuelSum, distSum, maxWave, maxWind, rough, shallowFlag, following };
  };

  const chosen = walk(waypoints, true);

  // đường thẳng để so sánh trung thực — chia nhỏ theo bước lưới
  const directDist = haversineKm(start, dest);
  const nSeg = Math.max(2, Math.ceil(directDist / stepKm));
  const directPts: LatLon[] = Array.from({ length: nSeg + 1 }, (_, k) =>
    lerp(start, dest, k / nSeg),
  );
  const directWalk = walk(directPts, false);
  const direct = directWalk.ok
    ? {
        distKm: directWalk.distSum,
        hours: directWalk.hoursSum,
        fuelL: directWalk.fuelSum,
        maxWaveM: directWalk.maxWave,
      }
    : null;

  // TRẦN ĐƯỜNG VÒNG: đường thẳng đi được vật lý mà tuyến vòng quá 30% →
  // trả đường thẳng + cảnh báo thật, thuyền trưởng tự quyết
  if (direct && chosen.distSum > directDist * MAX_DETOUR_RATIO) {
    return {
      waypoints: directPts,
      distKm: directWalk.distSum,
      hours: directWalk.hoursSum,
      fuelL: directWalk.fuelSum,
      maxWaveM: directWalk.maxWave,
      maxWindKmh: directWalk.maxWind,
      hasRoughLeg: directWalk.rough,
      hasShallowLeg: directWalk.shallowFlag,
      hasFollowingSeaRisk: directWalk.following,
      depthChecked: depth != null,
      cappedToDirect: true,
      direct,
      fuelDeltaL: 0,
    };
  }

  return {
    waypoints,
    distKm: chosen.distSum,
    hours: chosen.hoursSum,
    fuelL: chosen.fuelSum,
    maxWaveM: chosen.maxWave,
    maxWindKmh: chosen.maxWind,
    hasRoughLeg: chosen.rough,
    hasShallowLeg: chosen.shallowFlag,
    hasFollowingSeaRisk: chosen.following,
    depthChecked: depth != null,
    cappedToDirect: false,
    direct,
    fuelDeltaL: direct ? chosen.fuelSum - direct.fuelL : null,
  };
}

// ── helpers hiển thị / thời gian ─────────────────────────────────────────

/** 9,58 giờ → "9 giờ 35 phút" (làm tròn 5 phút) */
export function formatHoursVN(h: number): string {
  const totalMin = Math.round((h * 60) / 5) * 5;
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm} phút`;
  return mm === 0 ? `${hh} giờ` : `${hh} giờ ${mm} phút`;
}

/** Giờ hiện tại theo múi giờ VN (0–23) — khớp trục giờ dự báo Open-Meteo */
export function vnHourIndex(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(now),
  );
}
