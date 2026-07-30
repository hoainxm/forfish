// scripts/fish-hypo-wind-diag.mjs  (chạy: npx tsx scripts/fish-hypo-wind-diag.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// CHẨN ĐOÁN cho GIẢ THUYẾT #3 sau khi cổng dừng kích hoạt.
// Mục đích: PHÂN BIỆT hai khả năng — (a) code sai / chỉ số đặt lệch, hay
// (b) tín hiệu THẬT SỰ không có. Kết luận âm chỉ đáng tin nếu loại được (a).
//
// SÁU PHÉP:
//  D1  Chỉ số nước trồi có ĐÚNG chỗ không (bản đồ tháng 7 vs tháng 1).
//  D2  Tương quan U / M với PHẦN DƯ R = sự-thật(T+d) − ảnh(T) — thứ mà số hạng
//      gió được kỳ vọng giải thích. Toàn miền + dải VEN BỜ 10–16°N.
//  D3  TRẦN CẤU TRÚC: phần dư R có sống ở quy mô ≥1° không? Nếu R gần như
//      toàn bộ là chi tiết dưới 1° thì KHÔNG trường gió 1° nào cứu được.
//      Đo bằng "oracle 1°": cộng thẳng R đã làm trơn về 1° (thông tin HOÀN HẢO
//      ở đúng độ phân giải của gió) rồi xem top-100 lên bao nhiêu.
//  D4  Nhạy cảm với PHƯƠNG VỊ BỜ (0/15/30/45/60/75/90°) — loại khả năng đặt
//      lệch hướng dọc bờ.
//  D5  Lưới α mịn ở đầu thấp (0,05…1) — loại khả năng bước lưới 0,5 quá thô.
//  D6  Tập con "được kỳ vọng thắng nhất" (tháng 7 · ven bờ · d≥6): báo để cho
//      thấy NGAY CẢ tập con thiên vị cũng không ăn — KHÔNG phải để tuyên thắng.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildClimScaleMap, decodeClimatology, ABSENT_PERSIST, climShare } from "../src/lib/fish-blend.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, ".cache", "fish-corpus");
const CLIM_PATH = join(ROOT, "public", "data", "fish-climatology.v1.json");
const WIND_PATH = join(ROOT, ".cache", "fish-wind", "era5-1deg.json");
const OUT = join(ROOT, ".cache", "fish-hypo-wind-diag.json");

const TOP_K = 100;
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const INDEX = JSON.parse(readFileSync(join(CORPUS, "index.json"), "utf8"));
const CLIM = decodeClimatology(JSON.parse(readFileSync(CLIM_PATH, "utf8")));
const WIND = JSON.parse(readFileSync(WIND_PATH, "utf8"));
const dayCache = new Map();
const loadDay = (d) => {
  if (dayCache.has(d)) return dayCache.get(d);
  const p = join(CORPUS, "days", `${d}.json`);
  const v = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  dayCache.set(d, v); return v;
};
const { lat0: cLat0, lon0: cLon0, dLat, dLon, nLat, nLon } = CLIM.meta;
const cellKey = (a, b) => `${a},${b}`;
function climRawAt(lat, lon, m) {
  const buf = CLIM.months.get(m); if (!buf) return 0;
  const i = Math.round((lat - cLat0) / dLat), j = Math.round((lon - cLon0) / dLon);
  return i >= 0 && i < nLat && j >= 0 && j < nLon ? (buf[i * nLon + j] ?? 0) : 0;
}

const W_NLAT = WIND.nLat, W_NLON = WIND.nLon, W_LAT0 = WIND.lat0, W_LON0 = WIND.lon0, W_STEP = WIND.step;
const NPT = W_NLAT * W_NLON;
const dateIdx = new Map(WIND.times.map((t, i) => [t, i]));

/** trường ứng suất dọc bờ theo phương vị az, cho một ngày */
function fieldsForAz(azDeg) {
  const cA = Math.sin((azDeg * Math.PI) / 180), cB = Math.cos((azDeg * Math.PI) / 180);
  const ta = [];
  for (let t = 0; t < WIND.times.length; t++) {
    const s = WIND.speed[t], d = WIND.dir[t];
    const f = new Float64Array(NPT);
    for (let k = 0; k < NPT; k++) {
      const sp = s[k] ?? 0, rad = ((d[k] ?? 0) * Math.PI) / 180;
      const u = -sp * Math.sin(rad), v = -sp * Math.cos(rad);
      f[k] = sp * (u * cA + v * cB);
    }
    ta.push(f);
  }
  return ta;
}
const SPD = [];
for (let t = 0; t < WIND.times.length; t++) {
  const s = WIND.speed[t]; const f = new Float64Array(NPT);
  for (let k = 0; k < NPT; k++) f[k] = s[k] ?? 0;
  SPD.push(f);
}
const AZ_LIST = [0, 15, 30, 45, 60, 75, 90];
const TAU_BY_AZ = new Map(AZ_LIST.map((a) => [a, fieldsForAz(a)]));

function winMean(fields, dates) {
  const out = new Float64Array(NPT); let n = 0;
  for (const dt of dates) { const i = dateIdx.get(dt); if (i === undefined) continue; const f = fields[i]; for (let k = 0; k < NPT; k++) out[k] += f[k]; n++; }
  if (n) for (let k = 0; k < NPT; k++) out[k] /= n;
  return out;
}
function bilinear(field, lat, lon) {
  const x = (lon - W_LON0) / W_STEP, y = (lat - W_LAT0) / W_STEP;
  const j0 = Math.max(0, Math.min(W_NLON - 2, Math.floor(x))), i0 = Math.max(0, Math.min(W_NLAT - 2, Math.floor(y)));
  const fx = Math.max(0, Math.min(1, x - j0)), fy = Math.max(0, Math.min(1, y - i0));
  const g = (i, j) => field[i * W_NLON + j];
  return g(i0, j0) * (1 - fx) * (1 - fy) + g(i0, j0 + 1) * fx * (1 - fy) + g(i0 + 1, j0) * (1 - fx) * fy + g(i0 + 1, j0 + 1) * fx * fy;
}
function zscore(a) {
  const n = a.length; let s = 0; for (let i = 0; i < n; i++) s += a[i];
  const m = s / n; let v = 0; for (let i = 0; i < n; i++) v += (a[i] - m) ** 2;
  const sd = Math.sqrt(v / n); const o = new Float64Array(n);
  if (sd > 1e-9) for (let i = 0; i < n; i++) o[i] = (a[i] - m) / sd;
  return o;
}
function topKIdx(vals, K) {
  const heap = [];
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = (i) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
  for (let i = 0; i < vals.length; i++) { if (heap.length < K) { heap.push([vals[i], i]); up(heap.length - 1); } else if (vals[i] > heap[0][0]) { heap[0] = [vals[i], i]; down(0); } }
  return heap.map((h) => h[1]);
}
function ranksOf(arr) {
  const n = arr.length, idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => arr[a] - arr[b]);
  const rk = new Float64Array(n); let i = 0;
  while (i < n) { let j = i; while (j + 1 < n && arr[idx[j + 1]] === arr[idx[i]]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) rk[idx[k]] = avg; i = j + 1; }
  return rk;
}
function pearson(x, y, mask) {
  let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < x.length; i++) { if (mask && !mask[i]) continue; sx += x[i]; sy += y[i]; n++; }
  if (n < 3) return 0;
  const mx = sx / n, my = sy / n; let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { if (mask && !mask[i]) continue; const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}
const spearman = (a, b) => pearson(ranksOf(a), ranksOf(b));

/* ── D1: chỉ số nước trồi có ĐÚNG CHỖ không ───────────────────────────────── */
console.log("=== D1 · CHỈ SỐ NƯỚC TRỒI CÓ ĐÚNG CHỖ KHÔNG (az=30°, trung bình 5 ngày) ===");
for (const [lbl, dates] of [
  ["tháng 7 (gió Tây Nam)", ["2022-07-05", "2022-07-06", "2022-07-07", "2022-07-08", "2022-07-09"]],
  ["tháng 1 (gió Đông Bắc)", ["2022-01-05", "2022-01-06", "2022-01-07", "2022-01-08", "2022-01-09"]],
]) {
  const f = winMean(TAU_BY_AZ.get(30), dates);
  const rows = [];
  for (let i = 0; i < W_NLAT; i++) {
    const lat = W_LAT0 + i;
    if (lat < 8 || lat > 18) continue;
    const o = { "vĩ°N": lat };
    for (const lon of [107, 108, 109, 110, 112, 115]) o[`${lon}E`] = r1(f[i * W_NLON + (lon - W_LON0)]);
    rows.push(o);
  }
  console.log(`-- ${lbl} (τ dọc bờ, dương = đẩy Ekman RA KHƠI ⇒ nước trồi)`);
  console.table(rows);
}

/* ── dựng mẫu (giống script chính) ────────────────────────────────────────── */
const LEADS = INDEX.leads.filter((d) => d >= 1 && d <= 16);
const samples = [];
process.stdout.write("dựng mẫu ");
for (const T of INDEX.origins) {
  const dayT = loadDay(T); if (!dayT) continue;
  const persist = new Map(dayT.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
  const dayScores = dayT.cells.map((c) => c.s);
  const baseDates = []; for (let k = 5; k >= 1; k--) baseDates.push(addDays(T, -k));
  const baseUpAz = new Map(AZ_LIST.map((a) => [a, winMean(TAU_BY_AZ.get(a), baseDates)]));
  const baseMix = winMean(SPD, baseDates);
  for (const d of LEADS) {
    const target = addDays(T, d); const dayY = loadDay(target); if (!dayY) continue;
    const m = dayY.month;
    const truth = new Map(dayY.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
    const scale = buildClimScaleMap(CLIM, m, dayScores);
    const keys = new Set([...persist.keys(), ...truth.keys()]);
    const buf = CLIM.months.get(m);
    if (buf) for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) {
      if (!buf[i * nLon + j]) continue;
      keys.add(cellKey(Math.round((cLat0 + i * dLat) * 100) / 100, Math.round((cLon0 + j * dLon) * 100) / 100));
    }
    const n = keys.size;
    const P = new Float64Array(n), C = new Float64Array(n), Y = new Float64Array(n);
    const lats = new Float64Array(n), lons = new Float64Array(n);
    let i = 0;
    for (const k of keys) {
      const [lat, lon] = k.split(",").map(Number);
      P[i] = persist.has(k) ? persist.get(k) : ABSENT_PERSIST;
      Y[i] = truth.has(k) ? truth.get(k) : ABSENT_PERSIST;
      C[i] = scale[Math.min(100, climRawAt(lat, lon, m))] ?? 0;
      lats[i] = lat; lons[i] = lon; i++;
    }
    const wDates = []; for (let k = 5; k >= 1; k--) wDates.push(addDays(target, -k));
    const mixW = winMean(SPD, wDates);
    const Uaz = new Map();
    for (const a of AZ_LIST) {
      const upW = winMean(TAU_BY_AZ.get(a), wDates); const bU = baseUpAz.get(a);
      const U = new Float64Array(n);
      for (let q = 0; q < n; q++) U[q] = bilinear(upW, lats[q], lons[q]) - bilinear(bU, lats[q], lons[q]);
      Uaz.set(a, zscore(U));
    }
    const M = new Float64Array(n);
    for (let q = 0; q < n; q++) M[q] = bilinear(mixW, lats[q], lons[q]) - bilinear(baseMix, lats[q], lons[q]);
    const R = new Float64Array(n);
    for (let q = 0; q < n; q++) R[q] = Y[q] - P[q];
    const w = 1 - climShare(d);
    const B = new Float64Array(n);
    for (let q = 0; q < n; q++) B[q] = w * P[q] + (1 - w) * C[q];
    const coastal = new Uint8Array(n);
    for (let q = 0; q < n; q++) coastal[q] = lats[q] >= 10 && lats[q] <= 16 && lons[q] <= 112 ? 1 : 0;
    samples.push({ origin: T, year: +T.slice(0, 4), month: m, lead: d, n, P, B, Y, R, Uaz, M: zscore(M), lats, lons, coastal, topTrue: new Set(topKIdx(Y, TOP_K)) });
  }
  process.stdout.write(".");
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const hitOf = (s, pred) => { let h = 0; for (const i of topKIdx(pred, TOP_K)) if (s.topTrue.has(i)) h++; return h; };
console.log(`\n${samples.length} mẫu\n`);
const basePersist = samples.map((s) => hitOf(s, s.P));
const baseBlend = samples.map((s) => hitOf(s, s.B));

/* ── D2: tương quan U / M với PHẦN DƯ ─────────────────────────────────────── */
console.log("=== D2 · TƯƠNG QUAN CHỈ SỐ GIÓ ↔ PHẦN DƯ R = sự-thật(T+d) − ảnh(T) ===");
const d2 = [];
for (const d of LEADS) {
  const ss = samples.filter((s) => s.lead === d);
  d2.push({
    "tầm": d,
    "r(U,R) toàn miền": r3(mean(ss.map((s) => pearson(s.Uaz.get(30), s.R)))),
    "ρ(U,R) hạng": r3(mean(ss.map((s) => spearman(Array.from(s.Uaz.get(30)), Array.from(s.R))))),
    "r(U,R) ven bờ": r3(mean(ss.map((s) => pearson(s.Uaz.get(30), s.R, s.coastal)))),
    "r(M,R) toàn miền": r3(mean(ss.map((s) => pearson(s.M, s.R)))),
    "r(M,R) ven bờ": r3(mean(ss.map((s) => pearson(s.M, s.R, s.coastal)))),
    "r(U,sự thật)": r3(mean(ss.map((s) => pearson(s.Uaz.get(30), s.Y)))),
  });
}
console.table(d2);
const ssJul = samples.filter((s) => s.month === 7);
console.log(`  chỉ THÁNG 7 (n=${ssJul.length}): r(U,R) toàn miền ${r3(mean(ssJul.map((s) => pearson(s.Uaz.get(30), s.R))))} · ven bờ ${r3(mean(ssJul.map((s) => pearson(s.Uaz.get(30), s.R, s.coastal))))}`);

/* ── D3: TRẦN CẤU TRÚC — phần dư có sống ở quy mô 1° không ─────────────────── */
console.log("\n=== D3 · TRẦN CẤU TRÚC: oracle 1° (cộng THẲNG phần dư THẬT đã làm trơn về 1°) ===");
function smoothTo1deg(s) {
  const acc = new Map();
  for (let q = 0; q < s.n; q++) {
    const k = `${Math.floor(s.lats[q])},${Math.floor(s.lons[q])}`;
    const a = acc.get(k) ?? [0, 0]; a[0] += s.R[q]; a[1]++; acc.set(k, a);
  }
  const out = new Float64Array(s.n);
  for (let q = 0; q < s.n; q++) {
    const a = acc.get(`${Math.floor(s.lats[q])},${Math.floor(s.lons[q])}`);
    out[q] = a ? a[0] / a[1] : 0;
  }
  return out;
}
const LAM = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];
const d3 = [];
for (const d of LEADS) {
  const ss = samples.filter((s) => s.lead === d);
  const idxs = ss.map((s) => samples.indexOf(s));
  const smoothed = ss.map(smoothTo1deg);
  let bestP = null, bestB = null;
  // phần R giải thích được bởi quy mô ≥1°
  const varFrac = mean(ss.map((s, i) => {
    const R = s.R, S = smoothed[i]; let vr = 0, vs = 0, mr = 0, ms = 0;
    for (let q = 0; q < s.n; q++) { mr += R[q]; ms += S[q]; }
    mr /= s.n; ms /= s.n;
    for (let q = 0; q < s.n; q++) { vr += (R[q] - mr) ** 2; vs += (S[q] - ms) ** 2; }
    return vr > 0 ? vs / vr : 0;
  }));
  for (const lam of LAM) {
    const hP = ss.map((s, i) => { const p = new Float64Array(s.n); for (let q = 0; q < s.n; q++) p[q] = s.P[q] + lam * smoothed[i][q]; return hitOf(s, p); });
    const hB = ss.map((s, i) => { const p = new Float64Array(s.n); for (let q = 0; q < s.n; q++) p[q] = s.B[q] + lam * smoothed[i][q]; return hitOf(s, p); });
    if (!bestP || mean(hP) > bestP.v) bestP = { lam, v: mean(hP) };
    if (!bestB || mean(hB) > bestB.v) bestB = { lam, v: mean(hB) };
  }
  d3.push({
    "tầm": d,
    "ảnh-thuần": r1(mean(idxs.map((i) => basePersist[i]))),
    "oracle1° trên ảnh": r1(bestP.v),
    "lời(ảnh)": r1(bestP.v - mean(idxs.map((i) => basePersist[i]))),
    "pha-trộn": r1(mean(idxs.map((i) => baseBlend[i]))),
    "oracle1° trên pha-trộn": r1(bestB.v),
    "lời(pha-trộn)": r1(bestB.v - mean(idxs.map((i) => baseBlend[i]))),
    "%var R ở ≥1°": r1(varFrac * 100),
  });
}
console.table(d3);
console.log(`  ⇒ đây là TRẦN TUYỆT ĐỐI của MỌI trường 1° (kể cả biết trước phần dư thật).`);

/* ── D4: nhạy cảm phương vị bờ ────────────────────────────────────────────── */
console.log("\n=== D4 · NHẠY CẢM VỚI PHƯƠNG VỊ BỜ (trần trong-mẫu, α,β ∈ [0,4] bước 0,5) ===");
const AGRID = []; for (let a = 0; a <= 4.0001; a += 0.5) AGRID.push(r2(a));
function ceilingFor(getU, getM, baseKey, subset, agrid = AGRID, bgrid = AGRID) {
  const ss = subset ?? samples;
  const base = ss.map((s) => hitOf(s, s[baseKey]));
  let best = null;
  for (const a of agrid) for (const b of bgrid) {
    if (a === 0 && b === 0) continue;
    const h = ss.map((s) => {
      const U = getU(s), M = getM(s), bs = s[baseKey];
      const p = new Float64Array(s.n);
      for (let q = 0; q < s.n; q++) p[q] = bs[q] + a * U[q] - b * M[q];
      return hitOf(s, p);
    });
    const g = mean(h) - mean(base);
    if (!best || g > best.gain) best = { alpha: a, beta: b, gain: g, hit: mean(h) };
  }
  return { ...best, base: mean(base), n: ss.length };
}
const d4 = [];
for (const az of AZ_LIST) {
  const c = ceilingFor((s) => s.Uaz.get(az), (s) => s.M, "B");
  d4.push({ "phương vị bờ°": az, alpha: c.alpha, beta: c.beta, "top100": r2(c.hit), "lời (điểm %)": r2(c.gain) });
}
console.table(d4);

/* ── D5: lưới α mịn ở đầu thấp ────────────────────────────────────────────── */
console.log("\n=== D5 · LƯỚI MỊN (α,β ∈ {0 … 1} bước 0,05) — loại khả năng bước 0,5 quá thô ===");
const FINE = []; for (let a = 0; a <= 1.0001; a += 0.05) FINE.push(r2(a));
for (const baseKey of ["P", "B"]) {
  const c = ceilingFor((s) => s.Uaz.get(30), (s) => s.M, baseKey, null, FINE, FINE);
  console.log(`  nền ${baseKey === "P" ? "ảnh-thuần" : "pha-trộn"}: α*=${c.alpha} β*=${c.beta} → ${r2(c.hit)} % (lời ${r2(c.gain)})`);
}

/* ── D6: tập con "kỳ vọng thắng nhất" ─────────────────────────────────────── */
console.log("\n=== D6 · TẬP CON ĐƯỢC KỲ VỌNG THẮNG NHẤT (báo để chứng minh KHÔNG có chỗ nào ăn) ===");
const d6 = [];
for (const [lbl, filt] of [
  ["tất cả", () => true],
  ["tháng 7 (Tây Nam)", (s) => s.month === 7],
  ["tháng 7 · d≥6", (s) => s.month === 7 && s.lead >= 6],
  ["d≥6", (s) => s.lead >= 6],
  ["d≥10", (s) => s.lead >= 10],
  ["tháng 1 (Đông Bắc)", (s) => s.month === 1],
]) {
  const sub = samples.filter(filt);
  if (!sub.length) continue;
  const c = ceilingFor((s) => s.Uaz.get(30), (s) => s.M, "B", sub);
  d6.push({ "tập con": lbl, "n mẫu": sub.length, alpha: c.alpha, beta: c.beta, "pha-trộn": r2(c.base), "trần": r2(c.hit), "lời": r2(c.gain) });
}
console.table(d6);
console.log("  (đây là TRẦN TRONG-MẪU trên tập con ⇒ đã thiên vị mạnh CÓ LỢI cho giả thuyết)");

/* ── ĐỘ BỀN: bỏ 1 mốc gốc ─────────────────────────────────────────────────── */
console.log("\n=== ĐỘ BỀN: trần trong-mẫu (V1/az30/pha-trộn) khi BỎ từng mốc gốc ===");
const rob = [];
for (const T of INDEX.origins) {
  const sub = samples.filter((s) => s.origin !== T);
  const c = ceilingFor((s) => s.Uaz.get(30), (s) => s.M, "B", sub);
  rob.push({ "bỏ mốc": T, "lời": r2(c.gain) });
}
console.table(rob);
const robG = rob.map((r) => r["lời"]);
console.log(`  min ${r2(Math.min(...robG))} · max ${r2(Math.max(...robG))} · trung bình ${r2(mean(robG))}`);

writeFileSync(OUT, JSON.stringify({ d2, d3, d4, d6, robustness: rob }, null, 1));
console.log(`\n→ ${OUT}`);
