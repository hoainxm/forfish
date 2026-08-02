// Trục 1 — ĐỘ MẶN mặt biển (Copernicus) cho lớp dải màu THEO NGÀY.
//
// KHÁC 3 lớp Open-Meteo (mây/mưa/nhiệt/dông — lưới gió 8×10 theo GIỜ): độ mặn
// là lưới 1/3° NGÀY từ Copernicus Marine ARCO (Zarr), lấy qua API route server
// (fetch S3 + giải nén blosc — KHÔNG chạy được ở client). Đã PROBE THẬT
// 2026-07-28 (scripts/copernicus-salinity-probe.mjs): đơn vị PSU, nén lz4+shuffle
// = decodeFloat32Chunk dùng được, tầng mặt = elevation |min|, +8 ngày dự báo.
//
// Bắt buộc ghi nguồn khi hiển thị: "Generated using E.U. Copernicus Marine
// Service Information" (giấy phép Copernicus Marine).
//
// SERVER-ONLY (fetch S3 + giải nén) — chỉ gọi từ app/api/salinity.

import {
  decodeFloat32Chunk,
  readZarrArrayMeta,
  readZarrAttr,
  parseCfTimeUnits,
  cfTimeToMs,
  nearestIndex,
  axisRange,
  sliceToGrid,
  VN_BBOX,
} from "@/lib/copernicus";
import { timeoutSignal } from "@/lib/abort";

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const BASE =
  "https://s3.waw3-1.cloudferro.com/mdl-arco-time-010/arco/" +
  "GLOBAL_ANALYSISFORECAST_PHY_001_024/" +
  "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m_202406/downsampled4.zarr";

/** trần bước ngày (độ mặn đổi chậm + chặn tải: 4 × ~1 MB/lượt cache-miss) */
export const SALINITY_MAX_DAYS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 25000;

/** Cấu trúc trả về API — khớp ScalarGrid phía client (cells row-major + times) */
export interface SalinityPayload {
  /** mốc NGÀY ISO (T12:00, giờ VN) */
  times: string[];
  /** ô row-major (i*nLon+j), lat/lon TĂNG DẦN */
  cells: { lat: number; lon: number; values: (number | null)[] }[];
  nLat: number;
  nLon: number;
}

async function getChunk(path: string): Promise<Float32Array> {
  const r = await fetch(`${BASE}/${path}`, {
    signal: timeoutSignal(TIMEOUT_MS),
    headers: { "User-Agent": UA },
    next: { revalidate: 21600 }, // 6h — độ mặn đổi chậm
  });
  if (!r.ok) throw new Error(`salinity chunk ${r.status} ${path}`);
  return decodeFloat32Chunk(new Uint8Array(await r.arrayBuffer()));
}

/** đọc trục f4 nhiều chunk → number[] */
async function readAxis(
  name: string,
  meta: { shape: number[]; chunks: number[] },
): Promise<number[]> {
  const len = meta.shape[0];
  const cl = meta.chunks[0];
  const nC = Math.ceil(len / cl);
  const out: number[] = new Array(len).fill(NaN);
  for (let c = 0; c < nC; c++) {
    const chunk = await getChunk(`${name}/${c}`);
    for (let k = 0; k < cl && c * cl + k < len; k++) out[c * cl + k] = chunk[k];
  }
  return out;
}

/**
 * Độ mặn tầng mặt hộp biển VN cho `days` mốc NGÀY (hôm nay → +days-1). Trả
 * `null` khi nguồn hỏng (route sẽ báo lỗi, client lùi bản lưu / bỏ lớp).
 * `nowMs` cho phép test tất định (mặc định Date.now()).
 */
export async function fetchSalinityDaily(
  days = SALINITY_MAX_DAYS,
  nowMs: number = Date.now(),
): Promise<SalinityPayload | null> {
  const nSteps = Math.max(1, Math.min(SALINITY_MAX_DAYS, Math.round(days)));
  try {
    const zres = await fetch(`${BASE}/.zmetadata`, {
      signal: timeoutSignal(TIMEOUT_MS),
      headers: { "User-Agent": UA },
      next: { revalidate: 21600 },
    });
    if (!zres.ok) return null;
    const zmeta = await zres.json();

    const soMeta = readZarrArrayMeta(zmeta, "so");
    const latMeta = readZarrArrayMeta(zmeta, "latitude");
    const lonMeta = readZarrArrayMeta(zmeta, "longitude");
    const timeMeta = readZarrArrayMeta(zmeta, "time");
    const elevMeta = readZarrArrayMeta(zmeta, "elevation");
    if (!soMeta || !latMeta || !lonMeta || !timeMeta || !elevMeta) return null;
    if (soMeta.dtype !== "<f4") return null;

    const timeUnits = readZarrAttr(zmeta, "time", "units");
    const cf = typeof timeUnits === "string" ? parseCfTimeUnits(timeUnits) : null;
    if (!cf) return null;

    const [lats, lons, times, elev] = await Promise.all([
      readAxis("latitude", latMeta),
      readAxis("longitude", lonMeta),
      readAxis("time", timeMeta),
      readAxis("elevation", elevMeta),
    ]);

    // tầng MẶT: elevation giảm dần (index 0 = sâu nhất) → chọn |elev| nhỏ nhất
    let di = 0;
    for (let k = 1; k < elev.length; k++)
      if (Math.abs(elev[k]) < Math.abs(elev[di])) di = k;

    const nLonFull = lonMeta.shape[0];
    const latSel = axisRange(lats, VN_BBOX.lat0, VN_BBOX.lat1);
    const lonSel = axisRange(lons, VN_BBOX.lon0, VN_BBOX.lon1);
    if (latSel.count === 0 || lonSel.count === 0) return null;

    // mốc ngày: hôm nay 12:00 UTC + offset (bám lưới daily-mean)
    const base = Math.floor(nowMs / DAY_MS) * DAY_MS + 12 * 60 * 60 * 1000;
    const stepTimes: string[] = [];
    const grids: { values: number[][] }[] = [];
    for (let s = 0; s < nSteps; s++) {
      const targetMs = base + s * DAY_MS;
      const ti = nearestIndex(times, (targetMs - cf.epochMs) / cf.msPerUnit);
      if (ti < 0) return null;
      const flat = await getChunk(`so/${ti}.${di}.0.0`);
      const g = sliceToGrid({
        data: flat,
        lats,
        lons,
        latSel,
        lonSel,
        fillValue: soMeta.fillValue,
        date: new Date(cfTimeToMs(times[ti], cf)).toISOString().slice(0, 10),
      });
      grids.push({ values: g.values });
      // nhãn ngày VN (T12:00 +07) — mốc để thanh ngày hiện đúng
      stepTimes.push(new Date(targetMs).toISOString().slice(0, 10) + "T12:00");
    }

    // dựng cells row-major từ lưới đã cắt (mọi ngày cùng trục lat/lon)
    const gLats = lats.slice(latSel.start, latSel.start + latSel.count);
    const gLons: number[] = [];
    for (let j = 0; j < lonSel.count; j++) {
      const lon = lons[lonSel.start + j];
      gLons.push(lon < 0 ? lon + 360 : lon);
    }
    const nLat = gLats.length;
    const nLon = gLons.length;
    const cells: SalinityPayload["cells"] = [];
    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < nLon; j++) {
        cells.push({
          lat: Math.round(gLats[i] * 1000) / 1000,
          lon: Math.round(gLons[j] * 1000) / 1000,
          values: grids.map((g) => {
            const v = g.values[i]?.[j];
            return Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
          }),
        });
      }
    }
    void nLonFull;
    return { times: stepTimes, cells, nLat, nLon };
  } catch {
    return null;
  }
}
