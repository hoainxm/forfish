// scripts/fish-hypo-wind-forcing.mjs  (chạy: npx tsx scripts/fish-hypo-wind-forcing.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// GIẢ THUYẾT #3 — TẦNG 1 (DỰ BÁO HOÀN HẢO / perfect-prognosis):
// Đưa THÔNG TIN TƯƠNG LAI THẬT (gió ERA5 đã xảy ra ở T+1..T+d) vào điểm cá.
//
//   pred(ô) = base(ô) + α·ẑ(chỉ số NƯỚC TRỒI) − β·ẑ(chỉ số XÁO TRỘN)
//
//   · chỉ số NƯỚC TRỒI = ứng suất gió DỌC BỜ tích luỹ trong cửa sổ [d−L, d−1]
//     (dương = thổi theo hướng đẩy Ekman ra khơi ⇒ nước trồi ⇒ front mới)
//   · chỉ số XÁO TRỘN  = tốc độ gió trung bình cùng cửa sổ (mạnh ⇒ xoá front)
//   · base ∈ { ảnh-thuần P , pha-trộn-hiện-tại w·P+(1−w)·C }
//
// ĐĂNG KÝ TRƯỚC (pre-registration) — ghi ở đây TRƯỚC khi xem kết quả:
//   · THƯỚC ĐO DUY NHẤT: top-100 hit, gộp TOÀN BỘ 16 mốc gốc × 11 tầm.
//   · ĐÚNG 2 THAM SỐ: α, β. Miền chính: α,β ∈ [0, 4] bước 0,5 (dấu do vật lý
//     quy định trước, KHÔNG cho tự do đảo dấu).
//   · BIẾN THỂ được phép thử (họ 4 cái, phải trừ lợi thế hái quả):
//       V1 (CHÍNH) Δ-form, L=5   — trừ đi mức gió ở cửa sổ [T−5,T−1] vì ẢNH
//                                   HÔM NAY ĐÃ CHỨA gió quá khứ rồi
//       V2         tuyệt đối, L=5
//       V3         Δ-form, L=3
//       V4         Δ-form, L=8
//   · CỔNG DỪNG: nếu TRẦN TRONG-MẪU (α,β tối ưu trên CHÍNH dữ liệu test —
//     tức là gian lận có lợi cho giả thuyết) < +0,5 điểm % thì BÁC BỎ NGAY,
//     không đi tìm tập con thắng.
//   · Kết quả chỉ-thắng-tháng-7 / chỉ-thắng-ven-bờ = GIẢ THUYẾT MỚI, KHÔNG tính.
//
// DỮ LIỆU: .cache/fish-corpus (có sẵn) + .cache/fish-wind/era5-1deg.json
//          (tải bằng scripts/fish-hypo-wind-fetch.mjs — 9 request).
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
const WIND_PATH = join(ROOT, ".cache", "fish-wind", "era5-1deg.json");
const OUT = join(ROOT, ".cache", "fish-hypo-wind-result.json");

const TOP_K = 100;
/** hướng BỜ Nam Trung Bộ, phương vị ~30° (chỉ về NNE) — HẰNG SỐ ĐỊA LÝ, không fit */
const COAST_AZ_DEG = 30;
const ALPHA_GRID = [];
for (let a = 0; a <= 4.0001; a += 0.5) ALPHA_GRID.push(Math.round(a * 100) / 100);
const BETA_GRID = ALPHA_GRID;

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const addDays = (isoStr, n) => {
  const d = new Date(`${isoStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/* ── nạp ──────────────────────────────────────────────────────────────────── */
for (const p of [join(CORPUS, "index.json"), CLIM_PATH, WIND_PATH])
  if (!existsSync(p)) {
    console.error(`THIẾU ${p}`);
    process.exit(1);
  }
const INDEX = JSON.parse(readFileSync(join(CORPUS, "index.json"), "utf8"));
const CLIM = decodeClimatology(JSON.parse(readFileSync(CLIM_PATH, "utf8")));
const WIND = JSON.parse(readFileSync(WIND_PATH, "utf8"));

const dayCache = new Map();
function loadDay(date) {
  if (dayCache.has(date)) return dayCache.get(date);
  const p = join(CORPUS, "days", `${date}.json`);
  const v = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  dayCache.set(date, v);
  return v;
}
const { lat0: cLat0, lon0: cLon0, dLat, dLon, nLat, nLon } = CLIM.meta;
const cellKey = (lat, lon) => `${lat},${lon}`;
function climRawAt(lat, lon, month) {
  const buf = CLIM.months.get(month);
  if (!buf) return 0;
  const i = Math.round((lat - cLat0) / dLat);
  const j = Math.round((lon - cLon0) / dLon);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return 0;
  return buf[i * nLon + j] ?? 0;
}

/* ── trường gió: ứng suất dọc bờ + tốc độ, theo NGÀY trên lưới 1° ─────────── */
const W_NLAT = WIND.nLat, W_NLON = WIND.nLon, W_LAT0 = WIND.lat0, W_LON0 = WIND.lon0, W_STEP = WIND.step;
const dateIdx = new Map(WIND.times.map((t, i) => [t, i]));
const NPT = W_NLAT * W_NLON;
const cA = Math.sin((COAST_AZ_DEG * Math.PI) / 180); // thành phần đông của véc-tơ dọc bờ
const cB = Math.cos((COAST_AZ_DEG * Math.PI) / 180); // thành phần bắc
/** tauAlong[t] = Float64Array(NPT): |U|·(U·ĉ)  — tỉ lệ với ứng suất dọc bờ */
const tauAlong = [];
const spdField = [];
for (let t = 0; t < WIND.times.length; t++) {
  const s = WIND.speed[t], d = WIND.dir[t];
  const ta = new Float64Array(NPT);
  const sp = new Float64Array(NPT);
  for (let k = 0; k < NPT; k++) {
    const sp0 = s[k] ?? 0;
    const rad = ((d[k] ?? 0) * Math.PI) / 180;
    const u = -sp0 * Math.sin(rad); // véc-tơ gió THỔI TỚI, thành phần đông
    const v = -sp0 * Math.cos(rad); // ... thành phần bắc
    ta[k] = sp0 * (u * cA + v * cB);
    sp[k] = sp0;
  }
  tauAlong.push(ta);
  spdField.push(sp);
}
/** trung bình một trường theo cửa sổ ngày [from..to] (bao gồm hai đầu) */
function windowMean(fields, from, to) {
  const out = new Float64Array(NPT);
  let n = 0;
  for (let dt = from; dt <= to; dt++) {
    const i = dateIdx.get(dt);
    if (i === undefined) continue;
    const f = fields[i];
    for (let k = 0; k < NPT; k++) out[k] += f[k];
    n++;
  }
  if (n > 0) for (let k = 0; k < NPT; k++) out[k] /= n;
  return { field: out, nDays: n };
}
function windowMeanDates(fields, dates) {
  const out = new Float64Array(NPT);
  let n = 0;
  for (const dt of dates) {
    const i = dateIdx.get(dt);
    if (i === undefined) continue;
    const f = fields[i];
    for (let k = 0; k < NPT; k++) out[k] += f[k];
    n++;
  }
  if (n > 0) for (let k = 0; k < NPT; k++) out[k] /= n;
  return { field: out, nDays: n };
}
/** nội suy song tuyến từ lưới 1° về một ô 0,25° */
function bilinear(field, lat, lon) {
  const x = (lon - W_LON0) / W_STEP;
  const y = (lat - W_LAT0) / W_STEP;
  const j0 = Math.max(0, Math.min(W_NLON - 2, Math.floor(x)));
  const i0 = Math.max(0, Math.min(W_NLAT - 2, Math.floor(y)));
  const fx = Math.max(0, Math.min(1, x - j0));
  const fy = Math.max(0, Math.min(1, y - i0));
  const g = (i, j) => field[i * W_NLON + j];
  return (
    g(i0, j0) * (1 - fx) * (1 - fy) +
    g(i0, j0 + 1) * fx * (1 - fy) +
    g(i0 + 1, j0) * (1 - fx) * fy +
    g(i0 + 1, j0 + 1) * fx * fy
  );
}
function zscore(arr) {
  const n = arr.length;
  let s = 0;
  for (let i = 0; i < n; i++) s += arr[i];
  const m = s / n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (arr[i] - m) ** 2;
  const sd = Math.sqrt(v / n);
  const out = new Float64Array(n);
  if (sd > 1e-9) for (let i = 0; i < n; i++) out[i] = (arr[i] - m) / sd;
  return out;
}

/* ── top-K ────────────────────────────────────────────────────────────────── */
function topKIdx(vals, K) {
  const heap = [];
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
  for (let i = 0; i < vals.length; i++) {
    if (heap.length < K) { heap.push([vals[i], i]); up(heap.length - 1); }
    else if (vals[i] > heap[0][0]) { heap[0] = [vals[i], i]; down(0); }
  }
  return heap.map((h) => h[1]);
}

/* ── dựng mẫu ─────────────────────────────────────────────────────────────── */
const LEADS = INDEX.leads.filter((d) => d >= 1 && d <= 16);
const VARIANTS = [
  { id: "V1", label: "Δ-form L=5 (CHÍNH)", L: 5, delta: true },
  { id: "V2", label: "tuyệt đối L=5", L: 5, delta: false },
  { id: "V3", label: "Δ-form L=3", L: 3, delta: true },
  { id: "V4", label: "Δ-form L=8", L: 8, delta: true },
];

const samples = [];
let skipped = 0;
process.stdout.write("dựng mẫu ");
for (const T of INDEX.origins) {
  const dayT = loadDay(T);
  if (!dayT) { skipped++; continue; }
  const persist = new Map(dayT.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
  const dayScores = dayT.cells.map((c) => c.s);
  // cửa sổ NỀN tại T (cho Δ-form), theo từng L
  const baseWin = {};
  for (const L of [3, 5, 8]) {
    const dates = [];
    for (let k = L; k >= 1; k--) dates.push(addDays(T, -k));
    baseWin[L] = {
      up: windowMeanDates(tauAlong, dates),
      mix: windowMeanDates(spdField, dates),
    };
  }
  for (const d of LEADS) {
    const target = addDays(T, d);
    const dayY = loadDay(target);
    if (!dayY) { skipped++; continue; }
    const m = dayY.month;
    const truth = new Map(dayY.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
    const scale = buildClimScaleMap(CLIM, m, dayScores);

    const keys = new Set([...persist.keys(), ...truth.keys()]);
    const buf = CLIM.months.get(m);
    if (buf)
      for (let i = 0; i < nLat; i++)
        for (let j = 0; j < nLon; j++) {
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
      lats[i] = lat; lons[i] = lon;
      i++;
    }
    // trường gió cửa sổ [T+d−L, T+d−1] cho từng biến thể
    const feat = {};
    for (const V of VARIANTS) {
      const dates = [];
      for (let k = V.L; k >= 1; k--) dates.push(addDays(target, -k));
      const up = windowMeanDates(tauAlong, dates).field;
      const mix = windowMeanDates(spdField, dates).field;
      const upB = baseWin[V.L].up.field, mixB = baseWin[V.L].mix.field;
      const U = new Float64Array(n), M = new Float64Array(n);
      for (let q = 0; q < n; q++) {
        const u1 = bilinear(up, lats[q], lons[q]);
        const m1 = bilinear(mix, lats[q], lons[q]);
        if (V.delta) {
          U[q] = u1 - bilinear(upB, lats[q], lons[q]);
          M[q] = m1 - bilinear(mixB, lats[q], lons[q]);
        } else { U[q] = u1; M[q] = m1; }
      }
      feat[V.id] = { U: zscore(U), M: zscore(M) };
    }
    const w = 1 - climShare(d);
    const B = new Float64Array(n);
    for (let q = 0; q < n; q++) B[q] = w * P[q] + (1 - w) * C[q];
    samples.push({
      origin: T, year: +T.slice(0, 4), month: m, lead: d, n,
      P, C, B, lats, lons, feat,
      topTrue: new Set(topKIdx(Y, TOP_K)),
    });
  }
  process.stdout.write(".");
}
console.log(`\n${samples.length} mẫu (bỏ ${skipped}), ô/mẫu ≈ ${Math.round(samples.reduce((a, s) => a + s.n, 0) / samples.length)}\n`);

const hitOf = (s, pred) => {
  let h = 0;
  for (const i of topKIdx(pred, TOP_K)) if (s.topTrue.has(i)) h++;
  return (h / TOP_K) * 100;
};
function hitWith(s, baseKey, vid, alpha, beta) {
  const base = s[baseKey];
  const { U, M } = s.feat[vid];
  const pred = new Float64Array(s.n);
  for (let i = 0; i < s.n; i++) pred[i] = base[i] + alpha * U[i] - beta * M[i];
  return hitOf(s, pred);
}

/* ── BASELINE ─────────────────────────────────────────────────────────────── */
const basePersist = samples.map((s) => hitOf(s, s.P));
const baseBlend = samples.map((s) => hitOf(s, s.B));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log("=== BASELINE (gộp toàn bộ) ===");
console.log(`  ảnh-thuần        : ${r2(mean(basePersist))} %`);
console.log(`  pha-trộn hiện tại: ${r2(mean(baseBlend))} %  (chênh ${r2(mean(baseBlend) - mean(basePersist))})`);

const byLead = (arr) => {
  const m = new Map();
  samples.forEach((s, i) => {
    if (!m.has(s.lead)) m.set(s.lead, []);
    m.get(s.lead).push(arr[i]);
  });
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([l, v]) => [l, r1(mean(v))]);
};
console.log("  ảnh-thuần theo tầm:", JSON.stringify(Object.fromEntries(byLead(basePersist))));
console.log("  pha-trộn theo tầm :", JSON.stringify(Object.fromEntries(byLead(baseBlend))));

/* ── TRẦN TRONG-MẪU (cổng dừng) ───────────────────────────────────────────── */
console.log("\n=== TRẦN TRONG-MẪU (α,β tối ưu NGAY TRÊN dữ liệu test — thiên vị CÓ LỢI cho giả thuyết) ===");
const ceilTable = [];
const gainCache = new Map(); // `${baseKey}|${vid}|${a}|${b}` → mảng hit theo mẫu
function hitsFor(baseKey, vid, a, b) {
  const k = `${baseKey}|${vid}|${a}|${b}`;
  let v = gainCache.get(k);
  if (!v) {
    v = samples.map((s) => hitWith(s, baseKey, vid, a, b));
    gainCache.set(k, v);
  }
  return v;
}
for (const baseKey of ["P", "B"]) {
  const base = baseKey === "P" ? basePersist : baseBlend;
  for (const V of VARIANTS) {
    let best = null;
    for (const a of ALPHA_GRID)
      for (const b of BETA_GRID) {
        if (a === 0 && b === 0) continue;
        const h = hitsFor(baseKey, V.id, a, b);
        const g = mean(h) - mean(base);
        if (!best || g > best.gain) best = { alpha: a, beta: b, gain: g, hit: mean(h) };
      }
    ceilTable.push({
      base: baseKey === "P" ? "ảnh-thuần" : "pha-trộn",
      variant: V.id, label: V.label,
      alpha: best.alpha, beta: best.beta,
      hit: r2(best.hit), gain: r2(best.gain),
    });
  }
}
console.table(ceilTable);

const bestCeil = Math.max(...ceilTable.map((r) => r.gain));
const primaryCeil = ceilTable.find((r) => r.base === "pha-trộn" && r.variant === "V1").gain;
console.log(`\nTRẦN cao nhất trong cả họ 4 biến thể × 2 nền: ${r2(bestCeil)} điểm %`);
console.log(`TRẦN của cấu hình CHÍNH (V1 trên pha-trộn):    ${r2(primaryCeil)} điểm %`);
console.log(`NGƯỠNG ĐÁNG KỂ: +0,50 điểm %`);

const result = {
  ranAt: new Date().toISOString().slice(0, 10),
  nSamples: samples.length, nOrigins: INDEX.origins.length, leads: LEADS,
  coastAzimuthDeg: COAST_AZ_DEG,
  baseline: { persist: r2(mean(basePersist)), blend: r2(mean(baseBlend)) },
  baselineByLead: { persist: byLead(basePersist), blend: byLead(baseBlend) },
  inSampleCeiling: ceilTable,
  bestCeilingGain: r2(bestCeil),
  primaryCeilingGain: r2(primaryCeil),
};

if (bestCeil < 0.5) {
  console.log(`\n>>> CỔNG DỪNG KÍCH HOẠT: ngay cả TRẦN gian lận cũng < +0,5 ⇒ BÁC BỎ giả thuyết #3 tầng 1.`);
  console.log(`>>> Gió DỰ BÁO (tầng 2) chắc chắn còn tệ hơn ⇒ KHÔNG chạy tầng 2.`);
  result.verdict = "BAC_BO_TAI_CONG_DUNG";
} else {
  /* ── KIỂM CHÉO THEO MỐC GỐC ────────────────────────────────────────────── */
  console.log("\n=== KIỂM CHÉO ===");
  const origins = INDEX.origins.filter((T) => samples.some((s) => s.origin === T));
  const years = [...new Set(origins.map((T) => +T.slice(0, 4)))].sort();

  function cvRun(foldOf, foldIds, baseKey, vid) {
    const base = baseKey === "P" ? basePersist : baseBlend;
    const cvHit = new Array(samples.length).fill(null);
    const picks = [];
    for (const f of foldIds) {
      const trainIdx = [], testIdx = [];
      samples.forEach((s, i) => (foldOf(s) === f ? testIdx : trainIdx).push(i));
      if (!testIdx.length || !trainIdx.length) continue;
      let best = null;
      for (const a of ALPHA_GRID)
        for (const b of BETA_GRID) {
          const h = hitsFor(baseKey, vid, a, b);
          let g = 0;
          for (const i of trainIdx) g += h[i] - base[i];
          g /= trainIdx.length;
          if (!best || g > best.g) best = { a, b, g };
        }
      picks.push({ fold: f, alpha: best.a, beta: best.b, trainGain: r2(best.g) });
      const h = hitsFor(baseKey, vid, best.a, best.b);
      for (const i of testIdx) cvHit[i] = h[i];
    }
    return { cvHit, picks };
  }

  // gộp theo mốc gốc để tính sai số chuẩn (cụm = mốc gốc)
  function clusteredSE(diffs) {
    const byOrigin = new Map();
    samples.forEach((s, i) => {
      if (diffs[i] == null) return;
      if (!byOrigin.has(s.origin)) byOrigin.set(s.origin, []);
      byOrigin.get(s.origin).push(diffs[i]);
    });
    const om = [...byOrigin.values()].map(mean);
    const m = mean(om);
    const v = om.reduce((a, x) => a + (x - m) ** 2, 0) / (om.length - 1);
    return { mean: m, se: Math.sqrt(v / om.length), k: om.length, originMeans: [...byOrigin.entries()].map(([o, a]) => [o, r2(mean(a))]) };
  }

  const cvTable = [];
  const cvDetail = {};
  for (const baseKey of ["P", "B"]) {
    const base = baseKey === "P" ? basePersist : baseBlend;
    for (const V of VARIANTS) {
      for (const [name, foldOf, foldIds] of [
        ["LOYO (4 năm)", (s) => s.year, years],
        ["LOO-mốc (16)", (s) => s.origin, origins],
      ]) {
        const { cvHit, picks } = cvRun(foldOf, foldIds, baseKey, V.id);
        const diffs = cvHit.map((h, i) => (h == null ? null : h - base[i]));
        const st = clusteredSE(diffs);
        cvTable.push({
          base: baseKey === "P" ? "ảnh-thuần" : "pha-trộn",
          variant: V.id, cv: name,
          gain: r2(st.mean), se: r2(st.se),
          t: r2(st.mean / (st.se || 1e-9)),
        });
        cvDetail[`${baseKey}|${V.id}|${name}`] = { picks, originMeans: st.originMeans, gain: r2(st.mean), se: r2(st.se) };
      }
    }
  }
  console.table(cvTable);
  result.cv = cvTable;
  result.cvDetail = cvDetail;

  /* ── HOÁN VỊ: trừ lợi thế hái quả (family-wise) ─────────────────────────── */
  console.log("\n=== HOÁN VỊ (đảo gán trường gió sang mốc gốc khác cùng tầm) ===");
  const B_PERM = 200;
  const observedBest = Math.max(...cvTable.filter((r) => r.cv === "LOYO (4 năm)").map((r) => r.gain));
  // null: gán trường gió của một mốc gốc NGẪU NHIÊN khác (cùng tầm) → phá liên
  // hệ nhân quả nhưng GIỮ nguyên cấu trúc không gian của gió
  const byLeadIdx = new Map();
  samples.forEach((s, i) => {
    if (!byLeadIdx.has(s.lead)) byLeadIdx.set(s.lead, []);
    byLeadIdx.get(s.lead).push(i);
  });
  let ge = 0;
  const nullBest = [];
  for (let b = 0; b < B_PERM; b++) {
    // hoán vị: mỗi tầm, xáo trộn feat giữa các mốc gốc
    const permFeat = new Array(samples.length);
    for (const [, idxs] of byLeadIdx) {
      const sh = [...idxs];
      for (let i = sh.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sh[i], sh[j]] = [sh[j], sh[i]];
      }
      idxs.forEach((i, k) => (permFeat[i] = sh[k]));
    }
    let bestNull = -Infinity;
    for (const baseKey of ["P", "B"]) {
      const base = baseKey === "P" ? basePersist : baseBlend;
      for (const V of VARIANTS) {
        // in-sample optimum trên dữ liệu hoán vị (xấp xỉ trần của CV)
        let bg = -Infinity;
        for (const a of ALPHA_GRID)
          for (const bb of BETA_GRID) {
            if (a === 0 && bb === 0) continue;
            let g = 0;
            for (let i = 0; i < samples.length; i++) {
              const s = samples[i];
              const src = samples[permFeat[i]];
              const { U, M } = src.feat[V.id];
              // ô khác nhau giữa hai mốc ⇒ dùng min chiều dài, phần dư = 0
              const pred = new Float64Array(s.n);
              const lim = Math.min(s.n, src.n);
              const bs = s[baseKey];
              for (let q = 0; q < lim; q++) pred[q] = bs[q] + a * U[q] - bb * M[q];
              for (let q = lim; q < s.n; q++) pred[q] = bs[q];
              g += hitOf(s, pred) - base[i];
            }
            g /= samples.length;
            if (g > bg) bg = g;
          }
        if (bg > bestNull) bestNull = bg;
      }
    }
    nullBest.push(bg2(bestNull));
    if (bestNull >= observedBest) ge++;
    if ((b + 1) % 20 === 0) process.stdout.write(`${b + 1} `);
  }
  function bg2(x) { return r2(x); }
  const pFW = (ge + 1) / (B_PERM + 1);
  console.log(`\n  quan sát (LOYO tốt nhất họ): ${r2(observedBest)}  ·  null trung bình ${r2(mean(nullBest))}  ·  p family-wise = ${r2(pFW)}`);
  result.permutation = { B: B_PERM, observedBest: r2(observedBest), nullMean: r2(mean(nullBest)), pFamilyWise: pFW };
  result.verdict = observedBest >= 0.5 && pFW < 0.05 ? "THANG" : "HOA_HOAC_THUA";
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(`\n→ ${OUT}`);
