/**
 * CẢNH BÁO HIỂM HOẠ KHI ĐANG CHẠY (dẫn đường live) — THUẦN LOGIC, không GPS,
 * không React, không âm thanh. Mỗi fix GPS gọi `evaluateNavHazards(prev, input)`
 * một lần, nhận về ≤2 câu để in lên HUD + cờ có kêu chuông/rung hay không.
 * Phát tiếng ở `warning-sound.ts` (`playHazardWarning`), rung ở `haptics.ts`,
 * nối vào bản đồ ở khối điều phối fishing-map-view (Đợt 3, N4).
 *
 * VÌ SAO TÁCH RA FILE THUẦN: cảnh báo tính mạng phải chạy được ở jsdom/CI, đo
 * được bằng test (đúng 2 lần mỗi vật, ≤1 chuông/20 s, im khi neo…) mà không
 * cần bản đồ, không cần lưới độ sâu 8,5 MB. Mọi thứ nặng (chỉ mục, lưới, cáp)
 * đều đi vào qua tham số: `ix` là chỉ mục điểm đã dựng, `depthAt` là hàm tra
 * lớp độ sâu, `nearestCableKm`/`insideRestricted` do nơi gọi tính sẵn.
 *
 * ── LUẬT (quyet-dinh-thiet-ke §1.10, de-xuat-B §3) ──────────────────────────
 *  · Ngưỡng = max(sàn, tốc độ × phút) + sai số GPS: VÀNG 10 phút / sàn 2 km,
 *    ĐỎ 3 phút / sàn 500 m. Tốc độ chưa biết → lấy sàn.
 *  · 4 bậc: 1 tính mạng (đỏ + chuông) · 2 ranh giới (chỗ khác lo, không phát
 *    lại ở đây) · 3 tài sản/lưới (vàng + rung, không chuông) · 4 thông tin.
 *  · Mỗi vật nói TỐI ĐA 2 lần — mốc vàng rồi mốc đỏ — theo đúng khuôn
 *    `borderStepCrossed` (geofence.ts): chỉ nói khi VƯỢT SANG mốc gần hơn.
 *  · Chuông chung ≤1 lần/20 s, đỏ mới được miễn. Rung ≤1/30 s.
 *  · Neo (tốc độ null hoặc <0,9 km/h) liên tục >5 phút → im bậc 1 và 3.
 *  · GPS lệch >150 m → đỏ hạ vàng, thêm "(định vị lệch ±X m)"; >500 m → im
 *    hẳn (ranh giới do chỗ khác lo). Mất GPS → giữ câu cuối, không chuông.
 *  · Cáp ngầm / vùng cấm neo: chỉ nói khi chạy chậm (<3 kn = 5,6 km/h) và
 *    ≤500 m; lặp lại tối đa 10 phút một lần.
 *  · Gom cụm: ≥2 vật cùng bậc cách nhau ≤1 km → một câu chung.
 *  · Trần mỗi lần: 1 câu đỏ + 1 câu vàng/tin; `alerts[0]` là câu nặng nhất.
 *
 * Câu chữ nằm Ở ĐÂY (không ở component): giọng trung tính, "chừng", không
 * "bẻ lái ngay", không "an toàn". App không ra lệnh, không phán — chỉ nói
 * có gì ở đâu, còn bao xa.
 */

import { distToSegment, queryRadius, type SpatialIndex } from "@/lib/spatial-index";
// MỘT cửa cho pointInRing (spatial-index) — không kéo cả module bão vào đường dẫn đường vì một hàm
import { pointInRing } from "@/lib/spatial-index";
import {
  angleDiffDeg,
  bearingDeg,
  haversineKm,
  type LatLon,
} from "@/lib/route-plan";
import { MIN_MOVING_KMH } from "@/lib/nav-progress";

// ── hằng số (đọc doc 07 §10.7 trước khi đổi) ─────────────────────────────

/** Mốc phút [vàng, đỏ]: cảnh báo khi còn chừng này phút nữa thì tới vật. */
export const NAV_HAZARD_STEPS_MIN = [10, 3] as const;
/** Sàn km [vàng, đỏ] — tàu chạy chậm/đứng vẫn phải được nhắc từ khoảng này. */
export const NAV_HAZARD_FLOOR_KM = [2, 0.5] as const;
/** Chuông chung: tối thiểu 20 s giữa hai tiếng (đỏ mới được miễn). */
export const NAV_CHIME_COOLDOWN_MS = 20_000;
/** Rung: tối thiểu 30 s giữa hai lần. */
export const NAV_RUNG_COOLDOWN_MS = 30_000;
/** Đứng/neo liên tục quá ngần này → im bậc 1 và 3. */
export const NAV_ANCHOR_MS = 5 * 60 * 1000;
/** Dưới tốc độ này (3 hải lý/giờ) mới nói chuyện cáp ngầm / cấm neo. */
export const NAV_SLOW_KMH = 5.6;
/** Cáp / cấm neo: nhắc lại tối đa 10 phút một lần khi vẫn đang trên đó. */
export const NAV_SLOW_REPEAT_MS = 10 * 60 * 1000;
/** Quên một vật đã nói sau ngần này (để quay lại chỗ đó sau vẫn được nhắc). */
export const NAV_FORGET_MS = 30 * 60 * 1000;
/**
 * SÀN bán kính hỏi chỉ mục điểm quanh tàu (km) — hơn sàn vàng 2 km + GPS lệch.
 * Bán kính THẬT mỗi lượt là `max(sàn này, ngưỡng vàng + NAV_QUERY_PAD_KM)`, xem
 * `navQueryKm`.
 */
export const NAV_QUERY_KM = 3.7;
/**
 * Biên cộng vào ngưỡng vàng khi hỏi chỉ mục (km). Ngưỡng đo tới MÉP vật
 * (`km − rKm`) nên TÂM vật nằm xa hơn mép đúng bằng bán kính vòng chặn: hỏi sát
 * ngưỡng là bỏ sót đúng những vật to nhất. 1,5 km = vòng lớn nhất trong kho
 * (giàn khoan 1 km · xác tàu tin vừa 2 × 0,5 km) cộng một ô lưới độ sâu 0,45 km.
 * Sai số GPS đã nằm trong ngưỡng (`navThresholdsKm`) nên không cộng lại ở đây.
 */
export const NAV_QUERY_PAD_KM = 1.5;

/**
 * Bán kính hỏi chỉ mục cho ngưỡng vàng `thrVangKm` này.
 *
 * Vì sao KHÔNG để hằng 3,7 km như trước (sửa 2026-09-04, review đợt 4 N2):
 * ngưỡng vàng là `max(2 km, tốc độ × 10 phút) + GPS lệch`, nên tàu chạy trên
 * ~12 hải lý/giờ đã có ngưỡng vượt 3,7 km — vật ở đúng mốc 10 phút không nằm
 * trong kết quả hỏi, không được `observe`, và mốc 10 phút tụt xuống còn ~6,7
 * phút mà không ai thấy. Tàu vỏ thép 14–15 hl còn hụt nặng hơn. Hỏi rộng hơn
 * không đắt: chỉ mục là lưới ô, thêm vài ô mỗi lượt.
 */
export function navQueryKm(thrVangKm: number): number {
  return Number.isFinite(thrVangKm)
    ? Math.max(NAV_QUERY_KM, thrVangKm + NAV_QUERY_PAD_KM)
    : NAV_QUERY_KM;
}
/** Nón phía trước: 3 tia ±15°, mẫu mỗi 0,4 km (nhỏ hơn ô lưới độ sâu 450 m). */
export const NAV_CONE_HALF_DEG = 15;
export const NAV_CONE_STEP_KM = 0.4;
/** Vùng cấm vào: đỏ khi ≤500 m hoặc đang ở trong; vàng khi ≤1 hải lý. */
export const NAV_NOGO_RED_KM = 0.5;
export const NAV_NOGO_YELLOW_KM = 1.852;
/** Cáp / vùng cấm neo: chỉ nói khi ≤500 m. */
export const NAV_CABLE_KM = 0.5;
/** GPS lệch quá mức này: đỏ hạ vàng; quá mức sau: im hẳn. */
export const NAV_ACC_DOWNGRADE_M = 150;
export const NAV_ACC_MUTE_M = 500;
/** Gom cụm: vật cùng bậc cách nhau ≤1 km thì nói một câu. */
export const NAV_CLUSTER_KM = 1;
/** Khoảng cách tăng liên tiếp ngần này fix → coi như đã qua, không nói nữa. */
const AWAY_FIXES = 3;
const AWAY_EPS_KM = 0.02;

// ── kiểu vào/ra ───────────────────────────────────────────────────────────

/**
 * Vật cản dạng ĐIỂM — cấu trúc trùng hợp đồng `Hazard` ở hazards.ts (§3), khai
 * lại cục bộ để file này không phụ thuộc file đang được viết song song; nơi
 * gọi đưa thẳng `SpatialIndex<Hazard>` vào là khớp kiểu.
 */
export type HazardLike = {
  id: string;
  lat: number;
  lon: number;
  /** bán kính chặn, km (đã nhân ×2 nếu tin vừa) */
  rKm: number;
  loai: string;
  ten: string | null;
  /** nước trên vật (m) nếu Thông báo hàng hải ghi */
  doSauM: number | null;
  /** vị trí "theo phao"/tin cũ — câu chữ thêm "(vị trí gần đúng)" */
  tinVua: boolean;
};

/** Vùng cấm vào (Polygon) — cấu trúc trùng `NoGoZone` §3. */
export type NoGoLike = {
  id: string;
  ten: string | null;
  /** [lon, lat] theo GeoJSON */
  ring: [number, number][];
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number };
};

export type NavAlert = {
  id: string;
  /** 1 tính mạng · 2 ranh giới · 3 tài sản/lưới · 4 thông tin */
  bac: 1 | 2 | 3 | 4;
  muc: "do" | "vang" | "tin";
  cau: string;
  chuong: boolean;
  rung: boolean;
  /** khoảng cách tới MÉP vật (đã trừ bán kính), km; 0 = đang trong */
  distKm: number;
  /** còn chừng này phút thì tới — null khi chưa biết tốc độ/hướng hoặc vật không ở phía trước */
  etaMin: number | null;
};

export type NavHazardStatus = "tracking" | "lost" | "denied" | "idle";

export type NavHazardInput = {
  pos: LatLon;
  headingDeg: number | null;
  speedKmh: number | null;
  accuracyM: number | null;
  nowMs: number;
  draftM: number | null;
  /** độ sâu tàu cần (mớn + dự phòng) — null khi chưa khai mớn: lớp 3 coi như rất cạn */
  needM: number | null;
  status: NavHazardStatus;
  /** chỉ mục điểm (xác tàu, giàn khoan, phao hiểm hoạ, lồng bè…) — null khi kho chưa nạp */
  ix: SpatialIndex<HazardLike> | null;
  /** vùng cấm vào — null/[] khi không có */
  noGo: readonly NoGoLike[] | null;
  /**
   * Lớp độ sâu tại toạ độ theo thang MỚI 0..5 (0 đất · 1 rạn/đá · 2 <2 m ·
   * 3 2–4 m · 4 4–12 m · 5 sâu), null ngoài lưới. Nơi gọi bọc `depthClassAt`;
   * null khi lưới chưa nạp.
   */
  depthAt: ((lat: number, lon: number) => number | null) | null;
  /** cách cáp/ống ngầm gần nhất (km) — nơi gọi tính từ chỉ mục đoạn; null = không biết */
  nearestCableKm: number | null;
  /** tên vùng cấm neo/hạn chế đang ở trong — null khi không */
  insideRestricted: string | null;
  /** cách ranh giới (hải lý) — chỉ để xếp bậc/nhường chuông, KHÔNG phát lại câu ranh giới */
  borderNm: number | null;
  /** đổi km → chữ theo đơn vị bà con chọn (map-prefs); bỏ trống = "600 m" / "1,5 hải lý" */
  fmtDist?: (km: number) => string;
};

/** Một vật đã thấy: mốc đã nói, lần nói cuối, để quên/khử lặp. */
type SaidEntry = {
  /** 0 chưa nói · 1 đã nói mốc vàng · 2 đã nói mốc đỏ */
  step: 0 | 1 | 2;
  lastMs: number;
  lat: number;
  lon: number;
  lastKm: number;
  /** số fix liên tiếp khoảng cách tăng (đang đi ra xa) */
  away: number;
};

export type NavHazardState = {
  said: Map<string, SaidEntry>;
  lastChimeMs: number;
  lastRungMs: number;
  /** mốc bắt đầu đứng/neo (nowMs) — null khi đang chạy */
  slowSinceMs: number | null;
  cableSaidMs: number;
  restrictedSaidMs: number;
  /** câu cuối (lần gần nhất CÓ câu) — trả lại nguyên khi mất GPS trong NAV_LOST_KEEP_MS */
  lastAlerts: NavAlert[];
  lastAlertMs: number;
};

/** Mất GPS: còn giữ câu cuối trên HUD bao lâu — quá thì thôi, đừng nhắc chuyện cũ. */
export const NAV_LOST_KEEP_MS = 10 * 60 * 1000;
/**
 * Mất GPS thì KHÔNG CÒN FIX NÀO gọi `evaluateNavHazards` nữa, nên hạn trên
 * không tự tới: chỗ gọi phải có đồng hồ đánh thức lại đúng ngần này một lần
 * (chỉ khi `status !== "tracking"` — đang chạy bình thường thì nhịp GPS lo).
 * Thiếu nó, dòng ĐỎ "Xác tàu phía trước chừng 500 m" — dòng khoá, bà con không
 * thu được — đứng trên HUD hàng giờ, tả một hiện tại không còn đúng.
 * Ngắn hơn `NAV_LOST_KEEP_MS` nhiều lần: hạn 10 phút chỉ đúng tới 30 giây.
 */
export const NAV_LOST_TICK_MS = 30 * 1000;

export function initNavHazardState(): NavHazardState {
  return {
    said: new Map(),
    lastChimeMs: -Infinity,
    lastRungMs: -Infinity,
    slowSinceMs: null,
    cableSaidMs: -Infinity,
    restrictedSaidMs: -Infinity,
    lastAlerts: [],
    lastAlertMs: -Infinity,
  };
}

// ── câu chữ ───────────────────────────────────────────────────────────────

const KM_PER_NM = 1.852;

/** "600 m" dưới 1 km, "1,5 hải lý" từ 1 km — mặc định khi nơi gọi không đưa `fmtDist`. */
export function fmtDistDefault(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  const nm = km / KM_PER_NM;
  const s = (Math.round(nm * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return `${s.replace(".", ",")} hải lý`;
}

function tenVat(h: HazardLike): string {
  const ten = h.ten ? ` ${h.ten}` : "";
  switch (h.loai) {
    case "xac-tau":
      return `Xác tàu${ten}`;
    case "gian-khoan":
      return `Giàn khoan${ten}`;
    case "vat-chim":
      return `Vật chìm${ten}`;
    case "phao-nguy-hiem":
      return `Phao báo nguy hiểm${ten}`;
    case "long-be":
      return `Lồng bè${ten}`;
    default:
      return `Chướng ngại${ten}`;
  }
}

type RelDir = "phía trước" | "bên trái" | "bên phải" | "phía sau" | null;

/** Hướng tương đối của vật so với mũi tàu — null khi chưa có hướng tàu. */
export function relDir(headingDeg: number | null, bearingToDeg: number): RelDir {
  if (headingDeg == null || !Number.isFinite(headingDeg)) return null;
  const d = angleDiffDeg(bearingToDeg, headingDeg); // >0 = bên phải
  const m = Math.abs(d);
  if (m <= 45) return "phía trước";
  if (m <= 135) return d > 0 ? "bên phải" : "bên trái";
  return "phía sau";
}

function fmtM(m: number): string {
  const r = Math.round(m * 10) / 10;
  return String(r).replace(".", ",");
}

// ── ứng viên trong một lần đánh giá ──────────────────────────────────────

type Cand = {
  id: string;
  bac: 1 | 3 | 4;
  /** mốc vừa vượt sang: 1 vàng · 2 đỏ */
  step: 1 | 2;
  edgeKm: number;
  dir: RelDir;
  etaMin: number | null;
  cau: string;
  /** vật điểm — để gom cụm; câu đơn lẻ vẫn giữ ở `cau` */
  point: boolean;
  lat: number;
  lon: number;
};

/** Ngưỡng km cho mốc [vàng, đỏ] tại tốc độ + sai số GPS này. */
export function navThresholdsKm(
  speedKmh: number | null,
  accuracyM: number | null,
): [number, number] {
  const v = speedKmh != null && Number.isFinite(speedKmh) && speedKmh > 0 ? speedKmh : 0;
  const acc = accuracyM != null && Number.isFinite(accuracyM) && accuracyM > 0 ? accuracyM / 1000 : 0;
  return [
    Math.max(NAV_HAZARD_FLOOR_KM[0], (v * NAV_HAZARD_STEPS_MIN[0]) / 60) + acc,
    Math.max(NAV_HAZARD_FLOOR_KM[1], (v * NAV_HAZARD_STEPS_MIN[1]) / 60) + acc,
  ];
}

/** Mốc theo khoảng cách tới mép: 2 nếu ≤ đỏ, 1 nếu ≤ vàng, 0 nếu còn xa. */
function stepFor(edgeKm: number, thr: [number, number]): 0 | 1 | 2 {
  if (edgeKm <= thr[1]) return 2;
  if (edgeKm <= thr[0]) return 1;
  return 0;
}

/** Điểm cách `p` `dKm` theo hướng `bDeg` — mặt phẳng cục bộ, đủ cho vài km. */
const KM_PER_DEG = (Math.PI / 180) * 6371;
function offsetKm(p: LatLon, bDeg: number, dKm: number): LatLon {
  const b = (bDeg * Math.PI) / 180;
  return {
    lat: p.lat + (dKm * Math.cos(b)) / KM_PER_DEG,
    lon: p.lon + (dKm * Math.sin(b)) / (KM_PER_DEG * Math.cos((p.lat * Math.PI) / 180)),
  };
}

/** Khoảng cách tới viền + có đang trong không — lọc bbox trước để rẻ. */
function noGoDistance(
  pos: LatLon,
  z: NoGoLike,
  padKm: number,
): { inside: boolean; km: number } | null {
  const padLat = padKm / KM_PER_DEG;
  const padLon = padKm / (KM_PER_DEG * Math.cos((pos.lat * Math.PI) / 180));
  if (
    pos.lat < z.bbox.latMin - padLat ||
    pos.lat > z.bbox.latMax + padLat ||
    pos.lon < z.bbox.lonMin - padLon ||
    pos.lon > z.bbox.lonMax + padLon
  )
    return null;
  const ring = z.ring;
  if (ring.length < 3) return null;
  const inside = pointInRing(pos, ring);
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const d = distToSegment(
      pos,
      { lat: ring[j][1], lon: ring[j][0] },
      { lat: ring[i][1], lon: ring[i][0] },
    ).km;
    if (d < best) best = d;
  }
  return { inside, km: best };
}

// ── đánh giá ──────────────────────────────────────────────────────────────

/**
 * Đánh giá một fix GPS. Trả `alerts` (≤2, nặng nhất trước) và `state` mới —
 * `prev` KHÔNG bị sửa. Mọi nhánh dữ liệu thiếu (kho chưa nạp, lưới chưa có,
 * hướng chưa biết) đều im ở phần đó chứ không ném: cảnh báo hình vẫn là
 * đường chính của dẫn đường, đây là lớp thêm.
 */
export function evaluateNavHazards(
  prev: NavHazardState,
  input: NavHazardInput,
): { alerts: NavAlert[]; state: NavHazardState } {
  const { status, nowMs } = input;

  // Mất GPS: giữ câu cuối cho bà con còn thấy (nếu chưa quá cũ), nhưng không kêu lại.
  if (status === "lost") {
    const fresh = Number.isFinite(nowMs) && nowMs - prev.lastAlertMs <= NAV_LOST_KEEP_MS;
    return {
      alerts: fresh ? prev.lastAlerts.map((a) => ({ ...a, chuong: false, rung: false })) : [],
      state: prev,
    };
  }
  if (status !== "tracking") {
    return { alerts: [], state: { ...prev, lastAlerts: [], lastAlertMs: -Infinity } };
  }

  const pos = input.pos;
  if (!Number.isFinite(pos?.lat) || !Number.isFinite(pos?.lon) || !Number.isFinite(nowMs)) {
    return { alerts: [], state: prev };
  }

  const speed =
    input.speedKmh != null && Number.isFinite(input.speedKmh) && input.speedKmh >= 0
      ? input.speedKmh
      : null;
  const acc =
    input.accuracyM != null && Number.isFinite(input.accuracyM) && input.accuracyM > 0
      ? input.accuracyM
      : 0;
  const moving = speed != null && speed >= MIN_MOVING_KMH;
  const heading =
    input.headingDeg != null && Number.isFinite(input.headingDeg) ? input.headingDeg : null;
  const fmt = input.fmtDist ?? fmtDistDefault;

  // Đồng hồ neo: đứng liên tục >5 phút → im bậc 1 & 3.
  const slowSinceMs = moving ? null : (prev.slowSinceMs ?? nowMs);
  const anchored = slowSinceMs != null && nowMs - slowSinceMs > NAV_ANCHOR_MS;

  const said = new Map(prev.said);
  const state: NavHazardState = {
    said,
    lastChimeMs: prev.lastChimeMs,
    lastRungMs: prev.lastRungMs,
    slowSinceMs,
    cableSaidMs: prev.cableSaidMs,
    restrictedSaidMs: prev.restrictedSaidMs,
    lastAlerts: prev.lastAlerts,
    lastAlertMs: prev.lastAlertMs,
  };

  // GPS lệch quá 500 m: không biết tàu ở đâu thì đừng nói vật ở đâu.
  if (acc > NAV_ACC_MUTE_M) return { alerts: [], state };

  const thr = navThresholdsKm(speed, acc);
  const degraded = acc > NAV_ACC_DOWNGRADE_M;
  const accSuffix = degraded ? ` (định vị lệch ±${Math.round(acc)} m)` : "";

  // Quên vật đã ra xa (>2× mốc lớn) hoặc quá 30 phút chưa nhắc lại.
  for (const [id, e] of said) {
    if (nowMs - e.lastMs > NAV_FORGET_MS) {
      said.delete(id);
      continue;
    }
    if (haversineKm(pos, e) > 2 * thr[0]) said.delete(id);
  }

  const cands: Cand[] = [];
  /** Mọi vật điểm thấy trong bán kính hỏi — để gom cụm kéo theo vật lân cận. */
  const seen: { id: string; bac: 1 | 3; edgeKm: number; dir: RelDir; lat: number; lon: number }[] = [];

  /** Ghi nhận vật thấy ở khoảng `edgeKm`; trả mốc mới nếu đáng nói. */
  const observe = (
    id: string,
    edgeKm: number,
    at: LatLon,
  ): { step: 1 | 2; entry: SaidEntry } | null => {
    const step = stepFor(edgeKm, thr);
    let e = said.get(id);
    if (!e) {
      e = { step: 0, lastMs: nowMs, lat: at.lat, lon: at.lon, lastKm: edgeKm, away: 0 };
      said.set(id, e);
    } else {
      e = { ...e };
      e.away = edgeKm > e.lastKm + AWAY_EPS_KM ? e.away + 1 : 0;
      e.lastKm = edgeKm;
      said.set(id, e);
    }
    if (step === 0 || step <= e.step) return null;
    if (e.away >= AWAY_FIXES) return null; // đã qua rồi, đang ra xa
    return { step, entry: e };
  };

  // (1) Vật cản điểm quanh tàu.
  if (input.ix && input.ix.count > 0) {
    const hits = queryRadius(input.ix, pos, navQueryKm(thr[0]));
    for (const { item: h, km } of hits) {
      const edge = Math.max(0, km - (Number.isFinite(h.rKm) ? h.rKm : 0));
      const r = observe(h.id, edge, h);
      if (anchored) continue; // neo rồi thì cả bậc 1 lẫn bậc 3 đều im
      // xác tàu sâu hơn mức tàu cần → chỉ chuyện lưới, không phải tính mạng
      const bac: 1 | 3 =
        h.doSauM != null && input.needM != null && h.doSauM >= input.needM ? 3 : 1;
      const dir = relDir(heading, bearingDeg(pos, h));
      seen.push({ id: h.id, bac, edgeKm: edge, dir, lat: h.lat, lon: h.lon });
      if (!r) continue;
      const eta =
        dir === "phía trước" && moving && speed ? Math.round((edge / speed) * 60) : null;
      const where = dir ? `${dir} chừng ${fmt(edge)}` : `cách chừng ${fmt(edge)}`;
      const nuoc = h.doSauM != null ? ` — nước trên vật ${fmtM(h.doSauM)} m` : "";
      const gian = h.loai === "gian-khoan" ? " — không vào trong 500 m" : "";
      const vua = h.tinVua ? " (vị trí gần đúng)" : "";
      cands.push({
        id: h.id,
        bac,
        step: r.step,
        edgeKm: edge,
        dir,
        etaMin: eta,
        cau:
          edge <= 0.05
            ? `${tenVat(h)} ngay sát tàu${nuoc}${vua}.`
            : `${tenVat(h)} ${where}${nuoc}${gian}${vua}.`,
        point: true,
        lat: h.lat,
        lon: h.lon,
      });
    }
  }

  // (2) Nón phía trước: 3 tia ±15°, tới L = max(2 km, 10 phút chạy).
  if (input.depthAt && heading != null && !anchored) {
    const L = Math.max(NAV_HAZARD_FLOOR_KM[0], speed != null ? (speed * NAV_HAZARD_STEPS_MIN[0]) / 60 : 0);
    const n = Math.ceil(L / NAV_CONE_STEP_KM);
    // gần nhất theo từng nhóm lớp: bờ · rạn/đá · <2 m · 2–4 m
    let dBo = Infinity;
    let dRan = Infinity;
    let dCan2 = Infinity;
    let dCan4 = Infinity;
    // bắt đầu từ mẫu 1 (0,4 km): ô ngay dưới tàu thì tàu đang nổi ở đó rồi
    for (let k = 1; k <= n; k++) {
      const d = k * NAV_CONE_STEP_KM;
      for (let t = -1; t <= 1; t++) {
        const p = offsetKm(pos, heading + t * NAV_CONE_HALF_DEG, d);
        const c = input.depthAt(p.lat, p.lon);
        if (c == null) continue;
        if (c === 0) dBo = Math.min(dBo, d);
        else if (c === 1) dRan = Math.min(dRan, d);
        else if (c === 2) dCan2 = Math.min(dCan2, d);
        else if (c === 3) dCan4 = Math.min(dCan4, d);
      }
    }
    const pushDepth = (id: string, d: number, bac: 1 | 4, cau: (dist: string) => string) => {
      if (!Number.isFinite(d)) return;
      const r = observe(id, d, pos);
      if (!r) return;
      cands.push({
        id,
        bac,
        step: r.step,
        edgeKm: d,
        dir: "phía trước",
        etaMin: moving && speed ? Math.round((d / speed) * 60) : null,
        cau: cau(fmt(d)),
        point: false,
        lat: pos.lat,
        lon: pos.lon,
      });
    };
    pushDepth("day:bo", dBo, 1, (s) => `Phía trước chừng ${s} là bờ hoặc đảo.`);
    pushDepth("day:ran", dRan, 1, (s) => `Phía trước chừng ${s} có rạn đá.`);
    pushDepth("day:can2", dCan2, 1, (s) => `Phía trước chừng ${s} nước rất cạn — chưa tới 2 m.`);
    // 2–4 m: chưa khai mớn hoặc tàu cần hơn 2 m → coi như rất cạn; còn lại chỉ là tin
    if (input.needM == null || input.needM > 2) {
      pushDepth("day:can4", dCan4, 1, (s) => `Phía trước chừng ${s} nước cạn — chưa tới 4 m.`);
    } else {
      pushDepth("day:can4", dCan4, 4, (s) => `Phía trước chừng ${s} nước chừng 2–4 m.`);
    }
  }

  // (3) Vùng cấm vào: đỏ ≤500 m hoặc đang trong, vàng ≤1 hải lý — không theo tốc độ.
  if (input.noGo && input.noGo.length > 0 && !anchored) {
    for (const z of input.noGo) {
      const d = noGoDistance(pos, z, NAV_NOGO_YELLOW_KM);
      if (!d) continue;
      const edge = d.inside ? 0 : d.km;
      if (edge > NAV_NOGO_YELLOW_KM) continue;
      const step: 1 | 2 = d.inside || edge <= NAV_NOGO_RED_KM ? 2 : 1;
      const e = said.get(z.id);
      if (e && step <= e.step) continue;
      said.set(z.id, {
        step: e?.step ?? 0,
        lastMs: e?.lastMs ?? nowMs,
        lat: pos.lat,
        lon: pos.lon,
        lastKm: edge,
        away: 0,
      });
      const ten = z.ten ?? "vùng cấm vào";
      cands.push({
        id: z.id,
        bac: 1,
        step,
        edgeKm: edge,
        dir: null,
        etaMin: null,
        cau: d.inside
          ? `Đang trong ${ten}.`
          : `${ten.charAt(0).toUpperCase()}${ten.slice(1)} cách chừng ${fmt(edge)}.`,
        point: false,
        lat: pos.lat,
        lon: pos.lon,
      });
    }
  }

  // (4) Cáp ngầm / vùng cấm neo: chỉ khi chạy chậm, ≤500 m, nhắc lại ≤1/10 phút.
  const slow = speed == null || speed < NAV_SLOW_KMH;
  if (slow && !anchored) {
    if (
      input.nearestCableKm != null &&
      input.nearestCableKm <= NAV_CABLE_KM &&
      nowMs - prev.cableSaidMs >= NAV_SLOW_REPEAT_MS
    ) {
      cands.push({
        id: "cap-ngam",
        bac: 3,
        step: 1,
        edgeKm: Math.max(0, input.nearestCableKm),
        dir: null,
        etaMin: null,
        cau: "Đang trên cáp ngầm — đừng neo, đừng thả giã.",
        point: false,
        lat: pos.lat,
        lon: pos.lon,
      });
    }
    if (input.insideRestricted && nowMs - prev.restrictedSaidMs >= NAV_SLOW_REPEAT_MS) {
      cands.push({
        id: "cam-neo",
        bac: 3,
        step: 1,
        edgeKm: 0,
        dir: null,
        etaMin: null,
        cau: `Đang trong ${input.insideRestricted} — đừng neo, đừng thả lưới ở đây.`,
        point: false,
        lat: pos.lat,
        lon: pos.lon,
      });
    }
  }

  if (cands.length === 0) return { alerts: [], state };

  // (5) Gom cụm: vật điểm vừa vượt mốc KÉO THEO mọi vật cùng bậc quanh nó ≤1 km
  //     chưa nói ở mốc đó — kể cả vật chưa tự vượt mốc. Nếu chỉ gom "cùng tick"
  //     thì tàu tiến dần sẽ nghe ba câu, ba chuông cho ba xác tàu nằm sát nhau.
  cands.sort((a, b) => a.bac - b.bac || b.step - a.step || a.edgeKm - b.edgeKm);
  const merged: (Cand & { members: string[] })[] = [];
  const used = new Set<string>();
  for (const a of cands) {
    if (used.has(a.id)) continue;
    used.add(a.id);
    const members = [a.id];
    let sameDir = true;
    if (a.point) {
      for (const b of seen) {
        if (b.id === a.id || used.has(b.id) || b.bac !== a.bac) continue;
        if ((said.get(b.id)?.step ?? 0) >= a.step) continue; // đã nói ở mốc này rồi
        if (haversineKm(a, b) > NAV_CLUSTER_KM) continue;
        used.add(b.id);
        members.push(b.id);
        if (b.dir !== a.dir) sameDir = false;
      }
    }
    if (members.length >= 2) {
      const where = sameDir && a.dir ? a.dir : "quanh tàu";
      merged.push({
        ...a,
        members,
        cau: `${members.length} chướng ngại ${where}, gần nhất chừng ${fmt(a.edgeKm)}.`,
      });
    } else {
      merged.push({ ...a, members });
    }
  }

  // (6) Trần: 1 câu đỏ + 1 câu vàng/tin. Đỏ = bậc 1 ở mốc đỏ (hạ vàng khi GPS lệch).
  const toMuc = (c: Cand): NavAlert["muc"] => {
    if (c.bac === 4) return "tin";
    if (c.bac === 1 && c.step === 2 && !degraded) return "do";
    return "vang";
  };
  let red: (typeof merged)[number] | null = null;
  let other: (typeof merged)[number] | null = null;
  for (const c of merged) {
    if (toMuc(c) === "do") {
      if (!red) red = c;
    } else if (!other) other = c;
  }

  const borderRedActive = input.borderNm != null && input.borderNm <= 6;
  const alerts: NavAlert[] = [];
  const emit = (c: (typeof merged)[number]) => {
    const muc = toMuc(c);
    const newRed = muc === "do";
    let chuong = false;
    let rung = false;
    if (c.bac === 1) {
      // chuông ranh giới đang kêu (≤6 hl) thì câu vàng ở đây nhường tiếng
      chuong =
        (newRed || nowMs - state.lastChimeMs >= NAV_CHIME_COOLDOWN_MS) &&
        (newRed || !borderRedActive);
      rung = newRed || nowMs - state.lastRungMs >= NAV_RUNG_COOLDOWN_MS;
    } else if (c.bac === 3) {
      rung = nowMs - state.lastRungMs >= NAV_RUNG_COOLDOWN_MS;
    }
    if (chuong) state.lastChimeMs = nowMs;
    if (rung) state.lastRungMs = nowMs;
    const cau = degraded && c.bac === 1 && c.step === 2 ? c.cau.replace(/\.$/, "") + accSuffix + "." : c.cau;
    alerts.push({
      id: c.members.length > 1 ? c.members.join("+") : c.id,
      bac: c.bac,
      muc,
      cau,
      chuong,
      rung,
      distKm: c.edgeKm,
      etaMin: c.etaMin,
    });
    // ghi nhớ đã nói ở mốc này — vật KHÔNG được chọn lần này sẽ chờ lượt sau
    for (const id of c.members) {
      if (id === "cap-ngam") state.cableSaidMs = nowMs;
      else if (id === "cam-neo") state.restrictedSaidMs = nowMs;
      else {
        const e = said.get(id);
        if (e) said.set(id, { ...e, step: c.step, lastMs: nowMs });
      }
    }
  };
  if (red) emit(red);
  if (other) emit(other);

  state.lastAlerts = alerts;
  state.lastAlertMs = nowMs;
  return { alerts, state };
}
