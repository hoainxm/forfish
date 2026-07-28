// Trục 1 — LỚP CÁ CHO CHUYẾN DÀI: pha trộn bản DỰ BÁO (ảnh vệ tinh hôm nay)
// với bản MÙA VỤ (điều kiện điển hình của tháng, dựng từ nhiều năm lịch sử).
//
//     blend(ô, d) = w(d)·persist(ô) + (1 − w(d))·clim(ô, tháng đích)
//
// VÌ SAO: lộ trình chuyến biển tới 16 NGÀY, nhưng ảnh vệ tinh chỉ nói được vài
// ngày đầu. Ngày xa mà vẫn bê nguyên ảnh hôm nay là hứa hão; rơi về mùa vụ thì
// mất thông tin đang có. Pha trộn giữ được cả hai.
//
// w(d) KHÔNG ĐẶT TAY (chủ dự án chốt 2026-07-28): đo bằng backtest thật ở
// scripts/fit-fish-blend-weights.mjs → src/data/fish-blend-weights.json.
// Sửa w phải chạy lại script, KHÔNG gõ số vào đây.
//
// OFFLINE (bất biến của app): bảng w NHÚNG THẲNG vào bundle (JSON nhỏ, không
// bao giờ phải tải); bản mùa vụ là asset tĩnh /data/fish-climatology.v1.json
// đã nằm trong danh sách pre-cache của service worker → giữa biển mất sóng vẫn
// dựng được lộ trình. Thiếu bản mùa vụ ⇒ TRẢ NGUYÊN bản dự báo (bất biến
// monotonic: mất nguồn thì bớt thông tin, KHÔNG bịa thêm).

import weightsRaw from "@/data/fish-blend-weights.json";

/* ── bảng trọng số (sinh offline) ─────────────────────────────────────────── */

interface LeadRow {
  lead: number;
  w: number | null;
}
interface WeightsFile {
  perLead?: LeadRow[];
  guard?: { degenerate?: boolean; verdict?: string };
  cvWinsOverPersistence?: number[];
}

const WEIGHTS = weightsRaw as WeightsFile;

/** Các mốc tầm ngày đã ĐO được, tăng dần, đã bỏ mốc thiếu số */
const MEASURED: { lead: number; w: number }[] = (WEIGHTS.perLead ?? [])
  .filter((r): r is { lead: number; w: number } => typeof r?.w === "number")
  .map((r) => ({ lead: r.lead, w: Math.min(1, Math.max(0, r.w)) }))
  .sort((a, b) => a.lead - b.lead);

/** Bảng w có dùng được không — rỗng/suy biến thì lớp blend tự tắt (giữ persist) */
export const BLEND_USABLE =
  MEASURED.length > 0 && WEIGHTS.guard?.degenerate !== true;

/** Tầm ngày xa nhất bảng w nói được (ngày) — quá mốc này giữ w của mốc cuối */
export const MAX_MEASURED_LEAD = MEASURED.length
  ? MEASURED[MEASURED.length - 1].lead
  : 0;

/**
 * Tỷ lệ tin bản DỰ BÁO tại tầm `dayIdx` ngày (0 = hôm nay).
 * · d ≤ mốc đo đầu tiên → w của mốc đó (hôm nay luôn 1: chính là ảnh hôm nay)
 * · giữa hai mốc đã đo → nội suy tuyến tính
 * · quá mốc cuối → giữ w mốc cuối (KHÔNG ngoại suy — không có số thì không đoán)
 * · bảng hỏng/suy biến → 1 (dùng thẳng bản dự báo, không pha)
 */
export function blendWeight(dayIdx: number): number {
  if (!BLEND_USABLE) return 1;
  const d = Math.max(0, dayIdx);
  if (d === 0) return 1; // hôm nay = chính ảnh hôm nay, không pha
  if (d <= MEASURED[0].lead) {
    // từ 1 (ngày 0) hạ dần về w đo được ở mốc đầu
    const t = d / MEASURED[0].lead;
    return 1 + t * (MEASURED[0].w - 1);
  }
  for (let i = 0; i < MEASURED.length - 1; i++) {
    const a = MEASURED[i];
    const b = MEASURED[i + 1];
    if (d <= b.lead) {
      const t = (d - a.lead) / (b.lead - a.lead);
      return a.w + t * (b.w - a.w);
    }
  }
  return MEASURED[MEASURED.length - 1].w;
}

/* ── bản mùa vụ (asset tĩnh, SW giữ offline) ──────────────────────────────── */

export interface ClimatologyFile {
  v: number;
  generatedAt?: string;
  years?: [number, number];
  lat0: number;
  lon0: number;
  dLat: number;
  dLon: number;
  nLat: number;
  nLon: number;
  /** tháng 1..12 → điểm 0..100 mỗi ô, mã base64 của Uint8Array (row-major theo lat) */
  months: Record<string, string>;
}

export interface Climatology {
  meta: Omit<ClimatologyFile, "months">;
  months: Map<number, Uint8Array>;
}

/** Giải mã file mùa vụ; tháng thiếu bị bỏ (tra sẽ trả 0 = không có gì thêm) */
export function decodeClimatology(file: ClimatologyFile): Climatology {
  const need = file.nLat * file.nLon;
  const months = new Map<number, Uint8Array>();
  for (let m = 1; m <= 12; m++) {
    const b64 = file.months?.[String(m)];
    if (!b64) continue;
    const bin = typeof atob === "function" ? atob(b64) : "";
    if (!bin) continue;
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    if (arr.length !== need) continue; // cỡ sai = file hỏng, bỏ tháng đó
    months.set(m, arr);
  }
  const meta: Omit<ClimatologyFile, "months"> = {
    v: file.v,
    generatedAt: file.generatedAt,
    years: file.years,
    lat0: file.lat0,
    lon0: file.lon0,
    dLat: file.dLat,
    dLon: file.dLon,
    nLat: file.nLat,
    nLon: file.nLon,
  };
  return { meta, months };
}

/**
 * Điểm mùa vụ tại một toạ độ trong tháng `month` (1..12).
 * Ngoài lưới / thiếu tháng → 0 (nghĩa: mùa vụ không nói gì thêm về chỗ này).
 */
export function climScoreAt(
  clim: Climatology | null,
  lat: number,
  lon: number,
  month: number,
): number {
  if (!clim) return 0;
  const buf = clim.months.get(month);
  if (!buf) return 0;
  const { lat0, lon0, dLat, dLon, nLat, nLon } = clim.meta;
  const i = Math.round((lat - lat0) / dLat);
  const j = Math.round((lon - lon0) / dLon);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return 0;
  return buf[i * nLon + j] ?? 0;
}

/**
 * Điểm cá dùng cho NGÀY THỨ `dayIdx` của chuyến.
 * `persistS` = điểm bản dự báo (ảnh hôm nay); `climS` = điểm mùa vụ tháng đích.
 * Trả số nguyên 0..100 để đồng nhất với thang điểm đang dùng khắp app.
 */
export function blendScore(
  persistS: number,
  climS: number,
  dayIdx: number,
): number {
  const w = blendWeight(dayIdx);
  const v = w * persistS + (1 - w) * climS;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/* ── nạp asset (client) ───────────────────────────────────────────────────── */

let cached: Promise<Climatology | null> | null = null;

/**
 * Tải bản mùa vụ (~70 KB, cùng origin, SW pre-cache) — cache cho cả phiên.
 * KHÔNG BAO GIỜ ném: hỏng/mất mạng-chưa-cache → null → blend tự giữ bản dự báo.
 */
export function fetchClimatology(): Promise<Climatology | null> {
  if (!cached) {
    cached = fetch("/data/fish-climatology.v1.json", {
      signal: AbortSignal.timeout(15000),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`climatology ${r.status}`);
        return r.json();
      })
      .then((j) => decodeClimatology(j as ClimatologyFile))
      .catch(() => null);
  }
  return cached;
}
