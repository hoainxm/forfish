/**
 * Trục 1 — HẬU KIỂM TUYẾN trên kho hải đồ trong máy (THUẦN, không fetch).
 *
 * `route-plan` đã NÉ hiểm hoạ khi vẽ (chặn cứng trong `legCost`). File này trả
 * lời câu còn lại của thẻ tuyến: "đi đường này thì GẶP gì, ở đâu, lúc mấy giờ"
 * — xác tàu tuyến vừa né sát, giàn khoan cách 1 hải lý, cáp ngầm cắt ở km 12,
 * chỗ nước cạn phải chờ con nước, phao sẽ gặp theo thứ tự, đoạn chạy sát ranh
 * giới. Mỗi vật MỘT dòng, sắp theo thứ tự gặp (`alongKm`), kèm ETA nếu biết.
 *
 * ── LUẬT (quyết định thiết kế 2026-09-04 §1.2, §1.6, §3) ──────────────────
 *   · Triều KHÔNG vào Dijkstra — chỉ ở đây, tại ETA từng chỗ: thiếu nước thì
 *     câu "chờ nước lên", không sinh đường vòng.
 *   · Không phán đi/không đi. Không ra lệnh lái. Giọng "chừng", "canh".
 *   · draftM null → mọi câu mớn IM (không so độ sâu, không nói "tàu cần").
 *   · Trạm triều > 120 km hoặc không có → KHÔNG in mực nước ước tính, nói
 *     "chưa tính con nước chỗ này". Trạm mô hình → gắn "(ước tính)".
 *   · Ranh giới: chỉ cờ/câu, không phạt, không chặn; ≤ 6 hải lý → đỏ.
 *   · Kho nào thiếu → ghi `missing`, KHÔNG ném: thẻ tuyến phải nói "chưa soi
 *     được cáp ngầm" chứ không im như đã soi.
 *
 * ## Assumptions
 * - `verdicts` tra theo `verdictKey(0, "diem", i)` với `i` là chỉ số trong
 *   mảng `soundings` truyền vào — cùng quy ước với `fishing-map-view.tsx`.
 * - Luồng (`fairways`) chỉ TIN (COLREG 9: tàu cá không ưu tiên luồng); khi biết
 *   mớn mà độ sâu khống chế (+ triều) thấp hơn mức cần thì nâng lên VÀNG, không
 *   đỏ — đó là con số nông nhất của cả đoạn, không phải chỗ tàu chắc chắn qua.
 * - Số đo sâu: nhiều điểm dồn trong một luồng → gộp theo từng km tuyến, giữ
 *   điểm THIẾU NƯỚC NHIỀU NHẤT, để thẻ tuyến không có 30 dòng cùng một cửa lạch.
 * - "km" trong câu cáp ("cắt cáp ngầm ở km 12") là km dọc tuyến — đúng đề bài;
 *   khoảng cách ngang thì nói m / hải lý như các câu khác.
 */

import { haversineKm, type LatLon } from "@/lib/route-plan";
import {
  buildIndex,
  buildSegmentIndex,
  distToSegment,
  pointInRing,
  queryCorridor,
  segmentsWithinCorridor,
  type Segment,
} from "@/lib/spatial-index";
import {
  hazardLabel,
  moTaHazard,
  noGoFromLanes,
  requiredDepthM,
  NO_GO_PAD_KM,
  type Hazard,
} from "@/lib/hazards";
import type { Sounding } from "@/lib/soundings";
import { SUSPECT, verdictKey, type VerdictIndex } from "@/lib/soundings-verified";
import type { FairwayDepth } from "@/lib/fairway-depth";
import {
  describeSeamark,
  huongDiQuaPhao,
  seamarkLabel,
  type Seamark,
} from "@/lib/seamarks";
import type { VnAid } from "@/lib/vn-aids";
import {
  isModelStation,
  nearestTideStation,
  tideClockText,
  tideExtremesForDay,
  tideHeightAt,
  tideTrendAt,
  tideTrendText,
  tideUpcoming,
  vnIsoDate,
  type TideStation,
} from "@/lib/tides";
import { borderProximity } from "@/lib/geofence";

/* ── KIỂU (hợp đồng §3) ──────────────────────────────────────────────────── */

export type RouteHitMuc = "do" | "vang" | "tin";

export type RouteHit = {
  id: string;
  loai: string;
  ten: string | null;
  /** cách tuyến, km (0 = tuyến đi qua / cắt) */
  km: number;
  /** đã chạy bao xa từ điểm xuất phát thì tới chỗ này, km */
  alongKm: number;
  muc: RouteHitMuc;
  cau: string;
  /** giờ chạy cộng dồn tới chỗ này; null khi không có `hoursAt` */
  etaH: number | null;
};

export type RouteAuditStores = {
  /** hiểm hoạ CHẶN (từ `buildHazardList().hazards`) */
  hazards?: Hazard[];
  /** xác tàu nước trên vật đủ cho tàu (`buildHazardList().passable`) */
  passable?: Hazard[];
  soundings?: Sounding[];
  verdicts?: VerdictIndex;
  fairways?: FairwayDepth[];
  /** feature vn-sea-lanes (cáp/ống/vùng cấm — hàm tự lọc) */
  lanes?: GeoJSON.Feature[];
  seamarks?: Seamark[];
  vnAids?: VnAid[];
  /** coral-reefs Point — chỉ để gắn tên bãi vào câu */
  reefs?: GeoJSON.Feature[];
  tides?: TideStation[];
  /** true = soi ranh giới VMS; false = chỗ gọi cố ý tắt; bỏ trống = thiếu */
  border?: boolean;
};

export type RouteAuditArgs = {
  waypoints: LatLon[];
  /** giờ chạy cộng dồn tới từng waypoint (cùng độ dài `waypoints`) */
  hoursAt: number[];
  departMs: number;
  draftM: number | null;
  /** sóng (m) tại waypoint i lúc tàu tới — cho UKC */
  waveMAt?: (i: number) => number | null;
  stores: RouteAuditStores;
};

/* ── NGƯỠNG ──────────────────────────────────────────────────────────────── */

/**
 * Thang mức cho hiểm hoạ chặn, TÍNH TỪ MÉP vòng chặn r (tuyến đã né nên
 * không bao giờ đi trong r): đỏ ≤ r + 0,5 km (tuyến bám sát mép — vị trí
 * nguồn lệch vài trăm m là chạm) · vàng ≤ r + 1 · tin ≤ r + 2. Giàn khoan
 * r = 1 km ⇒ vàng tới 2 km, đúng đề bài, không cần ngoại lệ.
 */
const HAZARD_DO_PAD_KM = 0.5;
const HAZARD_VANG_PAD_KM = 1;
const HAZARD_TIN_PAD_KM = 2;
const PASSABLE_TIN_KM = 1;
const NO_GO_LINE_KM = 0.5;
const RESTRICT_LINE_KM = 0.3;
const CABLE_CROSS_KM = 0.1;
const SOUNDING_KM = 0.5;
const FAIRWAY_KM = 0.5;
const REEF_NAME_KM = 3;
const AID_CORRIDOR_KM = 1;
const AID_MAX_LINES = 8;
const BORDER_STEP_KM = 5;
const BORDER_DO_NM = 6;
const TIDE_MAX_KM = 120;
const SAMPLE_KM = 0.5;
const NM_KM = 1.852;

/* ── CHỮ ─────────────────────────────────────────────────────────────────── */

const soViet = (v: number, le = 1): string => {
  const k = 10 ** le;
  return String(Math.round(v * k) / k).replace(".", ",");
};

/** < 1 km nói mét (tròn 50), xa hơn nói hải lý. */
export function khoangCachText(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 0.975) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  const nm = km / NM_KM;
  return nm < 10 ? `${soViet(nm)} hải lý` : `${Math.round(nm)} hải lý`;
}

/** "2026-03-14" → "3/2026"; chuỗi lạ → "". */
function thangNam(iso: string | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  return m ? `${Number(m[2])}/${m[1]}` : "";
}

const MUC_RANK: Record<RouteHitMuc, number> = { do: 3, vang: 2, tin: 1 };

/* ── HÌNH HỌC TUYẾN ──────────────────────────────────────────────────────── */

type RouteGeom = {
  wps: LatLon[];
  /** km cộng dồn tới từng waypoint */
  cum: number[];
  totalKm: number;
  hoursAt: number[] | null;
};

function routeGeom(waypoints: LatLon[], hoursAt: number[]): RouteGeom | null {
  const wps = (waypoints ?? []).filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon),
  );
  if (wps.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < wps.length; i++) cum.push(cum[i - 1] + haversineKm(wps[i - 1], wps[i]));
  const hoursOk =
    Array.isArray(hoursAt) &&
    hoursAt.length === waypoints.length &&
    wps.length === waypoints.length &&
    hoursAt.every((h) => Number.isFinite(h));
  return { wps, cum, totalKm: cum[cum.length - 1], hoursAt: hoursOk ? hoursAt : null };
}

/** Giờ chạy tới km thứ `along` — nội suy tuyến tính giữa hai waypoint kề. */
function etaAt(g: RouteGeom, along: number): number | null {
  if (!g.hoursAt) return null;
  const k = Math.max(0, Math.min(g.totalKm, along));
  for (let i = 1; i < g.cum.length; i++) {
    if (k <= g.cum[i] || i === g.cum.length - 1) {
      const len = g.cum[i] - g.cum[i - 1];
      const t = len > 0 ? Math.max(0, Math.min(1, (k - g.cum[i - 1]) / len)) : 0;
      return g.hoursAt[i - 1] + (g.hoursAt[i] - g.hoursAt[i - 1]) * t;
    }
  }
  return g.hoursAt[g.hoursAt.length - 1];
}

/** Chặng (chỉ số waypoint đầu chặng) chứa km thứ `along`. */
function segAt(g: RouteGeom, along: number): number {
  for (let i = 1; i < g.cum.length; i++) if (along <= g.cum[i]) return i - 1;
  return g.cum.length - 2;
}

type Near = { km: number; alongKm: number; seg: number; /** +1 trái · −1 phải · 0 trên tuyến */ side: number };

/** Điểm gần tuyến nhất — quét hết chặng (tuyến ≤ vài trăm chặng, rẻ). */
function nearestOnRoute(g: RouteGeom, p: LatLon): Near {
  let best: Near = { km: Infinity, alongKm: 0, seg: 0, side: 0 };
  for (let i = 0; i + 1 < g.wps.length; i++) {
    const a = g.wps[i];
    const b = g.wps[i + 1];
    const d = distToSegment(p, a, b);
    if (d.km < best.km) {
      const cross = (b.lon - a.lon) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lon - a.lon);
      best = { km: d.km, alongKm: g.cum[i] + d.alongKm, seg: i, side: Math.sign(cross) };
    }
  }
  return best;
}

type Sample = { p: LatLon; along: number; seg: number };

/** Rải mẫu dọc tuyến kèm km cộng dồn (pathPoints không trả along). */
function samples(g: RouteGeom, stepKm: number): Sample[] {
  const out: Sample[] = [{ p: g.wps[0], along: 0, seg: 0 }];
  for (let s = 0; s + 1 < g.wps.length; s++) {
    const a = g.wps[s];
    const b = g.wps[s + 1];
    const len = g.cum[s + 1] - g.cum[s];
    const n = Math.max(1, Math.ceil(len / stepKm));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      out.push({
        p: { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t },
        along: g.cum[s] + len * t,
        seg: s,
      });
    }
  }
  return out;
}

/* ── PHỤ TRỢ KHO ─────────────────────────────────────────────────────────── */

type LaneProps = { kind?: string; loai?: string; ten?: string; hoDang?: boolean };
const laneProps = (f: GeoJSON.Feature): LaneProps => (f?.properties ?? {}) as LaneProps;

function lineOf(f: GeoJSON.Feature): LatLon[] {
  const g = f.geometry;
  const out: LatLon[] = [];
  if (!g) return out;
  const push = (c: unknown) => {
    if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
      out.push({ lat: c[1] as number, lon: c[0] as number });
  };
  if (g.type === "LineString") g.coordinates.forEach(push);
  else if (g.type === "Polygon") g.coordinates[0]?.forEach(push);
  return out;
}

function lineSegments<R>(line: readonly LatLon[], ref: R, into: Segment<R>[]): void {
  for (let i = 0; i + 1 < line.length; i++) into.push({ a: line[i], b: line[i + 1], ref });
}

/** Tên bãi/đá/rạn (coral-reefs Point) trong `REEF_NAME_KM` — chỉ để gọi tên. */
function tenBaiGan(reefs: readonly GeoJSON.Feature[] | undefined, p: LatLon): string | null {
  if (!reefs) return null;
  let best: string | null = null;
  let bestKm = REEF_NAME_KM;
  for (const f of reefs) {
    const g = f?.geometry;
    if (!g || g.type !== "Point") continue;
    const [lon, lat] = g.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const name = (f.properties as { name?: string } | null)?.name;
    if (!name) continue;
    // hộp thô trước, haversine sau — 1.372 điểm × vài chục lượt hỏi
    if (Math.abs(lat - p.lat) > 0.05 || Math.abs(lon - p.lon) > 0.05) continue;
    const km = haversineKm(p, { lat, lon });
    if (km < bestKm) {
      bestKm = km;
      best = name;
    }
  }
  return best;
}

type TideAt = { heightM: number; model: boolean } | null;

/** Mực triều tại chỗ + giờ tàu tới; null khi không có trạm ≤120 km hoặc không biết giờ. */
function tideAt(
  tides: readonly TideStation[] | undefined,
  p: LatLon,
  departMs: number,
  etaH: number | null,
): TideAt {
  if (!tides || !tides.length || etaH === null || !Number.isFinite(departMs)) return null;
  const near = nearestTideStation(tides, p.lat, p.lon);
  if (!near || near.distanceKm > TIDE_MAX_KM) return null;
  const h = tideHeightAt(near.station, departMs + etaH * 3600_000);
  if (!Number.isFinite(h)) return null;
  return { heightM: h, model: isModelStation(near.station) };
}

/**
 * So độ sâu hải đồ (số 0 hải đồ) với mức tàu cần. Trả câu + có thiếu nước
 * không, hoặc null khi đủ nước rộng rãi (không đáng nói). `chuDau` mở câu:
 * "Chỗ này" (số đo điểm) hay "Luồng X, chỗ nông nhất" (đoạn luồng).
 */
function soDoSau(
  chartM: number,
  needM: number,
  tide: TideAt,
  ngay: string,
  ten: string | null,
  chuDau = "Chỗ này",
): { thieu: boolean; cau: string } | null {
  const noiDo = ngay ? ` (số đo ${ngay})` : "";
  const oDau = ten ? ` gần ${ten}` : "";
  const can = `tàu cần ${soViet(needM)} m`;
  if (tide) {
    const water = chartM + tide.heightM;
    const uoc = tide.model ? " (ước tính)" : "";
    if (water < needM) {
      return {
        thieu: true,
        cau: `${chuDau}${oDau} nước còn chừng ${soViet(water)} m${uoc} lúc tàu tới${noiDo}, ${can} — chờ nước lên hãy qua.`,
      };
    }
    if (water < needM + 1) {
      return {
        thieu: false,
        cau: `${chuDau}${oDau} nước chừng ${soViet(water)} m${uoc} lúc tàu tới${noiDo}, ${can} — vừa đủ, canh con nước.`,
      };
    }
    return null;
  }
  // không có trạm triều đủ gần: chỉ nói số hải đồ, KHÔNG bịa mực nước
  if (chartM < needM) {
    return {
      thieu: true,
      cau: `${chuDau}${oDau} hải đồ ghi ${soViet(chartM)} m${noiDo}, ${can} — chưa tính con nước chỗ này, canh nước lên hãy qua.`,
    };
  }
  return null;
}

/** Mẫu tuyến đầu tiên cách đường gấp khúc `line` ≤ `km` — km cộng dồn + khoảng cách, hoặc null. */
function nearLine(
  line: readonly LatLon[],
  pts: readonly Sample[],
  km: number,
): { along: number; km: number } | null {
  let best: { along: number; km: number } | null = null;
  for (let i = 0; i + 1 < line.length; i++) {
    for (const s of pts) {
      const d = distToSegment(s.p, line[i], line[i + 1]).km;
      if (d <= km && (!best || d < best.km)) best = { along: s.along, km: d };
    }
  }
  return best;
}

/** Loại báo hiệu đáng nói "sẽ gặp" — phao hiểm hoạ cô lập đã là hazard; phao ảo, cảng, trụ buộc, vùng neo: bỏ. */
const AID_TYPES = new Set([
  "buoy_lateral",
  "buoy_cardinal",
  "buoy_safe_water",
  "buoy_special_purpose",
  "buoy_installation",
  "beacon",
  "beacon_lateral",
  "beacon_cardinal",
  "beacon_safe_water",
  "beacon_special_purpose",
  "light",
  "light_major",
  "light_minor",
  "light_vessel",
  "light_float",
]);

/* ── HẬU KIỂM ────────────────────────────────────────────────────────────── */

/**
 * Soi tuyến đã vẽ trên mọi kho có trong máy. Chạy ở main thread SAU khi có
 * tuyến (kể cả nhánh capped/direct). Thuần, không ném khi kho thiếu.
 */
export function auditRoute(args: RouteAuditArgs): { hits: RouteHit[]; missing: string[] } {
  const missing: string[] = [];
  const hits: RouteHit[] = [];
  const st = args?.stores ?? {};
  const g = routeGeom(args?.waypoints ?? [], args?.hoursAt ?? []);
  if (!g) return { hits, missing: ["tuyen"] };

  const draftM = Number.isFinite(args.draftM) && (args.draftM as number) > 0 ? args.draftM : null;
  const waveMAt = typeof args.waveMAt === "function" ? args.waveMAt : () => null;
  const needAt = (seg: number): number | null =>
    draftM === null ? null : requiredDepthM(draftM, waveMAt(seg));
  const push = (h: Omit<RouteHit, "etaH">) => hits.push({ ...h, etaH: etaAt(g, h.alongKm) });

  /* 1. hiểm hoạ chặn — tuyến đã né, nên phần lớn là "vang"/"tin" */
  if (!st.hazards) missing.push("hiem-hoa");
  else {
    for (const h of st.hazards) {
      if (!h || !Number.isFinite(h.lat) || !Number.isFinite(h.lon)) continue;
      const n = nearestOnRoute(g, h);
      const r = Number.isFinite(h.rKm) && h.rKm > 0 ? h.rKm : 0;
      let muc: RouteHitMuc | null = null;
      if (n.km <= r + HAZARD_DO_PAD_KM) muc = "do";
      else if (n.km <= r + HAZARD_VANG_PAD_KM) muc = "vang";
      else if (n.km <= r + HAZARD_TIN_PAD_KM) muc = "tin";
      if (!muc) continue;
      const bai = h.ten ? null : tenBaiGan(st.reefs, h);
      const mo = moTaHazard(h) + (bai ? ` (gần ${bai})` : "");
      const cach = khoangCachText(n.km);
      const cau =
        muc === "do"
          ? `Tuyến đi sát ${mo} — cách tuyến chừng ${cach}.`
          : muc === "vang"
            ? `${mo} — cách tuyến chừng ${cach}.`
            : `Gần tuyến có ${mo} — cách chừng ${cach}.`;
      push({ id: h.id, loai: h.loai, ten: h.ten, km: n.km, alongKm: n.alongKm, muc, cau });
    }
  }

  /* 2. xác tàu qua được — chỉ tin, kèm nước trên vật */
  if (st.passable) {
    for (const h of st.passable) {
      if (!h || !Number.isFinite(h.lat) || !Number.isFinite(h.lon)) continue;
      // "qua được" chỉ có nghĩa khi CÓ số nước trên vật — thiếu số thì không bịa "0 m" (review G2)
      if (h.doSauM == null || !Number.isFinite(h.doSauM)) continue;
      const n = nearestOnRoute(g, h);
      if (n.km > PASSABLE_TIN_KM) continue;
      const need = needAt(n.seg);
      const ten = h.ten ? `${hazardLabel(h.loai)} ${h.ten}` : hazardLabel(h.loai);
      const canM = need !== null ? `, tàu cần ${soViet(need)} m` : "";
      const gan = h.tinVua ? " (vị trí gần đúng)" : "";
      push({
        id: h.id,
        loai: h.loai,
        ten: h.ten,
        km: n.km,
        alongKm: n.alongKm,
        muc: "tin",
        cau: `${ten}${gan} cách tuyến chừng ${khoangCachText(n.km)} — nước trên vật ${soViet(h.doSauM)} m${canM}, qua được.`,
      });
    }
  }

  /* 3. vùng cấm / cáp / ống — từ vn-sea-lanes */
  if (!st.lanes) missing.push("sea-lanes");
  else {
    const pts = samples(g, SAMPLE_KM);
    const ng = noGoFromLanes(st.lanes);

    // 3a. cấm vào: đa giác — tuyến đi vào (PIP) hoặc sát ranh (≤ đệm) → đỏ
    for (const z of ng.zones) {
      let first: Sample | null = null;
      let firstKm = Infinity;
      const edges: Segment<null>[] = [];
      lineSegments(z.ring.map(([lon, lat]) => ({ lat, lon })), null, edges);
      edges.push({ a: edges[edges.length - 1].b, b: edges[0].a, ref: null });
      const padDeg = (NO_GO_PAD_KM / 111) * 1.01;
      for (const s of pts) {
        if (
          s.p.lat < z.bbox.latMin - padDeg ||
          s.p.lat > z.bbox.latMax + padDeg ||
          s.p.lon < z.bbox.lonMin - padDeg ||
          s.p.lon > z.bbox.lonMax + padDeg
        )
          continue;
        let km = Infinity;
        if (pointInRing(s.p, z.ring)) km = 0;
        else for (const e of edges) km = Math.min(km, distToSegment(s.p, e.a, e.b).km);
        if (km <= NO_GO_PAD_KM && km < firstKm) {
          first = s;
          firstKm = km;
          if (km === 0) break;
        }
      }
      if (!first) continue;
      const ten = z.ten ?? "khu cấm vào";
      push({
        id: z.id,
        loai: "cam-vao",
        ten: z.ten,
        km: firstKm,
        alongKm: first.along,
        muc: "do",
        cau:
          firstKm === 0
            ? `Tuyến đi vào ${ten} — khu cấm vào, không được đi qua.`
            : `Tuyến chạy sát ${ten} (cách chừng ${khoangCachText(firstKm)}) — khu cấm vào.`,
      });
    }

    // 3b. cấm vào ranh hở (LineString) ≤ 500 m → vàng
    for (const l of ng.hoDang) {
      const best = nearLine(l.line, pts, NO_GO_LINE_KM);
      if (!best) continue;
      push({
        id: l.id,
        loai: "cam-vao-ho",
        ten: l.ten,
        km: best.km,
        alongKm: best.along,
        muc: "vang",
        cau: `Tuyến chạy gần ${l.ten ?? "khu cấm vào"} (cách chừng ${khoangCachText(best.km)}) — ranh khu này chưa rõ hết, giữ khoảng cách.`,
      });
    }

    // 3c. cáp ngầm / ống dẫn cắt tuyến → MỘT dòng vàng gộp
    const cableSegs: Segment<"cap" | "ong">[] = [];
    const restrict: { ten: string; line: LatLon[]; polygon: boolean }[] = [];
    const RESTRICT_LABEL: Record<string, string> = {
      "cam-neo": "khu cấm neo",
      "cam-danh-bat": "khu cấm đánh bắt",
      "han-che": "khu hạn chế",
    };
    st.lanes.forEach((f) => {
      const p = laneProps(f);
      if (p.kind === "cap" || p.kind === "ong") lineSegments(lineOf(f), p.kind, cableSegs);
      else if (p.kind === "vungcam" && p.loai && RESTRICT_LABEL[p.loai]) {
        const line = lineOf(f);
        if (line.length >= 2)
          restrict.push({
            ten: p.ten || RESTRICT_LABEL[p.loai],
            line,
            polygon: f.geometry?.type === "Polygon" && line.length >= 3,
          });
      }
    });
    if (cableSegs.length) {
      const sx = buildSegmentIndex(cableSegs);
      const cross = segmentsWithinCorridor(sx, g.wps, CABLE_CROSS_KM);
      if (cross.length) {
        const kmOf = (loai: "cap" | "ong") =>
          [...new Set(cross.filter((c) => c.seg.ref === loai).map((c) => Math.round(c.alongKm)))].sort((a, b) => a - b);
        const cap = kmOf("cap");
        const ong = kmOf("ong");
        const parts: string[] = [];
        if (cap.length) parts.push(`cáp ngầm ở km ${cap.join(", ")}`);
        if (ong.length) parts.push(`ống dẫn ở km ${ong.join(", ")}`);
        push({
          id: "cap-ong",
          loai: "cap-ong",
          ten: null,
          km: 0,
          alongKm: cross[0].alongKm,
          muc: "vang",
          cau: `Tuyến cắt ${parts.join(" và ")} — chạy qua được, đừng neo, đừng thả giã ở đó.`,
        });
      }
    }

    // 3d. cấm neo / cấm đánh bắt / hạn chế tuyến đi qua → MỘT dòng vàng gộp
    if (restrict.length) {
      const ten: string[] = [];
      let along = Infinity;
      for (const r of restrict) {
        let hitAlong: number | null = null;
        if (r.polygon) {
          const ring = r.line.map((p) => [p.lon, p.lat] as [number, number]);
          const lats = r.line.map((p) => p.lat);
          const lons = r.line.map((p) => p.lon);
          const latMin = Math.min(...lats);
          const latMax = Math.max(...lats);
          const lonMin = Math.min(...lons);
          const lonMax = Math.max(...lons);
          for (const s of pts) {
            if (s.p.lat < latMin || s.p.lat > latMax || s.p.lon < lonMin || s.p.lon > lonMax) continue;
            if (pointInRing(s.p, ring)) {
              hitAlong = s.along;
              break;
            }
          }
        } else {
          hitAlong = nearLine(r.line, pts, RESTRICT_LINE_KM)?.along ?? null;
        }
        if (hitAlong === null) continue;
        along = Math.min(along, hitAlong);
        if (!ten.includes(r.ten)) ten.push(r.ten);
      }
      if (ten.length) {
        push({
          id: "vung-han-che",
          loai: "vung-han-che",
          ten: null,
          km: 0,
          alongKm: along,
          muc: "vang",
          cau: `Tuyến chạy qua ${ten.join("; ")} — chạy qua được, đừng dừng, đừng neo, đừng thả lưới ở đó.`,
        });
      }
    }
  }

  /* 4. số đo sâu ≤ 0,5 km — chỉ khi biết mớn */
  if (!st.soundings) missing.push("so-do-sau");
  else if (draftM !== null) {
    if (!st.verdicts) missing.push("doi-chieu");
    if (!st.tides) missing.push("thuy-trieu");
    const byKm = new Map<number, { hit: Omit<RouteHit, "etaH">; rank: number }>();
    st.soundings.forEach((s, i) => {
      if (!s || !Number.isFinite(s.lat) || !Number.isFinite(s.lon) || !Number.isFinite(s.depthM)) return;
      if (st.verdicts?.get(verdictKey(0, "diem", i))?.kq === SUSPECT) return;
      const n = nearestOnRoute(g, s);
      if (n.km > SOUNDING_KM) return;
      const need = needAt(n.seg);
      if (need === null) return;
      const eta = etaAt(g, n.alongKm);
      const r = soDoSau(s.depthM, need, tideAt(st.tides, s, args.departMs, eta), thangNam(s.at), tenBaiGan(st.reefs, s));
      if (!r) return;
      const rank = r.thieu ? 3 + (need - s.depthM) : 1;
      const bin = Math.floor(n.alongKm);
      const cur = byKm.get(bin);
      if (cur && cur.rank >= rank) return;
      byKm.set(bin, {
        rank,
        hit: {
          id: `sd:${i}`,
          loai: "do-sau",
          ten: null,
          km: n.km,
          alongKm: n.alongKm,
          muc: r.thieu ? "do" : "tin",
          cau: r.cau,
        },
      });
    });
    for (const v of byKm.values()) push(v.hit);
  }

  /* 5. luồng — độ sâu khống chế, tin có ngày; thiếu nước (biết mớn) → vàng */
  if (!st.fairways) missing.push("luong");
  else {
    const segs: Segment<FairwayDepth>[] = st.fairways
      .filter((f) => f && f.tu && f.den)
      .map((f) => ({ a: f.tu, b: f.den, ref: f }));
    /*  Chỉ số dựng MỘT lần (O1 2026-09-04): `indexOf` trong vòng kết quả là
        O(luồng × hit). Giữ chỉ số ĐẦU TIÊN y như `indexOf` để id không đổi. */
    const fairwayIdx = new Map<FairwayDepth, number>();
    st.fairways.forEach((f, i) => {
      if (f && !fairwayIdx.has(f)) fairwayIdx.set(f, i);
    });
    if (segs.length) {
      const sx = buildSegmentIndex(segs);
      for (const h of segmentsWithinCorridor(sx, g.wps, FAIRWAY_KM)) {
        const f = h.seg.ref;
        const ngay = thangNam(f.at);
        const ten = f.ten || f.route?.ten || "luồng";
        const seg = segAt(g, h.alongKm);
        const need = needAt(seg);
        const gan = f.xapXi ? " (vị trí gần đúng)" : "";
        let muc: RouteHitMuc = "tin";
        let cau = `Luồng ${ten}${gan}: chỗ nông nhất ${soViet(f.sauM)} m${ngay ? ` (đo ${ngay})` : ""}.`;
        if (need !== null) {
          const mid = { lat: (f.tu.lat + f.den.lat) / 2, lon: (f.tu.lon + f.den.lon) / 2 };
          const r = soDoSau(
            f.sauM,
            need,
            tideAt(st.tides, mid, args.departMs, etaAt(g, h.alongKm)),
            ngay,
            null,
            `Luồng ${ten}${gan}, chỗ nông nhất`,
          );
          if (r?.thieu) {
            muc = "vang";
            cau = r.cau;
          }
        }
        push({ id: `lg:${fairwayIdx.get(f)}`, loai: "luong", ten, km: h.km, alongKm: h.alongKm, muc, cau });
      }
    }
  }

  /* 6. phao / tiêu / đèn trong hành lang 1 km — tin, ≤ 8 dòng theo thứ tự gặp */
  if (!st.seamarks) missing.push("seamarks");
  if (!st.vnAids) missing.push("vn-aids");
  {
    type Aid = { m: Seamark; ten: string | null; tacDung: string | null; chinhThuc: boolean };
    const aids: Aid[] = [];
    for (const a of st.vnAids ?? []) {
      if (!a || !AID_TYPES.has(String(a.type))) continue;
      // vn-aids ghi tên giữ chỗ "Báo hiệu (chưa rõ số hiệu)" khi nguồn không đọc được số — không phải tên
      const ten = a.ten && !/chưa rõ/i.test(a.ten) ? a.ten : null;
      aids.push({ m: a, ten, tacDung: a.tacDung, chinhThuc: true });
    }
    for (const m of st.seamarks ?? []) if (m && AID_TYPES.has(String(m.type))) aids.push({ m, ten: null, tacDung: null, chinhThuc: false });
    if (aids.length) {
      const ix = buildIndex(aids, (a) => a.m);
      // `aids` vừa dựng ở trên, mỗi object một lần ⇒ chỉ số này = `indexOf` (O1 2026-09-04)
      const aidIdx = new Map<Aid, number>(aids.map((a, i) => [a, i]));
      const found = queryCorridor(ix, g.wps, AID_CORRIDOR_KM);
      // OSM và Cục Hàng hải cùng vẽ một cái phao → giữ bản nhà nước
      const kept = found.filter(
        (h) =>
          h.item.chinhThuc ||
          !found.some((o) => o.item.chinhThuc && haversineKm(o.item.m, h.item.m) < 0.05),
      );
      const lines = kept.length > AID_MAX_LINES ? kept.slice(0, AID_MAX_LINES - 1) : kept;
      lines.forEach((h) => {
        const a = h.item;
        const n = nearestOnRoute(g, a.m);
        const ben = n.side > 0 ? "bên trái" : n.side < 0 ? "bên phải" : "trên";
        const dau = a.ten ? `${a.ten} (${seamarkLabel(String(a.m.type))})` : describeSeamark(a.m);
        const huong = huongDiQuaPhao(a.m, a.tacDung ?? undefined);
        push({
          id: `aid:${aidIdx.get(a)}`,
          loai: "phao",
          ten: a.ten,
          km: h.km,
          alongKm: h.alongKm,
          muc: "tin",
          cau: `${dau} — ${ben} tuyến chừng ${khoangCachText(h.km)}${huong ? `. ${huong}` : ""}.`,
        });
      });
      if (kept.length > AID_MAX_LINES) {
        const rest = kept.slice(AID_MAX_LINES - 1);
        push({
          id: "aid:them",
          loai: "phao",
          ten: null,
          km: rest[0].km,
          alongKm: rest[0].alongKm,
          muc: "tin",
          cau: `…và ${rest.length} phao, tiêu nữa dọc tuyến.`,
        });
      }
    }
  }

  /* 7. ranh giới VMS — mẫu 5 km, ≤ 6 hải lý → đỏ (không phạt, không chặn) */
  if (st.border === undefined) missing.push("ranh-gioi");
  else if (st.border) {
    let worst: { s: Sample; nm: number; outside: boolean } | null = null;
    for (const s of samples(g, BORDER_STEP_KM)) {
      const b = borderProximity(s.p.lat, s.p.lon);
      if (!b.applies) continue;
      if (b.outside) {
        if (!worst || !worst.outside || b.distanceNm > worst.nm) worst = { s, nm: b.distanceNm, outside: true };
      } else if (b.distanceNm <= BORDER_DO_NM && (!worst || (!worst.outside && b.distanceNm < worst.nm))) {
        worst = { s, nm: b.distanceNm, outside: false };
      }
    }
    if (worst) {
      push({
        id: "ranh-gioi",
        loai: "ranh-gioi",
        ten: null,
        km: worst.nm * NM_KM,
        alongKm: worst.s.along,
        muc: "do",
        cau: worst.outside
          ? `Tuyến có đoạn nằm ngoài ranh giới biển theo vùng VMS (vào trong chừng ${soViet(worst.nm)} hải lý) — xem lại điểm ghé.`
          : `Tuyến chạy sát ranh giới biển (còn chừng ${soViet(worst.nm)} hải lý) — canh vị trí khi tới đoạn này.`,
      });
    }
  }

  if (!st.reefs) missing.push("bai-can");

  /* 8. con nước ở HAI ĐẦU tuyến (2026-09-04) — lúc xuất phát và lúc tới đích.
     Cùng luật với số đo sâu: chỉ nói khi BIẾT MỚN (draftM null ⇒ im), chỉ in
     số khi có trạm ≤ 120 km. Không đổi tuyến, không phán "đi/không đi": đang
     là lúc nước ròng thì VÀNG "chờ nước lên", còn lại là TIN để đối chiếu. */
  if (draftM !== null && st.tides && st.tides.length) {
    const last = g.wps.length - 1;
    const etaDen = g.hoursAt ? g.hoursAt[last] : null;
    const dau: { p: LatLon; etaH: number | null; den: boolean; along: number }[] = [
      { p: g.wps[0], etaH: 0, den: false, along: 0 },
      { p: g.wps[last], etaH: Number.isFinite(etaDen) ? etaDen : null, den: true, along: g.totalKm },
    ];
    for (const d of dau) {
      if (d.etaH === null) continue;
      const near = nearestTideStation(st.tides, d.p.lat, d.p.lon);
      if (!near || near.distanceKm > TIDE_MAX_KM) continue;
      const ms = args.departMs + d.etaH * 3600_000;
      const h = tideHeightAt(near.station, ms);
      if (!Number.isFinite(h) || !Number.isFinite(ms)) continue;
      const uoc = isModelStation(near.station) ? " (ước tính)" : "";
      const ten = near.station.name;
      const xuHuong = tideTrendText(tideTrendAt(near.station, ms)).toLowerCase();
      // con nước ròng trong ±90 phút quanh giờ đó = đang là lúc nước ròng
      const rong = tideExtremesForDay(near.station, vnIsoDate(ms)).find(
        (e) => e.kind === "low" && Math.abs(e.atMs - ms) <= 90 * 60_000,
      );
      const lon = tideUpcoming(near.station, ms, 2).find((u) => u.kind === "high");
      const lonSau = lon ? ` Nước lớn ${lon.ngayMai ? "mai " : ""}lúc ${tideClockText(lon.atMs)} (${soViet(lon.heightM)} m).` : "";
      const mo = d.den ? `Tới đích chừng ${tideClockText(ms)}, con nước ở ${ten}` : `Lúc xuất phát, con nước ở ${ten}`;
      push({
        id: d.den ? "trieu:den" : "trieu:di",
        loai: "con-nuoc",
        ten,
        km: near.distanceKm,
        alongKm: d.along,
        muc: rong ? "vang" : "tin",
        cau: rong
          ? `${mo}: đang là lúc nước ròng, còn chừng ${soViet(h)} m${uoc} — ${d.den ? "chờ nước lên hãy vào bến" : "ra cửa cạn thì chờ nước lên"}.${lonSau}`
          : `${mo}: ${soViet(h)} m${uoc}, ${xuHuong}.${lonSau}`,
      });
    }
  }

  /* sắp theo thứ tự gặp; mỗi id một lần — giữ mức nặng hơn, rồi gần hơn */
  const byId = new Map<string, RouteHit>();
  for (const h of hits) {
    const cur = byId.get(h.id);
    if (!cur || MUC_RANK[h.muc] > MUC_RANK[cur.muc] || (h.muc === cur.muc && h.km < cur.km)) byId.set(h.id, h);
  }
  const out = [...byId.values()].sort((a, b) => a.alongKm - b.alongKm);
  return { hits: out, missing };
}
