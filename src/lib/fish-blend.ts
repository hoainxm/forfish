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

/* ── v2: CHUẨN HOÁ PHÂN VỊ + PHA TRÊN HỢP HAI TẬP ────────────────────────────
   VÌ SAO PHẢI SỬA (đo 2026-07-28, scripts/fish-blend-audit.mjs — chủ dự án hỏi
   "mùa vụ có tạo ra vị trí mới không hay chỉ kéo tụt điểm ảnh vệ tinh?"):

   · Bản mùa vụ dựng trên nhiệt/phù du TRUNG BÌNH nhiều năm ⇒ các FRONT (ranh
     nước — thứ đẻ ra điểm cao) bị làm mượt mất ⇒ thang điểm của nó BỊ NÉN
     (tháng 7: p90 40 / max 59, so với bản đồ ngày p90 44 / max 62).
   · Lưới cá chỉ chứa ô ≥25 điểm, nên vòng lặp cũ chạy trên DANH SÁCH Ô CỦA ẢNH
     — chỗ nào ảnh chê thì không có mặt để mà nâng.
   ⇒ Hệ quả đo được: 0 ô mới ở MỌI tầm ngày. Muốn một ô mới chạm sàn hiển thị 40
     ở ngày 16 thì mùa vụ phải đạt ≥88 điểm, trong khi cao nhất cả năm là 64 —
     tức là VỀ TOÁN HỌC không bao giờ xảy ra. Mùa vụ chỉ biết kéo xuống.

   NHƯNG mùa vụ THẬT SỰ biết chỗ: tương quan HẠNG với sự thật 0,46 / 0,43 / 0,45
   ở ngày 3 / 8 / 16 — gần như KHÔNG rữa theo ngày, trong khi ảnh vệ tinh rữa
   0,82 → 0,67 → 0,51. Tới ngày 16 hai bên xấp xỉ nhau. Vấn đề chỉ là BIÊN ĐỘ.

   CÁCH SỬA: quy điểm mùa vụ về ĐÚNG THANG của bản đồ ngày bằng PHÂN VỊ — ô nằm
   top 5% của mùa vụ được cho điểm bằng ô top 5% của bản đồ hôm nay. Giữ nguyên
   thứ tự (thông tin vị trí), chỉ kéo giãn biên độ. Rồi pha trên HỢP hai tập ô. */

/** Ô KHÔNG có trong lưới cá nghĩa là điểm < KEEP_MIN(25), không phải bằng 0 —
    lấy điểm giữa khoảng làm ước lượng. PHẢI khớp với scripts/fit-fish-blend-weights.mjs. */
export const ABSENT_PERSIST = 12;

/** Bảng quy đổi điểm mùa vụ (0..100) → điểm theo thang bản đồ ngày */
export type ClimScaleMap = Uint8Array;

/**
 * Dựng bảng quy đổi phân vị: điểm mùa vụ tháng `month` → thang điểm của
 * `dayScores` (điểm các ô bản đồ hôm nay). Cả hai chỉ tính ô > 0.
 * Thiếu dữ liệu một bên → bảng ĐỒNG NHẤT (quy đổi = chính nó, không bịa).
 */
export function buildClimScaleMap(
  clim: Climatology | null,
  month: number,
  dayScores: number[],
): ClimScaleMap {
  const identity = new Uint8Array(101);
  for (let i = 0; i <= 100; i++) identity[i] = i;
  const buf = clim?.months.get(month);
  if (!buf || !dayScores.length) return identity;

  // đếm phân bố (thang 0..100 nên đếm trực tiếp, không cần sort)
  const climHist = new Int32Array(101);
  let nClim = 0;
  for (const v of buf)
    if (v > 0) {
      climHist[Math.min(100, v)]++;
      nClim++;
    }
  const dayHist = new Int32Array(101);
  let nDay = 0;
  for (const v of dayScores)
    if (v > 0) {
      dayHist[Math.max(0, Math.min(100, Math.round(v)))]++;
      nDay++;
    }
  if (!nClim || !nDay) return identity;

  // CDF ngày → tra ngược: phân vị p ↦ điểm ngày nhỏ nhất có CDF ≥ p
  const dayAtPct: number[] = [];
  {
    let acc = 0;
    let s = 0;
    for (let step = 0; step <= 1000; step++) {
      const p = step / 1000;
      while (s <= 100 && (acc + dayHist[s]) / nDay < p) {
        acc += dayHist[s];
        s++;
      }
      dayAtPct.push(Math.min(100, s));
    }
  }

  const out = new Uint8Array(101);
  let acc = 0;
  for (let v = 0; v <= 100; v++) {
    if (v === 0) {
      out[0] = 0; // không có số mùa vụ → vẫn không có
      continue;
    }
    // phân vị GIỮA của bậc v (nửa khoảng — tránh dồn hết về một đầu)
    const p = (acc + climHist[v] / 2) / nClim;
    acc += climHist[v];
    out[v] = climHist[v] === 0 ? out[v - 1] : dayAtPct[Math.round(p * 1000)];
  }
  // đảm bảo KHÔNG GIẢM (giữ đúng thứ tự của mùa vụ)
  for (let v = 1; v <= 100; v++) if (out[v] < out[v - 1]) out[v] = out[v - 1];
  return out;
}

/**
 * Ô lớp cá để pha — cùng hình dạng `FishCell` của lib/fish-predict (khai lại ở
 * đây để fish-blend KHÔNG phụ thuộc ngược vào fish-predict; hai bên khớp field).
 * `fromClim` = ô do BẢN MÙA VỤ sinh ra (ảnh vệ tinh hôm nay không có ô này).
 */
export interface BlendableCell {
  lat: number;
  lon: number;
  s: number;
  top: string[];
  sp: Record<string, number>;
  t: number;
  c: number | null;
  fromClim?: boolean;
}

/**
 * Pha lớp cá cho ngày thứ `dayIdx` trên HỢP (ô ảnh ∪ ô mùa vụ đủ mạnh).
 *
 * · dayIdx 0 / thiếu mùa vụ / bảng w suy biến → TRẢ NGUYÊN mảng cũ (bất biến:
 *   hôm nay không bao giờ đổi, mất nguồn thì không bịa).
 * · Ô chỉ có ở mùa vụ: điểm ảnh coi như `ABSENT_PERSIST`; ô mới được gắn
 *   `fromClim: true` để chỗ gọi phân biệt được nếu cần.
 * · Điểm từng LOÀI giữ TỈ LỆ với điểm chung (mùa vụ chỉ có một lớp chung).
 */
export function blendFishCells(
  cells: BlendableCell[],
  clim: Climatology | null,
  month: number,
  dayIdx: number,
  opts?: { gridStep?: number },
): BlendableCell[] {
  if (!cells.length || dayIdx <= 0 || !clim || !BLEND_USABLE) return cells;
  const buf = clim.months.get(month);
  if (!buf) return cells;

  const w = blendWeight(dayIdx);
  const scale = buildClimScaleMap(
    clim,
    month,
    cells.map((c) => c.s),
  );
  const { lat0, lon0, dLat, dLon, nLat, nLon } = clim.meta;
  const step = opts?.gridStep ?? (Math.abs(dLat) || 0.25);
  const key = (lat: number, lon: number) =>
    `${Math.round(lat / step)},${Math.round(lon / step)}`;

  const seen = new Set<string>();
  const out: BlendableCell[] = [];

  for (const c of cells) {
    seen.add(key(c.lat, c.lon));
    const i = Math.round((c.lat - lat0) / dLat);
    const j = Math.round((c.lon - lon0) / dLon);
    const raw =
      i >= 0 && i < nLat && j >= 0 && j < nLon ? (buf[i * nLon + j] ?? 0) : 0;
    const climS = scale[Math.min(100, raw)] ?? 0;
    const s = Math.max(0, Math.min(100, Math.round(w * c.s + (1 - w) * climS)));
    let sp = c.sp;
    if (c.sp && c.s > 0 && s !== c.s) {
      const k = s / c.s;
      sp = Object.fromEntries(
        Object.entries(c.sp).map(([n, v]) => [
          n,
          Math.max(0, Math.min(100, Math.round(v * k))),
        ]),
      );
    }
    out.push({ ...c, s, sp });
  }

  // Ô CHỈ CÓ Ở MÙA VỤ — đây mới là chỗ đẻ ra VỊ TRÍ MỚI cho ngày xa
  for (let i = 0; i < nLat; i++)
    for (let j = 0; j < nLon; j++) {
      const raw = buf[i * nLon + j] ?? 0;
      if (!raw) continue;
      const lat = Math.round((lat0 + i * dLat) * 100) / 100;
      const lon = Math.round((lon0 + j * dLon) * 100) / 100;
      if (seen.has(key(lat, lon))) continue;
      const climS = scale[Math.min(100, raw)] ?? 0;
      const s = Math.max(
        0,
        Math.min(100, Math.round(w * ABSENT_PERSIST + (1 - w) * climS)),
      );
      if (s <= 0) continue;
      out.push({ lat, lon, s, sp: {}, top: [], t: 0, c: null, fromClim: true });
    }

  return out;
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
