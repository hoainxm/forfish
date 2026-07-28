/* eslint-disable no-console */
/**
 * GIẢ THUYẾT #1 — Neo bằng TRUNG BÌNH ĐỘNG CỦA CHÍNH MÌNH (N ngày gần nhất)
 * thay vì bản mùa vụ nhiều năm.
 *
 *   P_avg(T', N) = trung bình bản đồ điểm các ngày T'-k, k = 0..N-1
 *                  trên HỢP tập ô; ô vắng = ABSENT_PERSIST = 12
 *
 * THƯỚC ĐO: top-100 hit — trong 100 ô cho điểm cao nhất, bao nhiêu ô nằm trong
 * 100 ô cao nhất THẬT của ngày đó.
 *   ⚠ ĐỒNG ĐIỂM: bản đồ N=1 có 12–19 ô đồng điểm ngay mốc cắt top-100, bản
 *   trung bình thì gần như không ⇒ tie-break tuỳ tiện SẼ thiên vị. Ở đây dùng
 *   KỲ VỌNG (fractional membership) — chính xác về mặt toán với tie-break ngẫu
 *   nhiên độc lập, và áp dụng ĐỒNG NHẤT cho mọi phương pháp.
 *
 * "SỰ THẬT" = bản đồ cá tính từ ảnh vệ tinh ngày T'+d bằng chính buildFishForecast
 * — KHÔNG phải sản lượng cá thật.
 *
 * THIẾT KẾ "DỜI MỐC GỐC VÀO TRONG": mỗi khối corpus có ngày 10..16 rồi 18,20,
 * 22,24,26. Dời mốc T' vào trong ⇒ có sẵn CỬA SỔ QUÁ KHỨ (10..T') mà phía trước
 * vẫn còn tầm ngày.
 *   A: T'=16 → cửa sổ tối đa 7 ngày liên tục, tầm d ∈ {2,4,6,8,10}
 *   B: T'=14 → cửa sổ tối đa 5, tầm d ∈ {1,2,4,6,8,10,12}
 *   C: T'=12 → cửa sổ tối đa 3, tầm d ∈ {1,2,3,4,6,8,10,14}
 *
 * BASELINE (cùng tập mẫu, cùng universe ô, cùng cách xử lý đồng điểm):
 *   (a) N=1 = ảnh thuần (persistence)
 *   (b) pha trộn ĐANG CHẠY = w productCurve của src/lib/fish-blend.ts (6 %→56 %)
 *   (b') pha trộn với w TỐI ƯU đo được (measuredWeight) — tham khảo
 *   (c) mùa vụ thuần — kiểm tra khoẻ
 *
 * 0 REQUEST mạng.  Chạy:  node scripts/fish-hypo-selfavg.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] ?? "C:/Code/ForFish");
const CORPUS = path.join(ROOT, ".cache/fish-corpus");
const DAYS = path.join(CORPUS, "days");
const CLIM_PATH = path.join(ROOT, "public/data/fish-climatology.v1.json");
const WEIGHTS_PATH = path.join(ROOT, "src/data/fish-blend-weights.json");
const OUT = path.join(ROOT, ".cache/fish-hypo-selfavg-result.json");

const ABSENT_PERSIST = 12;
const TOP_K = 100;
const SEED = 20260728;

/* ── nạp dữ liệu ─────────────────────────────────────────────────────────── */

const index = JSON.parse(fs.readFileSync(path.join(CORPUS, "index.json"), "utf8"));
const CLIM = JSON.parse(fs.readFileSync(CLIM_PATH, "utf8"));
const WEIGHTS = JSON.parse(fs.readFileSync(WEIGHTS_PATH, "utf8"));

const climBuf = {};
for (let m = 1; m <= 12; m++) {
  const b64 = CLIM.months?.[String(m)];
  if (!b64) continue;
  const arr = new Uint8Array(Buffer.from(b64, "base64"));
  if (arr.length !== CLIM.nLat * CLIM.nLon) continue;
  climBuf[m] = arr;
}

const dayMaps = new Map();
function loadDay(date) {
  if (dayMaps.has(date)) return dayMaps.get(date);
  const f = path.join(DAYS, `${date}.json`);
  if (!fs.existsSync(f)) {
    dayMaps.set(date, null);
    return null;
  }
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const m = new Map();
  for (const c of j.cells) m.set(`${c.lat},${c.lon}`, c.s);
  dayMaps.set(date, m);
  return m;
}

const pad = (n) => String(n).padStart(2, "0");
function addDays(iso, d) {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
const monthOf = (iso) => Number(iso.slice(5, 7));

/* ── w(d) của bản ĐANG CHẠY (sao chép nguyên văn từ src/lib/fish-blend.ts) ── */

const MEASURED = (WEIGHTS.perLead ?? [])
  .filter((r) => typeof r?.w === "number")
  .map((r) => ({ lead: r.lead, w: Math.min(1, Math.max(0, r.w)) }))
  .sort((a, b) => a.lead - b.lead);

function measuredWeight(d0) {
  const d = Math.max(0, d0);
  if (d === 0) return 1;
  if (d <= MEASURED[0].lead) return 1 + (d / MEASURED[0].lead) * (MEASURED[0].w - 1);
  for (let i = 0; i < MEASURED.length - 1; i++) {
    const a = MEASURED[i];
    const b = MEASURED[i + 1];
    if (d <= b.lead) return a.w + ((d - a.lead) / (b.lead - a.lead)) * (b.w - a.w);
  }
  return MEASURED[MEASURED.length - 1].w;
}
const PS_FIRST = 0.06;
const PS_LAST = 0.56;
const PS_GAMMA = 2.5;
function climShare(d0) {
  const d = Math.max(0, d0);
  if (d === 0) return 0;
  const raw = 1 - measuredWeight(d);
  const lo = 1 - measuredWeight(MEASURED[0].lead);
  const hi = 1 - measuredWeight(MEASURED[MEASURED.length - 1].lead);
  if (!(hi > lo)) {
    const t = Math.min(1, d / Math.max(1, MEASURED[MEASURED.length - 1].lead));
    return PS_FIRST + t * (PS_LAST - PS_FIRST);
  }
  const t = (raw - lo) / (hi - lo);
  return Math.max(
    0,
    Math.min(1, PS_FIRST + Math.pow(Math.max(0, Math.min(1, t)), PS_GAMMA) * (PS_LAST - PS_FIRST)),
  );
}
const wRunning = (d) => 1 - climShare(d);

/* ── quy đổi phân vị mùa vụ → thang bản đồ ngày (sao chép fish-blend.ts) ──── */

function buildClimScaleMap(month, dayScores) {
  const identity = new Uint8Array(101);
  for (let i = 0; i <= 100; i++) identity[i] = i;
  const buf = climBuf[month];
  if (!buf || !dayScores.length) return identity;
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
  const dayAtPct = [];
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
      out[0] = 0;
      continue;
    }
    const p = (acc + climHist[v] / 2) / nClim;
    acc += climHist[v];
    out[v] = climHist[v] === 0 ? out[v - 1] : dayAtPct[Math.round(p * 1000)];
  }
  for (let v = 1; v <= 100; v++) if (out[v] < out[v - 1]) out[v] = out[v - 1];
  return out;
}

/* ── top-K với ĐỒNG ĐIỂM xử lý bằng KỲ VỌNG ──────────────────────────────── */

function topKProb(scores, K) {
  const n = scores.length;
  const p = new Float64Array(n);
  if (n <= K) {
    p.fill(1);
    return p;
  }
  const sorted = Float64Array.from(scores).sort();
  const tau = sorted[n - K];
  let above = 0;
  let eq = 0;
  for (let i = 0; i < n; i++) {
    if (scores[i] > tau) above++;
    else if (scores[i] === tau) eq++;
  }
  const frac = eq > 0 ? Math.max(0, Math.min(1, (K - above) / eq)) : 0;
  for (let i = 0; i < n; i++) {
    if (scores[i] > tau) p[i] = 1;
    else if (scores[i] === tau) p[i] = frac;
  }
  return p;
}

/** kỳ vọng số ô trùng giữa top-K của pred và top-K của truth, đơn vị điểm % */
function hitPct(pred, truthProb) {
  const pp = topKProb(pred, TOP_K);
  let s = 0;
  for (let i = 0; i < pp.length; i++) s += pp[i] * truthProb[i];
  return (s / TOP_K) * 100;
}

/* ── dựng một mẫu (khối mốc gốc, T', d) ──────────────────────────────────── */

const MAX_BACK = 7;

function buildSample(block, Tp, d) {
  const originDay = addDays(block, Tp - 10);
  const truthDay = addDays(block, Tp - 10 + d);
  const truth = loadDay(truthDay);
  if (!truth) return null;

  const past = [];
  for (let k = 0; k < MAX_BACK; k++) {
    const ds = addDays(originDay, -k);
    const m = loadDay(ds);
    if (!m) break; // chỉ nhận cửa sổ NGÀY LIÊN TỤC
    past.push({ date: ds, map: m });
  }
  if (!past.length) return null;

  const month = monthOf(truthDay);
  const cbuf = climBuf[month];

  const keys = new Set();
  for (const p of past) for (const k of p.map.keys()) keys.add(k);
  for (const k of truth.keys()) keys.add(k);
  if (cbuf)
    for (let i = 0; i < CLIM.nLat; i++)
      for (let j = 0; j < CLIM.nLon; j++) {
        if (!cbuf[i * CLIM.nLon + j]) continue;
        const lat = Math.round((CLIM.lat0 + i * CLIM.dLat) * 100) / 100;
        const lon = Math.round((CLIM.lon0 + j * CLIM.dLon) * 100) / 100;
        keys.add(`${lat},${lon}`);
      }
  const KEYS = [...keys];
  const n = KEYS.length;

  const P = past.map((p) => {
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = p.map.has(KEYS[i]) ? p.map.get(KEYS[i]) : ABSENT_PERSIST;
    return a;
  });
  // MẶT NẠ có mặt (1 = ô thật sự có số hôm đó) — để thử biến thể "trung bình
  // chỉ trên ngày CÓ SỐ", tránh lẫn 'mây che' với 'điểm thấp'
  const M = past.map((p) => {
    const a = new Uint8Array(n);
    for (let i = 0; i < n; i++) a[i] = p.map.has(KEYS[i]) ? 1 : 0;
    return a;
  });
  // HẠNG PHÂN VỊ trong từng ngày (0..1) — để thử trung bình theo HẠNG
  const Rk = P.map((a) => {
    const ord = Array.from({ length: n }, (_, i) => i).sort((x, y) => a[x] - a[y]);
    const rk = new Float64Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && a[ord[j + 1]] === a[ord[i]]) j++;
      const mid = (i + j) / 2 / Math.max(1, n - 1);
      for (let k = i; k <= j; k++) rk[ord[k]] = mid;
      i = j + 1;
    }
    return rk;
  });
  const Y = new Float64Array(n);
  for (let i = 0; i < n; i++) Y[i] = truth.has(KEYS[i]) ? truth.get(KEYS[i]) : ABSENT_PERSIST;

  const scale = buildClimScaleMap(month, Array.from(P[0]));
  const C = new Float64Array(n);
  if (cbuf)
    for (let i = 0; i < n; i++) {
      const ci = KEYS[i].indexOf(",");
      const gi = Math.round((Number(KEYS[i].slice(0, ci)) - CLIM.lat0) / CLIM.dLat);
      const gj = Math.round((Number(KEYS[i].slice(ci + 1)) - CLIM.lon0) / CLIM.dLon);
      const raw =
        gi >= 0 && gi < CLIM.nLat && gj >= 0 && gj < CLIM.nLon
          ? (cbuf[gi * CLIM.nLon + gj] ?? 0)
          : 0;
      C[i] = scale[Math.min(100, raw)] ?? 0;
    }

  return { block, Tp, d, n, keys: KEYS, P, M, Rk, Y, C, truthDay, originDay, nPast: past.length };
}

/** trung bình thẳng, ô vắng = ABSENT_PERSIST (khớp fish-blend.ts) */
function avgMap(sample, N) {
  const k = Math.min(N, sample.P.length);
  const out = new Float64Array(sample.n);
  for (let j = 0; j < k; j++) {
    const a = sample.P[j];
    for (let i = 0; i < sample.n; i++) out[i] += a[i];
  }
  for (let i = 0; i < sample.n; i++) out[i] /= k;
  return out;
}
/** BIẾN THỂ 1 (steel-man): trung bình CHỈ trên ngày ô đó CÓ SỐ (mây che ≠ điểm thấp) */
function avgMapNan(sample, N) {
  const k = Math.min(N, sample.P.length);
  const out = new Float64Array(sample.n);
  for (let i = 0; i < sample.n; i++) {
    let s = 0;
    let c = 0;
    for (let j = 0; j < k; j++)
      if (sample.M[j][i]) {
        s += sample.P[j][i];
        c++;
      }
    out[i] = c ? s / c : ABSENT_PERSIST;
  }
  return out;
}
/* BIẾN THỂ 3 (steel-man MẠNH NHẤT) — LỌC KHÔNG TRỄ.
   Trung bình lùi N ngày có TRỌNG TÂM ở T−(N−1)/2 ⇒ nó tự kéo dài tầm dự báo
   thêm (N−1)/2 ngày. Đó là CÁI GIÁ ẩn, ăn hết phần lợi triệt nhiễu.
   Lọc không trễ: chọn w_k (k = 0..N−1) sao cho Σw = 1 VÀ Σ k·w_k = 0 (trọng tâm
   đúng ngày T), đồng thời TỐI THIỂU Σw² (triệt nhiễu nhiều nhất có thể).
   Nghiệm Lagrange: w_k = a + b·k. Phải chấp nhận trọng số ÂM ở ngày cũ. */
function lagFreeWeights(N) {
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let k = 0; k < N; k++) {
    s0 += 1;
    s1 += k;
    s2 += k * k;
  }
  const det = s0 * s2 - s1 * s1;
  if (det === 0) return [1];
  const a = s2 / det;
  const b = -s1 / det;
  return Array.from({ length: N }, (_, k) => a + b * k);
}
const LAGFREE_W = {};
function avgMapLagFree(sample, N) {
  const k = Math.min(N, sample.P.length);
  const w = (LAGFREE_W[k] ??= lagFreeWeights(k));
  const out = new Float64Array(sample.n);
  for (let j = 0; j < k; j++) {
    const a = sample.P[j];
    const wj = w[j];
    for (let i = 0; i < sample.n; i++) out[i] += wj * a[i];
  }
  return out;
}
/** BIẾN THỂ 2 (steel-man): trung bình theo HẠNG trong ngày (bỏ lệch phân bố ngày) */
function avgMapRank(sample, N) {
  const k = Math.min(N, sample.P.length);
  const out = new Float64Array(sample.n);
  for (let j = 0; j < k; j++) {
    const a = sample.Rk[j];
    for (let i = 0; i < sample.n; i++) out[i] += a[i];
  }
  for (let i = 0; i < sample.n; i++) out[i] /= k;
  return out;
}

/* ── thống kê cơ bản ─────────────────────────────────────────────────────── */

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1));
}
const se = (a) => (a.length < 2 ? 0 : sd(a) / Math.sqrt(a.length));
const r2 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 100) / 100);

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── thiết kế ────────────────────────────────────────────────────────────── */

const BLOCKS = index.origins;
const DESIGNS = [
  { id: "A", Tp: 16, leads: [2, 4, 6, 8, 10], Ns: [1, 2, 3, 5, 7] },
  { id: "B", Tp: 14, leads: [1, 2, 4, 6, 8, 10, 12], Ns: [1, 2, 3, 5] },
  { id: "C", Tp: 12, leads: [1, 2, 3, 4, 6, 8, 10, 14], Ns: [1, 2, 3] },
];

function methodsFor(design) {
  const ms = {};
  for (const N of design.Ns) ms[`avg${N}`] = (s) => avgMap(s, N);
  for (const N of design.Ns) if (N !== 1) ms[`nan${N}`] = (s) => avgMapNan(s, N);
  for (const N of design.Ns) if (N !== 1) ms[`rank${N}`] = (s) => avgMapRank(s, N);
  for (const N of design.Ns) if (N >= 3) ms[`lagfree${N}`] = (s) => avgMapLagFree(s, N);
  ms.blendRun = (s) => {
    const w = wRunning(s.d);
    const o = new Float64Array(s.n);
    for (let i = 0; i < s.n; i++) o[i] = w * s.P[0][i] + (1 - w) * s.C[i];
    return o;
  };
  ms.blendOpt = (s) => {
    const w = measuredWeight(s.d);
    const o = new Float64Array(s.n);
    for (let i = 0; i < s.n; i++) o[i] = w * s.P[0][i] + (1 - w) * s.C[i];
    return o;
  };
  ms.climOnly = (s) => Float64Array.from(s.C);
  const Nmax = Math.max(...design.Ns);
  ms.avgMaxBlend = (s) => {
    const a = avgMap(s, Nmax);
    const w = wRunning(s.d);
    const o = new Float64Array(s.n);
    for (let i = 0; i < s.n; i++) o[i] = w * a[i] + (1 - w) * s.C[i];
    return o;
  };
  return ms;
}

function runDesign(design) {
  const methods = methodsFor(design);
  const names = Object.keys(methods);
  const Nmax = Math.max(...design.Ns);
  // hits[lead][method][block] = %
  const hits = new Map();
  const ceil3 = new Map();
  const ceil2 = new Map();
  const gap = new Map();

  for (const d of design.leads) {
    const per = {};
    for (const nm of names) per[nm] = new Map();
    const c3 = new Map();
    const c2 = new Map();
    for (const block of BLOCKS) {
      const s = buildSample(block, design.Tp, d);
      if (!s || s.nPast < Nmax) continue; // tập mẫu ĐỒNG NHẤT cho mọi N
      const tProb = topKProb(s.Y, TOP_K);
      for (const nm of names) per[nm].set(block, hitPct(methods[nm](s), tProb));

      // TRẦN: sự thật MƯỢT bằng hai ngày kề (có trong corpus), gap nhỏ nhất
      let picked = null;
      for (const g of [1, 2]) {
        const ma = loadDay(addDays(s.truthDay, -g));
        const mb = loadDay(addDays(s.truthDay, g));
        if (ma && mb) {
          picked = { ma, mb, g };
          break;
        }
      }
      if (picked) {
        gap.set(d, picked.g);
        const sm3 = new Float64Array(s.n);
        const sm2 = new Float64Array(s.n);
        for (let i = 0; i < s.n; i++) {
          const k = s.keys[i];
          const A = picked.ma.has(k) ? picked.ma.get(k) : ABSENT_PERSIST;
          const B = picked.mb.has(k) ? picked.mb.get(k) : ABSENT_PERSIST;
          sm3[i] = (A + s.Y[i] + B) / 3;
          sm2[i] = (A + B) / 2;
        }
        c3.set(block, hitPct(sm3, tProb));
        c2.set(block, hitPct(sm2, tProb));
      }
    }
    hits.set(d, per);
    ceil3.set(d, c3);
    ceil2.set(d, c2);
  }
  return { design, names, hits, ceil3, ceil2, gap };
}

/* ── chạy ────────────────────────────────────────────────────────────────── */

console.log("nạp corpus…");
for (const dt of index.days) loadDay(dt);
console.log(`  ${[...dayMaps.values()].filter(Boolean).length}/${index.days.length} ngày`);
console.log(
  `mùa vụ ${CLIM.years?.join("–")}, lưới ${CLIM.nLat}×${CLIM.nLon}, ${Object.keys(climBuf).length} tháng`,
);
console.log(`TOP_K=${TOP_K}, ABSENT_PERSIST=${ABSENT_PERSIST}, đồng điểm = kỳ vọng\n`);

const out = { generatedAt: new Date().toISOString(), topK: TOP_K, designs: {} };
const ALLR = {};

for (const design of DESIGNS) {
  const R = runDesign(design);
  ALLR[design.id] = R;
  const Nmax = Math.max(...design.Ns);
  console.log(
    `\n══════ THIẾT KẾ ${design.id} — mốc T' = ngày ${design.Tp} của khối, cửa sổ tối đa ${Nmax} ngày ══════`,
  );

  const rowsOut = [];
  const table = [];
  for (const d of design.leads) {
    const per = R.hits.get(d);
    const blocks = [...per.avg1.keys()];
    if (!blocks.length) continue;
    const row = { d, nMoc: blocks.length };
    for (const nm of R.names) row[nm] = mean(blocks.map((b) => per[nm].get(b)));
    const c3 = R.ceil3.get(d);
    const c2 = R.ceil2.get(d);
    row.tran3 = c3.size ? mean([...c3.values()]) : null;
    row.tran2 = c2.size ? mean([...c2.values()]) : null;
    row.tranN = c3.size;
    row.gap = R.gap.get(d) ?? null;
    for (const nm of R.names) {
      if (nm !== "avg1") {
        const df = blocks.map((b) => per[nm].get(b) - per.avg1.get(b));
        row[`${nm}_vsAnh`] = mean(df);
        row[`${nm}_seAnh`] = se(df);
      }
      if (nm !== "blendRun") {
        const df = blocks.map((b) => per[nm].get(b) - per.blendRun.get(b));
        row[`${nm}_vsBlend`] = mean(df);
        row[`${nm}_seBlend`] = se(df);
      }
    }
    rowsOut.push(row);

    const t = { d, n: blocks.length };
    for (const N of design.Ns) t[`N=${N}`] = r2(row[`avg${N}`]);
    for (const N of design.Ns) if (N !== 1) t[`nan${N}`] = r2(row[`nan${N}`]);
    for (const N of design.Ns) if (N !== 1) t[`rank${N}`] = r2(row[`rank${N}`]);
    for (const N of design.Ns) if (N >= 3) t[`lagfree${N}`] = r2(row[`lagfree${N}`]);
    t["blend chạy"] = r2(row.blendRun);
    t["blend w*"] = r2(row.blendOpt);
    t["mùa vụ"] = r2(row.climOnly);
    t[`N${Nmax}+mùa`] = r2(row.avgMaxBlend);
    t["TRẦN ±g gồm ngày đó"] = r2(row.tran3);
    t["TRẦN nội suy"] = r2(row.tran2);
    t["g"] = row.gap;
    table.push(t);
  }
  console.table(table);

  console.log("HIỆU so với ẢNH THUẦN (N=1) — ghép cặp theo mốc gốc, ± sai số chuẩn (n=16):");
  console.table(
    rowsOut.map((row) => {
      const t = { d: row.d };
      for (const N of design.Ns)
        if (N !== 1)
          for (const k of ["avg", "rank", ...(N >= 3 ? ["lagfree"] : [])])
            t[`${k}${N}`] =
              `${row[`${k}${N}_vsAnh`] >= 0 ? "+" : ""}${r2(row[`${k}${N}_vsAnh`])}±${r2(row[`${k}${N}_seAnh`])}`;
      t["blend chạy"] =
        `${row.blendRun_vsAnh >= 0 ? "+" : ""}${r2(row.blendRun_vsAnh)} ±${r2(row.blendRun_seAnh)}`;
      t[`N${Nmax}+mùa`] =
        `${row.avgMaxBlend_vsAnh >= 0 ? "+" : ""}${r2(row.avgMaxBlend_vsAnh)} ±${r2(row.avgMaxBlend_seAnh)}`;
      return t;
    }),
  );

  console.log("HIỆU so với PHA TRỘN ĐANG CHẠY:");
  console.table(
    rowsOut.map((row) => {
      const t = { d: row.d };
      for (const nm of ["avg1", ...design.Ns.filter((N) => N !== 1).flatMap((N) => [`avg${N}`, `nan${N}`, `rank${N}`])])
        t[nm] =
          `${row[`${nm}_vsBlend`] >= 0 ? "+" : ""}${r2(row[`${nm}_vsBlend`])}±${r2(row[`${nm}_seBlend`])}`;
      return t;
    }),
  );

  /* ── FAMILY-WISE: permutation dấu ghép cặp trên TRUNG BÌNH theo mốc gốc ──
     Thống kê: với mỗi N ∈ {2..Nmax}, lấy Δ_block = trung bình (theo d trong dải)
     của [hit(avgN) − hit(avg1)]. Hoán vị = đổi dấu ngẫu nhiên từng MỐC GỐC.
     p family-wise = P(max_N |t_perm| ≥ |t_quan sát của N tốt nhất|).            */
  function fwTest(leadFilter, label, refName = "avg1") {
    // HỌ GIẢ THUYẾT = mọi (kiểu trung bình × N) — phải trừ lợi thế hái quả
    const fam = [];
    for (const N of design.Ns)
      if (N !== 1) {
        for (const k of ["avg", "nan", "rank"]) fam.push(`${k}${N}`);
        if (N >= 3) fam.push(`lagfree${N}`);
      }
    const leads = design.leads.filter(leadFilter);
    if (!leads.length) return null;
    const perBlock = {};
    for (const N of fam) perBlock[N] = [];
    const blocks = [...R.hits.get(leads[0]).avg1.keys()];
    for (const b of blocks)
      for (const N of fam) {
        const vals = leads.map((d) => {
          const per = R.hits.get(d);
          return per[N].get(b) - per[refName].get(b);
        });
        perBlock[N].push(mean(vals));
      }
    const tOf = (arr) => {
      const s = se(arr);
      return s > 0 ? mean(arr) / s : 0;
    };
    let bestN = fam[0];
    for (const N of fam) if (Math.abs(tOf(perBlock[N])) > Math.abs(tOf(perBlock[bestN]))) bestN = N;
    const tObs = Math.abs(tOf(perBlock[bestN]));
    const rnd = mulberry32(SEED);
    const B = 20000;
    let ge = 0;
    for (let it = 0; it < B; it++) {
      const flip = blocks.map(() => (rnd() < 0.5 ? -1 : 1));
      let mx = 0;
      for (const N of fam) {
        const arr = perBlock[N].map((v, i) => v * flip[i]);
        mx = Math.max(mx, Math.abs(tOf(arr)));
      }
      if (mx >= tObs - 1e-12) ge++;
    }
    const p = (ge + 1) / (B + 1);
    const res = {
      label,
      leads,
      family: fam,
      bestN,
      gain: mean(perBlock[bestN]),
      se: se(perBlock[bestN]),
      t: tObs,
      pFamilyWise: p,
      pNaive: null,
    };
    // p ngây thơ (chưa trừ hái quả) cho N tốt nhất, cùng permutation nhưng 1 giả thuyết
    {
      const rnd2 = mulberry32(SEED + 7);
      let g2 = 0;
      for (let it = 0; it < B; it++) {
        const arr = perBlock[bestN].map((v) => v * (rnd2() < 0.5 ? -1 : 1));
        if (Math.abs(tOf(arr)) >= tObs - 1e-12) g2++;
      }
      res.pNaive = (g2 + 1) / (B + 1);
    }
    // độ bền: bỏ 1 mốc gốc bất kỳ
    const jk = blocks.map((_, i) => mean(perBlock[bestN].filter((_, j) => j !== i)));
    res.jackMin = Math.min(...jk);
    res.jackMax = Math.max(...jk);
    res.perBlockBest = perBlock[bestN];
    res.allN = Object.fromEntries(fam.map((N) => [N, mean(perBlock[N])]));
    return res;
  }

  const fwFar = fwTest((d) => d >= 8, "vs ẢNH THUẦN · d ≥ 8");
  const fwAll = fwTest(() => true, "vs ẢNH THUẦN · mọi tầm");
  const fwFarB = fwTest((d) => d >= 8, "vs BLEND ĐANG CHẠY · d ≥ 8", "blendRun");
  const fwAllB = fwTest(() => true, "vs BLEND ĐANG CHẠY · mọi tầm", "blendRun");
  for (const fw of [fwFar, fwAll, fwFarB, fwAllB]) {
    if (!fw) continue;
    console.log(
      `\n[${fw.label}] tốt nhất = ${fw.bestN} · hơn baseline ${fw.gain >= 0 ? "+" : ""}${r2(fw.gain)} ±${r2(fw.se)} điểm % ` +
        `· p(chưa trừ) ${fw.pNaive.toFixed(4)} · p FAMILY-WISE ${fw.pFamilyWise.toFixed(4)} ` +
        `· bỏ 1 mốc: ${r2(fw.jackMin)}…${r2(fw.jackMax)}`,
    );
    console.log(
      `   cả họ: ` +
        Object.entries(fw.allN)
          .map(([N, g]) => `${N} ${g >= 0 ? "+" : ""}${r2(g)}`)
          .join(" · "),
    );
  }

  /* ── LOYO: chọn N trên 3 năm, đo ở năm còn lại ─────────────────────────── */
  function loyo(leadFilter, label, refName = "avg1") {
    const fam = [];
    for (const N of design.Ns)
      if (N !== 1) {
        for (const k of ["avg", "nan", "rank"]) fam.push(`${k}${N}`);
        if (N >= 3) fam.push(`lagfree${N}`);
      }
    const leads = design.leads.filter(leadFilter);
    const years = [...new Set(BLOCKS.map((b) => b.slice(0, 4)))];
    const rows = [];
    let acc = [];
    for (const yOut of years) {
      const tr = BLOCKS.filter((b) => b.slice(0, 4) !== yOut);
      const te = BLOCKS.filter((b) => b.slice(0, 4) === yOut);
      const gainOn = (blocks, N) => {
        const v = [];
        for (const b of blocks)
          for (const d of leads) {
            const per = R.hits.get(d);
            if (!per[refName].has(b)) continue;
            v.push(per[N].get(b) - per[refName].get(b));
          }
        return v.length ? mean(v) : NaN;
      };
      let bestN = fam[0];
      for (const N of fam) if (gainOn(tr, N) > gainOn(tr, bestN)) bestN = N;
      const g = gainOn(te, bestN);
      rows.push({ "năm giữ lại": yOut, "cách học được": bestN, [`hơn ${refName} (điểm %)`]: r2(g) });
      acc.push(g);
    }
    console.log(`\nLOYO [${label}] — chọn N trên 3 năm, đo ở năm còn lại:`);
    console.table(rows);
    console.log(
      `   trung bình LOYO = ${mean(acc) >= 0 ? "+" : ""}${r2(mean(acc))} ±${r2(se(acc))} điểm %`,
    );
    return { label, rows, meanGain: mean(acc), se: se(acc) };
  }
  const loyoFar = loyo((d) => d >= 8, "vs ẢNH THUẦN · d ≥ 8");
  const loyoAll = loyo(() => true, "vs ẢNH THUẦN · mọi tầm");
  const loyoFarB = loyo((d) => d >= 8, "vs BLEND ĐANG CHẠY · d ≥ 8", "blendRun");

  out.designs[design.id] = {
    design,
    rows: rowsOut.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, r2(v) ?? v]))),
    fwFar,
    fwAll,
    fwFarB,
    fwAllB,
    loyoFar,
    loyoAll,
    loyoFarB,
  };
}

/* ── GỘP BA THIẾT KẾ: câu trả lời cuối cùng ──────────────────────────────── */
console.log(`\n\n══════ GỘP BA THIẾT KẾ (mỗi mốc gốc = 1 đơn vị, gộp mọi T' và mọi d) ══════`);
{
  const FAM = ["avg2", "avg3", "avg5", "avg7", "nan2", "nan3", "nan5", "nan7", "rank2", "rank3", "rank5", "rank7", "lagfree3", "lagfree5", "lagfree7"];
  function pooled(leadFilter, refName, label) {
    const perBlock = {};
    for (const nm of FAM) perBlock[nm] = new Map(BLOCKS.map((b) => [b, []]));
    const refPer = new Map(BLOCKS.map((b) => [b, []]));
    for (const id of Object.keys(ALLR)) {
      const R = ALLR[id];
      for (const d of R.design.leads) {
        if (!leadFilter(d)) continue;
        const per = R.hits.get(d);
        if (!per) continue;
        for (const b of per[refName].keys()) {
          for (const nm of FAM) if (per[nm]) perBlock[nm].get(b).push(per[nm].get(b) - per[refName].get(b));
          refPer.get(b).push(per[refName].get(b));
        }
      }
    }
    const avail = FAM.filter((nm) => [...perBlock[nm].values()].some((v) => v.length));
    const vec = {};
    for (const nm of avail)
      vec[nm] = BLOCKS.map((b) => (perBlock[nm].get(b).length ? mean(perBlock[nm].get(b)) : NaN)).filter(
        (v) => !Number.isNaN(v),
      );
    const tOf = (a) => (se(a) > 0 ? mean(a) / se(a) : 0);
    let best = avail[0];
    for (const nm of avail) if (mean(vec[nm]) > mean(vec[best])) best = nm;
    let bestT = avail[0];
    for (const nm of avail) if (Math.abs(tOf(vec[nm])) > Math.abs(tOf(vec[bestT]))) bestT = nm;
    const tObs = Math.abs(tOf(vec[bestT]));
    const rnd = mulberry32(SEED + 99);
    const B = 20000;
    let ge = 0;
    const nB = vec[bestT].length;
    /* MỘT PHÍA: "có biến thể nào THẮNG hơn mức ngẫu nhiên cho phép không?"
       thống kê = max_nm t_nm (CÓ DẤU). Đây mới là câu hỏi đúng — p hai phía có
       thể do một biến thể THUA rất đậm kéo, chẳng nói lên điều gì về thắng. */
    let tWinObs = -Infinity;
    for (const nm of avail) tWinObs = Math.max(tWinObs, tOf(vec[nm]));
    let geWin = 0;
    for (let it = 0; it < B; it++) {
      const flip = Array.from({ length: nB }, () => (rnd() < 0.5 ? -1 : 1));
      let mx = 0;
      let mxSigned = -Infinity;
      for (const nm of avail) {
        const t = tOf(vec[nm].map((v, i) => v * flip[i % nB]));
        mx = Math.max(mx, Math.abs(t));
        mxSigned = Math.max(mxSigned, t);
      }
      if (mx >= tObs - 1e-12) ge++;
      if (mxSigned >= tWinObs - 1e-12) geWin++;
    }
    const pWin = (geWin + 1) / (B + 1);
    const jk = vec[best].map((_, i) => mean(vec[best].filter((_, j) => j !== i)));
    const res = {
      label,
      ref: refName,
      nMocGoc: vec[best].length,
      bestByGain: best,
      gain: mean(vec[best]),
      se: se(vec[best]),
      bestByT: bestT,
      tObs,
      pFamilyWise: (ge + 1) / (B + 1),
      pFamilyWiseOneSidedWin: pWin,
      tWinObs,
      jackMin: Math.min(...jk),
      jackMax: Math.max(...jk),
      all: Object.fromEntries(avail.map((nm) => [nm, r2(mean(vec[nm]))])),
    };
    console.log(
      `\n[${label}] baseline = ${refName}, n = ${res.nMocGoc} mốc gốc\n` +
        `   tốt nhất theo mức hơn: ${best} = ${res.gain >= 0 ? "+" : ""}${r2(res.gain)} ±${r2(res.se)} điểm %` +
        ` · bỏ 1 mốc gốc: ${r2(res.jackMin)}…${r2(res.jackMax)}\n` +
        `   p FAMILY-WISE MỘT PHÍA "có biến thể nào THẮNG không" (họ ${avail.length}, 20 000 hoán vị) = ${pWin.toFixed(4)}
` +
        `   p FAMILY-WISE hai phía (tham khảo, có thể do biến thể THUA đậm kéo) = ${res.pFamilyWise.toFixed(4)}`,
    );
    console.log(
      `   cả họ: ` + Object.entries(res.all).map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`).join(" · "),
    );
    return res;
  }
  out.pooled = {
    vsAnh_far: pooled((d) => d >= 8, "avg1", "vs ẢNH THUẦN · d ≥ 8"),
    vsAnh_all: pooled(() => true, "avg1", "vs ẢNH THUẦN · mọi tầm"),
    vsBlend_far: pooled((d) => d >= 8, "blendRun", "vs BLEND ĐANG CHẠY · d ≥ 8"),
    vsBlend_all: pooled(() => true, "blendRun", "vs BLEND ĐANG CHẠY · mọi tầm"),
  };

  /* ── PHÂN RÃ: bao nhiêu phần thua là do TRỄ, bao nhiêu phần lợi là TRIỆT NHIỄU
     Trung bình lùi N ngày có trọng tâm ở T−(N−1)/2 ⇒ tương đương kéo dài tầm.
     Đo: "tầm ngày tương đương" d_eq = tầm mà ẢNH THUẦN đạt đúng điểm của avgN.
     Nếu avgN chỉ là bản ảnh thuần bị trễ thì d_eq − d = (N−1)/2.
     d_eq − d NHỎ HƠN (N−1)/2 ⇒ phần chênh chính là LỢI TRIỆT NHIỄU (tính bằng
     ngày tầm mua được). */
  console.log(`
── PHÂN RÃ: TRỄ (lag) so với LỢI TRIỆT NHIỄU ──`);
  const decomp = [];
  for (const id of Object.keys(ALLR)) {
    const R = ALLR[id];
    const leads = R.design.leads;
    const curve = leads.map((d) => {
      const per = R.hits.get(d);
      const blocks = [...per.avg1.keys()];
      return [d, mean(blocks.map((b) => per.avg1.get(b)))];
    });
    const dEq = (v) => {
      // nội suy ngược đường cong ảnh thuần (giảm dần theo d)
      for (let i = 0; i < curve.length - 1; i++) {
        const [d0, h0] = curve[i];
        const [d1, h1] = curve[i + 1];
        if (v <= h0 && v >= h1 && h0 !== h1) return d0 + ((h0 - v) / (h0 - h1)) * (d1 - d0);
      }
      if (v > curve[0][1]) {
        const [d0, h0] = curve[0];
        const [d1, h1] = curve[1];
        return d0 + ((h0 - v) / (h0 - h1)) * (d1 - d0); // ngoại suy nhẹ
      }
      const [d0, h0] = curve[curve.length - 2];
      const [d1, h1] = curve[curve.length - 1];
      return d0 + ((h0 - v) / (h0 - h1)) * (d1 - d0);
    };
    for (const N of R.design.Ns) {
      if (N === 1) continue;
      for (const d of leads) {
        const per = R.hits.get(d);
        const blocks = [...per.avg1.keys()];
        const h = mean(blocks.map((b) => per[`avg${N}`].get(b)));
        const eq = dEq(h);
        decomp.push({
          "thiết kế": id,
          N,
          d,
          "trễ lý thuyết (ngày)": (N - 1) / 2,
          "tầm tương đương d_eq": r2(eq),
          "d_eq − d": r2(eq - d),
          "ngày tầm MUA lại được nhờ triệt nhiễu": r2((N - 1) / 2 - (eq - d)),
        });
      }
    }
  }
  console.table(decomp.filter((r) => r["thiết kế"] === "A"));
  out.decomposition = decomp;

  // TRẦN gộp theo tầm ngày
  console.log(`\n── TRẦN (cận trên): lấy sự thật MƯỢT làm dự báo ──`);
  const ceilRows = [];
  for (const id of Object.keys(ALLR)) {
    const R = ALLR[id];
    for (const d of R.design.leads) {
      const c3 = R.ceil3.get(d);
      const c2 = R.ceil2.get(d);
      if (!c3?.size) continue;
      const per = R.hits.get(d);
      const blocks = [...per.avg1.keys()];
      ceilRows.push({
        "thiết kế": id,
        d,
        "gap ±ngày": R.gap.get(d),
        "ảnh thuần": r2(mean(blocks.map((b) => per.avg1.get(b)))),
        "blend chạy": r2(mean(blocks.map((b) => per.blendRun.get(b)))),
        "TRẦN gồm chính ngày đó": r2(mean([...c3.values()])),
        "TRẦN nội suy (2 ngày kề)": r2(mean([...c2.values()])),
      });
    }
  }
  console.table(ceilRows);
  out.ceiling = ceilRows;
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`\n→ ${OUT}`);
