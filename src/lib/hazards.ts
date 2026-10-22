/**
 * Trục 1 — DANH SÁCH HIỂM HOẠ cho vẽ tuyến + dẫn đường (THUẦN, test được).
 *
 * File này gom ba kho đã có trong máy thành MỘT danh sách điểm-có-bán-kính mà
 * `route-plan` (chặn cứng trong `legCost`), `route-hazards` (hậu kiểm thẻ
 * tuyến) và `nav-hazards` (cảnh báo khi đang chạy) cùng đọc:
 *
 *   · `xac-tau.v1.json`   — xác tàu / chướng ngại / vật chìm (Thông báo hàng hải)
 *   · `vn-sea-lanes`      — giàn khoan (điểm) + vùng CẤM VÀO (đa giác)
 *   · `seamarks.v1.json`  — phao/tiêu báo chỗ nguy hiểm cô lập, lồng bè nuôi
 *
 * Nó KHÔNG fetch, KHÔNG vẽ, KHÔNG đọc đồng hồ máy (năm hiện tại truyền vào —
 * mặc định lấy từ `Date` chỉ để chỗ gọi khỏi lặp, test truyền số cố định).
 *
 * ── LUẬT BÁN KÍNH (quyết định thiết kế 2026-09-04 §1.5) ───────────────────
 *   · xác tàu/chướng ngại/vật chìm: r = max(banKinhCamM, 500 m)
 *   · tin VỪA (vị trí "theo phao", hoặc tin quá 3 năm chưa có tin gỡ) → r × 2
 *     và câu chữ gắn "(vị trí gần đúng)" — nguồn không chắc thì vòng tránh
 *     phải rộng ra, không phải hẹp lại.
 *   · `doSauVuotQua` ≥ độ sâu tàu cần (khi BIẾT mớn) → KHÔNG chặn, đưa sang
 *     `passable` để thẻ tuyến chỉ nói "nước trên vật còn X m". Không biết mớn
 *     thì vẫn chặn (luật: draftM null → mọi câu mớn im, mọi nới lỏng theo mớn
 *     tắt).
 *   · giàn khoan 1 km (500 m luật + 500 m sai vị trí/GPS) · phao hiểm hoạ cô
 *     lập 300 m · lồng bè 200 m.
 *   · `platform` của OSM BỎ — trùng giàn khoan đã có trong vn-sea-lanes.
 *
 * ## Assumptions
 * - Xác tàu KHÔNG ghi năm (`nam` trống) coi như tin vừa: không biết tuổi tin
 *   thì đi về phía an toàn (vòng rộng, câu nói rõ "vị trí gần đúng").
 * - Vùng cấm-vào dạng LineString hở (`hoDang`) không dựng được đa giác nên
 *   không chặn được; ghi tên vào `khongXacDinh` để thẻ tuyến nói "gần ranh
 *   khu cấm vào (ranh chưa rõ hết)" chứ không im.
 */

import type { LatLon } from "@/lib/route-plan";
import { xacTauLabel, type XacTau } from "@/lib/xac-tau";
import { seamarkLabel, type Seamark } from "@/lib/seamarks";

/* ── KIỂU (hợp đồng §3 — tên phải đúng, agent khác nối vào) ──────────────── */

export type HazardKind =
  | "xac-tau"
  | "chuong-ngai"
  | "vat-chim"
  | "gian-khoan"
  | "phao-nguy-hiem"
  | "long-be";

export type Hazard = {
  id: string;
  lat: number;
  lon: number;
  /** bán kính chặn, km (đã nhân ×2 nếu tin vừa) */
  rKm: number;
  loai: HazardKind;
  ten: string | null;
  nam: number | null;
  /** nước trên vật (m) nếu TBHH ghi */
  doSauM: number | null;
  /** vị trí "theo phao"/tin >3 năm — câu chữ thêm "(vị trí gần đúng)" */
  tinVua: boolean;
  nguon: "tbhh" | "osm" | "sea-lanes";
};

export type BBox = { latMin: number; latMax: number; lonMin: number; lonMax: number };

export type NoGoZone = {
  id: string;
  ten: string | null;
  /** vòng ngoài của đa giác, GeoJSON [lon, lat] */
  ring: [number, number][];
  bbox: BBox;
};

/** Ranh khu cấm vào chỉ có dạng đường hở — không chặn được, chỉ cảnh báo gần. */
export type NoGoLine = { id: string; ten: string | null; line: LatLon[] };

export type HazardInput = {
  xacTau?: XacTau[] | null;
  /** feature của vn-sea-lanes.v1.json (mọi kind — hàm tự lọc) */
  laneFeatures?: GeoJSON.Feature[] | null;
  seamarks?: Seamark[] | null;
};

export type HazardList = {
  /** chặn cứng trong legCost */
  hazards: Hazard[];
  /** xác tàu có nước trên vật ≥ độ sâu tàu cần — chỉ tin, không chặn */
  passable: Hazard[];
  noGo: NoGoZone[];
  /** kho nào không có (null) — thẻ tuyến phải nói "chưa soi được …" */
  missing: string[];
  /** vùng cấm vào không dựng được đa giác (ranh hở) — tên để nhắc */
  khongXacDinh: string[];
};

/* ── HẰNG SỐ ─────────────────────────────────────────────────────────────── */

export const HAZARD_R_KM = {
  /** sàn cho xác tàu/chướng ngại khi nguồn không ghi bán kính */
  xacTauMin: 0.5,
  gianKhoan: 1,
  phaoNguyHiem: 0.3,
  longBe: 0.2,
} as const;

/** Tin xác tàu quá bấy nhiêu năm chưa có tin gỡ → coi là vị trí gần đúng. */
export const TIN_VUA_TUOI_NAM = 3;
/** Nhân bán kính khi tin vừa. */
export const TIN_VUA_NHAN = 2;
/** Đệm quanh đa giác cấm vào (km) — route-plan và route-hazards dùng chung. */
export const NO_GO_PAD_KM = 0.5;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const okLatLon = (lat: unknown, lon: unknown): boolean =>
  finite(lat) && finite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/* ── ĐỘ SÂU TÀU CẦN ──────────────────────────────────────────────────────── */

/**
 * Độ sâu nước tàu cần để qua: mớn + 0,5 m hở đáy + ½·min(Hs, 3) m cho sóng
 * (BA chốt mặc định 2026-09-04). Không biết mớn → null, và mọi câu mớn phải IM.
 * Không biết sóng → coi Hs = 0 (vẫn còn 0,5 m hở).
 */
export function requiredDepthM(
  draftM: number | null,
  waveM: number | null,
): number | null {
  if (!finite(draftM) || draftM <= 0) return null;
  const hs = finite(waveM) && waveM > 0 ? Math.min(waveM, 3) : 0;
  return Math.round((draftM + 0.5 + 0.5 * hs) * 100) / 100;
}

/* ── DỰNG DANH SÁCH ──────────────────────────────────────────────────────── */

const THEO_PHAO_RE = /theo\s+phao/i;

function hazardFromXacTau(x: XacTau, i: number, namNay: number): Hazard | null {
  if (!x || !okLatLon(x.lat, x.lon)) return null;
  const nam = finite(x.nam) ? x.nam : null;
  const theoPhao = typeof x.ghi === "string" && THEO_PHAO_RE.test(x.ghi);
  const cu = nam === null || nam < namNay - TIN_VUA_TUOI_NAM;
  const tinVua = theoPhao || cu;
  const baseKm = Math.max(
    HAZARD_R_KM.xacTauMin,
    finite(x.banKinhCamM) && x.banKinhCamM > 0 ? x.banKinhCamM / 1000 : 0,
  );
  return {
    id: `xt:${i}`,
    lat: x.lat,
    lon: x.lon,
    rKm: tinVua ? baseKm * TIN_VUA_NHAN : baseKm,
    loai: x.loai,
    ten: x.ten ?? null,
    nam,
    doSauM: finite(x.doSauVuotQua) && x.doSauVuotQua > 0 ? x.doSauVuotQua : null,
    tinVua,
    nguon: "tbhh",
  };
}

type LaneProps = { kind?: string; loai?: string; ten?: string; hoDang?: boolean };

function laneProps(f: GeoJSON.Feature): LaneProps {
  return (f?.properties ?? {}) as LaneProps;
}

function ringBBox(ring: [number, number][]): BBox {
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

/** Đọc vòng ngoài đa giác GeoJSON, bỏ đỉnh hỏng; < 3 đỉnh thì không phải vùng. */
function outerRing(f: GeoJSON.Feature): [number, number][] | null {
  const g = f.geometry;
  if (!g || g.type !== "Polygon" || !Array.isArray(g.coordinates?.[0])) return null;
  const ring: [number, number][] = [];
  for (const c of g.coordinates[0]) {
    if (Array.isArray(c) && okLatLon(c[1], c[0])) ring.push([c[0], c[1]]);
  }
  return ring.length >= 3 ? ring : null;
}

function lineCoords(f: GeoJSON.Feature): LatLon[] | null {
  const g = f.geometry;
  if (!g || g.type !== "LineString" || !Array.isArray(g.coordinates)) return null;
  const out: LatLon[] = [];
  for (const c of g.coordinates) {
    if (Array.isArray(c) && okLatLon(c[1], c[0])) out.push({ lat: c[1], lon: c[0] });
  }
  return out.length >= 2 ? out : null;
}

/**
 * Vùng CẤM VÀO từ vn-sea-lanes — đa giác chặn được, đường hở thì chỉ nhắc.
 * Tách riêng để `route-hazards` dùng lại đúng bản này (một chỗ đọc feature).
 */
export function noGoFromLanes(features: readonly GeoJSON.Feature[]): {
  zones: NoGoZone[];
  hoDang: NoGoLine[];
  khongXacDinh: string[];
} {
  const zones: NoGoZone[] = [];
  const hoDang: NoGoLine[] = [];
  const khongXacDinh: string[] = [];
  features.forEach((f, i) => {
    const p = laneProps(f);
    if (p.kind !== "vungcam" || p.loai !== "cam-vao") return;
    const ten = typeof p.ten === "string" && p.ten ? p.ten : null;
    const ring = outerRing(f);
    if (ring) {
      zones.push({ id: `cv:${i}`, ten, ring, bbox: ringBBox(ring) });
      return;
    }
    const line = lineCoords(f);
    if (line) {
      hoDang.push({ id: `cvh:${i}`, ten, line });
      const nhan = ten ?? "khu cấm vào";
      if (!khongXacDinh.includes(nhan)) khongXacDinh.push(nhan);
    }
  });
  return { zones, hoDang, khongXacDinh };
}

/**
 * Gom ba kho thành danh sách hiểm hoạ. Kho nào `null`/`undefined` thì ghi vào
 * `missing` chứ KHÔNG ném — mất một kho không được làm mất cả lớp chặn.
 *
 * @param needM độ sâu tàu cần (`requiredDepthM`); null = không biết mớn
 * @param namNay năm hiện tại (test truyền cố định)
 */
export function buildHazardList(
  input: HazardInput,
  needM: number | null,
  namNay: number = new Date().getFullYear(),
): HazardList {
  const hazards: Hazard[] = [];
  const passable: Hazard[] = [];
  const noGo: NoGoZone[] = [];
  const missing: string[] = [];
  const khongXacDinh: string[] = [];

  const xt = input?.xacTau;
  if (!xt) missing.push("xac-tau");
  else {
    xt.forEach((x, i) => {
      const h = hazardFromXacTau(x, i, namNay);
      if (!h) return;
      if (finite(needM) && h.doSauM !== null && h.doSauM >= needM) passable.push(h);
      else hazards.push(h);
    });
  }

  const lanes = input?.laneFeatures;
  if (!lanes) missing.push("sea-lanes");
  else {
    lanes.forEach((f, i) => {
      const p = laneProps(f);
      if (p.kind !== "giankhoan") return;
      const g = f.geometry;
      if (!g || g.type !== "Point") return;
      const [lon, lat] = g.coordinates;
      if (!okLatLon(lat, lon)) return;
      hazards.push({
        id: `gk:${i}`,
        lat,
        lon,
        rKm: HAZARD_R_KM.gianKhoan,
        loai: "gian-khoan",
        ten: typeof p.ten === "string" && p.ten ? p.ten : null,
        nam: null,
        doSauM: null,
        tinVua: false,
        nguon: "sea-lanes",
      });
    });
    const ng = noGoFromLanes(lanes);
    noGo.push(...ng.zones);
    khongXacDinh.push(...ng.khongXacDinh);
  }

  const sm = input?.seamarks;
  if (!sm) missing.push("seamarks");
  else {
    sm.forEach((m, i) => {
      if (!m || !okLatLon(m.lat, m.lon)) return;
      const t = String(m.type);
      let loai: HazardKind | null = null;
      let rKm = 0;
      if (t === "buoy_isolated_danger" || t === "beacon_isolated_danger") {
        loai = "phao-nguy-hiem";
        rKm = HAZARD_R_KM.phaoNguyHiem;
      } else if (t === "marine_farm") {
        loai = "long-be";
        rKm = HAZARD_R_KM.longBe;
      }
      if (!loai) return; // `platform` và mọi loại khác: không phải hiểm hoạ ở đây
      hazards.push({
        id: `sm:${i}`,
        lat: m.lat,
        lon: m.lon,
        rKm,
        loai,
        ten: null,
        nam: null,
        doSauM: null,
        tinVua: false,
        nguon: "osm",
      });
    });
  }

  return { hazards, passable, noGo, missing, khongXacDinh };
}

/* ── LỌC THEO KHUNG ──────────────────────────────────────────────────────── */

const KM_PER_DEG_LAT = (Math.PI / 180) * 6371;

/**
 * Hiểm hoạ có vòng chặn CHẠM khung `bbox` nới thêm `padKm` mỗi phía. Dùng ở
 * main thread trước khi đóng gói sang worker: tuyến Vũng Tàu→Côn Đảo không cần
 * mang theo giàn khoan vịnh Bắc Bộ.
 */
export function hazardsInBBox(h: readonly Hazard[], bbox: BBox, padKm: number): Hazard[] {
  if (!bbox || !finite(bbox.latMin) || !finite(bbox.latMax) || !finite(bbox.lonMin) || !finite(bbox.lonMax))
    return [];
  const pad = finite(padKm) && padKm > 0 ? padKm : 0;
  // co kinh độ tính ở vĩ độ XA xích đạo nhất của khung (hộp rộng hơn cần — thà xét thừa)
  const farLat = Math.min(89, Math.max(Math.abs(bbox.latMin), Math.abs(bbox.latMax)) + 1);
  const kmPerDegLon = Math.max(1e-6, KM_PER_DEG_LAT * Math.cos((farLat * Math.PI) / 180));
  const out: Hazard[] = [];
  for (const x of h) {
    if (!x || !finite(x.lat) || !finite(x.lon)) continue;
    const reach = pad + (finite(x.rKm) ? x.rKm : 0);
    const dLat = reach / KM_PER_DEG_LAT;
    const dLon = reach / kmPerDegLon;
    if (
      x.lat >= bbox.latMin - dLat &&
      x.lat <= bbox.latMax + dLat &&
      x.lon >= bbox.lonMin - dLon &&
      x.lon <= bbox.lonMax + dLon
    )
      out.push(x);
  }
  return out;
}

/* ── CÂU CHO BÀ CON ──────────────────────────────────────────────────────── */

/** "1.1" → "1,1" — số kiểu Việt, tối đa một số lẻ. */
const soViet = (v: number): string =>
  String(Math.round(v * 10) / 10).replace(".", ",");

/** 0,5 → "500 m" · 1 → "1 km" · 1,5 → "1,5 km". */
export function banKinhText(rKm: number): string {
  if (!finite(rKm) || rKm <= 0) return "";
  return rKm < 1 ? `${Math.round(rKm * 1000)} m` : `${soViet(rKm)} km`;
}

const KIND_LABEL: Record<HazardKind, string> = {
  "xac-tau": xacTauLabel("xac-tau"),
  "chuong-ngai": xacTauLabel("chuong-ngai"),
  "vat-chim": xacTauLabel("vat-chim"),
  "gian-khoan": "Giàn khoan",
  "phao-nguy-hiem": seamarkLabel("buoy_isolated_danger"),
  "long-be": seamarkLabel("marine_farm"),
};

/** Nhãn loại, không bao giờ lộ mã thô. */
export function hazardLabel(loai: HazardKind | string): string {
  return KIND_LABEL[loai as HazardKind] ?? KIND_LABEL["chuong-ngai"];
}

/**
 * Câu ngắn, giọng trung tính — nói SỰ VIỆC (cái gì, ở đâu tin, tránh bao xa),
 * KHÔNG ra lệnh lái ("bẻ lái", "ngay"): thuyền trưởng quyết.
 *
 *   "Xác tàu chìm MINH KHÁNH 01, tin năm 2026 (vị trí gần đúng) — nước trên
 *    vật 1,1 m — tránh xa chừng 1 km"
 *   "Giàn khoan — tránh xa chừng 1 km"
 */
export function moTaHazard(h: Hazard): string {
  let dau = hazardLabel(h.loai);
  // tên giàn khoan trong vn-sea-lanes là nhãn chung ("Giàn khoan / công trình
  // biển — Biển Đông (bắc)") — đã có nhãn loại, không in lặp
  if (h.ten && h.loai !== "gian-khoan") dau += ` ${h.ten}`;
  if (h.nam) dau += `, tin năm ${h.nam}`;
  if (h.tinVua) dau += " (vị trí gần đúng)";
  const bits = [dau];
  if (h.doSauM !== null && finite(h.doSauM)) bits.push(`nước trên vật ${soViet(h.doSauM)} m`);
  const r = banKinhText(h.rKm);
  if (r) bits.push(`tránh xa chừng ${r}`);
  return bits.join(" — ");
}

/* ── ĐÓNG GÓI SANG WORKER ────────────────────────────────────────────────── */

/**
 * Dạng phẳng để `postMessage` sang worker: ba `Float64Array` + mảng id. Worker
 * dựng `buildIndex` từ số thuần (PosFn không clone được), main giữ `Hazard[]`
 * đầy đủ để hậu kiểm/câu chữ — `unpackHazards` nối lại bằng id.
 */
export type HazardPacked = {
  lat: Float64Array;
  lon: Float64Array;
  rKm: Float64Array;
  ids: string[];
};

export function packHazards(h: readonly Hazard[]): HazardPacked {
  const n = h.length;
  const lat = new Float64Array(n);
  const lon = new Float64Array(n);
  const rKm = new Float64Array(n);
  const ids = new Array<string>(n);
  for (let i = 0; i < n; i++) {
    lat[i] = h[i].lat;
    lon[i] = h[i].lon;
    rKm[i] = h[i].rKm;
    ids[i] = h[i].id;
  }
  return { lat, lon, rKm, ids };
}

/**
 * Gói phẳng → `Hazard[]` theo đúng thứ tự gói, tra ngược `src` bằng id. Id
 * không có trong `src` (kho đã đổi giữa chừng) thì BỎ, không ném — worker trả
 * về trên một bản kho cũ không được làm sập màn hình.
 */
export function unpackHazards(p: HazardPacked, src: readonly Hazard[]): Hazard[] {
  if (!p || !Array.isArray(p.ids)) return [];
  const byId = new Map<string, Hazard>();
  for (const h of src) byId.set(h.id, h);
  const out: Hazard[] = [];
  for (const id of p.ids) {
    const h = byId.get(id);
    if (h) out.push(h);
  }
  return out;
}
