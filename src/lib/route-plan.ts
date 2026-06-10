// Trục 1 — dẫn đường tiết kiệm dầu. THUẦN LOGIC (test được, không fetch).
//
// Thuật toán theo các nghiên cứu đã công bố (chi tiết + nguồn:
// docs/research/06-weather-routing.md):
//   · VISIR-1/2 (Mannarini et al., Geosci. Model Dev. 2016, 2024 — mô hình
//     mã nguồn mở cho TÀU NHỎ kể cả tàu cá): đồ thị lưới phủ cả vùng biển,
//     tìm đường ngắn nhất time-dependent (trọng số cạnh đổi theo giờ dự báo),
//     ràng buộc TĨNH (độ sâu, bờ — src/lib/depth-grid.ts) + ràng buộc ĐỘNG
//     (an toàn theo sóng).
//   · Giảm tốc trong sóng CÓ HƯỚNG kiểu Kwon/Townsin–Kwon: sóng mũi nặng
//     nhất, sóng ngang ~70%, sóng đuôi ~40% mức đó.
//   · Cảnh giác sóng đuôi (đơn giản hoá IMO MSC.1/Circ.1228): sóng từ phía
//     đuôi ±45° và cao ≥2 m → nguy cơ trượt sóng/lật ngang với tàu nhỏ,
//     phạt nặng để tuyến tránh trừ khi hết lối.
//
// Tìm đường: Dijkstra time-dependent (đúng nghiệm như VISIR; lưới ≤ ~7000
// nút nên chạy tức thì trên điện thoại). Chi phí cạnh = lít dầu ước tính:
// máy chạy ga cố định → dầu/giờ gần như không đổi, sóng làm tàu CHẬM nên
// cùng quãng đường tốn nhiều giờ máy hơn; ngược gió thêm sức cản.
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

function hourAt(c: WeatherCellSeries, hourIdx: number): HourSample {
  const idx = Math.max(0, Math.min(Math.round(hourIdx), c.hours.length - 1));
  return (
    c.hours[idx] ?? {
      waveM: null,
      waveFromDeg: null,
      windKmh: 0,
      windFromDeg: 0,
      currentKmh: 0,
      currentToDeg: null,
    }
  );
}

/**
 * Nội suy song tuyến giữa 4 ô góc, bỏ ô đất liền khỏi phép nội suy (trọng số
 * chuẩn hoá lại theo ô biển). Hướng nội suy theo vector sin/cos để không gãy
 * quanh mốc 0°/360°. Trả null khi cả 4 góc là đất/ngoài lưới.
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
  let wind = 0;
  let wvSin = 0,
    wvCos = 0,
    wdSin = 0,
    wdCos = 0;
  // dòng chảy nội suy theo VECTOR (u đông, v bắc) — hai ô chảy ngược nhau
  // thì giữa chúng phải gần đứng nước, không phải "trung bình hướng"
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
    windKmh: wind / wSum,
    windFromDeg: (deg(Math.atan2(wdSin, wdCos)) + 360) % 360,
    currentKmh: curKmh,
    currentToDeg:
      curKmh > 0.01 ? (deg(Math.atan2(curU, curV)) + 360) % 360 : null,
  };
}

// ── mô hình tàu trong sóng gió (Kwon-lite + IMO 1228-lite) ──────────────

/**
 * Hệ số hướng sóng so với hướng chạy (Townsin–Kwon: giảm tốc nặng nhất khi
 * sóng vỗ mũi, sóng ngang nhẹ hơn, sóng đuôi nhẹ nhất). Không có hướng sóng
 * → coi như sóng mũi (an toàn nghiêng về ước tính tốn hơn).
 */
export function waveDirFactor(
  waveFromDeg: number | null,
  headingDeg: number,
): number {
  if (waveFromDeg == null) return 1;
  const d = Math.abs(angleDiffDeg(waveFromDeg, headingDeg));
  if (d <= 45) return 1; // sóng mũi
  if (d <= 135) return 0.7; // sóng vai/ngang
  return 0.4; // sóng đuôi
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

/** Sóng đuôi ±45° và cao ≥2 m — nguy cơ trượt sóng/broaching với tàu nhỏ */
export function followingSeaRisk(
  waveM: number,
  waveFromDeg: number | null,
  headingDeg: number,
): boolean {
  if (waveFromDeg == null || waveM < 2) return false;
  return Math.abs(angleDiffDeg(waveFromDeg, headingDeg)) > 135;
}

// Ngưỡng an toàn
export const HARD_WAVE_M = 4; // không vẽ tuyến qua — quá sức tàu cá nhỏ
export const ROUGH_WAVE_M = 2.5;
export const ROUGH_WIND_KMH = 50; // ~cấp 7
const ROUGH_PENALTY = 3;
const SHALLOW_PENALTY = 1.15; // nước nông 10–20 m: đi được nhưng ưu tiên né
/** Quanh nơi xuất phát/điểm đến: bỏ chặn cạn/bờ (cảng nằm sát bờ) */
const VICINITY_KM = 12;

// ── lưới tìm đường + Dijkstra time-dependent ─────────────────────────────

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
  /** còn đoạn vượt ngưỡng dữ (sóng ≥2,5 m / gió ≥cấp 7) — bắt buộc cảnh báo */
  hasRoughLeg: boolean;
  /** có đoạn nước nông 10–20 m */
  hasShallowLeg: boolean;
  /** có đoạn sóng đuôi ≥2 m (nguy cơ trượt sóng) */
  hasFollowingSeaRisk: boolean;
  /** false = thiếu dữ liệu độ sâu, tuyến CHƯA né vùng cạn */
  depthChecked: boolean;
  /** đường thẳng để so sánh — null khi đường thẳng vướng đất/cạn/sóng quá dữ */
  direct: { distKm: number; hours: number; fuelL: number } | null;
  /** lít dầu đỡ được so với chạy thẳng */
  savedFuelL: number;
};

type LegCost = {
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

  const nearEndpoints = (p: LatLon) =>
    haversineKm(p, start) <= VICINITY_KM || haversineKm(p, dest) <= VICINITY_KM;

  /** Chi phí chặng from→to, thời tiết lấy tại điểm đến chặng vào giờ ETA */
  const legCost = (
    from: LatLon,
    to: LatLon,
    atHour: number,
    relaxed: boolean,
  ): LegCost => {
    const infeasible: LegCost = {
      feasible: false, distKm: 0, hours: 0, fuelL: 0, cost: 0,
      waveM: 0, windKmh: 0, rough: false, shallow: false, following: false,
    };
    const distKm = haversineKm(from, to);
    const mid = { lat: (from.lat + to.lat) / 2, lon: (from.lon + to.lon) / 2 };

    // ràng buộc tĩnh: độ sâu/bờ (VISIR static constraint) — kiểm cả điểm giữa
    // vì cạnh chéo dài hơn ô lưới độ sâu
    let shallow = false;
    if (depth) {
      for (const p of [to, mid]) {
        const cls = depthClassAt(depth, p.lat, p.lon);
        if (cls === 0 || cls === 1) {
          if (!relaxed && !nearEndpoints(p)) return infeasible;
        } else if (cls === 2) {
          shallow = true;
        }
      }
    }

    const h = sampleField(field, to.lat, to.lon, atHour);
    if (!h) {
      // ngoài lưới thời tiết / cả 4 góc đất liền
      if (!relaxed && !nearEndpoints(to)) return infeasible;
      // sát cảng: chạy bằng số 0 an toàn (chặng ngắn)
      const hours0 = distKm / (boat.speedKn * KMH_PER_KNOT);
      return {
        feasible: true, distKm, hours: hours0,
        fuelL: hours0 * boat.litersPerHour,
        cost: hours0 * boat.litersPerHour * (shallow ? SHALLOW_PENALTY : 1),
        waveM: 0, windKmh: 0, rough: false, shallow, following: false,
      };
    }

    const waveM = h.waveM ?? 0;
    if (waveM >= HARD_WAVE_M) return infeasible; // quá sức tàu — không vẽ qua

    const heading = bearingDeg(from, to);
    const dirF = waveDirFactor(h.waveFromDeg, heading);
    // tốc độ QUA NƯỚC sau khi sóng làm chậm
    const stwKmh = boat.speedKn * KMH_PER_KNOT * speedFactor(waveM, dirF);
    // cộng vector dòng chảy (VISIR-2 velocity composition): thành phần dọc
    // hướng chạy cộng thẳng; thành phần ngang phải "vát mũi" bù — phần tốc
    // độ còn lại để tiến = sqrt(stw² − ngang²). Dòng nguồn này ≤ ~4 km/h,
    // kẹp sàn 25% để không bao giờ chia 0.
    const speedKmh = Math.max(
      stwKmh * 0.25,
      currentAlongKmh(h, heading) +
        Math.sqrt(
          Math.max(stwKmh ** 2 - currentCrossKmh(h, heading) ** 2, 0),
        ),
    );
    const hours = distKm / speedKmh;
    const fuelL =
      hours *
      boat.litersPerHour *
      (1 + windDragFactor(h.windKmh, h.windFromDeg, heading));
    const following = followingSeaRisk(waveM, h.waveFromDeg, heading);
    const rough =
      waveM >= ROUGH_WAVE_M || h.windKmh >= ROUGH_WIND_KMH || following;
    let cost = fuelL;
    if (rough) cost *= ROUGH_PENALTY;
    if (shallow) cost *= SHALLOW_PENALTY;
    return {
      feasible: true, distKm, hours, fuelL, cost,
      waveM, windKmh: h.windKmh, rough, shallow, following,
    };
  };

  // Dijkstra time-dependent: nhãn = chi phí phạt tích luỹ; giờ ETA tích luỹ
  // theo nhãn tốt nhất (đúng nghiệm khi dự báo không "thưởng" người đến muộn
  // — chuẩn FIFO, cùng giả định với VISIR)
  const cost = new Float64Array(n).fill(Infinity);
  const hoursAcc = new Float64Array(n);
  const fuelAcc = new Float64Array(n);
  const distAcc = new Float64Array(n);
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
      const real = legCost(pu, pointOf(v), departHourIdx + hoursAcc[u], false);
      if (!real.feasible) continue;
      const c = cost[u] + real.cost;
      if (c < cost[v]) {
        cost[v] = c;
        hoursAcc[v] = hoursAcc[u] + real.hours;
        fuelAcc[v] = fuelAcc[u] + real.fuelL;
        distAcc[v] = distAcc[u] + real.distKm;
        prev[v] = u;
        heap.push(c, v);
      }
    }
  }

  if (!Number.isFinite(cost[dIdx])) return null;

  // dựng lại tuyến node → tính lại flags/max trên đường đã chọn
  const nodePath: number[] = [];
  for (let v = dIdx; v !== -1; v = prev[v]) nodePath.unshift(v);
  const waypoints: LatLon[] = [
    start,
    ...nodePath.slice(1, -1).map(pointOf),
    dest,
  ];

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
  const directPts: LatLon[] = Array.from({ length: nSeg + 1 }, (_, k) => ({
    lat: start.lat + ((dest.lat - start.lat) * k) / nSeg,
    lon: start.lon + ((dest.lon - start.lon) * k) / nSeg,
  }));
  const directWalk = walk(directPts, false);

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
    direct: directWalk.ok
      ? {
          distKm: directWalk.distSum,
          hours: directWalk.hoursSum,
          fuelL: directWalk.fuelSum,
        }
      : null,
    savedFuelL: directWalk.ok
      ? Math.max(0, directWalk.fuelSum - chosen.fuelSum)
      : 0,
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
