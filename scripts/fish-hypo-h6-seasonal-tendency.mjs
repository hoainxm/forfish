// scripts/fish-hypo-h6-seasonal-tendency.mjs
// (chạy: npx tsx scripts/fish-hypo-h6-seasonal-tendency.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// KIỂM CHỨNG GIẢ THUYẾT #6 — CỘNG XU HƯỚNG MÙA (anomaly-persistence)
//
// Phép đang dùng (khai triển): clim(THÁNG đích) + w·(S_T − clim(THÁNG đích))
// Dạng khí tượng chuẩn:        clim(NGÀY đích) + λ·(S_T − clim(NGÀY gốc))
// Chênh nhau đúng số hạng XU HƯỚNG MÙA: λ·[clim(doy đích) − clim(doy gốc)]
//
// BƯỚC (e) VỆ SINH: xu hướng 16 ngày có khác 0 không? Gần 0 ⇒ dừng.
// BƯỚC (b,c,d): so 3 bản trên CÙNG mẫu, LOYO 4 năm cho λ, tách mùa chuyển
//   (tháng 4/10) vs giữa mùa (tháng 1/7) — DỰ ĐOÁN ĐĂNG KÝ TRƯỚC: lợi phải
//   TẬP TRUNG ở tháng 4 và 10.
//
// KHÔNG SỬA src/. KHÔNG tải thêm dữ liệu (0 request).
// KẾT QUẢ: .cache/fish-hypo-h6-result.json + bảng console.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildClimScaleMap,
  decodeClimatology,
  ABSENT_PERSIST,
  climShare,
} from "../src/lib/fish-blend.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, ".cache", "fish-corpus");
const CLIM_PATH = join(ROOT, "public", "data", "fish-climatology.v1.json");
const OUT = join(ROOT, ".cache", "fish-hypo-h6-result.json");

const TOP_K = 100;
/** 0 trong bản mùa vụ = "dưới ngưỡng giữ", KHÔNG phải thiếu dữ liệu.
    Thay bằng hằng số dưới ngưỡng để nội suy theo ngày không bị gãy. */
const CLIM_CENSORED = 12;
const LAMBDA_GRID = [];
for (let x = 0; x <= 2.0001; x += 0.05) LAMBDA_GRID.push(Math.round(x * 100) / 100);

/** tháng gốc CHUYỂN MÙA vs GIỮA MÙA (dự đoán đăng ký trước của giả thuyết) */
const TRANS = [4, 10];
const MID = [1, 7];

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const doyOf = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.round((d.getTime() - start) / 86400000) + 1; // 1..366
};

/* ── nạp kho ──────────────────────────────────────────────────────────────── */
if (!existsSync(join(CORPUS, "index.json"))) {
  console.error(`KHÔNG thấy ${CORPUS}/index.json`);
  process.exit(1);
}
const INDEX = JSON.parse(readFileSync(join(CORPUS, "index.json"), "utf8"));
const CLIM_FILE = JSON.parse(readFileSync(CLIM_PATH, "utf8"));
const CLIM = decodeClimatology(CLIM_FILE);
const { lat0, lon0, dLat, dLon, nLat, nLon } = CLIM.meta;
const NCELL = nLat * nLon;

const dayCache = new Map();
function loadDay(date) {
  if (dayCache.has(date)) return dayCache.get(date);
  const p = join(CORPUS, "days", `${date}.json`);
  const v = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  dayCache.set(date, v);
  return v;
}

/* ── (a) MÙA VỤ THEO NGÀY TRONG NĂM — spline vòng qua 12 bản đồ tháng ─────── */
// Mỏ neo: tâm tháng (năm không nhuận). Nội suy Catmull-Rom VÒNG trên trục
// "chỉ số tháng phân số"; doy → chỉ số phân số bằng nội suy tuyến tính giữa
// hai tâm tháng kề nhau (vòng qua giao thừa).
const MONTH_LEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_START = [];
{
  let acc = 1;
  for (let m = 0; m < 12; m++) {
    MONTH_START.push(acc);
    acc += MONTH_LEN[m];
  }
}
const MONTH_CENTER = MONTH_START.map((s, m) => s + (MONTH_LEN[m] - 1) / 2); // doy

/** doy → vị trí phân số trên trục tháng (0..12, vòng) */
function doyToMonthPos(doy) {
  const d = ((doy - 1) % 365) + 1;
  for (let m = 0; m < 12; m++) {
    const c0 = MONTH_CENTER[m];
    const c1 = m === 11 ? MONTH_CENTER[0] + 365 : MONTH_CENTER[m + 1];
    if (d >= c0 && d <= c1) return m + (d - c0) / (c1 - c0);
    if (m === 11) {
      // đoạn cuối năm vòng về tháng 1
      const dd = d + 365;
      if (dd >= c0 && dd <= c1) return m + (dd - c0) / (c1 - c0);
    }
  }
  return 0;
}

// bản đồ tháng ở dạng float, 0 → CLIM_CENSORED cho ô có dữ liệu ít nhất 1 tháng
const MONTH_BUF = [];
for (let m = 1; m <= 12; m++) MONTH_BUF.push(CLIM.months.get(m) ?? new Uint8Array(NCELL));
const HAS_CLIM = new Uint8Array(NCELL); // ô nằm trong miền mùa vụ?
for (let i = 0; i < NCELL; i++) {
  let any = 0;
  for (let m = 0; m < 12; m++) if (MONTH_BUF[m][i] > 0) any = 1;
  HAS_CLIM[i] = any;
}
const MONTH_F = []; // 12 × Float32Array
for (let m = 0; m < 12; m++) {
  const a = new Float32Array(NCELL);
  for (let i = 0; i < NCELL; i++) {
    if (!HAS_CLIM[i]) a[i] = 0;
    else a[i] = MONTH_BUF[m][i] > 0 ? MONTH_BUF[m][i] : CLIM_CENSORED;
  }
  MONTH_F.push(a);
}

const climDayCache = new Map();
/** Bản mùa vụ NỘI SUY tại doy (Float32Array cỡ NCELL, đơn vị điểm mùa vụ thô) */
function climAtDoy(doy) {
  const key = Math.round(doy);
  if (climDayCache.has(key)) return climDayCache.get(key);
  const pos = doyToMonthPos(key);
  const m1 = Math.floor(pos) % 12;
  const t = pos - Math.floor(pos);
  const m0 = (m1 + 11) % 12;
  const m2 = (m1 + 1) % 12;
  const m3 = (m1 + 2) % 12;
  const out = new Float32Array(NCELL);
  const t2 = t * t;
  const t3 = t2 * t;
  // Catmull-Rom
  const c0 = -0.5 * t3 + t2 - 0.5 * t;
  const c1 = 1.5 * t3 - 2.5 * t2 + 1;
  const c2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
  const c3 = 0.5 * t3 - 0.5 * t2;
  const A = MONTH_F[m0], B = MONTH_F[m1], C = MONTH_F[m2], D = MONTH_F[m3];
  for (let i = 0; i < NCELL; i++) {
    if (!HAS_CLIM[i]) { out[i] = 0; continue; }
    const v = c0 * A[i] + c1 * B[i] + c2 * C[i] + c3 * D[i];
    out[i] = v < 0 ? 0 : v > 100 ? 100 : v;
  }
  climDayCache.set(key, out);
  return out;
}

/* ── quy thang phân vị CHUNG cho mùa vụ theo ngày ─────────────────────────── */
// Một bảng DUY NHẤT cho cả doy gốc lẫn doy đích (nếu quy riêng thì chênh lệch
// bị bóp méo). Nguồn tham chiếu: phân bố mùa vụ gộp cả 12 tháng.
const CLIM_POOL = (() => {
  const v = [];
  for (let m = 0; m < 12; m++)
    for (let i = 0; i < NCELL; i++) if (HAS_CLIM[i]) v.push(MONTH_F[m][i]);
  v.sort((a, b) => a - b);
  return Float64Array.from(v);
})();

/** Dựng hàm quy đổi: giá trị mùa vụ thô → thang điểm bản đồ ngày T */
function makeClimQuantileMap(dayScores) {
  const tgt = dayScores.filter((s) => s > 0).sort((a, b) => a - b);
  if (!tgt.length || !CLIM_POOL.length) return (v) => v;
  const nP = CLIM_POOL.length;
  const nT = tgt.length;
  return (v) => {
    if (v <= 0) return 0;
    // vị trí của v trong phân bố mùa vụ (tìm nhị phân, lấy giữa khoảng bằng nhau)
    let lo = 0, hi = nP;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (CLIM_POOL[mid] < v) lo = mid + 1; else hi = mid; }
    let lo2 = 0, hi2 = nP;
    while (lo2 < hi2) { const mid = (lo2 + hi2) >> 1; if (CLIM_POOL[mid] <= v) lo2 = mid + 1; else hi2 = mid; }
    const p = ((lo + lo2) / 2) / nP;
    const k = Math.min(nT - 1, Math.max(0, Math.round(p * (nT - 1))));
    return tgt[k];
  };
}

/* ── thước đo ─────────────────────────────────────────────────────────────── */
function topKIdx(vals, K) {
  const heap = [];
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = (i) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
  for (let i = 0; i < vals.length; i++) {
    if (heap.length < K) { heap.push([vals[i], i]); up(heap.length - 1); }
    else if (vals[i] > heap[0][0]) { heap[0] = [vals[i], i]; down(0); }
  }
  return heap.map((h) => h[1]);
}
function hitOf(topTrue, pred) {
  let h = 0;
  for (const i of topKIdx(pred, TOP_K)) if (topTrue.has(i)) h++;
  return (h / TOP_K) * 100; // ĐIỂM %
}
const quant = (sorted, p) => {
  if (!sorted.length) return 0;
  const k = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[k];
};

/* ── DỰNG MẪU ─────────────────────────────────────────────────────────────── */
const LEADS = INDEX.leads.filter((d) => d >= 1 && d <= 16);
const cellKey = (lat, lon) => `${lat},${lon}`;
/** map từ khoá ô → chỉ số phẳng trong lưới mùa vụ (hoặc -1) */
function flatIdx(lat, lon) {
  const i = Math.round((lat - lat0) / dLat);
  const j = Math.round((lon - lon0) / dLon);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return -1;
  return i * nLon + j;
}

const samples = []; // {origin, year, month, lead, P, Cmon, CdOrg, CdTgt, topTrue}
let skipped = 0;
const driftStats = [];

for (const T of INDEX.origins) {
  const dayT = loadDay(T);
  if (!dayT) { skipped++; continue; }
  const persist = new Map(dayT.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
  const dayScores = dayT.cells.map((c) => c.s);
  const qmap = makeClimQuantileMap(dayScores);
  const doyOrg = doyOf(T);
  const CdOrgFull = climAtDoy(doyOrg);

  for (const d of LEADS) {
    const target = addDays(T, d);
    const dayY = loadDay(target);
    if (!dayY) { skipped++; continue; }
    const mTgt = dayY.month;
    const truth = new Map(dayY.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
    // thang quy đổi cho MÙA VỤ THÁNG (đường cơ sở hiện tại — giữ NGUYÊN hàm gốc)
    const scaleMon = buildClimScaleMap(CLIM, mTgt, dayScores);
    const bufMon = CLIM.months.get(mTgt);
    const CdTgtFull = climAtDoy(doyOf(target));

    // HỢP TẬP ô (khớp knee-probe): ô ảnh ∪ ô sự thật ∪ ô mùa vụ tháng đích
    const keys = new Set([...persist.keys(), ...truth.keys()]);
    if (bufMon)
      for (let i = 0; i < nLat; i++)
        for (let j = 0; j < nLon; j++) {
          if (!bufMon[i * nLon + j]) continue;
          keys.add(cellKey(
            Math.round((lat0 + i * dLat) * 100) / 100,
            Math.round((lon0 + j * dLon) * 100) / 100,
          ));
        }

    const n = keys.size;
    const P = new Float64Array(n);
    const Cmon = new Float64Array(n);
    const CdOrg = new Float64Array(n);
    const CdTgt = new Float64Array(n);
    const Y = new Float64Array(n);
    const flat = new Int32Array(n);
    let i = 0;
    for (const k of keys) {
      const [lat, lon] = k.split(",").map(Number);
      const fi = flatIdx(lat, lon);
      flat[i] = fi;
      P[i] = persist.has(k) ? persist.get(k) : ABSENT_PERSIST;
      Y[i] = truth.has(k) ? truth.get(k) : ABSENT_PERSIST;
      Cmon[i] = fi >= 0 ? (scaleMon[Math.min(100, bufMon ? (bufMon[fi] ?? 0) : 0)] ?? 0) : 0;
      CdOrg[i] = fi >= 0 && HAS_CLIM[fi] ? qmap(CdOrgFull[fi]) : 0;
      CdTgt[i] = fi >= 0 && HAS_CLIM[fi] ? qmap(CdTgtFull[fi]) : 0;
      i++;
    }
    samples.push({
      origin: T,
      year: Number(T.slice(0, 4)),
      monthOrg: Number(T.slice(5, 7)),
      lead: d,
      P, Cmon, CdOrg, CdTgt, flat,
      topTrue: new Set(topKIdx(Y, TOP_K)),
      nCells: n,
    });

    // ── (e) VỆ SINH: độ lớn xu hướng mùa trên thang bản đồ ngày ────────────
    const absD = [];
    const absDmon = [];
    for (let q = 0; q < n; q++) {
      const fi = -1; // dùng mảng đã dựng
      absD.push(Math.abs(CdTgt[q] - CdOrg[q]));
      absDmon.push(Math.abs(Cmon[q] - Cmon[q])); // theo THÁNG: gốc==đích khi cùng tháng
      void fi;
    }
    absD.sort((a, b) => a - b);
    driftStats.push({
      origin: T, lead: d, monthOrg: Number(T.slice(5, 7)), monthTgt: mTgt,
      p50: r2(quant(absD, 0.5)), p90: r2(quant(absD, 0.9)),
      p99: r2(quant(absD, 0.99)), max: r2(absD[absD.length - 1] ?? 0),
      mean: r2(absD.reduce((a, b) => a + b, 0) / (absD.length || 1)),
    });
    void absDmon;
  }
  process.stdout.write(".");
}
console.log(`\nmẫu: ${samples.length} cặp (mốc gốc × tầm), bỏ ${skipped}\n`);

/* ── BƯỚC (e) — KIỂM TRA VỆ SINH ──────────────────────────────────────────── */
console.log("=== (e) VỆ SINH · XU HƯỚNG MÙA |clim(doy đích) − clim(doy gốc)| (thang điểm bản đồ ngày) ===");
const byLeadDrift = [];
for (const d of LEADS) {
  const rows = driftStats.filter((r) => r.lead === d);
  const m = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
  byLeadDrift.push({
    "tầm(ngày)": d,
    "p50": r2(m((r) => r.p50)),
    "p90": r2(m((r) => r.p90)),
    "p99": r2(m((r) => r.p99)),
    "max": r2(m((r) => r.max)),
    "p90 gốc T4/T10": r2(
      rows.filter((r) => r.monthOrg === 4 || r.monthOrg === 10)
        .reduce((a, r, _i, arr) => a + r.p90 / arr.length, 0),
    ),
    "p90 gốc T1/T7": r2(
      rows.filter((r) => r.monthOrg === 1 || r.monthOrg === 7)
        .reduce((a, r, _i, arr) => a + r.p90 / arr.length, 0),
    ),
  });
}
console.table(byLeadDrift);
const drift16 = driftStats.filter((r) => r.lead === 16);
const p90at16 = drift16.reduce((a, r) => a + r.p90, 0) / (drift16.length || 1);
const GATE_E_PASS = p90at16 >= 2;
console.log(
  `\n(e) p90 xu hướng ở tầm 16 ngày = ${r2(p90at16)} điểm → ${GATE_E_PASS ? "QUA (≥2)" : "TRƯỢT (<2) ⇒ BÁC BỎ ngay tại (e)"}\n`,
);
// so sánh: xu hướng theo THÁNG (cấu tạo = 0 khi cùng tháng)
const sameMonth = driftStats.filter((r) => r.monthOrg === r.monthTgt).length;
console.log(`ghi chú cấu tạo: ${sameMonth}/${driftStats.length} cặp có tháng gốc = tháng đích ⇒ xu hướng theo THÁNG bằng 0 đúng như giả thuyết nói.\n`);

/* ── CÁC BẢN DỰ ĐOÁN ──────────────────────────────────────────────────────── */
/** V0 ảnh thuần */
const predPersist = (s) => s.P;
/** V1 pha trộn hiện tại (mùa vụ THÁNG đích, share = climShare runtime) */
function predCurrent(s) {
  const sh = climShare(s.lead);
  const n = s.P.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (1 - sh) * s.P[i] + sh * s.Cmon[i];
  return out;
}
/** H6  — cộng dị thường, mùa vụ theo NGÀY:  Cd_tgt + λ(P − Cd_org) */
function predH6(s, lam) {
  const n = s.P.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = s.CdTgt[i] + lam * (s.P[i] - s.CdOrg[i]);
  return out;
}
/** H6m — cộng dị thường nhưng mùa vụ theo THÁNG (kiểm cơ chế: cùng tháng ⇒ = pha lồi) */
function predH6m(s, lam) {
  const n = s.P.length;
  const out = new Float64Array(n);
  // mùa vụ tháng GỐC quy về cùng thang (dùng bảng của tháng gốc trên phân bố ngày T)
  for (let i = 0; i < n; i++) out[i] = s.Cmon[i] + lam * (s.P[i] - s.CmonOrg[i]);
  return out;
}
/** H6drift — CHỈ cộng phần dịch vào ảnh: P + μ(Cd_tgt − Cd_org) */
function predH6drift(s, mu) {
  const n = s.P.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = s.P[i] + mu * (s.CdTgt[i] - s.CdOrg[i]);
  return out;
}

// dựng Cmon theo THÁNG GỐC cho H6m
{
  const scaleCache = new Map();
  for (const s of samples) {
    const dayT = loadDay(s.origin);
    const dayScores = dayT.cells.map((c) => c.s);
    const mOrg = dayT.month;
    const ck = `${s.origin}|${mOrg}`;
    let sc = scaleCache.get(ck);
    if (!sc) { sc = buildClimScaleMap(CLIM, mOrg, dayScores); scaleCache.set(ck, sc); }
    const bufOrg = CLIM.months.get(mOrg);
    // cần lại danh sách khoá ô theo đúng thứ tự → dựng lại y hệt vòng trên
    // (rẻ hơn là lưu sẵn; ở đây lưu chỉ số phẳng lúc dựng mẫu)
    const n = s.P.length;
    const arr = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const fi = s.flat[i];
      arr[i] = fi >= 0 && bufOrg ? (sc[Math.min(100, bufOrg[fi] ?? 0)] ?? 0) : 0;
    }
    s.CmonOrg = arr;
  }
}

/** ĐỐI CHỨNG QUYẾT ĐỊNH — pha LỒI với mùa vụ theo NGÀY, XU HƯỚNG BỊ TRIỆT TIÊU:
    thay Cd_org bằng chính Cd_tgt ⇒ F = (1−λ)·Cd_tgt + λ·P.
    Nếu V1d ≈ H6 thì số hạng XU HƯỚNG KHÔNG đóng góp gì — cái ăn tiền chỉ là
    "mùa vụ nội suy theo ngày tốt hơn mùa vụ theo tháng", KHÔNG phải cơ chế H6. */
function predV1d(s, lam) {
  const n = s.P.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = s.CdTgt[i] + lam * (s.P[i] - s.CdTgt[i]);
  return out;
}

const VARIANTS = {
  H6: { fn: predH6, grid: LAMBDA_GRID, param: "λ" },
  H6m: { fn: predH6m, grid: LAMBDA_GRID, param: "λ" },
  H6drift: { fn: predH6drift, grid: LAMBDA_GRID, param: "μ" },
  V1d: { fn: predV1d, grid: LAMBDA_GRID, param: "λ" },
};

/* ── điểm cơ sở ───────────────────────────────────────────────────────────── */
for (const s of samples) {
  s.hitPersist = hitOf(s.topTrue, predPersist(s));
  s.hitCurrent = hitOf(s.topTrue, predCurrent(s));
  s.hitGrid = {};
  for (const [name, v] of Object.entries(VARIANTS)) {
    s.hitGrid[name] = v.grid.map((g) => hitOf(s.topTrue, v.fn(s, g)));
  }
}

const YEARS = [...new Set(samples.map((s) => s.year))].sort();
const ORIGINS = [...new Set(samples.map((s) => s.origin))].sort();

/** λ tốt nhất cho (variant, lead) trên tập mẫu cho trước */
function bestParam(name, lead, subset) {
  const grid = VARIANTS[name].grid;
  const ss = subset.filter((s) => s.lead === lead);
  if (!ss.length) return { idx: 0, val: grid[0], hit: 0 };
  let bi = 0, bh = -1;
  for (let g = 0; g < grid.length; g++) {
    let acc = 0;
    for (const s of ss) acc += s.hitGrid[name][g];
    const h = acc / ss.length;
    if (h > bh) { bh = h; bi = g; }
  }
  return { idx: bi, val: grid[bi], hit: bh };
}

/* ── LOYO 4 năm cho λ ─────────────────────────────────────────────────────── */
for (const s of samples) s.hitLoyo = {};
const loyoParams = {};
for (const name of Object.keys(VARIANTS)) {
  loyoParams[name] = {};
  for (const d of LEADS) {
    loyoParams[name][d] = {};
    for (const y of YEARS) {
      const train = samples.filter((s) => s.year !== y);
      const bp = bestParam(name, d, train);
      loyoParams[name][d][y] = bp.val;
      for (const s of samples) if (s.lead === d && s.year === y) s.hitLoyo[name] = s.hitGrid[name][bp.idx];
    }
  }
}
// tham số fit trên TOÀN BỘ (để báo cáo, không dùng cho kết luận)
const fullParams = {};
for (const name of Object.keys(VARIANTS)) {
  fullParams[name] = {};
  for (const d of LEADS) fullParams[name][d] = bestParam(name, d, samples).val;
}

/* ── BẢNG THEO TẦM NGÀY ───────────────────────────────────────────────────── */
const meanBy = (ss, f) => ss.reduce((a, s) => a + f(s), 0) / (ss.length || 1);
const perLead = [];
for (const d of LEADS) {
  const ss = samples.filter((s) => s.lead === d);
  const row = {
    lead: d,
    n: ss.length,
    persist: r1(meanBy(ss, (s) => s.hitPersist)),
    current: r1(meanBy(ss, (s) => s.hitCurrent)),
  };
  for (const name of Object.keys(VARIANTS)) {
    row[`${name}_loyo`] = r1(meanBy(ss, (s) => s.hitLoyo[name]));
    row[`${name}_param`] = fullParams[name][d];
  }
  perLead.push(row);
}
console.log("=== (b,c) TOP-100 HIT THEO TẦM NGÀY (điểm %, LOYO cho λ) ===");
console.table(perLead.map((r) => ({
  "tầm": r.lead, "n": r.n,
  "ảnh thuần": r.persist,
  "pha hiện tại": r.current,
  "H6 (LOYO)": r.H6_loyo, "λ*": r.H6_param,
  "H6m (LOYO)": r.H6m_loyo, "λm*": r.H6m_param,
  "H6drift (LOYO)": r.H6drift_loyo, "μ*": r.H6drift_param,
  "V1d đối chứng": r.V1d_loyo, "λd*": r.V1d_param,
})));

/* ── ĐỐI CHỨNG QUYẾT ĐỊNH: H6 − V1d = đóng góp RIÊNG của số hạng xu hướng ─── */
console.log("\n=== ĐỐI CHỨNG · H6 trừ V1d (cùng mùa vụ theo NGÀY, chỉ khác CÓ/KHÔNG số hạng xu hướng) ===");
{
  const all = pairedByOrigin((s) => s.hitLoyo.H6 - s.hitLoyo.V1d);
  const far = pairedByOrigin((s) => s.hitLoyo.H6 - s.hitLoyo.V1d, samples.filter((s) => s.lead >= 10));
  const tr = pairedByOrigin((s) => s.hitLoyo.H6 - s.hitLoyo.V1d, samples.filter((s) => TRANS.includes(s.monthOrg)));
  const mid = pairedByOrigin((s) => s.hitLoyo.H6 - s.hitLoyo.V1d, samples.filter((s) => MID.includes(s.monthOrg)));
  console.table([
    { "nhóm": "mọi tầm", "Δ (H6−V1d)": r2(all.mean), "SE": r2(all.se), "mốc": all.n },
    { "nhóm": "d≥10", "Δ (H6−V1d)": r2(far.mean), "SE": r2(far.se), "mốc": far.n },
    { "nhóm": "chuyển mùa T4/T10", "Δ (H6−V1d)": r2(tr.mean), "SE": r2(tr.se), "mốc": tr.n },
    { "nhóm": "giữa mùa T1/T7", "Δ (H6−V1d)": r2(mid.mean), "SE": r2(mid.se), "mốc": mid.n },
  ]);
}

/* ── d≥10 (chỗ giả thuyết nói lợi nằm ở đó) ───────────────────────────────── */
console.log("\n=== TẦM XA d≥10 · Δ vs pha hiện tại ===");
console.table(Object.keys(VARIANTS).map((name) => {
  const far = pairedByOrigin((s) => s.hitLoyo[name] - s.hitCurrent, samples.filter((s) => s.lead >= 10));
  return { "bản": name, "Δ vs pha (d≥10)": r2(far.mean), "SE": r2(far.se), "mốc": far.n };
}));

/* ── THỐNG KÊ GHÉP CẶP, GOM CỤM THEO MỐC GỐC ──────────────────────────────── */
/** trung bình theo mốc gốc của hiệu (variant − baseline), rồi SE trên 16 mốc */
function pairedByOrigin(diffFn, subset = samples) {
  const per = ORIGINS.map((o) => {
    const ss = subset.filter((s) => s.origin === o);
    return ss.length ? meanBy(ss, diffFn) : null;
  }).filter((v) => v !== null);
  const n = per.length;
  const mean = per.reduce((a, b) => a + b, 0) / (n || 1);
  const sd = Math.sqrt(per.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  return { per, n, mean, se: sd / Math.sqrt(n || 1) };
}

const results = {};
for (const name of Object.keys(VARIANTS)) {
  results[name] = {
    vsPersist: pairedByOrigin((s) => s.hitLoyo[name] - s.hitPersist),
    vsCurrent: pairedByOrigin((s) => s.hitLoyo[name] - s.hitCurrent),
  };
}
const currentVsPersist = pairedByOrigin((s) => s.hitCurrent - s.hitPersist);

console.log("\n=== TỔNG (mọi tầm ngày, ghép cặp theo 16 mốc gốc) ===");
console.table(Object.entries(results).map(([k, v]) => ({
  "bản": k,
  "Δ vs ảnh thuần": r2(v.vsPersist.mean),
  "SE": r2(v.vsPersist.se),
  "Δ vs pha hiện tại": r2(v.vsCurrent.mean),
  "SE ": r2(v.vsCurrent.se),
  "mốc": v.vsCurrent.n,
})).concat([{
  "bản": "(pha hiện tại)",
  "Δ vs ảnh thuần": r2(currentVsPersist.mean), "SE": r2(currentVsPersist.se),
  "Δ vs pha hiện tại": 0, "SE ": 0, "mốc": currentVsPersist.n,
}]));

/* ── DỰ ĐOÁN ĐĂNG KÝ TRƯỚC: mùa chuyển (T4/T10) vs giữa mùa (T1/T7) ──────── */
console.log("\n=== (c) TÁCH MÙA — DỰ ĐOÁN ĐĂNG KÝ TRƯỚC: lợi phải nằm ở T4/T10 ===");
const seasonRows = [];
for (const name of Object.keys(VARIANTS)) {
  for (const [label, months] of [["chuyển mùa T4/T10", TRANS], ["giữa mùa T1/T7", MID]]) {
    const sub = samples.filter((s) => months.includes(s.monthOrg));
    const subFar = sub.filter((s) => s.lead >= 10);
    const a = pairedByOrigin((s) => s.hitLoyo[name] - s.hitCurrent, sub);
    const b = pairedByOrigin((s) => s.hitLoyo[name] - s.hitPersist, sub);
    const c = pairedByOrigin((s) => s.hitLoyo[name] - s.hitCurrent, subFar);
    seasonRows.push({
      "bản": name, "nhóm": label,
      "Δ vs pha (mọi tầm)": r2(a.mean), "SE": r2(a.se),
      "Δ vs ảnh": r2(b.mean),
      "Δ vs pha (d≥10)": r2(c.mean), "SE ": r2(c.se),
      "mốc": a.n,
    });
  }
}
console.table(seasonRows);

/* ── HÁI QUẢ: hoán vị đổi dấu theo mốc gốc, hiệu chỉnh family-wise ────────── */
function permTest(diffFnByVariant, subset = samples) {
  // ma trận per-origin cho từng biến thể
  const names = Object.keys(diffFnByVariant);
  const mat = names.map((nm) => pairedByOrigin(diffFnByVariant[nm], subset).per);
  const n = mat[0].length;
  const obs = mat.map((row) => row.reduce((a, b) => a + b, 0) / n);
  const obsMax = Math.max(...obs.map(Math.abs));
  const B = 20000;
  let geMax = 0;
  const geEach = names.map(() => 0);
  for (let b = 0; b < B; b++) {
    const sgn = Array.from({ length: n }, () => (Math.random() < 0.5 ? -1 : 1));
    let mx = 0;
    for (let k = 0; k < names.length; k++) {
      let acc = 0;
      for (let i = 0; i < n; i++) acc += sgn[i] * mat[k][i];
      const v = Math.abs(acc / n);
      if (v > mx) mx = v;
      if (v >= Math.abs(obs[k])) geEach[k]++;
    }
    if (mx >= obsMax) geMax++;
  }
  return names.map((nm, k) => ({
    name: nm, obs: r3(obs[k]),
    pRaw: r3((geEach[k] + 1) / (B + 1)),
    pFamilyWise: r3((geMax + 1) / (B + 1)),
  }));
}

const diffsVsCurrent = Object.fromEntries(
  Object.keys(VARIANTS).map((nm) => [nm, (s) => s.hitLoyo[nm] - s.hitCurrent]),
);
const diffsVsPersist = Object.fromEntries(
  Object.keys(VARIANTS).map((nm) => [nm, (s) => s.hitLoyo[nm] - s.hitPersist]),
);
console.log("\n=== HOÁN VỊ ĐỔI DẤU (20 000 lần, gom theo mốc gốc) — p đã trừ hái quả (3 biến thể) ===");
const permCur = permTest(diffsVsCurrent);
const permPer = permTest(diffsVsPersist);
console.table(permCur.map((r, i) => ({
  "bản": r.name,
  "Δ vs pha": r.obs, "p thô": r.pRaw, "p family-wise": r.pFamilyWise,
  "Δ vs ảnh": permPer[i].obs, "p thô ": permPer[i].pRaw, "p f-w ": permPer[i].pFamilyWise,
})));

console.log("\n=== HOÁN VỊ · NHÓM ĐĂNG KÝ TRƯỚC T4/T10 (8 mốc gốc) — Δ vs pha hiện tại ===");
const permTrans = permTest(diffsVsCurrent, samples.filter((s) => TRANS.includes(s.monthOrg)));
const permTransFar = permTest(diffsVsCurrent, samples.filter((s) => TRANS.includes(s.monthOrg) && s.lead >= 10));
console.table(permTrans.map((r, i) => ({
  "bản": r.name,
  "Δ (mọi tầm)": r.obs, "p thô": r.pRaw, "p f-w": r.pFamilyWise,
  "Δ (d≥10)": permTransFar[i].obs, "p thô ": permTransFar[i].pRaw, "p f-w ": permTransFar[i].pFamilyWise,
})));

/* ── ĐỘ BỀN: bỏ 1 mốc gốc ─────────────────────────────────────────────────── */
console.log("\n=== ĐỘ BỀN — bỏ 1 mốc gốc bất kỳ (Δ vs pha hiện tại, mọi tầm) ===");
const robustRows = [];
for (const name of Object.keys(VARIANTS)) {
  const full = results[name].vsCurrent.mean;
  const vals = ORIGINS.map((o) => {
    const sub = samples.filter((s) => s.origin !== o);
    return pairedByOrigin((s) => s.hitLoyo[name] - s.hitCurrent, sub).mean;
  });
  robustRows.push({
    "bản": name, "đầy đủ": r2(full),
    "bỏ-1 min": r2(Math.min(...vals)), "bỏ-1 max": r2(Math.max(...vals)),
    "biên độ": r2(Math.max(...vals) - Math.min(...vals)),
    "số lần đổi dấu": vals.filter((v) => Math.sign(v) !== Math.sign(full)).length,
  });
}
console.table(robustRows);

/* ── XUẤT ─────────────────────────────────────────────────────────────────── */
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  builtAt: new Date().toISOString().slice(0, 10),
  hypothesis: "H6 seasonal-tendency / anomaly-persistence",
  nSamples: samples.length, nOrigins: ORIGINS.length, leads: LEADS,
  gateE: { p90DriftAtLead16: r2(p90at16), pass: GATE_E_PASS, byLead: byLeadDrift },
  perLead, fullParams, loyoParams,
  totals: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, {
    vsPersist: { mean: r2(v.vsPersist.mean), se: r2(v.vsPersist.se), n: v.vsPersist.n },
    vsCurrent: { mean: r2(v.vsCurrent.mean), se: r2(v.vsCurrent.se), n: v.vsCurrent.n },
  }])),
  currentVsPersist: { mean: r2(currentVsPersist.mean), se: r2(currentVsPersist.se) },
  season: seasonRows, permVsCurrent: permCur, permVsPersist: permPer,
  permTrans, permTransFar, robust: robustRows,
}, null, 1));
console.log(`\n→ ${OUT}`);
