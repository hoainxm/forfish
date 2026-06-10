// Trục 1 — dẫn đường tiết kiệm dầu: tìm tuyến giữa hai điểm trên biển,
// né vùng sóng to gió ngược theo dự báo từng giờ.
//
// File này THUẦN LOGIC (test được, không fetch) — dữ liệu thời tiết đi qua
// adapter src/lib/route-weather.ts, đổi nguồn không đụng thuật toán.
//
// Mô hình ước lượng THAM KHẢO (không hứa chính xác — UI luôn kèm lời dặn
// dò hải đồ + nghe đài duyên hải):
//   · sóng làm tàu chậm lại → cùng quãng đường tốn nhiều giờ máy hơn
//   · chạy ngược gió máy ăn dầu hơn, xuôi gió đỡ một chút
//   · vùng sóng/gió vượt ngưỡng dữ chỉ đâm qua khi không còn lối khác

export type LatLon = { lat: number; lon: number };

export type BoatProfile = {
  /** tốc độ lúc trời êm, hải lý/giờ */
  speedKn: number;
  /** máy ăn dầu, lít/giờ */
  litersPerHour: number;
};

export const DEFAULT_BOAT: BoatProfile = { speedKn: 7, litersPerHour: 20 };
export const KMH_PER_KNOT = 1.852;

/** Dự báo một giờ tại một ô lưới */
export type HourSample = {
  /** null = nguồn không có số sóng giờ đó (sát bờ) */
  waveM: number | null;
  windKmh: number;
  /** hướng gió THỔI TỪ, độ — chuẩn khí tượng */
  windFromDeg: number;
};

/** Một ô trên hành lang tuyến + dự báo 48 giờ (từ 0h hôm nay, giờ VN) */
export type RouteCell = {
  point: LatLon;
  /** false = nguồn sóng không có số nào → coi như đất liền, không đi qua */
  onSea: boolean;
  hours: HourSample[];
};

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

/** Dời điểm theo hướng `bearing` một đoạn `distKm` — xấp xỉ phẳng, đủ cho lưới ≤60 km */
export function offsetPoint(
  p: LatLon,
  bearing: number,
  distKm: number,
): LatLon {
  const dLat = (distKm * Math.cos(rad(bearing))) / 111.32;
  const dLon =
    (distKm * Math.sin(rad(bearing))) / (111.32 * Math.cos(rad(p.lat)));
  return { lat: p.lat + dLat, lon: p.lon + dLon };
}

export function kmToNm(km: number): number {
  return km / KMH_PER_KNOT;
}

// ── hành lang tuyến: lưới điểm dọc đường thẳng + lệch ngang hai bên ──────

/** Số nấc lệch ngang mỗi bên so với đường thẳng */
export const LATERAL_STEPS = 3;

export type Corridor = {
  start: LatLon;
  dest: LatLon;
  /** steps[i][j]: hàng i dọc tuyến, cột j ngang tuyến; cột giữa nằm trên đường thẳng */
  steps: LatLon[][];
  /** chỉ số cột giữa (đường thẳng) */
  center: number;
  /** [start, ...steps trải phẳng, dest] — đúng thứ tự gửi đi lấy dự báo */
  points: LatLon[];
};

export function buildCorridor(start: LatLon, dest: LatLon): Corridor {
  const dist = haversineKm(start, dest);
  // ~1 hàng mỗi 25 km, tối thiểu 5 để có chỗ lách, tối đa 12 để gọn lượt gọi mạng
  const nSteps = Math.min(12, Math.max(5, Math.round(dist / 25)));
  const spacing = Math.min(28, Math.max(8, dist * 0.05));
  const heading = bearingDeg(start, dest);
  const steps: LatLon[][] = [];
  for (let i = 1; i <= nSteps; i++) {
    const t = i / (nSteps + 1);
    const centerPt = {
      lat: start.lat + (dest.lat - start.lat) * t,
      lon: start.lon + (dest.lon - start.lon) * t,
    };
    const row: LatLon[] = [];
    for (let j = -LATERAL_STEPS; j <= LATERAL_STEPS; j++) {
      row.push(
        j === 0 ? centerPt : offsetPoint(centerPt, heading + 90, j * spacing),
      );
    }
    steps.push(row);
  }
  return {
    start,
    dest,
    steps,
    center: LATERAL_STEPS,
    points: [start, ...steps.flat(), dest],
  };
}

// ── chi phí một chặng ────────────────────────────────────────────────────

/** Ngưỡng coi là vùng dữ — chỉ đâm qua khi hết lối, và luôn cảnh báo */
export const ROUGH_WAVE_M = 2.5;
export const ROUGH_WIND_KMH = 50;
const ROUGH_PENALTY = 3;

type LegInfo = {
  distKm: number;
  hours: number;
  fuelL: number;
  waveM: number;
  windKmh: number;
  rough: boolean;
};

/**
 * Chặng from→to, thời tiết lấy tại ô cuối chặng vào giờ xuất phát chặng
 * (hourIdx tính từ 0h hôm nay giờ VN, quá 48h thì giữ giờ cuối).
 */
function legInfo(
  from: LatLon,
  to: LatLon,
  cell: RouteCell,
  hourIdx: number,
  boat: BoatProfile,
): LegInfo {
  const distKm = haversineKm(from, to);
  const idx = Math.max(0, Math.min(Math.round(hourIdx), cell.hours.length - 1));
  const h = cell.hours[idx] ?? { waveM: null, windKmh: 0, windFromDeg: 0 };
  const waveM = h.waveM ?? 0;
  // sóng làm tàu chậm: ~8% mỗi mét trên 0,5 m, không chậm quá 40%
  const slow = Math.max(0.6, 1 - 0.08 * Math.max(0, waveM - 0.5));
  const speedKmh = boat.speedKn * KMH_PER_KNOT * slow;
  const hours = distKm / speedKmh;
  // thành phần ngược gió theo hướng chạy (>0 = gió thổi vào mũi tàu)
  const heading = bearingDeg(from, to);
  const headwindKmh = h.windKmh * Math.cos(rad(h.windFromDeg - heading));
  const windDrag = Math.min(0.25, Math.max(-0.08, headwindKmh * 0.004));
  const fuelL = hours * boat.litersPerHour * (1 + windDrag);
  const rough = waveM >= ROUGH_WAVE_M || h.windKmh >= ROUGH_WIND_KMH;
  return { distKm, hours, fuelL, waveM, windKmh: h.windKmh, rough };
}

// ── tìm tuyến ────────────────────────────────────────────────────────────

export type RoutePlan = {
  /** start … dest, vẽ thẳng lên bản đồ */
  waypoints: LatLon[];
  distKm: number;
  hours: number;
  fuelL: number;
  maxWaveM: number;
  maxWindKmh: number;
  /** tuyến vẫn phải xuyên qua đoạn vượt ngưỡng dữ — UI bắt buộc cảnh báo */
  hasRoughLeg: boolean;
  /** đường thẳng để so sánh — null khi đường thẳng vướng đất/thiếu số liệu */
  direct: { distKm: number; hours: number; fuelL: number } | null;
  /** lít dầu đỡ được so với chạy thẳng (0 khi tuyến chọn chính là đường thẳng) */
  savedFuelL: number;
};

type DpNode = {
  cost: number;
  hours: number;
  fuelL: number;
  distKm: number;
  maxWaveM: number;
  maxWindKmh: number;
  rough: boolean;
  prevJ: number;
};

/**
 * Quy hoạch động qua hành lang: mỗi hàng chọn ô rẻ nhất tới được từ hàng
 * trước (lệch ngang tối đa 1 nấc/hàng để tuyến không gãy khúc). Chi phí =
 * dầu ước tính, nhân phạt khi chặng vượt ngưỡng dữ. `cells` phải đúng thứ
 * tự `corridor.points`. Trả null khi không có lối nào qua được.
 */
export function planRoute(
  corridor: Corridor,
  cells: RouteCell[],
  boat: BoatProfile,
  departHourIdx: number,
): RoutePlan | null {
  const width = 2 * LATERAL_STEPS + 1;
  const nSteps = corridor.steps.length;
  if (cells.length !== nSteps * width + 2) return null;
  const cellAt = (i: number, j: number) => cells[1 + i * width + j];
  const destCell = cells[cells.length - 1];

  const step = (
    from: LatLon,
    to: LatLon,
    cell: RouteCell,
    acc: DpNode,
    prevJ: number,
  ): DpNode => {
    const leg = legInfo(from, to, cell, departHourIdx + acc.hours, boat);
    return {
      cost: acc.cost + leg.fuelL * (leg.rough ? ROUGH_PENALTY : 1),
      hours: acc.hours + leg.hours,
      fuelL: acc.fuelL + leg.fuelL,
      distKm: acc.distKm + leg.distKm,
      maxWaveM: Math.max(acc.maxWaveM, leg.waveM),
      maxWindKmh: Math.max(acc.maxWindKmh, leg.windKmh),
      rough: acc.rough || leg.rough,
      prevJ,
    };
  };

  const zero: DpNode = {
    cost: 0,
    hours: 0,
    fuelL: 0,
    distKm: 0,
    maxWaveM: 0,
    maxWindKmh: 0,
    rough: false,
    prevJ: -1,
  };

  // hàng đầu: từ điểm xuất phát toả ra mọi cột còn đi được
  let row: (DpNode | null)[] = Array.from({ length: width }, (_, j) => {
    const cell = cellAt(0, j);
    if (!cell.onSea) return null;
    return step(corridor.start, cell.point, cell, zero, -1);
  });
  const trace: (DpNode | null)[][] = [row];

  for (let i = 1; i < nSteps; i++) {
    const next: (DpNode | null)[] = Array.from({ length: width }, (_, j) => {
      const cell = cellAt(i, j);
      if (!cell.onSea) return null;
      let best: DpNode | null = null;
      for (const dj of [-1, 0, 1]) {
        const pj = j + dj;
        const prev = row[pj];
        if (pj < 0 || pj >= width || !prev) continue;
        const cand = step(cellAt(i - 1, pj).point, cell.point, cell, prev, pj);
        if (!best || cand.cost < best.cost) best = cand;
      }
      return best;
    });
    trace.push(next);
    row = next;
  }

  // chặng chót: hàng cuối → điểm đến (điểm đến không bị chặn — UI đã kiểm onSea)
  let final: DpNode | null = null;
  for (let j = 0; j < width; j++) {
    const prev = row[j];
    if (!prev) continue;
    const cand = step(cellAt(nSteps - 1, j).point, corridor.dest, destCell, prev, j);
    if (!final || cand.cost < final.cost) final = cand;
  }
  if (!final) return null;

  // lần ngược cột đã chọn ở từng hàng
  const cols: number[] = [];
  let j = final.prevJ;
  for (let i = nSteps - 1; i >= 0; i--) {
    cols.unshift(j);
    j = trace[i][j]!.prevJ;
  }
  const waypoints = [
    corridor.start,
    ...cols.map((c, i) => cellAt(i, c).point),
    corridor.dest,
  ];

  // đường thẳng = đi đúng cột giữa, để so sánh trung thực (không nhân phạt)
  let direct: RoutePlan["direct"] = null;
  const centerBlocked = corridor.steps.some(
    (_, i) => !cellAt(i, corridor.center).onSea,
  );
  if (!centerBlocked) {
    let acc = zero;
    let from = corridor.start;
    for (let i = 0; i < nSteps; i++) {
      const cell = cellAt(i, corridor.center);
      acc = step(from, cell.point, cell, acc, corridor.center);
      from = cell.point;
    }
    acc = step(from, corridor.dest, destCell, acc, corridor.center);
    direct = { distKm: acc.distKm, hours: acc.hours, fuelL: acc.fuelL };
  }

  return {
    waypoints,
    distKm: final.distKm,
    hours: final.hours,
    fuelL: final.fuelL,
    maxWaveM: final.maxWaveM,
    maxWindKmh: final.maxWindKmh,
    hasRoughLeg: final.rough,
    direct,
    savedFuelL: direct ? Math.max(0, direct.fuelL - final.fuelL) : 0,
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
