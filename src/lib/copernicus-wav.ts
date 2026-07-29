// Trục 1 — SÓNG DỰ PHÒNG Copernicus WAV (VHM0/VMDR) — nguồn VÉT CUỐI khi cả
// hai model sóng Open-Meteo (gfswave + ecmwf_wam) cùng chết (tức Open-Meteo
// sập/khoá): khác hẳn NHÀ CUNG CẤP nên sự cố không dính chùm.
//
// PROBE THẬT 2026-07-29 (scripts/copernicus-wav-probe.mjs): dataset
// GLOBAL_ANALYSISFORECAST_WAV_001_027 / cmems_mod_glo_wav_anfc_0.083deg_PT3H-i,
// asset downsampled4 (1/3°, MỘT chunk toàn cầu/mốc): VHM0 <i2 scale 0,01 (m,
// khớp Open-Meteo 1,46 vs 1,4 m); VMDR <i2 scale 0,01 offset 180 (độ, quy ước
// "TỚI TỪ" như gió/sóng — khớp 195° vs 199°); bước 3 giờ, tầm ~+9 ngày; chi phí
// ~930 KB/mốc cho CẢ 2 biến.
//
// TIẾT CHẾ: chỉ 2 mốc/ngày (03Z + 09Z = 10h + 16h VN) làm proxy "sóng tới …
// trong ngày", tối đa WAV_MAX_DAYS ngày ⇒ trần ~11 MB/lượt — và cron CHỈ gọi
// khi thật sự có ngày trống sóng. SERVER-ONLY (fetch S3 + giải nén).
//
// Attribution khi hiển thị: "Generated using E.U. Copernicus Marine Service
// Information".

import {
  decodeTypedChunk,
  readZarrArrayMeta,
  readZarrAttr,
  parseCfTimeUnits,
  nearestIndex,
  cfTimeToMs,
} from "@/lib/copernicus";

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const BASE =
  "https://s3.waw3-1.cloudferro.com/mdl-arco-time-015/arco/" +
  "GLOBAL_ANALYSISFORECAST_WAV_001_027/" +
  "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411/downsampled4.zarr";
const TIMEOUT_MS = 25000;

/** Trần số ngày vét (giữ ~11 MB/lượt; ngoài tầm này WAV cũng gần hết skill) */
export const WAV_MAX_DAYS = 6;
/** Mốc UTC lấy mỗi ngày: 10h + 16h VN — chiều gió mạnh, proxy max ngày ổn */
const STEP_HOURS_UTC = [3, 9] as const;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface WavBackup {
  /** các ngày VN (yyyy-mm-dd) có dữ liệu, theo thứ tự */
  days: string[];
  /** sóng ĐẠI DIỆN NGÀY tại (lat,lon): max của các mốc đã lấy + hướng "TỚI TỪ"
      của đúng mốc max — null nếu ô đất/ngoài lưới/số rác */
  sample(lat: number, lon: number, dayIdx: number): {
    waveM: number;
    waveDirDeg: number | null;
  } | null;
}

async function getBuf(path: string): Promise<Uint8Array> {
  const r = await fetch(`${BASE}/${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": UA },
  });
  if (!r.ok) throw new Error(`wav chunk ${r.status} ${path}`);
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
    const chunk = decodeTypedChunk(await getBuf(`${name}/${c}`), meta.dtype);
    for (let k = 0; k < cl && c * cl + k < len; k++) out[c * cl + k] = chunk[k];
  }
  return out;
}

/**
 * Tải sóng dự phòng cho tới `maxDays` ngày VN (hôm nay → +maxDays-1). Trả
 * `null` khi bất kỳ khâu nào hỏng — KHÔNG ném (cron coi như không có vét cuối).
 */
export async function fetchWavBackup(
  maxDays: number = WAV_MAX_DAYS,
  nowMs: number = Date.now(),
): Promise<WavBackup | null> {
  try {
    const zres = await fetch(`${BASE}/.zmetadata`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": UA },
    });
    if (!zres.ok) return null;
    const zmeta = await zres.json();

    const hMeta = readZarrArrayMeta(zmeta, "VHM0");
    const dMeta = readZarrArrayMeta(zmeta, "VMDR");
    const latMeta = readZarrArrayMeta(zmeta, "latitude");
    const lonMeta = readZarrArrayMeta(zmeta, "longitude");
    const timeMeta = readZarrArrayMeta(zmeta, "time");
    if (!hMeta || !dMeta || !latMeta || !lonMeta || !timeMeta) return null;
    // MỘT chunk toàn cầu/mốc — khác đi là asset đổi cách chunk, dừng cho an toàn
    if (hMeta.chunks[0] !== 1 || hMeta.chunks[1] !== hMeta.shape[1]) return null;

    const cfUnits = readZarrAttr(zmeta, "time", "units");
    const cf = typeof cfUnits === "string" ? parseCfTimeUnits(cfUnits) : null;
    if (!cf) return null;

    const num = (v: unknown, fb: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fb;
    const hScale = num(readZarrAttr(zmeta, "VHM0", "scale_factor"), 1);
    const hOffset = num(readZarrAttr(zmeta, "VHM0", "add_offset"), 0);
    const dScale = num(readZarrAttr(zmeta, "VMDR", "scale_factor"), 1);
    const dOffset = num(readZarrAttr(zmeta, "VMDR", "add_offset"), 0);

    const [lats, lons, times] = await Promise.all([
      readAxis("latitude", latMeta),
      readAxis("longitude", lonMeta),
      readAxis("time", timeMeta),
    ]);
    const nLon = lonMeta.shape[0];

    // ngày VN hôm nay 00:00 (UTC+7)
    const vnDayStart = Math.floor((nowMs + 7 * HOUR_MS) / DAY_MS) * DAY_MS - 7 * HOUR_MS;
    const lastMs = cfTimeToMs(times[times.length - 1], cf);

    interface Step {
      h: Float64Array;
      d: Float64Array;
    }
    const days: string[] = [];
    const stepsByDay: Step[][] = [];
    const nDays = Math.max(1, Math.min(WAV_MAX_DAYS, Math.round(maxDays)));
    for (let day = 0; day < nDays; day++) {
      const steps: Step[] = [];
      for (const hUtc of STEP_HOURS_UTC) {
        const targetMs = vnDayStart + day * DAY_MS + (hUtc + 7) * HOUR_MS - 7 * HOUR_MS;
        if (targetMs > lastMs + 3 * HOUR_MS) continue; // hết tầm nguồn
        const ti = nearestIndex(times, (targetMs - cf.epochMs) / cf.msPerUnit);
        if (ti < 0) continue;
        if (Math.abs(cfTimeToMs(times[ti], cf) - targetMs) > 3 * HOUR_MS) continue;
        const [hBuf, dBuf] = await Promise.all([
          getBuf(`VHM0/${ti}.0.0`),
          getBuf(`VMDR/${ti}.0.0`),
        ]);
        steps.push({
          h: decodeTypedChunk(hBuf, hMeta.dtype),
          d: decodeTypedChunk(dBuf, dMeta.dtype),
        });
      }
      if (steps.length === 0) break; // hết tầm — các ngày sau càng không có
      const dateVN = new Date(vnDayStart + day * DAY_MS + 7 * HOUR_MS)
        .toISOString()
        .slice(0, 10);
      days.push(dateVN);
      stepsByDay.push(steps);
    }
    if (days.length === 0) return null;

    const sample: WavBackup["sample"] = (lat, lon, dayIdx) => {
      const steps = stepsByDay[dayIdx];
      if (!steps) return null;
      // ô gần nhất — lưới 1/3° toàn cầu, ngoài phạm vi thì kẹp về rìa vẫn là
      // quá xa? Trục phủ toàn cầu nên điểm biển VN luôn nằm trong.
      let bi = 0;
      for (let i = 1; i < lats.length; i++)
        if (Math.abs(lats[i] - lat) < Math.abs(lats[bi] - lat)) bi = i;
      let bj = 0;
      const lonQ = lon > 180 ? lon - 360 : lon;
      for (let j = 1; j < lons.length; j++)
        if (Math.abs(lons[j] - lonQ) < Math.abs(lons[bj] - lonQ)) bj = j;
      const idx = bi * nLon + bj;
      let best: { waveM: number; waveDirDeg: number | null } | null = null;
      for (const s of steps) {
        const waveM = s.h[idx] * hScale + hOffset;
        // không có _FillValue khai — chặn số rác bằng dải vật lý (0..30 m)
        if (!Number.isFinite(waveM) || waveM < 0 || waveM > 30) continue;
        const dir = s.d[idx] * dScale + dOffset;
        const waveDirDeg =
          Number.isFinite(dir) && dir >= 0 && dir <= 360 ? dir : null;
        if (!best || waveM > best.waveM) {
          best = {
            waveM: Math.round(waveM * 100) / 100,
            waveDirDeg: waveDirDeg == null ? null : Math.round(waveDirDeg),
          };
        }
      }
      return best;
    };

    return { days, sample };
  } catch {
    return null;
  }
}
