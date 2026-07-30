// scripts/fish-hypo-wind-null.mjs  (chạy: npx tsx scripts/fish-hypo-wind-null.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// BA CÂU HỎI CÒN LẠI của GIẢ THUYẾT #3 sau chẩn đoán:
//
//  A. DẤU TỰ DO — chẩn đoán cho thấy r(gió mạnh, phần dư) DƯƠNG, ngược hẳn tiền
//     đề "xáo trộn xoá front". Cho α,β chạy cả ÂM để xem mô hình muốn gì.
//     (Đây là GIẢ THUYẾT MỚI về dấu, KHÔNG được tính là H3 thắng.)
//
//  B. THÁNG 7 CÓ THẬT KHÔNG — trần trong-mẫu tháng 7 là +0,55. Kiểm chéo
//     LOO-mốc (4 mốc tháng 7, mỗi mốc một năm) xem còn lại gì.
//
//  C. SÀN NHIỄU — hoán vị: gán trường gió của MỘT MỐC GỐC KHÁC (cùng tầm) rồi
//     lấy lại trần trong-mẫu. Giữ nguyên cấu trúc không gian của gió, phá quan
//     hệ nhân quả. Nếu +0,55 nằm gọn trong phân bố null ⇒ là hái quả, không
//     phải tín hiệu.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildClimScaleMap, decodeClimatology, ABSENT_PERSIST, climShare } from "../src/lib/fish-blend.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, ".cache", "fish-corpus");
const CLIM_PATH = join(ROOT, "public", "data", "fish-climatology.v1.json");
const WIND_PATH = join(ROOT, ".cache", "fish-wind", "era5-1deg.json");
const OUT = join(ROOT, ".cache", "fish-hypo-wind-null.json");

const TOP_K = 100;
const COAST_AZ = 30;
const r2 = (x) => Math.round(x * 100) / 100;
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const INDEX = JSON.parse(readFileSync(join(CORPUS, "index.json"), "utf8"));
const CLIM = decodeClimatology(JSON.parse(readFileSync(CLIM_PATH, "utf8")));
const WIND = JSON.parse(readFileSync(WIND_PATH, "utf8"));
const dayCache = new Map();
const loadDay = (d) => { if (dayCache.has(d)) return dayCache.get(d); const p = join(CORPUS, "days", `${d}.json`); const v = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; dayCache.set(d, v); return v; };
const { lat0: cLat0, lon0: cLon0, dLat, dLon, nLat, nLon } = CLIM.meta;
const cellKey = (a, b) => `${a},${b}`;
function climRawAt(lat, lon, m) { const buf = CLIM.months.get(m); if (!buf) return 0; const i = Math.round((lat - cLat0) / dLat), j = Math.round((lon - cLon0) / dLon); return i >= 0 && i < nLat && j >= 0 && j < nLon ? (buf[i * nLon + j] ?? 0) : 0; }

const W_NLAT = WIND.nLat, W_NLON = WIND.nLon, W_LAT0 = WIND.lat0, W_LON0 = WIND.lon0, W_STEP = WIND.step;
const NPT = W_NLAT * W_NLON;
const dateIdx = new Map(WIND.times.map((t, i) => [t, i]));
const cA = Math.sin((COAST_AZ * Math.PI) / 180), cB = Math.cos((COAST_AZ * Math.PI) / 180);
const TAU = [], SPD = [];
for (let t = 0; t < WIND.times.length; t++) {
  const s = WIND.speed[t], d = WIND.dir[t];
  const ta = new Float64Array(NPT), sp = new Float64Array(NPT);
  for (let k = 0; k < NPT; k++) {
    const s0 = s[k] ?? 0, rad = ((d[k] ?? 0) * Math.PI) / 180;
    const u = -s0 * Math.sin(rad), v = -s0 * Math.cos(rad);
    ta[k] = s0 * (u * cA + v * cB); sp[k] = s0;
  }
  TAU.push(ta); SPD.push(sp);
}
function winMean(fields, dates) { const o = new Float64Array(NPT); let n = 0; for (const dt of dates) { const i = dateIdx.get(dt); if (i === undefined) continue; const f = fields[i]; for (let k = 0; k < NPT; k++) o[k] += f[k]; n++; } if (n) for (let k = 0; k < NPT; k++) o[k] /= n; return o; }
function bilinear(field, lat, lon) { const x = (lon - W_LON0) / W_STEP, y = (lat - W_LAT0) / W_STEP; const j0 = Math.max(0, Math.min(W_NLON - 2, Math.floor(x))), i0 = Math.max(0, Math.min(W_NLAT - 2, Math.floor(y))); const fx = Math.max(0, Math.min(1, x - j0)), fy = Math.max(0, Math.min(1, y - i0)); const g = (i, j) => field[i * W_NLON + j]; return g(i0, j0) * (1 - fx) * (1 - fy) + g(i0, j0 + 1) * fx * (1 - fy) + g(i0 + 1, j0) * (1 - fx) * fy + g(i0 + 1, j0 + 1) * fx * fy; }
function zscore(a) { const n = a.length; let s = 0; for (let i = 0; i < n; i++) s += a[i]; const m = s / n; let v = 0; for (let i = 0; i < n; i++) v += (a[i] - m) ** 2; const sd = Math.sqrt(v / n); const o = new Float64Array(n); if (sd > 1e-9) for (let i = 0; i < n; i++) o[i] = (a[i] - m) / sd; return o; }
function topKIdx(vals, K) {
  const heap = [];
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = (i) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
  for (let i = 0; i < vals.length; i++) { if (heap.length < K) { heap.push([vals[i], i]); up(heap.length - 1); } else if (vals[i] > heap[0][0]) { heap[0] = [vals[i], i]; down(0); } }
  return heap.map((h) => h[1]);
}

/* ── dựng mẫu ─────────────────────────────────────────────────────────────── */
const LEADS = INDEX.leads.filter((d) => d >= 1 && d <= 16);
const samples = [];
process.stdout.write("dựng mẫu ");
for (const T of INDEX.origins) {
  const dayT = loadDay(T); if (!dayT) continue;
  const persist = new Map(dayT.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
  const dayScores = dayT.cells.map((c) => c.s);
  const bd = []; for (let k = 5; k >= 1; k--) bd.push(addDays(T, -k));
  const bU = winMean(TAU, bd), bM = winMean(SPD, bd);
  for (const d of LEADS) {
    const target = addDays(T, d); const dayY = loadDay(target); if (!dayY) continue;
    const m = dayY.month;
    const truth = new Map(dayY.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
    const scale = buildClimScaleMap(CLIM, m, dayScores);
    const keys = new Set([...persist.keys(), ...truth.keys()]);
    const buf = CLIM.months.get(m);
    if (buf) for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) { if (!buf[i * nLon + j]) continue; keys.add(cellKey(Math.round((cLat0 + i * dLat) * 100) / 100, Math.round((cLon0 + j * dLon) * 100) / 100)); }
    const n = keys.size;
    const P = new Float64Array(n), C = new Float64Array(n), Y = new Float64Array(n), lats = new Float64Array(n), lons = new Float64Array(n);
    let i = 0;
    for (const k of keys) {
      const [lat, lon] = k.split(",").map(Number);
      P[i] = persist.has(k) ? persist.get(k) : ABSENT_PERSIST;
      Y[i] = truth.has(k) ? truth.get(k) : ABSENT_PERSIST;
      C[i] = scale[Math.min(100, climRawAt(lat, lon, m))] ?? 0;
      lats[i] = lat; lons[i] = lon; i++;
    }
    const wd = []; for (let k = 5; k >= 1; k--) wd.push(addDays(target, -k));
    const uW = winMean(TAU, wd), mW = winMean(SPD, wd);
    const U = new Float64Array(n), M = new Float64Array(n);
    for (let q = 0; q < n; q++) {
      U[q] = bilinear(uW, lats[q], lons[q]) - bilinear(bU, lats[q], lons[q]);
      M[q] = bilinear(mW, lats[q], lons[q]) - bilinear(bM, lats[q], lons[q]);
    }
    const w = 1 - climShare(d);
    const B = new Float64Array(n);
    for (let q = 0; q < n; q++) B[q] = w * P[q] + (1 - w) * C[q];
    samples.push({ origin: T, year: +T.slice(0, 4), month: m, lead: d, n, P, B, U: zscore(U), M: zscore(M), latsKey: lats, topTrue: new Set(topKIdx(Y, TOP_K)) });
  }
  process.stdout.write(".");
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const hitOf = (s, pred) => { let h = 0; for (const i of topKIdx(pred, TOP_K)) if (s.topTrue.has(i)) h++; return h; };
console.log(`\n${samples.length} mẫu\n`);

const GRID_POS = []; for (let a = 0; a <= 4.0001; a += 0.5) GRID_POS.push(r2(a));
const GRID_FREE = []; for (let a = -4; a <= 4.0001; a += 0.5) GRID_FREE.push(r2(a));

/** hit của tập `ss` với (α,β) và trường gió lấy từ `srcOf(s)` */
function hits(ss, a, b, srcOf) {
  return ss.map((s) => {
    const src = srcOf ? srcOf(s) : s;
    const U = src.U, M = src.M, base = s.B, lim = Math.min(s.n, src.n);
    const p = new Float64Array(s.n);
    for (let q = 0; q < lim; q++) p[q] = base[q] + a * U[q] - b * M[q];
    for (let q = lim; q < s.n; q++) p[q] = base[q];
    return hitOf(s, p);
  });
}
function ceiling(ss, grid, srcOf) {
  const base = mean(ss.map((s) => hitOf(s, s.B)));
  let best = null;
  for (const a of grid) for (const b of grid) {
    if (a === 0 && b === 0) continue;
    const g = mean(hits(ss, a, b, srcOf)) - base;
    if (!best || g > best.gain) best = { alpha: a, beta: b, gain: g };
  }
  return { ...best, base };
}

/* ── A. DẤU TỰ DO ─────────────────────────────────────────────────────────── */
console.log("=== A · CHO DẤU TỰ DO (α,β ∈ [−4,4]) — kiểm tra tiền đề vật lý ===");
const rowsA = [];
for (const [lbl, ss] of [
  ["tất cả", samples],
  ["tháng 7", samples.filter((s) => s.month === 7)],
  ["d≥10", samples.filter((s) => s.lead >= 10)],
]) {
  const pos = ceiling(ss, GRID_POS);
  const free = ceiling(ss, GRID_FREE);
  rowsA.push({
    "tập": lbl, "n": ss.length,
    "dấu THEO VẬT LÝ α,β≥0": `α=${pos.alpha} β=${pos.beta} → ${r2(pos.gain)}`,
    "dấu TỰ DO": `α=${free.alpha} β=${free.beta} → ${r2(free.gain)}`,
  });
}
console.table(rowsA);
console.log("  β ÂM nghĩa là: gió MẠNH ⇒ điểm CAO hơn — NGƯỢC tiền đề 'xáo trộn xoá front'.");

/* ── B. THÁNG 7: kiểm chéo LOO-mốc ────────────────────────────────────────── */
console.log("\n=== B · THÁNG 7 — KIỂM CHÉO BỎ-MỘT-MỐC (4 mốc: 2022/2023/2024/2025-07-10) ===");
const jul = samples.filter((s) => s.month === 7);
const julOrigins = [...new Set(jul.map((s) => s.origin))].sort();
const cvHit = new Map(); const picks = [];
for (const T of julOrigins) {
  const tr = jul.filter((s) => s.origin !== T), te = jul.filter((s) => s.origin === T);
  const c = ceiling(tr, GRID_POS);
  picks.push({ "bỏ mốc": T, alpha: c.alpha, beta: c.beta, "lời khi HUẤN LUYỆN": r2(c.gain) });
  const h = hits(te, c.alpha, c.beta);
  te.forEach((s, i) => cvHit.set(s, h[i]));
}
console.table(picks);
const julBase = jul.map((s) => hitOf(s, s.B));
const julCv = jul.map((s) => cvHit.get(s));
const diffJul = jul.map((s, i) => julCv[i] - julBase[i]);
// sai số chuẩn cụm theo mốc gốc
const byOrig = new Map();
jul.forEach((s, i) => { if (!byOrig.has(s.origin)) byOrig.set(s.origin, []); byOrig.get(s.origin).push(diffJul[i]); });
const om = [...byOrig.values()].map(mean);
const mJ = mean(om); const vJ = om.reduce((a, x) => a + (x - mJ) ** 2, 0) / (om.length - 1);
const seJ = Math.sqrt(vJ / om.length);
console.log(`  trần TRONG-MẪU tháng 7 : +${r2(ceiling(jul, GRID_POS).gain)} điểm %`);
console.log(`  KIỂM CHÉO tháng 7      : ${r2(mJ)} ± ${r2(seJ)} điểm % (cụm = 4 mốc gốc)`);
console.log(`  lời theo từng mốc      : ${[...byOrig.entries()].map(([o, a]) => `${o.slice(0, 4)} ${r2(mean(a))}`).join(" · ")}`);

/* ── C. SÀN NHIỄU (hoán vị) ───────────────────────────────────────────────── */
console.log("\n=== C · SÀN NHIỄU — gán trường gió của MỐC GỐC KHÁC (cùng tầm), lấy lại trần trong-mẫu ===");
const B_PERM = 200;
function permSrcMap(ss) {
  const byLead = new Map();
  ss.forEach((s) => { if (!byLead.has(s.lead)) byLead.set(s.lead, []); byLead.get(s.lead).push(s); });
  const map = new Map();
  for (const [, arr] of byLead) {
    const sh = [...arr];
    for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
    arr.forEach((s, k) => map.set(s, sh[k]));
  }
  return (s) => map.get(s);
}
const nullRes = {};
for (const [lbl, ss, observed] of [
  ["tất cả", samples, ceiling(samples, GRID_POS).gain],
  ["tháng 7", jul, ceiling(jul, GRID_POS).gain],
]) {
  const nulls = [];
  for (let b = 0; b < B_PERM; b++) {
    nulls.push(ceiling(ss, GRID_POS, permSrcMap(ss)).gain);
    if ((b + 1) % 40 === 0) process.stdout.write(`${lbl}:${b + 1} `);
  }
  nulls.sort((a, b) => a - b);
  const p = (nulls.filter((v) => v >= observed).length + 1) / (B_PERM + 1);
  const q = (f) => nulls[Math.min(nulls.length - 1, Math.floor(f * nulls.length))];
  console.log(`\n  [${lbl}] quan sát +${r2(observed)} · null trung bình +${r2(mean(nulls))} · null p50 +${r2(q(0.5))} · p95 +${r2(q(0.95))} · max +${r2(nulls[nulls.length - 1])} ⇒ p = ${r2(p)}`);
  nullRes[lbl] = { observed: r2(observed), nullMean: r2(mean(nulls)), p50: r2(q(0.5)), p95: r2(q(0.95)), max: r2(nulls[nulls.length - 1]), p: r2(p) };
}

writeFileSync(OUT, JSON.stringify({ A: rowsA, julyCv: { inSample: r2(ceiling(jul, GRID_POS).gain), cvGain: r2(mJ), se: r2(seJ), picks }, nullRes }, null, 1));
console.log(`\n→ ${OUT}`);
