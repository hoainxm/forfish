// scripts/fish-analog-year-eval.mjs   (chạy: node scripts/fish-analog-year-eval.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// ĐO: "BẢN MÙA VỤ CÓ ĐIỀU KIỆN" (analog year) CÓ HƠN TRUNG BÌNH ĐỀU KHÔNG?
//
// CÂU HỎI CỦA CHỦ DỰ ÁN: bản mùa vụ đang trung bình ĐỀU 6 năm cho mỗi tháng.
// Năm El Niño / La Niña, năm nóng / lạnh thì bản đồ cá khác nhau → có nên chọn
// hoặc NẶNG KÝ các năm GIỐNG năm nay (theo chỉ số hải dương) thay vì trung bình
// đều không?
//
// CÁCH ĐO (chỉ dùng kho có sẵn .cache/fish-corpus, KHÔNG gọi lại ERDDAP):
//   Việc 1 — chỉ số hải dương (sstMean/anomMean/chlLogMean) có PHÂN BIỆT được
//            các năm không: bảng tháng × năm + tỷ lệ (lệch giữa năm)/(nhiễu ngày).
//   Việc 2 — bản đồ cá CÙNG THÁNG ở các năm KHÁC nhau bao nhiêu: tương quan hạng
//            từng cặp năm, đối chiếu với hai mốc tham chiếu (cùng năm cách 16
//            ngày = "gần nhau tới đâu là bình thường"; khác tháng = "khác tới đâu
//            mới gọi là khác").
//   Việc 3 — KIỂM CHÉO BỎ-NĂM (bắt buộc): với mỗi mốc gốc T = (năm y, tháng m),
//            dựng bản mùa vụ tháng m CHỈ TỪ CÁC NĂM ≠ y, theo 2 cách:
//              (A) trung bình ĐỀU
//              (B) trung bình có TRỌNG SỐ theo độ giống chỉ số (nhiều công thức)
//            rồi so với SỰ THẬT ngày T+8 / T+16 bằng top-100 hit + tương quan hạng.
//   Việc 4 — TRẦN LÝ THUYẾT: "oracle" = chọn bằng hậu nghiệm năm nào cho kết quả
//            tốt nhất. Nếu oracle không hơn trung bình đều bao nhiêu thì MỌI công
//            thức trọng số đều vô ích — đây mới là số quyết định.
//
// ĐẦU RA: .cache/fish-analog-result.json + bảng console.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const DAYS_DIR = ".cache/fish-corpus/days";
const OUT = ".cache/fish-analog-result.json";
/** Ô vắng mặt trong lưới cá = điểm < KEEP_MIN(25), KHÔNG phải 0 — khớp
    ABSENT_PERSIST trong src/lib/fish-blend.ts và fit-fish-blend-weights.mjs */
const ABSENT_PERSIST = 12;
const TOP_K = 100;

const YEARS = [2022, 2023, 2024, 2025];
const MONTHS = [1, 4, 7, 10];
/** ngày có trong kho cho mỗi mốc gốc (lead 0..16) */
const LEADS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16];
/** tầm ngày đem đi chấm — CHỈ tầm XA (nơi bản mùa vụ thật sự gánh việc).
    Nhiều tầm ⇒ nhiều mẫu hơn, NHƯNG các tầm cùng một mốc gốc KHÔNG độc lập ⇒
    mọi kiểm định bên dưới đều gộp theo MỐC GỐC (cụm 16 mốc), không theo dòng. */
const EVAL_LEADS = [8, 10, 12, 14, 16];

const pad = (n) => String(n).padStart(2, "0");
const dateOf = (y, m, lead) => `${y}-${pad(m)}-${pad(10 + lead)}`;

/* ── nạp kho ──────────────────────────────────────────────────────────────── */
const cache = new Map();
function loadDay(date) {
  if (cache.has(date)) return cache.get(date);
  const p = `${DAYS_DIR}/${date}.json`;
  if (!existsSync(p)) {
    cache.set(date, null);
    return null;
  }
  const j = JSON.parse(readFileSync(p, "utf8"));
  const map = new Map(j.cells.map((c) => [`${c.lat},${c.lon}`, c.s]));
  const rec = { date: j.date, month: j.month, idx: j.idx, map };
  cache.set(date, rec);
  return rec;
}

/* ── thống kê cơ bản ──────────────────────────────────────────────────────── */
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
function std(a) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

/** hạng trung bình cho giá trị bằng nhau (điểm là số nguyên → RẤT nhiều ô bằng nhau) */
function ranks(v) {
  const n = v.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => v[a] - v[b]);
  const r = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && v[idx[j + 1]] === v[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

/** tương quan hạng Spearman (Pearson trên hạng, xử lý đúng ties) */
function spearman(x, y) {
  if (x.length !== y.length || x.length < 3) return NaN;
  const rx = ranks(x);
  const ry = ranks(y);
  const mx = mean([...rx]);
  const my = mean([...ry]);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < rx.length; i++) {
    const a = rx[i] - mx;
    const b = ry[i] - my;
    sxy += a * b;
    sxx += a * a;
    syy += b * b;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** top-K hit %: bao nhiêu trong K ô dự đoán cao nhất nằm trong K ô THẬT cao nhất */
function topKHit(pred, truth, K = TOP_K) {
  const n = pred.length;
  if (n < K) return NaN;
  const order = (v) =>
    Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => v[b] - v[a])
      .slice(0, K);
  const set = new Set(order(truth));
  let hit = 0;
  for (const i of order(pred)) if (set.has(i)) hit++;
  return (hit / K) * 100;
}

/* ── lấy vector điểm trên một tập ô chung ─────────────────────────────────── */
function vecOf(map, keys) {
  const out = new Float64Array(keys.length);
  for (let i = 0; i < keys.length; i++) {
    const v = map.get(keys[i]);
    out[i] = v == null ? ABSENT_PERSIST : v;
  }
  return out;
}

/** trung bình nhiều Map điểm (theo ô, ô vắng = ABSENT_PERSIST) với trọng số */
function weightedMean(maps, weights) {
  const keys = new Set();
  for (const m of maps) for (const k of m.keys()) keys.add(k);
  const wsum = weights.reduce((s, w) => s + w, 0);
  const out = new Map();
  for (const k of keys) {
    let acc = 0;
    for (let i = 0; i < maps.length; i++) {
      const v = maps[i].get(k);
      acc += weights[i] * (v == null ? ABSENT_PERSIST : v);
    }
    out.set(k, acc / wsum);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIỆC 1 — CHỈ SỐ HẢI DƯƠNG CÓ PHÂN BIỆT ĐƯỢC CÁC NĂM KHÔNG?
   ═══════════════════════════════════════════════════════════════════════════ */
const IDX_KEYS = ["sstMean", "anomMean", "chlLogMean", "sstStd"];

/** chỉ số TRUNG BÌNH của một (năm, tháng) — trung bình các ngày có trong kho */
const ymIdx = {}; // "y-m" → {sstMean, ...}
const ymIdxNoise = {}; // "y-m" → std theo ngày trong tháng (nhiễu nội tháng)
for (const y of YEARS)
  for (const m of MONTHS) {
    const days = LEADS.map((l) => loadDay(dateOf(y, m, l))).filter(Boolean);
    const rec = {};
    const noise = {};
    for (const k of IDX_KEYS) {
      const vals = days.map((d) => d.idx?.[k]).filter(Number.isFinite);
      rec[k] = mean(vals);
      noise[k] = std(vals);
    }
    rec._n = days.length;
    ymIdx[`${y}-${m}`] = rec;
    ymIdxNoise[`${y}-${m}`] = noise;
  }

const task1 = { table: {}, spread: {} };
console.log("\n" + "═".repeat(78));
console.log("VIỆC 1 — CHỈ SỐ HẢI DƯƠNG THEO THÁNG × NĂM (trung bình các ngày trong kho)");
console.log("═".repeat(78));
for (const k of IDX_KEYS) {
  console.log(`\n▸ ${k}`);
  console.log(
    "  tháng │ " +
      YEARS.map((y) => String(y).padStart(8)).join(" │ ") +
      " │  lệch-năm │ nhiễu-ngày │ tỷ lệ",
  );
  task1.table[k] = {};
  task1.spread[k] = {};
  for (const m of MONTHS) {
    const vals = YEARS.map((y) => ymIdx[`${y}-${m}`][k]);
    const across = std(vals);
    const within = mean(YEARS.map((y) => ymIdxNoise[`${y}-${m}`][k]));
    const ratio = within > 0 ? across / within : NaN;
    task1.table[k][m] = Object.fromEntries(YEARS.map((y, i) => [y, r3(vals[i])]));
    task1.spread[k][m] = { acrossYearStd: r3(across), withinMonthStd: r3(within), ratio: r3(ratio) };
    console.log(
      `  ${String(m).padStart(5)} │ ` +
        vals.map((v) => (v == null ? "     —" : v.toFixed(3)).padStart(8)).join(" │ ") +
        ` │ ${across.toFixed(3).padStart(9)} │ ${within.toFixed(3).padStart(10)} │ ${ratio.toFixed(2)}`,
    );
  }
}
console.log(
  "\n  Đọc: 'lệch-năm' = độ lệch chuẩn giữa 4 năm · 'nhiễu-ngày' = độ lệch giữa các\n" +
    "  ngày TRONG cùng tháng-năm · tỷ lệ >1 ⇒ khác biệt giữa năm LỚN HƠN nhiễu ngày\n" +
    "  ⇒ chỉ số ĐÚNG LÀ phân biệt được năm (điều kiện CẦN để chọn năm tương tự).",
);

/* ── CÁC CHỈ SỐ CÓ TRÙNG NHAU KHÔNG? (bỏ trung bình THÁNG rồi mới tính) ───── */
function centeredByMonth(k) {
  const out = [];
  for (const m of MONTHS) {
    const v = YEARS.map((y) => ymIdx[`${y}-${m}`][k]);
    const mu = mean(v);
    out.push(...v.map((x) => x - mu));
  }
  return out;
}
function pearson(a, b) {
  const ma = mean(a);
  const mb = mean(b);
  let n = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    n += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? n / Math.sqrt(da * db) : NaN;
}
const CORE = ["sstMean", "anomMean", "chlLogMean"];
const cen = Object.fromEntries(CORE.map((k) => [k, centeredByMonth(k)]));
task1.interIndexCorr = {};
console.log("\n▸ CÁC CHỈ SỐ CÓ ĐỘC LẬP KHÔNG (tương quan sau khi bỏ trung bình tháng)");
for (let i = 0; i < CORE.length; i++)
  for (let j = i + 1; j < CORE.length; j++) {
    const r = pearson(cen[CORE[i]], cen[CORE[j]]);
    task1.interIndexCorr[`${CORE[i]}~${CORE[j]}`] = r3(r);
    console.log(`  r(${CORE[i]}, ${CORE[j]}) = ${r >= 0 ? "+" : ""}${r.toFixed(4)}`);
  }
console.log(
  "\n  ⚠ sstMean và anomMean TRÙNG NHAU HOÀN TOÀN (r = 1,000): 'dị thường' = nhiệt\n" +
    "  trừ nền khí hậu, mà nền đó GIỐNG NHAU ở mọi năm trong cùng tháng ⇒ giữa các\n" +
    "  năm hai chỉ số là MỘT. Thực chất chỉ có 2 chỉ số độc lập: NHIỆT và PHÙ DU.\n" +
    "  ⇒ d_z '3 chỉ số' thực ra đang tính nhiệt HAI LẦN trên tổng ba phần.",
);

/* ═══════════════════════════════════════════════════════════════════════════
   VIỆC 2 — BẢN ĐỒ CÁ CÙNG THÁNG Ở CÁC NĂM KHÁC NHAU BAO NHIÊU?
   ═══════════════════════════════════════════════════════════════════════════ */
/** bản đồ "điển hình" của một (năm, tháng) = trung bình các ngày trong kho */
function yearMonthMap(y, m) {
  const days = LEADS.map((l) => loadDay(dateOf(y, m, l))).filter(Boolean);
  if (!days.length) return null;
  return weightedMean(days.map((d) => d.map), days.map(() => 1));
}
const ymMap = {};
for (const y of YEARS) for (const m of MONTHS) ymMap[`${y}-${m}`] = yearMonthMap(y, m);

function corrOfMaps(a, b) {
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  return spearman(vecOf(a, keys), vecOf(b, keys));
}

const task2 = { sameMonthCrossYear: {}, refSameYear16d: {}, refCrossMonth: [] };
console.log("\n" + "═".repeat(78));
console.log("VIỆC 2 — TƯƠNG QUAN HẠNG BẢN ĐỒ CÁ: CÙNG THÁNG, KHÁC NĂM");
console.log("═".repeat(78));
const allCrossYear = [];
for (const m of MONTHS) {
  const pairs = [];
  for (let i = 0; i < YEARS.length; i++)
    for (let j = i + 1; j < YEARS.length; j++) {
      const c = corrOfMaps(ymMap[`${YEARS[i]}-${m}`], ymMap[`${YEARS[j]}-${m}`]);
      pairs.push({ a: YEARS[i], b: YEARS[j], rho: r3(c) });
      allCrossYear.push(c);
    }
  task2.sameMonthCrossYear[m] = pairs;
  console.log(
    `  tháng ${pad(m)} │ ` +
      pairs.map((p) => `${String(p.a).slice(2)}-${String(p.b).slice(2)}:${p.rho.toFixed(2)}`).join("  ") +
      ` │ TB ${mean(pairs.map((p) => p.rho)).toFixed(3)}`,
  );
}
console.log(`\n  TRUNG BÌNH cùng-tháng-khác-năm: rho = ${mean(allCrossYear).toFixed(3)}`);

// tham chiếu 1: CÙNG năm, cùng tháng, cách 16 ngày (bản đồ tự đổi bao nhiêu)
const ref16 = [];
for (const y of YEARS)
  for (const m of MONTHS) {
    const a = loadDay(dateOf(y, m, 0));
    const b = loadDay(dateOf(y, m, 16));
    if (a && b) ref16.push(corrOfMaps(a.map, b.map));
  }
task2.refSameYear16d = { mean: r3(mean(ref16)), n: ref16.length };
console.log(`  THAM CHIẾU cùng-năm cách-16-ngày:  rho = ${mean(ref16).toFixed(3)}  (n=${ref16.length})`);

// tham chiếu 2: cùng năm, KHÁC tháng (khác tới đâu mới gọi là khác)
const refCross = [];
for (const y of YEARS)
  for (let i = 0; i < MONTHS.length; i++)
    for (let j = i + 1; j < MONTHS.length; j++) {
      const c = corrOfMaps(ymMap[`${y}-${MONTHS[i]}`], ymMap[`${y}-${MONTHS[j]}`]);
      refCross.push(c);
      task2.refCrossMonth.push({ y, m1: MONTHS[i], m2: MONTHS[j], rho: r3(c) });
    }
console.log(`  THAM CHIẾU cùng-năm KHÁC-tháng:    rho = ${mean(refCross).toFixed(3)}  (n=${refCross.length})`);
console.log(
  "\n  Đọc: nếu 'cùng-tháng-khác-năm' ≈ 'cùng-năm cách-16-ngày' thì các năm giống\n" +
    "  nhau ngang mức bản đồ tự đổi trong nửa tháng ⇒ chọn năm tương tự gần như\n" +
    "  không có gì để chọn. Nếu nó thấp hơn hẳn (gần mức KHÁC-tháng) thì có đất.",
);

/* ═══════════════════════════════════════════════════════════════════════════
   VIỆC 3 — KIỂM CHÉO BỎ-NĂM: (A) trung bình đều vs (B) nặng ký năm tương tự
   ═══════════════════════════════════════════════════════════════════════════ */

/** σ chuẩn hoá mỗi chỉ số: độ lệch GIỮA CÁC NĂM trong cùng tháng (gộp mọi tháng) */
const SIGMA = {};
for (const k of IDX_KEYS) {
  const perMonth = MONTHS.map((m) => std(YEARS.map((y) => ymIdx[`${y}-${m}`][k])));
  SIGMA[k] = mean(perMonth.filter(Number.isFinite));
}

/** khoảng cách chuẩn hoá giữa idx hôm nay và idx (năm khác, cùng tháng) */
function dz(idxNow, idxOther, keys = ["sstMean", "anomMean", "chlLogMean"]) {
  let acc = 0;
  let n = 0;
  for (const k of keys) {
    const s = SIGMA[k];
    if (!Number.isFinite(s) || s <= 0) continue;
    const d = (idxNow[k] - idxOther[k]) / s;
    if (!Number.isFinite(d)) continue;
    acc += d * d;
    n++;
  }
  return n ? Math.sqrt(acc / n) : NaN;
}
const absz = (idxNow, idxOther, k) => Math.abs((idxNow[k] - idxOther[k]) / SIGMA[k]);

/** CÁC CÔNG THỨC TRỌNG SỐ ĐEM THI (đầu vào: idx ngày T năm y; idx TB năm khác) */
const SCHEMES = [
  { id: "equal", label: "(A) trung bình ĐỀU", w: () => 1 },
  { id: "exp_anom", label: "exp(−|Δanom|/σ)", w: (a, b) => Math.exp(-absz(a, b, "anomMean")) },
  { id: "exp_sst", label: "exp(−|Δsst|/σ)", w: (a, b) => Math.exp(-absz(a, b, "sstMean")) },
  { id: "exp_chl", label: "exp(−|Δchl|/σ)", w: (a, b) => Math.exp(-absz(a, b, "chlLogMean")) },
  { id: "exp_dz", label: "exp(−d_z)  (3 chỉ số)", w: (a, b) => Math.exp(-dz(a, b)) },
  { id: "exp_dz_t05", label: "exp(−d_z/0,5) sắc", w: (a, b) => Math.exp(-dz(a, b) / 0.5) },
  { id: "exp_dz_t2", label: "exp(−d_z/2) thoải", w: (a, b) => Math.exp(-dz(a, b) / 2) },
  { id: "inv_dz", label: "1/(0,1+d_z)", w: (a, b) => 1 / (0.1 + dz(a, b)) },
];
/** chọn CỨNG k=1: chỉ lấy năm giống nhất */
const HARD = [
  { id: "best1_dz", label: "k=1 giống nhất theo d_z", key: (a, b) => dz(a, b) },
  { id: "best1_sst", label: "k=1 giống nhất theo sst", key: (a, b) => absz(a, b, "sstMean") },
  { id: "best1_anom", label: "k=1 giống nhất theo anom", key: (a, b) => absz(a, b, "anomMean") },
  { id: "worst1_dz", label: "k=1 KHÁC nhất (đối chứng)", key: (a, b) => -dz(a, b) },
];

const rows = []; // 1 dòng / (origin, lead)
for (const y of YEARS)
  for (const m of MONTHS) {
    const T = loadDay(dateOf(y, m, 0));
    if (!T) continue;
    const others = YEARS.filter((yy) => yy !== y);
    const otherMaps = others.map((yy) => ymMap[`${yy}-${m}`]);
    const otherIdx = others.map((yy) => ymIdx[`${yy}-${m}`]);

    for (const L of EVAL_LEADS) {
      const truthDay = loadDay(dateOf(y, m, L));
      if (!truthDay) continue;

      // tập ô chung: hợp (sự thật ∪ ảnh ngày T ∪ mọi bản năm khác)
      const keySet = new Set([...truthDay.map.keys(), ...T.map.keys()]);
      for (const om of otherMaps) for (const k of om.keys()) keySet.add(k);
      const keys = [...keySet];
      const yTrue = vecOf(truthDay.map, keys);

      const score = (map) => {
        const v = vecOf(map, keys);
        return { hit: topKHit(v, yTrue), rho: spearman(v, yTrue) };
      };

      const row = { year: y, month: m, lead: L, nCells: keys.length, variants: {} };
      // ngữ cảnh giữ lại cho KIỂM ĐỊNH HOÁN VỊ (không ghi ra file)
      Object.defineProperty(row, "_ctx", {
        value: { keys, yTrue, otherMaps, otherIdx, others, Tidx: T.idx },
        enumerable: false,
      });

      // tham chiếu: ẢNH NGÀY T (persistence) — để biết mùa vụ đứng ở đâu
      row.variants.persist = score(T.map);

      // các bản mùa vụ
      for (const s of SCHEMES) {
        const w = otherIdx.map((oi) => {
          const v = s.w(T.idx, oi);
          return Number.isFinite(v) && v > 0 ? v : 1e-9;
        });
        row.variants[s.id] = score(weightedMean(otherMaps, w));
        row.variants[s.id].w = w.map((v, i) => ({ y: others[i], w: r3(v / w.reduce((a, b) => a + b, 0)) }));
      }
      for (const h of HARD) {
        const ks = otherIdx.map((oi) => h.key(T.idx, oi));
        const pick = ks.indexOf(Math.min(...ks));
        row.variants[h.id] = score(otherMaps[pick]);
        row.variants[h.id].pickedYear = others[pick];
      }

      // TRẦN: oracle = năm đơn tốt nhất chọn bằng HẬU NGHIỆM (không cài được,
      // chỉ để biết giới hạn trên của việc chọn năm)
      const singles = otherMaps.map((om, i) => ({ y: others[i], ...score(om) }));
      const byHit = [...singles].sort((a, b) => b.hit - a.hit);
      row.variants.oracle_best1 = { hit: byHit[0].hit, rho: byHit[0].rho, pickedYear: byHit[0].y };
      row.variants.oracle_worst1 = {
        hit: byHit[byHit.length - 1].hit,
        rho: byHit[byHit.length - 1].rho,
        pickedYear: byHit[byHit.length - 1].y,
      };
      row.variants.single_mean = { hit: mean(singles.map((s) => s.hit)), rho: mean(singles.map((s) => s.rho)) };
      row.singles = singles.map((s) => ({ y: s.y, hit: r1(s.hit), rho: r3(s.rho) }));

      rows.push(row);
    }
  }

/* ── tổng hợp ─────────────────────────────────────────────────────────────── */
const VARIANT_ORDER = [
  "persist",
  "equal",
  ...SCHEMES.filter((s) => s.id !== "equal").map((s) => s.id),
  ...HARD.map((h) => h.id),
  "single_mean",
  "oracle_best1",
  "oracle_worst1",
];
const LABEL = {
  persist: "ẢNH ngày T (tham chiếu)",
  single_mean: "1 năm bất kỳ (TB)",
  oracle_best1: "★ TRẦN: năm tốt nhất (hậu nghiệm)",
  oracle_worst1: "☆ SÀN: năm tệ nhất (hậu nghiệm)",
  ...Object.fromEntries(SCHEMES.map((s) => [s.id, s.label])),
  ...Object.fromEntries(HARD.map((h) => [h.id, h.label])),
};

function agg(vid, lead = null) {
  const sub = rows.filter((r) => (lead == null || r.lead === lead) && r.variants[vid]);
  return {
    hit: mean(sub.map((r) => r.variants[vid].hit)),
    rho: mean(sub.map((r) => r.variants[vid].rho)),
    n: sub.length,
  };
}
/** danh sách MỐC GỐC (cụm) — mọi kiểm định phải gộp theo đây, không theo dòng */
const ORIGIN_IDS = [...new Set(rows.map((r) => `${r.year}-${r.month}`))];
/** chênh so với (A) gộp theo từng mốc gốc (trung bình các tầm ngày trong mốc) */
function deltaPerOrigin(vid, field = "hit") {
  return ORIGIN_IDS.map((oid) => {
    const sub = rows.filter((r) => `${r.year}-${r.month}` === oid && r.variants[vid]);
    return mean(sub.map((r) => r.variants[vid][field] - r.variants.equal[field]));
  }).filter(Number.isFinite);
}
/** so kèm với (A): chênh trung bình + thắng/thua ĐẾM THEO MỐC GỐC + kiểm định dấu */
function vsEqual(vid) {
  const dHit = deltaPerOrigin(vid, "hit");
  const dRho = deltaPerOrigin(vid, "rho");
  const wins = dHit.filter((d) => d > 0).length;
  const losses = dHit.filter((d) => d < 0).length;
  return { dHit: mean(dHit), dRho: mean(dRho), wins, losses, ties: dHit.length - wins - losses, p: signTest(wins, losses) };
}
/** kiểm định dấu 2 phía (nhị thức p=0,5) */
function signTest(w, l) {
  const n = w + l;
  if (!n) return 1;
  const C = (n, k) => {
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  };
  let p = 0;
  const x = Math.min(w, l);
  for (let k = 0; k <= x; k++) p += C(n, k) * Math.pow(0.5, n);
  return Math.min(1, 2 * p);
}

console.log("\n" + "═".repeat(78));
console.log("VIỆC 3 — KIỂM CHÉO BỎ-NĂM: bản mùa vụ tháng m dựng CHỈ từ các năm ≠ y");
console.log(`         ${rows.length} mẫu = ${rows.length / EVAL_LEADS.length} mốc gốc × ${EVAL_LEADS.length} tầm ngày (T+8, T+16)`);
console.log("═".repeat(78));
console.log(
  "\n  " +
    "cách dựng bản mùa vụ".padEnd(34) +
    "│ top100%  rho   │ T+8   T+16  │ Δtop100 vs(A) thắng/thua  p",
);
console.log("  " + "─".repeat(34) + "┼" + "─".repeat(16) + "┼" + "─".repeat(13) + "┼" + "─".repeat(28));
const summary = {};
for (const vid of VARIANT_ORDER) {
  const a = agg(vid);
  const a8 = agg(vid, 8);
  const a16 = agg(vid, 16);
  const v = vsEqual(vid);
  summary[vid] = {
    label: LABEL[vid] ?? vid,
    hit: r1(a.hit),
    rho: r3(a.rho),
    hit8: r1(a8.hit),
    hit16: r1(a16.hit),
    rho8: r3(a8.rho),
    rho16: r3(a16.rho),
    dHitVsEqual: r1(v.dHit),
    dRhoVsEqual: r3(v.dRho),
    wins: v.wins,
    losses: v.losses,
    ties: v.ties,
    signTestP: r3(v.p),
    n: a.n,
  };
  const mark = vid === "equal" ? "◆" : " ";
  console.log(
    `${mark} ${(LABEL[vid] ?? vid).padEnd(34)}│ ${a.hit.toFixed(1).padStart(6)}  ${a.rho.toFixed(3)} │ ` +
      `${a8.hit.toFixed(1).padStart(5)} ${a16.hit.toFixed(1).padStart(5)} │ ` +
      (vid === "equal"
        ? "        —"
        : `${(v.dHit >= 0 ? "+" : "") + v.dHit.toFixed(2)}`.padStart(9)) +
      (vid === "equal" ? "" : `      ${v.wins}/${v.losses}     ${v.p.toFixed(3)}`),
  );
}

/* ── ĐỘ CHÊNH GIỮA CÁC NĂM ĐƠN: có đáng để chọn không? ────────────────────── */
const spread = rows.map((r) => {
  const hs = r.singles.map((s) => s.hit);
  return Math.max(...hs) - Math.min(...hs);
});
const oracleGain = mean(rows.map((r) => r.variants.oracle_best1.hit - r.variants.equal.hit));
const worstGap = mean(rows.map((r) => r.variants.equal.hit - r.variants.oracle_worst1.hit));
console.log(
  `\n  Biên độ giữa các năm đơn (max−min top100, TB): ${mean(spread).toFixed(1)} điểm %` +
    `\n  TRẦN của việc chọn năm (oracle − trung-bình-đều): ${oracleGain >= 0 ? "+" : ""}${oracleGain.toFixed(2)} điểm %` +
    `\n  Chọn TRÚNG năm tệ nhất thì mất: −${worstGap.toFixed(2)} điểm %`,
);

/* ═══════════════════════════════════════════════════════════════════════════
   VIỆC 3b — CHẨN ĐOÁN QUYẾT ĐỊNH: CHỈ SỐ GIỐNG NHAU CÓ ĐOÁN ĐƯỢC NĂM NÀO
   CHO BẢN ĐỒ ĐÚNG HƠN KHÔNG?
   Đây mới là câu hỏi gốc. Mọi công thức trọng số chỉ ăn tiền NẾU thứ tự "giống"
   trùng với thứ tự "đúng". Xếp 3 năm ứng viên theo (a) độ giống chỉ số, (b) độ
   đúng thật (top-100 hit) rồi đo trùng khớp. Ngẫu nhiên = 33,3 %.
   ═══════════════════════════════════════════════════════════════════════════ */
const DIAG_KEYS = [
  { id: "dz", label: "d_z (3 chỉ số)", f: (a, b) => dz(a, b) },
  { id: "sst", label: "|Δ sstMean|", f: (a, b) => absz(a, b, "sstMean") },
  { id: "anom", label: "|Δ anomMean|", f: (a, b) => absz(a, b, "anomMean") },
  { id: "chl", label: "|Δ chlLogMean|", f: (a, b) => absz(a, b, "chlLogMean") },
];
const diag = {};
console.log("\n" + "═".repeat(78));
console.log("VIỆC 3b — CHỈ SỐ 'GIỐNG' CÓ ĐOÁN ĐƯỢC NĂM NÀO ĐÚNG HƠN KHÔNG?");
console.log("═".repeat(78));
console.log(
  "\n  " + "chỉ số dùng để chọn".padEnd(24) +
    "│ trúng năm tốt nhất │ ngẫu nhiên │ rho(giống, đúng)",
);
console.log("  " + "─".repeat(24) + "┼" + "─".repeat(20) + "┼" + "─".repeat(12) + "┼" + "─".repeat(18));
for (const dk of DIAG_KEYS) {
  let hitBest = 0;
  let nOrigin = 0;
  const simAll = [];
  const skillAll = [];
  for (const r of rows) {
    const y = r.year;
    const others = YEARS.filter((yy) => yy !== y);
    const T = loadDay(dateOf(y, r.month, 0));
    const sims = others.map((yy) => dk.f(T.idx, ymIdx[`${yy}-${r.month}`]));
    const skills = others.map((yy) => r.singles.find((s) => s.y === yy).hit);
    // "giống nhất" = sim nhỏ nhất; "đúng nhất" = hit lớn nhất
    const picked = sims.indexOf(Math.min(...sims));
    const truthBest = skills.indexOf(Math.max(...skills));
    if (picked === truthBest) hitBest++;
    nOrigin++;
    // gộp để tính tương quan: dùng −sim để cùng chiều "càng lớn càng tốt"
    for (let i = 0; i < others.length; i++) {
      simAll.push(-sims[i]);
      skillAll.push(skills[i]);
    }
  }
  const rho = spearman(simAll, skillAll);
  diag[dk.id] = { label: dk.label, pickBestPct: r1((hitBest / nOrigin) * 100), n: nOrigin, rhoSimSkill: r3(rho) };
  console.log(
    `  ${dk.label.padEnd(24)}│ ${((hitBest / nOrigin) * 100).toFixed(1).padStart(15)} % │   33.3 %   │ ${rho >= 0 ? "+" : ""}${rho.toFixed(3)}`,
  );
}
const bestDiag = Object.values(diag).sort((a, b) => b.pickBestPct - a.pickBestPct)[0];
console.log(
  `\n  Đọc: chỉ số tốt nhất (${bestDiag.label}) trúng năm-tốt-nhất ${bestDiag.pickBestPct} %` +
    ` so với ngẫu nhiên 33,3 %,\n  nhưng rho(giống, đúng) chỉ ${bestDiag.rhoSimSkill} ⇒ tín hiệu CÓ nhưng RẤT YẾU:` +
    `\n  đủ để NẶNG KÝ nhẹ, KHÔNG đủ để chọn cứng một năm.`,
);

/* ── PRNG tái lập được (mulberry32 — LCG kiểu C tràn số chính xác trong JS) ── */
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── bootstrap THEO CỤM (bốc lại MỐC GỐC, không bốc từng dòng) ─────────────
   Các tầm ngày của cùng một mốc gốc dùng chung bản mùa vụ và gần như cùng một
   sự thật ⇒ coi chúng độc lập sẽ thổi phồng độ tin cậy. Bốc theo mốc gốc. */
function bootstrapCI(vid, B = 20000) {
  const d = deltaPerOrigin(vid, "hit");
  const n = d.length;
  const ms = [];
  const rnd = rngOf(42);
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[Math.floor(rnd() * n)];
    ms.push(s / n);
  }
  ms.sort((a, b) => a - b);
  return { lo: r3(ms[Math.floor(B * 0.025)]), hi: r3(ms[Math.floor(B * 0.975)]), mean: r3(mean(d)), nClusters: n };
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIỆC 3c — KIỂM ĐỊNH HOÁN VỊ: cái lợi bé xíu kia có THẬT không?
   Giả thuyết KHÔNG: bộ trọng số vẫn LỆCH y hệt, nhưng GÁN NHẦM cho năm khác.
   Nếu gán bừa cũng lợi ngang thì cái lợi đó KHÔNG đến từ "độ giống" — nó chỉ là
   hiệu ứng của việc đánh trọng số lệch, tức là NHIỄU.
   Mỗi mốc gốc chỉ có 3 năm ứng viên ⇒ đúng 6 hoán vị ⇒ tính sẵn cả 6 rồi bốc.
   ═══════════════════════════════════════════════════════════════════════════ */
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const SOFT_IDS = SCHEMES.filter((s) => s.id !== "equal").map((s) => s.id);

/* MA TRẬN HOÁN VỊ: delta[mốc gốc][hoán vị][công thức]
   HOÁN VỊ THEO MỐC GỐC: trọng số chỉ phụ thuộc idx của mốc gốc ⇒ một mốc gốc
   phải nhận CÙNG một hoán vị cho mọi tầm ngày của nó (80 dòng chỉ có 16 quyết
   định thật — hoán vị theo dòng là gian lận độ tự do). Hoán vị số 0 = THẬT. */
const permMatrix = ORIGIN_IDS.map((oid) => {
  const sub = rows.filter((r) => `${r.year}-${r.month}` === oid);
  const c0 = sub[0]._ctx;
  const cached = sub.map((r) => ({
    row: r,
    vecs: r._ctx.otherMaps.map((m) => vecOf(m, r._ctx.keys)),
  }));
  return PERMS.map((p) =>
    SOFT_IDS.map((sid) => {
      const s = SCHEMES.find((x) => x.id === sid);
      const w0 = c0.otherIdx.map((oi) => {
        const v = s.w(c0.Tidx, oi);
        return Number.isFinite(v) && v > 0 ? v : 1e-9;
      });
      const w = p.map((i) => w0[i]);
      const ws = w[0] + w[1] + w[2];
      const per = cached.map(({ row: r, vecs }) => {
        const pred = new Float64Array(r._ctx.keys.length);
        for (let k = 0; k < pred.length; k++)
          pred[k] = (w[0] * vecs[0][k] + w[1] * vecs[1][k] + w[2] * vecs[2][k]) / ws;
        return topKHit(pred, r._ctx.yTrue) - r.variants.equal.hit;
      });
      return mean(per);
    }),
  );
});

function permTest(schemeId, B = 20000) {
  const si = SOFT_IDS.indexOf(schemeId);
  const realDelta = mean(permMatrix.map((o) => o[0][si]));
  const rnd = rngOf(7);
  const nullDeltas = [];
  for (let b = 0; b < B; b++) {
    let acc = 0;
    for (const o of permMatrix) acc += o[Math.floor(rnd() * 6)][si];
    nullDeltas.push(acc / permMatrix.length);
  }
  nullDeltas.sort((a, b) => a - b);
  const ge = nullDeltas.filter((d) => d >= realDelta).length;
  return {
    realDelta: r3(realDelta),
    nullMean: r3(mean(nullDeltas)),
    null95: [r3(nullDeltas[Math.floor(B * 0.025)]), r3(nullDeltas[Math.floor(B * 0.975)])],
    pPerm: r3((ge + 1) / (B + 1)),
  };
}

/** KIỂM ĐỊNH THỐNG-KÊ-LỚN-NHẤT: ta đã thử 8 công thức rồi lấy cái tốt nhất ⇒
    phải so cái tốt nhất THẬT với phân bố "tốt nhất trong 8" khi gán bừa.
    Đây mới là p đã trừ công hái quả (family-wise). */
function permTestMax(B = 20000) {
  const realBest = Math.max(
    ...SOFT_IDS.map((_, si) => mean(permMatrix.map((o) => o[0][si]))),
  );
  const rnd = rngOf(11);
  const nullMax = [];
  for (let b = 0; b < B; b++) {
    const picks = permMatrix.map(() => Math.floor(rnd() * 6));
    let best = -Infinity;
    for (let si = 0; si < SOFT_IDS.length; si++) {
      let acc = 0;
      for (let o = 0; o < permMatrix.length; o++) acc += permMatrix[o][picks[o]][si];
      best = Math.max(best, acc / permMatrix.length);
    }
    nullMax.push(best);
  }
  nullMax.sort((a, b) => a - b);
  const ge = nullMax.filter((d) => d >= realBest).length;
  return {
    realBestDelta: r3(realBest),
    nullMaxMean: r3(mean(nullMax)),
    nullMax95: r3(nullMax[Math.floor(B * 0.95)]),
    pFamilyWise: r3((ge + 1) / (B + 1)),
    nSchemes: SOFT_IDS.length,
  };
}

console.log("\n" + "═".repeat(78));
console.log("VIỆC 3c — KIỂM ĐỊNH HOÁN VỊ (gán trọng số cho NHẦM năm thì có lợi không?)");
console.log("═".repeat(78));
console.log(
  "\n  " + "công thức".padEnd(24) + "│ Δ thật │ Δ khi gán bừa (TB) │ dải 95 % giả thuyết-KHÔNG │ p",
);
console.log("  " + "─".repeat(24) + "┼" + "─".repeat(8) + "┼" + "─".repeat(20) + "┼" + "─".repeat(27) + "┼" + "─".repeat(7));
const permOut = {};
for (const sid of ["inv_dz", "exp_chl", "exp_dz", "exp_dz_t05"]) {
  const t = permTest(sid);
  permOut[sid] = t;
  const lb = SCHEMES.find((x) => x.id === sid).label;
  console.log(
    `  ${lb.padEnd(24)}│ ${(t.realDelta >= 0 ? "+" : "") + t.realDelta.toFixed(2)}`.padEnd(35) +
      `│ ${(t.nullMean >= 0 ? "+" : "") + t.nullMean.toFixed(2)}`.padEnd(21) +
      `│ [${t.null95[0].toFixed(2)} … ${t.null95[1].toFixed(2)}]`.padEnd(28) +
      `│ ${t.pPerm.toFixed(3)}`,
  );
}
const permMax = permTestMax();
console.log(
  `\n  ĐÃ TRỪ CÔNG HÁI QUẢ (thử ${permMax.nSchemes} công thức rồi lấy cái nhất):` +
    `\n    tốt nhất THẬT      : +${permMax.realBestDelta} điểm %` +
    `\n    tốt-nhất-khi-gán-bừa: TB ${permMax.nullMaxMean >= 0 ? "+" : ""}${permMax.nullMaxMean} · mốc 95 % = +${permMax.nullMax95}` +
    `\n    p (family-wise)    : ${permMax.pFamilyWise}` +
    `${permMax.pFamilyWise < 0.05 ? "  ⇒ VƯỢT ngưỡng hái quả" : "  ⇒ KHÔNG vượt nổi ngưỡng hái quả"}`,
);
console.log(
  "\n  Đọc: chỉ nhìn RIÊNG công thức thắng thì p=0,009 (có vẻ thật). NHƯNG khi gán\n" +
    "  bừa, cứ thử 7 công thức rồi lấy cái nhất cũng tự nhiên được +0,51 điểm %\n" +
    "  (mốc 95 % là +1,68) — tức là +1,46 CHƯA vượt nổi mức may rủi của việc hái\n" +
    "  quả. Đây là lý do KHÔNG được lấy p của riêng công thức thắng.",
);


/* ── xếp hạng công thức (chỉ trong nhóm mùa vụ) ───────────────────────────── */
const climVids = VARIANT_ORDER.filter(
  (v) => !["persist", "oracle_best1", "oracle_worst1", "single_mean"].includes(v),
);
const ranked = climVids
  .map((v) => ({ v, label: LABEL[v] ?? v, ...summary[v] }))
  .sort((a, b) => b.hit - a.hit);
console.log("\n  XẾP HẠNG công thức (top-100 hit, cao hơn = tốt hơn):");
ranked.forEach((r, i) =>
  console.log(
    `   ${String(i + 1).padStart(2)}. ${r.label.padEnd(32)} ${String(r.hit).padStart(5)}%  ` +
      `(Δ vs đều ${r.dHitVsEqual >= 0 ? "+" : ""}${r.dHitVsEqual}, p=${r.signTestP})`,
  ),
);

/* ── KẾT LUẬN TỰ ĐỘNG ─────────────────────────────────────────────────────── */
const best = ranked.find((r) => r.v !== "equal");
const bestCI = bootstrapCI(best.v);
console.log(
  `\n  Bootstrap 95 % khoảng tin cậy cho ${best.label} vs (A): ` +
    `${bestCI.mean >= 0 ? "+" : ""}${bestCI.mean} điểm % [${bestCI.lo} … ${bestCI.hi}]` +
    `${bestCI.lo <= 0 ? "  ⇒ CHỨA 0 = không phân biệt được với ngẫu nhiên" : "  ⇒ không chứa 0"}`,
);

/* ── ĐỘ BỀN: cái lợi trải đều hay do vài mốc gốc kéo? ─────────────────────── */
const dBest = deltaPerOrigin(best.v, "hit");
const dSorted = [...dBest].sort((a, b) => a - b);
const trimmed = mean(dSorted.slice(1, -1)); // bỏ 1 đầu 1 cuối
const dropOneOrigin = ORIGIN_IDS.map((_, i) => mean(dBest.filter((_, k) => k !== i)));
console.log(
  `\n  ĐỘ BỀN của ${best.label} (Δ top-100 theo từng mốc gốc, ${dBest.length} mốc):` +
    `\n    ${dBest.map((d) => (d >= 0 ? "+" : "") + d.toFixed(1)).join("  ")}` +
    `\n    trung vị ${dSorted[Math.floor(dSorted.length / 2)].toFixed(2)} · ` +
    `bỏ 1 đầu 1 cuối ${trimmed >= 0 ? "+" : ""}${trimmed.toFixed(2)} · ` +
    `mốc dương ${dBest.filter((d) => d > 0).length}/${dBest.length}` +
    `\n    bỏ đi 1 mốc bất kỳ ⇒ Δ chạy trong [${Math.min(...dropOneOrigin).toFixed(2)} … ${Math.max(...dropOneOrigin).toFixed(2)}]`,
);
const eq = summary.equal;
const idxDiscriminates = mean(
  IDX_KEYS.flatMap((k) => MONTHS.map((m) => task1.spread[k][m].ratio)).filter(Number.isFinite),
) > 1;
const verdictParts = [];
verdictParts.push(
  idxDiscriminates
    ? "Chỉ số hải dương CÓ phân biệt được các năm (lệch-năm > nhiễu-ngày)."
    : "Chỉ số hải dương KHÔNG phân biệt nổi các năm (lệch-năm ≤ nhiễu-ngày).",
);
// Ý NGHĨA THỐNG KÊ lấy theo KIỂM ĐỊNH HOÁN VỊ đã trừ công hái quả — KHÔNG lấy
// kiểm định dấu (dấu bỏ đi độ lớn, quá yếu với 16 cụm) và KHÔNG lấy p của riêng
// công thức thắng (đã hái quả từ 8 công thức).
const anyWin = permMax.pFamilyWise < 0.05 && best.dHitVsEqual > 0;
verdictParts.push(
  anyWin
    ? `NẶNG KÝ MỀM thắng thật: ${best.label} +${best.dHitVsEqual} điểm % top-100, ` +
        `p hoán vị đã trừ hái quả = ${permMax.pFamilyWise} (bootstrap cụm [${bestCI.lo} … ${bestCI.hi}]).`
    : `Không công thức nào vượt ngưỡng hái quả (tốt nhất ${best.label} ` +
        `${best.dHitVsEqual >= 0 ? "+" : ""}${best.dHitVsEqual} điểm %, p family-wise = ${permMax.pFamilyWise}).`,
);
verdictParts.push(
  `CHỌN CỨNG một năm thì THUA: k=1 giống nhất ${summary.best1_dz.dHitVsEqual} điểm % — ` +
    `vì gộp nhiều năm đã đáng ${(-summary.single_mean.dHitVsEqual).toFixed(1)} điểm %, ` +
    `tín hiệu tương tự không đủ trả giá đó.`,
);
verdictParts.push(
  `Trần của việc chọn năm (hậu nghiệm) là ${oracleGain >= 0 ? "+" : ""}${oracleGain.toFixed(2)} điểm %; ` +
    `công thức mềm tốt nhất đã lấy được ${Math.round((best.dHitVsEqual / oracleGain) * 100)} % cái trần đó.`,
);
verdictParts.push(
  `Chỉ ${ORIGIN_IDS.length} mốc gốc / ${YEARS.length} năm / ${MONTHS.length} tháng — mức lợi ` +
    `${best.dHitVsEqual} điểm % là NHỎ, hãy đo lại khi kho có thêm năm.`,
);
const recommend = anyWin;

console.log("\n" + "═".repeat(78));
console.log("KẾT LUẬN");
console.log("═".repeat(78));
verdictParts.forEach((p) => console.log("  · " + p));
console.log(
  `\n  ⇒ ${recommend ? "NÊN" : "KHÔNG NÊN"} làm bản mùa vụ có điều kiện theo năm tương tự.`,
);

/* ── ghi file ─────────────────────────────────────────────────────────────── */
mkdirSync(".cache", { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString().slice(0, 10),
      corpus: { dir: DAYS_DIR, years: YEARS, months: MONTHS, leads: LEADS, evalLeads: EVAL_LEADS },
      method: {
        absentPersist: ABSENT_PERSIST,
        topK: TOP_K,
        crossValidation: "leave-one-year-out (năm y KHÔNG bao giờ nằm trong bản mùa vụ chấm nó)",
        yearMonthMap: "trung bình các ngày lead 0..16 của (năm, tháng) đó",
        sigma: Object.fromEntries(Object.entries(SIGMA).map(([k, v]) => [k, r3(v)])),
      },
      task1_idxDiscrimination: task1,
      task2_mapSimilarity: {
        ...task2,
        meanCrossYearSameMonth: r3(mean(allCrossYear)),
        meanSameYear16d: r3(mean(ref16)),
        meanCrossMonth: r3(mean(refCross)),
      },
      task3b_diagnostic: {
        note: "chỉ số 'giống' có xếp đúng thứ tự năm nào cho bản đồ đúng hơn không — ngẫu nhiên = 33,3 %",
        perIndex: diag,
        bestSchemeBootstrapCI: { scheme: best.v, ...bestCI },
        permutationTest: {
          note: "giả thuyết KHÔNG = giữ nguyên bộ trọng số lệch nhưng gán cho năm khác (6 hoán vị/mốc)",
          perScheme: permOut,
          familyWiseMaxStat: permMax,
        },
        robustness: {
          scheme: best.v,
          deltaPerOrigin: Object.fromEntries(ORIGIN_IDS.map((oid, i) => [oid, r3(dBest[i])])),
          median: r3(dSorted[Math.floor(dSorted.length / 2)]),
          trimmedMean: r3(trimmed),
          positiveOrigins: `${dBest.filter((d) => d > 0).length}/${dBest.length}`,
          leaveOneOriginOutRange: [r3(Math.min(...dropOneOrigin)), r3(Math.max(...dropOneOrigin))],
        },
      },
      task3_analogSkill: {
        summary,
        ranked: ranked.map((r) => ({ id: r.v, label: r.label, hit: r.hit, dHitVsEqual: r.dHitVsEqual, p: r.signTestP })),
        singleYearSpreadMean: r1(mean(spread)),
        oracleGainOverEqual: r3(oracleGain),
        worstYearLossVsEqual: r3(-worstGap),
        rows: rows.map((r) => ({
          year: r.year,
          month: r.month,
          lead: r.lead,
          nCells: r.nCells,
          singles: r.singles,
          variants: Object.fromEntries(
            Object.entries(r.variants).map(([k, v]) => [k, { hit: r1(v.hit), rho: r3(v.rho), pickedYear: v.pickedYear, w: v.w }]),
          ),
        })),
      },
      verdict: { recommend, notes: verdictParts },
    },
    null,
    1,
  ),
);
console.log(`\n✓ ghi ${OUT}`);
