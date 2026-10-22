// ĐỘ SÂU RẠN XA BỜ — Hoàng Sa / Trường Sa (2026-10-22, anh Long: "cần lấy thông tin chính xác độ sâu của rạn + dự
// phòng vào trong tính toán đi qua"). Nguồn: HHU24SWDSCS (Hohai University, ESSD 2025) + SCSBathy10 (Zenodo 2026),
// CC BY 4.0, độ sâu suy từ ảnh vệ tinh + laser ICESat-2, datum MỰC NƯỚC TRUNG BÌNH; tên thực thể theo danh mục Việt Nam
// (scripts/dan-duong/ran-10m/LUAT-RA-SOAT-TEN.md). File `public/data/reef-depth.v1.bin` đóng gói bằng
// scripts/dan-duong/ran-10m/dong-goi-reef-depth.mjs — định dạng ở đầu script đó, sửa một bên phải sửa bên kia.
//
// LUẬT DÙNG (đề xuất đã chốt 2026-10-22 — "chỉ THÊM, không BỚT"):
//   · Mặt nạ rạn cũ (lớp 1 của depth-grid) GIỮ NGUYÊN, không ô nào được mở ra dù file này nói sâu — độ sâu vệ tinh
//     sai số ~1 m, lòng hồ rạn vòng chỉ vào được qua lạch hẹp lưới 100 m không thấy.
//   · Ô có số mà NÔNG hơn ngưỡng (`nguongChanRanM`) thì CHẶN thêm — vá chỗ mặt nạ cũ bỏ sót (đo: 100 ô 100 m ở cụm
//     Song Tử, 2026-10-22).
//   · Ngưỡng = nước tàu cần (`requiredDepthM`: mớn + 0,5 m + ½ sóng + lún đuôi) + DỰ PHÒNG sai số vệ tinh + dự phòng
//     con nước ròng xa bờ. Chưa khai mớn ⇒ lấy 4 m như luật lớp 3 (vắng số không phải là số).
// THUẦN LOGIC (trừ `fetchReefDepth`), structured-clone được sang worker tìm đường (chỉ object + Uint8Array).

import { requiredDepthM } from "@/lib/hazards";
import { fetchDataBytes } from "@/lib/data-fetch";

/** Sai số độ sâu vệ tinh tại rạn: RMSE công bố 0,67 m (SCSBathy10) – 0,82 m (HHU24) ⇒ dự phòng 1,0 m. */
export const DU_PHONG_SDB_M = 1.0;
/** Con nước ròng dưới mực trung bình ở rạn xa bờ — triều chưa nối cho Hoàng Sa/Trường Sa, biên độ ~1,5 m ⇒ ½ biên độ. */
export const RONG_XA_BO_M = 0.8;
/** Chưa khai mớn: coi tàu cần 4 m nước — khớp luật lớp 3 (dải 2–4 m đóng khi chưa khai mớn) của route-plan. */
export const CAN_KHI_CHUA_KHAI_MON_M = 4.0;

export type ReefDepthFeature = {
  /** tên tiếng Việt (tên riêng hoặc "… chưa định danh (cụm X)") — không bao giờ có tên nước ngoài */
  ten: string;
  /** "hoang-sa" | "truong-sa" — bộ đóng gói bỏ mọi thực thể ngoài hai quần đảo */
  nhom: string;
  nguon: string;
  lat0: number;
  lon0: number;
  dLat: number;
  dLon: number;
  nLat: number;
  nLon: number;
  nongNhatM: number | null;
  trungViM: number | null;
  /** mỗi ô một byte: 0–253 = 0,0–25,3 m · 254 = sâu hơn 25,3 m · 255 = không số. Hàng i theo vĩ độ TĂNG. */
  grid: Uint8Array;
};

export type ReefDepth = {
  v: 1;
  sinh: string;
  datum: string;
  credit: string[];
  features: ReefDepthFeature[];
};

export const REEF_DEPTH_PATH = "/data/reef-depth.v1.bin";

/** Giải mã file `RDP1`. File méo ⇒ NÉM (chỗ gọi rơi về "chưa có độ sâu rạn", không đọc sai mà không ai biết). */
export function decodeReefDepth(buf: ArrayBuffer): ReefDepth {
  const u8 = new Uint8Array(buf);
  if (u8.length < 8 || String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== "RDP1") throw new Error("reef-depth: sai định dạng");
  const headLen = u8[4] | (u8[5] << 8) | (u8[6] << 16) | (u8[7] << 24);
  if (headLen <= 0 || 8 + headLen > u8.length) throw new Error("reef-depth: đầu file hỏng");
  const head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + headLen)));
  if (head?.v !== 1 || !Array.isArray(head.features)) throw new Error("reef-depth: sai phiên bản");
  const body = u8.subarray(8 + headLen);
  const features: ReefDepthFeature[] = head.features.map((f: Record<string, unknown>) => {
    const nLat = Number(f.nLat), nLon = Number(f.nLon), off = Number(f.off), len = Number(f.len);
    if (!(nLat > 0 && nLon > 0 && off >= 0 && len > 0 && off + len <= body.length)) throw new Error(`reef-depth: thực thể hỏng ${String(f.ten)}`);
    const grid = new Uint8Array(nLat * nLon);
    const src = body.subarray(off, off + len);
    let k = 0;
    for (let i = 0; i < src.length; ) {
      const b = src[i++];
      if (b !== 255) { grid[k++] = b; continue; }
      let n = 0, sh = 0, c: number;
      do { c = src[i++]; n |= (c & 0x7f) << sh; sh += 7; } while (c & 0x80);
      grid.fill(255, k, k + n); k += n;
    }
    if (k !== grid.length) throw new Error(`reef-depth: lưới lệch cỡ ${String(f.ten)}`);
    return {
      ten: String(f.ten), nhom: String(f.nhom), nguon: String(f.nguon),
      lat0: Number(f.lat0), lon0: Number(f.lon0), dLat: Number(f.dLat), dLon: Number(f.dLon), nLat, nLon,
      nongNhatM: f.nongNhatM == null ? null : Number(f.nongNhatM), trungViM: f.trungViM == null ? null : Number(f.trungViM),
      grid,
    };
  });
  return { v: 1, sinh: String(head.sinh), datum: String(head.datum), credit: Array.isArray(head.credit) ? head.credit.map(String) : [], features };
}

/** Chỉ giữ thực thể có hộp bao cắt khung tính tuyến — tuyến ven bờ mang 0 thực thể sang worker (vẫn là "đã đối chiếu"). */
export function reefDepthInBBox(rd: ReefDepth, b: { latMin: number; latMax: number; lonMin: number; lonMax: number }): ReefDepth {
  const features = rd.features.filter((f) =>
    f.lat0 <= b.latMax && f.lat0 + f.dLat * f.nLat >= b.latMin && f.lon0 <= b.lonMax && f.lon0 + f.dLon * f.nLon >= b.lonMin);
  return { ...rd, features };
}

/**
 * Tìm thực thể cho THẺ CHẠM RẠN: cùng tên + tâm cách điểm chạm ≤ 25 km (rạn vòng lớn), không thì thực thể có hộp bao
 * (nở 2 km) chứa điểm chạm. Không thấy ⇒ null (thẻ im, không đoán). Rẻ: 169 thực thể, chạy một lần mỗi lần chạm.
 */
export function timRanChoThe(rd: ReefDepth, ten: string, lat: number | null, lon: number | null): ReefDepthFeature | null {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const tam = (f: ReefDepthFeature) => ({ lat: f.lat0 + (f.dLat * f.nLat) / 2, lon: f.lon0 + (f.dLon * f.nLon) / 2 });
  const km = (a: { lat: number; lon: number }) => 111.32 * Math.hypot((a.lon - lon) * Math.cos((lat * Math.PI) / 180), a.lat - lat);
  const cungTen = rd.features.filter((f) => f.ten === ten).map((f) => ({ f, d: km(tam(f)) })).filter((x) => x.d <= 25).sort((a, b) => a.d - b.d);
  if (cungTen.length) return cungTen[0].f;
  const pad = 2 / 111.32;
  const chua = rd.features.filter((f) => lat >= f.lat0 - pad && lat <= f.lat0 + f.dLat * f.nLat + pad && lon >= f.lon0 - pad && lon <= f.lon0 + f.dLon * f.nLon + pad);
  return chua.sort((a, b) => km(tam(a)) - km(tam(b)))[0] ?? null;
}

/** Một byte ô → mét (null = không số) */
export function oSangMet(b: number): number | null {
  if (b === 255) return null;
  return b === 254 ? 25.4 : b / 10;
}

/** Chỉ mục ô 0,05° → các thực thể có hộp bao cắt ô đó. Dựng một lần mỗi lượt tính (169 thực thể, vài ms). */
export type ReefDepthIndex = { rd: ReefDepth; o: Map<number, number[]> };
const O_DEG = 0.05;
const oKey = (lat: number, lon: number) => Math.floor(lat / O_DEG) * 100000 + Math.floor(lon / O_DEG);

export function buildReefDepthIndex(rd: ReefDepth): ReefDepthIndex {
  const o = new Map<number, number[]>();
  rd.features.forEach((f, idx) => {
    const la1 = f.lat0 + f.dLat * f.nLat, lo1 = f.lon0 + f.dLon * f.nLon;
    for (let la = Math.floor(f.lat0 / O_DEG); la <= Math.floor(la1 / O_DEG); la++)
      for (let lo = Math.floor(f.lon0 / O_DEG); lo <= Math.floor(lo1 / O_DEG); lo++) {
        const k = la * 100000 + lo;
        const a = o.get(k);
        if (a) a.push(idx); else o.set(k, [idx]);
      }
  });
  return { rd, o };
}

/** Độ sâu NÔNG NHẤT (m, mực trung bình) tại điểm theo mọi thực thể phủ điểm đó; null = không thực thể nào có số ở đây. */
export function reefDepthAtM(ix: ReefDepthIndex, lat: number, lon: number): number | null {
  const ds = ix.o.get(oKey(lat, lon));
  if (!ds) return null;
  let best: number | null = null;
  for (const idx of ds) {
    const f = ix.rd.features[idx];
    const i = Math.floor((lat - f.lat0) / f.dLat), j = Math.floor((lon - f.lon0) / f.dLon);
    if (i < 0 || i >= f.nLat || j < 0 || j >= f.nLon) continue;
    const m = oSangMet(f.grid[i * f.nLon + j]);
    if (m != null && (best == null || m < best)) best = m;
  }
  return best;
}

/** Thực thể nào phủ điểm (để câu chữ gọi đúng tên) — null nếu không có */
export function reefAt(ix: ReefDepthIndex, lat: number, lon: number): ReefDepthFeature | null {
  const ds = ix.o.get(oKey(lat, lon));
  if (!ds) return null;
  for (const idx of ds) {
    const f = ix.rd.features[idx];
    const i = Math.floor((lat - f.lat0) / f.dLat), j = Math.floor((lon - f.lon0) / f.dLon);
    if (i >= 0 && i < f.nLat && j >= 0 && j < f.nLon && f.grid[i * f.nLon + j] !== 255) return f;
  }
  return null;
}

/**
 * NGƯỠNG CHẶN tại rạn (m, mực trung bình): ô có số nông hơn ngưỡng này thì tàu không được đi qua.
 * = nước tàu cần (mớn + 0,5 + ½·min(Hs,3) + lún đuôi; chưa khai mớn ⇒ 4 m) + sai số vệ tinh + ròng xa bờ.
 */
export function nguongChanRanM(draftM: number | null, waveM: number | null, speedKn?: number | null): number {
  const can = requiredDepthM(draftM, waveM, speedKn) ?? CAN_KHI_CHUA_KHAI_MON_M;
  return Math.round((can + DU_PHONG_SDB_M + RONG_XA_BO_M) * 100) / 100;
}

let cached: Promise<ReefDepth> | null = null;
/** 0,68 MB thô; service worker ghim ở tier best-effort như reef-shapes. Trần 30 s cho sóng 3G ở cảng. */
const REEF_DEPTH_NETWORK_MS = 30000;

/** Tải + giải mã, nhớ cả phiên; hỏng thì xoá nhớ để lần sau thử lại (khuôn depth-grid). */
export async function fetchReefDepth(): Promise<ReefDepth> {
  if (!cached) {
    cached = fetchDataBytes(REEF_DEPTH_PATH, REEF_DEPTH_NETWORK_MS, "reef depth")
      .then(decodeReefDepth)
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}
