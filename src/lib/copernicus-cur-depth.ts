// Trục 1 — DÒNG CHẢY THEO TẦNG SÂU (Copernicus phy-cur, trung bình NGÀY).
//
// PROBE THẬT 2026-07-29: dataset GLOBAL_ANALYSISFORECAST_PHY_001_024 /
// cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m, asset downsampled4 (1/3°):
// uo/vo `<f4` m/s (KHÔNG scale), 50 tầng elevation −5.728 m → −0,5 m (GIẢM dần
// về mặt ở CUỐI trục), time bước NGÀY tới ~+8,8 ngày, MỘT chunk toàn cầu /
// (ngày × tầng) ≈ 1,37 MB / ~1,7 s. Các tầng khớp nghề: 0,5 · 47,4 · 155,9 ·
// 318,1 m (danh nghĩa 0/50/150/300 trong CUR_DEPTH_TIERS).
//
// SERVER-ONLY (fetch S3 + giải nén) — gọi từ /api/currents-depth và cron
// refresh-currents-depth. Trả về ĐÚNG shape ForecastGrid (chỉ trường cur*) với
// times THEO NGÀY ("YYYY-MM-DDT12:00" — cùng quy ước lớp độ mặn) để client
// dùng lại nguyên pipeline vẽ (mũi tên/hạt/nền màu/thanh ngày).
//
// Attribution khi hiển thị: "Generated using E.U. Copernicus Marine Service
// Information".

import {
  decodeFloat32Chunk,
  decodeTypedChunk,
  readZarrArrayMeta,
  readZarrAttr,
  parseCfTimeUnits,
  cfTimeToMs,
  nearestIndex,
  isFill,
} from "@/lib/copernicus";
import { gridPoints, type ForecastGrid, type GridHour } from "@/lib/forecast-grid";
import { CUR_DEPTH_MAX_DAYS } from "@/lib/weather-snapshot-id";
import { timeoutSignal } from "@/lib/abort";

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const BASE =
  "https://s3.waw3-1.cloudferro.com/mdl-arco-time-007/arco/" +
  "GLOBAL_ANALYSISFORECAST_PHY_001_024/" +
  "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m_202406/downsampled4.zarr";
const TIMEOUT_MS = 25000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CurDepthGrid extends ForecastGrid {
  /** tầng danh nghĩa đã xin (m) — 0 = mặt */
  tier: number;
  /** độ sâu THẬT của tầng dữ liệu (m) — vd 47,4 khi xin 50 */
  depthM: number;
}

/** Chỉ số tầng theo độ sâu danh nghĩa: |elevation| gần `tierM` nhất (tier 0 =
    tầng nông nhất). THUẦN — test được. */
export function pickElevationIndex(elev: number[], tierM: number): number {
  let bi = 0;
  for (let i = 1; i < elev.length; i++) {
    if (Math.abs(Math.abs(elev[i]) - tierM) < Math.abs(Math.abs(elev[bi]) - tierM))
      bi = i;
  }
  return bi;
}

/** Cắt lưới NGÀY về `days` ngày đầu — dựng bản d3 miễn phí từ bản d10 mà không
    fetch lại. THUẦN — test được. */
export function sliceCurDepthDays(grid: CurDepthGrid, days: number): CurDepthGrid {
  const n = Math.max(1, Math.min(grid.times.length, Math.round(days)));
  return {
    ...grid,
    times: grid.times.slice(0, n),
    cells: grid.cells.map((c) => ({ ...c, hours: c.hours.slice(0, n) })),
  };
}

async function getBuf(path: string, revalidate: number): Promise<Uint8Array> {
  const r = await fetch(`${BASE}/${path}`, {
    signal: timeoutSignal(TIMEOUT_MS),
    headers: { "User-Agent": UA },
    next: { revalidate },
  });
  if (!r.ok) throw new Error(`cur-depth chunk ${r.status} ${path}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function readAxis(
  name: string,
  meta: { shape: number[]; chunks: number[]; dtype: string },
): Promise<number[]> {
  const len = meta.shape[0];
  const cl = meta.chunks[0];
  const out: number[] = new Array(len).fill(NaN);
  for (let c = 0; c < Math.ceil(len / cl); c++) {
    // trục đổi rất chậm — cache 24h
    const chunk = decodeTypedChunk(await getBuf(`${name}/${c}`, 86400), meta.dtype);
    for (let k = 0; k < cl && c * cl + k < len; k++) out[c * cl + k] = chunk[k];
  }
  return out;
}

/**
 * Lưới dòng chảy ở tầng `tierM` cho tới `days` mốc NGÀY (hôm nay → +days-1),
 * sample về 156 điểm lưới Windy. Trả `null` khi nguồn hỏng — KHÔNG ném.
 */
export async function fetchCurDepthGrid(
  tierM: number,
  days: number = CUR_DEPTH_MAX_DAYS,
  nowMs: number = Date.now(),
): Promise<CurDepthGrid | null> {
  try {
    const zres = await fetch(`${BASE}/.zmetadata`, {
      signal: timeoutSignal(TIMEOUT_MS),
      headers: { "User-Agent": UA },
      next: { revalidate: 21600 },
    });
    if (!zres.ok) return null;
    const zmeta = await zres.json();

    const uMeta = readZarrArrayMeta(zmeta, "uo");
    const vMeta = readZarrArrayMeta(zmeta, "vo");
    const latMeta = readZarrArrayMeta(zmeta, "latitude");
    const lonMeta = readZarrArrayMeta(zmeta, "longitude");
    const timeMeta = readZarrArrayMeta(zmeta, "time");
    const elevMeta = readZarrArrayMeta(zmeta, "elevation");
    if (!uMeta || !vMeta || !latMeta || !lonMeta || !timeMeta || !elevMeta)
      return null;
    if (uMeta.dtype !== "<f4" || vMeta.dtype !== "<f4") return null;
    // MỘT chunk toàn cầu / (ngày × tầng) — asset đổi cách chunk thì dừng
    if (uMeta.chunks[0] !== 1 || uMeta.chunks[2] !== uMeta.shape[2]) return null;

    const cfUnits = readZarrAttr(zmeta, "time", "units");
    const cf = typeof cfUnits === "string" ? parseCfTimeUnits(cfUnits) : null;
    if (!cf) return null;

    const [lats, lons, times, elev] = await Promise.all([
      readAxis("latitude", latMeta),
      readAxis("longitude", lonMeta),
      readAxis("time", timeMeta),
      readAxis("elevation", elevMeta),
    ]);
    const nLon = lonMeta.shape[0];
    const di = pickElevationIndex(elev, tierM);
    const depthM = Math.round(Math.abs(elev[di]) * 10) / 10;

    // mốc ngày: hôm nay 12:00 UTC + offset (bám lưới daily-mean — cùng quy ước
    // với lib độ mặn)
    const base = Math.floor(nowMs / DAY_MS) * DAY_MS + 12 * 60 * 60 * 1000;
    const nSteps = Math.max(1, Math.min(CUR_DEPTH_MAX_DAYS, Math.round(days)));

    const pts = gridPoints();
    // chỉ số ô nguồn cho từng điểm lưới (tính MỘT lần)
    const srcIdx = pts.map((p) => {
      let bi = 0;
      for (let i = 1; i < lats.length; i++)
        if (Math.abs(lats[i] - p.lat) < Math.abs(lats[bi] - p.lat)) bi = i;
      const lonQ = p.lon > 180 ? p.lon - 360 : p.lon;
      let bj = 0;
      for (let j = 1; j < lons.length; j++)
        if (Math.abs(lons[j] - lonQ) < Math.abs(lons[bj] - lonQ)) bj = j;
      return bi * nLon + bj;
    });

    const timesOut: string[] = [];
    const dayVals: { curKmh: number | null; curDirDeg: number | null }[][] = [];
    for (let s = 0; s < nSteps; s++) {
      const targetMs = base + s * DAY_MS;
      const ti = nearestIndex(times, (targetMs - cf.epochMs) / cf.msPerUnit);
      if (ti < 0) break;
      // quá xa mốc xin (> 1,5 ngày) = hết tầm dự báo — dừng, không kéo dài giả
      if (Math.abs(cfTimeToMs(times[ti], cf) - targetMs) > 1.5 * DAY_MS) break;
      const [uBuf, vBuf] = await Promise.all([
        getBuf(`uo/${ti}.${di}.0.0`, 21600),
        getBuf(`vo/${ti}.${di}.0.0`, 21600),
      ]);
      const u = decodeFloat32Chunk(uBuf);
      const v = decodeFloat32Chunk(vBuf);
      dayVals.push(
        srcIdx.map((idx) => {
          const uu = u[idx];
          const vv = v[idx];
          if (
            !Number.isFinite(uu) ||
            !Number.isFinite(vv) ||
            isFill(uu, uMeta.fillValue) ||
            isFill(vv, vMeta.fillValue) ||
            Math.abs(uu) > 10 ||
            Math.abs(vv) > 10
          )
            return { curKmh: null, curDirDeg: null };
          const kmh = Math.hypot(uu, vv) * 3.6;
          const dir = ((Math.atan2(uu, vv) * 180) / Math.PI + 360) % 360; // CHẢY VỀ
          return {
            curKmh: Math.round(kmh * 100) / 100,
            curDirDeg: Math.round(dir),
          };
        }),
      );
      timesOut.push(new Date(targetMs).toISOString().slice(0, 10) + "T12:00");
    }
    if (timesOut.length === 0) return null;

    const cells = pts.map((p, pi) => ({
      lat: p.lat,
      lon: p.lon,
      hours: dayVals.map(
        (dv): GridHour => ({
          windKmh: null,
          windDirDeg: null,
          waveM: null,
          waveDirDeg: null,
          curKmh: dv[pi].curKmh,
          curDirDeg: dv[pi].curDirDeg,
        }),
      ),
    }));

    return { cells, times: timesOut, tier: tierM, depthM };
  } catch {
    return null;
  }
}
