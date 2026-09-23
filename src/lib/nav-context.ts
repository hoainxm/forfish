/**
 * Trục 1 — KHO TRA CỨU CỦA DẪN ĐƯỜNG LIVE (thuần, test được).
 *
 * `nav-hazards.ts` là bộ não: mỗi fix GPS nó hỏi "quanh tôi có gì". Nhưng nó
 * KHÔNG biết đọc kho — mọi thứ nặng (chỉ mục điểm, chỉ mục đoạn cáp, danh sách
 * vùng cấm) phải đưa vào qua tham số. File này là chỗ DỰNG những thứ đó, ĐÚNG
 * MỘT LẦN lúc bà con bấm "Bắt đầu dẫn đường", rồi giữ trong ref suốt chuyến.
 *
 * ── VÌ SAO TÁCH RA (nguyên tắc 15 bậc 2: đã có buildIndex/buildSegmentIndex) ─
 * Nếu dựng chỉ mục ngay trong `fishing-map-view.tsx` thì (a) không ai đo được
 * nó mất bao lâu trên máy yếu, (b) không test được ca "kho thiếu một mảnh",
 * (c) rất dễ vô tình dựng lại mỗi nhịp GPS — 7.298 phao × 1–2 giây một lần là
 * điện thoại nóng máy giữa biển. Ở đây là hàm thuần: vào là mảng, ra là chỉ
 * mục + `missing`, không fetch, không React, không đồng hồ máy.
 *
 * ── KHO NÀO VÀO ĐÂU ────────────────────────────────────────────────────────
 *   · `xac-tau.v1.json` + giàn khoan + phao nguy hiểm/lồng bè → `hazards`
 *     (chỉ mục ĐIỂM, qua `buildHazardList` — một danh sách, hai người dùng)
 *   · vùng `cam-vao` (đa giác) → `noGo`
 *   · `cap` / `ong` (đường) → `cables` (chỉ mục ĐOẠN: hỏi "tôi có đang nằm
 *     trên cáp không" bằng điểm là đẻ ra khe mẫu giữa hai đỉnh cách nhau km)
 *   · vùng `cam-neo` / `cam-danh-bat` / `han-che` (đa giác) → `restricted`
 *   · `seamarks.v1.json` + `vn-aids.v1.json` → `aids` (phao kế tiếp)
 *   · `den-bien.v1.json` → `den` (105 đèn biển CÓ TÊN của Việt Nam)
 *   · `khu-tru-bao.v1.json` → `khu` (chỉ dùng khi ĐANG CÓ BÃO)
 *
 * Kho nào thiếu thì ghi tên vào `missing` chứ KHÔNG ném: mất một kho không
 * được làm mất cả lớp cảnh báo của chuyến biển (cùng luật `buildHazardList`).
 *
 * ## Assumptions
 * - Câu đèn biển in KHOẢNG CÁCH TỚI ĐÈN ("cách chừng 8 hải lý"), không in tầm
 *   hiệu lực của đèn. Tầm hiệu lực đã được dùng làm CỔNG (chỉ nói khi tầm ≥
 *   khoảng cách, tức mắt thường thấy được); in thêm một con số hải lý thứ hai
 *   cạnh nó là hai số cùng đơn vị cho hai nghĩa khác nhau — chỗ bà con đọc
 *   nhầm. Nguồn không ghi tầm ⇒ không nói gì về đèn đó.
 * - Mốc "25 hải lý" trong đặc tả là trần của KHOẢNG CÁCH, không phải trần của
 *   tầm đèn: đọc theo nghĩa kia thì mấy ngọn đèn lớn nhất bờ biển (tầm 26–27
 *   hải lý — đúng thứ nhìn thấy đầu tiên lúc vào bờ) bị loại sạch, ngược hẳn
 *   với việc dòng này sinh ra để làm.
 * - Phao/tiêu BÁO NGUY HIỂM CÔ LẬP và lồng bè KHÔNG vào dòng tin "phao kế
 *   tiếp": chúng đã là hiểm hoạ bậc 1/3 trong `hazards`, nói hai lần bằng hai
 *   giọng khác nhau là dạy tai bà con coi nhẹ dòng đỏ.
 * - `cableKmAt` trả `null` khi không có cáp nào trong tầm hỏi. Với
 *   `nav-hazards` thì "không biết" và "không có" hành xử như nhau (nó chỉ nói
 *   khi ≤500 m), nên không cần phân biệt hai ca ở đây.
 */

import {
  buildHazardList,
  type BBox,
  type Hazard,
  type NoGoZone,
} from "@/lib/hazards";
import {
  buildIndex,
  buildSegmentIndex,
  nearestSegment,
  pointInRing,
  queryNearest,
  type Segment,
  type SegmentIndex,
  type SpatialIndex,
} from "@/lib/spatial-index";
import { bearingDeg, formatHoursVN, type LatLon } from "@/lib/route-plan";
import { MIN_MOVING_KMH } from "@/lib/nav-progress";
import { relDir, type NavAlert } from "@/lib/nav-hazards";
import {
  colourLabel,
  huongDiQuaPhao,
  seamarkLabel,
  type Seamark,
} from "@/lib/seamarks";
import type { VnAid } from "@/lib/vn-aids";
import { tenDayDu, type DenBien } from "@/lib/den-bien";
import { tenTinhDep, type KhuTruBao } from "@/lib/khu-tru-bao";
import type { XacTau } from "@/lib/xac-tau";
import { windDirectionVN } from "@/lib/marine-weather";

/* ── HẰNG SỐ ─────────────────────────────────────────────────────────────── */

/** Hỏi cáp/ống trong bán kính này (km) — hơn mốc nói 500 m một chút cho sai số GPS. */
export const NAV_CABLE_QUERY_KM = 0.6;
/** Phao kế tiếp: chỉ nói khi ≤ ngần này (km). */
export const NAV_PHAO_KM = 2;
/** Đèn biển: chỉ nói khi đèn cách tàu ≤ ngần này (hải lý) VÀ tầm đèn còn với tới. */
export const NAV_DEN_MAX_NM = 25;
/** Khu trú bão: hỏi 3 khu gần nhất trong tầm này (km). */
export const NAV_KHU_MAX_KM = 400;
/** Hai phao coi là MỘT khi cách nhau dưới ngần này (km) — bản nhà nước thắng bản OSM. */
export const NAV_AID_TRUNG_KM = 0.1;

const KM_PER_NM = 1.852;

/* ── KIỂU ────────────────────────────────────────────────────────────────── */

/** Một đoạn cáp/ống — `ref` để câu chữ biết đang nói cáp quang hay ống khí. */
export type NavCableRef = {
  id: string;
  /** "cap" (cáp ngầm) hoặc "ong" (đường ống) */
  kind: "cap" | "ong";
  /** phân loại của nguồn: "quang" · "dien" · "khi" · "dau" · "chua-ro"… */
  loai: string;
  ten: string | null;
};

/** Vùng CẤM NEO / CẤM ĐÁNH BẮT / HẠN CHẾ — không chặn tuyến, chỉ nhắc khi đang trong. */
export type NavRestricted = {
  id: string;
  /** câu đã sẵn sàng ghép: "vùng cấm neo Vũng Tàu" */
  ten: string;
  loai: string;
  /** vòng ngoài đa giác, GeoJSON [lon, lat] */
  ring: [number, number][];
  bbox: BBox;
};

/** Báo hiệu hàng hải gộp hai nguồn: OSM (`Seamark`) + Cục Hàng hải (`VnAid`). */
export type NavAid = Seamark & {
  ten?: string | null;
  tacDung?: string | null;
};

export type NavContext = {
  /** vật cản dạng điểm (xác tàu, giàn khoan, phao nguy hiểm, lồng bè) */
  hazards: SpatialIndex<Hazard> | null;
  /** vùng cấm VÀO — đa giác chặn được */
  noGo: NoGoZone[];
  /** cáp ngầm + đường ống, chỉ mục theo ĐOẠN */
  cables: SegmentIndex<NavCableRef> | null;
  /** cấm neo / cấm đánh bắt / hạn chế */
  restricted: NavRestricted[];
  /** phao, tiêu — cho dòng tin "phao kế tiếp" */
  aids: SpatialIndex<NavAid> | null;
  /** đèn biển Việt Nam CÓ TÊN — cho dòng tin "đèn biển" */
  den: SpatialIndex<DenBien> | null;
  /** khu neo đậu tránh trú bão */
  khu: SpatialIndex<KhuTruBao> | null;
  /** kho nào KHÔNG có — màn hình phải nói "chưa soi được …", không im */
  missing: string[];
  /** dựng hết mất bao lâu (ms) — để đo trên máy thật, không phải để hiển thị */
  buildMs: number;
  /** số đếm từng lớp, đưa vào doc + test cho khỏi đoán */
  counts: {
    hazards: number;
    noGo: number;
    cableSegs: number;
    restricted: number;
    aids: number;
    den: number;
    khu: number;
  };
};

export type NavStores = {
  xacTau?: XacTau[] | null;
  /** feature của vn-sea-lanes.v1.json (mọi kind — hàm tự lọc) */
  laneFeatures?: GeoJSON.Feature[] | null;
  seamarks?: Seamark[] | null;
  vnAids?: VnAid[] | null;
  denBien?: DenBien[] | null;
  khuTruBao?: KhuTruBao[] | null;
};

/* ── ĐỌC FEATURE CỦA vn-sea-lanes ────────────────────────────────────────── */

type LaneProps = { kind?: string; loai?: string; ten?: string };

const laneProps = (f: GeoJSON.Feature): LaneProps =>
  (f?.properties ?? {}) as LaneProps;

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const okLatLon = (lat: unknown, lon: unknown): boolean =>
  finite(lat) && finite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

function ringBBox(ring: readonly [number, number][]): BBox {
  let latMin = Infinity;
  let latMax = -Infinity;
  let lonMin = Infinity;
  let lonMax = -Infinity;
  for (const [lon, lat] of ring) {
    if (lat < latMin) latMin = lat;
    if (lat > latMax) latMax = lat;
    if (lon < lonMin) lonMin = lon;
    if (lon > lonMax) lonMax = lon;
  }
  return { latMin, latMax, lonMin, lonMax };
}

/** Nhãn vùng hạn chế khi nguồn không ghi tên — không bao giờ lộ mã thô. */
const RESTRICTED_LABEL: Record<string, string> = {
  "cam-neo": "vùng cấm neo",
  "cam-danh-bat": "vùng cấm đánh bắt",
  "han-che": "vùng hạn chế",
};

/**
 * Cáp/ống → mảng đoạn. Một đường 76 đỉnh thành 75 đoạn; toạ độ hỏng thì cắt
 * chuỗi ở đó chứ không nối bừa qua (nối bừa là vẽ một sợi cáp không có thật
 * chạy ngang biển).
 */
export function cableSegments(
  features: readonly GeoJSON.Feature[],
): Segment<NavCableRef>[] {
  const out: Segment<NavCableRef>[] = [];
  features.forEach((f, i) => {
    const p = laneProps(f);
    if (p.kind !== "cap" && p.kind !== "ong") return;
    const g = f.geometry;
    if (!g || g.type !== "LineString" || !Array.isArray(g.coordinates)) return;
    const ref: NavCableRef = {
      id: `${p.kind}:${i}`,
      kind: p.kind,
      loai: typeof p.loai === "string" ? p.loai : "chua-ro",
      ten: typeof p.ten === "string" && p.ten ? p.ten : null,
    };
    let prev: LatLon | null = null;
    for (const c of g.coordinates) {
      if (!Array.isArray(c) || !okLatLon(c[1], c[0])) {
        prev = null;
        continue;
      }
      const cur: LatLon = { lat: c[1] as number, lon: c[0] as number };
      if (prev) out.push({ a: prev, b: cur, ref });
      prev = cur;
    }
  });
  return out;
}

/** Vùng cấm neo / cấm đánh bắt / hạn chế dạng ĐA GIÁC (đường hở không xét "trong" được). */
export function restrictedZones(
  features: readonly GeoJSON.Feature[],
): NavRestricted[] {
  const out: NavRestricted[] = [];
  features.forEach((f, i) => {
    const p = laneProps(f);
    if (p.kind !== "vungcam") return;
    const loai = typeof p.loai === "string" ? p.loai : "";
    if (!RESTRICTED_LABEL[loai]) return; // "cam-vao" đã đi đường noGo
    const g = f.geometry;
    if (!g || g.type !== "Polygon" || !Array.isArray(g.coordinates?.[0])) return;
    const ring: [number, number][] = [];
    for (const c of g.coordinates[0]) {
      if (Array.isArray(c) && okLatLon(c[1], c[0]))
        ring.push([c[0] as number, c[1] as number]);
    }
    if (ring.length < 3) return;
    const nhan = RESTRICTED_LABEL[loai];
    const ten =
      typeof p.ten === "string" && p.ten.trim() ? `${nhan} ${p.ten.trim()}` : nhan;
    out.push({ id: `vc:${i}`, ten, loai, ring, bbox: ringBBox(ring) });
  });
  return out;
}

/* ── DỰNG KHO ────────────────────────────────────────────────────────────── */

const aidPos = (m: NavAid): LatLon => ({ lat: m.lat, lon: m.lon });
const khuPos = (k: KhuTruBao): LatLon => ({ lat: k.lat, lon: k.lon });
const hazardPos = (h: Hazard): LatLon => ({ lat: h.lat, lon: h.lon });

/**
 * Dựng MỘT LẦN mọi chỉ mục dẫn đường cần. Không fetch, không ném.
 *
 * @param needM độ sâu tàu cần (`requiredDepthM`) — null khi chưa khai mớn
 * @param namNay năm hiện tại (test truyền cố định)
 */
export function buildNavContext(
  kho: NavStores,
  needM: number | null,
  namNay?: number,
): NavContext {
  const t0 = Date.now();
  const missing: string[] = [];

  const list = buildHazardList(
    {
      xacTau: kho?.xacTau ?? null,
      laneFeatures: kho?.laneFeatures ?? null,
      seamarks: kho?.seamarks ?? null,
    },
    needM,
    namNay,
  );
  missing.push(...list.missing);

  const hazards = list.hazards.length
    ? buildIndex(list.hazards, hazardPos)
    : null;

  const lanes = kho?.laneFeatures ?? null;
  const segs = lanes ? cableSegments(lanes) : [];
  const cables = segs.length ? buildSegmentIndex(segs) : null;
  const restricted = lanes ? restrictedZones(lanes) : [];

  /*  PHAO: bản NHÀ NƯỚC vào trước, bản OSM chỉ vào khi cách mọi bản nhà nước
      hơn 100 m. Cùng một cái phao mà hai nguồn lệch nhau vài chục mét thì bà
      con nghe hai câu khác nhau về một vật — và bản OSM không có `tacDung`
      nên câu "để bên nào" của nó yếu hơn hẳn. */
  const vnAids = kho?.vnAids ?? null;
  if (!vnAids) missing.push("vn-aids");
  const aidList: NavAid[] = vnAids ? vnAids.slice() : [];
  const vnIx = aidList.length ? buildIndex(aidList, aidPos) : null;
  const sm = kho?.seamarks ?? null;
  if (sm) {
    for (const m of sm) {
      if (!m || !okLatLon(m.lat, m.lon)) continue;
      if (vnIx && queryNearest(vnIx, aidPos(m), 1, NAV_AID_TRUNG_KM).length)
        continue;
      aidList.push(m);
    }
  }
  const aids = aidList.length ? buildIndex(aidList, aidPos) : null;

  const denList = kho?.denBien ?? null;
  if (!denList) missing.push("den-bien");
  const den = denList?.length ? buildIndex(denList, aidPos) : null;

  const khuList = kho?.khuTruBao ?? null;
  if (!khuList) missing.push("khu-tru-bao");
  const khu = khuList?.length ? buildIndex(khuList, khuPos) : null;

  return {
    hazards,
    noGo: list.noGo,
    cables,
    restricted,
    aids,
    den,
    khu,
    missing,
    buildMs: Date.now() - t0,
    counts: {
      hazards: hazards?.count ?? 0,
      noGo: list.noGo.length,
      cableSegs: cables?.count ?? 0,
      restricted: restricted.length,
      aids: aids?.count ?? 0,
      den: den?.count ?? 0,
      khu: khu?.count ?? 0,
    },
  };
}

/* ── TRA CỨU MỖI FIX (rẻ, không cấp phát mảng mới trong vòng nóng) ───────── */

/**
 * Cách cáp/ống gần nhất (km) trong tầm hỏi, `null` khi không có/không có kho.
 * `nav-hazards` chỉ nói khi ≤500 m VÀ tàu chạy chậm — nên tầm hỏi 600 m là đủ.
 */
export function cableKmAt(
  ctx: NavContext | null,
  pos: LatLon,
  maxKm: number = NAV_CABLE_QUERY_KM,
): number | null {
  if (!ctx?.cables) return null;
  const hit = nearestSegment(ctx.cables, pos, maxKm);
  return hit ? hit.km : null;
}

/** Tên vùng cấm neo/hạn chế đang ĐỨNG TRONG, `null` khi không. Lọc bbox trước cho rẻ. */
export function restrictedAt(
  ctx: NavContext | null,
  pos: LatLon,
): string | null {
  if (!ctx?.restricted?.length) return null;
  if (!Number.isFinite(pos?.lat) || !Number.isFinite(pos?.lon)) return null;
  for (const z of ctx.restricted) {
    if (
      pos.lat < z.bbox.latMin ||
      pos.lat > z.bbox.latMax ||
      pos.lon < z.bbox.lonMin ||
      pos.lon > z.bbox.lonMax
    )
      continue;
    if (pointInRing(pos, z.ring)) return z.ten;
  }
  return null;
}

/* ── DÒNG TIN: PHAO KẾ TIẾP · ĐÈN BIỂN ──────────────────────────────────── */

const PHAO_PREFIX = ["buoy", "beacon"];
const PHAO_BO = new Set([
  "buoy_isolated_danger",
  "beacon_isolated_danger",
  "marine_farm",
]);
const laPhao = (m: NavAid): boolean => {
  const t = String(m?.type ?? "");
  return PHAO_PREFIX.some((p) => t.startsWith(p)) && !PHAO_BO.has(t);
};

/** Tên gọi trên màn: số hiệu nhà nước nếu có, không thì nhãn loại. */
function tenAid(m: NavAid): string {
  const ten = typeof m.ten === "string" ? m.ten.trim() : "";
  return ten || seamarkLabel(String(m.type));
}

/** Id ổn định theo toạ độ — để nơi gọi biết vẫn đang nói về đúng cái phao đó. */
const aidId = (m: NavAid): string =>
  `${m.lat.toFixed(4)},${m.lon.toFixed(4)}`;

export type NavInfoLine = { id: string; cau: string };

/**
 * PHAO KẾ TIẾP — dòng TIN (bậc 4, không chuông không rung): cái phao/tiêu gần
 * nhất trong 2 km và, nếu suy được, đi qua nó phía nào.
 *
 *   "Phao số 7 (thân đỏ) phía trước 600 m — Vào luồng: để phao này bên TRÁI
 *    tàu (ra biển thì bên phải)."
 *
 * `huongDiQuaPhao` trả `null` khi KHÔNG BIẾT bên — lúc đó câu chỉ nói có phao
 * ở đâu, tuyệt đối không đoán bên (chỉ sai bên luồng là đưa tàu vào chỗ cạn).
 */
export function phaoKeTiep(
  ctx: NavContext | null,
  pos: LatLon,
  headingDeg: number | null,
  fmt: (km: number) => string,
  maxKm: number = NAV_PHAO_KM,
): NavInfoLine | null {
  if (!ctx?.aids) return null;
  const hit = queryNearest(ctx.aids, pos, 1, maxKm, laPhao)[0];
  if (!hit) return null;
  const m = hit.item;
  const mau = colourLabel(m.colour);
  const dau = `${tenAid(m)}${mau ? ` (thân ${mau})` : ""}`;
  const dir = relDir(headingDeg, bearingDeg(pos, m));
  const cho = dir ? `${dir} ${fmt(hit.km)}` : `cách ${fmt(hit.km)}`;
  const huong = huongDiQuaPhao(m, m.tacDung ?? undefined);
  return {
    id: `phao:${aidId(m)}`,
    cau: `${dau} ${cho}${huong ? ` — ${huong}` : ""}.`,
  };
}

/**
 * ĐÈN BIỂN — dòng TIN: ngọn đèn biển gần nhất trong 25 hải lý mà TẦM HIỆU LỰC
 * còn với tới chỗ tàu đang đứng (tức là ngước lên nhìn thấy được).
 *
 *   "Đèn biển Kê Gà hướng Tây Nam, cách chừng 8 hải lý."
 *
 * Nguồn không ghi tầm ⇒ im về cái đèn đó: hứa "nhìn là thấy" cho một cái đèn
 * không biết sáng tới đâu là hứa thay nguồn.
 *
 * Dùng kho `den-bien.v1.json` (105 ngọn CÓ TÊN, nhà nước công bố) chứ không
 * dùng lớp đèn của OSM: câu này chỉ có ích khi gọi được TÊN — "Đèn báo hiệu
 * nhỏ hướng Tây Nam" thì bà con không đối chiếu được với thứ gì trên biển.
 */
export function denBienTin(
  ctx: NavContext | null,
  pos: LatLon,
  fmt: (km: number) => string,
): NavInfoLine | null {
  if (!ctx?.den) return null;
  const maxKm = NAV_DEN_MAX_NM * KM_PER_NM;
  const hit = queryNearest(ctx.den, pos, 1, maxKm, (d) => {
    const r = d.light?.range;
    return finite(r) && r > 0;
  })[0];
  if (!hit) return null;
  const d = hit.item;
  const tamKm = (d.light?.range ?? 0) * KM_PER_NM;
  if (hit.km > tamKm) return null; // xa hơn tầm đèn: chưa thấy được, đừng nói
  const huong = windDirectionVN(bearingDeg(pos, d));
  return {
    id: `den:${aidId(d)}`,
    cau: `${tenDayDu(d)} hướng ${huong}, cách chừng ${fmt(hit.km)}.`,
  };
}

/* ── KHU TRÚ BÃO GẦN NHẤT ────────────────────────────────────────────────── */

export type KhuGan = {
  id: string;
  ten: string;
  /** tỉnh đã viết kiểu tên riêng ("Bình Thuận"); "" khi nguồn không ghi */
  tinh: string;
  lat: number;
  lon: number;
  km: number;
  /** khoảng cách theo đơn vị bà con chọn */
  khoang: string;
  /** giờ chạy theo TỐC ĐỘ GPS ĐANG CHẠY — `null` khi tàu chưa chạy (không bịa giờ) */
  gio: string | null;
  /** chiều dài tàu lớn nhất vào được (m) — `null` khi quy hoạch không ghi */
  tauDaiM: number | null;
  /** toạ độ chỉ ở mức tin VỪA — câu chữ phải nói "(vị trí gần đúng)" */
  ganDung: boolean;
};

/**
 * 3 khu trú bão gần nhất. KHÔNG phán "kịp hay không kịp", KHÔNG hứa còn chỗ —
 * chỉ nói có khu nào, ở đâu, còn bao xa, và theo tốc độ đang chạy thì chừng
 * bao lâu. Tàu chưa chạy ⇒ `gio` null ⇒ màn hình chỉ in quãng.
 */
export function khuTruBaoGan(
  ctx: NavContext | null,
  pos: LatLon,
  speedKmh: number | null,
  fmt: (km: number) => string,
  k = 3,
  maxKm: number = NAV_KHU_MAX_KM,
): KhuGan[] {
  if (!ctx?.khu) return [];
  const chay =
    speedKmh != null && Number.isFinite(speedKmh) && speedKmh >= MIN_MOVING_KMH
      ? speedKmh
      : null;
  return queryNearest(ctx.khu, pos, k, maxKm).map(({ item, km }) => ({
    id: `${item.ten}|${item.tinh}`,
    ten: item.ten,
    tinh: item.tinh ? tenTinhDep(item.tinh) : "",
    lat: item.lat,
    lon: item.lon,
    km,
    khoang: fmt(km),
    gio: chay ? formatHoursVN(km / chay) : null,
    tauDaiM: item.coTauM,
    ganDung: item.tin === "vua",
  }));
}

/* ── CHỌN DÒNG CHO HUD ───────────────────────────────────────────────────── */

export type HudLine = {
  id: string;
  cau: string;
  muc: "do" | "vang" | "tin";
  /** ĐỎ = không thu được, hiện cả khi HUD đã thu thành chip (như ranh giới) */
  khoa: boolean;
};

/**
 * Hai dòng hiểm hoạ của HUD, chọn thuần để test được mà không cần dựng React.
 *
 * Luật:
 *  · `alerts` đã được `nav-hazards` xếp nặng-nhất-trước và cắt còn ≤2 — ở đây
 *    chỉ cắt lại cho chắc, KHÔNG xếp lại (xếp hai lần bằng hai luật là chỗ đẻ
 *    ra "câu đỏ nằm dưới câu vàng").
 *  · Dòng ĐỎ khoá: không thu được, hiện cả khi HUD thu thành chip. Cả hai đỏ
 *    thì hiện hai dòng đỏ — không hạ bớt một cái cho đỡ đỏ mắt.
 *  · Còn slot trống mới tới lượt dòng TIN (phao/đèn).
 *  · `borderRed` = ranh giới ≤6 hải lý đang kêu (dòng đó do HUD vẽ riêng, KHÔNG
 *    đi qua đây): lúc ấy bỏ dòng tin — đang sát ranh giới mà HUD kể chuyện phao
 *    là làm loãng đúng cái cần đọc.
 */
export function pickHudLines(
  alerts: readonly NavAlert[] | null | undefined,
  borderRed: boolean,
  info: string | null,
): HudLine[] {
  const out: HudLine[] = [];
  for (const a of alerts ?? []) {
    if (out.length >= 2) break;
    out.push({ id: a.id, cau: a.cau, muc: a.muc, khoa: a.muc === "do" });
  }
  if (out.length < 2 && info && !borderRed) {
    out.push({ id: "tin:live", cau: info, muc: "tin", khoa: false });
  }
  return out;
}

/** Hai danh sách cảnh báo có CÙNG NỘI DUNG không — để khỏi `setState` mỗi fix. */
export function sameAlerts(
  a: readonly NavAlert[],
  b: readonly NavAlert[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].muc !== b[i].muc || a[i].cau !== b[i].cau)
      return false;
  }
  return true;
}

/* ── CỜ RUNG (localStorage) ──────────────────────────────────────────────── */

/**
 * Bật/tắt rung khi có cảnh báo. MẶC ĐỊNH BẬT — rung là kênh duy nhất còn tới
 * được khi máy đút túi áo mưa, tiếng máy tàu át hết chuông. Tắt được vì có bà
 * con để máy trên giá, rung suốt đêm là rơi máy.
 *
 * Khoá RIÊNG (không nhét vào `mapPrefs`) vì đây là chuyện của MÁY NÀY: máy
 * khác có thể không có mô-tơ rung.
 */
export const NAV_RUNG_KEY = "forfish.nav.rung.v1";

export function navRungOn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(NAV_RUNG_KEY) !== "0";
  } catch {
    return true; // localStorage bị chặn (chế độ riêng tư) — vẫn rung như mặc định
  }
}

export function setNavRungOn(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NAV_RUNG_KEY, on ? "1" : "0");
  } catch {
    /* ghi không được thì thôi — lựa chọn chỉ mất khi đóng app, không phá gì */
  }
}
