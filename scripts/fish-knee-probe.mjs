// scripts/fish-knee-probe.mjs  (chạy: npx tsx scripts/fish-knee-probe.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// ĐO ĐIỂM GÃY X + DẠNG ĐƯỜNG CONG TỶ LỆ MÙA VỤ — KHÔNG ĐẶT TAY.
//
// NHẬN ĐỊNH CỦA CHỦ DỰ ÁN (2026-07-28):
//   "ảnh dự báo thường consistent trong X ngày (tỷ lệ thay đổi thấp), vượt qua
//    X ngày thì dự báo hôm nay giảm mạnh, mùa vụ tăng nhanh"
// Script này ĐO X, và dò xem đường cong share(d) nào hợp với X đó nhất.
//
// DỮ LIỆU: kho đã tải sẵn `.cache/fish-corpus/` (KHÔNG gọi lại ERDDAP).
//   16 mốc gốc × 11 tầm ngày (1..16). Sự thật = bản đồ cá tính từ ảnh ngày T+d.
//
// BA THƯỚC ĐO SUY GIẢM (đo trên HỢP tập ô, ô vắng = ABSENT_PERSIST=12):
//   · tương quan HẠNG (Spearman) ảnh-T vs sự-thật-T+d  → "còn nhớ chỗ" bao lâu
//   · top-100 hit                                       → "còn chỉ đúng chỗ"
//   · % ô ĐỔI MỨC qua ngưỡng 40/60/75                   → "tỷ lệ thay đổi"
//
// RÀNG BUỘC BẮT BUỘC khi dò đường cong: share(1)=0,06 và share(16)=0,56
// (chủ dự án đã chốt hai đầu — script KHÔNG được đổi).
//
// KẾT QUẢ: .cache/fish-knee-result.json + bảng console.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildClimScaleMap,
  decodeClimatology,
  ABSENT_PERSIST,
  climShare,
  PRODUCT_SHARE_FIRST,
  PRODUCT_SHARE_LAST,
  PRODUCT_SHARE_GAMMA,
} from "../src/lib/fish-blend.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, ".cache", "fish-corpus");
const CLIM_PATH = join(ROOT, "public", "data", "fish-climatology.v1.json");
const OUT = join(ROOT, ".cache", "fish-knee-result.json");

const TOP_K = 100;
const THRESHOLDS = [40, 60, 75];
const D_MIN = 1;
const D_MAX = 16;
const FAR_FROM = 8; // "tầm xa" bắt đầu từ ngày 8

const r1 = (x) => Math.round(x * 10) / 10;
const r3 = (x) => Math.round(x * 1000) / 1000;
const addDays = (isoStr, n) => {
  const d = new Date(`${isoStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/* ── nạp kho ──────────────────────────────────────────────────────────────── */
if (!existsSync(join(CORPUS, "index.json"))) {
  console.error(`KHÔNG thấy ${CORPUS}/index.json — chạy scripts/fish-corpus-build.mjs trước.`);
  process.exit(1);
}
const INDEX = JSON.parse(readFileSync(join(CORPUS, "index.json"), "utf8"));
const CLIM_FILE = JSON.parse(readFileSync(CLIM_PATH, "utf8"));
const CLIM = decodeClimatology(CLIM_FILE);

const dayCache = new Map();
function loadDay(date) {
  if (dayCache.has(date)) return dayCache.get(date);
  const p = join(CORPUS, "days", `${date}.json`);
  const v = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  dayCache.set(date, v);
  return v;
}

const { lat0, lon0, dLat, dLon, nLat, nLon } = CLIM.meta;
const cellKey = (lat, lon) => `${lat},${lon}`;
function climRawAt(lat, lon, month) {
  const buf = CLIM.months.get(month);
  if (!buf) return 0;
  const i = Math.round((lat - lat0) / dLat);
  const j = Math.round((lon - lon0) / dLon);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return 0;
  return buf[i * nLon + j] ?? 0;
}

/* ── thước đo ─────────────────────────────────────────────────────────────── */
/** hạng trung bình (xử lý ĐỒNG HẠNG — bắt buộc vì ô vắng đều bằng 12) */
function ranks(arr) {
  const n = arr.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => arr[a] - arr[b]);
  const rk = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && arr[idx[j + 1]] === arr[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) rk[idx[k]] = avg;
    i = j + 1;
  }
  return rk;
}
function pearson(x, y) {
  const n = x.length;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    sxy += a * b; sxx += a * a; syy += b * b;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}
const spearman = (a, b) => pearson(ranks(a), ranks(b));

/** chỉ số TOP_K ô cao nhất (min-heap cỡ K để khỏi sort cả mảng) */
function topKIdx(vals, K) {
  const n = vals.length;
  const heap = []; // [val, idx], min-heap theo val
  const up = (i) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const down = (i) => {
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  };
  for (let i = 0; i < n; i++) {
    if (heap.length < K) { heap.push([vals[i], i]); up(heap.length - 1); }
    else if (vals[i] > heap[0][0]) { heap[0] = [vals[i], i]; down(0); }
  }
  return heap.map((h) => h[1]);
}

/* ── dựng mẫu: (mốc gốc, tầm ngày) → P (ảnh T), C (mùa vụ đã quy thang), Y (thật) ── */
const LEADS = INDEX.leads.filter((d) => d >= D_MIN && d <= D_MAX);
const samples = new Map(LEADS.map((d) => [d, []]));
let skipped = 0;

for (const T of INDEX.origins) {
  const dayT = loadDay(T);
  if (!dayT) { skipped++; continue; }
  const persist = new Map(dayT.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
  for (const d of LEADS) {
    const target = addDays(T, d);
    const dayY = loadDay(target);
    if (!dayY) { skipped++; continue; }
    const m = dayY.month; // mùa vụ lấy theo THÁNG ĐÍCH (đúng như runtime)
    const truth = new Map(dayY.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));

    // thang quy đổi phân vị dựng trên phân bố bản đồ ngày T (KHỚP runtime)
    const scale = buildClimScaleMap(CLIM, m, dayT.cells.map((c) => c.s));

    // HỢP TẬP: ô ảnh ∪ ô sự thật ∪ ô mùa vụ (ô mùa vụ là chỗ đẻ vị trí mới)
    const keys = new Set([...persist.keys(), ...truth.keys()]);
    const buf = CLIM.months.get(m);
    if (buf)
      for (let i = 0; i < nLat; i++)
        for (let j = 0; j < nLon; j++) {
          if (!buf[i * nLon + j]) continue;
          const lat = Math.round((lat0 + i * dLat) * 100) / 100;
          const lon = Math.round((lon0 + j * dLon) * 100) / 100;
          keys.add(cellKey(lat, lon));
        }

    const n = keys.size;
    const P = new Float64Array(n);
    const C = new Float64Array(n);
    const Y = new Float64Array(n);
    let i = 0;
    for (const k of keys) {
      const [lat, lon] = k.split(",").map(Number);
      P[i] = persist.has(k) ? persist.get(k) : ABSENT_PERSIST;
      Y[i] = truth.has(k) ? truth.get(k) : ABSENT_PERSIST;
      C[i] = scale[Math.min(100, climRawAt(lat, lon, m))] ?? 0;
      i++;
    }
    samples.get(d).push({ origin: T, target, month: m, P, C, Y, topTrue: new Set(topKIdx(Y, TOP_K)) });
  }
  process.stdout.write(".");
}
console.log(`\n${LEADS.length} tầm ngày × ${INDEX.origins.length} mốc gốc (bỏ ${skipped} cặp thiếu ngày)\n`);

/* ── VIỆC 1: ĐƯỜNG SUY GIẢM ───────────────────────────────────────────────── */
function crossRate(P, Y, thr) {
  let c = 0;
  for (let i = 0; i < P.length; i++) if ((P[i] >= thr) !== (Y[i] >= thr)) c++;
  return c / P.length;
}
/** top-100 hit của một bản dự đoán `pred` so với sự thật của mẫu */
function hitOf(s, pred) {
  let hit = 0;
  for (const i of topKIdx(pred, TOP_K)) if (s.topTrue.has(i)) hit++;
  return hit / TOP_K;
}
const hitCache = new Map(); // `${lead}|${sIdx}|${share4dp}` → hit
function hitAtShare(s, sIdx, lead, share) {
  const key = `${lead}|${sIdx}|${share.toFixed(4)}`;
  const got = hitCache.get(key);
  if (got !== undefined) return got;
  const n = s.P.length;
  const w = 1 - share;
  const pred = new Float64Array(n);
  for (let i = 0; i < n; i++) pred[i] = w * s.P[i] + share * s.C[i];
  const v = hitOf(s, pred);
  hitCache.set(key, v);
  return v;
}

const decay = [];
for (const d of LEADS) {
  const ss = samples.get(d);
  if (!ss.length) continue;
  const mean = (f) => ss.reduce((a, s, i) => a + f(s, i), 0) / ss.length;
  const row = {
    lead: d,
    nOrigins: ss.length,
    nCells: Math.round(mean((s) => s.P.length)),
    spearmanImg: r3(mean((s) => spearman(s.P, s.Y))),
    spearmanClim: r3(mean((s) => spearman(s.C, s.Y))),
    top100Img: r1(mean((s, i) => hitAtShare(s, i, d, 0)) * 100),
    top100Clim: r1(mean((s, i) => hitAtShare(s, i, d, 1)) * 100),
  };
  for (const thr of THRESHOLDS) row[`cross${thr}Pct`] = r1(mean((s) => crossRate(s.P, s.Y, thr)) * 100);
  decay.push(row);
}

console.log("=== VIỆC 1 · ĐƯỜNG SUY GIẢM CỦA ẢNH HÔM NAY ===");
console.table(
  decay.map((r) => ({
    "tầm(ngày)": r.lead,
    "Spearman ảnh": r.spearmanImg,
    "Spearman mùa": r.spearmanClim,
    "top100 ảnh %": r.top100Img,
    "top100 mùa %": r.top100Clim,
    "đổi mức ≥40 %": r.cross40Pct,
    "đổi mức ≥60 %": r.cross60Pct,
    "đổi mức ≥75 %": r.cross75Pct,
    "ô/mẫu": r.nCells,
  })),
);

/* ── VIỆC 2: TÌM ĐIỂM GÃY X ───────────────────────────────────────────────── */
function fitStats(xs, ys, predFn) {
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sse = 0, sst = 0;
  for (let i = 0; i < xs.length; i++) {
    const e = ys[i] - predFn(xs[i]);
    sse += e * e;
    sst += (ys[i] - my) ** 2;
  }
  return { rmse: Math.sqrt(sse / xs.length), r2: sst > 0 ? 1 - sse / sst : 0 };
}
/** (a) hàm mũ đơn y = A·e^(−d/τ) — quét τ, A theo bình phương tối thiểu */
function fitExp(xs, ys) {
  let best = null;
  for (let tau = 0.5; tau <= 200; tau += 0.1) {
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) {
      const e = Math.exp(-xs[i] / tau);
      num += ys[i] * e; den += e * e;
    }
    const A = den > 0 ? num / den : 0;
    const st = fitStats(xs, ys, (d) => A * Math.exp(-d / tau));
    if (!best || st.rmse < best.rmse) best = { tau: r3(tau), A: r3(A), ...st };
  }
  return best;
}
/** (b) hai đoạn thẳng GÃY KHÚC liên tục tại d*: y = a + b1·min(d,d*) + b2·max(0,d−d*) */
function fitPiecewise(xs, ys, breakCandidates) {
  let best = null;
  for (const bp of breakCandidates) {
    // thiết kế 3 cột [1, min(d,bp), max(0,d−bp)] — giải chuẩn tắc 3×3
    const X = xs.map((d) => [1, Math.min(d, bp), Math.max(0, d - bp)]);
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const b = [0, 0, 0];
    for (let i = 0; i < X.length; i++)
      for (let r = 0; r < 3; r++) {
        b[r] += X[i][r] * ys[i];
        for (let c = 0; c < 3; c++) A[r][c] += X[i][r] * X[i][c];
      }
    // Gauss với xoay từng phần
    const M = A.map((row, i) => [...row, b[i]]);
    let ok = true;
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) { ok = false; break; }
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < 3; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= 3; k++) M[r][k] -= f * M[c][k];
      }
    }
    if (!ok) continue;
    const beta = [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
    const f = (d) => beta[0] + beta[1] * Math.min(d, bp) + beta[2] * Math.max(0, d - bp);
    const st = fitStats(xs, ys, f);
    if (!best || st.rmse < best.rmse)
      best = {
        breakAt: bp,
        intercept: r3(beta[0]),
        slopeBefore: r3(beta[1]),
        slopeAfter: r3(beta[2]),
        slopeRatio: beta[1] !== 0 ? r3(beta[2] / beta[1]) : null,
        ...st,
      };
  }
  return best;
}

const BREAKS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const xs = decay.map((r) => r.lead);
const SERIES = {
  spearman: decay.map((r) => r.spearmanImg),
  top100: decay.map((r) => r.top100Img / 100),
  cross60: decay.map((r) => r.cross60Pct / 100),
};
const knee = {};
for (const [name, ys] of Object.entries(SERIES)) {
  const exp = fitExp(xs, ys);
  const pw = fitPiecewise(xs, ys, BREAKS);
  // toàn cảnh: RMSE của mọi điểm gãy để thấy đáy có nhọn không
  const sweep = BREAKS.map((bp) => ({ bp, rmse: r3(fitPiecewise(xs, ys, [bp]).rmse) }));
  knee[name] = { exp, piecewise: pw, sweep, better: pw.rmse < exp.rmse ? "piecewise" : "exp" };
}

console.log("\n=== VIỆC 2 · ĐIỂM GÃY X ===");
console.table(
  Object.entries(knee).map(([k, v]) => ({
    "chuỗi": k,
    "τ (mũ đơn)": v.exp.tau,
    "RMSE mũ": r3(v.exp.rmse),
    "R² mũ": r3(v.exp.r2),
    "d* gãy khúc": v.piecewise.breakAt,
    "dốc trước": v.piecewise.slopeBefore,
    "dốc sau": v.piecewise.slopeAfter,
    "RMSE gãy": r3(v.piecewise.rmse),
    "R² gãy": r3(v.piecewise.r2),
    "mô hình thắng": v.better,
  })),
);
console.log("\nQuét điểm gãy (RMSE — càng nhỏ càng khớp):");
console.table(
  BREAKS.map((bp) => {
    const row = { "d* thử": bp };
    for (const k of Object.keys(SERIES)) row[k] = knee[k].sweep.find((s) => s.bp === bp).rmse;
    return row;
  }),
);

// X chốt = điểm gãy của chuỗi Spearman (thước đo "còn nhớ chỗ" — sát nhận định nhất)
const X_KNEE = knee.spearman.piecewise.breakAt;
console.log(`⇒ X = ${X_KNEE} ngày (điểm gãy chuỗi Spearman; dốc ${knee.spearman.piecewise.slopeBefore}/ngày trước X → ${knee.spearman.piecewise.slopeAfter}/ngày sau X)`);

/* ── VIỆC 3: DÒ ĐƯỜNG CONG share(d) ───────────────────────────────────────── */
const FIRST = PRODUCT_SHARE_FIRST; // 0,06 — CHỐT, không đổi
const LAST = PRODUCT_SHARE_LAST;   // 0,56 — CHỐT, không đổi
const tLead = (d) => (d - D_MIN) / (D_MAX - D_MIN);

const curves = [];
// (a) POWER theo tầm ngày.
//     γ<1 (LÕM — vọt lên sớm rồi thoải) được thêm vào ngoài yêu cầu vì VIỆC 2 đo
//     ra dạng suy giảm NGƯỢC với nhận định: ảnh rữa NHANH NHẤT ở mấy ngày đầu
//     rồi mới phẳng. Không thử γ<1 thì bảng dò sẽ thiếu đúng nửa đáng ngờ nhất.
for (const g of [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4])
  curves.push({
    family: "power",
    label: `power γ=${g}`,
    params: { gamma: g, t: "lead" },
    share: (d) => FIRST + Math.pow(tLead(d), g) * (LAST - FIRST),
  });
// (b) LOGISTIC có điểm uốn tại X (chuẩn hoá để hai đầu chạm đúng 0,06 / 0,56)
const X_CANDIDATES = [...new Set([X_KNEE, knee.top100.piecewise.breakAt, knee.cross60.piecewise.breakAt])].sort((a, b) => a - b);
for (const X of X_CANDIDATES)
  for (const k of [0.3, 0.5, 0.8, 1.2]) {
    const L = (d) => 1 / (1 + Math.exp(-k * (d - X)));
    const l1 = L(D_MIN), l16 = L(D_MAX);
    curves.push({
      family: "logistic",
      label: `logistic X=${X} k=${k}`,
      params: { X, k },
      share: (d) => (l16 > l1 ? FIRST + ((L(d) - l1) / (l16 - l1)) * (LAST - FIRST) : FIRST),
    });
  }
// đối chứng: đường cong ĐANG DÙNG trong app (power γ=2,5 trên t đo được)
curves.push({
  family: "runtime",
  label: `ĐANG DÙNG (power γ=${PRODUCT_SHARE_GAMMA}, t đo được)`,
  params: { gamma: PRODUCT_SHARE_GAMMA, t: "measured" },
  share: (d) => climShare(d),
});
// đối chứng thô
curves.push({ family: "baseline", label: "ảnh THUẦN (share=0)", params: {}, share: () => 0 });
curves.push({ family: "baseline", label: "mùa vụ THUẦN (share=1)", params: {}, share: () => 1 });

const curveRows = [];
for (const cv of curves) {
  const perLead = [];
  const flat = []; // hit từng (tầm ngày, mốc gốc) — để so CẶP ĐÔI, xem chênh có vượt nhiễu không
  let sum = 0, sumFar = 0, nFar = 0;
  for (const d of LEADS) {
    const ss = samples.get(d);
    if (!ss.length) continue;
    const sh = Math.max(0, Math.min(1, cv.share(d)));
    const each = ss.map((s, i) => hitAtShare(s, i, d, sh) * 100);
    for (const v of each) flat.push(v);
    const hit = each.reduce((a, b) => a + b, 0) / each.length;
    perLead.push({ lead: d, share: r3(sh), hitPct: r1(hit) });
    sum += hit;
    if (d >= FAR_FROM) { sumFar += hit; nFar++; }
  }
  curveRows.push({
    family: cv.family,
    label: cv.label,
    params: cv.params,
    perLead,
    flat,
    meanHitPct: r1(sum / perLead.length),
    meanHitFarPct: r1(sumFar / Math.max(1, nFar)),
  });
}

const imgOnly = curveRows.find((r) => r.label.startsWith("ảnh THUẦN"));
for (const r of curveRows) {
  r.vsImgPct = r1(r.meanHitPct - imgOnly.meanHitPct);
  r.vsImgFarPct = r1(r.meanHitFarPct - imgOnly.meanHitFarPct);
}

/* SO CẶP ĐÔI vs đường ĐANG DÙNG — cùng mốc gốc, cùng tầm ngày, chỉ khác share.
   Chênh trung bình < 2× sai số chuẩn ⇒ KHÔNG phân biệt được, đừng đổi vì nó. */
{
  const base = curveRows.find((r) => r.family === "runtime").flat;
  for (const r of curveRows) {
    const n = Math.min(r.flat.length, base.length);
    let s = 0;
    const diffs = [];
    for (let i = 0; i < n; i++) { const dv = r.flat[i] - base[i]; diffs.push(dv); s += dv; }
    const m = s / n;
    const sd = Math.sqrt(diffs.reduce((a, v) => a + (v - m) ** 2, 0) / Math.max(1, n - 1));
    r.pairedVsRuntime = { meanDiffPct: r1(m), sePct: r1(sd / Math.sqrt(n)), n };
    r.pairedSignificant = Math.abs(m) > 2 * (sd / Math.sqrt(n));
  }
}

console.log("\n=== VIỆC 3 · DÒ ĐƯỜNG CONG share(d) — hai đầu KHOÁ 6 % → 56 % ===");
console.table(
  curveRows.map((r) => {
    const row = { "đường cong": r.label };
    for (const p of r.perLead) row[`d${p.lead}`] = p.hitPct;
    row["TB top100 %"] = r.meanHitPct;
    row[`TB d≥${FAR_FROM} %`] = r.meanHitFarPct;
    row["hơn ảnh"] = r.vsImgPct;
    return row;
  }),
);
console.log("\nTỷ lệ mùa vụ mỗi đường cong đặt ra (%):");
console.table(
  curveRows
    .filter((r) => r.family !== "baseline")
    .map((r) => {
      const row = { "đường cong": r.label };
      for (const p of r.perLead) row[`d${p.lead}`] = Math.round(p.share * 100);
      return row;
    }),
);

const ranked = curveRows.filter((r) => r.family !== "baseline").sort((a, b) => b.meanHitPct - a.meanHitPct);
const winner = ranked[0];
const runtime = curveRows.find((r) => r.family === "runtime");
const gapVsRuntime = r1(winner.meanHitPct - runtime.meanHitPct);
const gapFarVsRuntime = r1(winner.meanHitFarPct - runtime.meanHitFarPct);
const MATERIAL = 0.5; // điểm % — dưới mức này coi như nhiễu, KHÔNG đáng đổi
const verdict =
  winner.label === runtime.label
    ? "GIỮ NGUYÊN — đường đang dùng chính là đường thắng"
    : Math.abs(gapVsRuntime) < MATERIAL
      ? `GIỮ NGUYÊN — "${winner.label}" chỉ hơn đường đang dùng ${gapVsRuntime} điểm % (< ${MATERIAL}), không đáng đổi`
      : `NÊN ĐỔI sang "${winner.label}" — hơn đường đang dùng ${gapVsRuntime} điểm % (tầm xa ${gapFarVsRuntime})`;

console.log("\n=== XẾP HẠNG (chênh so với đường ĐANG DÙNG, so cặp đôi cùng mốc gốc + tầm ngày) ===");
console.table(
  ranked.map((r, i) => ({
    "#": i + 1,
    "đường cong": r.label,
    "TB top100 %": r.meanHitPct,
    [`TB d≥${FAR_FROM} %`]: r.meanHitFarPct,
    "hơn ảnh-thuần": r.vsImgPct,
    "chênh vs đang dùng": r.pairedVsRuntime.meanDiffPct,
    "± sai số chuẩn": r.pairedVsRuntime.sePct,
    "vượt nhiễu?": r.pairedSignificant ? "CÓ" : "không",
  })),
);
const anySignificantBetter = ranked.some(
  (r) => r.family !== "runtime" && r.pairedSignificant && r.pairedVsRuntime.meanDiffPct > 0,
);
console.log(
  anySignificantBetter
    ? "Có đường cong hơn ĐANG DÙNG vượt nhiễu — xem cột 'vượt nhiễu?'"
    : "KHÔNG đường cong nào hơn ĐANG DÙNG quá 2× sai số chuẩn ⇒ dạng đường cong KHÔNG phải chỗ còn ăn được điểm",
);
console.log(`\n⇒ ${verdict}`);

/* ── xuất ─────────────────────────────────────────────────────────────────── */
const out = {
  generatedAt: new Date().toISOString(),
  question:
    "Ảnh vệ tinh hôm nay 'consistent' trong bao nhiêu ngày (X)? Và đường cong share(d) nào hợp với X đó nhất?",
  corpus: { origins: INDEX.origins, leads: LEADS, builtAt: INDEX.builtAt, path: ".cache/fish-corpus" },
  caveat:
    "SỰ THẬT = bản đồ cá tính từ ảnh vệ tinh ngày T+d (chính sản phẩm app phục vụ), KHÔNG PHẢI sản lượng cá thật. " +
    "Ô vắng mặt trong lưới cá được gán ABSENT_PERSIST=12 (khớp runtime). Bản đồ ngày T trong kho được chấm theo tháng của CHÍNH ngày T, " +
    "trong khi mùa vụ lấy theo tháng đích — sai lệch nhỏ ở các cặp bắc cầu sang tháng sau.",
  constraints: { shareFirst: FIRST, shareLast: LAST, note: "chủ dự án chốt, script KHÔNG đổi" },
  decay,
  decayNote:
    "Ngưỡng 75 gần như KHÔNG BAO GIỜ đạt (điểm cá cao nhất cả kho = 77, chỉ 217/364k ô ≥70) " +
    "⇒ cột 'đổi mức ≥75' bằng 0 là do thang điểm, không phải do ảnh ổn định.",
  knee,
  kneeX: X_KNEE,
  curves: curveRows.map(({ flat, ...r }) => r),
  winner: { label: winner.label, params: winner.params, meanHitPct: winner.meanHitPct, meanHitFarPct: winner.meanHitFarPct },
  runtime: { label: runtime.label, meanHitPct: runtime.meanHitPct, meanHitFarPct: runtime.meanHitFarPct },
  gapWinnerVsRuntimePct: gapVsRuntime,
  gapWinnerVsRuntimeFarPct: gapFarVsRuntime,
  materialThresholdPct: MATERIAL,
  verdict,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\n✓ ${OUT}`);
